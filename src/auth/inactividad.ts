/**
 * Plazo de inactividad de la sesión.
 *
 * El temporizador de `setTimeout` solo vive mientras la pestaña esté abierta.
 * Si la única marca es esa, cerrar la pestaña a las 15:00 y volver a las 19:00
 * reinicia el plazo y la sesión olvidada sigue viva — que es exactamente el
 * caso para el que se puso el cierre automático: el computador de secretaría
 * que alguien deja andando.
 *
 * Por eso la hora del último gesto se guarda. `localStorage` además hace que
 * dos pestañas de la misma persona compartan un solo reloj en vez de renovarse
 * el plazo entre ellas.
 */

export const PLAZO_INACTIVIDAD_MS = 30 * 60 * 1000;

const CLAVE = 'sige_ultima_actividad';
let ultimaEnMemoria: number | null = null;

/**
 * En modo privado o con el almacenamiento bloqueado, `localStorage` lanza al
 * escribir. Ahí se vuelve al comportamiento anterior —temporizador en memoria—
 * en vez de dejar a la persona sin poder entrar.
 */
function leer(): number | null {
  try {
    const crudo = localStorage.getItem(CLAVE);
    if (!crudo) return null;
    const marca = Number(crudo);
    return Number.isFinite(marca) ? marca : null;
  } catch {
    return ultimaEnMemoria;
  }
}

export function anotarActividad(ahora: number = Date.now()): void {
  ultimaEnMemoria = ahora;
  try {
    localStorage.setItem(CLAVE, String(ahora));
  } catch {
    // La copia en memoria mantiene el cierre por inactividad en esta pestaña.
  }
}

export function olvidarActividad(): void {
  ultimaEnMemoria = null;
  try {
    localStorage.removeItem(CLAVE);
  } catch {
    // Nada que limpiar si nunca se pudo escribir.
  }
}

/** Inicializa una sesión restaurada sin renovar una marca existente. */
export function iniciarControlDeInactividad(): void {
  if (leer() === null) anotarActividad();
}

/** Milisegundos que faltan para el cierre. Nunca menos de cero. */
export function restanteDeInactividad(ahora: number = Date.now()): number {
  const ultima = leer();
  if (ultima === null) return PLAZO_INACTIVIDAD_MS;
  return Math.max(0, Math.min(PLAZO_INACTIVIDAD_MS, ultima + PLAZO_INACTIVIDAD_MS - ahora));
}

export function sesionVencidaPorInactividad(ahora: number = Date.now()): boolean {
  const ultima = leer();
  // Sin marca previa no se asume abandono: puede ser el primer ingreso de esta
  // persona en este equipo, o un navegador que no deja escribir.
  if (ultima === null) return false;
  // Una marca en el futuro solo aparece si alguien movió el reloj del equipo.
  // Se trata como reciente: cerrar la sesión de golpe sería peor.
  if (ultima > ahora) return false;
  return ahora - ultima >= PLAZO_INACTIVIDAD_MS;
}
