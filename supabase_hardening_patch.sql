-- =============================================================================
-- Hardening pendiente - 2026-08-28  [YA APLICADO en la base el 2026-08-28]
-- Se conserva como registro de lo que se corrio. Es idempotente: volver a
-- ejecutarlo no cambia nada.
--
-- El grueso del hardening (RLS, politicas, auditoria_vista con security_invoker,
-- revoke update on perfiles) ya vive en supabase_schema.sql y esta aplicado en
-- la base. Este archivo cubre lo unico que faltaba: los privilegios que Supabase
-- otorga por defecto al rol `anon` sobre los objetos nuevos del esquema public,
-- y las funciones SECURITY DEFINER que quedaron expuestas como RPC
-- (advisors 0028 / 0029 del linter de Supabase).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. La traza de auditoria no debe ser alcanzable por sesiones sin autenticar.
--    RLS ya devolvia 0 filas; esto quita ademas el privilegio de tabla.
-- -----------------------------------------------------------------------------
revoke all on public.auditoria from anon;
revoke all on public.auditoria_vista from anon;

-- -----------------------------------------------------------------------------
-- 2. Funciones de trigger / event trigger: no tienen por que ser invocables
--    como RPC. Disparar un trigger no exige EXECUTE al usuario que hace la
--    operacion, asi que la auditoria y las protecciones de perfiles siguen
--    funcionando igual despues de este revoke.
-- -----------------------------------------------------------------------------
-- OJO: hay que revocar a `public`, no solo a anon/authenticated. Postgres da
-- EXECUTE a PUBLIC por defecto (el `=X/postgres` del proacl), y anon y
-- authenticated heredan de ahi: revocarles solo a ellos no quita nada.
revoke all on function public.audit_row_change() from public, anon, authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.protect_admin_profiles() from public, anon, authenticated;
revoke all on function public.rls_auto_enable() from public, anon, authenticated;
revoke all on function public.enforce_student_sede() from public, anon, authenticated;
revoke all on function public.set_updated_at() from public, anon, authenticated;

-- Administracion de usuarios: solo sesiones autenticadas.
-- La funcion ya valida internamente que el llamante sea director.
-- El grant explicito a authenticated sobrevive al revoke de public.
revoke all on function public.update_user_profile(uuid, text, text, text[], boolean) from public, anon;

-- Helper sin uso en politicas ni en la app.
revoke all on function public.current_profile_sede() from public, anon;

-- NOTA deliberada: has_role, can_access_sede, is_active_user y
-- current_profile_role SI siguen siendo ejecutables por anon y authenticated.
-- Las politicas RLS las evaluan en tiempo de consulta con los privilegios del
-- rol que consulta: revocarlas convertiria cada SELECT en un error 42501 en vez
-- de en un resultado vacio. Solo informan sobre el propio llamante, no exponen
-- datos de terceros.

-- -----------------------------------------------------------------------------
-- 3. OPCIONAL - el resto de los grants por defecto de `anon`. Ninguna politica
--    se los permite (todas exigen `to authenticated`), asi que hoy no son un
--    agujero, pero sobran. Descomentar solo despues de comprobar que la app no
--    consulta nada antes del login: sin el grant, esas consultas pasan de
--    devolver 0 filas a fallar con 42501.
-- -----------------------------------------------------------------------------
-- revoke all on public.perfiles from anon;
-- revoke all on public.perfiles_sedes from anon;
-- revoke all on public.sedes from anon;
-- revoke all on public.cursos from anon;
-- revoke all on public.estudiantes from anon;
-- revoke all on public.asistencia from anon;
-- revoke all on public.sesiones_fono from anon;
-- revoke all on public.estudiantes_documentos from anon;

-- -----------------------------------------------------------------------------
-- 4. Desactivar la cuenta de prueba creada solo para verificar las politicas.
--    Con activo = false, is_active_user() devuelve false y todas las politicas
--    le niegan el acceso sin borrar su historial de auditoria.
-- -----------------------------------------------------------------------------
update public.perfiles set activo = false where email = 'alvariwis0411@gmail.com';

-- -----------------------------------------------------------------------------
-- 5. Verificacion posterior (deberia devolver 0 filas).
-- -----------------------------------------------------------------------------
-- select table_name, privilege_type
--   from information_schema.role_table_grants
--  where table_schema = 'public'
--    and grantee = 'anon'
--    and table_name in ('auditoria', 'auditoria_vista');
--
-- select email, activo from public.perfiles where email = 'alvariwis0411@gmail.com';
--
-- select proname, proacl::text from pg_proc p
--   join pg_namespace n on n.oid = p.pronamespace and n.nspname = 'public'
--  where proname in ('audit_row_change', 'update_user_profile');
-- -> el ACL no debe contener `=X/postgres` (PUBLIC) ni `anon=X`.
