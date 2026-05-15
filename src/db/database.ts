import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const SUPABASE_FETCH_TIMEOUT_MS = 12000;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Faltan variables de entorno para Supabase. Verifique su archivo .env');
}

const fetchWithTimeout: typeof fetch = async (input, init) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), SUPABASE_FETCH_TIMEOUT_MS);
  const abortController = () => controller.abort();

  if (init?.signal) {
    if (init.signal.aborted) abortController();
    else init.signal.addEventListener('abort', abortController, { once: true });
  }

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
    init?.signal?.removeEventListener('abort', abortController);
  }
};

/**
 * Cliente de Supabase Seguro
 * Configurado para trabajar con RLS nativo y Auth nativo.
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: {
    fetch: fetchWithTimeout,
  },
});

/**
 * Nota sobre Auditoría:
 * El registro de auditoría ahora es AUTOMÁTICO en la base de datos
 * mediante triggers definidos en el esquema SQL (fn_audit_log).
 * No es necesario llamar a funciones manuales desde el frontend.
 */
