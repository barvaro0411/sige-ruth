/**
 * SIGE RUTH - Constantes Globales
 * Centraliza las opciones del sistema para facilitar cambios futuros.
 */

export const NIVELES = ['Medio Mayor', 'NT1', 'NT2'] as const;
export type Nivel = typeof NIVELES[number];

export const JORNADAS = ['Mañana', 'Tarde'] as const;
export type Jornada = typeof JORNADAS[number];

export const DIAGNOSTICOS = ['TEL Mixto', 'TEL Expresivo'] as const;
export type Diagnostico = typeof DIAGNOSTICOS[number];

export const ESTADOS_ASISTENCIA = {
  PRESENTE: 'P',
  AUSENTE: 'A',
  JUSTIFICADO: 'J'
} as const;

export const ROLES = {
  DIRECTOR: 'director',
  SECRETARIA: 'secretaria',
  DOCENTE: 'docente',
  FONOAUDIOLOGO: 'fonoaudiologo',
  JEFE_UTP: 'jefe_utp'
} as const;
