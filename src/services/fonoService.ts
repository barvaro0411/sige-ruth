import { supabase } from '../db/database';
import { Tables } from '../types';

/**
 * FonoService
 * Gestiona las intervenciones fonoaudiológicas y el seguimiento de niveles.
 */
export const FonoService = {
  /**
   * Obtener todas las sesiones de una sede
   */
  async getSesionesBySede(sedeId: string) {
    const { data, error } = await supabase
      .from('sesiones_fono')
      .select('*')
      .eq('sede_id', sedeId)
      .order('fecha', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  /**
   * Guardar una nueva sesión o actualizar una existente
   * Nota: La auditoría se realiza automáticamente vía Triggers en la DB.
   */
  async saveSesion(payload: Partial<Tables['sesiones_fono']>) {
    const { data, error } = await supabase
      .from('sesiones_fono')
      .upsert(payload)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Eliminar una sesión
   */
  async deleteSesion(id: number) {
    const { error } = await supabase
      .from('sesiones_fono')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }
};
