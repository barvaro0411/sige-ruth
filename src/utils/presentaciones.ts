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

/** Valida la cantidad escrita antes de enviar una entrega a bodega. */
export function validarCantidadEntrega(
  valor: string,
  pendiente: number,
  unidad: string,
  unidadesPorCaja: number | null
): string | null {
  if (valor.trim() === '') return null;
  const cantidad = Number(valor);
  if (!Number.isFinite(cantidad) || cantidad < 0) return 'Escribe una cantidad válida, igual o mayor que cero.';
  if (unidadesPorCaja !== null && (!Number.isInteger(cantidad) || unidadesPorCaja < 2)) {
    return 'Las cajas se entregan completas.';
  }
  if (unidadesPorCaja === null && !permiteFracciones(unidad) && !Number.isInteger(cantidad)) {
    return `${nombreUnidad(unidad, 2)} se entregan en unidades completas.`;
  }
  if (permiteFracciones(unidad) && Math.abs(cantidad * 100 - Math.round(cantidad * 100)) > 1e-8) {
    return 'Usa como máximo dos decimales.';
  }
  const unidades = cantidad * (unidadesPorCaja ?? 1);
  if (unidades > pendiente) return `Solo faltan ${pendiente} ${nombreUnidad(unidad, pendiente)}.`;
  return null;
}

/** Vista previa de una salida suelta; la base ejecuta la misma regla bajo bloqueo. */
export function salidaUnidadesEmpaque(
  estado: { cajasCerradas: number; unidadesCajaAbierta: number; unidadesSueltas: number },
  unidadesPorCaja: number,
  cantidad: number
) {
  if (!Number.isInteger(cantidad) || cantidad < 0 || !Number.isInteger(unidadesPorCaja) || unidadesPorCaja < 2) {
    throw new Error('Cantidad o equivalencia inválida');
  }
  if (![estado.cajasCerradas, estado.unidadesCajaAbierta, estado.unidadesSueltas]
    .every(valor => Number.isInteger(valor) && valor >= 0)
    || estado.unidadesCajaAbierta >= unidadesPorCaja) {
    throw new Error('Desglose de cajas inválido');
  }
  let cajasCerradas = estado.cajasCerradas;
  let unidadesCajaAbierta = estado.unidadesCajaAbierta;
  let unidadesSueltas = estado.unidadesSueltas;
  let pendiente = cantidad;
  const deAbierta = Math.min(pendiente, unidadesCajaAbierta);
  unidadesCajaAbierta -= deAbierta;
  pendiente -= deAbierta;
  const deSueltas = Math.min(pendiente, unidadesSueltas);
  unidadesSueltas -= deSueltas;
  pendiente -= deSueltas;
  while (pendiente > 0 && cajasCerradas > 0) {
    cajasCerradas -= 1;
    const deCaja = Math.min(pendiente, unidadesPorCaja);
    unidadesCajaAbierta = unidadesPorCaja - deCaja;
    pendiente -= deCaja;
  }
  if (pendiente > 0) throw new Error('Stock insuficiente');
  return { cajasCerradas, unidadesCajaAbierta, unidadesSueltas };
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
