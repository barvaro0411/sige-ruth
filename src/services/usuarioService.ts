import { supabase } from '../db/database';
import { Tables } from '../types';

export type PerfilUsuario = Tables['perfiles'] & {
  perfiles_sedes: Array<Pick<Tables['perfiles_sedes'], 'sede_id'>>;
  sede_ids: string[];
};

export interface NuevoUsuario {
  nombre: string;
  email: string;
  password: string;
  rol: Tables['perfiles']['rol'];
  sede_ids: string[];
}

export interface ActualizarUsuario {
  nombre: string;
  rol: Tables['perfiles']['rol'];
  sede_ids: string[];
  activo: boolean;
}

export const UsuarioService = {
  async getAll(): Promise<PerfilUsuario[]> {
    const { data, error } = await supabase
      .from('perfiles')
      .select('*, perfiles_sedes(sede_id)')
      .order('activo', { ascending: false })
      .order('nombre', { ascending: true });

    if (error) throw error;
    return (data || []).map(perfil => ({
      ...perfil,
      perfiles_sedes: perfil.perfiles_sedes || [],
      sede_ids: (perfil.perfiles_sedes || []).map(
        (item: Pick<Tables['perfiles_sedes'], 'sede_id'>) => item.sede_id,
      ),
    }));
  },

  /**
   * Las personas a las que se les puede asignar algo: prestar un notebook,
   * derivar una reparación. Devuelve mi propio perfil, los roles transversales
   * y quienes comparten sede conmigo — el alcance lo resuelve la RLS de
   * `perfiles`, no un filtro escrito acá.
   */
  async getColegas(): Promise<Array<Pick<Tables['perfiles'], 'id' | 'nombre' | 'rol'>>> {
    const { data, error } = await supabase
      .from('perfiles')
      .select('id, nombre, rol')
      .eq('activo', true)
      .order('nombre');

    if (error) throw error;
    return data ?? [];
  },

  async create(payload: NuevoUsuario): Promise<void> {
    const { data, error } = await supabase.functions.invoke('admin-users', {
      body: { action: 'create', ...payload },
    });

    if (error) {
      let message = error.message;
      const context = 'context' in error ? error.context : null;
      if (context instanceof Response) {
        try {
          const responseBody = await context.clone().json();
          message = responseBody?.error || message;
        } catch {
          // Conserva el mensaje original cuando la respuesta no contiene JSON.
        }
      }
      throw new Error(message);
    }
    if (!data?.success) throw new Error(data?.error || 'No se pudo crear el usuario');
  },

  async update(id: string, payload: ActualizarUsuario): Promise<void> {
    const { error } = await supabase.rpc('update_user_profile', {
      target_id: id,
      target_nombre: payload.nombre.trim(),
      target_rol: payload.rol,
      target_sede_ids: payload.sede_ids,
      target_activo: payload.activo,
    });

    if (error) throw error;
  },
};
