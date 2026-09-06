import { describe, expect, it, vi } from 'vitest';
import { canCreateUsers, isStrongPassword, MAX_BODY_BYTES, readJsonBody } from './security';

describe('permisos de creación de usuarios', () => {
  it('bloquea al director con contraseña temporal, incluso llamando directamente al endpoint', () => {
    expect(canCreateUsers({ activo: true, rol: 'director' }, { must_change_password: true })).toBe(false);
  });

  it('exige un director activo', () => {
    expect(canCreateUsers(null, {})).toBe(false);
    expect(canCreateUsers({ activo: false, rol: 'director' }, {})).toBe(false);
    expect(canCreateUsers({ activo: true, rol: 'docente' }, {})).toBe(false);
    expect(canCreateUsers({ activo: true, rol: 'director' }, { must_change_password: false })).toBe(true);
  });
});

describe('solicitudes administrativas', () => {
  function request(body: string, headers: Record<string, string> = {}) {
    return new Request('http://localhost', {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body,
    });
  }

  it('acepta un objeto JSON', async () => {
    await expect(readJsonBody(request('{"action":"create"}'))).resolves.toEqual({ action: 'create' });
  });

  it.each(['null', '[]', '1', '"texto"', '{'])('rechaza un cuerpo inválido: %s', async body => {
    await expect(readJsonBody(request(body))).rejects.toMatchObject({ status: 400 });
  });

  it('rechaza formularios y texto sin tipo JSON', async () => {
    await expect(readJsonBody(request('{}', { 'Content-Type': 'text/plain' }))).rejects.toMatchObject({ status: 415 });
  });

  it('limita bytes UTF-8 aunque Content-Length mienta', async () => {
    await expect(readJsonBody(request(JSON.stringify({ dato: 'á'.repeat(MAX_BODY_BYTES / 2) }), {
      'Content-Length': '2',
    }))).rejects.toMatchObject({ status: 413 });
  });

  it('cancela el flujo al superar el límite sin consumir el resto', async () => {
    const cancel = vi.fn();
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(MAX_BODY_BYTES));
        controller.enqueue(new Uint8Array(1));
      },
      cancel,
    });
    const req = { headers: new Headers({ 'Content-Type': 'application/json' }), body } as Request;
    await expect(readJsonBody(req)).rejects.toMatchObject({ status: 413 });
    expect(cancel).toHaveBeenCalledOnce();
  });

  it('aplica un máximo a la contraseña inicial y a su reemplazo', () => {
    expect(isStrongPassword('aA1!' + 'x'.repeat(8))).toBe(true);
    expect(isStrongPassword('aA1!' + 'x'.repeat(125))).toBe(false);
    expect(isStrongPassword('sin-complejidad')).toBe(false);
  });
});
