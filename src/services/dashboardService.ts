import { supabase } from '../db/database';
import { SCHOOL } from '../constants';

/**
 * DashboardService
 * Métricas de la pantalla principal.
 *
 * Ya no calcula asistencia: ese registro vive en el libro de clases y en el
 * SIGE del MINEDUC. La versión anterior consultaba una tabla inexistente,
 * descartaba el error y mostraba «0 %», que se lee como un dato y no como
 * una falla.
 */
export interface DashboardStats {
  totalEstudiantes: number;
  cuposOcupados: number;
  porNivel: { mm: number; nt1: number; nt2: number };
}

export const DashboardService = {
  async getStats(sedeId: string): Promise<DashboardStats> {
    const { data, error } = await supabase
      .from('estudiantes')
      .select('id, nivel')
      .eq('sede_id', sedeId)
      .eq('activo', true);

    if (error) throw error;

    const estudiantes = data ?? [];
    const capacidad = SCHOOL.capacidadTotal;

    return {
      totalEstudiantes: estudiantes.length,
      cuposOcupados: capacidad > 0
        ? Math.round((estudiantes.length / capacidad) * 100)
        : 0,
      porNivel: {
        mm: estudiantes.filter(e => e.nivel === 'Medio Mayor').length,
        nt1: estudiantes.filter(e => e.nivel === 'NT1').length,
        nt2: estudiantes.filter(e => e.nivel === 'NT2').length,
      },
    };
  },
};
