-- =============================================================================
-- Pruebas: alta de cuenta
--
-- Regresion de una escalada de privilegios. `handle_new_user()` tomaba el rol
-- de `raw_user_meta_data`, que lo escribe quien se registra:
--
--   supabase.auth.signUp({ email, password, options: { data: { rol: 'director' } } })
--
-- Con el registro publico abierto, eso era una cuenta de director para
-- cualquiera que tuviera la clave publicable — que viaja en el bundle.
--
-- Estas comprobaciones fijan la regla: el cliente no elige su rol, y ninguna
-- cuenta nueva nace habilitada.
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/04_alta_de_usuario.sql
-- =============================================================================

begin;

create temp table resultado (n int, prueba text, esperado text, obtenido text) on commit drop;
grant all on resultado to authenticated;

do $pruebas$
declare
  uid uuid := gen_random_uuid();
  v_rol text; v_activo boolean; v_sede text; n int;
  alguna_sede text;
begin
  select id into alguna_sede from public.sedes where activo order by id limit 1;

  -- Se simula el registro mas hostil posible: pidiendo rol de director y una
  -- sede concreta desde los metadatos que controla el cliente.
  insert into auth.users (
    id, instance_id, aud, role, email,
    encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at
  ) values (
    uid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'prueba-escalada-' || uid::text || '@ejemplo.local',
    crypt('contrasena-de-prueba', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    json_build_object('nombre','Intento de escalada','rol','director','sede_id', alguna_sede)::jsonb,
    now(), now()
  );

  select rol, activo, sede_id into v_rol, v_activo, v_sede
  from public.perfiles where id = uid;

  insert into resultado values
    (1, 'El rol pedido por el cliente se ignora', 'no es director',
        case when v_rol is distinct from 'director' then 'no es director' else 'ES DIRECTOR' end),
    (2, 'La cuenta nueva nace inactiva', 'false', coalesce(v_activo::text, 'sin perfil')),
    (3, 'La sede pedida por el cliente se ignora', 'sin sede',
        case when v_sede is null then 'sin sede' else 'tiene sede' end);

  -- Una cuenta inactiva no pasa ninguna de las puertas de autorizacion.
  set local role authenticated;
  perform set_config('request.jwt.claims',
    json_build_object('sub', uid, 'role','authenticated')::text, true);

  insert into resultado values
    (4, 'Una cuenta inactiva no es usuario activo', 'false', public.is_active_user()::text),
    (5, 'Una cuenta inactiva no tiene rol efectivo', 'sin rol',
        coalesce(public.current_profile_role(), 'sin rol')),
    (6, 'Una cuenta inactiva no accede a ninguna sede', 'false',
        public.can_access_sede(coalesce(alguna_sede,'x'))::text);

  select count(*) into n from public.estudiantes;
  insert into resultado values (7, 'Una cuenta inactiva no lee estudiantes', '0', n::text);

  reset role;
end
$pruebas$;

select n, prueba, esperado, obtenido,
       case when esperado = obtenido then 'OK' else 'FALLA' end as veredicto
from resultado order by n;

do $veredicto$
declare fallas int;
begin
  select count(*) into fallas from resultado where esperado is distinct from obtenido;
  if fallas > 0 then
    raise exception 'alta de usuario: % de % comprobaciones fallaron',
      fallas, (select count(*) from resultado);
  end if;
  raise notice 'alta de usuario: % comprobaciones OK', (select count(*) from resultado);
end
$veredicto$;

rollback;
