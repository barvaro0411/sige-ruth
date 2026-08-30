import { supabase } from '../db/database';
import { exigirFilaAfectada, SIN_PERMISO } from './afectadas';
import { mapEjecucionPreventiva, mapEventoHistorial, mapMantencion, mapPreventiva } from '../utils/mappers';
import {
  CategoriaMantencion, EjecucionPreventiva, EstadoMantencion, EventoHistorial,
  Mantencion, PrioridadMantencion, Preventiva,
} from '../types';

/**
 * MantencionService
 * Lo que se rompe (correctivas) y lo que hay que revisar antes de que se rompa
 * (preventivas).
 *
 * Acá no hay RPC: el flujo de mantenciones es más simple que el de materiales
 * y las reglas caben en dos triggers. `preparar_mantencion` pone el reportante
 * y el estado inicial; `enforce_mantencion_transicion` decide quién puede
 * mover qué. Por eso el cliente nunca manda `estado` al crear, ni
 * `resuelta_por`, ni fechas de resolución: los pone la base con `auth.uid()`
 * y `now()`.
 */

const SELECT_MANTENCION =
  '*, categoria:mantencion_categorias(nombre), '
  + 'reportante:perfiles!mantenciones_reportado_por_fkey(nombre), '
  + 'asignado:perfiles!mantenciones_asignado_a_fkey(nombre)';

/** Lo que todavía le ocupa tiempo a alguien. */
export const ESTADOS_ABIERTOS: EstadoMantencion[] = [
  'reportada', 'revisando', 'pendiente', 'cotizando', 'programada', 'en_reparacion', 'resuelta',
];

export const ETIQUETA_ESTADO: Record<EstadoMantencion, string> = {
  reportada: 'Reportada',
  revisando: 'En revisión',
  pendiente: 'Pendiente',
  cotizando: 'Cotizando',
  programada: 'Programada',
  en_reparacion: 'En reparación',
  resuelta: 'Resuelta',
  cerrada: 'Cerrada',
  cancelada: 'Cancelada',
};

export const ETIQUETA_PRIORIDAD: Record<PrioridadMantencion, string> = {
  baja: 'Baja',
  media: 'Media',
  alta: 'Alta',
  urgente: 'Urgente',
};

/**
 * Los estados a los que se puede pasar desde cada uno. `resuelta` y `cerrada`
 * no están acá porque tienen su propio método: exigen describir el trabajo y
 * pasan por validaciones distintas.
 */
export const SIGUIENTES_ESTADOS: Record<EstadoMantencion, EstadoMantencion[]> = {
  reportada:     ['revisando', 'pendiente', 'cotizando', 'programada', 'en_reparacion'],
  revisando:     ['pendiente', 'cotizando', 'programada', 'en_reparacion'],
  pendiente:     ['cotizando', 'programada', 'en_reparacion'],
  cotizando:     ['pendiente', 'programada', 'en_reparacion'],
  programada:    ['en_reparacion', 'pendiente'],
  en_reparacion: ['pendiente'],
  resuelta:      [],
  cerrada:       [],
  cancelada:     [],
};

export interface NuevaMantencion {
  sedeId: string;
  categoriaId: number;
  lugar: string;
  descripcion: string;
  prioridad: PrioridadMantencion;
}

/** Lo que la gestión puede ajustar sin cambiar el estado. */
export interface AjustesMantencion {
  categoriaId?: number;
  prioridad?: PrioridadMantencion;
  asignadoA?: string | null;
  fechaProgramada?: string | null;
  proveedor?: string | null;
  costo?: number | null;
}

export interface NuevaPreventiva {
  sedeId: string;
  categoriaId: number;
  nombre: string;
  ubicacion: string | null;
  observaciones: string | null;
  frecuenciaDias: number;
  fechaInicio: string;
  responsableId: string | null;
}

export interface NuevaEjecucion {
  preventivaId: number;
  fecha: string;
  proveedor: string | null;
  costo: number | null;
  observaciones: string | null;
}

export const MantencionService = {
  // ── Correctivas ────────────────────────────────────────────────────────
  async getCategorias(): Promise<CategoriaMantencion[]> {
    const { data, error } = await supabase
      .from('mantencion_categorias')
      .select('id, nombre, activo')
      .eq('activo', true)
      .order('nombre');

    if (error) throw error;
    return data ?? [];
  },

  /** La bandeja de la sede: lo abierto primero, lo urgente arriba. */
  async getAbiertas(sedeId: string): Promise<Mantencion[]> {
    const { data, error } = await supabase
      .from('mantenciones')
      .select(SELECT_MANTENCION)
      .eq('sede_id', sedeId)
      .in('estado', ESTADOS_ABIERTOS)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data ?? []).map(mapMantencion);
  },

  /** El historial completo de la sede, para consultar lo que ya pasó. */
  async getCerradas(sedeId: string, limite = 50): Promise<Mantencion[]> {
    const { data, error } = await supabase
      .from('mantenciones')
      .select(SELECT_MANTENCION)
      .eq('sede_id', sedeId)
      .in('estado', ['cerrada', 'cancelada'])
      .order('created_at', { ascending: false })
      .limit(limite);

    if (error) throw error;
    return (data ?? []).map(mapMantencion);
  },

  /** Lo que reportó esta persona, en cualquier estado. */
  async getMisReportes(perfilId: string): Promise<Mantencion[]> {
    const { data, error } = await supabase
      .from('mantenciones')
      .select(SELECT_MANTENCION)
      .eq('reportado_por', perfilId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data ?? []).map(mapMantencion);
  },

  async getDetalle(id: number): Promise<Mantencion | null> {
    const { data, error } = await supabase
      .from('mantenciones')
      .select(SELECT_MANTENCION)
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    return data ? mapMantencion(data) : null;
  },

  async getHistorial(id: number): Promise<EventoHistorial[]> {
    const { data, error } = await supabase
      .from('mantenciones_historial')
      .select('*')
      .eq('mantencion_id', id)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return (data ?? []).map(mapEventoHistorial);
  },

  /**
   * Reportar. No se manda estado ni reportante: los pone el trigger con
   * `auth.uid()`, así que nadie puede reportar a nombre de otra persona.
   */
  async reportar(input: NuevaMantencion): Promise<number> {
    const { data, error } = await supabase
      .from('mantenciones')
      .insert({
        sede_id: input.sedeId,
        categoria_id: input.categoriaId,
        lugar: input.lugar.trim(),
        descripcion: input.descripcion.trim(),
        prioridad: input.prioridad,
      })
      .select('id')
      .single();

    if (error) throw error;
    return data.id as number;
  },

  async cambiarEstado(id: number, estado: EstadoMantencion): Promise<void> {
    const { data, error } = await supabase
      .from('mantenciones')
      .update({ estado })
      .eq('id', id)
      .select('id');

    if (error) throw error;
    exigirFilaAfectada(data, SIN_PERMISO);
  },

  /**
   * Resolver: hay que decir qué se hizo. El costo es opcional porque no toda
   * reparación cuesta plata — apretar una llave no tiene boleta.
   */
  async resolver(id: number, trabajoRealizado: string, costo: number | null, proveedor: string | null): Promise<void> {
    const texto = trabajoRealizado.trim();
    if (!texto) throw new Error('Para resolver hay que describir qué se hizo');

    const { data, error } = await supabase
      .from('mantenciones')
      .update({
        estado: 'resuelta',
        trabajo_realizado: texto,
        costo,
        proveedor: proveedor?.trim() || null,
      })
      .eq('id', id)
      .select('id');

    if (error) throw error;
    exigirFilaAfectada(data, SIN_PERMISO);
  },

  /** Cerrar: el trabajo está hecho y el costo registrado. Ya no se toca más. */
  async cerrar(id: number): Promise<void> {
    const { data, error } = await supabase
      .from('mantenciones')
      .update({ estado: 'cerrada' })
      .eq('id', id)
      .select('id');

    if (error) throw error;
    exigirFilaAfectada(data, SIN_PERMISO);
  },

  /** No se borra: se cancela y queda el registro de que se reportó. */
  async cancelar(id: number): Promise<void> {
    const { data, error } = await supabase
      .from('mantenciones')
      .update({ estado: 'cancelada' })
      .eq('id', id)
      .select('id');

    if (error) throw error;
    exigirFilaAfectada(data, SIN_PERMISO);
  },

  async ajustar(id: number, cambios: AjustesMantencion): Promise<void> {
    const { data, error } = await supabase
      .from('mantenciones')
      .update({
        categoria_id: cambios.categoriaId,
        prioridad: cambios.prioridad,
        asignado_a: cambios.asignadoA,
        fecha_programada: cambios.fechaProgramada,
        proveedor: cambios.proveedor,
        costo: cambios.costo,
      })
      .eq('id', id)
      .select('id');

    if (error) throw error;
    exigirFilaAfectada(data, SIN_PERMISO);
  },

  // ── Preventivas ────────────────────────────────────────────────────────
  /** Vencidas primero, después las que se acercan. */
  async getPreventivas(sedeId: string): Promise<Preventiva[]> {
    const { data, error } = await supabase
      .from('preventivas_estado_vista')
      .select('*')
      .eq('sede_id', sedeId)
      .eq('activo', true)
      .order('proxima_fecha');

    if (error) throw error;
    return (data ?? []).map(mapPreventiva);
  },

  async getEjecuciones(preventivaId: number): Promise<EjecucionPreventiva[]> {
    const { data, error } = await supabase
      .from('preventivas_ejecuciones')
      .select('*, responsable:perfiles(nombre)')
      .eq('preventiva_id', preventivaId)
      .order('fecha', { ascending: false });

    if (error) throw error;
    return (data ?? []).map(mapEjecucionPreventiva);
  },

  async crearPreventiva(input: NuevaPreventiva): Promise<number> {
    const { data, error } = await supabase
      .from('mantenciones_preventivas')
      .insert({
        sede_id: input.sedeId,
        categoria_id: input.categoriaId,
        nombre: input.nombre.trim(),
        ubicacion: input.ubicacion?.trim() || null,
        observaciones: input.observaciones?.trim() || null,
        frecuencia_dias: input.frecuenciaDias,
        fecha_inicio: input.fechaInicio,
        responsable_id: input.responsableId,
      })
      .select('id')
      .single();

    if (error) throw error;
    return data.id as number;
  },

  async actualizarPreventiva(id: number, cambios: Partial<Omit<NuevaPreventiva, 'sedeId'>>): Promise<void> {
    const { data, error } = await supabase
      .from('mantenciones_preventivas')
      .update({
        categoria_id: cambios.categoriaId,
        nombre: cambios.nombre?.trim(),
        ubicacion: cambios.ubicacion?.trim() || null,
        observaciones: cambios.observaciones?.trim() || null,
        frecuencia_dias: cambios.frecuenciaDias,
        fecha_inicio: cambios.fechaInicio,
        responsable_id: cambios.responsableId,
      })
      .eq('id', id)
      .select('id');

    if (error) throw error;
    exigirFilaAfectada(data, SIN_PERMISO);
  },

  /** Baja lógica: la rutina sale del listado pero sus ejecuciones quedan. */
  async desactivarPreventiva(id: number): Promise<void> {
    const { data, error } = await supabase
      .from('mantenciones_preventivas')
      .update({ activo: false })
      .eq('id', id)
      .select('id');

    if (error) throw error;
    exigirFilaAfectada(data, SIN_PERMISO);
  },

  /**
   * Marcar hecha. `ultima_fecha` la recalcula un trigger desde el máximo de
   * las ejecuciones, y `proxima_fecha` es una columna generada: nadie escribe
   * el vencimiento a mano, así que no puede quedar desfasado del historial.
   */
  async registrarEjecucion(input: NuevaEjecucion): Promise<void> {
    const { error } = await supabase.from('preventivas_ejecuciones').insert({
      preventiva_id: input.preventivaId,
      fecha: input.fecha,
      proveedor: input.proveedor?.trim() || null,
      costo: input.costo,
      observaciones: input.observaciones?.trim() || null,
    });

    if (error) throw error;
  },
};
