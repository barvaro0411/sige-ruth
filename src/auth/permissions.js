// Role-Based Access Control permissions map

export const ROLES = {
  DIRECTOR: 'director',
  SECRETARIA: 'secretaria',
  DOCENTE: 'docente',
  FONOAUDIOLOGO: 'fonoaudiologo',
  JEFE_UTP: 'jefe_utp',
  SOSTENEDOR: 'sostenedor',
};

export const ROLE_LABELS = {
  [ROLES.DIRECTOR]: 'Director(a)',
  [ROLES.SECRETARIA]: 'Secretaría',
  [ROLES.DOCENTE]: 'Docente',
  [ROLES.FONOAUDIOLOGO]: 'Coordinadora Técnica / Fonoaudióloga',
  [ROLES.JEFE_UTP]: 'Jefe UTP',
  [ROLES.SOSTENEDOR]: 'Sostenedora',
};

export const ROLE_COLORS = {
  [ROLES.DIRECTOR]: '#D4A853',
  [ROLES.SECRETARIA]: '#3B82F6',
  [ROLES.DOCENTE]: '#10B981',
  [ROLES.FONOAUDIOLOGO]: '#8B5CF6',
  [ROLES.JEFE_UTP]: '#EF4444',
  [ROLES.SOSTENEDOR]: '#0EA5E9',
};

export const PERMISSIONS = {
  VIEW_DASHBOARD: 'view_dashboard',
  MANAGE_USERS: 'manage_users',
  ENROLL_STUDENTS: 'enroll_students',
  VIEW_STUDENTS: 'view_students',
  RECORD_ATTENDANCE: 'record_attendance',
  VIEW_ATTENDANCE: 'view_attendance',
  MODIFY_CLOSED_ATTENDANCE: 'modify_closed_attendance',
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
};

export const ROLE_PERMISSIONS = {
  [ROLES.DIRECTOR]: [
    PERMISSIONS.VIEW_DASHBOARD,
    PERMISSIONS.MANAGE_USERS,
    PERMISSIONS.ENROLL_STUDENTS,
    PERMISSIONS.VIEW_STUDENTS,
    PERMISSIONS.RECORD_ATTENDANCE,
    PERMISSIONS.VIEW_ATTENDANCE,
    PERMISSIONS.MODIFY_CLOSED_ATTENDANCE,
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
  ],
  // Secretaría ejecuta la compra, pero no autoriza el gasto ni resuelve permisos.
  [ROLES.SECRETARIA]: [
    PERMISSIONS.VIEW_DASHBOARD,
    PERMISSIONS.ENROLL_STUDENTS,
    PERMISSIONS.VIEW_STUDENTS,
    PERMISSIONS.VIEW_ATTENDANCE,
    PERMISSIONS.EXPORT_REPORTS,
    PERMISSIONS.REQUEST_LEAVE,
    PERMISSIONS.REQUEST_MATERIALS,
    PERMISSIONS.MANAGE_PURCHASES,
    PERMISSIONS.CONFIRM_MATERIAL_DELIVERY,
  ],
  [ROLES.DOCENTE]: [
    PERMISSIONS.VIEW_STUDENTS,
    PERMISSIONS.RECORD_ATTENDANCE,
    PERMISSIONS.VIEW_ATTENDANCE,
    PERMISSIONS.REQUEST_LEAVE,
    PERMISSIONS.REQUEST_MATERIALS,
    PERMISSIONS.CONFIRM_MATERIAL_DELIVERY,
  ],
  [ROLES.FONOAUDIOLOGO]: [
    PERMISSIONS.VIEW_DASHBOARD,
    PERMISSIONS.VIEW_STUDENTS,
    PERMISSIONS.RECORD_ATTENDANCE,
    PERMISSIONS.VIEW_ATTENDANCE,
    PERMISSIONS.RECORD_SESSIONS,
    PERMISSIONS.VIEW_SESSIONS,
    PERMISSIONS.EXPORT_REPORTS,
    PERMISSIONS.VIEW_AUDIT,
    PERMISSIONS.REQUEST_LEAVE,
    PERMISSIONS.REQUEST_MATERIALS,
    PERMISSIONS.CONFIRM_MATERIAL_DELIVERY,
  ],
  [ROLES.JEFE_UTP]: [
    PERMISSIONS.VIEW_DASHBOARD,
    PERMISSIONS.VIEW_STUDENTS,
    PERMISSIONS.RECORD_ATTENDANCE,
    PERMISSIONS.VIEW_ATTENDANCE,
    PERMISSIONS.MODIFY_CLOSED_ATTENDANCE,
    PERMISSIONS.VIEW_SESSIONS,
    PERMISSIONS.EXPORT_REPORTS,
    PERMISSIONS.VIEW_AUDIT,
    PERMISSIONS.REQUEST_LEAVE,
    PERMISSIONS.REQUEST_MATERIALS,
    PERMISSIONS.CONFIRM_MATERIAL_DELIVERY,
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
  // La asistencia de estudiantes sigue accesible por URL directa, pero fuera del
  // menú: no reemplaza al libro de clases ni al SIGE del MINEDUC.
  if (perms.includes(PERMISSIONS.RECORD_ATTENDANCE) || perms.includes(PERMISSIONS.VIEW_ATTENDANCE)) routes.push('/asistencia');
  if (perms.includes(PERMISSIONS.RECORD_SESSIONS) || perms.includes(PERMISSIONS.VIEW_SESSIONS)) routes.push('/fonoaudiologia');
  if (perms.includes(PERMISSIONS.EXPORT_REPORTS)) routes.push('/reportes');
  if (perms.includes(PERMISSIONS.REQUEST_LEAVE)) routes.push('/permisos');
  if (perms.includes(PERMISSIONS.REQUEST_MATERIALS)) routes.push('/materiales');
  if (perms.includes(PERMISSIONS.VIEW_AUDIT)) routes.push('/auditoria');
  if (perms.includes(PERMISSIONS.MANAGE_USERS)) routes.push('/usuarios');
  
  return routes;
}

export function getDefaultRoute(role) {
  const routes = getPermittedRoutes(role);
  if (routes.includes('/dashboard')) return '/dashboard';
  if (routes.includes('/permisos')) return '/permisos';
  if (routes.includes('/materiales')) return '/materiales';
  return routes[0] || '/';
}
