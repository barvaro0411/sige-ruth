export const MAX_BODY_BYTES = 16 * 1024;

export class InvalidRequest extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** Cuenta bytes mientras llegan: Content-Length puede faltar o ser falso. */
export async function readJsonBody(request: Request): Promise<Record<string, unknown>> {
  if (request.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase() !== 'application/json') {
    throw new InvalidRequest(415, 'Se requiere JSON');
  }
  if (Number(request.headers.get('Content-Length')) > MAX_BODY_BYTES) {
    throw new InvalidRequest(413, 'Solicitud demasiado grande');
  }
  if (!request.body) throw new InvalidRequest(400, 'Solicitud inválida');
  const reader = request.body.getReader();
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let bytes = 0;
  let raw = '';
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_BODY_BYTES) {
        void reader.cancel().catch(() => {});
        throw new InvalidRequest(413, 'Solicitud demasiado grande');
      }
      raw += decoder.decode(value, { stream: true });
    }
    raw += decoder.decode();
    const body: unknown = JSON.parse(raw);
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      throw new InvalidRequest(400, 'Solicitud inválida');
    }
    return body as Record<string, unknown>;
  } catch (error) {
    if (error instanceof InvalidRequest) throw error;
    throw new InvalidRequest(400, 'Solicitud inválida');
  } finally {
    reader.releaseLock();
  }
}

export function canCreateUsers(
  caller: { activo: boolean; rol: string } | null,
  metadata: Record<string, unknown>,
): boolean {
  return caller?.activo === true && caller.rol === 'director'
    && !metadata.must_change_password;
}

export function isStrongPassword(password: string): boolean {
  return password.length >= 12 && password.length <= 128
    && /[a-z]/.test(password) && /[A-Z]/.test(password)
    && /[0-9]/.test(password) && /[^A-Za-z0-9]/.test(password);
}
