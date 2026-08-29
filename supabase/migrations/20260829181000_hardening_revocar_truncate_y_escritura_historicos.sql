-- =============================================================================
-- Hardening — Quitar TRUNCATE y la escritura sobre las tablas de historial
--
-- Encontrado al probar la fase 2: un `delete` sobre inventario_movimientos no
-- daba error, simplemente no borraba nada. Al mirar por qué apareció algo más
-- grande.
--
-- Supabase concede por defecto TODOS los privilegios a `anon` y `authenticated`
-- sobre cada tabla nueva del esquema public. Las 25 tablas del proyecto tenían
-- TRUNCATE concedido, incluidas `estudiantes` y `auditoria`.
--
-- TRUNCATE **no pasa por RLS**: ninguna política lo detiene. Por la API REST no
-- es alcanzable (PostgREST no expone TRUNCATE), pero con una conexión Postgres
-- directa usando el JWT de un usuario sí lo sería.
--
-- Y sobre las tablas append-only, tener UPDATE/DELETE hacía que un intento de
-- borrado no fallara sino que no hiciera nada en silencio, que se lee peor que
-- un error claro.
--
-- Aplica a todo el esquema, no solo a lo creado en esta fase.
-- =============================================================================

begin;

-- 1. La aplicación no necesita TRUNCATE, TRIGGER ni REFERENCES en ninguna tabla.
do $$
declare r record;
begin
  for r in
    select c.relname
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r','p','v','m')
  loop
    execute format(
      'revoke truncate, trigger, references on public.%I from anon, authenticated',
      r.relname);
  end loop;
end;
$$;

-- 2. Las tablas de historial son append-only: las escriben triggers
--    SECURITY DEFINER, que corren como el dueño y no necesitan estos permisos.
revoke insert, update, delete on public.auditoria                        from anon, authenticated;
revoke insert, update, delete on public.historial_solicitudes_permiso    from anon, authenticated;
revoke insert, update, delete on public.historial_solicitudes_materiales from anon, authenticated;

-- 3. Un movimiento de inventario se agrega y nunca se toca.
revoke update, delete on public.inventario_movimientos from anon, authenticated;

-- 4. Las notificaciones las escribe el servidor; el cliente solo las marca
--    leídas (y el trigger impedir_edicion_notificacion limita qué puede
--    cambiar en ese UPDATE).
revoke insert, delete on public.notificaciones from anon, authenticated;

-- 5. Que las tablas futuras no nazcan con todo concedido.
alter default privileges in schema public
  revoke truncate, trigger, references on tables from anon, authenticated;

-- 6. `anon` no tiene nada que hacer acá: no hay ninguna pantalla pública.
do $$
declare r record;
begin
  for r in
    select c.relname
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r','p','v','m')
  loop
    execute format('revoke all on public.%I from anon', r.relname);
  end loop;
end;
$$;

commit;
