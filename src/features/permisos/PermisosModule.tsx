import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../auth/AuthContext';
import { useSede } from '../../auth/SedeContext';
import { useToast } from '../../components/Toast';
import { PERMISSIONS } from '../../auth/permissions';
import { PermisoService } from '../../services/permisoService';
import { EstadoPermiso, JornadaPermiso, SolicitudPermiso, TipoPermiso } from '../../types';
import { formatDate } from '../../utils/dates';
import Modal from '../../components/Modal';
import { CalendarPlus, Check, X, Inbox, CalendarDays, Ban, MessageSquare } from 'lucide-react';

const TIPOS: { value: TipoPermiso; label: string }[] = [
  { value: 'administrativo', label: 'Día administrativo' },
  { value: 'licencia_medica', label: 'Licencia médica' },
  { value: 'sin_goce', label: 'Permiso sin goce de sueldo' },
  { value: 'capacitacion', label: 'Capacitación' },
  { value: 'otro', label: 'Otro' },
];

const JORNADAS: { value: JornadaPermiso; label: string }[] = [
  { value: 'completa', label: 'Jornada completa' },
  { value: 'manana', label: 'Media jornada (mañana)' },
  { value: 'tarde', label: 'Media jornada (tarde)' },
];

const ESTADOS: Record<EstadoPermiso, { label: string; color: string; bg: string }> = {
  pendiente: { label: 'Pendiente', color: 'var(--gold-600)', bg: 'var(--gold-50)' },
  observada: { label: 'Con observaciones', color: 'var(--color-info)', bg: 'var(--color-info-soft)' },
  aprobada: { label: 'Aprobada', color: 'var(--color-success)', bg: 'var(--color-success-soft)' },
  rechazada: { label: 'Rechazada', color: 'var(--color-danger)', bg: 'var(--color-danger-soft)' },
  cancelada: { label: 'Cancelada', color: 'var(--navy-600)', bg: 'var(--bg-main)' },
};

const tipoLabel = (t: TipoPermiso) => TIPOS.find(x => x.value === t)?.label || t;

/** Mismo cálculo que public.dias_habiles_permiso(): lunes a viernes, media jornada = 0.5.
 *  Es solo una vista previa; el valor que se guarda lo calcula la base. */
function calcularDiasHabiles(inicio: string, fin: string, jornada: JornadaPermiso): number {
  if (!inicio || !fin || fin < inicio) return 0;
  let habiles = 0;
  const cursor = new Date(`${inicio}T12:00:00`);
  const ultimo = new Date(`${fin}T12:00:00`);
  while (cursor <= ultimo) {
    const dia = cursor.getDay();
    if (dia >= 1 && dia <= 5) habiles += 1;
    cursor.setDate(cursor.getDate() + 1);
  }
  return jornada === 'completa' ? habiles : habiles * 0.5;
}

export default function PermisosModule() {
  const { user, can } = useAuth();
  const { sede } = useSede();
  const { addToast } = useToast();
  const queryClient = useQueryClient();

  const puedeAprobar = can(PERMISSIONS.APPROVE_LEAVE);
  const anio = new Date().getFullYear();

  const [tab, setTab] = useState<'mias' | 'bandeja'>('mias');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    tipo: 'administrativo' as TipoPermiso,
    fechaInicio: '',
    fechaFin: '',
    jornada: 'completa' as JornadaPermiso,
    motivo: '',
  });
  const [resolviendo, setResolviendo] = useState<SolicitudPermiso | null>(null);
  const [comentario, setComentario] = useState('');

  const { data: misSolicitudes = [], isLoading: cargandoMias } = useQuery({
    queryKey: ['permisos', 'mias', user?.id],
    queryFn: () => PermisoService.getMisSolicitudes(user!.id),
    enabled: Boolean(user?.id),
  });

  const { data: saldo = null, isLoading: cargandoSaldo } = useQuery({
    queryKey: ['permisos', 'saldo', user?.id, anio],
    queryFn: () => PermisoService.getSaldo(user!.id, anio),
    enabled: Boolean(user?.id),
  });

  const { data: pendientes = [], isLoading: cargandoPendientes } = useQuery({
    queryKey: ['permisos', 'bandeja', sede?.id],
    queryFn: () => PermisoService.getPorRevisarSede(sede.id),
    enabled: Boolean(sede?.id && puedeAprobar),
  });

  const invalidatePermisos = () => {
    queryClient.invalidateQueries({ queryKey: ['permisos'] });
  };

  const crearMutation = useMutation({
    mutationFn: (data: Parameters<typeof PermisoService.crear>[0]) => PermisoService.crear(data),
    onSuccess: () => {
      invalidatePermisos();
      addToast('Solicitud enviada', 'success');
      setShowForm(false);
      setForm({ tipo: 'administrativo', fechaInicio: '', fechaFin: '', jornada: 'completa', motivo: '' });
    },
    onError: (err: any) => {
      addToast(err?.message || 'No se pudo enviar la solicitud', 'danger');
    },
  });

  const cancelarMutation = useMutation({
    mutationFn: (id: number) => PermisoService.cancelar(id),
    onSuccess: () => {
      invalidatePermisos();
      addToast('Solicitud cancelada', 'success');
    },
    onError: (err: any) => {
      addToast(err?.message || 'No se pudo cancelar', 'danger');
    },
  });

  const reenviarMutation = useMutation({
    mutationFn: (id: number) => PermisoService.reenviar(id),
    onSuccess: () => {
      invalidatePermisos();
      addToast('Solicitud reenviada', 'success');
    },
    onError: (err: any) => {
      addToast(err?.message || 'No se pudo reenviar', 'danger');
    },
  });

  const resolverMutation = useMutation({
    mutationFn: ({ id, estado, comentario }: { id: number; estado: 'aprobada' | 'rechazada' | 'observada'; comentario: string }) =>
      PermisoService.resolver(id, estado, comentario),
    onSuccess: (_, variables) => {
      invalidatePermisos();
      addToast(
        variables.estado === 'aprobada' ? 'Solicitud aprobada'
        : variables.estado === 'rechazada' ? 'Solicitud rechazada'
        : 'Observación enviada',
        'success'
      );
      setResolviendo(null);
      setComentario('');
    },
    onError: (err: any) => {
      addToast(err?.message || 'No se pudo resolver la solicitud', 'danger');
    },
  });

  const diasSolicitados = useMemo(
    () => calcularDiasHabiles(form.fechaInicio, form.fechaFin, form.jornada),
    [form.fechaInicio, form.fechaFin, form.jornada]
  );

  const excedeSaldo = form.tipo === 'administrativo'
    && saldo !== null
    && diasSolicitados > saldo.disponibles;

  const isSaving = crearMutation.isPending || cancelarMutation.isPending || reenviarMutation.isPending || resolverMutation.isPending;

  function enviarSolicitud() {
    if (!user || isSaving) return;
    if (!form.fechaInicio || !form.fechaFin) {
      addToast('Indica la fecha de inicio y de término', 'warning');
      return;
    }
    if (form.fechaFin < form.fechaInicio) {
      addToast('La fecha de término no puede ser anterior al inicio', 'warning');
      return;
    }
    if (diasSolicitados === 0) {
      addToast('El rango elegido no tiene días hábiles', 'warning');
      return;
    }
    // Un día administrativo no exige justificar el motivo; el resto sí.
    if (form.tipo !== 'administrativo' && !form.motivo.trim()) {
      addToast('Este tipo de permiso necesita un motivo', 'warning');
      return;
    }

    crearMutation.mutate({
      solicitanteId: user.id,
      sedeId: sede.id,
      tipo: form.tipo,
      fechaInicio: form.fechaInicio,
      fechaFin: form.fechaFin,
      jornada: form.jornada,
      motivo: form.motivo,
    });
  }

  function resolver(estado: 'aprobada' | 'rechazada' | 'observada') {
    if (!resolviendo || isSaving) return;
    if (estado !== 'aprobada' && !comentario.trim()) {
      addToast(estado === 'rechazada' ? 'Explica por qué se rechaza' : 'Escribe la observación', 'warning');
      return;
    }
    resolverMutation.mutate({
      id: resolviendo.id,
      estado,
      comentario,
    });
  }

  const loading = cargandoMias || cargandoSaldo || (puedeAprobar && cargandoPendientes);

  if (loading) return <div className="page-container"><div className="skeleton" style={{ height: 400 }} /></div>;

  const lista = tab === 'mias' ? misSolicitudes : pendientes;

  return (
    <div className="page-container animate-in">
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '40px', gap: '16px', flexWrap: 'wrap' }}>
        <div>
          <h1 className="page-title">Permisos</h1>
          <p className="page-subtitle">Días administrativos y ausencias del personal · {anio}</p>
        </div>
        <button className="btn btn-gold" onClick={() => setShowForm(true)}>
          <CalendarPlus size={18} /> Nueva solicitud
        </button>
      </header>

      {/* Saldo del año */}
      {saldo ? (
        <section className="grid grid-3" style={{ marginBottom: '32px' }}>
          {[
            { label: 'Días asignados', val: saldo.asignados, color: 'var(--navy-900)' },
            { label: 'Días usados', val: saldo.usados, color: 'var(--gold-600)' },
            { label: 'Disponibles', val: saldo.disponibles, color: saldo.disponibles > 0 ? 'var(--color-success)' : 'var(--color-danger)' },
          ].map(s => (
            <div key={s.label} className="card" style={{ padding: '20px', textAlign: 'center', borderBottom: `4px solid ${s.color}` }}>
              <div style={{ fontSize: '10px', fontWeight: 800, color: 'var(--navy-600)', textTransform: 'uppercase', marginBottom: '4px' }}>{s.label}</div>
              <div style={{ fontSize: '24px', fontWeight: 900, color: s.color }}>{s.val}</div>
            </div>
          ))}
        </section>
      ) : (
        <div className="card" style={{ padding: '16px 20px', marginBottom: '32px', fontSize: '13px', color: 'var(--navy-600)' }}>
          El director todavía no te asignó cupo de días administrativos para {anio}. Puedes solicitar permisos igual,
          pero no se mostrará el saldo.
        </div>
      )}

      {/* Pestañas */}
      {puedeAprobar && (
        <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
          <button className={`btn ${tab === 'mias' ? 'btn-gold' : 'btn-outline'}`} onClick={() => setTab('mias')}>
            <CalendarDays size={18} /> Mis solicitudes
          </button>
          <button className={`btn ${tab === 'bandeja' ? 'btn-gold' : 'btn-outline'}`} onClick={() => setTab('bandeja')}>
            <Inbox size={18} /> Por aprobar {pendientes.length > 0 && `(${pendientes.length})`}
          </button>
        </div>
      )}

      {/* Listado */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {lista.map(s => {
          const estilo = ESTADOS[s.estado];
          const mismoDia = s.fechaInicio === s.fechaFin;
          return (
            <article key={s.id} className="card" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: '240px' }}>
                <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--navy-900)', marginBottom: '4px' }}>
                  {tipoLabel(s.tipo)}
                  {tab === 'bandeja' && s.solicitanteNombre && (
                    <span style={{ fontWeight: 600, color: 'var(--navy-600)' }}> · {s.solicitanteNombre}</span>
                  )}
                </div>
                <div style={{ fontSize: '13px', color: 'var(--navy-600)', fontWeight: 600 }}>
                  {mismoDia ? formatDate(s.fechaInicio) : `${formatDate(s.fechaInicio)} al ${formatDate(s.fechaFin)}`}
                  {' · '}{s.diasHabiles} {s.diasHabiles === 1 ? 'día hábil' : 'días hábiles'}
                  {s.jornada !== 'completa' && ` · ${s.jornada === 'manana' ? 'mañana' : 'tarde'}`}
                </div>
                {s.motivo && (
                  <div style={{ fontSize: '13px', color: 'var(--navy-600)', marginTop: '8px' }}>{s.motivo}</div>
                )}
                {s.comentarioResolucion && (
                  <div style={{ fontSize: '12px', color: 'var(--navy-600)', marginTop: '8px', fontStyle: 'italic' }}>
                    Respuesta: {s.comentarioResolucion}
                  </div>
                )}
              </div>

              <div className="badge" style={{ background: estilo.bg, color: estilo.color, padding: '8px 16px', fontWeight: 800 }}>
                {estilo.label}
              </div>

              {tab === 'bandeja' ? (
                <button className="btn btn-gold" onClick={() => { setResolviendo(s); setComentario(''); }}>
                  Revisar
                </button>
              ) : s.estado === 'observada' ? (
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button className="btn btn-gold" disabled={isSaving} onClick={() => reenviarMutation.mutate(s.id)}>Reenviar</button>
                  <button className="btn btn-outline" disabled={isSaving} onClick={() => cancelarMutation.mutate(s.id)}>
                    <Ban size={16} /> Cancelar
                  </button>
                </div>
              ) : s.estado === 'pendiente' ? (
                <button className="btn btn-outline" disabled={isSaving} onClick={() => cancelarMutation.mutate(s.id)}>
                  <Ban size={16} /> Cancelar
                </button>
              ) : null}
            </article>
          );
        })}

        {lista.length === 0 && (
          <div style={{ textAlign: 'center', padding: '80px', color: 'var(--navy-600)' }}>
            <Inbox size={48} style={{ opacity: 0.2, marginBottom: '16px' }} />
            <p>{tab === 'mias' ? 'Todavía no has solicitado permisos.' : 'No hay solicitudes esperando respuesta.'}</p>
          </div>
        )}
      </div>

      {/* Nueva solicitud */}
      <Modal isOpen={showForm} onClose={() => setShowForm(false)} title="Nueva solicitud de permiso">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label className="form-label">Tipo de permiso</label>
            <select className="form-select" value={form.tipo}
              onChange={e => setForm({ ...form, tipo: e.target.value as TipoPermiso })}>
              {TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label className="form-label">Desde</label>
              <input type="date" className="form-input" value={form.fechaInicio}
                onChange={e => setForm({ ...form, fechaInicio: e.target.value, fechaFin: form.fechaFin || e.target.value })} />
            </div>
            <div>
              <label className="form-label">Hasta</label>
              <input type="date" className="form-input" value={form.fechaFin} min={form.fechaInicio}
                onChange={e => setForm({ ...form, fechaFin: e.target.value })} />
            </div>
          </div>

          <div>
            <label className="form-label">Jornada</label>
            <select className="form-select" value={form.jornada}
              onChange={e => setForm({ ...form, jornada: e.target.value as JornadaPermiso })}>
              {JORNADAS.map(j => <option key={j.value} value={j.value}>{j.label}</option>)}
            </select>
          </div>

          <div>
            <label className="form-label">
              Motivo {form.tipo === 'administrativo' && <span style={{ fontWeight: 500 }}>(opcional)</span>}
            </label>
            <textarea className="form-textarea" rows={3} value={form.motivo}
              placeholder={form.tipo === 'administrativo' ? 'Un día administrativo no requiere justificación' : 'Describe el motivo'}
              onChange={e => setForm({ ...form, motivo: e.target.value })} />
          </div>

          {diasSolicitados > 0 && (
            <div style={{
              padding: '12px 16px', borderRadius: '12px',
              background: excedeSaldo ? 'var(--color-danger-soft)' : 'var(--bg-main)',
              color: excedeSaldo ? 'var(--color-danger)' : 'var(--navy-600)',
              fontSize: '13px', fontWeight: 600
            }}>
              {diasSolicitados} {diasSolicitados === 1 ? 'día hábil' : 'días hábiles'}
              {excedeSaldo && saldo && ` · excede tu saldo (${saldo.disponibles} disponibles). El director puede autorizarlo igual.`}
              <div style={{ fontWeight: 500, marginTop: '4px', opacity: 0.8 }}>
                No se descuentan feriados legales.
              </div>
            </div>
          )}

          <button className="btn btn-gold" style={{ width: '100%', padding: '14px' }} disabled={isSaving} onClick={enviarSolicitud}>
            {crearMutation.isPending ? 'Enviando...' : 'Enviar solicitud'}
          </button>
        </div>
      </Modal>

      {/* Resolución */}
      <Modal isOpen={!!resolviendo} onClose={() => setResolviendo(null)} title="Revisar solicitud">
        {resolviendo && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="card" style={{ padding: '16px', background: 'var(--bg-main)' }}>
              <div style={{ fontWeight: 800, color: 'var(--navy-900)' }}>
                {resolviendo.solicitanteNombre || 'Funcionario'} · {tipoLabel(resolviendo.tipo)}
              </div>
              <div style={{ fontSize: '13px', color: 'var(--navy-600)', marginTop: '4px' }}>
                {formatDate(resolviendo.fechaInicio)} al {formatDate(resolviendo.fechaFin)} · {resolviendo.diasHabiles} días hábiles
              </div>
              {resolviendo.motivo && (
                <div style={{ fontSize: '13px', color: 'var(--navy-600)', marginTop: '8px' }}>{resolviendo.motivo}</div>
              )}
            </div>

            <div>
              <label className="form-label">Comentario <span style={{ fontWeight: 500 }}>(obligatorio si rechazas)</span></label>
              <textarea className="form-textarea" rows={3} value={comentario}
                onChange={e => setComentario(e.target.value)} placeholder="Visible para quien solicitó" />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <button className="btn btn-outline" disabled={isSaving} onClick={() => resolver('rechazada')}>
                <X size={18} /> Rechazar
              </button>
              <button className="btn btn-gold" disabled={isSaving} onClick={() => resolver('aprobada')}>
                <Check size={18} /> Aprobar
              </button>
            </div>
            <button className="btn btn-ghost" style={{ width: '100%' }} disabled={isSaving}
              onClick={() => resolver('observada')}>
              <MessageSquare size={18} /> Pedir cambios sin rechazar
            </button>
          </div>
        )}
      </Modal>
    </div>
  );
}
