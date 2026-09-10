import { lazy, Suspense } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useSede } from '../../auth/SedeContext';
import { useAuth } from '../../auth/AuthContext';
import { DashboardService } from '../../services/dashboardService';
import { PERMISSIONS, ROLE_LABELS } from '../../auth/permissions';
import {
  Users, Activity, ArrowUpRight, TrendingUp, Package, Wrench,
  CalendarDays, Boxes, ArrowRight, CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import { BarraNivel } from './MatriculaPorNivelChart';

const MatriculaPorNivelChart = lazy(() => import('./MatriculaPorNivelChart'));

export default function Dashboard() {
  const { sede } = useSede();
  const { user, can } = useAuth();

  // Sin sondeo cada 30 segundos: `useRealtimeSync` invalida ['dashboard']
  // cuando cambia algo en la sede. El panel se actualiza igual de rápido, pero
  // solo cuando de verdad pasó algo — y no consume datos ni batería el resto
  // del día con la pestaña abierta encima de un mesón.
  const { data: stats, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['dashboard', sede?.id],
    queryFn: () => DashboardService.getStats(sede.id),
    enabled: Boolean(sede?.id),
  });

  /**
   * La fecha, sin el año.
   *
   * Quien abre el panel viene a ver un número, no a que le recuerden en qué año
   * vive. Antes había cinco elementos decorativos antes del primer dato —saludo
   * según la hora, fecha completa, insignia de sede, insignia de rol y un
   * subtítulo que repetía la sede que la insignia ya decía—; ahora la cabecera
   * dice dónde estás y qué día es, y los KPI quedan sobre el pliegue.
   */
  const fechaDeHoy = new Intl.DateTimeFormat('es-CL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date());

  if (isLoading) {
    return (
      <div className="page-container">
        <div className="skeleton" style={{ height: 120, marginBottom: 24, borderRadius: 20 }} />
        <div className="grid grid-4 mb-6">
          <div className="skeleton" style={{ height: 140, borderRadius: 16 }} />
          <div className="skeleton" style={{ height: 140, borderRadius: 16 }} />
          <div className="skeleton" style={{ height: 140, borderRadius: 16 }} />
          <div className="skeleton" style={{ height: 140, borderRadius: 16 }} />
        </div>
        <div className="skeleton h-88 rounded-lg" />
      </div>
    );
  }

  if (isError || !stats) {
    return (
      <div className="page-container">
        <div className="card py-12 px-6 text-center">
          <Activity size={48} style={{ color: 'var(--gold-600)', margin: '0 auto 16px' }} />
          <h3 className="text-xl font-extrabold text-navy">
            Panel temporalmente no disponible
          </h3>
          <p className="text-muted" style={{ maxWidth: 440, margin: '8px auto 20px' }}>
            {error instanceof Error ? error.message : 'No se pudo cargar la información operativa en este momento.'}
          </p>
          <button className="btn btn-gold" onClick={() => { void refetch(); }}>
            Reintentar conexión
          </button>
        </div>
      </div>
    );
  }

  const chartData: BarraNivel[] = [
    { name: 'Medio Mayor', alumnos: stats.porNivel.mm, color: 'var(--gold-600)' },
    { name: 'NT1', alumnos: stats.porNivel.nt1, color: 'var(--color-info)' },
    { name: 'NT2', alumnos: stats.porNivel.nt2, color: 'var(--color-success-dark)' },
  ];

  return (
    <div className="page-container animate-in">
      {/* Una línea: dónde estás y qué día es. Los datos empiezan enseguida. */}
      <div className="page-header dashboard-header">
        <div>
          <h1 className="page-title">Panel · {sede?.nombre}</h1>
          <p className="page-subtitle">
            <span className="dashboard-fecha">{fechaDeHoy}</span>
            <span className="dashboard-separador" aria-hidden="true">·</span>
            {user?.nombre?.split(' ')[0]}
            {user?.rol && `, ${ROLE_LABELS[user.rol]}`}
          </p>
        </div>
      </div>

      {/* Grid de Métricas Principales (KPIs) */}
      <section className="dashboard-kpi-grid">
        {/* Matrícula Activa */}
        <article className="card kpi-card">
          <div className="kpi-header">
            <span className="kpi-title">Matrícula Activa</span>
            <div className="kpi-icon gold">
              <Users size={20} />
            </div>
          </div>
          <div className="kpi-value">{stats.totalEstudiantes}</div>
          <div className="kpi-footer">
            <span className="kpi-tag positive">
              <TrendingUp size={13} /> {stats.cuposOcupados}% Capacidad
            </span>
            <span className="kpi-subtext">Estudiantes regulares</span>
          </div>
        </article>

        {/* Solicitudes de Materiales */}
        <article className="card kpi-card">
          <div className="kpi-header">
            <span className="kpi-title">Pedidos Insumos</span>
            <div className="kpi-icon navy">
              <Package size={20} />
            </div>
          </div>
          <div className="kpi-value">{stats.solicitudesPendientes}</div>
          <div className="kpi-footer">
            {stats.solicitudesPendientes> 0 ? (
              <span className="kpi-tag warning">
                <AlertTriangle size={13} /> Por gestionar
              </span>
            ) : (
              <span className="kpi-tag positive">
                <CheckCircle2 size={13} /> Todo al día
              </span>
            )}
            <Link to="/materiales" className="kpi-link">
              Ver pedidos <ArrowRight size={12} />
            </Link>
          </div>
        </article>

        {/* Mantenciones Abiertas */}
        <article className="card kpi-card">
          <div className="kpi-header">
            <span className="kpi-title">Mantenciones</span>
            <div className="kpi-icon danger">
              <Wrench size={20} />
            </div>
          </div>
          <div className="kpi-value">{stats.mantencionesAbiertas}</div>
          <div className="kpi-footer">
            {stats.mantencionesAbiertas> 0 ? (
              <span className="kpi-tag danger">
                <AlertTriangle size={13} /> En resolución
              </span>
            ) : (
              <span className="kpi-tag positive">
                <CheckCircle2 size={13} /> Sin fallas
              </span>
            )}
            <Link to="/mantenciones" className="kpi-link">
              Revisar <ArrowRight size={12} />
            </Link>
          </div>
        </article>

        {/* Alertas de Bodega */}
        <article className="card kpi-card">
          <div className="kpi-header">
            <span className="kpi-title">Stock en Bodega</span>
            <div className="kpi-icon warning">
              <Boxes size={20} />
            </div>
          </div>
          <div className="kpi-value">{stats.productosBajoMinimo}</div>
          <div className="kpi-footer">
            {stats.productosBajoMinimo> 0 ? (
              <span className="kpi-tag danger">
                <AlertTriangle size={13} /> Reponer stock
              </span>
            ) : (
              <span className="kpi-tag positive">
                <CheckCircle2 size={13} /> Stock normal
              </span>
            )}
            <Link to="/inventario" className="kpi-link">
              Inventario <ArrowRight size={12} />
            </Link>
          </div>
        </article>
      </section>

      {/* Sección Analítica: Gráfico de Distribución + Accesos Rápidos */}
      <div className="dashboard-analytics-grid">
        {/* Gráfico de Matrícula */}
        <section className="card analytics-card">
          <div className="card-header analytics-header">
            <div>
              <h2 className="card-title text-lg">Distribución de Matrícula</h2>
              <p className="text-muted text-sm">
                Estudiantes por nivel educativo en {sede?.nombre}
              </p>
            </div>
            <div className="analytics-badges">
              <span className="level-pill gold">MM: {stats.porNivel.mm}</span>
              <span className="level-pill navy">NT1: {stats.porNivel.nt1}</span>
              <span className="level-pill green">NT2: {stats.porNivel.nt2}</span>
            </div>
          </div>

          <div className="card-body" style={{ padding: '24px 20px', minHeight: '320px' }}>
            <Suspense fallback={<div className="skeleton h-75" />}>
              <MatriculaPorNivelChart data={chartData} />
            </Suspense>
          </div>
        </section>

        {/* Accesos Rápidos Operativos */}
        <section className="card shortcuts-card">
          <div className="card-header">
            <h2 className="card-title text-md">Accesos Rápidos</h2>
            <span className="badge badge-navy">Frecuentes</span>
          </div>

          <div className="card-body shortcuts-list">
            {can(PERMISSIONS.VIEW_STUDENTS) && (
              <Link to="/estudiantes" className="shortcut-item">
                <div className="shortcut-icon gold">
                  <Users size={18} />
                </div>
                <div className="shortcut-info">
                  <span className="shortcut-title">Registro de Matrícula</span>
                  <span className="shortcut-desc">Fichas de alumnos y apoderados</span>
                </div>
                <ArrowRight size={16} className="shortcut-arrow" />
              </Link>
            )}

            {can(PERMISSIONS.REQUEST_MATERIALS) && (
              <Link to="/insumos" className="shortcut-item">
                <div className="shortcut-icon navy">
                  <Package size={18} />
                </div>
                <div className="shortcut-info">
                  <span className="shortcut-title">Solicitar Materiales</span>
                  <span className="shortcut-desc">Pedidos de insumos a bodega</span>
                </div>
                <ArrowRight size={16} className="shortcut-arrow" />
              </Link>
            )}

            {can(PERMISSIONS.REQUEST_LEAVE) && (
              <Link to="/permisos" className="shortcut-item">
                <div className="shortcut-icon green">
                  <CalendarDays size={18} />
                </div>
                <div className="shortcut-info">
                  <span className="shortcut-title">Permisos Administrativos</span>
                  <span className="shortcut-desc">Días libres y ausencias</span>
                </div>
                <ArrowRight size={16} className="shortcut-arrow" />
              </Link>
            )}

            {can(PERMISSIONS.REPORT_MAINTENANCE) && (
              <Link to="/mantenciones" className="shortcut-item">
                <div className="shortcut-icon danger">
                  <Wrench size={18} />
                </div>
                <div className="shortcut-info">
                  <span className="shortcut-title">Reportar Mantención</span>
                  <span className="shortcut-desc">Infraestructura y reparaciones</span>
                </div>
                <ArrowRight size={16} className="shortcut-arrow" />
              </Link>
            )}

            {can(PERMISSIONS.EXPORT_REPORTS) && (
              <Link to="/reportes" className="shortcut-item">
                <div className="shortcut-icon purple">
                  <ArrowUpRight size={18} />
                </div>
                <div className="shortcut-info">
                  <span className="shortcut-title">Centro de Reportes</span>
                  <span className="shortcut-desc">Exportar a Excel y CSV</span>
                </div>
                <ArrowRight size={16} className="shortcut-arrow" />
              </Link>
            )}
          </div>
        </section>
      </div>

    </div>
  );
}
