import { useState, useEffect } from 'react';
import { supabase } from '../../db/database';
import { useSede } from '../../config/SedeContext';
import { AlertCircle, Clock, CheckCircle2, UserX } from 'lucide-react';

export default function CriticalAlerts() {
  const { sede } = useSede();
  const [alerts, setAlerts] = useState<{
    pendingAttendance: string[];
    absentHigh: any[];
    loading: boolean;
  }>({
    pendingAttendance: [],
    absentHigh: [],
    loading: true
  });

  useEffect(() => {
    async function checkAlerts() {
      // 1. Check pending attendance by Nivel/Jornada
      const today = new Date().toISOString().split('T')[0];
      const niveles = ['Medio Mayor', 'NT1', 'NT2'];
      const jornadas = ['Mañana', 'Tarde'];
      
      const { data: records } = await supabase
        .from('asistencia')
        .select('estudiante_id, cerrada, estudiantes(nivel, jornada)')
        .eq('fecha', today)
        .eq('sede_id', sede.id);

      const pending = [];
      for (const n of niveles) {
        for (const j of jornadas) {
          const hasClosedRecord = records?.some(r => 
            //@ts-ignore
            r.estudiantes?.nivel === n && r.estudiantes?.jornada === j && r.cerrada
          );
          if (!hasClosedRecord) {
            pending.push(`${n} - ${j}`);
          }
        }
      }

      setAlerts({
        pendingAttendance: pending,
        absentHigh: [], // Esto lo llenaremos con el RPC existente
        loading: false
      });
    }

    checkAlerts();
  }, [sede.id]);

  if (alerts.loading) return null;

  return (
    <div className="critical-alerts-container" style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
      {alerts.pendingAttendance.length > 0 && (
        <div className="alert-card warning" style={{ 
          background: '#FFFBEB', 
          border: '1px solid #FCD34D', 
          padding: '16px', 
          borderRadius: '12px',
          display: 'flex',
          alignItems: 'start',
          gap: '12px'
        }}>
          <Clock className="text-warning" size={20} style={{ color: '#D97706', marginTop: '2px' }} />
          <div>
            <h4 style={{ margin: 0, color: '#92400E', fontSize: '14px', fontWeight: 700 }}>Asistencia Pendiente</h4>
            <p style={{ margin: '4px 0 0 0', color: '#B45309', fontSize: '13px' }}>
              Los siguientes cursos aún no han cerrado la lista de hoy:
            </p>
            <div style={{ display: 'flex', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
              {alerts.pendingAttendance.map(p => (
                <span key={p} style={{ 
                  background: '#FEF3C7', 
                  color: '#92400E', 
                  padding: '2px 8px', 
                  borderRadius: '6px', 
                  fontSize: '11px',
                  fontWeight: 600,
                  border: '1px solid #FDE68A'
                }}>{p}</span>
              ))}
            </div>
          </div>
        </div>
      )}

      {alerts.pendingAttendance.length === 0 && (
        <div className="alert-card success" style={{ 
          background: '#F0FDF4', 
          border: '1px solid #BBF7D0', 
          padding: '12px 16px', 
          borderRadius: '12px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          <CheckCircle2 size={20} style={{ color: '#16A34A' }} />
          <span style={{ color: '#15803D', fontSize: '13px', fontWeight: 600 }}>¡Toda la asistencia de hoy ha sido cerrada correctamente!</span>
        </div>
      )}
    </div>
  );
}
