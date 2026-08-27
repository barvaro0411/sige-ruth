/**
 * Compatibilidad. El cliente Supabase vive en `src/db/database.ts`.
 * Se reexporta para evitar una segunda instancia de GoTrue compartiendo el
 * mismo storage key (carreras al refrescar el token). No crear clientes aquí.
 */
export { supabase } from '../db/database';
