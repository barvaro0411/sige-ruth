import { lazy, Suspense } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSede } from '../../auth/SedeContext';
import { DashboardService } from '../../services/dashboardService';
import { Users, Activity, ArrowUpRight, TrendingUp } from 'lucide-react';
import { BarraNivel } from './MatriculaPorNivelChart';

// `recharts` pesa ~400 KB. Se descarga solo al abrir esta pantalla, no en el
// bundle que baja todo el personal.
const MatriculaPorNivelChart = lazy(() => import('./MatriculaPorNivelChart'));

export default function Dashboard() {
  const { sede } = useSede();

  const { data: stats, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['dashboard', sede?.id],
    queryFn: () => DashboardService.getStats(sede.id),
    enabled: Boolean(sede?.id),
  });

  if (isLoading) {
    return (
      <div className="page-container">
        <div className="skeleton" style={{ height: 400 }} />
      </div>
    );
  }

  if (isError || !stats) {
    return (
      <div className="page-container">
        <div className="card" style={{ padding: '40px', textAlign: 'center' }}>
          <Activity size={48} style={{ color: 'var(--color-gold)', marginBottom: '16px' }} />
          <h3>Panel Temporalmente no disponible</h3>
          <p className="text-muted">
            {error instanceof Error ? error.message : 'No hay datos suficientes para mostrar el resumen.'}
          </p>
          <button className="btn btn-navy" onClick={() => { void refetch(); }} style={{ marginTop: '20px' }}>
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  const chartData: BarraNivel[] = [
    { name: 'Medio Mayor', alumnos: stats.porNivel.mm, color: '#b45309' },
    { name: 'NT1', alumnos: stats.porNivel.nt1, color: '#0f172a' },
    { name: 'NT2', alumnos: stats.porNivel.nt2, color: '#059669' },
  ];

  return (
    <div className="page-container animate-in">
      <header className="page-header" style={{ marginBottom: '32px' }}>
        <div>
          <h1 className="page-title">Resumen Escolar</h1>
          <p className="page-subtitle">Principales métricas de gestión para {sede.nombre}</p>
        </div>
      </header>

      {/* Stats Cards */}
      <section className="grid grid-2" style={{ marginBottom: '32px' }}>
        <article className="card stat-card">
          <div className="stat-header">
            <span className="stat-label">Matrícula Total Activa</span>
            <div className="stat-icon" style={{ background: 'rgba(212, 168, 67, 0.15)', color: 'var(--color-gold)' }}>
              <Users size={20} />
            </div>
          </div>
          <div className="stat-value">{stats.totalEstudiantes}</div>
          <div className="stat-footer">
            <span className="stat-trend positive">
              <TrendingUp size={14} style={{ display: 'inline', marginRight: '4px' }} />
              100%
            </span>
            <span className="stat-desc">Alumnos con expediente al día</span>
          </div>
        </article>

        <article className="card stat-card">
          <div className="stat-header">
            <span className="stat-label">Capacidad de Sede</span>
            <div className="stat-icon" style={{ background: 'rgba(27, 42, 74, 0.1)', color: 'var(--color-navy)' }}>
              <ArrowUpRight size={20} />
            </div>
          </div>
          <div className="stat-value">{stats.cuposOcupados}%</div>
          <div className="stat-footer">
            <span className="stat-desc">Ocupación estimada sobre cupos proyectados</span>
          </div>
        </article>
      </section>

      {/* Distribution Chart */}
      <section className="card" style={{ marginBottom: '32px' }}>
        <div className="card-header" style={{ padding: '24px 24px 0', borderBottom: 'none' }}>
          <div>
            <h3 style={{ fontSize: '18px', fontWeight: 700 }}>Distribución de Matrícula</h3>
            <p className="text-muted" style={{ fontSize: '13px' }}>Cantidad de estudiantes matriculados por nivel educativo</p>
          </div>
        </div>
        <div className="card-body" style={{ padding: '24px', minHeight: '320px' }}>
          <Suspense fallback={<div className="skeleton" style={{ height: '300px' }} />}>
            <MatriculaPorNivelChart data={chartData} />
          </Suspense>
        </div>
      </section>
    </div>
  );
}
