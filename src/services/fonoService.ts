import { supabase } from '../db/database';
import { Tables } from '../types';

const CAMPOS_SESION = [
  'id', 'fecha', 'estudiante_id', 'fonoaudiologo_id', 'actividad_realizada',
  'observaciones', 'nivel_fonetico', 'nivel_semantico', 'nivel_morfosintactico',
  'nivel_pragmatico', 'sede_id', 'created_at',
].join(',');

/**
 * FonoService
 * Gestiona las intervenciones fonoaudiológicas y el seguimiento de niveles.
 */
export const FonoService = {
  /**
   * Obtener todas las sesiones de una sede
   */
  async getSesionesBySede(sedeId: string): Promise<Tables['sesiones_fono'][]> {
    const { data, error } = await supabase
      .from('sesiones_fono')
      .select(CAMPOS_SESION)
      .eq('sede_id', sedeId)
      .order('fecha', { ascending: false });

    if (error) throw error;
    return (data || []) as unknown as Tables['sesiones_fono'][];
  },

  /**
   * Guardar una nueva sesión o actualizar una existente
   */
  async saveSesion(payload: Partial<Tables['sesiones_fono']>): Promise<Tables['sesiones_fono']> {
    const { data, error } = await supabase
      .from('sesiones_fono')
      .upsert(payload)
      .select(CAMPOS_SESION)
      .single();

    if (error) throw error;
    return data as unknown as Tables['sesiones_fono'];
  },

  /**
   * Eliminar una sesión
   */
  async deleteSesion(id: number): Promise<void> {
    const { error } = await supabase
      .from('sesiones_fono')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },
};
