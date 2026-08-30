import { supabase } from '../db/database';
import { exigirFilaAfectada, SIN_PERMISO } from './afectadas';
import { mapPrestamo, mapRecurso } from '../utils/mappers';
import { EstadoRecurso, Prestamo, Recurso } from '../types';

/**
 * PrestamoService
 * Equipos que se prestan y vuelven.
 *
 * Dos cosas no las decide el cliente:
 *   · La disponibilidad. `preparar_prestamo` bloquea la fila del recurso y
 *     rechaza el préstamo si está dado de baja o en mantención. Además, un
 *     índice único parcial garantiza un solo préstamo abierto por recurso: dos
 *     personas registrando a la vez no pueden prestar dos veces lo mismo.
 *   · El estado del recurso. Se sincroniza solo desde los préstamos, pero solo
 *     entre `disponible` y `prestado`. Si alguien marcó un equipo en
 *     `mantencion`, eso lo puso una persona a propósito y no se pisa.
 */

export const ETIQUETA_ESTADO_RECURSO: Record<EstadoRecurso, string> = {
  disponible: 'Disponible',
  prestado: 'Prestado',
  mantencion: 'En mantención',
  no_disponible: 'No disponible',
};

export interface NuevoRecurso {
  sedeId: string;
  nombre: string;
  tipo: string | null;
  descripcion: string | null;
  codigo: string | null;
  ubicacion: string | null;
}

export interface NuevoPrestamo {
  recursoId: number;
  prestadoA: string;
  fechaEntrega: string;
  fechaDevolucionEsperada: string;
  estadoAlEntregar: string | null;
  observaciones: string | null;
}

export const PrestamoService = {
  async getRecursos(sedeId: string): Promise<Recurso[]> {
    const { data, error } = await supabase
      .from('recursos')
      .select('*')
      .eq('sede_id', sedeId)
      .eq('activo', true)
      .order('nombre');

    if (error) throw error;
    return (data ?? []).map(mapRecurso);
  },

  /** Lo que está afuera ahora: atrasados primero. */
  async getPrestamosActivos(sedeId: string): Promise<Prestamo[]> {
    const { data, error } = await supabase
      .from('prestamos_vista')
      .select('*')
      .eq('sede_id', sedeId)
      .is('fecha_devolucion_real', null)
      .order('fecha_devolucion_esperada');

    if (error) throw error;
    return (data ?? []).map(mapPrestamo);
  },

  async getPrestamosDevueltos(sedeId: string, limite = 50): Promise<Prestamo[]> {
    const { data, error } = await supabase
      .from('prestamos_vista')
      .select('*')
      .eq('sede_id', sedeId)
      .not('fecha_devolucion_real', 'is', null)
      .order('fecha_devolucion_real', { ascending: false })
      .limit(limite);

    if (error) throw error;
    return (data ?? []).map(mapPrestamo);
  },

  /** Lo que tiene una persona en su poder. Se usa para el aviso propio. */
  async getMisPrestamos(perfilId: string): Promise<Prestamo[]> {
    const { data, error } = await supabase
      .from('prestamos_vista')
      .select('*')
      .eq('prestado_a', perfilId)
      .is('fecha_devolucion_real', null)
      .order('fecha_devolucion_esperada');

    if (error) throw error;
    return (data ?? []).map(mapPrestamo);
  },

  /** El historial de un equipo: por cuántas manos pasó. */
  async getHistorialRecurso(recursoId: number, limite = 20): Promise<Prestamo[]> {
    const { data, error } = await supabase
      .from('prestamos_vista')
      .select('*')
      .eq('recurso_id', recursoId)
      .order('fecha_entrega', { ascending: false })
      .limit(limite);

    if (error) throw error;
    return (data ?? []).map(mapPrestamo);
  },

  async crearRecurso(input: NuevoRecurso): Promise<number> {
    const { data, error } = await supabase
      .from('recursos')
      .insert({
        sede_id: input.sedeId,
        nombre: input.nombre.trim(),
        tipo: input.tipo?.trim() || null,
        descripcion: input.descripcion?.trim() || null,
        codigo: input.codigo?.trim() || null,
        ubicacion: input.ubicacion?.trim() || null,
      })
      .select('id')
      .single();

    if (error?.code === '23505') {
      throw new Error('Ya existe un recurso con ese código en esta sede');
    }
    if (error) throw error;
    return data.id as number;
  },

  async actualizarRecurso(id: number, cambios: Partial<Omit<NuevoRecurso, 'sedeId'>>): Promise<void> {
    const { data, error } = await supabase
      .from('recursos')
      .update({
        nombre: cambios.nombre?.trim(),
        tipo: cambios.tipo?.trim() || null,
        descripcion: cambios.descripcion?.trim() || null,
        codigo: cambios.codigo?.trim() || null,
        ubicacion: cambios.ubicacion?.trim() || null,
      })
      .eq('id', id)
      .select('id');

    if (error?.code === '23505') {
      throw new Error('Ya existe un recurso con ese código en esta sede');
    }
    if (error) throw error;
    exigirFilaAfectada(data, SIN_PERMISO);
  },

  /**
   * Sacar de circulación sin prestarlo: se fue a reparar, o se guardó.
   * El trigger que sincroniza desde los préstamos respeta estos dos estados.
   */
  async marcarEstado(id: number, estado: EstadoRecurso): Promise<void> {
    const { data, error } = await supabase
      .from('recursos').update({ estado }).eq('id', id).select('id');
    if (error) throw error;
    exigirFilaAfectada(data, SIN_PERMISO);
  },

  /** Baja lógica: el equipo sale del listado pero su historial queda. */
  async darDeBaja(id: number): Promise<void> {
    const { data, error } = await supabase
      .from('recursos')
      .update({ activo: false, estado: 'no_disponible' })
      .eq('id', id)
      .select('id');

    if (error) throw error;
    exigirFilaAfectada(data, SIN_PERMISO);
  },

  /** La sede la pone la base desde el recurso: no se manda desde acá. */
  async prestar(input: NuevoPrestamo): Promise<void> {
    const { error } = await supabase.from('recursos_prestamos').insert({
      recurso_id: input.recursoId,
      prestado_a: input.prestadoA,
      fecha_entrega: input.fechaEntrega,
      fecha_devolucion_esperada: input.fechaDevolucionEsperada,
      estado_al_entregar: input.estadoAlEntregar?.trim() || null,
      observaciones: input.observaciones?.trim() || null,
    });

    if (error) throw error;
  },

  /** Registrar la devolución. Quién la recibió lo pone el trigger. */
  async devolver(id: number, fecha: string, estadoAlDevolver: string | null): Promise<void> {
    const { data, error } = await supabase
      .from('recursos_prestamos')
      .update({
        fecha_devolucion_real: fecha,
        estado_al_devolver: estadoAlDevolver?.trim() || null,
      })
      .eq('id', id)
      .select('id');

    if (error) throw error;
    exigirFilaAfectada(data, 'No se pudo registrar la devolución: solo quien administra la bodega puede recibir un equipo.');
  },
};
