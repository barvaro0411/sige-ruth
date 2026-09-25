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
import { descripcionCaja, nombreUnidad, permiteFracciones, salidaUnidadesEmpaque } from '../../utils/presentaciones';

const ESTILO_ESTADO: Record<EstadoStock, { clase: string; itemClase: string; texto: string }> = {
  agotado: { clase: 'badge-danger', itemClase: 'inventory-item-agotado', texto: 'Agotado' },
  bajo: { clase: 'badge-warning', itemClase: 'inventory-item-bajo', texto: 'Stock bajo' },
  ok: { clase: 'badge-success', itemClase: '', texto: 'Suficiente' },
};

function detallesProducto(descripcion: string | null) {
  const detalles: {
    marca?: string;
    codigo?: string;
    presentacion?: string;
    empaque?: string;
    nota: string;
  } = { nota: '' };
  const textoLibre: string[] = [];

  for (const fragmento of (descripcion ?? '').split(' · ')) {
    const match = /^(Marca|Código|Presentación|Empaque):\s*(.+)$/i.exec(fragmento);
    if (match) {
      const campo = match[1].toLowerCase();
      if (campo === 'marca') detalles.marca = match[2];
      if (campo === 'código') detalles.codigo = match[2];
      if (campo === 'presentación') detalles.presentacion = match[2];
      if (campo === 'empaque') detalles.empaque = match[2];
    } else if (fragmento && !fragmento.startsWith('Ref. listado:')) {
      textoLibre.push(fragmento);
    }
  }

  detalles.nota = textoLibre.join(' · ');
  return detalles;
}

const FORM_VACIO = {
  categoriaId: 0,
  nombre: '',
  descripcion: '',
  unidad: 'unidad',
  stockMinimo: 0,
  ubicacion: '',
  unidadesPorCaja: null as number | null,
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
  const [contandoEmpaque, setContandoEmpaque] = useState<ProductoInventario | null>(null);
  const [viendoHistorial, setViendoHistorial] = useState<ProductoInventario | null>(null);
  const [errorForm, setErrorForm] = useState('');

  const { data: productos = [], isLoading, isError, error: errorProductos, refetch } = useQuery({
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
        unidadesPorCaja: form.unidadesPorCaja,
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
        || (p.descripcion ?? '').toLowerCase().includes(texto)
        || p.categoria.toLowerCase().includes(texto)
        || (p.ubicacion ?? '').toLowerCase().includes(texto);
    });
  }, [productos, busqueda, filtroCategoria, soloFaltantes]);

  const faltantes = useMemo(
    () => productos.filter(p => p.estadoStock !== 'ok'),
    [productos]
  );
  const compartidos = useMemo(
    () => productos.filter(p => p.compartido).length,
    [productos]
  );
  const cajasAbiertas = productos.filter(p => p.empaqueVerificado && (p.unidadesCajaAbierta ?? 0) > 0).length;
  const empaquesPendientes = productos.filter(p => p.unidadesPorCaja && !p.empaqueVerificado).length;

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
      unidadesPorCaja: p.unidadesPorCaja,
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

  if (isError) {
    return <div className="page-container"><div className="card p-6" role="alert">
      <h1 className="page-title">No se pudo cargar la bodega</h1>
      <p className="text-muted mb-4">{errorProductos instanceof Error ? errorProductos.message : 'Comprueba tu conexión e inténtalo otra vez.'}</p>
      <button className="btn btn-gold" onClick={() => void refetch()}><RefreshCw size={16} /> Reintentar</button>
    </div></div>;
  }

  return (
    <div className="page-container animate-in inventory-page">
      <header className="page-header inventory-header">
        <div>
          <p className="inventory-eyebrow">Materiales y suministros</p>
          <h1 className="page-title">Bodega y stock</h1>
          <p className="page-subtitle">
            Consulta lo disponible y registra cada entrada o salida de material.
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

      <section className="inventory-summary" aria-label="Resumen de bodega">
        <div className="inventory-summary-main">
          <div className="inventory-summary-icon"><Boxes size={25} /></div>
          <div>
            <span className="inventory-summary-label">Artículos guardados</span>
            <strong className="inventory-summary-value">{productos.length}</strong>
            <span className="inventory-summary-caption">Disponibles para {sede.nombre}</span>
          </div>
        </div>
        <div className="inventory-summary-stat">
          <span className="inventory-summary-label">Para ambas escuelas</span>
          <strong className="inventory-summary-value">{compartidos}</strong>
          <span className="inventory-summary-caption">Stock compartido</span>
        </div>
        <div className={`inventory-summary-stat ${faltantes.length ? 'inventory-summary-attention' : ''}`}>
          <span className="inventory-summary-label">Por reponer</span>
          <strong className="inventory-summary-value">{faltantes.length}</strong>
          <span className="inventory-summary-caption">{faltantes.length ? 'Requieren atención' : 'Todo al día'}</span>
        </div>
        <div className="inventory-summary-stat inventory-summary-open">
          <span className="inventory-summary-label">Cajas abiertas</span>
          <strong className="inventory-summary-value">{cajasAbiertas}</strong>
          <span className="inventory-summary-caption">Productos con una caja en uso</span>
        </div>
      </section>

      {empaquesPendientes > 0 && puedeMover && (
        <div className="inventory-presentation-notice" role="status">
          <Box size={18} aria-hidden="true" />
          <span><strong>{empaquesPendientes} producto{empaquesPendientes === 1 ? '' : 's'}</strong> necesitan confirmar cuántas cajas siguen cerradas. El stock total no cambia al hacerlo.</span>
        </div>
      )}

      {faltantes.length> 0 && (
        <section className="inventory-alert" aria-label="Aviso de reposición">
          <div className="inventory-alert-icon"><AlertTriangle size={20} /></div>
          <div className="inventory-alert-copy">
            <strong>{faltantes.length} artículo{faltantes.length === 1 ? '' : 's'} por reponer</strong>
            <span>Revisa cuáles necesitan una nueva entrada de stock.</span>
          </div>
          <button className="btn btn-outline btn-sm" onClick={() => { setSoloFaltantes(true); setBusqueda(''); setFiltroCategoria(''); }}>
            Ver artículos
          </button>
        </section>
      )}

      <section className="inventory-toolbar" aria-label="Buscar y filtrar artículos">
        <div className="search-container inventory-search">
          <Search size={18} className="search-icon" />
          <input
            className="search-input"
            aria-label="Buscar artículos"
            placeholder="Buscar por nombre, marca o código"
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
 />
        </div>
        <select
          className="form-select inventory-category-filter"
          aria-label="Filtrar por categoría"
          value={filtroCategoria}
          onChange={e => setFiltroCategoria(e.target.value)}
        >
          <option value="">Todas las categorías</option>
          {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
        <button
          className={`btn ${soloFaltantes ? 'btn-gold' : 'btn-outline'}`}
          onClick={() => setSoloFaltantes(v => !v)}
          aria-pressed={soloFaltantes}
        >
          <AlertTriangle size={16} /> Por reponer
        </button>
      </section>

      <div className="inventory-list-heading">
        <h2>Artículos <span>{visibles.length}</span></h2>
        <p>La cantidad disponible se actualiza con cada movimiento.</p>
      </div>

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
        <section className="inventory-list" aria-label="Artículos de bodega">
          {visibles.map(p => {
            const estado = ESTILO_ESTADO[p.estadoStock];
            const detalle = detallesProducto(p.descripcion);
            return (
              <article key={p.id} className={`inventory-item ${estado.itemClase}`}>
                <div className="inventory-item-info">
                  <div className="inventory-item-meta">
                    <span className="inventory-category">{p.categoria}</span>
                    {p.compartido && <span className="inventory-shared">Ambas escuelas</span>}
                  </div>
                  <h3>{p.nombre}</h3>
                  {(detalle.marca || detalle.codigo) && (
                    <p className="inventory-item-identity">
                      {detalle.marca && <strong>{detalle.marca}</strong>}
                      {detalle.codigo && <span>Cód. {detalle.codigo}</span>}
                    </p>
                  )}
                  {(detalle.presentacion || detalle.nota) && (
                    <p className="inventory-item-description">{[detalle.presentacion, detalle.nota].filter(Boolean).join(' · ')}</p>
                  )}
                  <div className="inventory-item-footnotes">
                    {p.unidadesPorCaja && (
                      <span>Equivalencia: 1 caja = {p.unidadesPorCaja} {nombreUnidad(p.unidad, p.unidadesPorCaja)}</span>
                    )}
                    {p.ubicacion && <span><MapPin size={13} /> {p.ubicacion}</span>}
                  </div>
                  {p.unidadesPorCaja && (
                    <div className={`inventory-presentation ${p.empaqueVerificado ? '' : 'inventory-presentation-pending'}`}>
                      {p.empaqueVerificado ? (
                        <>
                          <span><strong>{p.cajasCerradas}</strong> caja{p.cajasCerradas === 1 ? '' : 's'} cerrada{p.cajasCerradas === 1 ? '' : 's'}</span>
                          <span><strong>{p.unidadesCajaAbierta}</strong> {nombreUnidad(p.unidad, p.unidadesCajaAbierta ?? 0)} en caja abierta</span>
                          <span><strong>{p.unidadesSueltas}</strong> {nombreUnidad(p.unidad, p.unidadesSueltas ?? 0)} sueltos</span>
                        </>
                      ) : <span>Presentación por confirmar · no se infiere del stock total</span>}
                    </div>
                  )}
                </div>
                <div className="inventory-item-stock">
                  <span className={`badge ${estado.clase}`}>{estado.texto}</span>
                  <div className="inventory-stock-quantity">
                    <strong>{p.stockActual}</strong>
                    <span>{nombreUnidad(p.unidad, p.stockActual)}</span>
                  </div>
                  {p.stockMinimo > 0 && (
                    <span className="inventory-stock-minimum">
                      Mínimo: {p.stockMinimo}
                      {p.faltante > 0 && <b> · Faltan {p.faltante}</b>}
                    </span>
                  )}
                </div>
                <div className="inventory-item-actions">
                  {puedeMover && (
                    <button className="btn btn-gold btn-sm" onClick={() => setMoviendo(p)}>
                      <Box size={15} /> Entrada / salida
                    </button>
                  )}
                  {puedeMover && p.unidadesPorCaja && (
                    <button className="btn btn-outline btn-sm" onClick={() => setContandoEmpaque(p)}>
                      <Boxes size={15} /> {p.empaqueVerificado ? 'Contar cajas' : 'Confirmar cajas'}
                    </button>
                  )}
                  <button className="btn btn-ghost btn-sm" onClick={() => setViendoHistorial(p)} title="Ver historial">
                    <History size={15} /> Historial
                  </button>
                  {puedeAdministrar && (
                    <button className="btn btn-ghost btn-sm" onClick={() => abrirEdicion(p)} title="Editar producto">
                      <Edit2 size={15} /> Editar
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

      {contandoEmpaque && (
        <FormularioConteoEmpaque
          producto={contandoEmpaque}
          onClose={() => setContandoEmpaque(null)}
          onHecho={() => { setContandoEmpaque(null); refrescar(); }}
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
              onChange={e => onChange({ ...form, unidad: e.target.value,
                unidadesPorCaja: e.target.value === 'caja' ? null : form.unidadesPorCaja })}
            >
              {unidades.map(u => <option key={u.codigo} value={u.codigo}>{u.nombre}</option>)}
            </select>
          </div>

          <div className="form-group col-span-full">
            <label className="form-label" htmlFor="prod-caja">Unidades de stock por caja (opcional)</label>
            <input
              id="prod-caja" type="number" min={2} max={1000} step={1} className="form-input"
              disabled={guardando || form.unidad === 'caja'} value={form.unidadesPorCaja ?? ''}
              placeholder="Ej.: 12 lápices por caja"
              onChange={e => onChange({ ...form, unidadesPorCaja: e.target.value ? Number(e.target.value) : null })}
            />
            <p className="text-muted text-sm">
              Solo si también se piden cajas completas. El stock siempre se cuenta en la unidad elegida arriba.
            </p>
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
                      background: marcado ? 'var(--gold-50)' : 'var(--bg-card)',
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
  const [presentacion, setPresentacion] = useState<'unidad' | 'caja'>('unidad');
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
        itemId: producto.id, tipo, cantidad: magnitud, motivo,
        cantidadCajas: presentacion === 'caja' ? cantidadIngresada : 0,
        observaciones: presentacion === 'caja' && producto.unidadesPorCaja
          ? descripcionCaja(Number(cantidad), producto.unidadesPorCaja, producto.unidad)
          : null,
      });
    },
    onSuccess: () => { addToast('Movimiento registrado', 'success'); onHecho(); },
    onError: (e: Error) => setError(e.message),
  });

  const resta = tipo === 'entrega' || tipo === 'baja';
  const cantidadIngresada = Number(cantidad) || 0;
  const magnitud = cantidadIngresada * (presentacion === 'caja' ? producto.unidadesPorCaja ?? 1 : 1);
  const resultante = modo === 'conteo'
    ? Number(contado) || 0
    : producto.stockActual + (resta ? -magnitud : magnitud);
  const insuficiente = resultante < 0;
  const sinConteoDeCajas = modo === 'movimiento' && resta && presentacion === 'caja'
    && !producto.empaqueVerificado;
  const faltanCajasCerradas = modo === 'movimiento' && resta && presentacion === 'caja'
    && producto.empaqueVerificado && cantidadIngresada > (producto.cajasCerradas ?? 0);
  const salidaSuelta = modo === 'movimiento' && resta && presentacion === 'unidad'
    && producto.unidadesPorCaja && producto.empaqueVerificado
    && Number.isInteger(magnitud) && magnitud > 0 && !insuficiente
    ? salidaUnidadesEmpaque({
      cajasCerradas: producto.cajasCerradas ?? 0,
      unidadesCajaAbierta: producto.unidadesCajaAbierta ?? 0,
      unidadesSueltas: producto.unidadesSueltas ?? 0,
    }, producto.unidadesPorCaja, magnitud)
    : null;

  function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (modo === 'movimiento' && presentacion === 'caja' && !Number.isInteger(cantidadIngresada)) {
      setError('La cantidad de cajas debe ser un número entero.');
      return;
    }
    if (sinConteoDeCajas) {
      setError('Confirma primero las cajas cerradas con «Contar cajas» en este producto.');
      return;
    }
    if (faltanCajasCerradas) {
      setError(`Solo hay ${producto.cajasCerradas} cajas cerradas. Las unidades de una caja abierta se entregan como sueltas.`);
      return;
    }
    if (insuficiente) {
      setError(`No alcanza: hay ${producto.stockActual} ${nombreUnidad(producto.unidad, producto.stockActual)} y estás sacando ${magnitud}.`);
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
                      background: tipo === t.tipo ? 'var(--gold-50)' : 'var(--bg-card)',
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

            {producto.unidadesPorCaja && (
              <div className="form-group mb-4">
                <label className="form-label" htmlFor="mov-presentacion">Cómo se cuenta</label>
                <select
                  id="mov-presentacion" className="form-select" value={presentacion}
                  onChange={e => { setPresentacion(e.target.value as 'unidad' | 'caja'); setCantidad(''); }}
                >
                  <option value="unidad">{nombreUnidad(producto.unidad, 2)}</option>
                  <option value="caja">Cajas de {producto.unidadesPorCaja} {nombreUnidad(producto.unidad, producto.unidadesPorCaja)}</option>
                </select>
              </div>
            )}

            <div className="form-group">
              <label className="form-label" htmlFor="mov-cant">
                Cuánto {resta ? 'sale' : 'entra'} ({presentacion === 'caja' ? 'cajas' : nombreUnidad(producto.unidad, 2)}) *
              </label>
              <input
                id="mov-cant" required type="number" min={presentacion === 'caja' || !permiteFracciones(producto.unidad) ? '1' : '0.01'}
                step={presentacion === 'caja' || !permiteFracciones(producto.unidad) ? '1' : '0.01'} className="form-input"
                value={cantidad} onChange={e => setCantidad(e.target.value)} autoFocus
 />
              {presentacion === 'caja' && cantidadIngresada > 0 && (
                <p className="text-sm text-secondary">Equivale a {magnitud} {nombreUnidad(producto.unidad, magnitud)}.</p>
              )}
              {resta && presentacion === 'caja' && producto.empaqueVerificado && (
                <p className="text-sm text-secondary">Cajas cerradas disponibles: {producto.cajasCerradas}.</p>
              )}
              {sinConteoDeCajas && <p className="text-sm text-warning">Confirma las cajas cerradas con «Contar cajas» antes de registrar esta salida.</p>}
              {salidaSuelta && (
                <p className="inventory-movement-preview">
                  Después: {salidaSuelta.cajasCerradas} caja{salidaSuelta.cajasCerradas === 1 ? '' : 's'} cerrada{salidaSuelta.cajasCerradas === 1 ? '' : 's'}
                  {' · '}{salidaSuelta.unidadesCajaAbierta} {nombreUnidad(producto.unidad, salidaSuelta.unidadesCajaAbierta)} en caja abierta
                  {' · '}{salidaSuelta.unidadesSueltas} sueltos.
                </p>
              )}
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
                Cuánto hay realmente ({nombreUnidad(producto.unidad, 2)}) *
              </label>
              <input
                id="mov-cont" required type="number" min="0"
                step={permiteFracciones(producto.unidad) ? '0.01' : '1'} className="form-input"
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
              color: insuficiente ? 'var(--color-danger)' : 'var(--text-primary)',
            }}
          >
            {insuficiente ? 'No alcanza' : `${resultante} ${nombreUnidad(producto.unidad, resultante)}`}
          </span>
        </div>

        <div className="modal-footer-sticky">
          <button type="button" className="btn btn-outline" onClick={onClose} disabled={registrar.isPending}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-gold" disabled={registrar.isPending || insuficiente || sinConteoDeCajas || faltanCajasCerradas}>
            {registrar.isPending ? 'Registrando…' : 'Registrar'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function FormularioConteoEmpaque({ producto, onClose, onHecho }: {
  producto: ProductoInventario;
  onClose: () => void;
  onHecho: () => void;
}) {
  const { addToast } = useToast();
  const [cerradas, setCerradas] = useState(producto.empaqueVerificado ? String(producto.cajasCerradas) : '');
  const [abierta, setAbierta] = useState(producto.empaqueVerificado ? String(producto.unidadesCajaAbierta) : '');
  const [sueltas, setSueltas] = useState(producto.empaqueVerificado ? String(producto.unidadesSueltas) : '');
  const [error, setError] = useState('');
  const factor = producto.unidadesPorCaja ?? 1;
  const total = Number(cerradas) * factor + Number(abierta) + Number(sueltas);
  const valido = [cerradas, abierta, sueltas].every(v => v.trim() !== '' && Number.isInteger(Number(v)) && Number(v) >= 0)
    && Number(abierta) < factor && total === producto.stockActual;

  const guardar = useMutation({
    mutationFn: () => InventarioService.conciliarEmpaque(
      producto.id, Number(cerradas), Number(abierta), Number(sueltas),
      'Conteo físico de cajas y unidades'
    ),
    onSuccess: () => { addToast('Presentación física confirmada', 'success'); onHecho(); },
    onError: (e: Error) => setError(e.message),
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (!valido) {
      setError(`El desglose debe sumar exactamente ${producto.stockActual} ${nombreUnidad(producto.unidad, producto.stockActual)}. Cada caja abierta admite menos de ${factor}.`);
      return;
    }
    guardar.mutate();
  }

  return (
    <Modal isOpen onClose={onClose} title={`Contar cajas · ${producto.nombre}`} size="md">
      <form onSubmit={submit}>
        {error && <div className="login-error mb-4" role="alert">{error}</div>}
        <p className="text-secondary mb-4">
          Cuenta lo que ves físicamente. Una caja cerrada contiene {factor} {nombreUnidad(producto.unidad, factor)}.
          Usa primero la caja abierta antes de abrir otra.
        </p>
        <div className="inventory-count-fields">
          <div className="form-group">
            <label className="form-label" htmlFor="conteo-cerradas">Cajas cerradas</label>
            <input id="conteo-cerradas" type="number" min="0" step="1" required className="form-input"
              value={cerradas} onChange={e => setCerradas(e.target.value)} disabled={guardar.isPending} />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="conteo-abierta">Unidades en la caja abierta</label>
            <input id="conteo-abierta" type="number" min="0" max={factor - 1} step="1" required className="form-input"
              value={abierta} onChange={e => setAbierta(e.target.value)} disabled={guardar.isPending} />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="conteo-sueltas">Unidades sueltas fuera de caja</label>
            <input id="conteo-sueltas" type="number" min="0" step="1" required className="form-input"
              value={sueltas} onChange={e => setSueltas(e.target.value)} disabled={guardar.isPending} />
          </div>
        </div>
        <div className={`inventory-count-result ${valido ? 'inventory-count-result-ok' : ''}`} aria-live="polite">
          <span>Desglose contado: <strong>{Number.isFinite(total) ? total : '—'}</strong></span>
          <span>Stock registrado: <strong>{producto.stockActual}</strong></span>
        </div>
        {!valido && <p className="text-muted text-sm mt-2">Si el total físico es distinto, usa primero «Entrada / salida → Corregir por conteo».</p>}
        <div className="modal-footer-sticky">
          <button type="button" className="btn btn-outline" onClick={onClose} disabled={guardar.isPending}>Cancelar</button>
          <button type="submit" className="btn btn-gold" disabled={!valido || guardar.isPending}>
            <Check size={17} /> {guardar.isPending ? 'Guardando…' : 'Confirmar conteo'}
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
                  {m.cantidadCajas > 0 && <div className="text-xs text-secondary">{m.cantidadCajas} caja{m.cantidadCajas === 1 ? '' : 's'} cerrada{m.cantidadCajas === 1 ? '' : 's'}</div>}
                  {m.observaciones && <div className="text-xs text-secondary">{m.observaciones}</div>}
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
