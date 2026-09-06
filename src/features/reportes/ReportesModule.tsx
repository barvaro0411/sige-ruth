import { useState } from 'react';
import { supabase } from '../../db/database';
import { useSede } from '../../auth/SedeContext';
import { useToast } from '../../components/Toast';
import {
  FileSpreadsheet, FileText, Users, Mic2, LayoutGrid,
  Boxes, Wrench, CalendarDays, LucideIcon
} from 'lucide-react';
import { mapEstudiante } from '../../utils/mappers';
import { createCsv } from '../../utils/csv';
import { downloadExcel, ExcelRow } from '../../utils/excel';
import { Tables } from '../../types';
import { InventarioService } from '../../services/inventarioService';
import { MantencionService, ETIQUETA_ESTADO as ETIQUETA_ESTADO_MANTENCION, ETIQUETA_PRIORIDAD } from '../../services/mantencionService';
import { formatDate } from '../../utils/dates';
import { formatRut } from '../../utils/rut';

export type ReportId = 'matricula' | 'sesiones_fono' | 'inventario' | 'mantenciones' | 'permisos';

interface ReportType {
  id: ReportId;
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
    desc: 'Listado completo de alumnos activos, RUN formateado, niveles, jornadas y apoderados.' 
  },
  { 
    id: 'sesiones_fono', 
    title: 'Intervenciones Fonoaudiología', 
    icon: Mic2, 
    color: '#D4A853', 
    desc: 'Detalle clínico de sesiones, actividades realizadas y avance de niveles (fonético, semántico, etc.).' 
  },
  { 
    id: 'inventario', 
    title: 'Inventario y Bodega', 
    icon: Boxes, 
    color: '#10B981', 
    desc: 'Existencias de bodega, categorías, stock actual, stock mínimo y alertas de reposición.' 
  },
  { 
    id: 'mantenciones', 
    title: 'Mantenciones e Infraestructura', 
    icon: Wrench, 
    color: '#F59E0B', 
    desc: 'Historial de fallas reportadas, ubicación, prioridad, estado de reparación y resoluciones.' 
  },
  { 
    id: 'permisos', 
    title: 'Permisos y Días del Personal', 
    icon: CalendarDays, 
    color: '#8B5CF6', 
    desc: 'Registro oficial de ausencias, días administrativos, licencias médicas y resoluciones de jefatura.' 
  },
];

export default function ReportesModule() {
  const { sede } = useSede();
  const { addToast } = useToast();
  const [generating, setGenerating] = useState<string | null>(null);

  async function getReportData(type: ReportId): Promise<{ rows: ExcelRow[]; filenameBase: string; sheetName: string }> {
    const fechaHoy = new Date().toISOString().split('T')[0];
    const sedeSanitizada = sede.nombre.replace(/\s+/g, '_');

    if (type === 'matricula') {
      const { data: estudiantes, error } = await supabase
        .from('estudiantes')
        .select('id,rut,nombre,apellido_paterno,apellido_materno,nivel,jornada,nombre_apoderado,telefono_apoderado')
        .eq('sede_id', sede.id)
        .eq('activo', true);
        
      if (error) throw error;
      const alumnos = ((estudiantes || []) as unknown as Tables['estudiantes'][]).map(mapEstudiante);

      const rows: ExcelRow[] = [
        ['N°', 'RUN', 'Nombres', 'Apellido Paterno', 'Apellido Materno', 'Nivel', 'Jornada', 'Apoderado', 'Teléfono'],
        ...alumnos.map((e, idx) => [
          idx + 1,
          formatRut(e.rut),
          e.nombre,
          e.apellidoPaterno,
          e.apellidoMaterno || '',
          e.nivel,
          e.jornada,
          e.nombreApoderado,
          e.telefonoApoderado || '',
        ]),
      ];
      return {
        rows,
        filenameBase: `Matricula_${sedeSanitizada}_${fechaHoy}`,
        sheetName: 'Libro de Matrícula',
      };
    }

    if (type === 'sesiones_fono') {
      const { data: estudiantes } = await supabase
        .from('estudiantes')
        .select('id,nombre,apellido_paterno')
        .eq('sede_id', sede.id);
      
      const { data: sesiones, error } = await supabase
        .from('sesiones_fono')
        .select('fecha,estudiante_id,nivel_fonetico,nivel_semantico,nivel_morfosintactico,nivel_pragmatico,actividad_realizada,observaciones')
        .eq('sede_id', sede.id)
        .order('fecha', { ascending: false });
        
      if (error) throw error;

      const mapaEst = new Map((estudiantes || []).map(e => [e.id, `${e.nombre} ${e.apellido_paterno}`]));

      const rows: ExcelRow[] = [
        ['Fecha', 'Estudiante', 'Nivel Fonético (1-3)', 'Nivel Semántico (1-3)', 'Nivel Morfosintáctico (1-3)', 'Nivel Pragmático (1-3)', 'Actividad Realizada', 'Observaciones Clínicas']
      ];

      (sesiones || []).forEach(s => {
        rows.push([
          s.fecha,
          mapaEst.get(s.estudiante_id) || `Alumno #${s.estudiante_id}`,
          s.nivel_fonetico,
          s.nivel_semantico,
          s.nivel_morfosintactico,
          s.nivel_pragmatico,
          s.actividad_realizada,
          s.observaciones || '',
        ]);
      });

      return {
        rows,
        filenameBase: `Sesiones_Fonoaudiologia_${sedeSanitizada}_${fechaHoy}`,
        sheetName: 'Intervenciones Fono',
      };
    }

    if (type === 'inventario') {
      const productos = await InventarioService.getProductos(sede.id);

      const rows: ExcelRow[] = [
        ['ID', 'Categoría', 'Artículo / Producto', 'Stock Actual', 'Stock Mínimo', 'Unidad', 'Estado de Stock', 'Ubicación']
      ];

      productos.forEach(p => {
        const estadoTexto = p.estadoStock === 'agotado'
          ? 'AGOTADO'
          : p.estadoStock === 'bajo'
          ? 'BAJO MÍNIMO'
          : 'SUFICIENTE';

        rows.push([
          p.id,
          p.categoria,
          p.nombre,
          p.stockActual,
          p.stockMinimo,
          p.unidadNombre || p.unidad,
          estadoTexto,
          p.ubicacion || 'Bodega central',
        ]);
      });

      return {
        rows,
        filenameBase: `Inventario_Bodega_${sedeSanitizada}_${fechaHoy}`,
        sheetName: 'Inventario y Stock',
      };
    }

    if (type === 'mantenciones') {
      const [abiertas, cerradas] = await Promise.all([
        MantencionService.getAbiertas(sede.id),
        MantencionService.getCerradas(sede.id, 500),
      ]);
      const tickets = [...abiertas, ...cerradas];

      const rows: ExcelRow[] = [
        ['Ticket #', 'Problema Reportado', 'Categoría', 'Lugar / Sala', 'Prioridad', 'Estado', 'Reportado Por', 'Responsable', 'Fecha Reporte', 'Cerrada En', 'Costo']
      ];

      tickets.forEach(m => {
        rows.push([
          m.id,
          m.descripcion,
          m.categoria || 'General',
          m.lugar || 'Sin sala asignada',
          ETIQUETA_PRIORIDAD[m.prioridad] || m.prioridad,
          ETIQUETA_ESTADO_MANTENCION[m.estado] || m.estado,
          m.reportadoPorNombre || 'Funcionario',
          m.asignadoANombre || 'Sin asignar',
          formatDate(m.createdAt),
          m.cerradaEn ? formatDate(m.cerradaEn) : 'En curso',
          m.costo ? `$${m.costo.toLocaleString('es-CL')}` : '-',
        ]);
      });

      return {
        rows,
        filenameBase: `Historial_Mantenciones_${sedeSanitizada}_${fechaHoy}`,
        sheetName: 'Mantenciones e Infraestructura',
      };
    }

    // Permisos y Días Administrativos
    const { data: solicitudes, error: permError } = await supabase
      .from('solicitudes_permiso')
      .select('*, solicitante:perfiles!solicitudes_permiso_solicitante_id_fkey(nombre)')
      .eq('sede_id', sede.id)
      .order('fecha_inicio', { ascending: false });

    if (permError) throw permError;

    const rows: ExcelRow[] = [
      ['ID', 'Funcionario(a)', 'Tipo de Permiso', 'Jornada', 'Fecha Inicio', 'Fecha Término', 'Días Hábiles', 'Motivo', 'Estado']
    ];

    (solicitudes || []).forEach(s => {
      const tipoTexto = s.tipo === 'administrativo' ? 'Día Administrativo'
        : s.tipo === 'licencia_medica' ? 'Licencia Médica'
        : s.tipo === 'capacitacion' ? 'Capacitación'
        : s.tipo === 'sin_goce' ? 'Sin Goce de Sueldo'
        : 'Otro';

      const estadoTexto = s.estado === 'aprobada' ? 'Aprobada'
        : s.estado === 'pendiente' ? 'Pendiente'
        : s.estado === 'observada' ? 'Observada'
        : s.estado === 'rechazada' ? 'Rechazada'
        : 'Cancelada';

      rows.push([
        s.id,
        (s.solicitante as any)?.nombre || 'Funcionario',
        tipoTexto,
        s.jornada === 'completa' ? 'Jornada Completa' : s.jornada === 'manana' ? 'Mañana' : 'Tarde',
        s.fecha_inicio,
        s.fecha_fin,
        s.dias_habiles,
        s.motivo || '-',
        estadoTexto,
      ]);
    });

    return {
      rows,
      filenameBase: `Reporte_Permisos_${sedeSanitizada}_${fechaHoy}`,
      sheetName: 'Permisos y Días',
    };
  }

  async function exportReport(type: ReportId, format: 'xlsx' | 'csv') {
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
      addToast('Error al generar el reporte: ' + (err?.message || 'Error desconocido'), 'danger');
    } finally {
      setGenerating(null);
    }
  }

  return (
    <div className="page-container animate-in">
      <header className="page-header mb-8">
        <div>
          <h1 className="page-title">Centro de Reportes</h1>
          <p className="page-subtitle">Exportación oficial de planillas Excel y datos para {sede.nombre}</p>
        </div>
      </header>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '24px' }}>
        {REPORT_TYPES.map(report => (
          <article key={report.id} className="card" style={{ borderTop: `4px solid ${report.color}`, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div className="card-body" style={{ padding: '28px' }}>
              <div style={{ background: `${report.color}15`, width: '54px', height: '54px', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '18px' }}>
                <report.icon size={26} color={report.color} />
              </div>
              <h2 style={{ fontSize: '19px', fontWeight: 800, marginBottom: '10px', color: 'var(--navy-900)' }}>{report.title}</h2>
              <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', marginBottom: '24px', lineHeight: '1.6' }}>{report.desc}</p>
              
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <button 
                  className="btn btn-gold" 
                  style={{ flex: 1, minWidth: '150px', justifyContent: 'center' }} 
                  onClick={() => { void exportReport(report.id, 'xlsx'); }}
                  disabled={generating !== null}
                >
                  <FileSpreadsheet size={17} /> {generating === `${report.id}-xlsx` ? 'Generando…' : 'Descargar Excel (.xlsx)'}
                </button>
                <button 
                  className="btn btn-outline" 
                  style={{ flex: 1, minWidth: '120px', justifyContent: 'center' }} 
                  onClick={() => { void exportReport(report.id, 'csv'); }}
                  disabled={generating !== null}
                >
                  <FileText size={17} /> {generating === `${report.id}-csv` ? 'Generando…' : 'CSV'}
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>

      <section className="card" style={{ marginTop: '32px', background: 'var(--color-navy)', color: 'white' }}>
        <div className="card-body" style={{ display: 'flex', alignItems: 'center', gap: '24px', padding: '28px' }}>
          <div style={{ background: 'rgba(255,255,255,0.1)', padding: '16px', borderRadius: '50%', flexShrink: 0 }}>
            <LayoutGrid size={28} color="var(--color-gold)" />
          </div>
          <div>
            <h3 style={{ color: 'white', fontSize: '17px', marginBottom: '4px', fontWeight: 800 }}>¿Necesitas una nómina personalizada?</h3>
            <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '13.5px', margin: 0, lineHeight: 1.5 }}>
              Todas las planillas se descargan en formato estándar compatible con Microsoft Excel, Google Sheets y LibreOffice con los datos actualizados de tu sede.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
