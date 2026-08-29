-- Ejecutar una vez en Supabase > SQL Editor.
-- Permite asignar una o varias sedes a cada trabajador.

begin;

create table if not exists public.perfiles_sedes (
  perfil_id uuid not null references public.perfiles(id) on update cascade on delete cascade,
  sede_id text not null references public.sedes(id) on update cascade on delete cascade,
  created_at timestamptz not null default now(),
  primary key (perfil_id, sede_id)
);

insert into public.perfiles_sedes (perfil_id, sede_id)
select id, sede_id from public.perfiles where sede_id is not null
on conflict do nothing;

alter table public.perfiles_sedes enable row level security;
grant select, insert, delete on public.perfiles_sedes to authenticated;

drop policy if exists "perfiles_sedes_select" on public.perfiles_sedes;
drop policy if exists "perfiles_sedes_manage_director" on public.perfiles_sedes;
create policy "perfiles_sedes_select" on public.perfiles_sedes
  for select to authenticated
  using (perfil_id = auth.uid() or public.current_profile_role() = 'director');
create policy "perfiles_sedes_manage_director" on public.perfiles_sedes
  for all to authenticated
  using (public.current_profile_role() = 'director')
  with check (public.current_profile_role() = 'director');

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

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_role text;
  requested_sede text;
begin
  -- SEGURIDAD: rol y sede nunca provienen de raw_user_meta_data.
  requested_role := 'docente';
  requested_sede := null;

  insert into public.perfiles (id, email, nombre, rol, sede_id)
  values (
    new.id,
    coalesce(new.email, new.id::text || '@sin-email.local'),
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'nombre'), ''), split_part(coalesce(new.email, 'Usuario'), '@', 1)),
    requested_role,
    requested_sede
  )
  on conflict (id) do update set email = excluded.email;

  if requested_sede is not null then
    insert into public.perfiles_sedes (perfil_id, sede_id)
    values (new.id, requested_sede)
    on conflict do nothing;
  end if;

  return new;
end;
$$;

create or replace function public.update_user_profile(
  target_id uuid,
  target_nombre text,
  target_rol text,
  target_sede_ids text[],
  target_activo boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  primary_sede text;
begin
  if public.current_profile_role() <> 'director' then
    raise exception 'Solo el director puede administrar usuarios';
  end if;
  if target_rol not in ('director', 'secretaria', 'docente', 'fonoaudiologo', 'jefe_utp') then
    raise exception 'Rol inválido';
  end if;
  if target_id = auth.uid() and target_rol <> 'director' then
    raise exception 'No puedes cambiar tu propio rol de director';
  end if;
  if target_rol <> 'director' and coalesce(array_length(target_sede_ids, 1), 0) = 0 then
    raise exception 'El usuario debe tener al menos una sede';
  end if;
  if exists (
    select 1 from unnest(coalesce(target_sede_ids, array[]::text[])) requested(id)
    left join public.sedes s on s.id = requested.id and s.activo = true
    where s.id is null
  ) then
    raise exception 'Una de las sedes no es válida';
  end if;

  primary_sede := case when target_rol = 'director' then null else target_sede_ids[1] end;

  update public.perfiles
  set nombre = trim(target_nombre), rol = target_rol, sede_id = primary_sede, activo = target_activo
  where id = target_id;

  if not found then raise exception 'Usuario no encontrado'; end if;

  delete from public.perfiles_sedes where perfil_id = target_id;
  if target_rol <> 'director' then
    insert into public.perfiles_sedes (perfil_id, sede_id)
    select target_id, requested.id
    from (select distinct unnest(target_sede_ids) as id) requested;
  end if;
end;
$$;

grant execute on function public.update_user_profile(uuid, text, text, text[], boolean) to authenticated;

drop trigger if exists perfiles_sedes_audit on public.perfiles_sedes;
create trigger perfiles_sedes_audit
  after insert or update or delete on public.perfiles_sedes
  for each row execute function public.audit_row_change();

commit;
