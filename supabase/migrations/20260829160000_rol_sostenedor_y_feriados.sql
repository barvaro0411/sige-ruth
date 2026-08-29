-- =============================================================================
-- Fase 0 · 1/3 — Rol sostenedor, feriados y dias habiles
--
-- Parte del estado REAL de produccion (7 migrations aplicadas al 28-08-2026),
-- no de una base vacia. Sustituye la primera mitad de supabase_gestion_patch.sql,
-- que fue escrito asumiendo una instalacion limpia y hoy fallaria.
--
-- No toca estudiantes, cursos ni sesiones_fono.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 1. Rol sostenedor
--
-- Existe porque nadie resuelve su propia solicitud, ni el director. Alguien
-- tiene que poder resolver las del director, y esa es la sostenedora.
-- Es transversal a la institucion: no se le asigna sede, como al director.
-- -----------------------------------------------------------------------------
alter table public.perfiles drop constraint if exists perfiles_rol_check;
alter table public.perfiles add constraint perfiles_rol_check
  check (rol in ('director','secretaria','docente','fonoaudiologo','jefe_utp','sostenedor'));

create or replace function public.update_user_profile(
  target_id uuid, target_nombre text, target_rol text,
  target_sede_ids text[], target_activo boolean
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
  if target_rol not in ('director','secretaria','docente','fonoaudiologo','jefe_utp','sostenedor') then
    raise exception 'Rol invalido';
  end if;
  if target_id = auth.uid() and target_rol <> 'director' then
    raise exception 'No puedes cambiar tu propio rol de director';
  end if;
  if target_rol not in ('director','sostenedor')
     and coalesce(array_length(target_sede_ids, 1), 0) = 0 then
    raise exception 'El usuario debe tener al menos una sede';
  end if;
  if exists (
    select 1 from unnest(coalesce(target_sede_ids, array[]::text[])) requested(id)
    left join public.sedes s on s.id = requested.id and s.activo = true
    where s.id is null
  ) then
    raise exception 'Una de las sedes no es valida';
  end if;

  primary_sede := case when target_rol in ('director','sostenedor') then null else target_sede_ids[1] end;

  update public.perfiles
  set nombre = trim(target_nombre), rol = target_rol, sede_id = primary_sede, activo = target_activo
  where id = target_id;

  if not found then raise exception 'Usuario no encontrado'; end if;

  delete from public.perfiles_sedes where perfil_id = target_id;
  if target_rol not in ('director','sostenedor') then
    insert into public.perfiles_sedes (perfil_id, sede_id)
    select target_id, requested.id
    from (select distinct unnest(target_sede_ids) as id) requested;
  end if;
end;
$$;

-- La sostenedora ve todas las sedes, igual que el director.
create or replace function public.can_access_sede(target_sede text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_active_user()
    and (
      public.current_profile_role() in ('director','sostenedor')
      or exists (
        select 1 from public.perfiles_sedes ps
        where ps.perfil_id = auth.uid() and ps.sede_id = target_sede
      )
    );
$$;

-- El trigger que crea el perfil al registrar un usuario tambien tiene su propia
-- lista blanca; si no se actualiza, un alta con rol sostenedor cae a 'docente'.
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
  requested_role := coalesce(new.raw_user_meta_data ->> 'rol', 'docente');
  if requested_role not in ('director','secretaria','docente','fonoaudiologo','jefe_utp','sostenedor') then
    requested_role := 'docente';
  end if;

  requested_sede := new.raw_user_meta_data ->> 'sede_id';
  if requested_sede is not null
     and not exists (select 1 from public.sedes where id = requested_sede) then
    requested_sede := null;
  end if;

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

-- -----------------------------------------------------------------------------
-- 2. Feriados y dias habiles
--
-- La tabla `feriados` ya existe con 32 filas cargadas: no se toca su contenido.
-- Lo que cambia es el calculo, que hoy solo descuenta sabados y domingos.
-- -----------------------------------------------------------------------------

-- Fecha "de hoy" en horario de Chile. En UTC, despues de las 21:00 la base
-- responde el dia siguiente y las alertas de vencimiento se adelantan un dia.
create or replace function public.hoy_santiago()
returns date
language sql
stable
as $$ select (now() at time zone 'America/Santiago')::date; $$;

-- Deja de ser IMMUTABLE: ahora consulta la tabla de feriados. No participa en
-- ningun indice, asi que el cambio de volatilidad es seguro.
create or replace function public.dias_habiles_permiso(desde date, hasta date, jornada text)
returns numeric
language sql
stable
set search_path = public
as $$
  select case when jornada = 'completa' then habiles else habiles * 0.5 end
  from (
    select count(*)::numeric as habiles
    from generate_series(desde, hasta, interval '1 day') d
    where extract(isodow from d) < 6
      and not exists (select 1 from public.feriados f where f.fecha = d::date)
  ) t;
$$;

comment on table public.feriados is
  'Feriados legales y dias no laborables. Sin datos del ano, el calculo solo descuenta sabados y domingos.';

-- La jefatura mantiene el calendario; la sostenedora tambien.
drop policy if exists "feriados_manage_director" on public.feriados;
drop policy if exists "feriados_manage" on public.feriados;
create policy "feriados_manage" on public.feriados
  for all to authenticated
  using (public.has_role(array['director','sostenedor']))
  with check (public.has_role(array['director','sostenedor']));

revoke all on function public.hoy_santiago() from public, anon;
grant execute on function public.hoy_santiago() to authenticated;

commit;
