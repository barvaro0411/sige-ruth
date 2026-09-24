import { supabase } from '../db/database';
import { mapEventoHistorial, mapSolicitudMaterial } from '../utils/mappers';
import {
  EstadoMaterial, EventoHistorial, PrioridadMaterial, SolicitudMaterial,
} from '../types';
import { exigirFilaAfectada, SIN_PERMISO } from './afectadas';

/**
 * MaterialService
 * Solicitudes de materiales: del borrador a la entrega.
 *
 * Los cambios de estado pasan sí o sí por las RPC de la base. El cliente nunca
 * envía `estado`, `revisada_por` ni fechas de resolución: un trigger los rechaza
 * si llegan en un update directo.
 */

const SELECT_LISTA =
  '*, solicitante:perfiles!solicitudes_materiales_solicitante_id_fkey(nombre), items:solicitudes_materiales_items(*)';

/** Estados que siguen requiriendo acción de alguien. */
export const ESTADOS_ABIERTOS: EstadoMaterial[] = [
  'pendiente', 'observada', 'aprobada', 'en_compra', 'compra_parcial', 'comprada',
  'preparando', 'entregada_parcial',
];

/** Lo que se entrega de una sola vez: un material y cuánto sale. */
export interface EntregaItem {
  itemId: number;
  cantidad: number;
}

export interface NuevaSolicitudMaterial {
  solicitanteId: string;
  sedeId: string;
  titulo: string;
  justificacion: string;
  cursoId: string | null;
  area: string | null;
  prioridad: PrioridadMaterial;
  fechaNecesidad: string | null;
}

export interface NuevoItem {
  nombre: string;
  cantidad: number;
  unidad: string;
  costoEstimado: number | null;
  /**
   * Producto de bodega, si lo que se pide está en el inventario. Al enlazarlo,
   * la entrega descuenta el stock sola.
   */
  itemId?: number | null;
  /** Solo en líneas pedidas como cajas. `cantidad` sigue en unidades base. */
  cantidadCajas?: number;
  unidadesPorCajaSolicitada?: number | null;
}

export const MaterialService = {
  async getMisSolicitudes(perfilId: string): Promise<SolicitudMaterial[]> {
    const { data, error } = await supabase
      .from('solicitudes_materiales')
      .select(SELECT_LISTA)
      .eq('solicitante_id', perfilId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []).map(mapSolicitudMaterial);
  },

  /** Bandeja de gestión: lo que espera revisión, compra o entrega en la sede. */
  async getBandejaSede(sedeId: string): Promise<SolicitudMaterial[]> {
    const { data, error } = await supabase
      .from('solicitudes_materiales')
      .select(SELECT_LISTA)
      .eq('sede_id', sedeId)
      .in('estado', ESTADOS_ABIERTOS)
      .order('prioridad', { ascending: false })
      .order('fecha_necesidad', { ascending: true, nullsFirst: false });

    if (error) throw error;
    return (data || []).map(mapSolicitudMaterial);
  },

  async getDetalle(id: number): Promise<SolicitudMaterial | null> {
    const { data, error } = await supabase
      .from('solicitudes_materiales')
      .select(SELECT_LISTA)
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    return data ? mapSolicitudMaterial(data) : null;
  },

  async getHistorial(id: number): Promise<EventoHistorial[]> {
    const { data, error } = await supabase
      .from('historial_solicitudes_materiales')
      .select('*')
      .eq('solicitud_id', id)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return (data || []).map(mapEventoHistorial);
  },

  async crearBorrador(input: NuevaSolicitudMaterial): Promise<number> {
    const { data, error } = await supabase
      .from('solicitudes_materiales')
      .insert({
        solicitante_id: input.solicitanteId,
        sede_id: input.sedeId,
        titulo: input.titulo.trim(),
        justificacion: input.justificacion.trim() || null,
        curso_id: input.cursoId,
        area: input.area,
        prioridad: input.prioridad,
        fecha_necesidad: input.fechaNecesidad,
      })
      .select('id')
      .single();

    if (error) throw error;
    return data.id as number;
  },

  async agregarItems(solicitudId: number, items: NuevoItem[]): Promise<void> {
    if (items.length === 0) return;
    const { error } = await supabase.from('solicitudes_materiales_items').insert(
      items.map(i => ({
        solicitud_id: solicitudId,
        nombre: i.nombre.trim(),
        cantidad: i.cantidad,
        unidad: i.unidad,
        costo_estimado: i.costoEstimado,
        item_id: i.itemId ?? null,
        cantidad_cajas: i.cantidadCajas ?? 0,
        unidades_por_caja_solicitada: i.unidadesPorCajaSolicitada ?? null,
      }))
    );
    if (error) throw error;
  },

  async eliminarItem(itemId: number): Promise<void> {
    const { data, error } = await supabase
      .from('solicitudes_materiales_items')
      .delete()
      .eq('id', itemId)
      .select('id');
    if (error) throw error;
    exigirFilaAfectada(data, SIN_PERMISO);
  },

  /**
   * Registro de la compra real, ítem por ítem.
   *
   * Lo que se pierde acá si la política filtra la fila es el costo de una
   * compra que sí ocurrió, así que el silencio no es una opción.
   */
  async registrarCompraItem(itemId: number, costoReal: number, cantidadComprada: number): Promise<void> {
    const { data, error } = await supabase
      .from('solicitudes_materiales_items')
      .update({ costo_real: costoReal, cantidad_comprada: cantidadComprada })
      .eq('id', itemId)
      .select('id');
    if (error) throw error;
    exigirFilaAfectada(data, SIN_PERMISO);
  },

  /**
   * Solo el propio borrador. `materiales_delete_borrador` ya filtra por estado,
   * así que el trigger `impedir_borrado_material` nunca llega a dispararse por
   * esta vía: la fila ajena simplemente no existe para quien la pide.
   */
  async eliminarBorrador(id: number): Promise<void> {
    const { data, error } = await supabase
      .from('solicitudes_materiales')
      .delete()
      .eq('id', id)
      .select('id');
    if (error) throw error;
    exigirFilaAfectada(data, 'No se pudo eliminar: solo se borra un borrador propio.');
  },

  // ── Transiciones de estado: todas por RPC ──────────────────────────────
  async enviar(id: number): Promise<void> {
    const { error } = await supabase.rpc('enviar_solicitud_material', { p_id: id });
    if (error) throw error;
  },

  async revisar(
    id: number,
    estado: 'aprobada' | 'rechazada' | 'observada',
    comentario: string,
    presupuesto: number | null
  ): Promise<void> {
    const { error } = await supabase.rpc('revisar_solicitud_material', {
      p_id: id,
      p_estado: estado,
      p_comentario: comentario.trim() || null,
      p_presupuesto: presupuesto,
    });
    if (error) throw error;
  },

  async actualizarCompra(
    id: number,
    estado: 'en_compra' | 'compra_parcial' | 'comprada',
    comentario: string
  ): Promise<void> {
    const { error } = await supabase.rpc('actualizar_compra_material', {
      p_id: id,
      p_estado: estado,
      p_comentario: comentario.trim() || null,
    });
    if (error) throw error;
  },

  async confirmarEntrega(id: number): Promise<void> {
    const { error } = await supabase.rpc('confirmar_entrega_material', { p_id: id });
    if (error) throw error;
  },

  /** Bodega avisa que está juntando el pedido. Paso opcional. */
  async preparar(id: number): Promise<void> {
    const { error } = await supabase.rpc('preparar_solicitud_material', { p_id: id });
    if (error) throw error;
  },

  /**
   * Entrega desde bodega. Descuenta el inventario de los materiales enlazados
   * a un producto, todo en una sola transacción: si falta stock de uno solo,
   * no se entrega nada.
   */
  async entregar(id: number, entregas: EntregaItem[]): Promise<void> {
    const { error } = await supabase.rpc('entregar_solicitud_material', {
      p_id: id,
      p_entregas: entregas.map(e => ({ item_id: e.itemId, cantidad: e.cantidad })),
    });
    if (error) throw error;
  },

  async cancelar(id: number, motivo: string): Promise<void> {
    const { error } = await supabase.rpc('cancelar_solicitud_material', {
      p_id: id,
      p_motivo: motivo.trim() || null,
    });
    if (error) throw error;
  },
};
