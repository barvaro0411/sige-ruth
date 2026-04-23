// Role-Based Access Control permissions map

export const ROLES = {
  DIRECTOR: 'director',
  SECRETARIA: 'secretaria',
  DOCENTE: 'docente',
  FONOAUDIOLOGO: 'fonoaudiologo',
  JEFE_UTP: 'jefe_utp',
};

export const ROLE_LABELS = {
  [ROLES.DIRECTOR]: 'Director(a)',
  [ROLES.SECRETARIA]: 'Secretaría',
  [ROLES.DOCENTE]: 'Docente',
  [ROLES.FONOAUDIOLOGO]: 'Coordinadora Técnica / Fonoaudióloga',
  [ROLES.JEFE_UTP]: 'Jefe UTP',
};

export const ROLE_COLORS = {
  [ROLES.DIRECTOR]: '#D4A853',
  [ROLES.SECRETARIA]: '#3B82F6',
  [ROLES.DOCENTE]: '#10B981',
  [ROLES.FONOAUDIOLOGO]: '#8B5CF6',
  [ROLES.JEFE_UTP]: '#EF4444',
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
  ],
  [ROLES.SECRETARIA]: [
    PERMISSIONS.VIEW_DASHBOARD,
    PERMISSIONS.ENROLL_STUDENTS,
    PERMISSIONS.VIEW_STUDENTS,
    PERMISSIONS.VIEW_ATTENDANCE,
    PERMISSIONS.EXPORT_REPORTS,
  ],
  [ROLES.DOCENTE]: [
    PERMISSIONS.VIEW_STUDENTS,
    PERMISSIONS.RECORD_ATTENDANCE,
    PERMISSIONS.VIEW_ATTENDANCE,
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
  if (perms.includes(PERMISSIONS.RECORD_ATTENDANCE) || perms.includes(PERMISSIONS.VIEW_ATTENDANCE)) routes.push('/asistencia');
  if (perms.includes(PERMISSIONS.RECORD_SESSIONS) || perms.includes(PERMISSIONS.VIEW_SESSIONS)) routes.push('/fonoaudiologia');
  if (perms.includes(PERMISSIONS.EXPORT_REPORTS)) routes.push('/reportes');
  if (perms.includes(PERMISSIONS.VIEW_AUDIT)) routes.push('/auditoria');
  if (perms.includes(PERMISSIONS.MANAGE_USERS)) routes.push('/usuarios');
  
  return routes;
}

export function getDefaultRoute(role) {
  const routes = getPermittedRoutes(role);
  if (routes.includes('/dashboard')) return '/dashboard';
  if (routes.includes('/asistencia')) return '/asistencia';
  if (routes.includes('/fonoaudiologia')) return '/fonoaudiologia';
  return routes[0] || '/';
}
