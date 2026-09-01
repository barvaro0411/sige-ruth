import { supabase } from '../db/database';
import { mapEstudiante, mapEstudianteResumen } from '../utils/mappers';
import { Estudiante, EstudianteResumen, Tables } from '../types';
import { exigirFilaAfectada, SIN_PERMISO } from './afectadas';

const CAMPOS_RESUMEN = 'id,rut,nombre,apellido_paterno,apellido_materno,nivel,jornada,activo,sede_id,curso_id';
const CAMPOS_DETALLE = 'id,rut,nombre,apellido_paterno,apellido_materno,nivel,jornada,activo,sede_id,curso_id,fecha_nacimiento,diagnostico,anamnesis,prueba_inicial,nombre_apoderado,telefono_apoderado,created_at';

/**
 * EstudianteService
 * Encapsula todas las operaciones de base de datos para los alumnos.
 */
export const EstudianteService = {
  /**
   * Obtener todos los estudiantes activos de una sede
   */
  async getAllBySede(sedeId: string): Promise<EstudianteResumen[]> {
    const { data, error } = await supabase
      .from('estudiantes')
      .select(CAMPOS_RESUMEN)
      .eq('sede_id', sedeId)
      .eq('activo', true);

    if (error) throw error;
    return (data || []).map(mapEstudianteResumen);
  },

  /** Carga datos sensibles solo cuando una acción concreta los necesita. */
  async getById(id: number): Promise<Estudiante> {
    const { data, error } = await supabase
      .from('estudiantes')
      .select(CAMPOS_DETALLE)
      .eq('id', id)
      .single();

    if (error) throw error;
    return mapEstudiante(data);
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
      .select(CAMPOS_DETALLE)
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

    const { data, error } = await supabase
      .from('estudiantes')
      .update(cleanPayload)
      .eq('id', id)
      .select('id');

    if (error) throw error;
    exigirFilaAfectada(data, SIN_PERMISO);
  },

  /**
   * Desactivar un estudiante (Eliminación lógica)
   */
  async deactivate(id: number): Promise<void> {
    const { data, error } = await supabase
      .from('estudiantes')
      .update({ activo: false })
      .eq('id', id)
      .select('id');

    if (error) throw error;
    exigirFilaAfectada(data, SIN_PERMISO);
  }
};
