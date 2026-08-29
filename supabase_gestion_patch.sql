-- =============================================================================
-- Gestion Ruth - Parche incremental  (NO APLICADO)
--
-- Idempotente: se puede correr varias veces sin efectos distintos.
-- Aplicar en Supabase > SQL Editor, en este orden, de una sola vez.
--
-- Cubre:
--   1. Rol `sostenedor`
--   2. Feriados y calculo de dias habiles con zona America/Santiago
--   3. Correcciones al modulo de permisos (estado `observada`, cupos, solapes,
--      historial, nadie aprueba lo propio)
--   4. Modulo de materiales
--   5. Notificaciones internas
--   6. Adjuntos en bucket privado
--
-- NO toca estudiantes, asistencia, cursos ni sesiones_fono.
-- =============================================================================

-- Todo el parche va en una sola transaccion: si algo falla, no queda nada
-- aplicado a medias. El SQL Editor de Supabase respeta BEGIN/COMMIT.
begin;

create extension if not exists btree_gist;

-- =============================================================================
-- 1. ROL SOSTENEDOR
-- =============================================================================
alter table public.perfiles drop constraint if exists perfiles_rol_check;
alter table public.perfiles add constraint perfiles_rol_check
  check (rol in ('director','secretaria','docente','fonoaudiologo','jefe_utp','sostenedor'));

-- La RPC de administracion de usuarios tiene su propia lista blanca de roles.
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
  -- La sostenedora es transversal a la institucion, como el director.
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

-- can_access_sede debe tratar a la sostenedora como transversal.
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

-- =============================================================================
-- 2. FERIADOS Y DIAS HABILES
-- =============================================================================
create table if not exists public.feriados (
  fecha         date primary key,
  nombre        text not null,
  irrenunciable boolean not null default false,
  created_at    timestamptz not null default now()
);

comment on table public.feriados is
  'Feriados legales y dias no laborables. Se carga por ano; sin datos, el calculo solo descuenta sabados y domingos.';

-- Fecha "de hoy" en horario de Chile, no en UTC.
create or replace function public.hoy_santiago()
returns date
language sql
stable
as $$ select (now() at time zone 'America/Santiago')::date; $$;

-- Ahora descuenta feriados ademas de fines de semana. Deja de ser IMMUTABLE
-- porque consulta una tabla.
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

-- =============================================================================
-- 3. PERMISOS: CORRECCIONES
-- =============================================================================

-- 3.1 Estado `observada`.
alter table public.solicitudes_permiso drop constraint if exists solicitudes_permiso_estado_check;
alter table public.solicitudes_permiso add constraint solicitudes_permiso_estado_check
  check (estado in ('pendiente','observada','aprobada','rechazada','cancelada'));

alter table public.solicitudes_permiso drop constraint if exists resolucion_coherente;
alter table public.solicitudes_permiso add constraint resolucion_coherente
  check (
    (estado in ('pendiente','observada') and resuelta_por is null and resuelta_en is null)
    or estado in ('aprobada','rechazada','cancelada')
  );

-- 3.2 El cupo anual deja de tener un valor por defecto: se configura por
--     persona y ano. Las filas ya creadas conservan su valor.
alter table public.cupos_permiso alter column dias_administrativos drop default;

comment on column public.cupos_permiso.dias_administrativos is
  'Dias administrativos del ano. Depende del contrato o estatuto de cada trabajador: se configura explicitamente, sin valor por defecto.';

-- 3.3 Sin solicitudes superpuestas para la misma persona.
alter table public.solicitudes_permiso drop constraint if exists solicitudes_permiso_sin_solape;
alter table public.solicitudes_permiso add constraint solicitudes_permiso_sin_solape
  exclude using gist (
    solicitante_id with =,
    daterange(fecha_inicio, fecha_fin, '[]') with &&
  ) where (estado in ('pendiente','observada','aprobada'));

-- 3.4 Historial de estados.
create table if not exists public.historial_solicitudes_permiso (
  id              bigint generated by default as identity primary key,
  solicitud_id    bigint not null references public.solicitudes_permiso(id) on delete cascade,
  estado_anterior text,
  estado_nuevo    text not null,
  actor_id        uuid references public.perfiles(id) on update cascade on delete set null,
  comentario      text,
  created_at      timestamptz not null default now()
);

create index if not exists historial_permiso_solicitud_idx
  on public.historial_solicitudes_permiso (solicitud_id, created_at);

create or replace function public.registrar_historial_permiso()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.historial_solicitudes_permiso (solicitud_id, estado_anterior, estado_nuevo, actor_id, comentario)
    values (new.id, null, new.estado, auth.uid(), 'Solicitud creada');
  elsif new.estado is distinct from old.estado then
    insert into public.historial_solicitudes_permiso (solicitud_id, estado_anterior, estado_nuevo, actor_id, comentario)
    values (new.id, old.estado, new.estado, auth.uid(), new.comentario_resolucion);
  end if;
  return new;
end;
$$;

drop trigger if exists solicitudes_permiso_historial on public.solicitudes_permiso;
create trigger solicitudes_permiso_historial
  after insert or update on public.solicitudes_permiso
  for each row execute function public.registrar_historial_permiso();

-- 3.5 Transiciones: nadie resuelve lo propio, ni siquiera el director.
--     Por eso existe el rol sostenedor: alguien tiene que resolver lo del director.
create or replace function public.enforce_permiso_transicion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  es_solicitante boolean := old.solicitante_id = auth.uid();
  es_jefatura    boolean := public.has_role(array['director','sostenedor']);
begin
  if old.estado in ('aprobada','rechazada','cancelada') then
    raise exception 'La solicitud ya fue resuelta y no admite cambios';
  end if;

  if new.estado is distinct from old.estado then
    if new.estado = 'cancelada' then
      if not es_solicitante then
        raise exception 'Solo quien solicita puede cancelar su solicitud';
      end if;
    elsif new.estado = 'pendiente' then
      -- Reenvio despues de una observacion: la corrige y la vuelve a mandar.
      if not es_solicitante then
        raise exception 'Solo quien solicita puede reenviar su solicitud';
      end if;
      if old.estado <> 'observada' then
        raise exception 'Solo una solicitud observada se puede reenviar';
      end if;
      new.comentario_resolucion := null;
    elsif new.estado in ('aprobada','rechazada','observada') then
      if es_solicitante then
        raise exception 'No puedes resolver tu propia solicitud';
      end if;
      if not es_jefatura then
        raise exception 'Solo la direccion o la sostenedora puede resolver solicitudes';
      end if;
      if new.estado in ('rechazada','observada')
         and coalesce(trim(new.comentario_resolucion), '') = '' then
        raise exception 'Rechazar u observar exige un comentario';
      end if;
    else
      raise exception 'Transicion de estado no permitida';
    end if;

    if new.estado in ('aprobada','rechazada') then
      new.resuelta_por := auth.uid();
      new.resuelta_en  := now();
    end if;
  end if;

  -- Fechas y motivo solo se editan mientras no esta resuelta, y por su autor.
  if (new.fecha_inicio, new.fecha_fin, new.jornada) is distinct from (old.fecha_inicio, old.fecha_fin, old.jornada) then
    if not es_solicitante then
      raise exception 'Solo quien solicita puede modificar las fechas';
    end if;
    new.dias_habiles := public.dias_habiles_permiso(new.fecha_inicio, new.fecha_fin, new.jornada);
  end if;

  return new;
end;
$$;

-- 3.6 Politicas alineadas: resuelven direccion y sostenedora.
drop policy if exists "permisos_select_propio_o_jefatura" on public.solicitudes_permiso;
create policy "permisos_select_propio_o_jefatura" on public.solicitudes_permiso
  for select to authenticated
  using (
    solicitante_id = auth.uid()
    or (public.can_access_sede(sede_id) and public.has_role(array['director','sostenedor']))
  );

drop policy if exists "permisos_update_propio_o_jefatura" on public.solicitudes_permiso;
create policy "permisos_update_propio_o_jefatura" on public.solicitudes_permiso
  for update to authenticated
  using (
    solicitante_id = auth.uid()
    or (public.can_access_sede(sede_id) and public.has_role(array['director','sostenedor']))
  )
  with check (
    solicitante_id = auth.uid()
    or (public.can_access_sede(sede_id) and public.has_role(array['director','sostenedor']))
  );

drop policy if exists "cupos_select_propio_o_jefatura" on public.cupos_permiso;
create policy "cupos_select_propio_o_jefatura" on public.cupos_permiso
  for select to authenticated
  using (perfil_id = auth.uid() or public.has_role(array['director','sostenedor']));

drop policy if exists "cupos_manage_director" on public.cupos_permiso;
create policy "cupos_manage_director" on public.cupos_permiso
  for all to authenticated
  using (public.has_role(array['director','sostenedor']))
  with check (public.has_role(array['director','sostenedor']));

-- Historial: se ve si se ve la solicitud. Nadie lo escribe a mano.
alter table public.historial_solicitudes_permiso enable row level security;
drop policy if exists "historial_permiso_select" on public.historial_solicitudes_permiso;
create policy "historial_permiso_select" on public.historial_solicitudes_permiso
  for select to authenticated
  using (exists (
    select 1 from public.solicitudes_permiso s
    where s.id = solicitud_id
      and (s.solicitante_id = auth.uid()
           or (public.can_access_sede(s.sede_id) and public.has_role(array['director','sostenedor'])))
  ));

-- Calendario de ausencias aprobadas, sin motivos.
--
-- Va como SECURITY DEFINER a proposito. Con security_invoker cada trabajador
-- veria solo sus propias ausencias y el calendario no serviria para coordinar
-- cobertura. Al saltarse la RLS, la vista expone unicamente quien y cuando:
-- nunca `tipo` ni `motivo`, porque un permiso puede ser una licencia medica.
-- El filtro de acceso va dentro de la propia vista.
-- El linter de Supabase la marcara (advisor 0010): es esperado.
drop view if exists public.calendario_ausencias_vista;
create view public.calendario_ausencias_vista as
select s.id, s.solicitante_id, s.sede_id, s.fecha_inicio, s.fecha_fin, s.jornada, s.dias_habiles
from public.solicitudes_permiso s
where s.estado = 'aprobada'
  and public.is_active_user()
  and public.can_access_sede(s.sede_id);

comment on view public.calendario_ausencias_vista is
  'Ausencias aprobadas para planificar cobertura. No expone tipo ni motivo: un permiso puede ser una licencia medica.';

-- =============================================================================
-- 4. MODULO DE MATERIALES
-- =============================================================================

create table if not exists public.solicitudes_materiales (
  id                      bigint generated by default as identity primary key,
  solicitante_id          uuid not null references public.perfiles(id) on update cascade on delete restrict,
  sede_id                 text not null references public.sedes(id)    on update cascade on delete restrict,
  titulo                  text not null check (length(btrim(titulo)) between 3 and 160),
  justificacion           text,
  curso_id                text,
  area                    text,
  prioridad               text not null default 'normal'
                            check (prioridad in ('baja','normal','alta','urgente')),
  fecha_necesidad         date,
  estado                  text not null default 'borrador'
                            check (estado in ('borrador','pendiente','observada','aprobada','rechazada',
                                              'en_compra','compra_parcial','comprada','entregada','cancelada')),
  -- Dinero siempre en numeric, nunca en float.
  costo_estimado_total    numeric(12,2) not null default 0 check (costo_estimado_total >= 0),
  presupuesto_autorizado  numeric(12,2) check (presupuesto_autorizado >= 0),
  costo_real_total        numeric(12,2) not null default 0 check (costo_real_total >= 0),
  enviada_en              timestamptz,
  revisada_por            uuid references public.perfiles(id) on update cascade on delete set null,
  revisada_en             timestamptz,
  comentario_revision     text,
  entrega_confirmada_por  uuid references public.perfiles(id) on update cascade on delete set null,
  entrega_confirmada_en   timestamptz,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  constraint solicitudes_materiales_curso_fk
    foreign key (curso_id, sede_id) references public.cursos(id, sede_id) on update cascade on delete restrict,
  constraint revision_coherente check (
    (estado in ('borrador','pendiente') and revisada_por is null and revisada_en is null)
    or estado not in ('borrador','pendiente')
  )
);

create index if not exists solicitudes_materiales_solicitante_idx
  on public.solicitudes_materiales (solicitante_id, created_at desc);
create index if not exists solicitudes_materiales_bandeja_idx
  on public.solicitudes_materiales (sede_id, estado, prioridad);
create index if not exists solicitudes_materiales_atrasadas_idx
  on public.solicitudes_materiales (fecha_necesidad)
  where estado in ('pendiente','observada','aprobada','en_compra','compra_parcial');

create table if not exists public.solicitudes_materiales_items (
  id                bigint generated by default as identity primary key,
  solicitud_id      bigint not null references public.solicitudes_materiales(id) on delete cascade,
  nombre            text not null check (length(btrim(nombre)) between 2 and 160),
  cantidad          numeric(10,2) not null check (cantidad > 0),
  unidad            text not null default 'unidad',
  costo_estimado    numeric(12,2) check (costo_estimado >= 0),
  costo_real        numeric(12,2) check (costo_real >= 0),
  cantidad_comprada numeric(10,2) not null default 0 check (cantidad_comprada >= 0),
  comentario        text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists solicitudes_materiales_items_solicitud_idx
  on public.solicitudes_materiales_items (solicitud_id);

create table if not exists public.historial_solicitudes_materiales (
  id              bigint generated by default as identity primary key,
  solicitud_id    bigint not null references public.solicitudes_materiales(id) on delete cascade,
  estado_anterior text,
  estado_nuevo    text not null,
  actor_id        uuid references public.perfiles(id) on update cascade on delete set null,
  comentario      text,
  created_at      timestamptz not null default now()
);

create index if not exists historial_materiales_solicitud_idx
  on public.historial_solicitudes_materiales (solicitud_id, created_at);

create table if not exists public.adjuntos_solicitudes (
  id             uuid primary key default gen_random_uuid(),
  origen         text not null check (origen in ('permiso','material')),
  origen_id      bigint not null,
  sede_id        text not null references public.sedes(id) on update cascade on delete restrict,
  nombre_archivo text not null,
  ruta_archivo   text not null unique,
  tipo_mime      text,
  tamano_bytes   integer check (tamano_bytes > 0),
  subido_por     uuid references public.perfiles(id) on update cascade on delete set null,
  created_at     timestamptz not null default now()
);

create index if not exists adjuntos_origen_idx
  on public.adjuntos_solicitudes (origen, origen_id);

-- 4.1 Totales derivados: se recalculan solos, no los manda el cliente.
create or replace function public.recalcular_totales_material()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  -- En un trigger de DELETE la variable NEW no esta asignada: tocar new.campo
  -- revienta con "record new is not assigned yet". Hay que ramificar por TG_OP.
  objetivo bigint := case when tg_op = 'DELETE' then old.solicitud_id else new.solicitud_id end;
begin
  update public.solicitudes_materiales s
  set costo_estimado_total = coalesce((
        select sum(i.costo_estimado * i.cantidad) from public.solicitudes_materiales_items i
        where i.solicitud_id = objetivo), 0),
      costo_real_total = coalesce((
        select sum(i.costo_real * coalesce(nullif(i.cantidad_comprada, 0), i.cantidad))
        from public.solicitudes_materiales_items i where i.solicitud_id = objetivo), 0),
      updated_at = now()
  where s.id = objetivo;
  return null;
end;
$$;

drop trigger if exists materiales_items_totales on public.solicitudes_materiales_items;
create trigger materiales_items_totales
  after insert or update or delete on public.solicitudes_materiales_items
  for each row execute function public.recalcular_totales_material();

-- 4.2 Los items solo se tocan mientras la solicitud no esta resuelta.
create or replace function public.enforce_item_editable()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  estado_actual text;
  objetivo bigint := case when tg_op = 'DELETE' then old.solicitud_id else new.solicitud_id end;
begin
  select estado into estado_actual from public.solicitudes_materiales where id = objetivo;

  -- Registrar la compra si toca costo_real / cantidad_comprada es legitimo
  -- durante el proceso de compra; agregar o quitar items, no.
  if tg_op = 'UPDATE' and estado_actual in ('aprobada','en_compra','compra_parcial','comprada') then
    if (new.nombre, new.cantidad, new.unidad) is distinct from (old.nombre, old.cantidad, old.unidad) then
      raise exception 'La solicitud ya fue aprobada: no se pueden cambiar los materiales pedidos';
    end if;
    return new;
  end if;

  if estado_actual not in ('borrador','observada') then
    raise exception 'Los materiales solo se editan mientras la solicitud es un borrador o esta observada';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists materiales_items_editable on public.solicitudes_materiales_items;
create trigger materiales_items_editable
  before insert or update or delete on public.solicitudes_materiales_items
  for each row execute function public.enforce_item_editable();

-- 4.3 Historial + updated_at.
create or replace function public.registrar_historial_material()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.historial_solicitudes_materiales (solicitud_id, estado_anterior, estado_nuevo, actor_id, comentario)
    values (new.id, null, new.estado, auth.uid(), 'Solicitud creada');
  elsif new.estado is distinct from old.estado then
    insert into public.historial_solicitudes_materiales (solicitud_id, estado_anterior, estado_nuevo, actor_id, comentario)
    values (new.id, old.estado, new.estado, auth.uid(), new.comentario_revision);
  end if;
  return new;
end;
$$;

drop trigger if exists materiales_historial on public.solicitudes_materiales;
create trigger materiales_historial
  after insert or update on public.solicitudes_materiales
  for each row execute function public.registrar_historial_material();

drop trigger if exists materiales_set_updated_at on public.solicitudes_materiales;
create trigger materiales_set_updated_at
  before update on public.solicitudes_materiales
  for each row execute function public.set_updated_at();

drop trigger if exists materiales_items_set_updated_at on public.solicitudes_materiales_items;
create trigger materiales_items_set_updated_at
  before update on public.solicitudes_materiales_items
  for each row execute function public.set_updated_at();

drop trigger if exists materiales_audit on public.solicitudes_materiales;
create trigger materiales_audit
  after insert or update or delete on public.solicitudes_materiales
  for each row execute function public.audit_row_change();

-- 4.4 El estado NO se cambia con un UPDATE directo: solo por las RPC de abajo.
create or replace function public.enforce_material_transicion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.estado is distinct from old.estado
     and coalesce(current_setting('app.transicion_material', true), '') <> 'ok' then
    raise exception 'El estado se cambia con las funciones del modulo, no con un update directo';
  end if;

  if old.estado in ('rechazada','entregada','cancelada')
     and coalesce(current_setting('app.transicion_material', true), '') <> 'ok' then
    raise exception 'La solicitud ya esta cerrada';
  end if;

  -- Campos que solo escribe el servidor.
  if (new.revisada_por, new.revisada_en, new.entrega_confirmada_por, new.entrega_confirmada_en)
       is distinct from (old.revisada_por, old.revisada_en, old.entrega_confirmada_por, old.entrega_confirmada_en)
     and coalesce(current_setting('app.transicion_material', true), '') <> 'ok' then
    raise exception 'Los datos de resolucion los registra el sistema';
  end if;

  return new;
end;
$$;

drop trigger if exists materiales_transicion on public.solicitudes_materiales;
create trigger materiales_transicion
  before update on public.solicitudes_materiales
  for each row execute function public.enforce_material_transicion();

-- Una solicitud resuelta no se borra nunca.
create or replace function public.impedir_borrado_material()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.estado <> 'borrador' then
    raise exception 'Una solicitud enviada no se elimina: se cancela';
  end if;
  return old;
end;
$$;

drop trigger if exists materiales_no_borrar on public.solicitudes_materiales;
create trigger materiales_no_borrar
  before delete on public.solicitudes_materiales
  for each row execute function public.impedir_borrado_material();

-- =============================================================================
-- 5. NOTIFICACIONES INTERNAS
-- =============================================================================
create table if not exists public.notificaciones (
  id              bigint generated by default as identity primary key,
  destinatario_id uuid not null references public.perfiles(id) on update cascade on delete cascade,
  tipo            text not null,
  titulo          text not null,
  cuerpo          text,
  enlace          text,
  leida_en        timestamptz,
  created_at      timestamptz not null default now()
);

create index if not exists notificaciones_bandeja_idx
  on public.notificaciones (destinatario_id, created_at desc);
create index if not exists notificaciones_no_leidas_idx
  on public.notificaciones (destinatario_id) where leida_en is null;

-- Las notificaciones las escribe el servidor. `authenticated` solo puede
-- marcarlas como leidas (ver la politica y el trigger de mas abajo).
create or replace function public.crear_notificacion(
  p_destinatario uuid, p_tipo text, p_titulo text, p_cuerpo text, p_enlace text
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.notificaciones (destinatario_id, tipo, titulo, cuerpo, enlace)
  select p_destinatario, p_tipo, p_titulo, p_cuerpo, p_enlace
  where p_destinatario is not null;
$$;

-- p_sede queda para cuando existan revisores por sede: hoy director y
-- sostenedora son transversales a la institucion, asi que no se filtra.
create or replace function public.notificar_revisores(
  p_sede text, p_tipo text, p_titulo text, p_cuerpo text, p_enlace text, p_excepto uuid
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.notificaciones (destinatario_id, tipo, titulo, cuerpo, enlace)
  select p.id, p_tipo, p_titulo, p_cuerpo, p_enlace
  from public.perfiles p
  where p.activo = true
    and p.rol in ('director','sostenedor')
    and p.id is distinct from p_excepto;
$$;

create or replace function public.impedir_edicion_notificacion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (new.destinatario_id, new.tipo, new.titulo, new.cuerpo, new.enlace, new.created_at)
     is distinct from (old.destinatario_id, old.tipo, old.titulo, old.cuerpo, old.enlace, old.created_at) then
    raise exception 'De una notificacion solo se puede cambiar si fue leida';
  end if;
  return new;
end;
$$;

drop trigger if exists notificaciones_solo_leida on public.notificaciones;
create trigger notificaciones_solo_leida
  before update on public.notificaciones
  for each row execute function public.impedir_edicion_notificacion();

-- =============================================================================
-- 6. RPC DEL FLUJO DE MATERIALES
--    El cliente nunca manda estado, revisada_por ni timestamps: los pone la base
--    con auth.uid() y now(). Cada funcion bloquea la fila (for update) para que
--    dos personas resolviendo a la vez no se pisen.
-- =============================================================================

create or replace function public.enviar_solicitud_material(p_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare s public.solicitudes_materiales;
begin
  select * into s from public.solicitudes_materiales where id = p_id for update;
  if not found then raise exception 'Solicitud no encontrada'; end if;
  if s.solicitante_id <> auth.uid() then raise exception 'Solo quien creo la solicitud puede enviarla'; end if;
  if s.estado not in ('borrador','observada') then raise exception 'La solicitud ya fue enviada'; end if;
  if not exists (select 1 from public.solicitudes_materiales_items where solicitud_id = p_id) then
    raise exception 'Agrega al menos un material antes de enviar';
  end if;

  perform set_config('app.transicion_material', 'ok', true);
  update public.solicitudes_materiales
  set estado = 'pendiente', enviada_en = now(), comentario_revision = null
  where id = p_id;

  perform public.notificar_revisores(
    s.sede_id, 'material_enviada', 'Nueva solicitud de materiales',
    s.titulo, '/materiales/' || p_id, s.solicitante_id);
end;
$$;

create or replace function public.revisar_solicitud_material(
  p_id bigint, p_estado text, p_comentario text default null, p_presupuesto numeric default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare s public.solicitudes_materiales;
begin
  if p_estado not in ('aprobada','rechazada','observada') then
    raise exception 'Resolucion no valida';
  end if;

  select * into s from public.solicitudes_materiales where id = p_id for update;
  if not found then raise exception 'Solicitud no encontrada'; end if;
  if s.estado not in ('pendiente','observada') then
    raise exception 'La solicitud ya fue revisada';
  end if;
  if s.solicitante_id = auth.uid() then
    raise exception 'No puedes revisar tu propia solicitud';
  end if;
  if not (public.has_role(array['director','sostenedor']) and public.can_access_sede(s.sede_id)) then
    raise exception 'No tienes autorizacion para revisar solicitudes de esta sede';
  end if;
  if p_estado in ('rechazada','observada') and coalesce(btrim(p_comentario), '') = '' then
    raise exception 'Rechazar u observar exige un comentario';
  end if;

  perform set_config('app.transicion_material', 'ok', true);
  update public.solicitudes_materiales
  set estado = p_estado,
      comentario_revision = p_comentario,
      presupuesto_autorizado = case when p_estado = 'aprobada'
                                    then coalesce(p_presupuesto, s.costo_estimado_total)
                                    else presupuesto_autorizado end,
      revisada_por = case when p_estado = 'observada' then null else auth.uid() end,
      revisada_en  = case when p_estado = 'observada' then null else now() end
  where id = p_id;

  perform public.crear_notificacion(
    s.solicitante_id, 'material_revisada',
    case p_estado when 'aprobada' then 'Tu solicitud fue aprobada'
                  when 'rechazada' then 'Tu solicitud fue rechazada'
                  else 'Tu solicitud tiene observaciones' end,
    s.titulo, '/materiales/' || p_id);
end;
$$;

create or replace function public.actualizar_compra_material(
  p_id bigint, p_estado text, p_comentario text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare s public.solicitudes_materiales;
begin
  if p_estado not in ('en_compra','compra_parcial','comprada') then
    raise exception 'Estado de compra no valido';
  end if;

  select * into s from public.solicitudes_materiales where id = p_id for update;
  if not found then raise exception 'Solicitud no encontrada'; end if;
  if s.estado not in ('aprobada','en_compra','compra_parcial') then
    raise exception 'La solicitud no esta en proceso de compra';
  end if;
  if not (public.has_role(array['director','sostenedor','secretaria']) and public.can_access_sede(s.sede_id)) then
    raise exception 'No tienes autorizacion para gestionar compras de esta sede';
  end if;

  perform set_config('app.transicion_material', 'ok', true);
  update public.solicitudes_materiales
  set estado = p_estado,
      comentario_revision = coalesce(p_comentario, comentario_revision)
  where id = p_id;

  if p_estado = 'comprada' then
    perform public.crear_notificacion(
      s.solicitante_id, 'material_comprada', 'Tus materiales estan disponibles',
      s.titulo || ' — confirma la entrega cuando los recibas', '/materiales/' || p_id);
  end if;
end;
$$;

create or replace function public.confirmar_entrega_material(p_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare s public.solicitudes_materiales;
begin
  select * into s from public.solicitudes_materiales where id = p_id for update;
  if not found then raise exception 'Solicitud no encontrada'; end if;
  if s.solicitante_id <> auth.uid() then
    raise exception 'Solo quien pidio los materiales confirma la entrega';
  end if;
  if s.estado <> 'comprada' then
    raise exception 'La entrega se confirma cuando la compra esta lista';
  end if;

  perform set_config('app.transicion_material', 'ok', true);
  update public.solicitudes_materiales
  set estado = 'entregada', entrega_confirmada_por = auth.uid(), entrega_confirmada_en = now()
  where id = p_id;

  perform public.notificar_revisores(
    s.sede_id, 'material_entregada', 'Entrega confirmada', s.titulo, '/materiales/' || p_id, null);
end;
$$;

create or replace function public.cancelar_solicitud_material(p_id bigint, p_motivo text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare s public.solicitudes_materiales;
begin
  select * into s from public.solicitudes_materiales where id = p_id for update;
  if not found then raise exception 'Solicitud no encontrada'; end if;
  if s.solicitante_id <> auth.uid() and not public.has_role(array['director','sostenedor']) then
    raise exception 'No puedes cancelar esta solicitud';
  end if;
  if s.estado in ('entregada','rechazada','cancelada') then
    raise exception 'La solicitud ya esta cerrada';
  end if;

  perform set_config('app.transicion_material', 'ok', true);
  update public.solicitudes_materiales
  set estado = 'cancelada', comentario_revision = coalesce(p_motivo, comentario_revision)
  where id = p_id;
end;
$$;

-- Atrasadas: pensada para pg_cron. Sin cron configurado, no se ejecuta sola.
create or replace function public.notificar_solicitudes_atrasadas()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare enviadas integer := 0;
begin
  with atrasadas as (
    select s.id, s.titulo, s.solicitante_id
    from public.solicitudes_materiales s
    where s.fecha_necesidad < public.hoy_santiago()
      and s.estado in ('pendiente','observada','aprobada','en_compra','compra_parcial')
      and not exists (
        select 1 from public.notificaciones n
        where n.tipo = 'material_atrasada'
          and n.enlace = '/materiales/' || s.id
          and n.created_at > now() - interval '7 days')
  )
  insert into public.notificaciones (destinatario_id, tipo, titulo, cuerpo, enlace)
  select p.id, 'material_atrasada', 'Solicitud atrasada', a.titulo, '/materiales/' || a.id
  from atrasadas a
  join public.perfiles p on p.activo = true and (p.rol in ('director','sostenedor') or p.id = a.solicitante_id);
  get diagnostics enviadas = row_count;
  return enviadas;
end;
$$;

-- =============================================================================
-- 7. RLS DE LOS OBJETOS NUEVOS
--    Regla: cada trabajador ve lo suyo; la jefatura ve lo de las sedes que
--    tiene autorizadas. La autorizacion vive aca, no en el frontend.
-- =============================================================================

alter table public.solicitudes_materiales            enable row level security;
alter table public.solicitudes_materiales_items      enable row level security;
alter table public.historial_solicitudes_materiales  enable row level security;
alter table public.adjuntos_solicitudes              enable row level security;
alter table public.notificaciones                    enable row level security;
alter table public.feriados                          enable row level security;

-- Solicitudes
drop policy if exists "materiales_select_propio_o_gestion" on public.solicitudes_materiales;
create policy "materiales_select_propio_o_gestion" on public.solicitudes_materiales
  for select to authenticated
  using (
    solicitante_id = auth.uid()
    or (public.can_access_sede(sede_id) and public.has_role(array['director','sostenedor','secretaria']))
  );

drop policy if exists "materiales_insert_propio" on public.solicitudes_materiales;
create policy "materiales_insert_propio" on public.solicitudes_materiales
  for insert to authenticated
  with check (
    solicitante_id = auth.uid()
    and public.can_access_sede(sede_id)
    and estado = 'borrador'
  );

drop policy if exists "materiales_update_propio_o_gestion" on public.solicitudes_materiales;
create policy "materiales_update_propio_o_gestion" on public.solicitudes_materiales
  for update to authenticated
  using (
    solicitante_id = auth.uid()
    or (public.can_access_sede(sede_id) and public.has_role(array['director','sostenedor','secretaria']))
  )
  with check (
    solicitante_id = auth.uid()
    or (public.can_access_sede(sede_id) and public.has_role(array['director','sostenedor','secretaria']))
  );

drop policy if exists "materiales_delete_borrador" on public.solicitudes_materiales;
create policy "materiales_delete_borrador" on public.solicitudes_materiales
  for delete to authenticated
  using (solicitante_id = auth.uid() and estado = 'borrador');

-- Items: heredan la visibilidad de su solicitud.
drop policy if exists "materiales_items_select" on public.solicitudes_materiales_items;
create policy "materiales_items_select" on public.solicitudes_materiales_items
  for select to authenticated
  using (exists (
    select 1 from public.solicitudes_materiales s
    where s.id = solicitud_id
      and (s.solicitante_id = auth.uid()
           or (public.can_access_sede(s.sede_id) and public.has_role(array['director','sostenedor','secretaria'])))
  ));

drop policy if exists "materiales_items_write_propio" on public.solicitudes_materiales_items;
create policy "materiales_items_write_propio" on public.solicitudes_materiales_items
  for all to authenticated
  using (exists (
    select 1 from public.solicitudes_materiales s
    where s.id = solicitud_id
      and (s.solicitante_id = auth.uid()
           or (public.can_access_sede(s.sede_id) and public.has_role(array['director','sostenedor','secretaria'])))
  ))
  with check (exists (
    select 1 from public.solicitudes_materiales s
    where s.id = solicitud_id
      and (s.solicitante_id = auth.uid()
           or (public.can_access_sede(s.sede_id) and public.has_role(array['director','sostenedor','secretaria'])))
  ));

-- Historial: se lee, no se escribe.
drop policy if exists "historial_materiales_select" on public.historial_solicitudes_materiales;
create policy "historial_materiales_select" on public.historial_solicitudes_materiales
  for select to authenticated
  using (exists (
    select 1 from public.solicitudes_materiales s
    where s.id = solicitud_id
      and (s.solicitante_id = auth.uid()
           or (public.can_access_sede(s.sede_id) and public.has_role(array['director','sostenedor','secretaria'])))
  ));

-- Adjuntos
drop policy if exists "adjuntos_select" on public.adjuntos_solicitudes;
create policy "adjuntos_select" on public.adjuntos_solicitudes
  for select to authenticated
  using (
    subido_por = auth.uid()
    or (public.can_access_sede(sede_id) and public.has_role(array['director','sostenedor','secretaria']))
  );

drop policy if exists "adjuntos_insert_propio" on public.adjuntos_solicitudes;
create policy "adjuntos_insert_propio" on public.adjuntos_solicitudes
  for insert to authenticated
  with check (subido_por = auth.uid() and public.can_access_sede(sede_id));

drop policy if exists "adjuntos_delete_propio" on public.adjuntos_solicitudes;
create policy "adjuntos_delete_propio" on public.adjuntos_solicitudes
  for delete to authenticated
  using (subido_por = auth.uid());

-- Notificaciones: cada quien ve la suya y solo puede marcarla leida.
drop policy if exists "notificaciones_select_propias" on public.notificaciones;
create policy "notificaciones_select_propias" on public.notificaciones
  for select to authenticated
  using (destinatario_id = auth.uid());

drop policy if exists "notificaciones_update_propias" on public.notificaciones;
create policy "notificaciones_update_propias" on public.notificaciones
  for update to authenticated
  using (destinatario_id = auth.uid())
  with check (destinatario_id = auth.uid());

-- Feriados: los ve todo el personal, los edita la jefatura.
drop policy if exists "feriados_select" on public.feriados;
create policy "feriados_select" on public.feriados
  for select to authenticated using (public.is_active_user());

drop policy if exists "feriados_manage" on public.feriados;
create policy "feriados_manage" on public.feriados
  for all to authenticated
  using (public.has_role(array['director','sostenedor']))
  with check (public.has_role(array['director','sostenedor']));

-- =============================================================================
-- 8. BUCKET PRIVADO DE ADJUNTOS
--    Ruta: <sede_id>/<origen>/<origen_id>/<uuid>.<ext>
--    Se descarga con URL firmada de corta duracion, nunca publica.
-- =============================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('adjuntos_solicitudes', 'adjuntos_solicitudes', false, 5242880,
        array['application/pdf','image/png','image/jpeg'])
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "storage_adjuntos_select" on storage.objects;
create policy "storage_adjuntos_select" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'adjuntos_solicitudes'
    and public.can_access_sede(split_part(name, '/', 1))
  );

drop policy if exists "storage_adjuntos_insert" on storage.objects;
create policy "storage_adjuntos_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'adjuntos_solicitudes'
    and public.can_access_sede(split_part(name, '/', 1))
  );

drop policy if exists "storage_adjuntos_delete" on storage.objects;
create policy "storage_adjuntos_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'adjuntos_solicitudes'
    and public.can_access_sede(split_part(name, '/', 1))
    and exists (
      select 1 from public.adjuntos_solicitudes a
      where a.ruta_archivo = storage.objects.name and a.subido_por = auth.uid()
    )
  );

-- =============================================================================
-- 9. PRIVILEGIOS
--    Postgres da EXECUTE a PUBLIC por defecto: hay que revocar a `public`, no
--    solo a anon/authenticated, o el revoke no hace nada.
--    Ver supabase_hardening_patch.sql.
-- =============================================================================
grant usage on schema public to authenticated;

grant select, insert, update, delete on public.solicitudes_materiales to authenticated;
grant select, insert, update, delete on public.solicitudes_materiales_items to authenticated;
grant select, insert, delete on public.adjuntos_solicitudes to authenticated;
grant select on public.historial_solicitudes_materiales to authenticated;
grant select on public.historial_solicitudes_permiso to authenticated;
grant select, update on public.notificaciones to authenticated;
grant select on public.feriados to authenticated;
grant insert, update, delete on public.feriados to authenticated;
grant select on public.calendario_ausencias_vista to authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- Nada de esto es alcanzable sin sesion.
revoke all on public.solicitudes_materiales           from anon;
revoke all on public.solicitudes_materiales_items     from anon;
revoke all on public.historial_solicitudes_materiales from anon;
revoke all on public.historial_solicitudes_permiso    from anon;
revoke all on public.adjuntos_solicitudes             from anon;
revoke all on public.notificaciones                   from anon;
revoke all on public.feriados                         from anon;
revoke all on public.calendario_ausencias_vista       from anon;

-- Funciones internas: solo las llaman los triggers y otras funciones.
revoke all on function public.recalcular_totales_material()      from public, anon, authenticated;
revoke all on function public.enforce_item_editable()            from public, anon, authenticated;
revoke all on function public.registrar_historial_material()     from public, anon, authenticated;
revoke all on function public.registrar_historial_permiso()      from public, anon, authenticated;
revoke all on function public.enforce_material_transicion()      from public, anon, authenticated;
revoke all on function public.impedir_borrado_material()         from public, anon, authenticated;
revoke all on function public.impedir_edicion_notificacion()     from public, anon, authenticated;
revoke all on function public.crear_notificacion(uuid, text, text, text, text) from public, anon, authenticated;
revoke all on function public.notificar_revisores(text, text, text, text, text, uuid) from public, anon, authenticated;
revoke all on function public.notificar_solicitudes_atrasadas()  from public, anon, authenticated;

-- RPC del flujo: las llama la app con la sesion del usuario.
revoke all on function public.enviar_solicitud_material(bigint) from public, anon;
grant execute on function public.enviar_solicitud_material(bigint) to authenticated;

revoke all on function public.revisar_solicitud_material(bigint, text, text, numeric) from public, anon;
grant execute on function public.revisar_solicitud_material(bigint, text, text, numeric) to authenticated;

revoke all on function public.actualizar_compra_material(bigint, text, text) from public, anon;
grant execute on function public.actualizar_compra_material(bigint, text, text) to authenticated;

revoke all on function public.confirmar_entrega_material(bigint) from public, anon;
grant execute on function public.confirmar_entrega_material(bigint) to authenticated;

revoke all on function public.cancelar_solicitud_material(bigint, text) from public, anon;
grant execute on function public.cancelar_solicitud_material(bigint, text) to authenticated;

revoke all on function public.hoy_santiago() from public, anon;
grant execute on function public.hoy_santiago() to authenticated;

-- =============================================================================
-- 10. DESPUES DE APLICAR
--
--   a) Cargar los feriados del ano:
--        insert into public.feriados (fecha, nombre, irrenunciable) values
--          ('2026-09-18', 'Independencia Nacional', true),
--          ('2026-09-19', 'Glorias del Ejercito', true)
--        on conflict (fecha) do nothing;
--
--   b) Configurar el cupo de dias administrativos de cada trabajador. Ya no hay
--      valor por defecto: sin fila en cupos_permiso, la persona no ve saldo.
--        insert into public.cupos_permiso (perfil_id, anio, dias_administrativos)
--        select id, 2026, 6 from public.perfiles where activo
--        on conflict (perfil_id, anio) do nothing;
--
--   c) Crear la cuenta de la sostenedora desde Usuarios, con rol `sostenedor`.
--      Es quien resuelve los permisos del director: nadie resuelve los propios.
--
--   d) Opcional, si se instala pg_cron, para avisar solicitudes atrasadas:
--        select cron.schedule('materiales-atrasadas', '0 12 * * 1-5',
--                             $cron$ select public.notificar_solicitudes_atrasadas(); $cron$);
-- =============================================================================

commit;
