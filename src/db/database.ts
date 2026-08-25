import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
  || import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error(
    'Faltan VITE_SUPABASE_URL o la clave pública de Supabase en el archivo .env'
  );
}

/**
 * Cliente de Supabase Seguro
 * Configurado para trabajar con RLS nativo y Auth nativo.
 */
export const supabase = createClient(supabaseUrl, supabasePublishableKey);

/**
 * Nota sobre Auditoría:
 * El registro de auditoría ahora es AUTOMÁTICO en la base de datos
 * mediante triggers definidos en el esquema SQL (fn_audit_log).
 * No es necesario llamar a funciones manuales desde el frontend.
 */
