// Database Raw Types (Snake Case as in Supabase)
export interface Tables {
  estudiantes: {
    id: number;
    rut: string;
    nombre: string;
    apellido_paterno: string;
    apellido_materno: string;
    fecha_nacimiento: string | null;
    diagnostico: 'TEL Mixto' | 'TEL Expresivo';
    nivel: 'Medio Mayor' | 'NT1' | 'NT2';
    jornada: 'Mañana' | 'Tarde';
    anamnesis: boolean;
    prueba_inicial: boolean;
    nombre_apoderado: string;
    telefono_apoderado: string | null;
    activo: boolean;
    sede_id: string;
    curso_id?: string | null;
    created_at: string;
  };
  perfiles: {
    id: string;
    email: string;
    nombre: string;
    rol: 'director' | 'sostenedor' | 'secretaria' | 'docente' | 'fonoaudiologo'
       | 'jefe_utp' | 'aseo' | 'bodega' | 'mantencion';
    activo: boolean;
    sede_id: string | null;
    created_at: string;
  };
  perfiles_sedes: {
    perfil_id: string;
    sede_id: string;
    created_at: string;
  };
  sesiones_fono: {
    id: number;
    fecha: string;
    estudiante_id: number;
    fonoaudiologo_id: string;
    actividad_realizada: string;
    observaciones: string | null;
    nivel_fonetico: number;
    nivel_semantico: number;
    nivel_morfosintactico: number;
    nivel_pragmatico: number;
    sede_id: string;
    created_at: string;
  };
  estudiantes_documentos: {
    id: string;
    estudiante_id: number;
    nombre_archivo: string;
    url_archivo: string;
    ruta_archivo: string;
    subido_por: string | null;
    sede_id: string | null;
    created_at: string;
  };
  auditoria: {
    id: number;
    accion: string;
    entidad: string;
    entidad_id: string | null;
    usuario_id: string;
    valor_anterior: any;
    valor_nuevo: any;
    sede_id: string | null;
    created_at: string;
  };
  cursos: {
    id: string;
    nombre: string;
    nivel: string;
    profesor_jefe?: string;
    sede_id: string;
    created_at: string;
  };
  solicitudes_permiso: {
    id: number;
    solicitante_id: string;
    sede_id: string;
    tipo: TipoPermiso;
    fecha_inicio: string;
    fecha_fin: string;
    jornada: JornadaPermiso;
    dias_habiles: number;
    motivo: string | null;
    estado: EstadoPermiso;
    resuelta_por: string | null;
    resuelta_en: string | null;
    comentario_resolucion: string | null;
    created_at: string;
    updated_at: string;
  };
  cupos_permiso: {
    perfil_id: string;
    anio: number;
    dias_administrativos: number;
    created_at: string;
    updated_at: string;
  };
  solicitudes_materiales: {
    id: number;
    solicitante_id: string;
    sede_id: string;
    titulo: string;
    justificacion: string | null;
    curso_id: string | null;
    area: string | null;
    prioridad: PrioridadMaterial;
    fecha_necesidad: string | null;
    estado: EstadoMaterial;
    costo_estimado_total: number;
    presupuesto_autorizado: number | null;
    costo_real_total: number;
    enviada_en: string | null;
    revisada_por: string | null;
    revisada_en: string | null;
    comentario_revision: string | null;
    entrega_confirmada_por: string | null;
    entrega_confirmada_en: string | null;
    created_at: string;
    updated_at: string;
  };
  solicitudes_materiales_items: {
    id: number;
    solicitud_id: number;
    nombre: string;
    cantidad: number;
    unidad: string;
    costo_estimado: number | null;
    costo_real: number | null;
    cantidad_comprada: number;
    /** Producto de bodega enlazado. Null si se pidió algo que no está en inventario. */
    item_id: number | null;
    cantidad_entregada: number;
    comentario: string | null;
    created_at: string;
    updated_at: string;
  };
  notificaciones: {
    id: number;
    destinatario_id: string;
    tipo: string;
    titulo: string;
    cuerpo: string | null;
    enlace: string | null;
    leida_en: string | null;
    created_at: string;
  };
  feriados: {
    fecha: string;
    nombre: string;
    irrenunciable: boolean;
    created_at: string;
  };
}

export type PrioridadMaterial = 'baja' | 'normal' | 'alta' | 'urgente';

export type EstadoMaterial =
  | 'borrador' | 'pendiente' | 'observada' | 'aprobada' | 'rechazada'
  | 'en_compra' | 'compra_parcial' | 'comprada'
  | 'preparando' | 'entregada_parcial' | 'entregada' | 'cancelada';

export type TipoPermiso = 'administrativo' | 'licencia_medica' | 'sin_goce' | 'capacitacion' | 'otro';
export type JornadaPermiso = 'completa' | 'manana' | 'tarde';
export type EstadoPermiso = 'pendiente' | 'observada' | 'aprobada' | 'rechazada' | 'cancelada';

// App Mapped Types (Camel Case as in Frontend)
export interface Estudiante extends Omit<Tables['estudiantes'], 'apellido_paterno' | 'apellido_materno' | 'fecha_nacimiento' | 'prueba_inicial' | 'nombre_apoderado' | 'telefono_apoderado' | 'sede_id'> {
  apellidoPaterno: string;
  apellidoMaterno: string;
  fechaNacimiento: string | null;
  pruebaInicial: boolean;
  nombreApoderado: string;
  telefonoApoderado: string | null;
  sedeId: string;
  curso_id?: string | null;
}

export interface SolicitudPermiso extends Omit<Tables['solicitudes_permiso'],
  'solicitante_id' | 'sede_id' | 'fecha_inicio' | 'fecha_fin' | 'dias_habiles'
  | 'resuelta_por' | 'resuelta_en' | 'comentario_resolucion' | 'updated_at'> {
  solicitanteId: string;
  /** Solo llega en la bandeja de aprobación, vía join con perfiles. */
  solicitanteNombre: string | null;
  sedeId: string;
  fechaInicio: string;
  fechaFin: string;
  diasHabiles: number;
  resueltaPor: string | null;
  resueltaEn: string | null;
  comentarioResolucion: string | null;
}

export interface ItemMaterial extends Omit<Tables['solicitudes_materiales_items'],
  'solicitud_id' | 'costo_estimado' | 'costo_real' | 'cantidad_comprada'
  | 'item_id' | 'cantidad_entregada' | 'updated_at'> {
  solicitudId: number;
  costoEstimado: number | null;
  costoReal: number | null;
  cantidadComprada: number;
  /** Producto de bodega enlazado. Null si no está en inventario. */
  itemId: number | null;
  cantidadEntregada: number;
  /** Lo que todavía falta entregar. */
  pendiente: number;
}

export interface SolicitudMaterial extends Omit<Tables['solicitudes_materiales'],
  'solicitante_id' | 'sede_id' | 'curso_id' | 'fecha_necesidad' | 'costo_estimado_total'
  | 'presupuesto_autorizado' | 'costo_real_total' | 'enviada_en' | 'revisada_por' | 'revisada_en'
  | 'comentario_revision' | 'entrega_confirmada_por' | 'entrega_confirmada_en' | 'updated_at'> {
  solicitanteId: string;
  /** Solo llega en la bandeja de gestión, vía join con perfiles. */
  solicitanteNombre: string | null;
  sedeId: string;
  cursoId: string | null;
  fechaNecesidad: string | null;
  costoEstimadoTotal: number;
  presupuestoAutorizado: number | null;
  costoRealTotal: number;
  enviadaEn: string | null;
  revisadaPor: string | null;
  revisadaEn: string | null;
  comentarioRevision: string | null;
  entregaConfirmadaPor: string | null;
  entregaConfirmadaEn: string | null;
  items: ItemMaterial[];
}

export interface EventoHistorial {
  id: number;
  estadoAnterior: string | null;
  estadoNuevo: string;
  actorId: string | null;
  comentario: string | null;
  createdAt: string;
}

export interface Notificacion extends Omit<Tables['notificaciones'], 'destinatario_id' | 'leida_en'> {
  destinatarioId: string;
  leidaEn: string | null;
}

export interface SaldoPermiso {
  perfilId: string;
  anio: number;
  asignados: number;
  usados: number;
  disponibles: number;
}

// ─── Inventario ─────────────────────────────────────────────────
export type EstadoStock = 'ok' | 'bajo' | 'agotado';

export type TipoMovimiento =
  | 'ingreso' | 'compra' | 'devolucion' | 'entrega' | 'baja' | 'ajuste';

export interface UnidadInventario {
  codigo: string;
  nombre: string;
}

export interface CategoriaInventario {
  id: number;
  nombre: string;
  activo: boolean;
}

/** Fila de `inventario_estado_vista`: el producto con su estado ya calculado. */
export interface ProductoInventario {
  id: number;
  sedeId: string;
  categoriaId: number;
  categoria: string;
  nombre: string;
  descripcion: string | null;
  unidad: string;
  unidadNombre: string;
  stockActual: number;
  stockMinimo: number;
  ubicacion: string | null;
  activo: boolean;
  estadoStock: EstadoStock;
  /** Cuánto falta para llegar al mínimo. 0 si está por sobre. */
  faltante: number;
}

export interface MovimientoInventario {
  id: number;
  itemId: number;
  tipo: TipoMovimiento;
  cantidad: number;
  motivo: string | null;
  observaciones: string | null;
  solicitudId: number | null;
  actorNombre: string | null;
  createdAt: string;
}

export interface Sede {
  id: string;
  nombre: string;
  direccion: string;
  comuna?: string | null;
  region?: string | null;
  rbd?: string | null;
}

export interface User {
  id: string;
  nombre: string;
  email: string;
  rol: Tables['perfiles']['rol'];
  activo: boolean;
  sedeId?: string | null;
  sedeIds: string[];
}
