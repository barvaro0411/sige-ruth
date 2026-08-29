import { supabase } from '../db/database';
import { Sede } from '../types';

/**
 * SedeService
 * Las sedes son datos, no constantes del código.
 *
 * Antes vivían escritas a mano en `config/sedes.js`, mientras la tabla `sedes`
 * era la que usaban todas las políticas RLS. Funcionaba por coincidencia: una
 * sede nueva, un cambio de dirección o una sede dada de baja producían una app
 * que mostraba algo distinto de lo que la base autorizaba.
 */
export const SedeService = {
  async getActivas(): Promise<Sede[]> {
    const { data, error } = await supabase
      .from('sedes')
      .select('id, nombre, direccion, comuna, region, rbd')
      .eq('activo', true)
      .order('nombre');

    if (error) throw error;
    return data ?? [];
  },
};
