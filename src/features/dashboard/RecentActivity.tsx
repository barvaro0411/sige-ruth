import { useState, useEffect } from 'react';
import { supabase } from '../../db/database';
import { useSede } from '../../config/SedeContext';
import { mapAuditLog } from '../../utils/mappers';
import { 
  UserPlus, UserMinus, UserCheck, 
  ClipboardCheck, FileUp, ShieldAlert,
  Clock, History
} from 'lucide-react';

const ACTION_ICONS: Record<string, any> = {
  CREAR: { icon: UserPlus, color: '#10B981', bg: '#D1FAE5', label: 'Nuevo registro' },
  MODIFICAR: { icon: History, color: '#F59E0B', bg: '#FEF3C7', label: 'Cambio realizado' },
  ELIMINAR: { icon: UserMinus, color: '#EF4444', bg: '#FEE2E2', label: 'Eliminación' },
  CERRAR_ASISTENCIA: { icon: ClipboardCheck, color: '#3B82F6', bg: '#DBEAFE', label: 'Asistencia cerrada' },
  CERRAR: { icon: ClipboardCheck, color: '#3B82F6', bg: '#DBEAFE', label: 'Asistencia cerrada' },
};

const ENTITY_LABELS: Record<string, string> = {
  estudiante: 'Estudiante',
  asistencia: 'Asistencia',
  estudiantes_documentos: 'Documento',
  sesiones_fono: 'Sesión Fono',
};

export default function RecentActivity() {
  const { sede } = useSede();
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadRecent() {
      const { data, error } = await supabase
        .from('auditoria')
        .select('*')
        .eq('sede_id', sede.id)
        .order('created_at', { ascending: false })
        .limit(6);

      if (!error && data) {
        setActivities(data.map(mapAuditLog));
      }
      setLoading(false);
    }

    loadRecent();
    
    // Suscripción en tiempo real para actualizaciones automáticas
    const channel = supabase
      .channel('auditoria-changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'auditoria' }, (payload) => {
        setActivities(prev => [mapAuditLog(payload.new), ...prev.slice(0, 5)]);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [sede.id]);

  function getRelativeTime(dateStr: string) {
    const date = new Date(dateStr);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffInSeconds < 60) return 'Ahora';
    if (diffInSeconds < 3600) return `Hace ${Math.floor(diffInSeconds / 60)} min`;
    if (diffInSeconds < 86400) return `Hace ${Math.floor(diffInSeconds / 3600)}h`;
    return date.toLocaleDateString();
  }

  if (loading) return <div className="skeleton" style={{ height: 300, borderRadius: 'var(--radius-xl)' }} />;

  return (
    <div className="card" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <header className="card-header" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <ShieldAlert size={18} className="text-secondary" />
        <h2 className="card-title">Actividad Reciente</h2>
      </header>
      <div className="card-body" style={{ flex: 1, padding: 'var(--space-4)' }}>
        {activities.length === 0 ? (
          <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px' }}>Sin actividad reciente.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {activities.map((act) => {
              const meta = ACTION_ICONS[act.accion] || { icon: History, color: '#64748B', bg: '#F1F5F9', label: act.accion };
              const Icon = meta.icon;
              
              return (
                <div key={act.id} style={{ display: 'flex', gap: '12px', alignItems: 'start' }}>
                  <div style={{ 
                    background: meta.bg, 
                    color: meta.color, 
                    padding: '8px', 
                    borderRadius: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <Icon size={16} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 700, fontSize: '13px', color: 'var(--text-primary)' }}>
                        {act.usuario}
                      </span>
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '3px' }}>
                        <Clock size={10} /> {getRelativeTime(act.timestamp)}
                      </span>
                    </div>
                    <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>
                      {meta.label} en <span style={{ fontWeight: 600 }}>{ENTITY_LABELS[act.entidad] || act.entidad}</span>
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
