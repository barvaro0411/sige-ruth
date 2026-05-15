import { afterEach, describe, expect, it, vi } from 'vitest';
import { withTimeout } from './AuthContext';

vi.mock('../db/database', () => ({
  supabase: {
    auth: {
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      getSession: vi.fn(),
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
    },
    from: vi.fn(),
  },
}));

describe('withTimeout', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('rechaza cuando la promesa no responde dentro del plazo', async () => {
    vi.useFakeTimers();
    const result = withTimeout(new Promise(() => {}), 100, 'timeout');

    vi.advanceTimersByTime(100);

    await expect(result).rejects.toThrow('timeout');
  });

  it('resuelve y limpia el timer si la promesa responde antes', async () => {
    vi.useFakeTimers();
    const result = withTimeout(Promise.resolve('ok'), 100, 'timeout');

    await expect(result).resolves.toBe('ok');
    vi.advanceTimersByTime(100);
  });
});
