import { describe, it, expect } from 'vitest';
import {
  ROLES, PERMISSIONS, ROLE_PERMISSIONS, ROLE_LABELS, ROLE_COLORS,
  hasPermission, getPermittedRoutes, getDefaultRoute, esRolTransversal,
  type Rol, type Permiso,
} from './permissions';

const TODOS_LOS_ROLES = Object.values(ROLES) as Rol[];

/**
 * Este mapa decide que ve cada persona al entrar. No es la barrera de
 * seguridad —esa vive en la base— pero un error aca esconde trabajo a quien
 * tiene que hacerlo, y lo esconde en silencio.
 */
describe('mapa de permisos', () => {
  it('todos los roles tienen permisos definidos', () => {
    for (const rol of TODOS_LOS_ROLES) {
      expect(ROLE_PERMISSIONS[rol], `falta ${rol}`).toBeDefined();
      expect(ROLE_PERMISSIONS[rol].length, `${rol} sin permisos`).toBeGreaterThan(0);
    }
  });

  it('todos los roles tienen etiqueta y color', () => {
    for (const rol of TODOS_LOS_ROLES) {
      expect(ROLE_LABELS[rol], `falta etiqueta de ${rol}`).toBeTruthy();
      expect(ROLE_COLORS[rol], `falta color de ${rol}`).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  it('no se cuela ningun permiso inventado', () => {
    const validos = new Set<string>(Object.values(PERMISSIONS));
    for (const rol of TODOS_LOS_ROLES) {
      for (const permiso of ROLE_PERMISSIONS[rol]) {
        expect(validos.has(permiso), `${rol} tiene un permiso inexistente: ${permiso}`).toBe(true);
      }
    }
  });

  it('ningun rol repite un permiso', () => {
    for (const rol of TODOS_LOS_ROLES) {
      const lista = ROLE_PERMISSIONS[rol];
      expect(new Set(lista).size, `${rol} repite permisos`).toBe(lista.length);
    }
  });
});

describe('hasPermission', () => {
  it('el director puede administrar usuarios', () => {
    expect(hasPermission(ROLES.DIRECTOR, PERMISSIONS.MANAGE_USERS)).toBe(true);
  });

  it('nadie mas administra usuarios', () => {
    const otros = TODOS_LOS_ROLES.filter(r => r !== ROLES.DIRECTOR);
    for (const rol of otros) {
      expect(hasPermission(rol, PERMISSIONS.MANAGE_USERS), `${rol} no deberia`).toBe(false);
    }
  });

  it('un rol desconocido no tiene ningun permiso', () => {
    expect(hasPermission('intruso' as Rol, PERMISSIONS.VIEW_DASHBOARD)).toBe(false);
  });

  it('un permiso desconocido nunca se concede', () => {
    expect(hasPermission(ROLES.DIRECTOR, 'permiso_inventado' as Permiso)).toBe(false);
  });
});

/**
 * La sostenedora existe por una sola razon: nadie resuelve su propia
 * solicitud, ni el director. Si pierde estos permisos, el director queda sin
 * nadie que le apruebe nada.
 */
describe('la sostenedora puede resolver lo del director', () => {
  it('aprueba permisos y revisa materiales', () => {
    expect(hasPermission(ROLES.SOSTENEDOR, PERMISSIONS.APPROVE_LEAVE)).toBe(true);
    expect(hasPermission(ROLES.SOSTENEDOR, PERMISSIONS.REVIEW_MATERIALS)).toBe(true);
  });

  it('no administra datos academicos', () => {
    expect(hasPermission(ROLES.SOSTENEDOR, PERMISSIONS.ENROLL_STUDENTS)).toBe(false);
    expect(hasPermission(ROLES.SOSTENEDOR, PERMISSIONS.MANAGE_USERS)).toBe(false);
  });
});

describe('roles transversales', () => {
  it('director y sostenedora lo son', () => {
    expect(esRolTransversal(ROLES.DIRECTOR)).toBe(true);
    expect(esRolTransversal(ROLES.SOSTENEDOR)).toBe(true);
  });

  it('el resto no', () => {
    const resto = TODOS_LOS_ROLES.filter(r => r !== ROLES.DIRECTOR && r !== ROLES.SOSTENEDOR);
    for (const rol of resto) {
      expect(esRolTransversal(rol), `${rol} no es transversal`).toBe(false);
    }
  });
});

describe('rutas permitidas', () => {
  it('nadie queda sin ninguna ruta', () => {
    for (const rol of TODOS_LOS_ROLES) {
      expect(getPermittedRoutes(rol).length, `${rol} no puede entrar a ninguna parte`).toBeGreaterThan(0);
    }
  });

  it('no devuelve rutas repetidas', () => {
    for (const rol of TODOS_LOS_ROLES) {
      const rutas = getPermittedRoutes(rol);
      expect(new Set(rutas).size, `${rol} repite rutas`).toBe(rutas.length);
    }
  });

  it('no queda rastro del modulo de asistencia, que se retiro', () => {
    for (const rol of TODOS_LOS_ROLES) {
      expect(getPermittedRoutes(rol)).not.toContain('/asistencia');
    }
  });

  it('solo quien administra usuarios llega a /usuarios', () => {
    for (const rol of TODOS_LOS_ROLES) {
      const puede = hasPermission(rol, PERMISSIONS.MANAGE_USERS);
      expect(getPermittedRoutes(rol).includes('/usuarios')).toBe(puede);
    }
  });
});

describe('ruta de entrada', () => {
  it('siempre cae en una ruta a la que ese rol tiene acceso', () => {
    for (const rol of TODOS_LOS_ROLES) {
      const destino = getDefaultRoute(rol);
      expect(getPermittedRoutes(rol), `${rol} entra a ${destino}, que no le corresponde`)
        .toContain(destino);
    }
  });

  it('aseo entra directo a pedir insumos', () => {
    // Es lo unico que viene a hacer, y lo hace de pie con el celular.
    expect(getDefaultRoute(ROLES.ASEO)).toBe('/insumos');
  });

  it('mantencion entra a su bandeja', () => {
    expect(getDefaultRoute(ROLES.MANTENCION)).toBe('/mantenciones');
  });

  it('un rol desconocido no revienta', () => {
    expect(getDefaultRoute('intruso' as Rol)).toBe('/');
  });
});
