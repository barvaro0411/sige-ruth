import { supabase } from '../db/database';

/**
 * DashboardService
 * Calcula estadísticas y métricas para la pantalla principal.
 */
export const DashboardService = {
  async getStats(sedeId: string) {
    const today = new Date().toISOString().split('T')[0];

    const [resEst, resAsist] = await Promise.all([
      supabase.from('estudiantes').select('id, nivel, activo').eq('sede_id', sedeId).eq('activo', true),
      supabase.from('asistencia').select('estado').eq('sede_id', sedeId).eq('fecha', today)
    ]);

    const estudiantes = resEst.data || [];
    const asistencias = resAsist.data || [];

    return {
      totalEstudiantes: estudiantes.length,
      asistenciaHoy: (asistencias.length > 0 && estudiantes.length > 0) 
        ? Math.round((asistencias.filter(a => a.estado === 'P').length / estudiantes.length) * 100) 
        : 0,
      porNivel: {
        mm: estudiantes.filter(e => e.nivel === 'Medio Mayor').length,
        nt1: estudiantes.filter(e => e.nivel === 'NT1').length,
        nt2: estudiantes.filter(e => e.nivel === 'NT2').length,
      }
    };
  }
};
