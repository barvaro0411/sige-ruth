-- =============================================================================
-- Fase 1 · corrección — Los helpers de autorización devuelven boolean, no NULL
--
-- Detectado al probar los roles nuevos con un usuario desactivado.
--
-- `current_profile_role()` filtra por `activo = true`, así que para un perfil
-- inactivo devuelve NULL. Y `NULL = any(array[...])` es NULL, no false: hasta
-- ahora `has_role()` respondía NULL en ese caso.
--
-- En una política RLS da lo mismo —NULL filtra la fila igual que false—, pero
-- estas funciones también son llamables por RPC desde el cliente, y ahí un NULL
-- se lee como «no se sabe» en vez de «no». Se hace explícito.
-- =============================================================================

begin;

create or replace function public.has_role(allowed_roles text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_profile_role() = any(allowed_roles), false);
$$;

create or replace function public.gestiona_bodega()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.has_role(array['director','sostenedor','secretaria','bodega']), false);
$$;

create or replace function public.gestiona_mantencion()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.has_role(array['director','sostenedor','mantencion']), false);
$$;

create or replace function public.can_access_sede(target_sede text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    public.is_active_user()
    and (
      public.current_profile_role() in ('director','sostenedor')
      or exists (
        select 1 from public.perfiles_sedes ps
        where ps.perfil_id = auth.uid() and ps.sede_id = target_sede
      )
    ), false);
$$;

commit;
