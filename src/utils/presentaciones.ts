/** El inventario y las entregas siempre se expresan en la unidad base. */
export function unidadesBase(cajas: number, sueltas: number, unidadesPorCaja: number | null): number {
  if (!Number.isInteger(cajas) || cajas < 0 || !Number.isInteger(sueltas) || sueltas < 0) {
    throw new Error('Las cajas y unidades sueltas deben ser cantidades enteras no negativas');
  }
  if (cajas > 0 && (!Number.isInteger(unidadesPorCaja) || (unidadesPorCaja ?? 0) < 2)) {
    throw new Error('Este producto no tiene definida su equivalencia por caja');
  }
  return cajas * (unidadesPorCaja ?? 0) + sueltas;
}

export function nombreUnidad(unidad: string, cantidad: number): string {
  if (unidad === 'lapiz') return cantidad === 1 ? 'lápiz' : 'lápices';
  if (unidad === 'unidad') return cantidad === 1 ? 'unidad' : 'unidades';
  if (unidad === 'caja') return cantidad === 1 ? 'caja' : 'cajas';
  if (unidad === 'set') return cantidad === 1 ? 'set' : 'sets';
  if (unidad === 'resma') return cantidad === 1 ? 'resma' : 'resmas';
  if (unidad === 'estuche') return cantidad === 1 ? 'estuche' : 'estuches';
  if (unidad === 'pack') return cantidad === 1 ? 'pack' : 'packs';
  return cantidad === 1 ? unidad : `${unidad}s`;
}

export function permiteFracciones(unidad: string): boolean {
  return unidad === 'litro' || unidad === 'kilo';
}

export function descripcionCaja(cajas: number, unidadesPorCaja: number, unidad: string): string {
  return `${cajas} ${cajas === 1 ? 'caja' : 'cajas'} de ${unidadesPorCaja} ${nombreUnidad(unidad, unidadesPorCaja)}`;
}

/** Dos presentaciones del mismo producto se guardan como dos líneas auditables. */
export function lineasPedido(
  productos: { id: number; nombre: string; unidad: string; unidadesPorCaja: number | null }[],
  sueltas: Record<number, number>,
  cajas: Record<number, number>
) {
  return productos.flatMap(p => {
    const unidadesPedidas = sueltas[p.id] ?? 0;
    const cajasPedidas = cajas[p.id] ?? 0;
    const lineas = [];
    if (unidadesPedidas > 0) lineas.push({
      nombre: p.nombre, cantidad: unidadesBase(0, unidadesPedidas, p.unidadesPorCaja),
      unidad: p.unidad, costoEstimado: null, itemId: p.id,
      cantidadCajas: 0, unidadesPorCajaSolicitada: null,
    });
    if (cajasPedidas > 0) lineas.push({
      nombre: p.nombre, cantidad: unidadesBase(cajasPedidas, 0, p.unidadesPorCaja),
      unidad: p.unidad, costoEstimado: null, itemId: p.id,
      cantidadCajas: cajasPedidas, unidadesPorCajaSolicitada: p.unidadesPorCaja,
    });
    return lineas;
  });
}
