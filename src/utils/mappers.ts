import {
  Estudiante, User, Tables, SolicitudPermiso, SaldoPermiso,
  SolicitudMaterial, ItemMaterial, EventoHistorial, Notificacion,
  Mantencion, Preventiva, EjecucionPreventiva, Recurso, Prestamo,
  PanelOperaciones, GastoMensual, CompraSugerida, Adjunto,
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
  const cantidad = Number(d.cantidad);
  const entregada = Number(d.cantidad_entregada ?? 0);
  return {
    ...d,
    solicitudId: d.solicitud_id,
    costoEstimado: d.costo_estimado === null ? null : Number(d.costo_estimado),
    costoReal: d.costo_real === null ? null : Number(d.costo_real),
    cantidadComprada: Number(d.cantidad_comprada),
    itemId: d.item_id ?? null,
    cantidadEntregada: entregada,
    pendiente: Math.max(cantidad - entregada, 0),
    cantidad,
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

// ─── Mantenciones ───────────────────────────────────────────────
export function mapMantencion(d: any): Mantencion {
  return {
    ...d,
    sedeId: d.sede_id,
    categoriaId: d.categoria_id,
    categoria: d.categoria?.nombre ?? null,
    reportadoPor: d.reportado_por,
    reportadoPorNombre: d.reportante?.nombre ?? null,
    asignadoA: d.asignado_a,
    asignadoANombre: d.asignado?.nombre ?? null,
    fechaProgramada: d.fecha_programada,
    costo: d.costo === null || d.costo === undefined ? null : Number(d.costo),
    trabajoRealizado: d.trabajo_realizado,
    resueltaPor: d.resuelta_por,
    resueltaEn: d.resuelta_en,
    cerradaEn: d.cerrada_en,
    createdAt: d.created_at,
    updatedAt: d.updated_at,
  };
}

export function mapPreventiva(d: any): Preventiva {
  return {
    id: d.id,
    sedeId: d.sede_id,
    categoriaId: d.categoria_id,
    categoria: d.categoria,
    nombre: d.nombre,
    ubicacion: d.ubicacion,
    observaciones: d.observaciones,
    frecuenciaDias: Number(d.frecuencia_dias),
    fechaInicio: d.fecha_inicio,
    ultimaFecha: d.ultima_fecha,
    proximaFecha: d.proxima_fecha,
    responsableId: d.responsable_id,
    responsableNombre: d.responsable_nombre,
    activo: d.activo,
    diasRestantes: Number(d.dias_restantes),
    estadoPreventiva: d.estado_preventiva,
  };
}

export function mapEjecucionPreventiva(d: any): EjecucionPreventiva {
  return {
    id: d.id,
    preventivaId: d.preventiva_id,
    fecha: d.fecha,
    realizadaPor: d.realizada_por,
    realizadaPorNombre: d.responsable?.nombre ?? null,
    proveedor: d.proveedor,
    costo: d.costo === null || d.costo === undefined ? null : Number(d.costo),
    observaciones: d.observaciones,
    createdAt: d.created_at,
  };
}

// ─── Préstamos ──────────────────────────────────────────────────
export function mapRecurso(d: any): Recurso {
  return { ...d, sedeId: d.sede_id, createdAt: d.created_at };
}

export function mapPrestamo(d: any): Prestamo {
  return {
    id: d.id,
    recursoId: d.recurso_id,
    recurso: d.recurso,
    codigo: d.codigo,
    tipo: d.tipo,
    sedeId: d.sede_id,
    prestadoA: d.prestado_a,
    prestadoANombre: d.prestado_a_nombre,
    fechaEntrega: d.fecha_entrega,
    fechaDevolucionEsperada: d.fecha_devolucion_esperada,
    fechaDevolucionReal: d.fecha_devolucion_real,
    estadoAlEntregar: d.estado_al_entregar,
    estadoAlDevolver: d.estado_al_devolver,
    observaciones: d.observaciones,
    diasRestantes: Number(d.dias_restantes),
    situacion: d.situacion,
  };
}

// ─── Panel de operaciones ───────────────────────────────────────
export function mapPanelOperaciones(d: any): PanelOperaciones {
  return {
    sedeId: d.sede_id,
    sedeNombre: d.sede_nombre,
    materialesPorRevisar: Number(d.materiales_por_revisar),
    materialesPorComprar: Number(d.materiales_por_comprar),
    materialesPorEntregar: Number(d.materiales_por_entregar),
    permisosPorResolver: Number(d.permisos_por_resolver),
    productosAgotados: Number(d.productos_agotados),
    productosBajoMinimo: Number(d.productos_bajo_minimo),
    mantencionesAbiertas: Number(d.mantenciones_abiertas),
    mantencionesUrgentes: Number(d.mantenciones_urgentes),
    mantencionesPorCerrar: Number(d.mantenciones_por_cerrar),
    preventivasVencidas: Number(d.preventivas_vencidas),
    preventivasProximas: Number(d.preventivas_proximas),
    prestamosAtrasados: Number(d.prestamos_atrasados),
  };
}

export function mapGastoMensual(d: any): GastoMensual {
  return {
    sedeId: d.sede_id,
    mes: d.mes,
    origen: d.origen,
    cantidad: Number(d.cantidad),
    total: Number(d.total),
  };
}

export function mapCompraSugerida(d: any): CompraSugerida {
  return {
    id: d.id,
    sedeId: d.sede_id,
    categoriaId: d.categoria_id,
    categoria: d.categoria,
    nombre: d.nombre,
    unidad: d.unidad,
    unidadNombre: d.unidad_nombre,
    ubicacion: d.ubicacion,
    stockActual: Number(d.stock_actual),
    stockMinimo: Number(d.stock_minimo),
    estadoStock: d.estado_stock,
    faltante: Number(d.faltante),
    consumo90d: Number(d.consumo_90d),
    consumoMensual: Number(d.consumo_mensual),
    sugerido: Number(d.sugerido),
    ultimaCompra: d.ultima_compra,
  };
}

// ─── Adjuntos ───────────────────────────────────────────────────
export function mapAdjunto(d: any): Adjunto {
  return {
    id: d.id,
    origen: d.origen,
    origenId: d.origen_id,
    sedeId: d.sede_id,
    nombreArchivo: d.nombre_archivo,
    rutaArchivo: d.ruta_archivo,
    tipoMime: d.tipo_mime,
    tamanoBytes: d.tamano_bytes === null || d.tamano_bytes === undefined
      ? null : Number(d.tamano_bytes),
    momento: d.momento,
    subidoPor: d.subido_por,
    createdAt: d.created_at,
  };
}
