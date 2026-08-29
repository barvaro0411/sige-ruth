-- =============================================================================
-- Fase 0 · 3/3 — Materiales con items, historial y RPC; notificaciones y adjuntos
--
-- Produccion tiene hoy una `solicitudes_materiales` plana: un material por fila,
-- sin items ni historial. El codigo de `gestion-ruth` espera cabecera + items +
-- historial + 5 RPC. Esta migracion hace el reemplazo.
--
-- Por que se reemplaza y no se migra columna por columna: la tabla plana tiene
-- cero filas y su forma es incompatible (un material por solicitud contra N).
-- La guarda de abajo aborta si alguien alcanzo a cargar datos.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 0. Guarda
--
-- Si esta migracion llega a una base donde ya se usaron estos modulos, se
-- detiene en vez de destruir informacion. En ese caso hay que escribir el
-- traspaso de datos a mano antes de volver a intentarlo.
-- -----------------------------------------------------------------------------
do $$
declare
  n_mat bigint;
  n_not bigint;
begin
  select count(*) into n_mat from public.solicitudes_materiales;
  if n_mat > 0 then
    raise exception
      'solicitudes_materiales tiene % fila(s). Migrar esos datos a mano antes de aplicar esta migracion.', n_mat;
  end if;

  select count(*) into n_not from public.notificaciones;
  if n_not > 0 then
    raise exception
      'notificaciones tiene % fila(s). Revisar el cambio de columnas antes de aplicar.', n_not;
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- 1. Notificaciones: ajuste de forma
--
-- Se altera en vez de recrear, para conservar la FK y no reescribir politicas.
--   mensaje -> cuerpo        (el codigo lee `cuerpo`)
--   leida   -> leida_en      (un timestamp dice cuando, un booleano no)
--   tipo    sin CHECK        (las RPC usan 'material_enviada', 'material_revisada'…)
-- -----------------------------------------------------------------------------
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'notificaciones' and column_name = 'mensaje'
  ) then
    alter table public.notificaciones rename column mensaje to cuerpo;
  end if;
end;
$$;

alter table public.notificaciones alter column cuerpo drop not null;
alter table public.notificaciones add column if not exists leida_en timestamptz;

-- Conserva lo ya leido antes de cambiar el booleano por un timestamp.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'notificaciones' and column_name = 'leida'
  ) then
    update public.notificaciones set leida_en = created_at where leida is true and leida_en is null;
    alter table public.notificaciones drop column leida;
  end if;
end;
$$;

alter table public.notificaciones drop constraint if exists notificaciones_tipo_check;

create index if not exists notificaciones_bandeja_idx
  on public.notificaciones (destinatario_id, created_at desc);
create index if not exists notificaciones_no_leidas_idx
  on public.notificaciones (destinatario_id) where leida_en is null;

-- Una notificacion es un hecho registrado: de ella solo se cambia si fue leida.
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

-- Las escribe el servidor, nunca el cliente.
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

-- p_sede queda reservado para cuando existan revisores por sede: hoy direccion
-- y sostenedora son transversales, asi que no se filtra.
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

-- -----------------------------------------------------------------------------
-- 2. Baja de la tabla plana
--
-- `prepare_material_request` y la rama de materiales de `notify_request_change`
-- leen columnas que dejan de existir (material, cantidad, unidad). Se retiran
-- juntos, o el primer INSERT en la tabla nueva falla.
-- -----------------------------------------------------------------------------
drop trigger if exists solicitudes_materiales_notify   on public.solicitudes_materiales;
drop trigger if exists solicitudes_materiales_prepare  on public.solicitudes_materiales;
drop table if exists public.solicitudes_materiales cascade;
drop function if exists public.prepare_material_request() cascade;

-- Queda solo para permisos, y adaptado a las columnas nuevas.
create or replace function public.notify_request_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.notificaciones (destinatario_id, tipo, titulo, cuerpo, enlace, metadata)
    select
      r.id,
      'permiso_enviada',
      'Nueva solicitud de permiso',
      new.solicitante_nombre || ' pidio permiso desde el ' || to_char(new.fecha_inicio, 'DD/MM/YYYY'),
      '/permisos',
      jsonb_build_object('solicitud_id', new.id, 'sede_id', new.sede_id)
    from public.perfiles r
    where r.activo = true
      and r.id <> new.solicitante_id
      and r.rol in ('director','sostenedor');

  elsif new.estado is distinct from old.estado then
    insert into public.notificaciones (destinatario_id, tipo, titulo, cuerpo, enlace, metadata)
    values (
      new.solicitante_id,
      'permiso_revisada',
      'Actualizacion de tu permiso',
      'Tu solicitud quedo como ' || new.estado || '.',
      '/permisos',
      jsonb_build_object('solicitud_id', new.id, 'sede_id', new.sede_id)
    );
  end if;

  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- 3. Solicitudes de materiales
-- -----------------------------------------------------------------------------
create table public.solicitudes_materiales (
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
  -- Dinero siempre en numeric, nunca en coma flotante.
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

create index solicitudes_materiales_solicitante_idx
  on public.solicitudes_materiales (solicitante_id, created_at desc);
create index solicitudes_materiales_bandeja_idx
  on public.solicitudes_materiales (sede_id, estado, prioridad);
create index solicitudes_materiales_atrasadas_idx
  on public.solicitudes_materiales (fecha_necesidad)
  where estado in ('pendiente','observada','aprobada','en_compra','compra_parcial');

create table public.solicitudes_materiales_items (
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

create index solicitudes_materiales_items_solicitud_idx
  on public.solicitudes_materiales_items (solicitud_id);

create table public.historial_solicitudes_materiales (
  id              bigint generated by default as identity primary key,
  solicitud_id    bigint not null references public.solicitudes_materiales(id) on delete cascade,
  estado_anterior text,
  estado_nuevo    text not null,
  actor_id        uuid references public.perfiles(id) on update cascade on delete set null,
  comentario      text,
  created_at      timestamptz not null default now()
);

create index historial_materiales_solicitud_idx
  on public.historial_solicitudes_materiales (solicitud_id, created_at);

-- -----------------------------------------------------------------------------
-- 4. Adjuntos
-- -----------------------------------------------------------------------------
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

-- -----------------------------------------------------------------------------
-- 5. Totales derivados
--
-- Los calcula la base a partir de los items. El cliente nunca los manda.
-- -----------------------------------------------------------------------------
create or replace function public.recalcular_totales_material()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  -- En un trigger de DELETE la variable NEW no esta asignada: hay que ramificar
  -- por TG_OP o revienta con "record new is not assigned yet".
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

-- Los items solo se tocan mientras la solicitud no esta resuelta. Registrar la
-- compra (costo real, cantidad comprada) si es legitimo despues de aprobar.
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

-- -----------------------------------------------------------------------------
-- 6. Historial, updated_at y auditoria
-- -----------------------------------------------------------------------------
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

-- -----------------------------------------------------------------------------
-- 7. El estado no se cambia con UPDATE directo
--
-- Solo las RPC de abajo, que fijan `app.transicion_material` antes de escribir.
-- Sin esto, cualquiera con sesion podria aprobarse su propia solicitud desde el
-- cliente: la RLS deja actualizar la fila propia, y sin el trigger el campo
-- `estado` seria uno mas.
-- -----------------------------------------------------------------------------
create or replace function public.enforce_material_transicion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  en_rpc boolean := coalesce(current_setting('app.transicion_material', true), '') = 'ok';
begin
  if new.estado is distinct from old.estado and not en_rpc then
    raise exception 'El estado se cambia con las funciones del modulo, no con un update directo';
  end if;

  if old.estado in ('rechazada','entregada','cancelada') and not en_rpc then
    raise exception 'La solicitud ya esta cerrada';
  end if;

  if (new.revisada_por, new.revisada_en, new.entrega_confirmada_por, new.entrega_confirmada_en)
       is distinct from (old.revisada_por, old.revisada_en, old.entrega_confirmada_por, old.entrega_confirmada_en)
     and not en_rpc then
    raise exception 'Los datos de resolucion los registra el sistema';
  end if;

  return new;
end;
$$;

drop trigger if exists materiales_transicion on public.solicitudes_materiales;
create trigger materiales_transicion
  before update on public.solicitudes_materiales
  for each row execute function public.enforce_material_transicion();

-- Una solicitud enviada no se borra: se cancela. El historial vale mas que la
-- prolijidad de la lista.
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

-- -----------------------------------------------------------------------------
-- 8. RPC del flujo
--
-- Cada una bloquea la fila con `for update`: dos personas resolviendo a la vez
-- no se pisan. El cliente nunca manda estado, revisor ni timestamps.
-- -----------------------------------------------------------------------------

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
    case p_estado when 'aprobada'  then 'Tu solicitud fue aprobada'
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

-- Pensada para pg_cron. Sin cron configurado no se ejecuta sola; se puede
-- llamar a mano. No repite aviso por la misma solicitud dentro de 7 dias.
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
  join public.perfiles p on p.activo = true
   and (p.rol in ('director','sostenedor') or p.id = a.solicitante_id);
  get diagnostics enviadas = row_count;
  return enviadas;
end;
$$;

-- -----------------------------------------------------------------------------
-- 9. RLS
--
-- Cada trabajador ve lo suyo; direccion, sostenedora y secretaria ven lo de las
-- sedes que tienen autorizadas. La autorizacion vive aca, no en el frontend.
-- -----------------------------------------------------------------------------
alter table public.solicitudes_materiales           enable row level security;
alter table public.solicitudes_materiales_items     enable row level security;
alter table public.historial_solicitudes_materiales enable row level security;
alter table public.adjuntos_solicitudes             enable row level security;
alter table public.notificaciones                   enable row level security;

create policy "materiales_select_propio_o_gestion" on public.solicitudes_materiales
  for select to authenticated
  using (
    solicitante_id = auth.uid()
    or (public.can_access_sede(sede_id) and public.has_role(array['director','sostenedor','secretaria']))
  );

-- Nace siempre como borrador: nadie crea una solicitud ya aprobada.
create policy "materiales_insert_propio" on public.solicitudes_materiales
  for insert to authenticated
  with check (
    solicitante_id = auth.uid()
    and public.can_access_sede(sede_id)
    and estado = 'borrador'
  );

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

create policy "materiales_delete_borrador" on public.solicitudes_materiales
  for delete to authenticated
  using (solicitante_id = auth.uid() and estado = 'borrador');

-- Los items heredan la visibilidad de su solicitud.
create policy "materiales_items_select" on public.solicitudes_materiales_items
  for select to authenticated
  using (exists (
    select 1 from public.solicitudes_materiales s
    where s.id = solicitud_id
      and (s.solicitante_id = auth.uid()
           or (public.can_access_sede(s.sede_id) and public.has_role(array['director','sostenedor','secretaria'])))
  ));

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

-- El historial se lee, no se escribe: lo escriben los triggers.
create policy "historial_materiales_select" on public.historial_solicitudes_materiales
  for select to authenticated
  using (exists (
    select 1 from public.solicitudes_materiales s
    where s.id = solicitud_id
      and (s.solicitante_id = auth.uid()
           or (public.can_access_sede(s.sede_id) and public.has_role(array['director','sostenedor','secretaria'])))
  ));

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

-- Cada quien ve la suya. El trigger de arriba limita el UPDATE a marcarla leida.
drop policy if exists "notificaciones_select_propias" on public.notificaciones;
create policy "notificaciones_select_propias" on public.notificaciones
  for select to authenticated
  using (destinatario_id = auth.uid());

drop policy if exists "notificaciones_update_propias" on public.notificaciones;
create policy "notificaciones_update_propias" on public.notificaciones
  for update to authenticated
  using (destinatario_id = auth.uid())
  with check (destinatario_id = auth.uid());

-- -----------------------------------------------------------------------------
-- 10. Bucket privado de adjuntos
--     Ruta: <sede_id>/<origen>/<origen_id>/<uuid>.<ext>
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('adjuntos_solicitudes', 'adjuntos_solicitudes', false, 5242880,
        array['application/pdf','image/png','image/jpeg','image/webp'])
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

-- -----------------------------------------------------------------------------
-- 11. Privilegios
--
-- Postgres concede EXECUTE a PUBLIC por defecto: hay que revocar a `public`,
-- no solo a anon y authenticated, o el revoke no hace nada.
-- -----------------------------------------------------------------------------
grant usage on schema public to authenticated;

grant select, insert, update, delete on public.solicitudes_materiales       to authenticated;
grant select, insert, update, delete on public.solicitudes_materiales_items to authenticated;
grant select, insert, delete         on public.adjuntos_solicitudes         to authenticated;
grant select                         on public.historial_solicitudes_materiales to authenticated;
grant select, update                 on public.notificaciones               to authenticated;
grant usage, select on all sequences in schema public to authenticated;

revoke all on public.solicitudes_materiales           from anon;
revoke all on public.solicitudes_materiales_items     from anon;
revoke all on public.historial_solicitudes_materiales from anon;
revoke all on public.adjuntos_solicitudes             from anon;
revoke all on public.notificaciones                   from anon;

-- Internas: las llaman los triggers y otras funciones, nunca el cliente.
revoke all on function public.recalcular_totales_material()  from public, anon, authenticated;
revoke all on function public.enforce_item_editable()        from public, anon, authenticated;
revoke all on function public.registrar_historial_material() from public, anon, authenticated;
revoke all on function public.enforce_material_transicion()  from public, anon, authenticated;
revoke all on function public.impedir_borrado_material()     from public, anon, authenticated;
revoke all on function public.impedir_edicion_notificacion() from public, anon, authenticated;
revoke all on function public.notify_request_change()        from public, anon, authenticated;
revoke all on function public.crear_notificacion(uuid, text, text, text, text)              from public, anon, authenticated;
revoke all on function public.notificar_revisores(text, text, text, text, text, uuid)       from public, anon, authenticated;
revoke all on function public.notificar_solicitudes_atrasadas()                             from public, anon, authenticated;

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

commit;

-- =============================================================================
-- Despues de aplicar
--
--   a) Crear la cuenta de la sostenedora desde Usuarios, con rol `sostenedor`.
--      Es quien resuelve los permisos del director: nadie resuelve los propios.
--
--   b) Configurar el cupo de dias administrativos. Ya no hay valor por defecto:
--        insert into public.cupos_permiso (perfil_id, anio, dias_administrativos)
--        select id, 2026, 6 from public.perfiles where activo
--        on conflict (perfil_id, anio) do nothing;
--
--   c) Activar "Leaked Password Protection" en Authentication > Policies.
-- =============================================================================
