import { describe, expect, it } from 'vitest';
import { descripcionCaja, lineasPedido, nombreUnidad, unidadesBase } from './presentaciones';

describe('presentaciones de bodega', () => {
  it('descuenta una caja de 12 y cinco sueltos como 17 lápices', () => {
    expect(unidadesBase(1, 5, 12)).toBe(17);
    expect(descripcionCaja(1, 12, 'lapiz')).toBe('1 caja de 12 lápices');
  });

  it('respeta las cajas de 14 sin asumir siempre 12', () => {
    expect(unidadesBase(1, 5, 14)).toBe(19);
    expect(nombreUnidad('lapiz', 1)).toBe('lápiz');
  });

  it('conserva cajas y sueltos como líneas distintas con la misma unidad de stock', () => {
    const lineas = lineasPedido(
      [{ id: 10, nombre: 'Lápiz mina', unidad: 'lapiz', unidadesPorCaja: 12 }],
      { 10: 5 }, { 10: 1 }
    );
    expect(lineas).toHaveLength(2);
    expect(lineas.map(l => l.cantidad)).toEqual([5, 12]);
    expect(lineas[1]).toMatchObject({ cantidadCajas: 1, unidadesPorCajaSolicitada: 12, unidad: 'lapiz' });
  });

  it('rechaza cantidades o equivalencias inválidas', () => {
    expect(() => unidadesBase(1, 0, null)).toThrow();
    expect(() => unidadesBase(0.5, 0, 12)).toThrow();
    expect(() => unidadesBase(0, -1, 12)).toThrow();
  });
});
