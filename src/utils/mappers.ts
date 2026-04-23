import { Estudiante, Asistencia, User, Tables } from '../types';

/**
 * Centralized data mappers for Supabase → Frontend transformations.
 * Enforces Type-Safety on incoming database records.
 */

// ─── Estudiantes ────────────────────────────────────────────────
export function mapEstudiante(d: Tables['estudiantes']): Estudiante {
  if (!d) return {} as Estudiante;
  return {
    ...d,
    apellidoPaterno: d.apellido_paterno,
    apellidoMaterno: d.apellido_materno,
    fechaNacimiento: d.fecha_nacimiento,
    pruebaInicial: d.prueba_inicial,
    nombreApoderado: d.nombre_apoderado,
    telefonoApoderado: d.telefono_apoderado,
    sedeId: d.sede_id,
  };
}

// ─── Asistencia ─────────────────────────────────────────────────
export function mapAsistencia(d: Tables['asistencia']): Asistencia {
  if (!d) return {} as Asistencia;
  return {
    ...d,
    estudianteId: d.estudiante_id,
    registradoPor: d.registrado_por || 'Desconocido',
    sedeId: d.sede_id,
  };
}

// ─── Sesiones Fonoaudiológicas ──────────────────────────────────
export function mapSesionFono(d: any, estudiantesMap: Record<number, Estudiante> = {}) {
  if (!d) return null;

  return {
    ...d,
    estudianteId: d.estudiante_id,
    fonoaudiologoId: d.fonoaudiologo_id,
    actividadRealizada: d.actividad_realizada,
    nivelFonetico: d.nivel_fonetico,
    nivelSemantico: d.nivel_semantico,
    nivelMorfosintactico: d.nivel_morfosintactico,
    nivelPragmatico: d.nivel_pragmatico,
    sedeId: d.sede_id,
    estudiante: d.estudiante_id ? estudiantesMap[d.estudiante_id] : null,
  };
}

// ─── Auditoría ──────────────────────────────────────────────────
export function mapAuditLog(d: any) {
  if (!d) return null;
  return {
    ...d,
    usuario: d.perfiles?.nombre || 'Sistema',
    entidadId: d.entidad_id,
    valorAnterior: d.valor_anterior,
    valorNuevo: d.valor_nuevo,
    timestamp: d.created_at,
    sedeId: d.sede_id,
  };
}

// ─── Perfiles ───────────────────────────────────────────────────
export function mapPerfil(d: Tables['perfiles']): User {
  if (!d) return {} as User;
  return {
    id: d.id,
    nombre: d.nombre,
    email: d.email,
    rol: d.rol,
    activo: d.activo,
    sedeId: d.sede_id || undefined,
  };
}

// ─── Helpers ────────────────────────────────────────────────────

/**
 * Build a lookup map from an array: { [item.id]: item }
 */
export function buildIdMap<T extends { id: string | number }>(items: T[]): Record<string | number, T> {
  return Object.fromEntries((items || []).map(item => [item.id, item]));
}
