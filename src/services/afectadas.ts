/**
 * Un `update` que la RLS filtra no falla.
 *
 * PostgREST devuelve `error: null` y cero filas afectadas, porque para
 * Postgres no pasó nada malo: la fila simplemente no era visible para esa
 * persona. Sin esta comprobación, la app muestra «guardado» sobre un cambio
 * que nunca ocurrió, que es la peor forma de fallar — la persona se va
 * convencida de que quedó registrado.
 *
 * Se usa junto con `.select('id')` en los updates cuya única barrera es la
 * política, sin un trigger que levante excepción por su cuenta.
 */
export function exigirFilaAfectada(filas: unknown[] | null, mensaje: string): void {
  if (!filas || filas.length === 0) throw new Error(mensaje);
}

/** El mensaje de siempre, para no repetirlo en cada llamada. */
export const SIN_PERMISO = 'No se pudo guardar: no tienes permiso sobre este registro, o ya no está disponible.';
