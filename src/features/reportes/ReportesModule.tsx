import { useState } from 'react';
import { supabase } from '../../db/database';
import { useSede } from '../../auth/SedeContext';
import { useToast } from '../../components/Toast';
import { FileSpreadsheet, FileText, Users, Mic2, LayoutGrid, LucideIcon } from 'lucide-react';
import { mapEstudiante } from '../../utils/mappers';
import { createCsv } from '../../utils/csv';
import { downloadExcel, ExcelRow } from '../../utils/excel';
import { Tables } from '../../types';

interface ReportType {
  id: 'matricula' | 'sesiones_fono';
  title: string;
  icon: LucideIcon;
  color: string;
  desc: string;
}

const REPORT_TYPES: ReportType[] = [
  {
    id: 'matricula',
    title: 'Libro de Matrícula',
    icon: Users,
    color: '#3B82F6',
    desc: 'Listado completo de alumnos activos, RUT y datos de contacto.'
  },
  {
    id: 'sesiones_fono',
    title: 'Intervenciones Fono',
    icon: Mic2,
    color: '#D4A853',
    desc: 'Detalle clínico de sesiones y evolución por estudiante.'
  },
];

export default function ReportesModule() {
  const { sede } = useSede();
  const { addToast } = useToast();
  const [generating, setGenerating] = useState<string | null>(null);

  async function getReportData(type: 'matricula' | 'sesiones_fono'): Promise<{ rows: ExcelRow[]; filenameBase: string; sheetName: string }> {
    const { data: estudiantes, error: estudiantesError } = await supabase
      .from('estudiantes')
      .select('id,rut,nombre,apellido_paterno,apellido_materno,nivel,jornada,nombre_apoderado,telefono_apoderado')
      .eq('sede_id', sede.id)
      .eq('activo', true);

    if (estudiantesError) throw estudiantesError;
    const alumnos = ((estudiantes || []) as unknown as Tables['estudiantes'][]).map(mapEstudiante);

    if (type === 'matricula') {
      const rows: ExcelRow[] = [
        ['RUT', 'Nombre', 'Apellido Paterno', 'Apellido Materno', 'Nivel', 'Jornada', 'Apoderado', 'Teléfono'],
        ...alumnos.map(e => [
          e.rut,
          e.nombre,
          e.apellidoPaterno,
          e.apellidoMaterno,
          e.nivel,
          e.jornada,
          e.nombreApoderado,
          e.telefonoApoderado || '',
        ]),
      ];
      return {
        rows,
        filenameBase: `matricula_${sede.id}`,
        sheetName: 'Libro de Matrícula',
      };
    } else {
      const { data: allSesiones, error: sesionesError } = await supabase
        .from('sesiones_fono')
        .select('fecha,estudiante_id,nivel_fonetico,nivel_semantico,nivel_morfosintactico,nivel_pragmatico,actividad_realizada')
        .eq('sede_id', sede.id)
        .order('fecha', { ascending: false });

      if (sesionesError) throw sesionesError;
      const rows: ExcelRow[] = [
        ['Fecha', 'Alumno', 'Nivel Fonético', 'Nivel Semántico', 'Nivel Morfosintáctico', 'Nivel Pragmático', 'Actividad Realizada']
      ];
      (allSesiones || []).forEach(s => {
        const e = alumnos.find(a => a.id === s.estudiante_id);
        rows.push([
          s.fecha,
          `${e?.nombre || ''} ${e?.apellidoPaterno || ''}`.trim(),
          s.nivel_fonetico,
          s.nivel_semantico,
          s.nivel_morfosintactico,
          s.nivel_pragmatico,
          s.actividad_realizada,
        ]);
      });
      return {
        rows,
        filenameBase: `reporte_fonoaudiologia_${sede.id}`,
        sheetName: 'Intervenciones Fono',
      };
    }
  }

  async function exportReport(type: 'matricula' | 'sesiones_fono', format: 'xlsx' | 'csv') {
    const key = `${type}-${format}`;
    setGenerating(key);
    try {
      const { rows, filenameBase, sheetName } = await getReportData(type);

      if (format === 'xlsx') {
        await downloadExcel(filenameBase, sheetName, rows);
        addToast('Archivo Excel descargado exitosamente', 'success');
      } else {
        const csv = createCsv(rows.map(r => r.map(c => c ?? '')));
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const objectUrl = URL.createObjectURL(blob);
        link.href = objectUrl;
        link.download = `${filenameBase}.csv`;
        link.click();
        URL.revokeObjectURL(objectUrl);
        addToast('Archivo CSV descargado exitosamente', 'success');
      }
    } catch (err: any) {
      if (import.meta.env.DEV) console.error(err);
      addToast('Error al generar el reporte', 'danger');
    } finally {
      setGenerating(null);
    }
  }

  return (
    <div className="page-container animate-in">
      <header className="page-header mb-8">
        <div>
          <h1 className="page-title">Centro de Reportes</h1>
          <p className="page-subtitle">Exportación de datos y estadísticas oficiales para {sede.nombre}</p>
        </div>
      </header>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '24px' }}>
        {REPORT_TYPES.map(report => (
          <article key={report.id} className="card" style={{ borderTop: `4px solid ${report.color}` }}>
            <div className="card-body p-8">
              <div style={{ background: `${report.color}15`, width: '56px', height: '56px', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px' }}>
                <report.icon size={28} color={report.color} />
              </div>
              <h2 className="text-xl font-extrabold mb-3">{report.title}</h2>
              <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '24px', lineHeight: '1.6' }}>{report.desc}</p>

              <div className="flex gap-3 flex-wrap">
                <button
                  className="btn btn-gold"
                  style={{ flex: 1, minWidth: '150px', justifyContent: 'center' }}
                  onClick={() => { void exportReport(report.id, 'xlsx'); }}
                  disabled={generating !== null}
                >
                  <FileSpreadsheet size={18} /> {generating === `${report.id}-xlsx` ? 'Generando...' : 'Descargar Excel (.xlsx)'}
                </button>
                <button
                  className="btn btn-outline"
                  style={{ flex: 1, minWidth: '130px', justifyContent: 'center' }}
                  onClick={() => { void exportReport(report.id, 'csv'); }}
                  disabled={generating !== null}
                >
                  <FileText size={18} /> {generating === `${report.id}-csv` ? 'Generando...' : 'Descargar CSV'}
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>

      <section className="card" style={{ marginTop: '32px', background: 'var(--color-navy)', color: 'white' }}>
          <div className="card-body flex items-center gap-6 p-8">
              <div style={{ background: 'rgba(255,255,255,0.1)', padding: '16px', borderRadius: '50%' }}>
                <LayoutGrid size={32} color="var(--color-gold)" />
              </div>
              <div>
                  <h3 className="text-white text-lg mb-1">¿Necesitas un reporte personalizado?</h3>
                  <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '14px' }}>Contacta con la dirección del establecimiento para habilitar nuevas métricas y formatos de exportación.</p>
              </div>
          </div>
      </section>
    </div>
  );
}
