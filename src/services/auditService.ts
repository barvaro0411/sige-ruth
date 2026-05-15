import { supabase } from '../db/database';
import { mapAuditLog } from '../utils/mappers';

/**
 * AuditService
 * Recupera los registros de actividad del sistema.
 */
export const AuditService = {
  async getAll(sedeId: string, page = 0, pageSize = 50) {
    const from = page * pageSize;
    const to = from + pageSize - 1;

    const { data, error, count } = await supabase
      .from('auditoria')
      .select('*, perfiles(nombre)', { count: 'exact' })
      .eq('sede_id', sedeId)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) throw error;
    return {
      rows: (data || []).map(mapAuditLog),
      count: count || 0
    };
  }
};
