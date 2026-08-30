import { describe, it, expect } from 'vitest';
import {
  mapItemMaterial, mapSolicitudMaterial, mapPrestamo, mapPreventiva,
  mapCompraSugerida, mapPanelOperaciones, mapAdjunto,
} from './mappers';

/**
 * Los mappers son la frontera entre snake_case crudo de la base y los tipos de
 * la app. Postgres devuelve `numeric` como cadena para no perder precision: si
 * un mapper se olvida de convertirla, la app termina concatenando plata en vez
 * de sumarla.
 */
describe('numeros que llegan como cadena', () => {
  it('los costos se convierten a numero, no se dejan como texto', () => {
    const item = mapItemMaterial({
      id: 1, solicitud_id: 9, nombre: 'Resma', cantidad: '10',
      unidad: 'unidad', costo_estimado: '2990.00', costo_real: '3100.50',
      cantidad_comprada: '10', item_id: 4, cantidad_entregada: '3',
    });
    expect(item.costoEstimado).toBe(2990);
    expect(item.costoReal).toBe(3100.5);
    expect(typeof item.cantidad).toBe('number');
    expect(item.cantidad).toBe(10);
  });

  it('un costo nulo se mantiene nulo, no se vuelve cero', () => {
    // Cero es un precio; null es «todavia no se sabe». No son lo mismo.
    const item = mapItemMaterial({
      id: 1, solicitud_id: 9, nombre: 'x', cantidad: 1, unidad: 'unidad',
      costo_estimado: null, costo_real: null, cantidad_comprada: 0,
      item_id: null, cantidad_entregada: 0,
    });
    expect(item.costoEstimado).toBeNull();
    expect(item.costoReal).toBeNull();
  });

  it('lo pendiente es lo pedido menos lo entregado', () => {
    const item = mapItemMaterial({
      id: 1, solicitud_id: 9, nombre: 'x', cantidad: '10', unidad: 'unidad',
      costo_estimado: null, costo_real: null, cantidad_comprada: 0,
      item_id: null, cantidad_entregada: '4',
    });
    expect(item.pendiente).toBe(6);
  });

  it('lo pendiente nunca es negativo, aunque se entregue de mas', () => {
    const item = mapItemMaterial({
      id: 1, solicitud_id: 9, nombre: 'x', cantidad: '5', unidad: 'unidad',
      costo_estimado: null, costo_real: null, cantidad_comprada: 0,
      item_id: null, cantidad_entregada: '8',
    });
    expect(item.pendiente).toBe(0);
  });
});

describe('solicitud de materiales', () => {
  it('trae el nombre del solicitante del join, o null', () => {
    const con = mapSolicitudMaterial({
      id: 1, solicitante_id: 'u1', sede_id: 's', titulo: 't', estado: 'pendiente',
      solicitante: { nombre: 'Ana' }, items: [],
      costo_estimado_total: '0', costo_real_total: '0',
    });
    expect(con.solicitanteNombre).toBe('Ana');

    const sin = mapSolicitudMaterial({
      id: 1, solicitante_id: 'u1', sede_id: 's', titulo: 't', estado: 'pendiente',
      items: [], costo_estimado_total: '0', costo_real_total: '0',
    });
    expect(sin.solicitanteNombre).toBeNull();
  });

  it('sin items devuelve una lista vacia, no undefined', () => {
    const s = mapSolicitudMaterial({
      id: 1, solicitante_id: 'u1', sede_id: 's', titulo: 't', estado: 'pendiente',
      costo_estimado_total: '0', costo_real_total: '0',
    });
    expect(s.items).toEqual([]);
  });
});

describe('prestamos y preventivas', () => {
  it('los dias restantes son numero y admiten negativo', () => {
    const p = mapPrestamo({
      id: 1, recurso_id: 2, recurso: 'Notebook', codigo: null, tipo: null,
      sede_id: 's', prestado_a: 'u', prestado_a_nombre: 'Ana',
      fecha_entrega: '2026-08-01', fecha_devolucion_esperada: '2026-08-10',
      fecha_devolucion_real: null, estado_al_entregar: null,
      estado_al_devolver: null, observaciones: null,
      dias_restantes: '-3', situacion: 'atrasado',
    });
    expect(p.diasRestantes).toBe(-3);
    expect(p.situacion).toBe('atrasado');
  });

  it('la frecuencia de una preventiva es numero', () => {
    const p = mapPreventiva({
      id: 1, sede_id: 's', categoria_id: 2, categoria: 'Seguridad',
      nombre: 'Extintores', ubicacion: null, observaciones: null,
      frecuencia_dias: '180', fecha_inicio: '2026-01-01', ultima_fecha: null,
      proxima_fecha: '2026-06-30', responsable_id: null, responsable_nombre: null,
      activo: true, dias_restantes: '10', estado_preventiva: 'proxima',
    });
    expect(p.frecuenciaDias).toBe(180);
    expect(p.diasRestantes).toBe(10);
  });
});

describe('panel de operaciones', () => {
  it('todas las colas llegan como numero', () => {
    const p = mapPanelOperaciones({
      sede_id: 's', sede_nombre: 'Sede', materiales_por_revisar: '2',
      materiales_por_comprar: '0', materiales_por_entregar: '1',
      permisos_por_resolver: '3', productos_agotados: '4',
      productos_bajo_minimo: '5', mantenciones_abiertas: '6',
      mantenciones_urgentes: '1', mantenciones_por_cerrar: '0',
      preventivas_vencidas: '2', preventivas_proximas: '1', prestamos_atrasados: '7',
    });
    for (const [clave, valor] of Object.entries(p)) {
      if (clave === 'sedeId' || clave === 'sedeNombre') continue;
      expect(typeof valor, `${clave} deberia ser numero`).toBe('number');
    }
    expect(p.prestamosAtrasados).toBe(7);
  });

  it('la compra sugerida convierte todas sus cantidades', () => {
    const c = mapCompraSugerida({
      id: 1, sede_id: 's', categoria_id: 1, categoria: 'Aseo', nombre: 'Cloro',
      unidad: 'unidad', unidad_nombre: 'Unidad', ubicacion: null,
      stock_actual: '3.00', stock_minimo: '10.00', estado_stock: 'bajo',
      faltante: '7.00', consumo_90d: '27.00', consumo_mensual: '9.00',
      sugerido: '16.00', ultima_compra: null,
    });
    expect(c.stockActual).toBe(3);
    expect(c.faltante).toBe(7);
    expect(c.sugerido).toBe(16);
    expect(c.ultimaCompra).toBeNull();
  });
});

describe('adjuntos', () => {
  it('el tamano nulo no se vuelve cero', () => {
    const a = mapAdjunto({
      id: 'x', origen: 'mantencion', origen_id: 1, sede_id: 's',
      nombre_archivo: 'f.webp', ruta_archivo: 's/mantencion/1/f.webp',
      tipo_mime: 'image/webp', tamano_bytes: null, momento: 'antes',
      subido_por: 'u', created_at: '2026-08-29T00:00:00Z',
    });
    expect(a.tamanoBytes).toBeNull();
    expect(a.momento).toBe('antes');
  });
});
