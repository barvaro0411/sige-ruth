import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, Clock, Plus, TriangleAlert, Wrench } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { PERMISSIONS } from '../../auth/permissions';
import { useSede } from '../../auth/SedeContext';
import { ETIQUETA_ESTADO, ETIQUETA_PRIORIDAD, MantencionService } from '../../services/mantencionService';
import { EstadoMantencion, Mantencion, PrioridadMantencion } from '../../types';
import { formatDate } from '../../utils/dates';
import MantencionDetalle from './MantencionDetalle';
import PreventivasPanel from './PreventivasPanel';
import ReportarProblema from './ReportarProblema';

type Pestana = 'bandeja' | 'mias' | 'preventivas' | 'historial';

const CLASE_PRIORIDAD: Record<PrioridadMantencion, string> = {
  baja: 'badge-info',
  media: 'badge-info',
  alta: 'badge-warning',
  urgente: 'badge-danger',
};

/**
 * Mantenciones.
 *
 * Dos públicos en la misma pantalla, y por eso las pestañas cambian según el
 * rol: quien reporta entra a ver lo suyo, quien gestiona entra a la bandeja de
 * la sede. Preventivas e historial solo aparecen para quien las administra —
 * para una docente son ruido.
 */
export default function MantencionesModule() {
  const { user, can } = useAuth();
  const { sede } = useSede();
  const { id: idEnRuta } = useParams();
  const navigate = useNavigate();

  const gestiona = can(PERMISSIONS.MANAGE_MAINTENANCE);
  const [tab, setTab] = useState<Pestana>(gestiona ? 'bandeja' : 'mias');
  const [reportando, setReportando] = useState(false);
  const [detalle, setDetalle] = useState<Mantencion | null>(null);

  // Al entrar desde una notificación se abre el detalle directamente, sin
  // obligar a buscarlo en la lista.
  const desdeNotificacion = useQuery({
    queryKey: ['mantencion', idEnRuta],
    queryFn: () => MantencionService.getDetalle(Number(idEnRuta)),
    enabled: !!idEnRuta,
  });

  useEffect(() => {
    if (desdeNotificacion.data) setDetalle(desdeNotificacion.data);
  }, [desdeNotificacion.data]);

  function cerrarDetalle() {
    setDetalle(null);
    if (idEnRuta) navigate('/mantenciones', { replace: true });
  }

  const abiertas = useQuery({
    queryKey: ['mantenciones', 'abiertas', sede.id],
    queryFn: () => MantencionService.getAbiertas(sede.id),
  });

  const mias = useQuery({
    queryKey: ['mantenciones', 'mias', user?.id],
    queryFn: () => MantencionService.getMisReportes(user!.id),
    enabled: !!user,
  });

  const cerradas = useQuery({
    queryKey: ['mantenciones', 'cerradas', sede.id],
    queryFn: () => MantencionService.getCerradas(sede.id),
    enabled: gestiona && tab === 'historial',
  });

  // El detalle abierto se relee de la lista viva, para que las acciones se
  // reflejen sin cerrar y volver a abrir el modal.
  const listaActiva = tab === 'mias' ? (mias.data ?? [])
    : tab === 'historial' ? (cerradas.data ?? [])
    : (abiertas.data ?? []);
  const detalleVivo = detalle
    ? [...(abiertas.data ?? []), ...(mias.data ?? []), ...(cerradas.data ?? []),
       ...(desdeNotificacion.data ? [desdeNotificacion.data] : [])]
        .find(m => m.id === detalle.id) ?? detalle
    : null;

  const urgentes = (abiertas.data ?? []).filter(
    m => m.prioridad === 'urgente' && m.estado !== 'resuelta'
  ).length;

  const pestanas: Array<{ id: Pestana; label: string; visible: boolean }> = [
    { id: 'bandeja', label: 'Bandeja de la sede', visible: true },
    { id: 'mias', label: 'Lo que reporté', visible: true },
    { id: 'preventivas', label: 'Preventivas', visible: gestiona },
    { id: 'historial', label: 'Historial', visible: gestiona },
  ];

  const cargando = tab === 'mias' ? mias.isLoading
    : tab === 'historial' ? cerradas.isLoading
    : abiertas.isLoading;

  return (
    <div className="page-container animate-in">
      <header className="page-header">
        <div>
          <h1 className="page-title">Mantenciones</h1>
          <p className="page-subtitle">Lo que está roto y lo que hay que revisar. {sede.nombre}</p>
        </div>
        <button className="btn btn-gold" onClick={() => setReportando(true)}>
          <Plus size={18} /> Reportar problema
        </button>
      </header>

      {urgentes> 0 && tab !== 'preventivas' && (
        <div className="alerta alerta-danger" role="status">
          <TriangleAlert size={18} />
          {urgentes} incidencia{urgentes === 1 ? '' : 's'} urgente{urgentes === 1 ? '' : 's'} sin resolver
        </div>
      )}

      <div className="tabs mb-5">
        {pestanas.filter(p => p.visible).map(p => (
          <button
            key={p.id}
            className={`tab ${tab === p.id ? 'active' : ''}`}
            onClick={() => setTab(p.id)}
          >
            {p.label}
          </button>
        ))}
      </div>

      {tab === 'preventivas' ? (
        <PreventivasPanel />
      ) : cargando ? (
        <div className="skeleton" style={{ height: 320 }} />
      ) : listaActiva.length === 0 ? (
        <div className="card py-12 px-6 text-center">
          <Wrench size={44} style={{ color: 'var(--text-muted)', marginBottom: '14px' }} />
          <h3 className="mb-1">
            {tab === 'mias' ? 'No has reportado nada'
              : tab === 'historial' ? 'Todavía no hay nada cerrado'
              : 'No hay nada roto por ahora'}
          </h3>
          <p className="text-muted">
            {tab === 'historial'
              ? 'Acá va a quedar el registro de todo lo que se reparó.'
              : 'Cuando algo se rompa, repórtalo con una foto y le llega a mantención al instante.'}
          </p>
        </div>
      ) : (
        <div className="grid gap-2">
          {listaActiva.map(m => (
            <FilaMantencion
              key={m.id}
              mantencion={m}
              mostrarReportante={tab !== 'mias'}
              onAbrir={() => setDetalle(m)}
 />
          ))}
        </div>
      )}

      <ReportarProblema abierto={reportando} onCerrar={() => setReportando(false)} />

      {detalleVivo && (
        <MantencionDetalle mantencion={detalleVivo} onCerrar={cerrarDetalle} />
      )}
    </div>
  );
}

function FilaMantencion({
  mantencion, mostrarReportante, onAbrir,
}: {
  mantencion: Mantencion;
  mostrarReportante: boolean;
  onAbrir: () => void;
}) {
  const resuelta = mantencion.estado === 'resuelta';
  const cerrada = mantencion.estado === 'cerrada' || mantencion.estado === 'cancelada';

  return (
    <article
      className="card"
      role="button" tabIndex={0}
      onClick={onAbrir}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onAbrir(); } }}
      style={{
        padding: '14px', cursor: 'pointer',
        borderLeft: `4px solid ${
          mantencion.prioridad === 'urgente' ? 'var(--color-danger)'
          : mantencion.prioridad === 'alta' ? 'var(--color-warning)'
          : cerrada ? 'var(--border-medium)' : 'var(--color-gold)'
        }`,
        opacity: cerrada ? 0.75 : 1,
      }}
    >
      <div className="flex gap-2 items-start flex-wrap">
        <div className="flex-1 min-w-50">
          <div className="flex gap-2 items-center flex-wrap">
            <strong className="text-md">{mantencion.lugar}</strong>
            {mantencion.categoria && <span className="badge">{mantencion.categoria}</span>}
          </div>
          <p style={{
            margin: '4px 0 0', fontSize: '13.5px', color: 'var(--text-secondary)',
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}>
            {mantencion.descripcion}
          </p>
          <div className="text-muted text-sm mt-1 flex gap-2 flex-wrap">
            <span className="flex gap-1 items-center">
              <Clock size={12} /> {formatDate(mantencion.createdAt)}
            </span>
            {mostrarReportante && mantencion.reportadoPorNombre && (
              <span>{mantencion.reportadoPorNombre}</span>
            )}
            {mantencion.asignadoANombre && (
              <span className="flex gap-1 items-center">
                <Wrench size={12} /> {mantencion.asignadoANombre}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-1 items-end">
          <span className={`badge ${resuelta ? 'badge-success' : 'badge-navy'}`}>
            {resuelta && <CheckCircle2 size={12} style={{ marginRight: 4 }} />}
            {ETIQUETA_ESTADO[mantencion.estado as EstadoMantencion]}
          </span>
          {!cerrada && (
            <span className={`badge ${CLASE_PRIORIDAD[mantencion.prioridad]}`}>
              {ETIQUETA_PRIORIDAD[mantencion.prioridad]}
            </span>
          )}
        </div>
      </div>
    </article>
  );
}
