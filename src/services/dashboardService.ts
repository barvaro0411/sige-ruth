import { supabase } from '../db/database';
import { SCHOOL } from '../constants';

export interface DashboardStats {
  totalEstudiantes: number;
  cuposOcupados: number;
  porNivel: { mm: number; nt1: number; nt2: number };
  solicitudesPendientes: number;
  mantencionesAbiertas: number;
  permisosPendientes: number;
  productosBajoMinimo: number;
}

export const DashboardService = {
  async getStats(sedeId: string): Promise<DashboardStats> {
    // 1. Estudiantes de la sede activa
    const { data: estudiantes, error: errorEstudiantes } = await supabase
      .from('estudiantes')
      .select('id, nivel')
      .eq('sede_id', sedeId)
      .eq('activo', true);

    if (errorEstudiantes) throw errorEstudiantes;

    const listaEstudiantes = estudiantes ?? [];
    const capacidad = SCHOOL.capacidadTotal;

    // 2. Solicitudes de materiales pendientes de revisión o entrega
    const { count: countSolicitudes } = await supabase
      .from('solicitudes_materiales')
      .select('id', { count: 'exact', head: true })
      .eq('sede_id', sedeId)
      .in('estado', ['enviada', 'autorizada']);

    // 3. Mantenciones correctivas abiertas o en curso
    const { count: countMantenciones } = await supabase
      .from('mantenciones')
      .select('id', { count: 'exact', head: true })
      .eq('sede_id', sedeId)
      .in('estado', ['reportada', 'en_curso']);

    // 4. Permisos de personal pendientes de resolución
    const { count: countPermisos } = await supabase
      .from('solicitudes_permiso')
      .select('id', { count: 'exact', head: true })
      .eq('sede_id', sedeId)
      .eq('estado', 'pendiente');

    // 5. Inventario: productos con stock bajo o agotados
    const { count: countInventario } = await supabase
      .from('inventario_estado_vista')
      .select('id', { count: 'exact', head: true })
      .eq('sede_id', sedeId)
      .in('estado_stock', ['agotado', 'bajo_minimo']);

    return {
      totalEstudiantes: listaEstudiantes.length,
      cuposOcupados: capacidad > 0
        ? Math.round((listaEstudiantes.length / capacidad) * 100)
        : 0,
      porNivel: {
        mm: listaEstudiantes.filter(e => e.nivel === 'Medio Mayor').length,
        nt1: listaEstudiantes.filter(e => e.nivel === 'NT1').length,
        nt2: listaEstudiantes.filter(e => e.nivel === 'NT2').length,
      },
      solicitudesPendientes: countSolicitudes ?? 0,
      mantencionesAbiertas: countMantenciones ?? 0,
      permisosPendientes: countPermisos ?? 0,
      productosBajoMinimo: countInventario ?? 0,
    };
  },
};
