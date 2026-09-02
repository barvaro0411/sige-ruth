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
  AlertTriangle, Sparkles, MapPin
} from 'lucide-react';
import { BarraNivel } from './MatriculaPorNivelChart';

const MatriculaPorNivelChart = lazy(() => import('./MatriculaPorNivelChart'));

export default function Dashboard() {
  const { sede } = useSede();
  const { user, can } = useAuth();

  const { data: stats, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['dashboard', sede?.id],
    queryFn: () => DashboardService.getStats(sede.id),
    enabled: Boolean(sede?.id),
    refetchInterval: 30000, // Actualizar automáticamente cada 30 segundos
  });

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Buenos días';
    if (hour < 19) return 'Buenas tardes';
    return 'Buenas noches';
  };

  const getChileanDate = () => {
    return new Intl.DateTimeFormat('es-CL', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    }).format(new Date());
  };

  if (isLoading) {
    return (
      <div className="page-container">
        <div className="skeleton" style={{ height: 120, marginBottom: 24, borderRadius: 20 }} />
        <div className="grid grid-4" style={{ marginBottom: 24 }}>
          <div className="skeleton" style={{ height: 140, borderRadius: 16 }} />
          <div className="skeleton" style={{ height: 140, borderRadius: 16 }} />
          <div className="skeleton" style={{ height: 140, borderRadius: 16 }} />
          <div className="skeleton" style={{ height: 140, borderRadius: 16 }} />
        </div>
        <div className="skeleton" style={{ height: 350, borderRadius: 20 }} />
      </div>
    );
  }

  if (isError || !stats) {
    return (
      <div className="page-container">
        <div className="card" style={{ padding: '48px 24px', textAlign: 'center' }}>
          <Activity size={48} style={{ color: 'var(--gold-600)', margin: '0 auto 16px' }} />
          <h3 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--navy-900)' }}>
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
    { name: 'NT1', alumnos: stats.porNivel.nt1, color: 'var(--navy-800)' },
    { name: 'NT2', alumnos: stats.porNivel.nt2, color: 'var(--color-success-dark)' },
  ];

  return (
    <div className="page-container animate-in">
      {/* Banner de Bienvenida Institucional */}
      <div className="dashboard-welcome-banner">
        <div className="welcome-content">
          <div className="welcome-tag">
            <Sparkles size={14} className="welcome-tag-icon" />
            <span>{getChileanDate()}</span>
          </div>
          <h1 className="welcome-title">
            {getGreeting()}, {user?.nombre?.split(' ')[0] || 'Docente'}
          </h1>
          <p className="welcome-subtitle">
            Gestión escolar y operaciones en <strong style={{ color: 'white' }}>{sede?.nombre}</strong>
          </p>
        </div>

        <div className="welcome-actions">
          <div className="welcome-badge">
            <MapPin size={15} />
            <span>Sede {sede?.nombre}</span>
          </div>
          <span className="welcome-role-badge">
            {user?.rol ? ROLE_LABELS[user.rol] : 'Personal'}
          </span>
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
            {stats.solicitudesPendientes > 0 ? (
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
            {stats.mantencionesAbiertas > 0 ? (
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
            {stats.productosBajoMinimo > 0 ? (
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
              <h2 className="card-title" style={{ fontSize: '17px' }}>Distribución de Matrícula</h2>
              <p className="text-muted" style={{ fontSize: '13px', marginTop: '2px' }}>
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
            <Suspense fallback={<div className="skeleton" style={{ height: '300px' }} />}>
              <MatriculaPorNivelChart data={chartData} />
            </Suspense>
          </div>
        </section>

        {/* Accesos Rápidos Operativos */}
        <section className="card shortcuts-card">
          <div className="card-header">
            <h2 className="card-title" style={{ fontSize: '16px' }}>Accesos Rápidos</h2>
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

      <style>{`
        /* Welcome Banner */
        .dashboard-welcome-banner {
          background: linear-gradient(135deg, var(--navy-950) 0%, var(--navy-850) 60%, #152747 100%);
          border-radius: var(--radius-xl);
          padding: clamp(24px, 4vw, 36px);
          color: white;
          margin-bottom: 28px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 20px;
          box-shadow: 0 10px 30px -5px rgba(11, 21, 40, 0.25);
          border: 1px solid rgba(255, 255, 255, 0.08);
          position: relative;
          overflow: hidden;
        }

        .dashboard-welcome-banner::after {
          content: '';
          position: absolute;
          top: -50%;
          right: -10%;
          width: 300px;
          height: 300px;
          background: radial-gradient(circle, rgba(212, 168, 67, 0.15) 0%, transparent 70%);
          pointer-events: none;
        }

        .welcome-tag {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 12px;
          background: rgba(212, 168, 67, 0.15);
          border: 1px solid rgba(212, 168, 67, 0.3);
          border-radius: var(--radius-full);
          font-size: 11px;
          font-weight: 700;
          color: var(--gold-300);
          text-transform: capitalize;
          margin-bottom: 10px;
        }

        .welcome-title {
          font-size: clamp(22px, 3.5vw, 30px);
          font-weight: 800;
          letter-spacing: -0.03em;
          margin-bottom: 4px;
          line-height: 1.2;
        }

        .welcome-subtitle {
          font-size: clamp(13px, 1.8vw, 15px);
          color: var(--navy-200);
          font-weight: 500;
        }

        .welcome-actions {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 8px;
          flex-shrink: 0;
        }

        .welcome-badge {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 14px;
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.15);
          border-radius: var(--radius-md);
          font-size: 12.5px;
          font-weight: 700;
          color: white;
          backdrop-filter: blur(8px);
        }

        .welcome-role-badge {
          font-size: 11px;
          font-weight: 800;
          color: var(--gold-400);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        /* KPI Cards Grid */
        .dashboard-kpi-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 18px;
          margin-bottom: 28px;
        }

        .kpi-card {
          padding: 22px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          border-radius: var(--radius-lg);
          transition: all var(--transition-normal);
        }

        .kpi-card:hover {
          transform: translateY(-3px);
          box-shadow: var(--shadow-md);
        }

        .kpi-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }

        .kpi-title {
          font-size: 12px;
          font-weight: 700;
          color: var(--navy-600);
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .kpi-icon {
          width: 40px;
          height: 40px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .kpi-icon.gold { background: var(--gold-100); color: var(--gold-700); }
        .kpi-icon.navy { background: var(--navy-100); color: var(--navy-800); }
        .kpi-icon.danger { background: var(--color-danger-soft); color: var(--color-danger-dark); }
        .kpi-icon.warning { background: var(--color-warning-soft); color: var(--color-warning-dark); }

        .kpi-value {
          font-size: clamp(28px, 4vw, 34px);
          font-weight: 800;
          color: var(--navy-900);
          line-height: 1.1;
          letter-spacing: -0.03em;
          margin-bottom: 12px;
        }

        .kpi-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 12px;
          border-top: 1px solid var(--border-light);
          padding-top: 10px;
        }

        .kpi-tag {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 11px;
          font-weight: 700;
          padding: 2px 8px;
          border-radius: var(--radius-full);
        }

        .kpi-tag.positive { background: var(--color-success-soft); color: var(--color-success-dark); }
        .kpi-tag.warning { background: var(--color-warning-soft); color: var(--color-warning-dark); }
        .kpi-tag.danger { background: var(--color-danger-soft); color: var(--color-danger-dark); }

        .kpi-subtext {
          color: var(--text-muted);
          font-weight: 500;
        }

        .kpi-link {
          display: inline-flex;
          align-items: center;
          gap: 3px;
          color: var(--gold-700);
          text-decoration: none;
          font-weight: 700;
          font-size: 11.5px;
          transition: gap 0.2s;
        }

        .kpi-link:hover {
          gap: 6px;
        }

        /* Analytics Grid */
        .dashboard-analytics-grid {
          display: grid;
          grid-template-columns: 2fr 1.2fr;
          gap: 20px;
        }

        .analytics-card {
          border-radius: var(--radius-xl);
        }

        .analytics-header {
          padding: 20px 24px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 12px;
        }

        .analytics-badges {
          display: flex;
          gap: 6px;
        }

        .level-pill {
          padding: 4px 10px;
          border-radius: var(--radius-full);
          font-size: 11px;
          font-weight: 700;
        }

        .level-pill.gold { background: var(--gold-100); color: var(--gold-700); }
        .level-pill.navy { background: var(--navy-100); color: var(--navy-800); }
        .level-pill.green { background: var(--color-success-soft); color: var(--color-success-dark); }

        /* Shortcuts */
        .shortcuts-card {
          border-radius: var(--radius-xl);
          display: flex;
          flex-direction: column;
        }

        .shortcuts-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
          padding: 18px 20px;
        }

        .shortcut-item {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 12px 14px;
          background: var(--bg-main);
          border: 1px solid var(--border-light);
          border-radius: var(--radius-md);
          text-decoration: none;
          color: inherit;
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .shortcut-item:hover {
          background: white;
          border-color: var(--gold-300);
          transform: translateX(4px);
          box-shadow: var(--shadow-sm);
        }

        .shortcut-icon {
          width: 38px;
          height: 38px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .shortcut-icon.gold { background: var(--gold-100); color: var(--gold-700); }
        .shortcut-icon.navy { background: var(--navy-100); color: var(--navy-800); }
        .shortcut-icon.green { background: var(--color-success-soft); color: var(--color-success-dark); }
        .shortcut-icon.danger { background: var(--color-danger-soft); color: var(--color-danger-dark); }
        .shortcut-icon.purple { background: #f3e8ff; color: #7e22ce; }

        .shortcut-info {
          flex: 1;
          display: flex;
          flex-direction: column;
        }

        .shortcut-title {
          font-size: 13.5px;
          font-weight: 700;
          color: var(--navy-900);
          line-height: 1.2;
        }

        .shortcut-desc {
          font-size: 11.5px;
          color: var(--text-muted);
          margin-top: 2px;
        }

        .shortcut-arrow {
          color: var(--navy-400);
          transition: transform 0.2s;
        }

        .shortcut-item:hover .shortcut-arrow {
          color: var(--gold-600);
          transform: translateX(3px);
        }

        @media (max-width: 1024px) {
          .dashboard-kpi-grid {
            grid-template-columns: repeat(2, 1fr);
          }
          .dashboard-analytics-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 640px) {
          .dashboard-welcome-banner {
            flex-direction: column;
            align-items: flex-start;
            padding: 20px;
          }
          .welcome-actions {
            align-items: flex-start;
            flex-direction: row;
            width: 100%;
            justify-content: space-between;
          }
          .dashboard-kpi-grid {
            grid-template-columns: 1fr;
            gap: 12px;
          }
        }
      `}</style>
    </div>
  );
}
