import {
  Estudiante, Asistencia, User, Tables, SolicitudPermiso, SaldoPermiso,
  SolicitudMaterial, ItemMaterial, EventoHistorial, Notificacion,
} from '../types';

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
export function mapPerfil(d: Tables['perfiles'] & { perfiles_sedes?: Array<{ sede_id: string }> }): User {
  if (!d) return {} as User;
  const sedeIds = d.perfiles_sedes?.map(item => item.sede_id)
    || (d.sede_id ? [d.sede_id] : []);
  return {
    id: d.id,
    nombre: d.nombre,
    email: d.email,
    rol: d.rol,
    activo: d.activo,
    sedeId: d.sede_id || undefined,
    sedeIds,
  };
}

// ─── Helpers ────────────────────────────────────────────────────

/**
 * Build a lookup map from an array: { [item.id]: item }
 */
export function buildIdMap<T extends { id: string | number }>(items: T[]): Record<string | number, T> {
  return Object.fromEntries((items || []).map(item => [item.id, item]));
}

// ─── Permisos ───────────────────────────────────────────────────
export function mapSolicitudPermiso(d: any): SolicitudPermiso {
  if (!d) return {} as SolicitudPermiso;
  return {
    ...d,
    solicitanteId: d.solicitante_id,
    solicitanteNombre: d.solicitante?.nombre ?? null,
    sedeId: d.sede_id,
    fechaInicio: d.fecha_inicio,
    fechaFin: d.fecha_fin,
    diasHabiles: Number(d.dias_habiles),
    resueltaPor: d.resuelta_por,
    resueltaEn: d.resuelta_en,
    comentarioResolucion: d.comentario_resolucion,
  };
}

export function mapSaldoPermiso(d: any): SaldoPermiso {
  if (!d) return {} as SaldoPermiso;
  return {
    perfilId: d.perfil_id,
    anio: d.anio,
    asignados: Number(d.asignados),
    usados: Number(d.usados),
    disponibles: Number(d.disponibles),
  };
}

// ─── Materiales ─────────────────────────────────────────────────────────
export function mapItemMaterial(d: any): ItemMaterial {
  return {
    ...d,
    solicitudId: d.solicitud_id,
    costoEstimado: d.costo_estimado === null ? null : Number(d.costo_estimado),
    costoReal: d.costo_real === null ? null : Number(d.costo_real),
    cantidadComprada: Number(d.cantidad_comprada),
    cantidad: Number(d.cantidad),
  };
}

export function mapSolicitudMaterial(d: any): SolicitudMaterial {
  if (!d) return {} as SolicitudMaterial;
  return {
    ...d,
    solicitanteId: d.solicitante_id,
    solicitanteNombre: d.solicitante?.nombre ?? null,
    sedeId: d.sede_id,
    cursoId: d.curso_id,
    fechaNecesidad: d.fecha_necesidad,
    costoEstimadoTotal: Number(d.costo_estimado_total ?? 0),
    presupuestoAutorizado: d.presupuesto_autorizado === null || d.presupuesto_autorizado === undefined
      ? null : Number(d.presupuesto_autorizado),
    costoRealTotal: Number(d.costo_real_total ?? 0),
    enviadaEn: d.enviada_en,
    revisadaPor: d.revisada_por,
    revisadaEn: d.revisada_en,
    comentarioRevision: d.comentario_revision,
    entregaConfirmadaPor: d.entrega_confirmada_por,
    entregaConfirmadaEn: d.entrega_confirmada_en,
    items: (d.items ?? []).map(mapItemMaterial),
  };
}

export function mapEventoHistorial(d: any): EventoHistorial {
  return {
    id: d.id,
    estadoAnterior: d.estado_anterior,
    estadoNuevo: d.estado_nuevo,
    actorId: d.actor_id,
    comentario: d.comentario,
    createdAt: d.created_at,
  };
}

export function mapNotificacion(d: any): Notificacion {
  return { ...d, destinatarioId: d.destinatario_id, leidaEn: d.leida_en };
}
