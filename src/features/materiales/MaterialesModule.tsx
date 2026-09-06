import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../auth/AuthContext';
import { useSede } from '../../auth/SedeContext';
import { useToast } from '../../components/Toast';
import { PERMISSIONS } from '../../auth/permissions';
import { MaterialService, NuevoItem } from '../../services/materialService';
import { InventarioService } from '../../services/inventarioService';
import { supabase } from '../../db/database';
import { EstadoMaterial, PrioridadMaterial, SolicitudMaterial } from '../../types';
import { formatDate } from '../../utils/dates';
import { ESTADOS_MATERIAL, PRIORIDADES, UNIDADES, formatCLP, estaAtrasada } from './constants';
import SolicitudMaterialDetalle from './SolicitudMaterialDetalle';
import Modal from '../../components/Modal';
import { Package, PackagePlus, Inbox, Plus, Trash2, AlertTriangle, Filter } from 'lucide-react';

interface Curso { id: string; nombre: string }

const ITEM_VACIO: NuevoItem = { nombre: '', cantidad: 1, unidad: 'unidad', costoEstimado: null, itemId: null };

export default function MaterialesModule() {
  const { user, can } = useAuth();
  const { sede } = useSede();
  const { addToast } = useToast();
  const queryClient = useQueryClient();

  const puedeGestionar = can(PERMISSIONS.REVIEW_MATERIALS) || can(PERMISSIONS.MANAGE_PURCHASES);

  const [tab, setTab] = useState<'mias' | 'bandeja'>('mias');
  const [filtroEstado, setFiltroEstado] = useState<EstadoMaterial | ''>('');
  const [detalle, setDetalle] = useState<SolicitudMaterial | null>(null);
  const [showForm, setShowForm] = useState(false);

  const [form, setForm] = useState({
    titulo: '', justificacion: '', cursoId: '', area: '',
    prioridad: 'normal' as PrioridadMaterial, fechaNecesidad: '',
  });
  const [items, setItems] = useState<NuevoItem[]>([{ ...ITEM_VACIO }]);

  const mias = useQuery({
    queryKey: ['materiales', 'mias', user?.id],
    queryFn: () => MaterialService.getMisSolicitudes(user!.id),
    enabled: !!user,
  });

  const bandeja = useQuery({
    queryKey: ['materiales', 'bandeja', sede.id],
    queryFn: () => MaterialService.getBandejaSede(sede.id),
    enabled: puedeGestionar,
  });

  // Para enlazar lo que se pide con lo que hay en bodega: si el nombre coincide
  // con un producto, la entrega descuenta el stock sola. Quien pide no tiene que
  // saber nada de esto.
  const productosBodega = useQuery({
    queryKey: ['inventario', sede.id],
    queryFn: () => InventarioService.getProductos(sede.id),
  });

  const cursos = useQuery({
    queryKey: ['cursos', sede.id],
    queryFn: async (): Promise<Curso[]> => {
      const { data, error } = await supabase.from('cursos').select('id, nombre').eq('sede_id', sede.id);
      if (error) throw error;
      return data || [];
    },
  });

  const crear = useMutation({
    mutationFn: async (enviarAhora: boolean) => {
      const id = await MaterialService.crearBorrador({
        solicitanteId: user!.id,
        sedeId: sede.id,
        titulo: form.titulo,
        justificacion: form.justificacion,
        cursoId: form.cursoId || null,
        area: form.area.trim() || null,
        prioridad: form.prioridad,
        fechaNecesidad: form.fechaNecesidad || null,
      });
      await MaterialService.agregarItems(id, items.filter(i => i.nombre.trim()));
      if (enviarAhora) await MaterialService.enviar(id);
    },
    onSuccess: (_data, enviarAhora) => {
      addToast(enviarAhora ? 'Solicitud enviada a revisión' : 'Borrador guardado', 'success');
      queryClient.invalidateQueries({ queryKey: ['materiales'] });
      setShowForm(false);
      setForm({ titulo: '', justificacion: '', cursoId: '', area: '', prioridad: 'normal', fechaNecesidad: '' });
      setItems([{ ...ITEM_VACIO }]);
    },
    onError: (err: unknown) => {
      addToast(err instanceof Error ? err.message : 'No se pudo crear la solicitud', 'danger');
    },
  });

  const totalEstimado = useMemo(
    () => items.reduce((suma, i) => suma + (i.costoEstimado ?? 0) * (i.cantidad || 0), 0),
    [items]
  );

  const consulta = tab === 'mias' ? mias : bandeja;
  const lista = useMemo(() => {
    const base = consulta.data ?? [];
    return filtroEstado ? base.filter(s => s.estado === filtroEstado) : base;
  }, [consulta.data, filtroEstado]);

  function actualizarItem(indice: number, cambios: Partial<NuevoItem>) {
    setItems(prev => prev.map((item, i) => (i === indice ? { ...item, ...cambios } : item)));
  }

  /**
   * Al escribir el nombre, busca si existe ese producto en bodega. Si coincide,
   * lo enlaza y adopta su unidad; si no, queda como material suelto y la
   * solicitud funciona igual.
   */
  function escribirNombreMaterial(indice: number, nombre: string) {
    const coincide = (productosBodega.data ?? []).find(
      p => p.nombre.trim().toLowerCase() === nombre.trim().toLowerCase()
    );
    actualizarItem(indice, coincide
      ? { nombre, itemId: coincide.id, unidad: coincide.unidad }
      : { nombre, itemId: null });
  }

  function validarYEnviar(enviarAhora: boolean) {
    if (form.titulo.trim().length < 3) {
      addToast('Ponle un título a la solicitud', 'warning'); return;
    }
    if (!items.some(i => i.nombre.trim())) {
      addToast('Agrega al menos un material', 'warning'); return;
    }
    if (items.some(i => i.nombre.trim() && (!i.cantidad || i.cantidad <= 0))) {
      addToast('Cada material necesita una cantidad mayor que cero', 'warning'); return;
    }
    crear.mutate(enviarAhora);
  }

  if (consulta.isLoading) {
    return <div className="page-container"><div className="skeleton h-100" /></div>;
  }

  return (
    <div className="page-container animate-in">
      <header className="flex justify-between items-end mb-8 gap-4 flex-wrap">
        <div>
          <h1 className="page-title">Materiales</h1>
          <p className="page-subtitle">Solicitudes, aprobación y compra · {sede.nombre}</p>
        </div>
        {can(PERMISSIONS.REQUEST_MATERIALS) && (
          <button className="btn btn-gold" onClick={() => setShowForm(true)}>
            <PackagePlus size={18} /> Nueva solicitud
          </button>
        )}
      </header>

      <div className="flex gap-3 mb-6 flex-wrap items-center">
        <button className={`btn ${tab === 'mias' ? 'btn-gold' : 'btn-outline'}`} onClick={() => setTab('mias')}>
          <Package size={18} /> Mis solicitudes
        </button>
        {puedeGestionar && (
          <button className={`btn ${tab === 'bandeja' ? 'btn-gold' : 'btn-outline'}`} onClick={() => setTab('bandeja')}>
            <Inbox size={18} /> Bandeja {(bandeja.data?.length ?? 0)> 0 && `(${bandeja.data?.length})`}
          </button>
        )}
        <div className="flex items-center gap-2 ml-auto">
          <Filter size={16} aria-hidden="true" style={{ color: 'var(--navy-600)' }} />
          <label className="sr-only" htmlFor="filtro-estado">Filtrar por estado</label>
          <select id="filtro-estado" className="form-select" style={{ minWidth: '180px' }}
            value={filtroEstado} onChange={e => setFiltroEstado(e.target.value as EstadoMaterial | '')}>
            <option value="">Todos los estados</option>
            {Object.entries(ESTADOS_MATERIAL).map(([valor, cfg]) => (
              <option key={valor} value={valor}>{cfg.label}</option>
            ))}
          </select>
        </div>
      </div>

      {consulta.isError && (
        <div className="card p-5 text-danger">
          No se pudieron cargar las solicitudes. Revisa tu conexión y vuelve a intentar.
        </div>
      )}

      <div className="flex flex-col gap-3">
        {lista.map(s => {
          const badge = ESTADOS_MATERIAL[s.estado];
          const atrasada = estaAtrasada(s.fechaNecesidad, s.estado);
          return (
            <article key={s.id} className="card p-5 flex items-center gap-4 flex-wrap">
              <div style={{ flex: 1, minWidth: '240px' }}>
                <div className="text-md font-extrabold text-navy">
                  {s.titulo}
                  {tab === 'bandeja' && s.solicitanteNombre && (
                    <span className="font-semibold text-secondary"> · {s.solicitanteNombre}</span>
                  )}
                </div>
                <div className="text-sm text-secondary font-semibold mt-1">
                  {s.items.length} {s.items.length === 1 ? 'material' : 'materiales'}
                  {' · '}{formatCLP(s.costoEstimadoTotal)}
                  {s.fechaNecesidad && ` · para el ${formatDate(s.fechaNecesidad)}`}
                </div>
                {atrasada && (
                  <div className="flex items-center gap-1 mt-1 text-sm font-bold text-danger">
                    <AlertTriangle size={14} /> Atrasada
                  </div>
                )}
              </div>

              {s.prioridad !== 'normal' && (
                <span style={{ fontSize: '12px', fontWeight: 800, color: PRIORIDADES[s.prioridad].color }}>
                  {PRIORIDADES[s.prioridad].label.toUpperCase()}
                </span>
              )}

              <span className="badge" style={{ background: badge.bg, color: badge.color, padding: '8px 16px', fontWeight: 800 }}>
                {badge.icono} {badge.label}
              </span>

              <button className="btn btn-outline" onClick={() => setDetalle(s)}>Ver</button>
            </article>
          );
        })}

        {lista.length === 0 && !consulta.isError && (
          <div className="text-center p-20 text-secondary">
            <Package size={48} style={{ opacity: 0.2, marginBottom: '16px' }} aria-hidden="true" />
            <p>
              {tab === 'mias'
                ? 'Todavía no has pedido materiales.'
                : 'No hay solicitudes esperando gestión.'}
            </p>
          </div>
        )}
      </div>

      {detalle && (
        <SolicitudMaterialDetalle
          solicitud={detalle}
          onClose={() => setDetalle(null)}
 />
      )}

      <Modal isOpen={showForm} onClose={() => setShowForm(false)} title="Nueva solicitud de materiales">
        <div className="flex flex-col gap-4">
          <div>
            <label className="form-label" htmlFor="titulo-material">Título</label>
            <input id="titulo-material" className="form-input" value={form.titulo}
              placeholder="Ej: Material fungible para taller de lenguaje"
              onChange={e => setForm({ ...form, titulo: e.target.value })} />
          </div>

          <div>
            <label className="form-label" htmlFor="justificacion-material">Para qué actividad</label>
            <textarea id="justificacion-material" className="form-textarea" rows={2} value={form.justificacion}
              onChange={e => setForm({ ...form, justificacion: e.target.value })} />
          </div>

          <div className="grid grid-2 gap-3">
            <div>
              <label className="form-label" htmlFor="prioridad-material">Prioridad</label>
              <select id="prioridad-material" className="form-select" value={form.prioridad}
                onChange={e => setForm({ ...form, prioridad: e.target.value as PrioridadMaterial })}>
                {Object.entries(PRIORIDADES).map(([valor, cfg]) => (
                  <option key={valor} value={valor}>{cfg.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label" htmlFor="fecha-material">Para cuándo</label>
              <input id="fecha-material" type="date" className="form-input" value={form.fechaNecesidad}
                onChange={e => setForm({ ...form, fechaNecesidad: e.target.value })} />
            </div>
          </div>

          <div>
            <label className="form-label" htmlFor="curso-material">Curso <span className="font-medium">(opcional)</span></label>
            <select id="curso-material" className="form-select" value={form.cursoId}
              onChange={e => setForm({ ...form, cursoId: e.target.value })}>
              <option value="">Sin curso específico</option>
              {(cursos.data ?? []).map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </div>

          {/* Materiales */}
          <div>
            <label className="form-label">Materiales</label>
            <datalist id="productos-bodega">
              {(productosBodega.data ?? []).map(p => (
                <option key={p.id} value={p.nombre}>
                  {p.stockActual> 0 ? `hay ${p.stockActual} ${p.unidadNombre.toLowerCase()}` : 'sin stock'}
                </option>
              ))}
            </datalist>
            <div className="flex flex-col gap-2">
              {items.map((item, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 70px 1fr 1fr 36px', gap: '6px', alignItems: 'center' }}>
                  <input className="form-input" placeholder="Nombre" value={item.nombre}
                    aria-label={`Material ${i + 1}`}
                    list="productos-bodega"
                    onChange={e => escribirNombreMaterial(i, e.target.value)} />
                  <input className="form-input" type="number" min="0.01" step="0.01" value={item.cantidad}
                    aria-label={`Cantidad del material ${i + 1}`}
                    onChange={e => actualizarItem(i, { cantidad: Number(e.target.value) })} />
                  <select className="form-select" value={item.unidad}
                    aria-label={`Unidad del material ${i + 1}`}
                    onChange={e => actualizarItem(i, { unidad: e.target.value })}>
                    {UNIDADES.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                  <input className="form-input" type="number" min="0" step="1" placeholder="$ c/u"
                    aria-label={`Costo estimado del material ${i + 1}`}
                    value={item.costoEstimado ?? ''}
                    onChange={e => actualizarItem(i, { costoEstimado: e.target.value ? Number(e.target.value) : null })} />
                  <button type="button" className="btn btn-ghost" aria-label={`Quitar material ${i + 1}`}
                    disabled={items.length === 1}
                    onClick={() => setItems(prev => prev.filter((_, idx) => idx !== i))}>
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
            <button type="button" className="btn btn-ghost mt-2"
onClick={() => setItems(prev => [...prev, { ...ITEM_VACIO }])}>
              <Plus size={16} /> Agregar material
            </button>
            {items.some(i => i.itemId) && (
              <p className="text-muted text-sm mt-2">
                Los materiales que hay en bodega se descuentan solos al entregarlos.
              </p>
            )}
          </div>

          {totalEstimado> 0 && (
            <div className="py-3 px-4 rounded-md bg-main text-sm font-bold text-navy">
              Total estimado: {formatCLP(totalEstimado)}
            </div>
          )}

          <div className="modal-footer-sticky" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <button className="btn btn-outline" disabled={crear.isPending} onClick={() => validarYEnviar(false)}>
              Guardar borrador
            </button>
            <button className="btn btn-gold" disabled={crear.isPending} onClick={() => validarYEnviar(true)}>
              {crear.isPending ? 'Guardando...' : 'Enviar a revisión'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
