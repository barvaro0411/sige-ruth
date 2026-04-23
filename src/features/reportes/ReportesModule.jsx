import { useState, useMemo } from 'react';
import { supabase } from '../../db/database';
import { getMonthName, formatDate } from '../../utils/dates';
import { useSede } from '../../config/SedeContext';
import { 
  Download, FileSpreadsheet, Users, 
  ClipboardList, Mic2, Calendar, LayoutGrid 
} from 'lucide-react';
import { mapEstudiante } from '../../utils/mappers';

const REPORT_TYPES = [
  { id: 'matricula', title: 'Libro de Matrícula', icon: Users, color: '#3B82F6', desc: 'Listado completo de alumnos activos, RUT y datos de contacto.' },
  { id: 'asistencia', title: 'Registro de Asistencia', icon: ClipboardList, color: '#10B981', desc: 'Porcentajes de asistencia mensual y diaria por nivel.' },
  { id: 'sesiones_fono', title: 'Intervenciones Fono', icon: Mic2, color: '#D4A853', desc: 'Detalle clínico de sesiones y evolución por estudiante.' },
];

export default function ReportesModule() {
  const { sede } = useSede();
  const [generating, setGenerating] = useState(false);
  const [year] = useState(new Date().getFullYear());

  async function generateCSV(type) {
    setGenerating(true);
    try {
      let csv = '';
      let filename = '';
      const { data: estudiantes } = await supabase.from('estudiantes').select('*').eq('sede_id', sede.id).eq('activo', true);
      const alumnos = (estudiantes || []).map(mapEstudiante);

      if (type === 'matricula') {
        csv = 'RUT,Nombre,Apellido Paterno,Apellido Materno,Nivel,Jornada,Apoderado,Telefono\n';
        alumnos.forEach(e => {
          csv += `${e.rut},"${e.nombre}","${e.apellidoPaterno}","${e.apellidoMaterno}","${e.nivel}","${e.jornada}","${e.nombreApoderado}","${e.telefonoApoderado}"\n`;
        });
        filename = `matricula_${sede.id}.csv`;
      } else if (type === 'asistencia') {
        const { data: allAsistencia } = await supabase.from('asistencia').select('*').eq('sede_id', sede.id);
        csv = 'Fecha,RUT,Alumno,Estado,Observacion\n';
        (allAsistencia || []).forEach(a => {
          const e = alumnos.find(est => est.id === a.estudiante_id);
          csv += `${a.fecha},"${e?.rut || ''}","${e?.nombre || ''} ${e?.apellidoPaterno || ''}","${a.estado}","${a.observacion || ''}"\n`;
        });
        filename = `reporte_asistencia_${sede.id}.csv`;
      } else if (type === 'sesiones_fono') {
        const { data: allSesiones } = await supabase.from('sesiones_fono').select('*').eq('sede_id', sede.id);
        csv = 'Fecha,Alumno,Nivel Fonético,Nivel Semántico,Nivel Morfosintáctico,Nivel Pragmático,Actividad\n';
        (allSesiones || []).forEach(s => {
          const e = alumnos.find(a => a.id === s.estudiante_id);
          csv += `${s.fecha},"${e?.nombre} ${e?.apellidoPaterno}",${s.nivel_fonetico},${s.nivel_semantico},${s.nivel_morfosintactico},${s.nivel_pragmatico},"${s.actividad_realizada}"\n`;
        });
        filename = `reporte_fonoaudiologia_${sede.id}.csv`;
      }

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      link.click();
    } finally { setGenerating(false); }
  }

  return (
    <div className="page-container">
      <header className="page-header" style={{ marginBottom: '32px' }}>
        <div>
          <h1 className="page-title">Centro de Reportes</h1>
          <p className="page-subtitle">Exportación de datos y estadísticas oficiales</p>
        </div>
      </header>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '24px' }}>
        {REPORT_TYPES.map(report => (
          <article key={report.id} className="card" style={{ borderTop: `4px solid ${report.color}` }}>
            <div className="card-body" style={{ padding: '32px' }}>
              <div style={{ background: `${report.color}15`, width: '56px', height: '56px', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px' }}>
                <report.icon size={28} color={report.color} />
              </div>
              <h2 style={{ fontSize: '20px', fontWeight: 800, marginBottom: '12px' }}>{report.title}</h2>
              <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '24px', lineHeight: '1.6' }}>{report.desc}</p>
              
              <button 
                className="btn btn-gold" 
                style={{ width: '100%', justifyContent: 'center' }} 
                onClick={() => generateCSV(report.id)}
                disabled={generating}
              >
                <Download size={18} /> {generating ? 'Generando...' : 'Descargar en Excel/CSV'}
              </button>
            </div>
          </article>
        ))}
      </div>

      <section className="card" style={{ marginTop: '32px', background: 'var(--color-navy)', color: 'white' }}>
          <div className="card-body" style={{ display: 'flex', alignItems: 'center', gap: '24px', padding: '32px' }}>
              <div style={{ background: 'rgba(255,255,255,0.1)', padding: '16px', borderRadius: '50%' }}>
                <LayoutGrid size={32} color="var(--color-gold)" />
              </div>
              <div>
                  <h3 style={{ color: 'white', fontSize: '18px', marginBottom: '4px' }}>¿Necesitas un reporte personalizado?</h3>
                  <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '14px' }}>Contacta con el administrador del sistema para habilitar nuevas métricas de exportación.</p>
              </div>
          </div>
      </section>
    </div>
  );
}
