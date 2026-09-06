import { supabase } from '../db/database';
import { mapNotificacion } from '../utils/mappers';
import { Notificacion } from '../types';

/**
 * NotificacionService
 * Notificaciones internas. Las escribe la base desde las RPC del flujo:
 * el cliente solo lee las propias y las marca como leídas.
 */
export const NotificacionService = {
  async getRecientes(limite = 20): Promise<Notificacion[]> {
    const { data, error } = await supabase
      .from('notificaciones')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limite);

    if (error) throw error;
    return (data || []).map(mapNotificacion);
  },

  async contarNoLeidas(): Promise<number> {
    const { count, error } = await supabase
      .from('notificaciones')
      .select('id', { count: 'exact', head: true })
      .is('leida_en', null);

    if (error) throw error;
    return count ?? 0;
  },

  /**
   * Devuelve cuántas quedaron marcadas.
   *
   * Cero no siempre es un error acá: marcar una que ya estaba leída es un
   * no-op legítimo, y por eso esto informa en vez de lanzar. Quien llama
   * decide — la cabecera refresca el contador y sigue.
   */
  async marcarLeida(id: number): Promise<number> {
    const { data, error } = await supabase
      .from('notificaciones')
      .update({ leida_en: new Date().toISOString() })
      .eq('id', id)
      .is('leida_en', null)
      .select('id');
    if (error) throw error;
    return data?.length ?? 0;
  },

  async marcarTodasLeidas(): Promise<number> {
    const { data, error } = await supabase
      .from('notificaciones')
      .update({ leida_en: new Date().toISOString() })
      .is('leida_en', null)
      .select('id');
    if (error) throw error;
    return data?.length ?? 0;
  },
};
