-- Aplicar una vez en Supabase > SQL Editor si el esquema principal ya fue creado.
-- Impide que un usuario no-director sin sede asignada acceda a ambas sedes.

create or replace function public.can_access_sede(target_sede text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_active_user()
    and (
      public.current_profile_role() = 'director'
      or exists (
        select 1 from public.perfiles_sedes ps
        where ps.perfil_id = auth.uid() and ps.sede_id = target_sede
      )
    );
$$;
