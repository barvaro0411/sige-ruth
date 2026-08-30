-- =============================================================================
-- Seguridad — El alta de usuario deja de confiar en datos del cliente
--
-- `handle_new_user()` tomaba el rol y la sede de `raw_user_meta_data`, que es
-- un campo que el cliente controla por completo en el registro:
--
--   supabase.auth.signUp({ email, password, options: { data: { rol: 'director' } } })
--
-- La funcion validaba que el rol existiera, pero no que quien lo pide tenga
-- derecho a pedirlo. Con el registro publico abierto, cualquiera con la clave
-- publicable —que viaja en el bundle, por diseno— se creaba una cuenta de
-- director: todas las sedes, todos los estudiantes, administracion de usuarios.
--
-- Hoy NO es explotable: el registro publico esta desactivado en el proyecto
-- (`disable_signup: true`). Pero la proteccion era un interruptor del panel, no
-- una propiedad del sistema. El dia que alguien habilite el registro —para que
-- se inscriban apoderados, por ejemplo— la escalada se arma sola y en silencio.
--
-- La Edge Function `admin-users` ya habia entendido esto: crea la cuenta con
-- `user_metadata: { nombre }` y comenta explicitamente que el rol y las sedes no
-- viajan ahi porque el usuario puede editarlos. Despues fija el rol con la
-- clave de servicio. El endurecimiento se hizo en la funcion y no llego al
-- trigger; esta migration cierra esa mitad.
--
-- Que cambia:
--   · El rol y la sede del cliente se ignoran por completo.
--   · Toda cuenta nueva nace inactiva. `activo = false` es un bloqueo total:
--     `is_active_user()`, `current_profile_role()`, `has_role()` y
--     `can_access_sede()` dependen de el, asi que la sesion no puede leer ni
--     escribir nada hasta que alguien con permiso la habilite.
--   · `nombre` se sigue tomando del cliente: es solo una etiqueta.
--
-- No rompe la creacion de usuarios: `admin-users` fija rol, sede y
-- `activo = true` inmediatamente despues, con la clave de servicio.
-- =============================================================================

begin;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  -- Ni rol ni sede salen de `raw_user_meta_data`: ese campo lo escribe quien se
  -- registra. Quien puede otorgar un rol es `admin-users` (clave de servicio) o
  -- `update_user_profile()` (solo director), y las dos actuan despues de esto.
  insert into public.perfiles (id, email, nombre, rol, sede_id, activo)
  values (
    new.id,
    coalesce(new.email, new.id::text || '@sin-email.local'),
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'nombre'), ''),
             split_part(coalesce(new.email, 'Usuario'), '@', 1)),
    'docente',   -- marcador de posicion; sin `activo` no habilita nada
    null,
    false        -- nace bloqueada: alguien con permiso tiene que habilitarla
  )
  on conflict (id) do update set email = excluded.email;

  return new;
end;
$fn$;

comment on function public.handle_new_user() is
  'Crea el perfil al registrarse una cuenta. Ignora el rol y la sede que mande el cliente, y la deja inactiva: habilitarla es una decision de alguien con permiso.';

commit;
