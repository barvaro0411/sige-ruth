import { createClient } from '@supabase/supabase-js';

/**
 * Cliente de Supabase. Uno solo en todo el proyecto: dos instancias de Auth
 * sobre el mismo storage compiten por refrescar el token.
 *
 * No hay valores por defecto a propósito. Antes había un `||` con la URL del
 * proyecto real y una clave inventada, y el efecto era que un despliegue mal
 * configurado no fallaba: arrancaba, apuntaba a producción con una clave falsa
 * y devolvía 401 en todo. El síntoma —«no carga nada»— no decía nada de la
 * causa. Ahora falta una variable y la app lo dice, en el primer segundo.
 */
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
  || import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabasePublishableKey);

if (!isSupabaseConfigured) {
  const falta = [
    !supabaseUrl && 'VITE_SUPABASE_URL',
    !supabasePublishableKey && 'VITE_SUPABASE_PUBLISHABLE_KEY',
  ].filter(Boolean).join(' y ');

  throw new Error(
    `Falta ${falta} en el entorno. Copia .env.example a .env con los valores de `
    + 'Supabase Dashboard > Project Settings > API, o configúralos en el proveedor '
    + 'de despliegue. La aplicación no arranca sin ellos.',
  );
}

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    // El token se guarda en localStorage y se renueva solo. `detectSessionInUrl`
    // se apaga porque acá no hay OAuth ni enlaces mágicos: nada legítimo llega
    // con una sesión en el fragmento de la URL.
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    flowType: 'pkce',
  },
  global: {
    headers: { 'x-application-name': 'gestion-ruth' },
  },
});
