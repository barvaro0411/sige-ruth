// Role-Based Access Control permissions map

export const ROLES = {
  DIRECTOR: 'director',
  SECRETARIA: 'secretaria',
  DOCENTE: 'docente',
  FONOAUDIOLOGO: 'fonoaudiologo',
  JEFE_UTP: 'jefe_utp',
  SOSTENEDOR: 'sostenedor',
  ASEO: 'aseo',
  BODEGA: 'bodega',
  MANTENCION: 'mantencion',
};

export const ROLE_LABELS = {
  [ROLES.DIRECTOR]: 'Director(a)',
  [ROLES.SECRETARIA]: 'Secretaría',
  [ROLES.DOCENTE]: 'Docente',
  [ROLES.FONOAUDIOLOGO]: 'Coordinadora Técnica / Fonoaudióloga',
  [ROLES.JEFE_UTP]: 'Jefe UTP',
  [ROLES.SOSTENEDOR]: 'Sostenedora',
  [ROLES.ASEO]: 'Aseo',
  [ROLES.BODEGA]: 'Encargado(a) de bodega',
  [ROLES.MANTENCION]: 'Mantención',
};

/**
 * Roles transversales a la institución: acceden a todas las sedes y no se les
 * asigna ninguna en particular. La sostenedora lo es porque debe poder resolver
 * las solicitudes del director, que no puede resolver las propias.
 */
export const ROLES_TRANSVERSALES = [ROLES.DIRECTOR, ROLES.SOSTENEDOR];

export function esRolTransversal(rol) {
  return ROLES_TRANSVERSALES.includes(rol);
}

export const ROLE_COLORS = {
  [ROLES.DIRECTOR]: '#D4A853',
  [ROLES.SECRETARIA]: '#3B82F6',
  [ROLES.DOCENTE]: '#10B981',
  [ROLES.FONOAUDIOLOGO]: '#8B5CF6',
  [ROLES.JEFE_UTP]: '#EF4444',
  [ROLES.SOSTENEDOR]: '#0EA5E9',
  [ROLES.ASEO]: '#14B8A6',
  [ROLES.BODEGA]: '#F97316',
  [ROLES.MANTENCION]: '#64748B',
};

export const PERMISSIONS = {
  VIEW_DASHBOARD: 'view_dashboard',
  MANAGE_USERS: 'manage_users',
  ENROLL_STUDENTS: 'enroll_students',
  VIEW_STUDENTS: 'view_students',
  RECORD_SESSIONS: 'record_sessions',
  VIEW_SESSIONS: 'view_sessions',
  EXPORT_REPORTS: 'export_reports',
  VIEW_AUDIT: 'view_audit',
  APPROVE_DOCUMENTS: 'approve_documents',
  MANAGE_CONFIG: 'manage_config',

  // Permisos y días administrativos
  REQUEST_LEAVE: 'request_leave',
  APPROVE_LEAVE: 'approve_leave',
  CONFIGURE_LEAVE_ALLOWANCE: 'configure_leave_allowance',

  // Materiales
  REQUEST_MATERIALS: 'request_materials',
  REVIEW_MATERIALS: 'review_materials',
  MANAGE_PURCHASES: 'manage_purchases',
  CONFIRM_MATERIAL_DELIVERY: 'confirm_material_delivery',
  VIEW_MATERIAL_REPORTS: 'view_material_reports',

  // Informes de personal
  VIEW_PERSONNEL_REPORTS: 'view_personnel_reports',

  // Recursos y bodega
  VIEW_INVENTORY: 'view_inventory',
  MANAGE_INVENTORY: 'manage_inventory',
  RECORD_MOVEMENT: 'record_movement',

  // Mantenciones
  REPORT_MAINTENANCE: 'report_maintenance',
  MANAGE_MAINTENANCE: 'manage_maintenance',

  // Préstamos de equipos
  VIEW_LOANS: 'view_loans',
  MANAGE_LOANS: 'manage_loans',

  // Panel de operaciones: el estado del conjunto, no el de un módulo
  VIEW_OPERATIONS: 'view_operations',
};

export const ROLE_PERMISSIONS = {
  [ROLES.DIRECTOR]: [
    PERMISSIONS.VIEW_DASHBOARD,
    PERMISSIONS.MANAGE_USERS,
    PERMISSIONS.ENROLL_STUDENTS,
    PERMISSIONS.VIEW_STUDENTS,
    PERMISSIONS.VIEW_SESSIONS,
    PERMISSIONS.EXPORT_REPORTS,
    PERMISSIONS.VIEW_AUDIT,
    PERMISSIONS.APPROVE_DOCUMENTS,
    PERMISSIONS.MANAGE_CONFIG,
    PERMISSIONS.REQUEST_LEAVE,
    PERMISSIONS.APPROVE_LEAVE,
    PERMISSIONS.CONFIGURE_LEAVE_ALLOWANCE,
    PERMISSIONS.REQUEST_MATERIALS,
    PERMISSIONS.REVIEW_MATERIALS,
    PERMISSIONS.MANAGE_PURCHASES,
    PERMISSIONS.CONFIRM_MATERIAL_DELIVERY,
    PERMISSIONS.VIEW_MATERIAL_REPORTS,
    PERMISSIONS.VIEW_PERSONNEL_REPORTS,
    PERMISSIONS.VIEW_INVENTORY,
    PERMISSIONS.MANAGE_INVENTORY,
    PERMISSIONS.RECORD_MOVEMENT,
    PERMISSIONS.REPORT_MAINTENANCE,
    PERMISSIONS.MANAGE_MAINTENANCE,
    PERMISSIONS.VIEW_LOANS,
    PERMISSIONS.MANAGE_LOANS,
    PERMISSIONS.VIEW_OPERATIONS,
  ],
  // La sostenedora revisa y autoriza gasto; no administra datos académicos.
  [ROLES.SOSTENEDOR]: [
    PERMISSIONS.VIEW_DASHBOARD,
    PERMISSIONS.EXPORT_REPORTS,
    PERMISSIONS.VIEW_AUDIT,
    PERMISSIONS.REQUEST_LEAVE,
    PERMISSIONS.APPROVE_LEAVE,
    PERMISSIONS.CONFIGURE_LEAVE_ALLOWANCE,
    PERMISSIONS.REQUEST_MATERIALS,
    PERMISSIONS.REVIEW_MATERIALS,
    PERMISSIONS.MANAGE_PURCHASES,
    PERMISSIONS.VIEW_MATERIAL_REPORTS,
    PERMISSIONS.VIEW_PERSONNEL_REPORTS,
    PERMISSIONS.VIEW_INVENTORY,
    PERMISSIONS.REPORT_MAINTENANCE,
    PERMISSIONS.MANAGE_MAINTENANCE,
    PERMISSIONS.VIEW_LOANS,
    PERMISSIONS.MANAGE_LOANS,
    PERMISSIONS.VIEW_OPERATIONS,
  ],
  // Secretaría ejecuta la compra, pero no autoriza el gasto ni resuelve permisos.
  // En una escuela chica suele ser además quien administra la bodega.
  [ROLES.SECRETARIA]: [
    PERMISSIONS.VIEW_DASHBOARD,
    PERMISSIONS.ENROLL_STUDENTS,
    PERMISSIONS.VIEW_STUDENTS,
    PERMISSIONS.EXPORT_REPORTS,
    PERMISSIONS.REQUEST_LEAVE,
    PERMISSIONS.REQUEST_MATERIALS,
    PERMISSIONS.MANAGE_PURCHASES,
    PERMISSIONS.CONFIRM_MATERIAL_DELIVERY,
    PERMISSIONS.VIEW_INVENTORY,
    PERMISSIONS.MANAGE_INVENTORY,
    PERMISSIONS.RECORD_MOVEMENT,
    PERMISSIONS.REPORT_MAINTENANCE,
    PERMISSIONS.VIEW_LOANS,
    PERMISSIONS.MANAGE_LOANS,
    PERMISSIONS.VIEW_OPERATIONS,
  ],
  [ROLES.DOCENTE]: [
    PERMISSIONS.VIEW_STUDENTS,
    PERMISSIONS.REQUEST_LEAVE,
    PERMISSIONS.REQUEST_MATERIALS,
    PERMISSIONS.CONFIRM_MATERIAL_DELIVERY,
    PERMISSIONS.REPORT_MAINTENANCE,
    PERMISSIONS.VIEW_LOANS,
  ],
  [ROLES.FONOAUDIOLOGO]: [
    PERMISSIONS.VIEW_DASHBOARD,
    PERMISSIONS.VIEW_STUDENTS,
    PERMISSIONS.RECORD_SESSIONS,
    PERMISSIONS.VIEW_SESSIONS,
    PERMISSIONS.EXPORT_REPORTS,
    PERMISSIONS.VIEW_AUDIT,
    PERMISSIONS.REQUEST_LEAVE,
    PERMISSIONS.REQUEST_MATERIALS,
    PERMISSIONS.CONFIRM_MATERIAL_DELIVERY,
    PERMISSIONS.REPORT_MAINTENANCE,
    PERMISSIONS.VIEW_LOANS,
  ],
  [ROLES.JEFE_UTP]: [
    PERMISSIONS.VIEW_DASHBOARD,
    PERMISSIONS.VIEW_STUDENTS,
    PERMISSIONS.VIEW_SESSIONS,
    PERMISSIONS.EXPORT_REPORTS,
    PERMISSIONS.VIEW_AUDIT,
    PERMISSIONS.REQUEST_LEAVE,
    PERMISSIONS.REQUEST_MATERIALS,
    PERMISSIONS.CONFIRM_MATERIAL_DELIVERY,
    PERMISSIONS.REPORT_MAINTENANCE,
    PERMISSIONS.VIEW_LOANS,
  ],

  // Aseo: pide insumos y avisa lo que se rompe. Nada más, a propósito —
  // su pantalla tiene que abrirse y resolverse en el celular en 30 segundos.
  [ROLES.ASEO]: [
    PERMISSIONS.REQUEST_MATERIALS,
    PERMISSIONS.CONFIRM_MATERIAL_DELIVERY,
    PERMISSIONS.REPORT_MAINTENANCE,
    PERMISSIONS.REQUEST_LEAVE,
  ],

  // Bodega: administra el stock y prepara las entregas. No aprueba gasto
  // ni resuelve permisos: recibe, entrega y deja registro.
  [ROLES.BODEGA]: [
    PERMISSIONS.VIEW_DASHBOARD,
    PERMISSIONS.VIEW_INVENTORY,
    PERMISSIONS.MANAGE_INVENTORY,
    PERMISSIONS.RECORD_MOVEMENT,
    PERMISSIONS.VIEW_MATERIAL_REPORTS,
    PERMISSIONS.REQUEST_MATERIALS,
    PERMISSIONS.REPORT_MAINTENANCE,
    PERMISSIONS.REQUEST_LEAVE,
    PERMISSIONS.VIEW_LOANS,
    PERMISSIONS.MANAGE_LOANS,
    PERMISSIONS.VIEW_OPERATIONS,
  ],

  // Mantención: recibe las incidencias, las trabaja y las cierra con su costo.
  [ROLES.MANTENCION]: [
    PERMISSIONS.VIEW_DASHBOARD,
    PERMISSIONS.REPORT_MAINTENANCE,
    PERMISSIONS.MANAGE_MAINTENANCE,
    PERMISSIONS.VIEW_INVENTORY,
    PERMISSIONS.REQUEST_MATERIALS,
    PERMISSIONS.REQUEST_LEAVE,
    PERMISSIONS.VIEW_LOANS,
    PERMISSIONS.VIEW_OPERATIONS,
  ],
};

export function hasPermission(role, permission) {
  const perms = ROLE_PERMISSIONS[role];
  return perms ? perms.includes(permission) : false;
}

export function getPermittedRoutes(role) {
  const perms = ROLE_PERMISSIONS[role] || [];
  const routes = [];
  
  if (perms.includes(PERMISSIONS.VIEW_DASHBOARD)) routes.push('/dashboard');
  if (perms.includes(PERMISSIONS.VIEW_STUDENTS) || perms.includes(PERMISSIONS.ENROLL_STUDENTS)) routes.push('/estudiantes');
  // La asistencia de estudiantes se lleva en el libro de clases y se sube al
  // SIGE del MINEDUC. Duplicarla acá era doble trabajo sin valor: se retiró.
  if (perms.includes(PERMISSIONS.RECORD_SESSIONS) || perms.includes(PERMISSIONS.VIEW_SESSIONS)) routes.push('/fonoaudiologia');
  if (perms.includes(PERMISSIONS.EXPORT_REPORTS)) routes.push('/reportes');
  if (perms.includes(PERMISSIONS.REQUEST_LEAVE)) routes.push('/permisos');
  if (perms.includes(PERMISSIONS.REQUEST_MATERIALS)) routes.push('/insumos');
  if (perms.includes(PERMISSIONS.REQUEST_MATERIALS)) routes.push('/materiales');
  if (perms.includes(PERMISSIONS.VIEW_INVENTORY)) routes.push('/inventario');
  if (perms.includes(PERMISSIONS.REPORT_MAINTENANCE)) routes.push('/mantenciones');
  if (perms.includes(PERMISSIONS.VIEW_LOANS)) routes.push('/prestamos');
  if (perms.includes(PERMISSIONS.VIEW_OPERATIONS)) routes.push('/operaciones');
  if (perms.includes(PERMISSIONS.VIEW_AUDIT)) routes.push('/auditoria');
  if (perms.includes(PERMISSIONS.MANAGE_USERS)) routes.push('/usuarios');

  return routes;
}

/**
 * Dónde cae cada persona al entrar: lo que hace todos los días, no lo primero
 * de la lista. Aseo entra a pedir insumos; una docente, a ver sus alumnos.
 */
export function getDefaultRoute(role) {
  const routes = getPermittedRoutes(role);

  // Aseo entra directo a pedir: es lo único que viene a hacer, y lo hace de
  // pie con el celular. Un panel de control le agrega un paso de más.
  if (role === ROLES.ASEO) return '/insumos';

  // Mantención entra a su bandeja: lo que tiene que arreglar hoy.
  if (role === ROLES.MANTENCION) return '/mantenciones';

  const preferencia = ['/dashboard', '/operaciones', '/estudiantes', '/materiales', '/permisos'];
  return preferencia.find(r => routes.includes(r)) || routes[0] || '/';
}
