import { useState } from 'react';
import { supabase } from '../../db/database';
import { useSede } from '../../config/SedeContext';
import { useAuth } from '../../auth/AuthContext';
import { PERMISSIONS } from '../../auth/permissions';
import {
  Download, Users,
  ClipboardList, Mic2, LayoutGrid
} from 'lucide-react';
import { mapEstudiante } from '../../utils/mappers';

const REPORT_PAGE_SIZE = 1000;

const REPORT_TYPES = [
  { id: 'matricula', title: 'Libro de Matricula', icon: Users, color: '#3B82F6', desc: 'Listado completo de alumnos activos, RUT y datos de contacto.' },
  { id: 'asistencia', title: 'Registro de Asistencia', icon: ClipboardList, color: '#10B981', desc: 'Porcentajes de asistencia mensual y diaria por nivel.' },
  { id: 'sesiones_fono', title: 'Intervenciones Fono', icon: Mic2, color: '#D4A853', desc: 'Detalle clinico de sesiones y evolucion por estudiante.' },
];

type ReportTable = 'estudiantes' | 'asistencia' | 'sesiones_fono';
type ReportRow = Record<string, any>;

const REPORT_COLUMNS: Record<ReportTable, string> = {
  estudiantes: 'id,rut,nombre,apellido_paterno,apellido_materno,nivel,jornada,nombre_apoderado,telefono_apoderado,activo,sede_id,created_at',
  asistencia: 'fecha,estudiante_id,estado,observacion,sede_id',
  sesiones_fono: 'fecha,estudiante_id,nivel_fonetico,nivel_semantico,nivel_morfosintactico,nivel_pragmatico,actividad_realizada,sede_id',
};

async function fetchReportRows(table: ReportTable, sedeId: string, activeOnly = false) {
  const rows: ReportRow[] = [];
  let from = 0;

  while (true) {
    let query = (supabase.from(table) as any)
      .select(REPORT_COLUMNS[table])
      .eq('sede_id', sedeId)
      .range(from, from + REPORT_PAGE_SIZE - 1);

    if (activeOnly) query = query.eq('activo', true);

    const { data, error } = await query;
    if (error) throw error;

    const page = data || [];
    rows.push(...page);
    if (page.length < REPORT_PAGE_SIZE) break;
    from += REPORT_PAGE_SIZE;
  }

  return rows;
}

function csvCell(value: unknown) {
  const text = value == null ? '' : String(value);
  const safeText = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safeText.replace(/"/g, '""')}"`;
}

function csvLine(values: unknown[]) {
  return values.map(csvCell).join(',') + '\n';
}

export default function ReportesModule() {
  const { sede } = useSede();
  const { can } = useAuth();
  const [generating, setGenerating] = useState(false);
  const canExport = can(PERMISSIONS.EXPORT_REPORTS);

  async function generateCSV(type: string) {
    if (!canExport) return;

    setGenerating(true);
    try {
      let csv = '';
      let filename = '';
      const alumnos = (await fetchReportRows('estudiantes', sede.id, false)).map(row => mapEstudiante(row as any));
      const alumnosById = new Map(alumnos.map(estudiante => [estudiante.id, estudiante]));

      if (type === 'matricula') {
        const alumnosActivos = alumnos.filter(e => e.activo);
        csv = csvLine(['RUT', 'Nombre', 'Apellido Paterno', 'Apellido Materno', 'Nivel', 'Jornada', 'Apoderado', 'Telefono']);
        alumnosActivos.forEach(e => {
          csv += csvLine([e.rut, e.nombre, e.apellidoPaterno, e.apellidoMaterno, e.nivel, e.jornada, e.nombreApoderado, e.telefonoApoderado]);
        });
        filename = `matricula_${sede.id}.csv`;
      } else if (type === 'asistencia') {
        const allAsistencia = await fetchReportRows('asistencia', sede.id);

        csv = csvLine(['Fecha', 'RUT', 'Alumno', 'Estado', 'Observacion']);
        allAsistencia.forEach(a => {
          const e = alumnosById.get(a.estudiante_id);
          csv += csvLine([a.fecha, e?.rut || '', `${e?.nombre || ''} ${e?.apellidoPaterno || ''}`.trim(), a.estado, a.observacion || '']);
        });
        filename = `reporte_asistencia_${sede.id}.csv`;
      } else if (type === 'sesiones_fono') {
        const allSesiones = await fetchReportRows('sesiones_fono', sede.id);

        csv = csvLine(['Fecha', 'Alumno', 'Nivel Fonetico', 'Nivel Semantico', 'Nivel Morfosintactico', 'Nivel Pragmatico', 'Actividad']);
        allSesiones.forEach(s => {
          const e = alumnosById.get(s.estudiante_id);
          csv += csvLine([
            s.fecha,
            `${e?.nombre || ''} ${e?.apellidoPaterno || ''}`.trim(),
            s.nivel_fonetico,
            s.nivel_semantico,
            s.nivel_morfosintactico,
            s.nivel_pragmatico,
            s.actividad_realizada
          ]);
        });
        filename = `reporte_fonoaudiologia_${sede.id}.csv`;
      }

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      link.click();
      URL.revokeObjectURL(link.href);
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="page-container">
      <header className="page-header" style={{ marginBottom: '32px' }}>
        <div>
          <h1 className="page-title">Centro de Reportes</h1>
          <p className="page-subtitle">Exportacion de datos y estadisticas oficiales</p>
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

              {canExport && (
                <button
                  className="btn btn-gold"
                  style={{ width: '100%', justifyContent: 'center' }}
                  onClick={() => generateCSV(report.id)}
                  disabled={generating}
                >
                  <Download size={18} /> {generating ? 'Generando...' : 'Descargar CSV'}
                </button>
              )}
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
            <h3 style={{ color: 'white', fontSize: '18px', marginBottom: '4px' }}>Reporte personalizado</h3>
            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '14px' }}>Solo usuarios autorizados pueden exportar informacion academica.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
