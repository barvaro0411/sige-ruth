/**
 * Constantes del dominio.
 *
 * Solo lo que es realmente fijo. Las sedes no están acá: se leen de la tabla
 * `sedes` a través de `SedeContext` / `SedeService`. Tenerlas duplicadas en el
 * código hacía que la app mostrara algo distinto de lo que la RLS autorizaba en
 * cuanto una sede cambiaba de nombre, se agregaba o se daba de baja.
 *
 * Los roles tampoco: viven en `auth/permissions.js`, junto a los permisos que
 * les corresponden. Acá había una segunda copia que se quedó sin `sostenedor`,
 * `aseo`, `bodega` ni `mantencion` — nadie la importaba, pero estaba a un
 * autocompletado de distancia de usarse.
 */

export const SCHOOL = {
  nombre: 'Escuela de Lenguaje Ruth',
  rbd: '10375-6',
  capacidadTotal: 98, // por sede
};

export const NIVELES = ['Medio Mayor', 'NT1', 'NT2'] as const;
export type Nivel = typeof NIVELES[number];

export const JORNADAS = ['Mañana', 'Tarde'] as const;
export type Jornada = typeof JORNADAS[number];

export const DIAGNOSTICOS = ['TEL Mixto', 'TEL Expresivo'] as const;
