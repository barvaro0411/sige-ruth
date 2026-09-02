/**
 * Las columnas `date` de Postgres llegan como "2026-08-29", sin hora. `new Date`
 * las interpreta como medianoche UTC, y Chile está detrás de UTC: al mostrarlas
 * salían corridas un día hacia atrás — un permiso que empezaba el 29 se leía
 * como el 28. Fijar el mediodía deja la fecha fuera del alcance de cualquier
 * desfase horario.
 *
 * Los timestamps completos (`created_at` y compañía) traen su propia zona y no
 * se tocan.
 */
const SOLO_FECHA = /^\d{4}-\d{2}-\d{2}$/;

function aFecha(date: Date | string | number): Date {
  if (typeof date === 'string' && SOLO_FECHA.test(date)) {
    return new Date(`${date}T12:00:00`);
  }
  return new Date(date);
}

export function formatDate(date: Date | string | number): string {
  const d = aFecha(date);
  return d.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function formatTime(date: Date | string | number): string {
  const d = new Date(date);
  return d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
}

export function formatDateTime(date: Date | string | number): string {
  return `${formatDate(date)} ${formatTime(date)}`;
}

export function getToday(): string {
  return new Date().toISOString().split('T')[0];
}

export function getMonthName(monthIndex: number): string {
  const months = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];
  return months[monthIndex] || '';
}
