/**
 * Constantes de la escuela.
 *
 * Las sedes ya no viven acá: se leen de la tabla `sedes` a través de
 * `SedeContext` / `SedeService`. Tenerlas duplicadas en el código hacía que la
 * app mostrara algo distinto de lo que la RLS autorizaba en cuanto una sede
 * cambiaba de nombre, se agregaba o se daba de baja.
 */
export const SCHOOL = {
  nombre: 'Escuela de Lenguaje Ruth',
  rbd: '10375-6',
  capacidadTotal: 98, // por sede
  niveles: ['Medio Mayor', 'NT1', 'NT2'],
  jornadas: ['Mañana', 'Tarde'],
  diagnosticos: ['TEL Mixto', 'TEL Expresivo'],
};
