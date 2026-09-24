import { supabase } from '../db/database';
import {
  CategoriaInventario, MovimientoInventario, ProductoInventario,
  TipoMovimiento, UnidadInventario,
} from '../types';
import { exigirFilaAfectada, SIN_PERMISO } from './afectadas';

/**
 * InventarioService
 * Productos, stock y movimientos.
 *
 * El stock nunca se envía desde acá: se registra un movimiento y la base lo
 * recalcula. Un trigger rechaza cualquier intento de escribir `stock_actual`
 * directamente, así que no hay forma de que el número y el historial digan
 * cosas distintas.
 */

/** Movimientos que suman. El resto resta, salvo el ajuste, que va a ambos lados. */
export const MOVIMIENTOS_QUE_SUMAN: TipoMovimiento[] = ['ingreso', 'compra', 'devolucion'];

export const ETIQUETA_MOVIMIENTO: Record<TipoMovimiento, string> = {
  ingreso: 'Ingreso',
  compra: 'Compra',
  devolucion: 'Devolución',
  entrega: 'Entrega',
  baja: 'Baja',
  ajuste: 'Ajuste',
};

function mapProducto(d: any): ProductoInventario {
  return {
    id: d.id,
    sedeId: d.sede_id,
    compartido: d.compartido,
    categoriaId: d.categoria_id,
    categoria: d.categoria,
    nombre: d.nombre,
    descripcion: d.descripcion,
    unidad: d.unidad,
    unidadNombre: d.unidad_nombre,
    stockActual: Number(d.stock_actual),
    stockMinimo: Number(d.stock_minimo),
    ubicacion: d.ubicacion,
    activo: d.activo,
    estadoStock: d.estado_stock,
    faltante: Number(d.faltante),
  };
}

function mapMovimiento(d: any): MovimientoInventario {
  return {
    id: d.id,
    itemId: d.item_id,
    tipo: d.tipo,
    cantidad: Number(d.cantidad),
    motivo: d.motivo,
    observaciones: d.observaciones,
    solicitudId: d.solicitud_id,
    actorNombre: d.actor?.nombre ?? null,
    createdAt: d.created_at,
  };
}

export interface NuevoProducto {
  sedeId: string;
  categoriaId: number;
  nombre: string;
  descripcion: string | null;
  unidad: string;
  stockMinimo: number;
  ubicacion: string | null;
}

export interface NuevoMovimiento {
  itemId: number;
  tipo: TipoMovimiento;
  /** Siempre positiva: el signo lo pone el tipo. */
  cantidad: number;
  motivo: string;
  observaciones?: string | null;
}

export const InventarioService = {
  async getProductos(sedeId: string): Promise<ProductoInventario[]> {
    const { data, error } = await supabase
      .from('inventario_estado_vista')
      .select('*')
      .or(`sede_id.eq.${sedeId},compartido.eq.true`)
      .eq('activo', true)
      .order('nombre');

    if (error) throw error;
    return (data ?? []).map(mapProducto);
  },

  /** Lo que hay que comprar: agotados primero, después los que van bajo mínimo. */
  async getBajoStock(sedeId: string): Promise<ProductoInventario[]> {
    const { data, error } = await supabase
      .from('inventario_estado_vista')
      .select('*')
      .or(`sede_id.eq.${sedeId},compartido.eq.true`)
      .eq('activo', true)
      .in('estado_stock', ['agotado', 'bajo'])
      .order('estado_stock')
      .order('faltante', { ascending: false });

    if (error) throw error;
    return (data ?? []).map(mapProducto);
  },

  async getCategorias(): Promise<CategoriaInventario[]> {
    const { data, error } = await supabase
      .from('inventario_categorias')
      .select('id, nombre, activo')
      .eq('activo', true)
      .order('nombre');

    if (error) throw error;
    return data ?? [];
  },

  async getUnidades(): Promise<UnidadInventario[]> {
    const { data, error } = await supabase
      .from('inventario_unidades')
      .select('codigo, nombre')
      .eq('activo', true)
      .order('nombre');

    if (error) throw error;
    return data ?? [];
  },

  async getMovimientos(itemId: number, limite = 50): Promise<MovimientoInventario[]> {
    const { data, error } = await supabase
      .from('inventario_movimientos')
      .select('*, actor:perfiles(nombre)')
      .eq('item_id', itemId)
      .order('created_at', { ascending: false })
      .limit(limite);

    if (error) throw error;
    return (data ?? []).map(mapMovimiento);
  },

  async crearProducto(input: NuevoProducto): Promise<number> {
    const { data, error } = await supabase
      .from('inventario_items')
      .insert({
        sede_id: input.sedeId,
        categoria_id: input.categoriaId,
        nombre: input.nombre.trim(),
        descripcion: input.descripcion?.trim() || null,
        unidad: input.unidad,
        stock_minimo: input.stockMinimo,
        ubicacion: input.ubicacion?.trim() || null,
      })
      .select('id')
      .single();

    // El índice único por sede devuelve un mensaje que no le dice nada a nadie.
    if (error?.code === '23505') {
      throw new Error('Ya existe un producto con ese nombre en esta sede');
    }
    if (error) throw error;
    return data.id as number;
  },

  /** Solo los datos del producto. El stock va por movimientos. */
  async actualizarProducto(
    id: number,
    cambios: Partial<Omit<NuevoProducto, 'sedeId'>>
  ): Promise<void> {
    // `items_manage_bodega` exige `gestiona_bodega()`, y ningún trigger levanta
    // excepción por cambiar el nombre: sin esta comprobación, quien no tiene el
    // rol ve «guardado» sobre un cambio que la política descartó.
    const { data, error } = await supabase
      .from('inventario_items')
      .update({
        categoria_id: cambios.categoriaId,
        nombre: cambios.nombre?.trim(),
        descripcion: cambios.descripcion?.trim() || null,
        unidad: cambios.unidad,
        stock_minimo: cambios.stockMinimo,
        ubicacion: cambios.ubicacion?.trim() || null,
      })
      .eq('id', id)
      .select('id');

    if (error?.code === '23505') {
      throw new Error('Ya existe un producto con ese nombre en esta sede');
    }
    if (error) throw error;
    exigirFilaAfectada(data, SIN_PERMISO);
  },

  /** Baja lógica: el producto sale de las listas pero su historial queda. */
  async darDeBaja(id: number): Promise<void> {
    const { data, error } = await supabase
      .from('inventario_items')
      .update({ activo: false, archived_at: new Date().toISOString() })
      .eq('id', id)
      .select('id');

    if (error) throw error;
    exigirFilaAfectada(data, SIN_PERMISO);
  },

  async registrarMovimiento(input: NuevoMovimiento): Promise<void> {
    const magnitud = Math.abs(input.cantidad);
    const cantidad = MOVIMIENTOS_QUE_SUMAN.includes(input.tipo) ? magnitud : -magnitud;

    const { error } = await supabase.from('inventario_movimientos').insert({
      item_id: input.itemId,
      tipo: input.tipo,
      cantidad,
      motivo: input.motivo.trim() || null,
      observaciones: input.observaciones?.trim() || null,
    });

    if (error) throw error;
  },

  /**
   * Ajuste con destino: la persona dice cuánto hay de verdad y la base calcula
   * la diferencia. Contar es más fácil que restar.
   */
  async ajustarA(itemId: number, stockContado: number, stockActual: number, motivo: string): Promise<void> {
    const diferencia = stockContado - stockActual;
    if (diferencia === 0) return;

    const { error } = await supabase.from('inventario_movimientos').insert({
      item_id: itemId,
      tipo: 'ajuste',
      cantidad: diferencia,
      motivo: motivo.trim() || 'Ajuste por conteo físico',
    });

    if (error) throw error;
  },

  /**
   * Lo que esta persona pide habitualmente, por su rol o por su nombre.
   * La vista resuelve el alcance en la base: acá no se arma ningún filtro.
   */
  async getMisFrecuentes(sedeId: string): Promise<ProductoInventario[]> {
    const { data, error } = await supabase
      .from('mis_productos_frecuentes_vista')
      .select('*')
      .or(`sede_id.eq.${sedeId},compartido.eq.true`)
      .eq('activo', true)
      .order('orden')
      .order('nombre');

    if (error) throw error;
    return (data ?? []).map(mapProducto);
  },

  /** Qué roles tienen marcado este producto como frecuente. */
  async getRolesFrecuentes(itemId: number): Promise<string[]> {
    const { data, error } = await supabase
      .from('productos_frecuentes')
      .select('rol')
      .eq('item_id', itemId)
      .not('rol', 'is', null);

    if (error) throw error;
    return (data ?? []).map(f => f.rol as string);
  },

  /** Sincroniza los roles para los que este producto es frecuente. */
  async setRolesFrecuentes(itemId: number, roles: string[]): Promise<void> {
    const actuales = await this.getRolesFrecuentes(itemId);
    const quitar = actuales.filter(r => !roles.includes(r));
    const agregar = roles.filter(r => !actuales.includes(r));

    if (quitar.length > 0) {
      const { error } = await supabase
        .from('productos_frecuentes')
        .delete()
        .eq('item_id', itemId)
        .in('rol', quitar);
      if (error) throw error;
    }

    if (agregar.length > 0) {
      const { error } = await supabase
        .from('productos_frecuentes')
        .insert(agregar.map(rol => ({ item_id: itemId, rol })));
      if (error) throw error;
    }
  },

  /** Reconstruye el stock desde los movimientos. Devuelve cuántos estaban mal. */
  async recalcularStock(itemId?: number): Promise<number> {
    const { data, error } = await supabase.rpc('recalcular_stock', {
      p_item_id: itemId ?? null,
    });

    if (error) throw error;
    return (data as number) ?? 0;
  },
};
