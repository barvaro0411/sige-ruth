import { supabase } from '../db/database';
import { mapAuditLog } from '../utils/mappers';

/**
 * AuditService
 * Recupera los registros de actividad del sistema.
 */
export const AuditService = {
  async getAll(sedeId: string) {
    const { data, error } = await supabase
      .from('auditoria')
      .select('*, perfiles(nombre)')
      .eq('sede_id', sedeId)
      .order('created_at', { ascending: false })
      .limit(200);

    if (error) throw error;
    return (data || []).map(mapAuditLog);
  }
};
