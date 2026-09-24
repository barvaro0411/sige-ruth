import { supabase } from '../db/database';
import { mapCompraSugerida, mapGastoMensual, mapPanelOperaciones } from '../utils/mappers';
import { CompraSugerida, GastoMensual, PanelOperaciones } from '../types';

/**
 * OperacionesService
 * Lo que necesita atención hoy, en qué se fue la plata y qué conviene comprar.
 *
 * Las tres vistas se calculan al vuelo desde las tablas de cada módulo. No hay
 * contadores guardados: un número que se escribe aparte es un número que puede
 * quedar mintiendo, y este panel existe justamente para que nadie tenga que
 * desconfiar de él.
 */

export const OperacionesService = {
  async getPanel(sedeId: string): Promise<PanelOperaciones | null> {
    const { data, error } = await supabase
      .from('panel_operaciones_vista')
      .select('*')
      .eq('sede_id', sedeId)
      .maybeSingle();

    if (error) throw error;
    return data ? mapPanelOperaciones(data) : null;
  },

  /**
   * El gasto de los últimos `meses` meses, desglosado por origen.
   * Se corta desde el primer día del mes de inicio para no partir un mes
   * por la mitad.
   */
  async getConsolidado(sedeId: string, meses = 12): Promise<GastoMensual[]> {
    const desde = new Date();
    desde.setDate(1);
    desde.setMonth(desde.getMonth() - (meses - 1));
    const corte = desde.toISOString().slice(0, 10);

    const { data, error } = await supabase
      .from('consolidado_mensual_vista')
      .select('*')
      .eq('sede_id', sedeId)
      .gte('mes', corte)
      .order('mes', { ascending: false });

    if (error) throw error;
    return (data ?? []).map(mapGastoMensual);
  },

  /** Lo que hay que comprar: agotados primero, después lo que va bajo mínimo. */
  async getListaCompra(sedeId: string): Promise<CompraSugerida[]> {
    const { data, error } = await supabase
      .from('lista_compra_sugerida_vista')
      .select('*')
      .or(`sede_id.eq.${sedeId},compartido.eq.true`)
      .order('estado_stock')
      .order('sugerido', { ascending: false });

    if (error) throw error;
    return (data ?? []).map(mapCompraSugerida);
  },
};
