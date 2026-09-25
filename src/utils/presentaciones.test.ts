import { describe, expect, it } from 'vitest';
import { descripcionCaja, lineasPedido, nombreUnidad, unidadesBase, validarCantidadEntrega } from './presentaciones';

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

  it('valida entregas parciales en cajas completas y unidades sueltas', () => {
    expect(validarCantidadEntrega('1', 24, 'lapiz', 12)).toBeNull();
    expect(validarCantidadEntrega('0.5', 24, 'lapiz', 12)).toContain('completas');
    expect(validarCantidadEntrega('3', 24, 'lapiz', 12)).toContain('Solo faltan');
    expect(validarCantidadEntrega('5', 5, 'lapiz', null)).toBeNull();
    expect(validarCantidadEntrega('5.5', 12, 'lapiz', null)).toContain('unidades completas');
  });

  it('no permite valores negativos, infinitos ni más de dos decimales', () => {
    expect(validarCantidadEntrega('-1', 12, 'lapiz', null)).toContain('válida');
    expect(validarCantidadEntrega('Infinity', 12, 'lapiz', null)).toContain('válida');
    expect(validarCantidadEntrega('0.001', 2, 'litro', null)).toContain('dos decimales');
    expect(validarCantidadEntrega('0.29', 2, 'litro', null)).toBeNull();
    expect(validarCantidadEntrega('', 12, 'lapiz', null)).toBeNull();
  });
});
