// School locations (sedes) configuration
export const SEDES = [
  {
    id: 'gambino',
    nombre: 'Sede Gambino',
    direccion: 'Avda. General Gambino 4613',
    comuna: 'Conchalí',
    region: 'Región Metropolitana',
    rbd: '10375-6',
    color: '#D4A853',
  },
  {
    id: 'vascongados',
    nombre: 'Sede Vascongados',
    direccion: 'Vascongados 4314',
    comuna: 'Conchalí',
    region: 'Región Metropolitana',
    rbd: '10375-6',
    color: '#3B82F6',
  },
];

export const SEDE_MAP = Object.fromEntries(SEDES.map(s => [s.id, s]));

export function getSedeLabel(sedeId) {
  return SEDE_MAP[sedeId]?.nombre || sedeId;
}

export function getSedeColor(sedeId) {
  return SEDE_MAP[sedeId]?.color || '#94A3B8';
}

// School-wide constants
export const SCHOOL = {
  nombre: 'Escuela de Lenguaje Ruth',
  rbd: '10375-6',
  capacidadTotal: 98, // per sede
  niveles: ['Medio Mayor', 'NT1', 'NT2'],
  jornadas: ['Mañana', 'Tarde'],
  diagnosticos: ['TEL Mixto', 'TEL Expresivo'],
};
