import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Minus, Plus, Search, Send, PackageCheck, Info } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { ROLE_LABELS } from '../../auth/permissions';
import { useSede } from '../../auth/SedeContext';
import { useToast } from '../../components/Toast';
import { InventarioService } from '../../services/inventarioService';
import { MaterialService } from '../../services/materialService';
import { ProductoInventario } from '../../types';

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
  const hayFrecuentes = listaFrecuentes.length > 0;
  const base = hayFrecuentes ? listaFrecuentes : (todos.data ?? []);

  const otros = useMemo(() => {
    const idsBase = new Set(base.map(p => p.id));
    const texto = busqueda.trim().toLowerCase();
    return (todos.data ?? [])
      .filter(p => !idsBase.has(p.id))
      .filter(p => !texto || p.nombre.toLowerCase().includes(texto)
        || p.categoria.toLowerCase().includes(texto));
  }, [todos.data, base, busqueda]);

  // Lo agregado desde el buscador se muestra junto a lo frecuente.
  const agregados = useMemo(
    () => (todos.data ?? []).filter(p => !base.some(b => b.id === p.id) && cantidades[p.id] > 0),
    [todos.data, base, cantidades]
  );

  const pedido = useMemo(
    () => [...base, ...agregados].filter(p => (cantidades[p.id] ?? 0) > 0),
    [base, agregados, cantidades]
  );

  function ajustar(id: number, delta: number) {
    setCantidades(prev => {
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

      await MaterialService.agregarItems(id, pedido.map(p => ({
        nombre: p.nombre,
        cantidad: cantidades[p.id],
        unidad: p.unidad,
        costoEstimado: null,
        itemId: p.id,
      })));

      await MaterialService.enviar(id);
    },
    onSuccess: () => {
      addToast('Pedido enviado. Bodega ya lo tiene.', 'success');
      setCantidades({});
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

  const totalArticulos = pedido.reduce((s, p) => s + cantidades[p.id], 0);

  return (
    <div className="page-container animate-in" style={{ paddingBottom: pedido.length > 0 ? '120px' : undefined }}>
      <header className="page-header" style={{ marginBottom: '20px' }}>
        <div>
          <h1 className="page-title">Pedir insumos</h1>
          <p className="page-subtitle">Marca lo que necesitas y envía. {sede.nombre}</p>
        </div>
      </header>

      {base.length === 0 ? (
        <div className="card" style={{ padding: '48px 24px', textAlign: 'center' }}>
          <PackageCheck size={44} style={{ color: 'var(--text-muted)', marginBottom: '14px' }} />
          <h3 style={{ marginBottom: '6px' }}>Todavía no hay productos cargados</h3>
          <p className="text-muted">Pídele a bodega que cargue los materiales de la sede.</p>
        </div>
      ) : (
        <>
          {!hayFrecuentes && (
            <p
              className="text-muted"
              style={{ display: 'flex', gap: '8px', alignItems: 'center', fontSize: '13px', marginBottom: '16px' }}
            >
              <Info size={15} /> Bodega todavía no marcó tus productos habituales, así que ves todo el inventario.
            </p>
          )}

          <section style={{ display: 'grid', gap: '10px', marginBottom: '24px' }}>
            {[...base, ...agregados].map(p => (
              <FilaProducto
                key={p.id}
                producto={p}
                cantidad={cantidades[p.id] ?? 0}
                onAjustar={delta => ajustar(p.id, delta)}
              />
            ))}
          </section>

          {/* Buscar algo que no está en la lista corta */}
          {!buscando ? (
            <button className="btn btn-outline" style={{ width: '100%' }} onClick={() => setBuscando(true)}>
              <Search size={17} /> Buscar otro producto
            </button>
          ) : (
            <section style={{ marginBottom: '24px' }}>
              <div className="search-container" style={{ marginBottom: '12px' }}>
                <Search size={18} className="search-icon" />
                <input
                  className="search-input" autoFocus
                  placeholder="Escribe qué necesitas"
                  value={busqueda}
                  onChange={e => setBusqueda(e.target.value)}
                />
              </div>
              <div style={{ display: 'grid', gap: '10px' }}>
                {otros.slice(0, 12).map(p => (
                  <FilaProducto
                    key={p.id}
                    producto={p}
                    cantidad={cantidades[p.id] ?? 0}
                    onAjustar={delta => ajustar(p.id, delta)}
                  />
                ))}
                {busqueda && otros.length === 0 && (
                  <p className="text-muted" style={{ textAlign: 'center', padding: '20px' }}>
                    No hay ningún producto con ese nombre en la bodega de esta sede.
                  </p>
                )}
              </div>
            </section>
          )}

          <div className="form-group" style={{ marginTop: '24px' }}>
            <label className="form-label" htmlFor="nota-pedido">¿Algo que agregar? (opcional)</label>
            <textarea
              id="nota-pedido" className="form-textarea" rows={2}
              placeholder="Se acabó el cloro del baño de niños"
              value={nota} onChange={e => setNota(e.target.value)}
            />
          </div>
        </>
      )}

      {/* Barra de envío: se queda a la vista mientras haya algo elegido */}
      {pedido.length > 0 && (
        <div
          style={{
            position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 900,
            padding: '14px 16px calc(14px + env(safe-area-inset-bottom))',
            background: 'rgba(255,255,255,0.96)',
            backdropFilter: 'saturate(180%) blur(20px)',
            borderTop: '1px solid var(--border-medium)',
            boxShadow: '0 -4px 20px rgba(0,0,0,0.08)',
          }}
        >
          <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 800, fontSize: '14px' }}>
                {pedido.length} producto{pedido.length === 1 ? '' : 's'} · {totalArticulos} en total
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {pedido.map(p => `${cantidades[p.id]} ${p.nombre}`).join(' · ')}
              </div>
            </div>
            <button
              className="btn btn-gold"
              style={{ flexShrink: 0 }}
              disabled={enviar.isPending}
              onClick={() => enviar.mutate()}
            >
              <Send size={18} /> {enviar.isPending ? 'Enviando…' : 'Enviar'}
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
  producto, cantidad, onAjustar,
}: {
  producto: ProductoInventario;
  cantidad: number;
  onAjustar: (delta: number) => void;
}) {
  const elegido = cantidad > 0;
  const sinStock = producto.stockActual <= 0;

  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: '12px',
        padding: '12px 14px', borderRadius: 'var(--radius-md)',
        border: `1.5px solid ${elegido ? 'var(--color-gold)' : 'var(--border-medium)'}`,
        background: elegido ? 'var(--gold-50)' : 'var(--bg-card)',
        transition: 'border-color .15s, background .15s',
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: '15px' }}>{producto.nombre}</div>
        <div style={{ fontSize: '12px', color: sinStock ? 'var(--color-warning)' : 'var(--text-muted)' }}>
          {sinStock
            ? 'No queda en bodega — se pedirá igual'
            : `Hay ${producto.stockActual} ${producto.unidadNombre.toLowerCase()}`}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
        <button
          type="button"
          className="btn btn-outline"
          style={{ width: 48, minHeight: 48, padding: 0, borderRadius: '12px' }}
          onClick={() => onAjustar(-1)}
          disabled={cantidad === 0}
          aria-label={`Quitar uno de ${producto.nombre}`}
        >
          <Minus size={20} />
        </button>
        <span
          style={{
            minWidth: 44, textAlign: 'center', fontSize: '19px', fontWeight: 900,
            fontVariantNumeric: 'tabular-nums',
            color: elegido ? 'var(--color-navy)' : 'var(--text-muted)',
          }}
          aria-live="polite"
          aria-label={`${cantidad} de ${producto.nombre}`}
        >
          {cantidad}
        </span>
        <button
          type="button"
          className="btn btn-outline"
          style={{ width: 48, minHeight: 48, padding: 0, borderRadius: '12px' }}
          onClick={() => onAjustar(1)}
          aria-label={`Agregar uno de ${producto.nombre}`}
        >
          <Plus size={20} />
        </button>
      </div>
    </div>
  );
}
