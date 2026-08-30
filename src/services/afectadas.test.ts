import { describe, it, expect } from 'vitest';
import { exigirFilaAfectada, SIN_PERMISO } from './afectadas';

/**
 * Un `update` que la RLS filtra no falla: PostgREST devuelve `error: null` y
 * cero filas, porque para Postgres no paso nada malo — la fila simplemente no
 * era visible para esa persona.
 *
 * Sin esta comprobacion la app muestra «guardado» sobre un cambio que nunca
 * ocurrio, que es la peor forma de fallar: la persona se va convencida de que
 * quedo registrado.
 */
describe('exigirFilaAfectada', () => {
  it('deja pasar cuando el update afecto alguna fila', () => {
    expect(() => exigirFilaAfectada([{ id: 1 }], SIN_PERMISO)).not.toThrow();
    expect(() => exigirFilaAfectada([{ id: 1 }, { id: 2 }], SIN_PERMISO)).not.toThrow();
  });

  it('lanza cuando la RLS filtro todo en silencio', () => {
    expect(() => exigirFilaAfectada([], SIN_PERMISO)).toThrow(SIN_PERMISO);
  });

  it('lanza cuando PostgREST no devuelve nada', () => {
    expect(() => exigirFilaAfectada(null, SIN_PERMISO)).toThrow(SIN_PERMISO);
  });

  it('respeta el mensaje que le pasa cada servicio', () => {
    const propio = 'No se pudo registrar la devolución.';
    expect(() => exigirFilaAfectada([], propio)).toThrow(propio);
  });

  it('el mensaje por defecto explica el motivo probable', () => {
    expect(SIN_PERMISO).toMatch(/permiso/i);
  });
});
