import { createClient } from 'npm:@supabase/supabase-js@2';

// Origenes autorizados. Configurar con `supabase secrets set APP_ORIGINS=...`
// (lista separada por comas). Sin la variable solo se admite desarrollo local.
const allowedOrigins = (Deno.env.get('APP_ORIGINS') || 'http://localhost:5173')
  .split(',')
  .map(value => value.trim())
  .filter(Boolean);

function buildCorsHeaders(origin: string | null) {
  const headers: Record<string, string> = {
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
  if (origin && allowedOrigins.includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
  }
  return headers;
}

const allowedRoles = new Set([
  'director', 'secretaria', 'docente', 'fonoaudiologo', 'jefe_utp',
]);

function json(body: Record<string, unknown>, status = 200, corsHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function getSecretKey() {
  const directKey = Deno.env.get('SUPABASE_SECRET_KEY')
    || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (directKey) return directKey;

  const secretKeys = Deno.env.get('SUPABASE_SECRET_KEYS');
  if (!secretKeys) return null;
  try {
    return JSON.parse(secretKeys).default || null;
  } catch {
    return null;
  }
}

Deno.serve(async (request) => {
  const origin = request.headers.get('Origin');
  const corsHeaders = buildCorsHeaders(origin);

  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (origin && !allowedOrigins.includes(origin)) {
    return json({ success: false, error: 'Origen no autorizado' }, 403, corsHeaders);
  }
  if (request.method !== 'POST') return json({ success: false, error: 'Método no permitido' }, 405, corsHeaders);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const secretKey = getSecretKey();
  const authorization = request.headers.get('Authorization');

  if (!supabaseUrl || !secretKey) {
    return json({ success: false, error: 'La función no tiene configurada su clave administrativa' }, 500, corsHeaders);
  }
  if (!authorization?.startsWith('Bearer ')) {
    return json({ success: false, error: 'Sesión requerida' }, 401, corsHeaders);
  }

  const admin = createClient(supabaseUrl, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const accessToken = authorization.slice('Bearer '.length);
  const { data: authData, error: authError } = await admin.auth.getUser(accessToken);

  if (authError || !authData.user) {
    return json({ success: false, error: 'Sesión inválida o vencida' }, 401, corsHeaders);
  }

  const { data: caller } = await admin
    .from('perfiles')
    .select('rol, activo')
    .eq('id', authData.user.id)
    .single();

  if (!caller?.activo || caller.rol !== 'director') {
    return json({ success: false, error: 'Solo el director puede crear usuarios' }, 403, corsHeaders);
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return json({ success: false, error: 'Solicitud inválida' }, 400, corsHeaders);
  }

  if (body.action !== 'create') {
    return json({ success: false, error: 'Acción no permitida' }, 400, corsHeaders);
  }

  const nombre = String(body.nombre || '').trim();
  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');
  const rol = String(body.rol || '');
  const sedeIds = [...new Set(
    (Array.isArray(body.sede_ids) ? body.sede_ids : [])
      .map(value => String(value))
      .filter(Boolean),
  )];

  if (nombre.length < 3 || !/^\S+@\S+\.\S+$/.test(email)) {
    return json({ success: false, error: 'Nombre o correo inválido' }, 400, corsHeaders);
  }
  if (password.length < 8) {
    return json({ success: false, error: 'La contraseña debe tener al menos 8 caracteres' }, 400, corsHeaders);
  }
  if (!allowedRoles.has(rol)) {
    return json({ success: false, error: 'Rol inválido' }, 400, corsHeaders);
  }
  if (rol !== 'director' && sedeIds.length === 0) {
    return json({ success: false, error: 'El usuario debe tener al menos una sede' }, 400, corsHeaders);
  }
  if (sedeIds.length > 0) {
    const { data: sedesValidas, error: sedesError } = await admin
      .from('sedes')
      .select('id')
      .eq('activo', true)
      .in('id', sedeIds);

    if (sedesError || (sedesValidas?.length ?? 0) !== sedeIds.length) {
      return json({ success: false, error: 'Una de las sedes no es válida' }, 400, corsHeaders);
    }
  }

  const authorizedSedes = rol === 'director' ? [] : sedeIds;
  const primarySede = authorizedSedes[0] || null;

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    // El rol y las sedes NO viajan en user_metadata: es un campo editable por el
    // propio usuario. La fuente de verdad es public.perfiles/perfiles_sedes.
    user_metadata: { nombre },
  });

  if (createError || !created.user) {
    const duplicated = createError?.message.toLowerCase().includes('already');
    return json({
      success: false,
      error: duplicated ? 'Ya existe una cuenta con ese correo' : 'No se pudo crear la cuenta',
    }, duplicated ? 409 : 400, corsHeaders);
  }

  const { error: profileError } = await admin
    .from('perfiles')
    .update({ nombre, rol, sede_id: primarySede, activo: true })
    .eq('id', created.user.id);

  if (profileError) {
    await admin.auth.admin.deleteUser(created.user.id);
    return json({ success: false, error: 'No se pudo configurar el perfil del usuario' }, 500, corsHeaders);
  }

  if (authorizedSedes.length > 0) {
    const { error: sedeError } = await admin
      .from('perfiles_sedes')
      .upsert(authorizedSedes.map(sedeId => ({ perfil_id: created.user.id, sede_id: sedeId })));

    if (sedeError) {
      await admin.auth.admin.deleteUser(created.user.id);
      return json({ success: false, error: 'No se pudieron asignar las sedes del usuario' }, 500, corsHeaders);
    }
  }

  return json({ success: true, userId: created.user.id }, 201, corsHeaders);
});
