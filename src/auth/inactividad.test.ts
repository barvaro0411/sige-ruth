import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  PLAZO_INACTIVIDAD_MS,
  anotarActividad,
  olvidarActividad,
  restanteDeInactividad,
  sesionVencidaPorInactividad,
  iniciarControlDeInactividad,
} from './inactividad';

/** `localStorage` mínimo: vitest corre en Node y no trae uno. */
function instalarAlmacenamiento(fallando = false) {
  const datos = new Map<string, string>();
  const almacenamiento = {
    getItem: (k: string) => (fallando ? (() => { throw new Error('bloqueado'); })() : datos.get(k) ?? null),
    setItem: (k: string, v: string) => {
      if (fallando) throw new Error('bloqueado');
      datos.set(k, v);
    },
    removeItem: (k: string) => {
      if (fallando) throw new Error('bloqueado');
      datos.delete(k);
    },
  };
  vi.stubGlobal('localStorage', almacenamiento);
  return datos;
}

describe('inactividad', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    instalarAlmacenamiento();
    olvidarActividad();
  });

  it('no da por vencida una sesión sin marca previa', () => {
    expect(sesionVencidaPorInactividad()).toBe(false);
    expect(restanteDeInactividad()).toBe(PLAZO_INACTIVIDAD_MS);
  });

  it('mantiene viva la sesión mientras haya actividad reciente', () => {
    const ahora = 1_000_000_000;
    anotarActividad(ahora);
    expect(sesionVencidaPorInactividad(ahora + 29 * 60 * 1000)).toBe(false);
    expect(restanteDeInactividad(ahora + 29 * 60 * 1000)).toBe(60 * 1000);
  });

  it('cierra la sesión al cumplirse el plazo', () => {
    const ahora = 1_000_000_000;
    anotarActividad(ahora);
    expect(sesionVencidaPorInactividad(ahora + PLAZO_INACTIVIDAD_MS)).toBe(true);
    expect(restanteDeInactividad(ahora + PLAZO_INACTIVIDAD_MS)).toBe(0);
  });

  it('sobrevive a cerrar la pestaña: la marca no depende del temporizador', () => {
    const tarde = 1_000_000_000;
    anotarActividad(tarde);
    // Cuatro horas después, en una pestaña nueva, sin temporizador en memoria.
    expect(sesionVencidaPorInactividad(tarde + 4 * 60 * 60 * 1000)).toBe(true);
  });

  it('trata una marca en el futuro como reciente en vez de cerrar de golpe', () => {
    const ahora = 1_000_000_000;
    anotarActividad(ahora + 60 * 60 * 1000);
    expect(sesionVencidaPorInactividad(ahora)).toBe(false);
  });

  it('olvida la marca al cerrar sesión', () => {
    anotarActividad(1_000_000_000);
    olvidarActividad();
    expect(sesionVencidaPorInactividad(1_000_000_000 + PLAZO_INACTIVIDAD_MS)).toBe(false);
  });

  it('no impide el uso si el navegador bloquea el almacenamiento', () => {
    instalarAlmacenamiento(true);
    expect(() => anotarActividad()).not.toThrow();
    expect(() => olvidarActividad()).not.toThrow();
    expect(sesionVencidaPorInactividad()).toBe(false);
    expect(restanteDeInactividad()).toBe(PLAZO_INACTIVIDAD_MS);
  });

  it('ignora una marca corrupta', () => {
    instalarAlmacenamiento().set('sige_ultima_actividad', 'ayer');
    expect(sesionVencidaPorInactividad()).toBe(false);
  });

  it('hace vencer la sesión también con localStorage bloqueado', () => {
    instalarAlmacenamiento(true);
    const ahora = 1_000_000_000;
    anotarActividad(ahora);
    expect(restanteDeInactividad(ahora + PLAZO_INACTIVIDAD_MS)).toBe(0);
    expect(sesionVencidaPorInactividad(ahora + PLAZO_INACTIVIDAD_MS)).toBe(true);
  });

  it('restaurar el control no renueva la última actividad', () => {
    const ahora = Date.now();
    anotarActividad(ahora - PLAZO_INACTIVIDAD_MS);
    iniciarControlDeInactividad();
    expect(sesionVencidaPorInactividad(ahora)).toBe(true);
  });

  it('una marca futura no programa un temporizador mayor al plazo', () => {
    const ahora = Date.now();
    anotarActividad(ahora + 24 * 60 * 60 * 1000);
    expect(restanteDeInactividad(ahora)).toBe(PLAZO_INACTIVIDAD_MS);
  });
});
