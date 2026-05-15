import { supabase } from '../db/database';
import { Tables } from '../types';

export const CursoService = {
  async getBySede(sedeId: string): Promise<Tables['cursos'][]> {
    const { data, error } = await supabase
      .from('cursos')
      .select('id,nombre,nivel,profesor_jefe,sede_id,created_at')
      .eq('sede_id', sedeId)
      .order('nombre', { ascending: true });

    if (error) throw error;
    return data || [];
  }
};
