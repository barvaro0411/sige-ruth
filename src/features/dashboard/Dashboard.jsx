import { useState, useEffect } from 'react';
import { useSede } from '../../config/SedeContext';
import { DashboardService } from '../../services/dashboardService';
import { 
  Users, CheckCircle, Activity, 
  ArrowUpRight, TrendingUp
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, Cell 
} from 'recharts';

export default function Dashboard() {
  const { sede } = useSede();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function load() {
      if (!sede?.id) return;
      setLoading(true);
      setError(null);
      try {
        const data = await DashboardService.getStats(sede.id);
        setStats(data);
      } catch (err) {
        console.error('[Dashboard] Error loading stats:', err);
        setError('No se pudieron cargar las estadísticas.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [sede?.id]);

  if (loading) return <div className="page-container"><div className="skeleton" style={{height: 400}} /></div>;

  if (error || !stats) {
    return (
      <div className="page-container">
        <div className="card" style={{ padding: '40px', textAlign: 'center' }}>
          <Activity size={48} style={{ color: 'var(--color-gold)', marginBottom: '16px' }} />
          <h3>Panel Temporalmente no disponible</h3>
          <p className="text-muted">{error || 'No hay datos suficientes para mostrar el resumen.'}</p>
          <button className="btn btn-navy" onClick={() => window.location.reload()} style={{ marginTop: '20px' }}>
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  const chartData = [
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
      <section className="grid grid-3" style={{ marginBottom: '32px' }}>
        <div className="card" style={{ padding: '24px', display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{ padding: '12px', background: 'var(--color-gold-soft)', color: 'var(--color-gold)', borderRadius: '12px' }}><Users size={28} /></div>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Alumnos</div>
            <div style={{ fontSize: '28px', fontWeight: 900, color: 'var(--color-navy)' }}>{stats.totalEstudiantes}</div>
          </div>
        </div>

        <div className="card" style={{ padding: '24px', display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{ padding: '12px', background: 'var(--color-success-soft)', color: 'var(--color-success)', borderRadius: '12px' }}><CheckCircle size={28} /></div>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Asistencia Hoy</div>
            <div style={{ fontSize: '28px', fontWeight: 900, color: 'var(--color-success)' }}>{stats.asistenciaHoy}%</div>
          </div>
        </div>

        <div className="card" style={{ padding: '24px', display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{ padding: '12px', background: 'var(--color-navy-soft)', color: 'var(--color-navy)', borderRadius: '12px' }}><Activity size={28} /></div>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Cupos Ocupados</div>
            <div style={{ fontSize: '28px', fontWeight: 900, color: 'var(--color-navy)' }}>{Math.round((stats.totalEstudiantes / 98) * 100)}%</div>
          </div>
        </div>
      </section>

      <div className="grid grid-2">
        {/* Gráfico */}
        <div className="card" style={{ padding: '32px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 800 }}>Distribución por Nivel</h3>
            <div className="badge badge-navy">Libro Matrícula</div>
          </div>
          <div style={{ width: '100%' }}>
            <ResponsiveContainer width="100%" height={300} minWidth={0}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 12, fontWeight: 600, fill: '#64748b'}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#64748b'}} />
                <Tooltip 
                  cursor={{fill: 'rgba(0,0,0,0.02)'}}
                  contentStyle={{borderRadius: '16px', border: 'none', boxShadow: 'var(--shadow-lg)', padding: '12px'}}
                />
                <Bar dataKey="alumnos" radius={[8, 8, 0, 0]} barSize={50}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Info Extra / Acceso Rápido */}
        <div className="card" style={{ padding: '32px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 800, marginBottom: '24px' }}>Acciones Frecuentes</h3>
          <div style={{ display: 'grid', gap: '16px' }}>
            <button className="btn btn-outline" style={{ justifyContent: 'space-between', padding: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '40px', height: '40px', background: 'var(--color-gold-soft)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-gold)' }}><TrendingUp size={20} /></div>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontWeight: 700 }}>Ver Reporte Mensual</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Resumen de asistencia y matricula</div>
                </div>
              </div>
              <ArrowUpRight size={18} className="text-muted" />
            </button>
            <button className="btn btn-outline" style={{ justifyContent: 'space-between', padding: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '40px', height: '40px', background: 'var(--color-navy-soft)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-navy)' }}><Users size={20} /></div>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontWeight: 700 }}>Exportar Libro Matrícula</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Descargar listado oficial en PDF</div>
                </div>
              </div>
              <ArrowUpRight size={18} className="text-muted" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
