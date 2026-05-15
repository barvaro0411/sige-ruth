import { supabase } from '../db/database';
import { Asistencia, Tables } from '../types';
import { mapAsistencia } from '../utils/mappers';

/**
 * AsistenciaService
 * Gestiona el pase de lista diario y el cierre de jornadas.
 */
export const AsistenciaService = {
  /**
   * Obtener registros de asistencia para una fecha y sede específica
   */
  async getByFecha(fecha: string, sedeId: string): Promise<Asistencia[]> {
    const { data, error } = await supabase
      .from('asistencia')
      .select('id,estudiante_id,fecha,estado,observacion,registrado_por,cerrada,sede_id,created_at')
      .eq('fecha', fecha)
      .eq('sede_id', sedeId);

    if (error) throw error;
    return (data || []).map(mapAsistencia);
  },

  /**
   * Guardar o actualizar registros de asistencia (Cierre de Jornada)
   * Nota: La auditoría se realiza automáticamente vía Triggers en la DB.
   */
  async salvarJornada(records: Partial<Tables['asistencia']>[]): Promise<void> {
    const { error } = await supabase
      .from('asistencia')
      .upsert(records, { onConflict: 'estudiante_id,fecha' });

    if (error) throw error;
  }
};
