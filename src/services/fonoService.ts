import { supabase } from '../db/database';
import { Tables } from '../types';
import { exigirFilaAfectada, SIN_PERMISO } from './afectadas';

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
    const { data, error } = await supabase
      .from('sesiones_fono')
      .delete()
      .eq('id', id)
      .select('id');

    if (error) throw error;
    exigirFilaAfectada(data, SIN_PERMISO);
  },

  /**
   * Deja constancia de que alguien abrió la ficha clínica de un estudiante.
   *
   * `audit_row_change()` registra quién escribe; esto registra quién mira. En
   * dato sensible de salud de un menor la consulta importa tanto como la
   * modificación, y Postgres no tiene disparador de SELECT.
   *
   * No interrumpe nada si falla: el registro es para la institución, y no
   * poder anotarlo no es motivo para dejar a la fonoaudióloga sin su ficha.
   * La RPC ignora las repeticiones dentro de la misma hora.
   */
  async registrarConsulta(estudianteId: number): Promise<void> {
    const { error } = await supabase.rpc('registrar_consulta_clinica', {
      p_estudiante_id: estudianteId,
    });
    if (error && import.meta.env.DEV) {
      console.warn('[FonoService] No se pudo registrar la consulta clínica:', error.message);
    }
  },
};
