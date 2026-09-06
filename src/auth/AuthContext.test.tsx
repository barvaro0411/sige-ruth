import { act, create, ReactTestRenderer } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider, useAuth } from './AuthContext';
import { anotarActividad, olvidarActividad, PLAZO_INACTIVIDAD_MS } from './inactividad';

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(), signOut: vi.fn(), signInWithPassword: vi.fn(), onAuthStateChange: vi.fn(), single: vi.fn(),
}));
vi.mock('../db/database', () => ({
  supabase: {
    auth: mocks,
    from: () => ({ select: () => ({ eq: () => ({ single: mocks.single }) }) }),
  },
}));

let state: ReturnType<typeof useAuth>;
let root: ReactTestRenderer;
let client: QueryClient;
let emit: (event: string, session: unknown) => void;

function Probe() {
  state = useAuth();
  return null;
}

function session(id = 'usuario-a') {
  return { user: { id, app_metadata: {} } };
}

function profile(id = 'usuario-a', rol = 'director') {
  return { data: { id, rol, activo: true, nombre: 'Prueba', perfiles_sedes: [{ sede_id: 'sede-a' }] }, error: null };
}

async function mount() {
  await act(async () => {
    root = create(<QueryClientProvider client={client}><AuthProvider><Probe /></AuthProvider></QueryClientProvider>);
  });
}

async function authEvent(event: string, value: unknown) {
  await act(async () => {
    emit(event, value);
    await vi.advanceTimersByTimeAsync(0);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.resetAllMocks();
  const storage = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
  });
  vi.stubGlobal('window', new EventTarget());
  vi.stubGlobal('document', Object.assign(new EventTarget(), { visibilityState: 'visible' }));
  olvidarActividad();
  anotarActividad();
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  mocks.getSession.mockResolvedValue({ data: { session: session() }, error: null });
  mocks.single.mockResolvedValue(profile());
  mocks.signOut.mockResolvedValue({ error: null });
  mocks.onAuthStateChange.mockImplementation(callback => {
    emit = callback;
    return { data: { subscription: { unsubscribe: vi.fn() } } };
  });
});

afterEach(async () => {
  if (root) await act(async () => root.unmount());
  client.clear();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('aislamiento de sesiones', () => {
  it('permite iniciar una sesión nueva y carga el perfil a través del evento de Auth', async () => {
    mocks.getSession.mockResolvedValue({ data: { session: null }, error: null });
    mocks.signInWithPassword.mockImplementation(async () => {
      emit('SIGNED_IN', session());
      return { data: session(), error: null };
    });
    await mount();
    await act(async () => {
      expect(await state.login('prueba@example.com', 'SoloParaPruebas1!')).toMatchObject({ success: true });
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(state.user?.id).toBe('usuario-a');
  });

  it('cierra una cuenta desactivada al revalidar su perfil', async () => {
    await mount();
    const disabled = profile();
    disabled.data.activo = false;
    mocks.single.mockResolvedValue(disabled);
    await authEvent('TOKEN_REFRESHED', session());
    expect(state.user).toBeNull();
    expect(mocks.signOut).toHaveBeenCalledOnce();
  });

  it('borra datos privados inmediatamente aunque cerrar sesión siga esperando la red', async () => {
    await mount();
    client.setQueryData(['estudiantes'], [{ privado: true }]);
    let finish!: (value: { error: null }) => void;
    mocks.signOut.mockReturnValue(new Promise(resolve => { finish = resolve; }));
    let logout!: Promise<void>;
    await act(async () => { logout = state.logout(); });
    expect(state.user).toBeNull();
    expect(client.getQueryData(['estudiantes'])).toBeUndefined();
    await act(async () => { finish({ error: null }); await logout; });
  });

  it('una respuesta de perfil tardía no restaura la sesión cerrada', async () => {
    await mount();
    let finish!: (value: ReturnType<typeof profile>) => void;
    mocks.single.mockReturnValue(new Promise(resolve => { finish = resolve; }));
    await authEvent('TOKEN_REFRESHED', session());
    await act(async () => { await state.logout(); });
    await act(async () => { finish(profile()); });
    expect(state.user).toBeNull();
  });

  it('borra la caché al recibir un cierre desde otra pestaña', async () => {
    await mount();
    client.setQueryData(['estudiantes'], ['privado']);
    await authEvent('SIGNED_OUT', null);
    expect(state.user).toBeNull();
    expect(client.getQueryCache().getAll()).toHaveLength(0);
  });

  it('limpia los datos del usuario anterior antes de cargar el perfil siguiente', async () => {
    await mount();
    client.setQueryData(['estudiantes'], ['privado']);
    mocks.single.mockReturnValue(new Promise(() => {}));
    await authEvent('SIGNED_IN', session('usuario-b'));
    expect(state.user).toBeNull();
    expect(client.getQueryCache().getAll()).toHaveLength(0);
  });

  it('un cambio de rol descarta las consultas del permiso anterior', async () => {
    await mount();
    client.setQueryData(['estudiantes'], ['privado']);
    mocks.single.mockResolvedValue(profile('usuario-a', 'aseo'));
    await authEvent('TOKEN_REFRESHED', session());
    expect(state.user?.rol).toBe('aseo');
    expect(client.getQueryCache().getAll()).toHaveLength(0);
  });

  it('una consulta en vuelo no vuelve a llenar la caché tras cerrar sesión', async () => {
    await mount();
    let finish!: (value: string[]) => void;
    const pending = client.fetchQuery({ queryKey: ['estudiantes'], queryFn: () => new Promise<string[]>(resolve => { finish = resolve; }) });
    const settled = pending.catch(() => undefined);
    await act(async () => { await state.logout(); });
    finish(['privado']);
    await settled;
    expect(client.getQueryCache().getAll()).toHaveLength(0);
  });

  it('los refrescos automáticos no extienden los 30 minutos de inactividad', async () => {
    await mount();
    await act(async () => { await vi.advanceTimersByTimeAsync(20 * 60 * 1000); });
    await authEvent('TOKEN_REFRESHED', session());
    await act(async () => { await vi.advanceTimersByTimeAsync(10 * 60 * 1000); });
    expect(state.user).toBeNull();
    expect(mocks.signOut).toHaveBeenCalledOnce();
  });

  it('un clic al volver a una pestaña vencida no revive la sesión', async () => {
    await mount();
    vi.setSystemTime(Date.now() + PLAZO_INACTIVIDAD_MS);
    await act(async () => { window.dispatchEvent(new Event('pointerdown')); });
    expect(state.user).toBeNull();
    expect(mocks.signOut).toHaveBeenCalledOnce();
  });
});
