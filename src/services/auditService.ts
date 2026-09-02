import { supabase } from '../db/database';
import { mapAuditLog } from '../utils/mappers';
import { AuditLogEntry } from '../types';

/**
 * AuditService
 * Recupera los registros de actividad del sistema.
 */
export const AuditService = {
  async getAll(sedeId: string): Promise<AuditLogEntry[]> {
    const { data, error } = await supabase
      .from('auditoria_vista')
      .select('id,accion,entidad,entidad_id,usuario_id,sede_id,created_at,valor_anterior,valor_nuevo,perfiles(nombre)')
      .eq('sede_id', sedeId)
      .order('created_at', { ascending: false })
      .limit(200);

    if (error) throw error;
    return (data || []).map(mapAuditLog).filter((entry): entry is AuditLogEntry => entry !== null);
  },
};
