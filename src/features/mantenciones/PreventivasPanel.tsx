import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarCheck, CalendarClock, Plus, Repeat, Trash2 } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { PERMISSIONS } from '../../auth/permissions';
import { useSede } from '../../auth/SedeContext';
import { useToast } from '../../components/Toast';
import Modal from '../../components/Modal';
import { MantencionService } from '../../services/mantencionService';
import { UsuarioService } from '../../services/usuarioService';
import { EstadoPreventiva, Preventiva } from '../../types';
import { formatDate, getToday } from '../../utils/dates';

/**
 * Frecuencias que se usan de verdad en una escuela. Poner un campo libre en
 * días obliga a hacer la cuenta mental; estas cubren lo que existe y dejan
 * «otra» para el caso raro.
 */
const FRECUENCIAS = [
  { dias: 30, label: 'Cada mes' },
  { dias: 90, label: 'Cada 3 meses' },
  { dias: 180, label: 'Cada 6 meses' },
  { dias: 365, label: 'Una vez al año' },
];

/**
 * Suma días a una fecha `YYYY-MM-DD`. Se fija el mediodía porque `new Date`
 * sobre una fecha sin hora la lee como UTC, y en Chile eso la corre un día
 * hacia atrás al mostrarla. Es solo la vista previa: la fecha real la calcula
 * la base en `proxima_fecha`.
 */
function sumarDias(fecha: string, dias: number): Date {
  const d = new Date(`${fecha}T12:00:00`);
  d.setDate(d.getDate() + dias);
  return d;
}

const ESTILO_ESTADO: Record<EstadoPreventiva, { clase: string; texto: string }> = {
  vencida: { clase: 'badge-danger', texto: 'Vencida' },
  proxima: { clase: 'badge-warning', texto: 'Próxima' },
  al_dia: { clase: 'badge-success', texto: 'Al día' },
};

const FORM_VACIO = {
  categoriaId: 0,
  nombre: '',
  ubicacion: '',
  observaciones: '',
  frecuenciaDias: 180,
  fechaInicio: getToday(),
  responsableId: '',
};

/**
 * Preventivas: lo que se repite y se olvida.
 *
 * El vencimiento no se escribe nunca a mano — `proxima_fecha` es una columna
 * generada desde la última ejecución más la frecuencia. Marcar una rutina como
 * hecha es lo único que mueve la fecha, así que el listado no puede mentir.
 */
export default function PreventivasPanel() {
  const { can } = useAuth();
  const { sede } = useSede();
  const { addToast } = useToast();
  const queryClient = useQueryClient();

  const gestiona = can(PERMISSIONS.MANAGE_MAINTENANCE);

  const [form, setForm] = useState<typeof FORM_VACIO | null>(null);
  const [marcando, setMarcando] = useState<Preventiva | null>(null);
  const [ejecucion, setEjecucion] = useState({ fecha: getToday(), costo: '', proveedor: '', observaciones: '' });
  const [error, setError] = useState('');

  const { data: preventivas = [], isLoading } = useQuery({
    queryKey: ['preventivas', sede.id],
    queryFn: () => MantencionService.getPreventivas(sede.id),
  });
  const { data: categorias = [] } = useQuery({
    queryKey: ['mantencion-categorias'],
    queryFn: MantencionService.getCategorias,
  });
  const { data: colegas = [] } = useQuery({
    queryKey: ['colegas'],
    queryFn: UsuarioService.getColegas,
    enabled: gestiona,
  });

  function refrescar() {
    queryClient.invalidateQueries({ queryKey: ['preventivas', sede.id] });
    queryClient.invalidateQueries({ queryKey: ['panel-operaciones'] });
  }

  const crear = useMutation({
    mutationFn: (datos: typeof FORM_VACIO) => MantencionService.crearPreventiva({
      sedeId: sede.id,
      categoriaId: datos.categoriaId,
      nombre: datos.nombre,
      ubicacion: datos.ubicacion || null,
      observaciones: datos.observaciones || null,
      frecuenciaDias: datos.frecuenciaDias,
      fechaInicio: datos.fechaInicio,
      responsableId: datos.responsableId || null,
    }),
    onSuccess: () => {
      addToast('Rutina creada', 'success');
      setForm(null);
      refrescar();
    },
    onError: (e: Error) => setError(e.message),
  });

  const registrar = useMutation({
    mutationFn: async () => {
      if (!marcando) return;
      const monto = ejecucion.costo.trim() === '' ? null : Number(ejecucion.costo);
      if (monto !== null && (Number.isNaN(monto) || monto < 0)) {
        throw new Error('El costo tiene que ser un número');
      }
      await MantencionService.registrarEjecucion({
        preventivaId: marcando.id,
        fecha: ejecucion.fecha,
        proveedor: ejecucion.proveedor || null,
        costo: monto,
        observaciones: ejecucion.observaciones || null,
      });
    },
    onSuccess: () => {
      addToast('Registrada. La próxima ya quedó agendada.', 'success');
      setMarcando(null);
      setEjecucion({ fecha: getToday(), costo: '', proveedor: '', observaciones: '' });
      refrescar();
    },
    onError: (e: Error) => setError(e.message),
  });

  const desactivar = useMutation({
    mutationFn: (id: number) => MantencionService.desactivarPreventiva(id),
    onSuccess: () => { addToast('Rutina retirada del listado', 'info'); refrescar(); },
    onError: (e: Error) => addToast(e.message, 'danger'),
  });

  if (isLoading) return <div className="skeleton" style={{ height: 320 }} />;

  const vencidas = preventivas.filter(p => p.estadoPreventiva === 'vencida');
  const proximas = preventivas.filter(p => p.estadoPreventiva === 'proxima');
  const alDia = preventivas.filter(p => p.estadoPreventiva === 'al_dia');

  return (
    <div className="grid gap-5">
      {gestiona && (
        <button
          className="btn btn-outline justify-self-start"

onClick={() => { setForm(FORM_VACIO); setError(''); }}
        >
          <Plus size={17} /> Nueva rutina
        </button>
      )}

      {preventivas.length === 0 ? (
        <div className="card py-12 px-6 text-center">
          <Repeat size={44} style={{ color: 'var(--text-muted)', marginBottom: '14px' }} />
          <h3 className="mb-1">Todavía no hay rutinas cargadas</h3>
          <p className="text-muted">
            Extintores, calefactores, canaletas antes de las lluvias: lo que hay que
            revisar aunque no se haya roto.
          </p>
        </div>
      ) : (
        <>
          <Grupo titulo="Vencidas" items={vencidas} onMarcar={setMarcando} onQuitar={desactivar.mutate} gestiona={gestiona} />
          <Grupo titulo="Próximas (30 días)" items={proximas} onMarcar={setMarcando} onQuitar={desactivar.mutate} gestiona={gestiona} />
          <Grupo titulo="Al día" items={alDia} onMarcar={setMarcando} onQuitar={desactivar.mutate} gestiona={gestiona} />
        </>
      )}

      {/* Nueva rutina */}
      {form && (
        <Modal
          isOpen onClose={() => setForm(null)} title="Nueva rutina preventiva"
          footer={
            <>
              <button className="btn btn-outline" onClick={() => setForm(null)}>Cancelar</button>
              <button
                className="btn btn-gold"
                disabled={crear.isPending}
                onClick={() => {
                  setError('');
                  if (form.nombre.trim().length < 3) { setError('Ponle un nombre reconocible'); return; }
                  if (!form.categoriaId) { setError('Elige una categoría'); return; }
                  crear.mutate(form);
                }}
              >
                Crear rutina
              </button>
            </>
          }
              >
          <div className="grid gap-3">
            <div className="form-group">
              <label className="form-label" htmlFor="prev-nombre">¿Qué hay que revisar?</label>
              <input
                id="prev-nombre" className="form-input" autoFocus
                placeholder="Recarga de extintores"
                value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })}
 />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="prev-categoria">Categoría</label>
              <select
                id="prev-categoria" className="form-input"
                value={form.categoriaId}
                onChange={e => setForm({ ...form, categoriaId: Number(e.target.value) })}
              >
                <option value={0}>Elige una categoría</option>
                {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="prev-frecuencia">¿Cada cuánto?</label>
              <select
                id="prev-frecuencia" className="form-input"
                value={form.frecuenciaDias}
                onChange={e => setForm({ ...form, frecuenciaDias: Number(e.target.value) })}
              >
                {FRECUENCIAS.map(f => <option key={f.dias} value={f.dias}>{f.label}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="prev-inicio">Contar desde</label>
              <input
                id="prev-inicio" type="date" className="form-input"
                value={form.fechaInicio}
                onChange={e => setForm({ ...form, fechaInicio: e.target.value })}
 />
              <p className="text-muted text-sm mt-1">
                Si ya se hizo alguna vez, pon esa fecha: la próxima se calcula sola.
              </p>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="prev-ubicacion">Dónde (opcional)</label>
              <input
                id="prev-ubicacion" className="form-input"
                placeholder="Pasillo principal y cocina"
                value={form.ubicacion} onChange={e => setForm({ ...form, ubicacion: e.target.value })}
 />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="prev-responsable">Responsable (opcional)</label>
              <select
                id="prev-responsable" className="form-input"
                value={form.responsableId}
                onChange={e => setForm({ ...form, responsableId: e.target.value })}
              >
                <option value="">Sin responsable fijo</option>
                {colegas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>
            {error && <p className="text-danger text-sm">{error}</p>}
          </div>
        </Modal>
      )}

      {/* Marcar hecha */}
      {marcando && (
        <Modal
          isOpen onClose={() => setMarcando(null)} title={`Registrar: ${marcando.nombre}`}
          footer={
            <>
              <button className="btn btn-outline" onClick={() => setMarcando(null)}>Cancelar</button>
              <button className="btn btn-gold" disabled={registrar.isPending} onClick={() => { setError(''); registrar.mutate(); }}>
                <CalendarCheck size={17} /> Marcar hecha
              </button>
            </>
          }
                >
          <div className="grid gap-3">
            <div className="form-group">
              <label className="form-label" htmlFor="ejec-fecha">¿Cuándo se hizo?</label>
              <input
                id="ejec-fecha" type="date" className="form-input"
                value={ejecucion.fecha}
                onChange={e => setEjecucion({ ...ejecucion, fecha: e.target.value })}
 />
            </div>
            <div className="grid grid-2 gap-2">
              <div className="form-group">
                <label className="form-label" htmlFor="ejec-costo">Costo (opcional)</label>
                <input
                  id="ejec-costo" className="form-input" inputMode="numeric" placeholder="0"
                  value={ejecucion.costo}
                  onChange={e => setEjecucion({ ...ejecucion, costo: e.target.value })}
 />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="ejec-proveedor">Quién lo hizo</label>
                <input
                  id="ejec-proveedor" className="form-input" placeholder="Empresa o persona"
                  value={ejecucion.proveedor}
                  onChange={e => setEjecucion({ ...ejecucion, proveedor: e.target.value })}
 />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="ejec-obs">Observaciones (opcional)</label>
              <textarea
                id="ejec-obs" className="form-textarea" rows={2}
                placeholder="Dos extintores había que reemplazarlos"
                value={ejecucion.observaciones}
                onChange={e => setEjecucion({ ...ejecucion, observaciones: e.target.value })}
 />
            </div>
            <p className="text-muted text-sm">
              Al registrarla, la próxima queda agendada para
              {' '}{formatDate(sumarDias(ejecucion.fecha, marcando.frecuenciaDias))}.
            </p>
            {error && <p className="text-danger text-sm">{error}</p>}
          </div>
        </Modal>
      )}
    </div>
  );
}

function Grupo({
  titulo, items, onMarcar, onQuitar, gestiona,
}: {
  titulo: string;
  items: Preventiva[];
  onMarcar: (p: Preventiva) => void;
  onQuitar: (id: number) => void;
  gestiona: boolean;
}) {
  if (items.length === 0) return null;

  return (
    <section>
      <h3 className="text-base mb-2">{titulo} · {items.length}</h3>
      <div className="grid gap-2">
        {items.map(p => (
          <article
            key={p.id}
            className="card p-3 flex gap-3 items-center flex-wrap"
          >
            <div className="flex-1 min-w-50">
              <div className="flex gap-2 items-center flex-wrap">
                <strong className="text-md">{p.nombre}</strong>
                <span className={`badge ${ESTILO_ESTADO[p.estadoPreventiva].clase}`}>
                  {ESTILO_ESTADO[p.estadoPreventiva].texto}
                </span>
              </div>
              <div className="text-muted text-sm mt-1 flex gap-1 items-center">
                <CalendarClock size={13} />
                {p.estadoPreventiva === 'vencida'
                  ? `Venció hace ${Math.abs(p.diasRestantes)} día${Math.abs(p.diasRestantes) === 1 ? '' : 's'}`
                  : `Toca el ${formatDate(p.proximaFecha)}`}
                {p.ubicacion && ` · ${p.ubicacion}`}
                {p.responsableNombre && ` · ${p.responsableNombre}`}
              </div>
            </div>

            {gestiona && (
              <div className="flex gap-1">
                <button className="btn btn-outline btn-sm" onClick={() => onMarcar(p)}>
                  <CalendarCheck size={15} /> Marcar hecha
                </button>
                <button
                  className="btn btn-ghost btn-sm text-danger"

onClick={() => onQuitar(p.id)}
                  aria-label={`Retirar ${p.nombre}`}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
