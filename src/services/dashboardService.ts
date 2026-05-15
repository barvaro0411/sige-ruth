import { supabase } from '../db/database';
import { getToday } from '../utils/dates';

/**
 * DashboardService
 * Calcula estadísticas y métricas para la pantalla principal.
 */
export const DashboardService = {
  async getStats(sedeId: string) {
    const today = getToday();

    const [resEst, resAsist] = await Promise.all([
      supabase.from('estudiantes').select('*').eq('sede_id', sedeId).eq('activo', true),
      supabase.from('asistencia').select('*').eq('sede_id', sedeId).eq('fecha', today)
    ]);

    const estudiantes = resEst.data || [];
    const asistencias = resAsist.data || [];

    // Porcentaje basado solo en los registros de hoy (alumnos a los que se les pasó lista)
    const asistenciaHoy = (asistencias.length > 0) 
      ? Math.round((asistencias.filter(a => a.estado === 'P').length / asistencias.length) * 100) 
      : 0;

    return {
      totalEstudiantes: estudiantes.length,
      asistenciaHoy,
      porNivel: {
        mm: estudiantes.filter(e => e.nivel === 'Medio Mayor').length,
        nt1: estudiantes.filter(e => e.nivel === 'NT1').length,
        nt2: estudiantes.filter(e => e.nivel === 'NT2').length,
      }
    };
  }
};
