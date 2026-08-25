import { supabase } from '../db/database';
import { mapEstudiante } from '../utils/mappers';
import { Estudiante, Tables } from '../types';

/**
 * EstudianteService
 * Encapsula todas las operaciones de base de datos para los alumnos.
 */
export const EstudianteService = {
  /**
   * Obtener todos los estudiantes activos de una sede
   */
  async getAllBySede(sedeId: string): Promise<Estudiante[]> {
    const { data, error } = await supabase
      .from('estudiantes')
      .select('*')
      .eq('sede_id', sedeId)
      .eq('activo', true);

    if (error) throw error;
    return (data || []).map(mapEstudiante);
  },

  /**
   * Crear un nuevo estudiante
   * Nota: La auditoría se realiza automáticamente vía Triggers en la DB.
   */
  async create(payload: Partial<Tables['estudiantes']>, sedeId: string): Promise<Estudiante> {
    const cleanPayload = {
      ...payload,
      rut: payload.rut?.replace(/\./g, '').replace(/-/g, '').toUpperCase(),
      sede_id: sedeId,
      activo: true
    };

    const { data, error } = await supabase
      .from('estudiantes')
      .insert([cleanPayload])
      .select()
      .single();

    if (error) throw error;
    return mapEstudiante(data);
  },

  /**
   * Actualizar un estudiante existente
   */
  async update(id: number, payload: Partial<Tables['estudiantes']>): Promise<void> {
    const cleanPayload = {
      ...payload,
      rut: payload.rut?.replace(/\./g, '').replace(/-/g, '').toUpperCase()
    };

    const { error } = await supabase
      .from('estudiantes')
      .update(cleanPayload)
      .eq('id', id);

    if (error) throw error;
  },

  /**
   * Desactivar un estudiante (Eliminación lógica)
   */
  async deactivate(id: number): Promise<void> {
    const { error } = await supabase
      .from('estudiantes')
      .update({ activo: false })
      .eq('id', id);

    if (error) throw error;
  }
};
