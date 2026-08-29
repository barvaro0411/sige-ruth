import { supabase } from '../db/database';
import { mapSaldoPermiso, mapSolicitudPermiso } from '../utils/mappers';
import { EstadoPermiso, JornadaPermiso, SaldoPermiso, SolicitudPermiso, TipoPermiso } from '../types';

/**
 * PermisoService
 * Solicitudes de días administrativos y permisos del personal.
 *
 * La RLS decide qué filas ve cada uno (las propias, o las de la sede si es
 * jefatura) y un trigger valida las transiciones de estado: aquí no se manda
 * ni `resuelta_por` ni `resuelta_en`, los pone la base.
 */

// perfiles tiene dos FK desde solicitudes_permiso, hay que desambiguar el join.
const SELECT_CON_SOLICITANTE =
  '*, solicitante:perfiles!solicitudes_permiso_solicitante_id_fkey(nombre)';

export interface NuevaSolicitud {
  solicitanteId: string;
  sedeId: string;
  tipo: TipoPermiso;
  fechaInicio: string;
  fechaFin: string;
  jornada: JornadaPermiso;
  motivo: string;
}

export const PermisoService = {
  async getMisSolicitudes(perfilId: string): Promise<SolicitudPermiso[]> {
    const { data, error } = await supabase
      .from('solicitudes_permiso')
      .select('*')
      .eq('solicitante_id', perfilId)
      .order('fecha_inicio', { ascending: false });

    if (error) throw error;
    return (data || []).map(mapSolicitudPermiso);
  },

  async getPorRevisarSede(sedeId: string): Promise<SolicitudPermiso[]> {
    const { data, error } = await supabase
      .from('solicitudes_permiso')
      .select(SELECT_CON_SOLICITANTE)
      .eq('sede_id', sedeId)
      .in('estado', ['pendiente', 'observada'])
      .order('fecha_inicio', { ascending: true });

    if (error) throw error;
    return (data || []).map(mapSolicitudPermiso);
  },

  /** Devuelve null si el director todavía no le asignó cupo para ese año. */
  async getSaldo(perfilId: string, anio: number): Promise<SaldoPermiso | null> {
    const { data, error } = await supabase
      .from('saldo_permisos_vista')
      .select('*')
      .eq('perfil_id', perfilId)
      .eq('anio', anio)
      .maybeSingle();

    if (error) throw error;
    return data ? mapSaldoPermiso(data) : null;
  },

  /** Vuelve a enviar una solicitud observada, ya corregida. */
  async reenviar(id: number): Promise<void> {
    const { error } = await supabase
      .from('solicitudes_permiso')
      .update({ estado: 'pendiente' as EstadoPermiso })
      .eq('id', id);

    if (error) throw error;
  },

  async crear(input: NuevaSolicitud): Promise<void> {
    // dias_habiles lo calcula el trigger, no se envía desde el cliente.
    const { error } = await supabase.from('solicitudes_permiso').insert({
      solicitante_id: input.solicitanteId,
      sede_id: input.sedeId,
      tipo: input.tipo,
      fecha_inicio: input.fechaInicio,
      fecha_fin: input.fechaFin,
      jornada: input.jornada,
      motivo: input.motivo.trim() || null,
    });

    // La restricción de exclusión de la base devuelve un mensaje ilegible.
    if (error?.code === '23P01') {
      throw new Error('Ya tienes una solicitud en esas mismas fechas');
    }
    if (error) throw error;
  },

  async cancelar(id: number): Promise<void> {
    const { error } = await supabase
      .from('solicitudes_permiso')
      .update({ estado: 'cancelada' as EstadoPermiso })
      .eq('id', id);

    if (error) throw error;
  },

  async resolver(
    id: number,
    estado: 'aprobada' | 'rechazada' | 'observada',
    comentario: string
  ): Promise<void> {
    const { error } = await supabase
      .from('solicitudes_permiso')
      .update({ estado, comentario_resolucion: comentario.trim() || null })
      .eq('id', id);

    if (error) throw error;
  },
};
