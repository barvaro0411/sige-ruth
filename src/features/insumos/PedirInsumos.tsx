import { useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Minus, Plus, Search, Send, PackageCheck, Info } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { ROLE_LABELS } from '../../auth/permissions';
import { useSede } from '../../auth/SedeContext';
import { useToast } from '../../components/Toast';
import { InventarioService } from '../../services/inventarioService';
import { MaterialService } from '../../services/materialService';
import { ProductoInventario } from '../../types';
import { lineasPedido, nombreUnidad } from '../../utils/presentaciones';

/**
 * Pedir insumos — pantalla mínima, pensada para el celular.
 *
 * Quien hace aseo no debería tener que entrar a un formulario administrativo
 * para pedir cloro. Acá se toca +, se toca Enviar, y listo: por dentro crea una
 * solicitud normal, que bodega gestiona como cualquier otra.
 *
 * Todo lo que no sea elegir cantidades está deliberadamente fuera: sin curso,
 * sin prioridad, sin presupuesto, sin fecha. Si algo de eso hace falta, existe
 * la pantalla de Materiales.
 */
export default function PedirInsumos() {
  const { user } = useAuth();
  const { sede } = useSede();
  const { addToast } = useToast();
  const queryClient = useQueryClient();

  const [cantidades, setCantidades] = useState<Record<number, number>>({});
  const [cajas, setCajas] = useState<Record<number, number>>({});
  const [nota, setNota] = useState('');
  const [buscando, setBuscando] = useState(false);
  const [busqueda, setBusqueda] = useState('');

  const frecuentes = useQuery({
    queryKey: ['frecuentes', sede.id, user?.id],
    queryFn: () => InventarioService.getMisFrecuentes(sede.id),
    enabled: !!user,
  });

  const todos = useQuery({
    queryKey: ['inventario', sede.id],
    queryFn: () => InventarioService.getProductos(sede.id),
  });

  // Sin frecuentes configurados no se muestra una pantalla vacía: se cae a
  // todo el inventario. Bodega puede acotarlo después marcando favoritos.
  const listaFrecuentes = frecuentes.data ?? [];
  const hayFrecuentes = listaFrecuentes.length> 0;
  const base = hayFrecuentes ? listaFrecuentes : (todos.data ?? []);
  const visiblesBase = hayFrecuentes || !busqueda.trim()
    ? base
    : base.filter(p => `${p.nombre} ${p.descripcion ?? ''} ${p.categoria}`
      .toLowerCase().includes(busqueda.trim().toLowerCase()));

  const otros = useMemo(() => {
    const idsBase = new Set(base.map(p => p.id));
    const texto = busqueda.trim().toLowerCase();
    return (todos.data ?? [])
      .filter(p => !idsBase.has(p.id) && !(cantidades[p.id] > 0 || cajas[p.id] > 0))
      .filter(p => !texto || p.nombre.toLowerCase().includes(texto)
        || p.categoria.toLowerCase().includes(texto));
  }, [todos.data, base, busqueda, cantidades, cajas]);

  // Lo agregado desde el buscador se muestra junto a lo frecuente.
  const agregados = useMemo(
    () => (todos.data ?? []).filter(p => !base.some(b => b.id === p.id)
      && ((cantidades[p.id] ?? 0) > 0 || (cajas[p.id] ?? 0) > 0)),
    [todos.data, base, cantidades, cajas]
  );

  const pedido = useMemo(
    () => [...base, ...agregados].filter(p => (cantidades[p.id] ?? 0) > 0 || (cajas[p.id] ?? 0) > 0),
    [base, agregados, cantidades, cajas]
  );

  function ajustar(
    setValores: Dispatch<SetStateAction<Record<number, number>>>,
    id: number,
    delta: number
  ) {
    setValores(prev => {
      const nuevo = Math.max((prev[id] ?? 0) + delta, 0);
      if (nuevo === 0) {
        const { [id]: _quitado, ...resto } = prev;
        return resto;
      }
      return { ...prev, [id]: nuevo };
    });
  }

  const enviar = useMutation({
    mutationFn: async () => {
      const hoy = new Date().toLocaleDateString('es-CL', {
        day: '2-digit', month: 'long', timeZone: 'America/Santiago',
      });
      const quien = user?.rol ? ROLE_LABELS[user.rol] : 'Personal';

      const id = await MaterialService.crearBorrador({
        solicitanteId: user!.id,
        sedeId: sede.id,
        titulo: `${quien} — pedido del ${hoy}`,
        justificacion: nota,
        cursoId: null,
        area: null,
        prioridad: 'normal',
        fechaNecesidad: null,
      });

      await MaterialService.agregarItems(id, lineasPedido(pedido, cantidades, cajas));

      await MaterialService.enviar(id);
    },
    onSuccess: () => {
      addToast('Pedido enviado. Bodega ya lo tiene.', 'success');
      setCantidades({});
      setCajas({});
      setNota('');
      setBusqueda('');
      setBuscando(false);
      queryClient.invalidateQueries({ queryKey: ['materiales'] });
    },
    onError: (e: Error) => addToast(e.message, 'danger'),
  });

  if (frecuentes.isLoading || todos.isLoading) {
    return <div className="page-container"><div className="skeleton" style={{ height: 380 }} /></div>;
  }

  return (
    <div className="page-container animate-in" style={{ paddingBottom: pedido.length> 0 ? '120px' : undefined }}>
      <header className="page-header mb-5">
        <div>
          <h1 className="page-title">Pedir insumos</h1>
          <p className="page-subtitle">Marca lo que necesitas y envía. {sede.nombre}</p>
        </div>
      </header>

      {(frecuentes.isError || todos.isError) && (
        <div className="alerta alerta-danger alerta-bloque mb-4" role="alert">
          <span>No se pudo cargar parte del catálogo. Puedes pedir los productos visibles o reintentar.</span>
          <button type="button" className="btn btn-outline" onClick={() => {
            void frecuentes.refetch();
            void todos.refetch();
          }}>Reintentar</button>
        </div>
      )}

      {base.length === 0 && !(frecuentes.isError || todos.isError) ? (
        <div className="card py-12 px-6 text-center">
          <PackageCheck size={44} style={{ color: 'var(--text-muted)', marginBottom: '14px' }} />
          <h3 className="mb-1">Todavía no hay productos cargados</h3>
          <p className="text-muted">Pídele a bodega que cargue los materiales de la sede.</p>
        </div>
      ) : base.length > 0 ? (
        <>
          <p className="insumos-ayuda mb-4">
            <Info size={17} aria-hidden="true" />
            Puedes pedir cajas y unidades sueltas del mismo producto. Bodega verá cada cantidad por separado.
          </p>
          {!hayFrecuentes && (
            <>
              <p className="text-muted flex gap-2 items-center text-sm mb-4">
                <Info size={15} /> Ves todo el inventario. Puedes buscar por nombre o marca.
              </p>
              <div className="search-container mb-4">
                <Search size={18} className="search-icon" />
                <input className="search-input" aria-label="Buscar producto"
                  placeholder="Buscar producto o marca"
                  value={busqueda} onChange={e => setBusqueda(e.target.value)} />
              </div>
            </>
          )}

          <section className="grid gap-2 mb-6">
            {[...visiblesBase, ...agregados].map(p => (
              <FilaProducto
                key={p.id}
                producto={p}
                cantidad={cantidades[p.id] ?? 0}
                cantidadCajas={cajas[p.id] ?? 0}
                onAjustar={delta => ajustar(setCantidades, p.id, delta)}
                onAjustarCajas={delta => ajustar(setCajas, p.id, delta)}
 />
            ))}
            {!hayFrecuentes && visiblesBase.length === 0 && (
              <p className="text-muted text-center p-5">No hay productos que coincidan con la búsqueda.</p>
            )}
          </section>

          {/* Buscar algo que no está en la lista corta */}
          {hayFrecuentes && (!buscando ? (
            <button className="btn btn-outline w-full"  onClick={() => setBuscando(true)}>
              <Search size={17} /> Buscar otro producto
            </button>
          ) : (
            <section className="mb-6">
              <div className="search-container mb-3">
                <Search size={18} className="search-icon" />
                <input
                  className="search-input" autoFocus
                  aria-label="Buscar otro producto"
                  placeholder="Escribe qué necesitas"
                  value={busqueda}
                  onChange={e => setBusqueda(e.target.value)}
 />
              </div>
              <div className="grid gap-2">
                {otros.slice(0, 12).map(p => (
                  <FilaProducto
                    key={p.id}
                    producto={p}
                    cantidad={cantidades[p.id] ?? 0}
                    cantidadCajas={cajas[p.id] ?? 0}
                    onAjustar={delta => ajustar(setCantidades, p.id, delta)}
                    onAjustarCajas={delta => ajustar(setCajas, p.id, delta)}
 />
                ))}
                {busqueda && otros.length === 0 && (
                  <p className="text-muted text-center p-5">
                    No hay más productos con ese nombre. Los seleccionados aparecen arriba.
                  </p>
                )}
              </div>
            </section>
          ))}

          <div className="form-group mt-6">
            <label className="form-label" htmlFor="nota-pedido">¿Algo que agregar? (opcional)</label>
            <textarea
              id="nota-pedido" className="form-textarea" rows={2}
              placeholder="Se acabó el cloro del baño de niños"
              value={nota} onChange={e => setNota(e.target.value)}
 />
          </div>
        </>
      ) : null}

      {/* Barra de envío: se queda a la vista mientras haya algo elegido */}
      {pedido.length > 0 && (
        <div className="insumos-floating-bar">
          <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 800, fontSize: '14px', color: 'var(--text-primary)' }}>
                {pedido.length} producto{pedido.length === 1 ? '' : 's'} seleccionado{pedido.length === 1 ? '' : 's'}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {pedido.map(p => {
                  const detalle = [];
                  if (cajas[p.id]) detalle.push(`${cajas[p.id]} ${cajas[p.id] === 1 ? 'caja' : 'cajas'}`);
                  if (cantidades[p.id]) detalle.push(`${cantidades[p.id]} ${nombreUnidad(p.unidad, cantidades[p.id])}`);
                  return `${p.nombre}: ${detalle.join(' + ')}`;
                }).join(' · ')}
              </div>
            </div>
            <button
              className="btn btn-gold"
              style={{ flexShrink: 0, minHeight: '44px', padding: '10px 22px' }}
              disabled={enviar.isPending}
              onClick={() => enviar.mutate()}
            >
              <Send size={18} /> {enviar.isPending ? 'Enviando…' : 'Enviar pedido'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Una fila = un producto. Los botones son de 48px porque se usan de pie,
 * con una mano, y a veces con guantes.
 */
function FilaProducto({
  producto, cantidad, cantidadCajas, onAjustar, onAjustarCajas,
}: {
  producto: ProductoInventario;
  cantidad: number;
  cantidadCajas: number;
  onAjustar: (delta: number) => void;
  onAjustarCajas: (delta: number) => void;
}) {
  const elegido = cantidad > 0 || cantidadCajas > 0;
  const sinStock = producto.stockActual <= 0;
  const total = cantidad + cantidadCajas * (producto.unidadesPorCaja ?? 0);

  return (
    <div className={`insumo-producto ${elegido ? 'insumo-producto-elegido' : ''}`}>
      <div className="insumo-producto-info">
        <div className="insumo-producto-titulo">
          <span>{producto.nombre}</span>
          {elegido && <span className="insumo-elegido-badge">En el pedido</span>}
        </div>
        <div className={`insumo-stock ${sinStock ? 'insumo-stock-agotado' : ''}`}>
          {sinStock
            ? 'No queda en bodega — se pedirá igual'
            : `Stock: ${producto.stockActual} ${nombreUnidad(producto.unidad, producto.stockActual)}`}
        </div>
        {producto.unidadesPorCaja && (
          <div className="insumo-equivalencia">1 caja = {producto.unidadesPorCaja} {nombreUnidad(producto.unidad, producto.unidadesPorCaja)}</div>
        )}
        {elegido && <div className="insumo-total">Pedido total: {total} {nombreUnidad(producto.unidad, total)}</div>}
      </div>
      <div className="insumo-controles">
        {producto.unidadesPorCaja && (
          <ControlCantidad
            etiqueta={`Cajas · ${producto.unidadesPorCaja} ${nombreUnidad(producto.unidad, producto.unidadesPorCaja)} c/u`}
            cantidad={cantidadCajas}
            onAjustar={onAjustarCajas}
            nombre={producto.nombre}
          />
        )}
        <ControlCantidad
          etiqueta={producto.unidadesPorCaja
            ? `${nombreUnidad(producto.unidad, 2)} sueltos`
            : nombreUnidad(producto.unidad, 2)}
          cantidad={cantidad}
          onAjustar={onAjustar}
          nombre={producto.nombre}
        />
      </div>
    </div>
  );
}

function ControlCantidad({ etiqueta, cantidad, onAjustar, nombre }: {
  etiqueta: string;
  cantidad: number;
  onAjustar: (delta: number) => void;
  nombre: string;
}) {
  return (
    <div className="insumo-control">
      <span className="insumo-control-etiqueta">{etiqueta}</span>
      <div className="flex items-center gap-1 shrink-0">
        <button
          type="button"
          className="btn btn-outline"
          style={{ width: 48, minHeight: 48, padding: 0, borderRadius: '12px' }}
          onClick={() => onAjustar(-1)}
          disabled={cantidad === 0}
          aria-label={`Quitar ${etiqueta} de ${nombre}`}
        >
          <Minus size={20} />
        </button>
        <span
          style={{
            minWidth: 44, textAlign: 'center', fontSize: '19px', fontWeight: 900,
            fontVariantNumeric: 'tabular-nums',
            color: cantidad > 0 ? 'var(--text-primary)' : 'var(--text-muted)',
          }}
          aria-live="polite"
          aria-label={`${cantidad} ${etiqueta} de ${nombre}`}
        >
          {cantidad}
        </span>
        <button
          type="button"
          className="btn btn-outline"
          style={{ width: 48, minHeight: 48, padding: 0, borderRadius: '12px' }}
          onClick={() => onAjustar(1)}
          aria-label={`Agregar ${etiqueta} de ${nombre}`}
        >
          <Plus size={20} />
        </button>
      </div>
    </div>
  );
}
