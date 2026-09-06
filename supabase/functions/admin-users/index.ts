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
  'director', 'sostenedor', 'secretaria', 'docente', 'fonoaudiologo', 'jefe_utp',
  'aseo', 'bodega', 'mantencion',
]);

// Transversales a la institución: acceden a todas las sedes, no se les asigna
// ninguna. Debe coincidir con ROLES_TRANSVERSALES del frontend y con la RPC
// update_user_profile de la base.
const rolesTransversales = new Set(['director', 'sostenedor']);

function isStrongPassword(password: string) {
  return password.length >= 12
    && /[a-z]/.test(password)
    && /[A-Z]/.test(password)
    && /[0-9]/.test(password)
    && /[^A-Za-z0-9]/.test(password);
}

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

  // El origen se exige, no se comprueba «si viene». Antes la condición era
  // `origin && !permitido`, así que una petición sin cabecera `Origin` —o sea
  // cualquier cliente que no sea un navegador— saltaba el filtro entero.
  //
  // Esto no es la barrera de seguridad: la barrera es el JWT verificado más
  // abajo y el chequeo de rol. Es una capa más, y como tal tiene que cumplirse
  // siempre o no estar.
  if (!origin || !allowedOrigins.includes(origin)) {
    return json({ success: false, error: 'Origen no autorizado' }, 403, corsHeaders);
  }
  if (request.method !== 'POST') return json({ success: false, error: 'Método no permitido' }, 405, corsHeaders);
  const contentLength = Number(request.headers.get('Content-Length') || 0);
  if (contentLength > 16 * 1024) {
    return json({ success: false, error: 'Solicitud demasiado grande' }, 413, corsHeaders);
  }

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

  let body: Record<string, unknown>;
  try {
    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > 16 * 1024) {
      return json({ success: false, error: 'Solicitud demasiado grande' }, 413, corsHeaders);
    }
    body = JSON.parse(rawBody);
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Cuerpo inválido');
  } catch {
    return json({ success: false, error: 'Solicitud inválida' }, 400, corsHeaders);
  }

  if (body.action === 'change_initial_password') {
    if (!caller?.activo) {
      return json({ success: false, error: 'La cuenta no tiene un perfil activo' }, 403, corsHeaders);
    }
    const newPassword = String(body.password || '');
    if (!authData.user.app_metadata?.must_change_password) {
      return json({ success: false, error: 'La cuenta no requiere un cambio inicial' }, 409, corsHeaders);
    }
    // El límite cubre también este camino: sin él, una sesión con contraseña
    // temporal puede martillear la función probando contraseñas hasta dar con
    // una que pase el chequeo de robustez.
    const { data: permitidoCambio, error: errorLimiteCambio } = await admin.rpc(
      'consume_admin_user_rate_limit',
      { p_actor: authData.user.id },
    );
    if (errorLimiteCambio) {
      return json({ success: false, error: 'No se pudo validar el límite de solicitudes' }, 500, corsHeaders);
    }
    if (!permitidoCambio) {
      return json({ success: false, error: 'Demasiados intentos. Espera cinco minutos.' }, 429, corsHeaders);
    }
    if (!isStrongPassword(newPassword)) {
      return json({ success: false, error: 'Usa al menos 12 caracteres, mayúscula, minúscula, número y símbolo' }, 400, corsHeaders);
    }
    const { error: changeError } = await admin.auth.admin.updateUserById(authData.user.id, {
      password: newPassword,
      app_metadata: { ...authData.user.app_metadata, must_change_password: false },
    });
    if (changeError) {
      return json({ success: false, error: 'No se pudo cambiar la contraseña' }, 400, corsHeaders);
    }
    return json({ success: true }, 200, corsHeaders);
  }

  if (body.action !== 'create') {
    return json({ success: false, error: 'Acción no permitida' }, 400, corsHeaders);
  }
  if (!caller?.activo || caller.rol !== 'director') {
    return json({ success: false, error: 'Solo el director puede crear usuarios' }, 403, corsHeaders);
  }

  const { data: permitido, error: rateError } = await admin.rpc(
    'consume_admin_user_rate_limit',
    { p_actor: authData.user.id },
  );
  if (rateError) return json({ success: false, error: 'No se pudo validar el límite de solicitudes' }, 500, corsHeaders);
  if (!permitido) {
    return json({ success: false, error: 'Demasiados intentos. Espera cinco minutos.' }, 429, corsHeaders);
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

  if (nombre.length < 3 || nombre.length > 120
      || email.length > 254 || !/^\S+@\S+\.\S+$/.test(email)) {
    return json({ success: false, error: 'Nombre o correo inválido' }, 400, corsHeaders);
  }
  if (password.length > 128 || sedeIds.length > 10) {
    return json({ success: false, error: 'Solicitud inválida' }, 400, corsHeaders);
  }
  if (!isStrongPassword(password)) {
    return json({ success: false, error: 'Usa al menos 12 caracteres, mayúscula, minúscula, número y símbolo' }, 400, corsHeaders);
  }
  if (!allowedRoles.has(rol)) {
    return json({ success: false, error: 'Rol inválido' }, 400, corsHeaders);
  }
  if (!rolesTransversales.has(rol) && sedeIds.length === 0) {
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

  const authorizedSedes = rolesTransversales.has(rol) ? [] : sedeIds;
  const primarySede = authorizedSedes[0] || null;

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { must_change_password: true },
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
