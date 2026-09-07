import { FormEvent, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle, Box, Boxes, Check, Edit2, MapPin, Minus,
  PackageX, Plus, RefreshCw, Search, History,
} from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { PERMISSIONS } from '../../auth/permissions';
import { useSede } from '../../auth/SedeContext';
import Modal from '../../components/Modal';
import { useToast } from '../../components/Toast';
import {
  ETIQUETA_MOVIMIENTO, InventarioService, NuevoProducto,
} from '../../services/inventarioService';
import { EstadoStock, ProductoInventario, TipoMovimiento } from '../../types';

const ESTILO_ESTADO: Record<EstadoStock, { clase: string; texto: string }> = {
  agotado: { clase: 'badge-danger', texto: 'Agotado' },
  bajo: { clase: 'badge-warning', texto: 'Stock bajo' },
  ok: { clase: 'badge-success', texto: 'Suficiente' },
};

const FORM_VACIO = {
  categoriaId: 0,
  nombre: '',
  descripcion: '',
  unidad: 'unidad',
  stockMinimo: 0,
  ubicacion: '',
  rolesFrecuentes: [] as string[],
};

/**
 * Para quiénes tiene sentido marcar un producto como habitual. No están todos
 * los roles: dirección y sostenedora no piden materiales para trabajar.
 */
const ROLES_CON_LISTA = [
  { rol: 'aseo', label: 'Aseo' },
  { rol: 'docente', label: 'Docentes' },
  { rol: 'fonoaudiologo', label: 'Fonoaudiología' },
  { rol: 'mantencion', label: 'Mantención' },
];

export default function InventarioModule() {
  const { can } = useAuth();
  const { sede } = useSede();
  const { addToast } = useToast();
  const queryClient = useQueryClient();

  const puedeAdministrar = can(PERMISSIONS.MANAGE_INVENTORY);
  const puedeMover = can(PERMISSIONS.RECORD_MOVEMENT);

  const [busqueda, setBusqueda] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState('');
  const [soloFaltantes, setSoloFaltantes] = useState(false);

  const [formProducto, setFormProducto] = useState<typeof FORM_VACIO | null>(null);
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [moviendo, setMoviendo] = useState<ProductoInventario | null>(null);
  const [viendoHistorial, setViendoHistorial] = useState<ProductoInventario | null>(null);
  const [errorForm, setErrorForm] = useState('');

  const { data: productos = [], isLoading } = useQuery({
    queryKey: ['inventario', sede.id],
    queryFn: () => InventarioService.getProductos(sede.id),
  });
  const { data: categorias = [] } = useQuery({
    queryKey: ['inventario-categorias'],
    queryFn: InventarioService.getCategorias,
  });
  const { data: unidades = [] } = useQuery({
    queryKey: ['inventario-unidades'],
    queryFn: InventarioService.getUnidades,
  });

  function refrescar() {
    queryClient.invalidateQueries({ queryKey: ['inventario', sede.id] });
  }

  const guardarProducto = useMutation({
    mutationFn: async (form: typeof FORM_VACIO) => {
      const payload: Omit<NuevoProducto, 'sedeId'> = {
        categoriaId: form.categoriaId,
        nombre: form.nombre,
        descripcion: form.descripcion || null,
        unidad: form.unidad,
        stockMinimo: Number(form.stockMinimo) || 0,
        ubicacion: form.ubicacion || null,
      };
      let id: number;
      if (editandoId) {
        await InventarioService.actualizarProducto(editandoId, payload);
        id = editandoId;
      } else {
        id = await InventarioService.crearProducto({ ...payload, sedeId: sede.id });
      }
      await InventarioService.setRolesFrecuentes(id, form.rolesFrecuentes);
    },
    onSuccess: () => {
      addToast(editandoId ? 'Producto actualizado' : 'Producto creado', 'success');
      setFormProducto(null);
      setEditandoId(null);
      refrescar();
      queryClient.invalidateQueries({ queryKey: ['frecuentes'] });
    },
    onError: (e: Error) => setErrorForm(e.message),
  });

  const recalcular = useMutation({
    mutationFn: () => InventarioService.recalcularStock(),
    onSuccess: (corregidos) => {
      addToast(
        corregidos === 0
          ? 'Todo el stock coincide con los movimientos'
          : `Se corrigieron ${corregidos} producto(s)`,
        corregidos === 0 ? 'success' : 'warning'
      );
      refrescar();
    },
    onError: (e: Error) => addToast(e.message, 'danger'),
  });

  const visibles = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    return productos.filter(p => {
      if (soloFaltantes && p.estadoStock === 'ok') return false;
      if (filtroCategoria && String(p.categoriaId) !== filtroCategoria) return false;
      if (!texto) return true;
      return p.nombre.toLowerCase().includes(texto)
        || p.categoria.toLowerCase().includes(texto)
        || (p.ubicacion ?? '').toLowerCase().includes(texto);
    });
  }, [productos, busqueda, filtroCategoria, soloFaltantes]);

  const faltantes = useMemo(
    () => productos.filter(p => p.estadoStock !== 'ok'),
    [productos]
  );

  function abrirNuevo() {
    setErrorForm('');
    setEditandoId(null);
    setFormProducto({ ...FORM_VACIO, categoriaId: categorias[0]?.id ?? 0 });
  }

  async function abrirEdicion(p: ProductoInventario) {
    setErrorForm('');
    setEditandoId(p.id);
    setFormProducto({
      categoriaId: p.categoriaId,
      nombre: p.nombre,
      descripcion: p.descripcion ?? '',
      unidad: p.unidad,
      stockMinimo: p.stockMinimo,
      ubicacion: p.ubicacion ?? '',
      rolesFrecuentes: [],
    });
    // Se cargan aparte para no demorar la apertura del formulario.
    try {
      const roles = await InventarioService.getRolesFrecuentes(p.id);
      setFormProducto(prev => (prev ? { ...prev, rolesFrecuentes: roles } : prev));
    } catch {
      // Si falla, el formulario sirve igual; solo no precarga las marcas.
    }
  }

  if (isLoading) {
    return <div className="page-container"><div className="skeleton" style={{ height: 420 }} /></div>;
  }

  return (
    <div className="page-container animate-in">
      <header className="page-header">
        <div>
          <h1 className="page-title">Bodega</h1>
          <p className="page-subtitle">
            Materiales de {sede.nombre} — el stock sale de los movimientos registrados
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {puedeMover && (
            <button
              className="btn btn-outline"
              onClick={() => recalcular.mutate()}
              disabled={recalcular.isPending}
              title="Recalcula el stock sumando todos los movimientos"
            >
              <RefreshCw size={16} /> Revisar cuadratura
            </button>
          )}
          {puedeAdministrar && (
            <button className="btn btn-gold" onClick={abrirNuevo}>
              <Plus size={18} /> Nuevo producto
            </button>
          )}
        </div>
      </header>

      {/* Lo primero que se necesita saber: qué falta */}
      {faltantes.length> 0 && (
        <section
          className="card"
          style={{ padding: '20px 24px', marginBottom: '24px', borderColor: 'var(--color-warning)' }}
        >
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={20} style={{ color: 'var(--color-warning)' }} />
            <h2 className="text-md font-extrabold">
              Hay que reponer {faltantes.length} producto{faltantes.length === 1 ? '' : 's'}
            </h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {faltantes.map(p => (
              <button
                key={p.id}
                onClick={() => { setSoloFaltantes(true); setBusqueda(p.nombre); }}
                className={`badge ${p.estadoStock === 'agotado' ? 'badge-danger' : 'badge-warning'}`}
                style={{ cursor: 'pointer', fontFamily: 'inherit' }}
              >
                {p.nombre}: quedan {p.stockActual} {p.unidadNombre.toLowerCase()}
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Filtros */}
      <section className="flex gap-3 flex-wrap mb-5">
        <div className="search-container" style={{ flex: '1 1 260px' }}>
          <Search size={18} className="search-icon" />
          <input
            className="search-input"
            placeholder="Buscar producto, categoría o ubicación"
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
 />
        </div>
        <select
          className="form-select"
          style={{ flex: '0 1 220px' }}
          value={filtroCategoria}
          onChange={e => setFiltroCategoria(e.target.value)}
        >
          <option value="">Todas las categorías</option>
          {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
        <button
          className={`btn ${soloFaltantes ? 'btn-gold' : 'btn-outline'}`}
          onClick={() => setSoloFaltantes(v => !v)}
        >
          <AlertTriangle size={16} /> Solo lo que falta
        </button>
      </section>

      {visibles.length === 0 ? (
        <div className="card py-12 px-6 text-center">
          <Boxes size={44} style={{ color: 'var(--text-muted)', marginBottom: '14px' }} />
          <h3 className="mb-1">
            {productos.length === 0
              ? 'Todavía no hay productos en esta bodega'
              : soloFaltantes
                ? 'Todo el inventario está sobre el stock mínimo'
                : 'Ningún producto coincide con la búsqueda'}
          </h3>
          <p className="text-muted">
            {productos.length === 0 && puedeAdministrar
              ? 'Crea el primero con «Nuevo producto» y registra su ingreso.'
              : productos.length === 0
                ? 'Pídele a bodega o a secretaría que cargue los materiales.'
                : ''}
          </p>
        </div>
      ) : (
        <section className="grid grid-fluid">
          {visibles.map(p => {
            const estado = ESTILO_ESTADO[p.estadoStock];
            return (
              <article key={p.id} className="card p-5">
                <div className="flex justify-between gap-2 mb-2">
                  <div>
                    <h3 className="text-md font-extrabold">{p.nombre}</h3>
                    <p className="text-sm text-muted">{p.categoria}</p>
                  </div>
                  <span className={`badge ${estado.clase}`} style={{ height: 'fit-content' }}>{estado.texto}</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', margin: '14px 0 6px' }}>
                  <span style={{ fontSize: '30px', fontWeight: 900, color: 'var(--color-navy)', fontVariantNumeric: 'tabular-nums' }}>
                    {p.stockActual}
                  </span>
                  <span className="text-sm text-secondary font-semibold">
                    {p.unidadNombre.toLowerCase()}
                  </span>
                </div>

                <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '0 0 14px' }}>
                  {p.stockMinimo> 0 ? <>Mínimo {p.stockMinimo}</> : 'Sin mínimo definido'}
                  {p.faltante> 0 && <> · <strong className="text-warning">faltan {p.faltante}</strong></>}
                  {p.ubicacion && <> · <MapPin size={11} style={{ verticalAlign: '-1px' }} /> {p.ubicacion}</>}
                </p>

                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '6px' }}>
                  {puedeMover && (
                    <button className="btn btn-outline btn-sm" style={{ flex: '1 1 auto', minHeight: '38px' }} onClick={() => setMoviendo(p)}>
                      <Box size={14} /> Movimiento
                    </button>
                  )}
                  <button className="btn btn-ghost btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', minHeight: '38px' }} onClick={() => setViendoHistorial(p)} title="Ver historial">
                    <History size={15} /> <span>Historial</span>
                  </button>
                  {puedeAdministrar && (
                    <button className="btn btn-ghost btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', minHeight: '38px' }} onClick={() => abrirEdicion(p)} title="Editar producto">
                      <Edit2 size={15} /> <span>Editar</span>
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </section>
      )}

      {formProducto && (
        <FormularioProducto
          form={formProducto}
          editando={!!editandoId}
          categorias={categorias}
          unidades={unidades}
          error={errorForm}
          guardando={guardarProducto.isPending}
          onChange={setFormProducto}
          onCancel={() => { setFormProducto(null); setEditandoId(null); }}
          onSubmit={() => guardarProducto.mutate(formProducto)}
 />
      )}

      {moviendo && (
        <FormularioMovimiento
          producto={moviendo}
          onClose={() => setMoviendo(null)}
          onHecho={() => { setMoviendo(null); refrescar(); }}
 />
      )}

      {viendoHistorial && (
        <HistorialProducto producto={viendoHistorial} onClose={() => setViendoHistorial(null)} />
      )}
    </div>
  );
}

// ─── Alta y edición ───────────────────────────────────────────────────────────

function FormularioProducto({
  form, editando, categorias, unidades, error, guardando, onChange, onCancel, onSubmit,
}: {
  form: typeof FORM_VACIO;
  editando: boolean;
  categorias: { id: number; nombre: string }[];
  unidades: { codigo: string; nombre: string }[];
  error: string;
  guardando: boolean;
  onChange: (f: typeof FORM_VACIO) => void;
  onCancel: () => void;
  onSubmit: () => void;
}) {
  function submit(e: FormEvent) {
    e.preventDefault();
    onSubmit();
  }

  return (
    <Modal isOpen onClose={onCancel} title={editando ? 'Editar producto' : 'Nuevo producto'} size="lg">
      <form onSubmit={submit}>
        {error && <div className="login-error mb-4" role="alert">{error}</div>}

        <div className="grid grid-2 gap-4">
          <div className="form-group col-span-full">
            <label className="form-label" htmlFor="prod-nombre">Nombre *</label>
            <input
              id="prod-nombre" required minLength={2} className="form-input" disabled={guardando}
              placeholder="Cartulina española roja"
              value={form.nombre}
              onChange={e => onChange({ ...form, nombre: e.target.value })}
 />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="prod-cat">Categoría *</label>
            <select
              id="prod-cat" required className="form-select" disabled={guardando}
              value={form.categoriaId}
              onChange={e => onChange({ ...form, categoriaId: Number(e.target.value) })}
            >
              {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="prod-unidad">Se mide en *</label>
            <select
              id="prod-unidad" required className="form-select" disabled={guardando}
              value={form.unidad}
              onChange={e => onChange({ ...form, unidad: e.target.value })}
            >
              {unidades.map(u => <option key={u.codigo} value={u.codigo}>{u.nombre}</option>)}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="prod-min">Avisar cuando queden menos de</label>
            <input
              id="prod-min" type="number" min={0} step="0.01" className="form-input" disabled={guardando}
              value={form.stockMinimo}
              onChange={e => onChange({ ...form, stockMinimo: Number(e.target.value) })}
 />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="prod-ubi">Dónde se guarda</label>
            <input
              id="prod-ubi" className="form-input" disabled={guardando}
              placeholder="Bodega, estante 2"
              value={form.ubicacion}
              onChange={e => onChange({ ...form, ubicacion: e.target.value })}
 />
          </div>

          <div className="form-group col-span-full">
            <label className="form-label" htmlFor="prod-desc">Detalle (opcional)</label>
            <input
              id="prod-desc" className="form-input" disabled={guardando}
              value={form.descripcion}
              onChange={e => onChange({ ...form, descripcion: e.target.value })}
 />
          </div>

          <div className="form-group col-span-full">
            <label className="form-label">Aparece primero al pedir para</label>
            <div className="flex gap-2 flex-wrap">
              {ROLES_CON_LISTA.map(r => {
                const marcado = form.rolesFrecuentes.includes(r.rol);
                return (
                  <label
                    key={r.rol}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '8px',
                      padding: '10px 14px', borderRadius: 'var(--radius-md)', cursor: 'pointer',
                      border: `1.5px solid ${marcado ? 'var(--color-gold)' : 'var(--border-medium)'}`,
                      background: marcado ? 'var(--gold-50)' : 'white',
                      fontWeight: 700, fontSize: '13.5px',
                    }}
                  >
                    <input
                      type="checkbox" checked={marcado} disabled={guardando}
                      onChange={() => onChange({
                        ...form,
                        rolesFrecuentes: marcado
                          ? form.rolesFrecuentes.filter(x => x !== r.rol)
                          : [...form.rolesFrecuentes, r.rol],
                      })}
 />
                    {r.label}
                  </label>
                );
              })}
            </div>
            <p className="text-muted text-sm mt-2">
              Quien tenga ese rol verá este producto de entrada en «Pedir insumos»,
              sin tener que buscarlo.
            </p>
          </div>
        </div>

        {!editando && (
          <p className="text-muted text-sm mt-4">
            El producto se crea con stock 0. Para cargarlo, registra un movimiento de ingreso.
          </p>
        )}

        <div className="modal-footer-sticky">
          <button type="button" className="btn btn-outline" onClick={onCancel} disabled={guardando}>Cancelar</button>
          <button type="submit" className="btn btn-gold" disabled={guardando}>
            {guardando ? 'Guardando…' : editando ? 'Guardar cambios' : 'Crear producto'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Movimientos ──────────────────────────────────────────────────────────────

const TIPOS_MANUALES: { tipo: TipoMovimiento; ayuda: string }[] = [
  { tipo: 'ingreso', ayuda: 'Llegó material a la bodega' },
  { tipo: 'compra', ayuda: 'Se compró y ya está guardado' },
  { tipo: 'entrega', ayuda: 'Se entregó a una sala o persona' },
  { tipo: 'devolucion', ayuda: 'Devolvieron material sin usar' },
  { tipo: 'baja', ayuda: 'Se dañó, venció o se perdió' },
];

function FormularioMovimiento({
  producto, onClose, onHecho,
}: {
  producto: ProductoInventario;
  onClose: () => void;
  onHecho: () => void;
}) {
  const { addToast } = useToast();
  const [modo, setModo] = useState<'movimiento' | 'conteo'>('movimiento');
  const [tipo, setTipo] = useState<TipoMovimiento>('ingreso');
  const [cantidad, setCantidad] = useState('');
  const [contado, setContado] = useState('');
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState('');

  const registrar = useMutation({
    mutationFn: async () => {
      if (modo === 'conteo') {
        return InventarioService.ajustarA(
          producto.id, Number(contado), producto.stockActual,
          motivo || 'Ajuste por conteo físico'
        );
      }
      return InventarioService.registrarMovimiento({
        itemId: producto.id, tipo, cantidad: Number(cantidad), motivo,
      });
    },
    onSuccess: () => { addToast('Movimiento registrado', 'success'); onHecho(); },
    onError: (e: Error) => setError(e.message),
  });

  const resta = tipo === 'entrega' || tipo === 'baja';
  const magnitud = Number(cantidad) || 0;
  const resultante = modo === 'conteo'
    ? Number(contado) || 0
    : producto.stockActual + (resta ? -magnitud : magnitud);
  const insuficiente = resultante < 0;

  function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (insuficiente) {
      setError(`No alcanza: hay ${producto.stockActual} y estás sacando ${magnitud}.`);
      return;
    }
    registrar.mutate();
  }

  return (
    <Modal isOpen onClose={onClose} title={producto.nombre} size="md">
      <form onSubmit={submit}>
        {error && <div className="login-error mb-4" role="alert">{error}</div>}

        <div className="tabs mb-5">
          <button type="button" className={`tab ${modo === 'movimiento' ? 'active' : ''}`} onClick={() => setModo('movimiento')}>
            Registrar movimiento
          </button>
          <button type="button" className={`tab ${modo === 'conteo' ? 'active' : ''}`} onClick={() => setModo('conteo')}>
            Corregir por conteo
          </button>
        </div>

        {modo === 'movimiento' ? (
          <>
            <div className="form-group mb-4">
              <label className="form-label">Qué pasó</label>
              <div className="grid gap-2">
                {TIPOS_MANUALES.map(t => (
                  <label
                    key={t.tipo}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 14px',
                      border: `1.5px solid ${tipo === t.tipo ? 'var(--color-gold)' : 'var(--border-medium)'}`,
                      borderRadius: 'var(--radius-md)', cursor: 'pointer',
                      background: tipo === t.tipo ? 'var(--gold-50)' : 'white',
                    }}
                  >
                    <input
                      type="radio" name="tipo-mov" checked={tipo === t.tipo}
                      onChange={() => setTipo(t.tipo)}
 />
                    <span className="font-bold text-base">{ETIQUETA_MOVIMIENTO[t.tipo]}</span>
                    <span className="text-sm text-muted">{t.ayuda}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="mov-cant">
                Cuánto {resta ? 'sale' : 'entra'} ({producto.unidadNombre.toLowerCase()}) *
              </label>
              <input
                id="mov-cant" required type="number" min="0.01" step="0.01" className="form-input"
                value={cantidad} onChange={e => setCantidad(e.target.value)} autoFocus
 />
            </div>
          </>
        ) : (
          <>
            <p className="text-muted text-base mb-4">
              Cuenta lo que hay en la bodega y escríbelo. El sistema calcula la diferencia
              y la deja registrada como ajuste, sin borrar nada del historial.
            </p>
            <div className="form-group">
              <label className="form-label" htmlFor="mov-cont">
                Cuánto hay realmente ({producto.unidadNombre.toLowerCase()}) *
              </label>
              <input
                id="mov-cont" required type="number" min="0" step="0.01" className="form-input"
                value={contado} onChange={e => setContado(e.target.value)} autoFocus
 />
            </div>
          </>
        )}

        <div className="form-group mt-4">
          <label className="form-label" htmlFor="mov-motivo">
            Motivo {modo === 'conteo' ? '' : '(a quién o para qué)'}
          </label>
          <input
            id="mov-motivo" className="form-input"
            placeholder={modo === 'conteo' ? 'Conteo de fin de mes' : 'Entrega a Medio Mayor A'}
            value={motivo} onChange={e => setMotivo(e.target.value)}
 />
        </div>

        <div
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            gap: '12px', padding: '14px 16px', marginTop: '20px', borderRadius: 'var(--radius-md)',
            background: insuficiente ? 'var(--color-danger-soft)' : 'var(--bg-main)',
          }}
        >
          <span className="text-sm font-bold text-secondary">
            Quedará en
          </span>
          <span
            style={{
              fontSize: '20px', fontWeight: 900, fontVariantNumeric: 'tabular-nums',
              color: insuficiente ? 'var(--color-danger)' : 'var(--color-navy)',
            }}
          >
            {insuficiente ? 'No alcanza' : `${resultante} ${producto.unidadNombre.toLowerCase()}`}
          </span>
        </div>

        <div className="modal-footer-sticky">
          <button type="button" className="btn btn-outline" onClick={onClose} disabled={registrar.isPending}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-gold" disabled={registrar.isPending || insuficiente}>
            {registrar.isPending ? 'Registrando…' : 'Registrar'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Historial ────────────────────────────────────────────────────────────────

function HistorialProducto({ producto, onClose }: { producto: ProductoInventario; onClose: () => void }) {
  const { data: movimientos = [], isLoading } = useQuery({
    queryKey: ['inventario-movimientos', producto.id],
    queryFn: () => InventarioService.getMovimientos(producto.id),
  });

  return (
    <Modal isOpen onClose={onClose} title={`Historial · ${producto.nombre}`} size="lg">
      {isLoading ? (
        <div className="skeleton h-50" />
      ) : movimientos.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '32px 0' }}>
          <PackageX size={38} style={{ color: 'var(--text-muted)', marginBottom: '10px' }} />
          <p className="text-muted">Este producto todavía no tiene movimientos registrados.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          {movimientos.map(m => {
            const suma = m.cantidad> 0;
            return (
              <div
                key={m.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: '14px',
                  padding: '12px 4px', borderBottom: '1px solid var(--border-light)',
                }}
              >
                <div
                  style={{
                    width: 34, height: 34, borderRadius: 10, flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: suma ? 'var(--color-success-soft)' : 'var(--color-danger-soft)',
                    color: suma ? 'var(--color-success)' : 'var(--color-danger)',
                  }}
                >
                  {suma ? <Plus size={16} /> : <Minus size={16} />}
                </div>
                <div className="flex-1">
                  <div className="font-bold text-base">
                    {ETIQUETA_MOVIMIENTO[m.tipo]}
                    {m.motivo && <span className="font-medium text-secondary"> — {m.motivo}</span>}
                  </div>
                  <div className="text-xs text-muted">
                    {new Date(m.createdAt).toLocaleString('es-CL', {
                      day: '2-digit', month: '2-digit', year: 'numeric',
                      hour: '2-digit', minute: '2-digit',
                    })}
                    {m.actorNombre && ` · ${m.actorNombre}`}
                  </div>
                </div>
                <span
                  style={{
                    fontWeight: 800, fontSize: '15px', fontVariantNumeric: 'tabular-nums',
                    color: suma ? 'var(--color-success)' : 'var(--color-danger)',
                  }}
                >
                  {suma ? '+' : ''}{m.cantidad}
                </span>
              </div>
            );
          })}
          <p className="text-muted text-sm mt-3 flex gap-1 items-center">
            <Check size={13} /> Los movimientos no se editan ni se borran: un error se corrige con un ajuste.
          </p>
        </div>
      )}
    </Modal>
  );
}
