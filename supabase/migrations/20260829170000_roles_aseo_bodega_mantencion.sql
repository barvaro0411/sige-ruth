-- =============================================================================
-- Fase 1 — Roles de aseo, bodega y mantención
--
-- Son tres funciones reales de la escuela que hoy no tienen cuenta y resuelven
-- todo por WhatsApp o de palabra. Cada una necesita ver poco y hacer poco:
-- la persona de aseo pide insumos, quien mantiene reporta y repara, bodega
-- administra el stock.
--
-- No son transversales: trabajan en una sede y se les asigna como al resto.
-- =============================================================================

begin;

alter table public.perfiles drop constraint if exists perfiles_rol_check;
alter table public.perfiles add constraint perfiles_rol_check
  check (rol in (
    'director','sostenedor','secretaria','docente','fonoaudiologo','jefe_utp',
    'aseo','bodega','mantencion'
  ));

comment on column public.perfiles.rol is
  'Rol del trabajador. director y sostenedor son transversales (todas las sedes, sede_id null); el resto trabaja en las sedes de perfiles_sedes.';

-- La RPC de administración tiene su propia lista blanca: si no se actualiza,
-- el director no puede crear estas cuentas aunque el CHECK ya las admita.
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
  if target_rol not in ('director','sostenedor','secretaria','docente','fonoaudiologo','jefe_utp',
                        'aseo','bodega','mantencion') then
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
  if requested_role not in ('director','sostenedor','secretaria','docente','fonoaudiologo','jefe_utp',
                            'aseo','bodega','mantencion') then
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
-- Quién gestiona la bodega
--
-- En una escuela chica puede no haber una persona dedicada: lo habitual es que
-- lo haga secretaría o la dirección. Por eso la capacidad no depende de que
-- exista el rol `bodega`, y se puede operar sin crear esa cuenta.
--
-- Se centraliza acá para que las políticas de inventario (fase 2) no repitan
-- la lista de roles en cada una: cambiarla después es un solo lugar.
-- -----------------------------------------------------------------------------
create or replace function public.gestiona_bodega()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_role(array['director','sostenedor','secretaria','bodega']);
$$;

comment on function public.gestiona_bodega() is
  'Quien puede administrar stock, registrar movimientos y preparar entregas.';

create or replace function public.gestiona_mantencion()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_role(array['director','sostenedor','mantencion']);
$$;

comment on function public.gestiona_mantencion() is
  'Quien puede cambiar el estado de una mantención y cerrarla con su costo.';

revoke all on function public.gestiona_bodega()    from public, anon;
revoke all on function public.gestiona_mantencion() from public, anon;
grant execute on function public.gestiona_bodega()    to authenticated;
grant execute on function public.gestiona_mantencion() to authenticated;

commit;
