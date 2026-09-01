-- =============================================================================
-- Correcciones de la auditoria integral de seguridad (2026-09-01)
--
-- Principios:
--   * la sede no basta para acceder a datos academicos;
--   * los campos derivados y de identidad los fija la base;
--   * una solicitud solo admite las columnas propias de cada etapa;
--   * una referencia de inventario nunca cruza sedes.
-- =============================================================================

begin;

-- La asistencia se registra en el libro oficial/SIGE; se retira del baseline
-- historico para que un entorno nuevo termine con el mismo catalogo funcional.
drop table if exists public.asistencia cascade;

create or replace function public.session_ready()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(select 1 from public.perfiles where id = auth.uid() and activo = true)
     and not coalesce((auth.jwt() -> 'app_metadata' ->> 'must_change_password')::boolean, false);
$$;
revoke all on function public.session_ready() from public, anon;
grant execute on function public.session_ready() to authenticated;

-- Los helpers y vistas historicos ya llaman is_active_user(); al delegarlo en
-- session_ready el bloqueo temporal se aplica tambien a esas rutas indirectas.
create or replace function public.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$ select public.session_ready(); $$;

-- Una contraseña temporal solo permite leer el perfil propio y llamar a la
-- Edge Function de cambio. RESTRICTIVE se combina con todas las demás políticas.
do $$
declare table_name text;
begin
  foreach table_name in array array[
    'sedes','perfiles_sedes','cursos','estudiantes','sesiones_fono','estudiantes_documentos','auditoria',
    'feriados','solicitudes_permiso','cupos_permiso','historial_solicitudes_permiso',
    'solicitudes_materiales','solicitudes_materiales_items','historial_solicitudes_materiales',
    'adjuntos_solicitudes','notificaciones','inventario_unidades','inventario_categorias',
    'inventario_items','inventario_movimientos','mantencion_categorias','mantenciones',
    'mantenciones_preventivas','preventivas_ejecuciones','recursos','recursos_prestamos','productos_frecuentes'
  ] loop
    if to_regclass('public.' || table_name) is not null then
      execute format('drop policy if exists sesion_lista on public.%I', table_name);
      execute format(
        'create policy sesion_lista on public.%I as restrictive for all to authenticated using (public.session_ready()) with check (public.session_ready())',
        table_name
      );
    end if;
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- C-02: estudiantes y documentos requieren finalidad academica explicita.
-- Sostenedor y roles operativos quedan fuera deliberadamente.
-- -----------------------------------------------------------------------------
create or replace function public.can_access_academic_sede(target_sede text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.session_ready()
     and public.can_access_sede(target_sede)
     and public.has_role(array['director','secretaria','docente','fonoaudiologo','jefe_utp']);
$$;

revoke all on function public.can_access_academic_sede(text) from public, anon;
grant execute on function public.can_access_academic_sede(text) to authenticated;

drop policy if exists "estudiantes_select_scope" on public.estudiantes;
create policy "estudiantes_select_academico" on public.estudiantes
  for select to authenticated
  using (public.can_access_academic_sede(sede_id));

drop policy if exists "documentos_select_scope" on public.estudiantes_documentos;
create policy "documentos_select_academico" on public.estudiantes_documentos
  for select to authenticated
  using (public.can_access_academic_sede(sede_id));

drop policy if exists "documentos_insert_staff" on public.estudiantes_documentos;
create policy "documentos_insert_academico" on public.estudiantes_documentos
  for insert to authenticated
  with check (
    public.can_access_academic_sede(sede_id)
    and subido_por = auth.uid()
    and public.has_role(array['director','secretaria','fonoaudiologo'])
  );

drop policy if exists "documentos_delete_staff" on public.estudiantes_documentos;
create policy "documentos_delete_academico" on public.estudiantes_documentos
  for delete to authenticated
  using (
    public.can_access_academic_sede(sede_id)
    and (subido_por = auth.uid() or public.has_role(array['director','secretaria']))
  );

drop policy if exists "storage_documentos_select_scope" on storage.objects;
create policy "storage_documentos_select_academico" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'documentos_estudiantes'
    and exists (
      select 1 from public.estudiantes_documentos d
      where d.ruta_archivo = storage.objects.name
        and public.can_access_academic_sede(d.sede_id)
    )
  );

drop policy if exists "storage_documentos_insert_scope" on storage.objects;
create policy "storage_documentos_insert_academico" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'documentos_estudiantes'
    and public.can_access_academic_sede(split_part(name, '/', 1))
    and public.has_role(array['director','secretaria','fonoaudiologo'])
    and exists (
      select 1 from public.estudiantes e
      where e.id::text = split_part(name, '/', 2)
        and e.sede_id = split_part(name, '/', 1)
    )
  );

drop policy if exists "storage_documentos_delete_scope" on storage.objects;
create policy "storage_documentos_delete_academico" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'documentos_estudiantes'
    and public.can_access_academic_sede(split_part(name, '/', 1))
    and (
      owner_id = auth.uid()::text
      or exists (
        select 1 from public.estudiantes_documentos d
        where d.ruta_archivo = storage.objects.name
          and (d.subido_por = auth.uid() or public.has_role(array['director','secretaria']))
      )
    )
  );

-- Adjuntos: metadata y objeto comparten la misma autorizacion. owner_id permite
-- limpiar una subida si falla el INSERT de metadata.
drop policy if exists "storage_adjuntos_select" on storage.objects;
create policy "storage_adjuntos_select" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'adjuntos_solicitudes'
    and public.session_ready()
    and exists (
      select 1 from public.adjuntos_solicitudes a
      where a.ruta_archivo = storage.objects.name
        and (
          a.subido_por = auth.uid()
          or (public.can_access_sede(a.sede_id)
              and public.has_role(array['director','sostenedor','secretaria']))
        )
    )
  );

drop policy if exists "storage_adjuntos_delete" on storage.objects;
create policy "storage_adjuntos_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'adjuntos_solicitudes'
    and public.session_ready()
    and public.can_access_sede(split_part(name, '/', 1))
    and (
      owner_id = auth.uid()::text
      or exists (
        select 1 from public.adjuntos_solicitudes a
        where a.ruta_archivo = storage.objects.name and a.subido_por = auth.uid()
      )
    )
  );

drop policy if exists "storage_adjuntos_insert" on storage.objects;
create policy "storage_adjuntos_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'adjuntos_solicitudes'
    and public.session_ready()
    and public.can_access_sede(split_part(name, '/', 1))
  );

-- -----------------------------------------------------------------------------
-- H-03: dias_habiles siempre se deriva; nunca se acepta el valor del cliente.
-- El nombre del trigger lo hace correr despues de los triggers historicos.
-- -----------------------------------------------------------------------------
alter table public.solicitudes_permiso
  drop constraint if exists solicitudes_permiso_dias_habiles_valido;
alter table public.solicitudes_permiso
  add constraint solicitudes_permiso_dias_habiles_valido check (dias_habiles >= 0);

create or replace function public.fijar_dias_habiles_permiso()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.dias_habiles := public.dias_habiles_permiso(new.fecha_inicio, new.fecha_fin, new.jornada);
  return new;
end;
$$;

drop trigger if exists zz_solicitudes_permiso_fijar_dias on public.solicitudes_permiso;
create trigger zz_solicitudes_permiso_fijar_dias
  before insert or update on public.solicitudes_permiso
  for each row execute function public.fijar_dias_habiles_permiso();

revoke all on function public.fijar_dias_habiles_permiso() from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- H-02/H-04: mass assignment y referencias de inventario entre sedes.
-- -----------------------------------------------------------------------------
create or replace function public.proteger_campos_solicitud_material()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  en_rpc boolean := coalesce(current_setting('app.transicion_material', true), '') = 'ok';
  recalculando boolean := coalesce(current_setting('app.recalcular_material', true), '') = 'ok';
begin
  if en_rpc or recalculando then return new; end if;

  if (new.solicitante_id, new.sede_id, new.estado,
      new.costo_estimado_total, new.presupuesto_autorizado, new.costo_real_total,
      new.enviada_en, new.revisada_por, new.revisada_en, new.comentario_revision,
      new.entrega_confirmada_por, new.entrega_confirmada_en)
     is distinct from
     (old.solicitante_id, old.sede_id, old.estado,
      old.costo_estimado_total, old.presupuesto_autorizado, old.costo_real_total,
      old.enviada_en, old.revisada_por, old.revisada_en, old.comentario_revision,
      old.entrega_confirmada_por, old.entrega_confirmada_en) then
    raise exception 'Los campos de estado, presupuesto, totales e identidad los registra el sistema';
  end if;

  if old.solicitante_id <> auth.uid() or old.estado not in ('borrador','observada') then
    raise exception 'Solo quien solicita puede editar el contenido de un borrador u observado';
  end if;
  return new;
end;
$$;

drop trigger if exists zz_materiales_proteger_campos on public.solicitudes_materiales;
create trigger zz_materiales_proteger_campos
  before update on public.solicitudes_materiales
  for each row execute function public.proteger_campos_solicitud_material();

create or replace function public.recalcular_totales_material()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  objetivo bigint := case when tg_op = 'DELETE' then old.solicitud_id else new.solicitud_id end;
  marca_anterior text := coalesce(current_setting('app.recalcular_material', true), '');
begin
  perform set_config('app.recalcular_material', 'ok', true);
  update public.solicitudes_materiales s
  set costo_estimado_total = coalesce((
        select sum(i.costo_estimado * i.cantidad)
        from public.solicitudes_materiales_items i where i.solicitud_id = objetivo), 0),
      costo_real_total = coalesce((
        select sum(i.costo_real * coalesce(nullif(i.cantidad_comprada, 0), i.cantidad))
        from public.solicitudes_materiales_items i where i.solicitud_id = objetivo), 0),
      updated_at = now()
  where s.id = objetivo;
  perform set_config('app.recalcular_material', marca_anterior, true);
  return null;
end;
$$;

create or replace function public.validar_item_material_sede()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare solicitud_sede text; inventario_sede text;
begin
  if new.item_id is null then return new; end if;
  select sede_id into solicitud_sede from public.solicitudes_materiales where id = new.solicitud_id;
  select sede_id into inventario_sede from public.inventario_items where id = new.item_id;
  if inventario_sede is null or solicitud_sede is distinct from inventario_sede then
    raise exception 'El producto de inventario no pertenece a la sede de la solicitud';
  end if;
  return new;
end;
$$;

drop trigger if exists materiales_items_validar_sede on public.solicitudes_materiales_items;
create trigger materiales_items_validar_sede
  before insert or update of solicitud_id, item_id on public.solicitudes_materiales_items
  for each row execute function public.validar_item_material_sede();

create or replace function public.enforce_item_editable()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.solicitudes_materiales;
  objetivo bigint := case when tg_op = 'DELETE' then old.solicitud_id else new.solicitud_id end;
  en_entrega boolean := coalesce(current_setting('app.entrega_material', true), '') = 'ok';
begin
  select * into s from public.solicitudes_materiales where id = objetivo;
  if not found then raise exception 'La solicitud no existe'; end if;

  if en_entrega and tg_op = 'UPDATE' then
    if not public.gestiona_bodega() then raise exception 'Entrega no autorizada'; end if;
    if (new.solicitud_id, new.nombre, new.cantidad, new.unidad, new.costo_estimado,
        new.costo_real, new.cantidad_comprada, new.comentario, new.item_id)
       is distinct from
       (old.solicitud_id, old.nombre, old.cantidad, old.unidad, old.costo_estimado,
        old.costo_real, old.cantidad_comprada, old.comentario, old.item_id) then
      raise exception 'La entrega solo puede modificar la cantidad entregada';
    end if;
    return new;
  end if;

  if tg_op in ('INSERT','DELETE') then
    if s.solicitante_id <> auth.uid() or s.estado not in ('borrador','observada') then
      raise exception 'Solo quien solicita modifica items de un borrador u observado';
    end if;
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  if s.estado in ('borrador','observada') then
    if s.solicitante_id <> auth.uid() then raise exception 'Solo quien solicita modifica estos items'; end if;
    if (new.solicitud_id, new.costo_real, new.cantidad_comprada, new.cantidad_entregada)
       is distinct from (old.solicitud_id, old.costo_real, old.cantidad_comprada, old.cantidad_entregada) then
      raise exception 'Los costos reales y cantidades procesadas los registra el sistema';
    end if;
    return new;
  end if;

  if s.estado in ('aprobada','en_compra','compra_parcial','comprada')
     and public.has_role(array['director','sostenedor','secretaria'])
     and public.can_access_sede(s.sede_id) then
    if (new.solicitud_id, new.nombre, new.cantidad, new.unidad, new.costo_estimado,
        new.item_id, new.cantidad_entregada)
       is distinct from
       (old.solicitud_id, old.nombre, old.cantidad, old.unidad, old.costo_estimado,
        old.item_id, old.cantidad_entregada) then
      raise exception 'Durante la compra solo se registran costo real, cantidad comprada y comentario';
    end if;
    return new;
  end if;

  raise exception 'Los materiales no se pueden modificar en el estado actual';
end;
$$;

revoke all on function public.proteger_campos_solicitud_material() from public, anon, authenticated;
revoke all on function public.validar_item_material_sede() from public, anon, authenticated;
revoke all on function public.enforce_item_editable() from public, anon, authenticated;

create or replace function public.entregar_solicitud_material(p_id bigint, p_entregas jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.solicitudes_materiales;
  entrega jsonb;
  it public.solicitudes_materiales_items;
  cant numeric(10,2);
  pendientes integer;
begin
  select * into s from public.solicitudes_materiales where id = p_id for update;
  if not found then raise exception 'Solicitud no encontrada'; end if;
  if not (public.gestiona_bodega() and public.can_access_sede(s.sede_id)) then
    raise exception 'No tienes autorizacion para entregar materiales de esta sede';
  end if;
  if s.estado not in ('aprobada','preparando','comprada','compra_parcial','entregada_parcial') then
    raise exception 'La solicitud no esta en un estado que permita entregar';
  end if;
  if p_entregas is null or jsonb_typeof(p_entregas) <> 'array' or jsonb_array_length(p_entregas) = 0 then
    raise exception 'Indica al menos un material a entregar';
  end if;

  perform set_config('app.entrega_material', 'ok', true);
  for entrega in select * from jsonb_array_elements(p_entregas)
  loop
    select * into it from public.solicitudes_materiales_items
    where id = (entrega ->> 'item_id')::bigint and solicitud_id = p_id for update;
    if not found then raise exception 'Uno de los materiales no pertenece a esta solicitud'; end if;

    cant := (entrega ->> 'cantidad')::numeric(10,2);
    if cant is null or cant <= 0 then
      raise exception 'La cantidad a entregar de "%" debe ser mayor que cero', it.nombre;
    end if;
    if it.cantidad_entregada + cant > it.cantidad then
      raise exception 'La entrega supera la cantidad solicitada de "%"', it.nombre;
    end if;

    if it.item_id is not null then
      if not exists (
        select 1 from public.inventario_items i where i.id = it.item_id and i.sede_id = s.sede_id
      ) then
        raise exception 'El producto "%" no pertenece a la sede de la solicitud', it.nombre;
      end if;
      insert into public.inventario_movimientos (item_id, tipo, cantidad, motivo, solicitud_id)
      values (it.item_id, 'entrega', -cant, 'Solicitud #' || p_id || ' — ' || s.titulo, p_id);
    end if;

    update public.solicitudes_materiales_items
    set cantidad_entregada = cantidad_entregada + cant where id = it.id;
  end loop;

  select count(*) filter (where cantidad_entregada < cantidad)
  into pendientes from public.solicitudes_materiales_items where solicitud_id = p_id;

  perform set_config('app.transicion_material', 'ok', true);
  update public.solicitudes_materiales
  set estado = case when pendientes = 0 then 'entregada' else 'entregada_parcial' end,
      entrega_confirmada_por = case when pendientes = 0 then auth.uid() else entrega_confirmada_por end,
      entrega_confirmada_en = case when pendientes = 0 then now() else entrega_confirmada_en end
  where id = p_id;

  perform public.crear_notificacion(
    s.solicitante_id,
    case when pendientes = 0 then 'material_entregada' else 'material_entrega_parcial' end,
    case when pendientes = 0 then 'Recibiste tus materiales' else 'Recibiste parte de tus materiales' end,
    s.titulo, '/materiales/' || p_id
  );
end;
$$;

revoke all on function public.entregar_solicitud_material(bigint,jsonb) from public, anon;
grant execute on function public.entregar_solicitud_material(bigint,jsonb) to authenticated;

-- -----------------------------------------------------------------------------
-- M-02: actor siempre tomado de la sesion autenticada.
-- -----------------------------------------------------------------------------
create or replace function public.fijar_actor_movimiento()
returns trigger language plpgsql security definer set search_path = public as $$
begin new.actor_id := auth.uid(); return new; end;
$$;
drop trigger if exists aa_inventario_movimientos_fijar_actor on public.inventario_movimientos;
create trigger aa_inventario_movimientos_fijar_actor
  before insert on public.inventario_movimientos
  for each row execute function public.fijar_actor_movimiento();

create or replace function public.fijar_actor_preventiva()
returns trigger language plpgsql security definer set search_path = public as $$
begin new.realizada_por := auth.uid(); return new; end;
$$;
drop trigger if exists aa_preventivas_ejecuciones_fijar_actor on public.preventivas_ejecuciones;
create trigger aa_preventivas_ejecuciones_fijar_actor
  before insert on public.preventivas_ejecuciones
  for each row execute function public.fijar_actor_preventiva();

create or replace function public.preparar_prestamo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare r public.recursos;
begin
  select * into r from public.recursos where id = new.recurso_id for update;
  if not found then raise exception 'El recurso no existe'; end if;
  if not r.activo then raise exception 'El recurso "%" esta dado de baja', r.nombre; end if;
  if r.estado in ('mantencion','no_disponible') then
    raise exception 'El recurso "%" no esta disponible para prestamo', r.nombre;
  end if;
  if not exists (
    select 1 from public.perfiles p
    where p.id = new.prestado_a and p.activo
      and (p.rol in ('director','sostenedor') or exists (
        select 1 from public.perfiles_sedes ps
        where ps.perfil_id = p.id and ps.sede_id = r.sede_id
      ))
  ) then
    raise exception 'La persona destinataria no pertenece a la sede del recurso';
  end if;
  new.sede_id := r.sede_id;
  new.entregado_por := auth.uid();
  new.fecha_devolucion_real := null;
  new.recibido_por := null;
  return new;
end;
$$;

create or replace function public.enforce_prestamo_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.fecha_devolucion_real is not null
     and new.fecha_devolucion_real is distinct from old.fecha_devolucion_real then
    raise exception 'El prestamo ya fue devuelto';
  end if;
  if (new.recurso_id, new.prestado_a, new.fecha_entrega, new.sede_id, new.entregado_por)
     is distinct from
     (old.recurso_id, old.prestado_a, old.fecha_entrega, old.sede_id, old.entregado_por) then
    raise exception 'No se puede cambiar el recurso, destinatario ni actor del prestamo';
  end if;
  if new.fecha_devolucion_real is not null and old.fecha_devolucion_real is null then
    new.recibido_por := auth.uid();
  elsif new.recibido_por is distinct from old.recibido_por then
    raise exception 'Quien recibe la devolucion lo registra el sistema';
  end if;
  return new;
end;
$$;

revoke all on function public.fijar_actor_movimiento() from public, anon, authenticated;
revoke all on function public.fijar_actor_preventiva() from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- M-06: minimizar copias sensibles en auditoria y ofrecer depuracion acotada.
-- -----------------------------------------------------------------------------
create table if not exists public.admin_user_rate_limits (
  id bigint generated always as identity primary key,
  actor_id uuid not null,
  created_at timestamptz not null default now()
);
create index if not exists admin_user_rate_limits_actor_fecha_idx
  on public.admin_user_rate_limits (actor_id, created_at desc);
alter table public.admin_user_rate_limits enable row level security;
revoke all on public.admin_user_rate_limits from public, anon, authenticated;

-- Consume el cupo bajo un lock por actor. El count+insert equivalente en la
-- Edge Function permitiria exceder el limite con solicitudes simultaneas.
create or replace function public.consume_admin_user_rate_limit(p_actor uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare intentos integer;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_actor::text, 0));
  delete from public.admin_user_rate_limits
  where actor_id = p_actor and created_at < now() - interval '24 hours';

  select count(*) into intentos
  from public.admin_user_rate_limits
  where actor_id = p_actor and created_at >= now() - interval '5 minutes';

  if intentos >= 5 then return false; end if;
  insert into public.admin_user_rate_limits (actor_id) values (p_actor);
  return true;
end;
$$;
revoke all on function public.consume_admin_user_rate_limit(uuid)
  from public, anon, authenticated;
grant execute on function public.consume_admin_user_rate_limit(uuid) to service_role;

-- Una notificacion solo permite pasar de no leida a leida. La marca temporal
-- la fija la base y el cliente no puede reescribir metadata ni desmarcarla.
create or replace function public.impedir_edicion_notificacion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (new.destinatario_id, new.tipo, new.titulo, new.cuerpo, new.enlace,
      new.metadata, new.created_at)
     is distinct from
     (old.destinatario_id, old.tipo, old.titulo, old.cuerpo, old.enlace,
      old.metadata, old.created_at) then
    raise exception 'De una notificacion solo se puede cambiar si fue leida';
  end if;
  if old.leida_en is not null and new.leida_en is distinct from old.leida_en then
    raise exception 'Una notificacion leida no se puede reabrir ni reescribir';
  end if;
  if old.leida_en is null and new.leida_en is not null then new.leida_en := now(); end if;
  return new;
end;
$$;
revoke all on function public.impedir_edicion_notificacion()
  from public, anon, authenticated;

create or replace function public.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare old_data jsonb; new_data jsonb; audit_action text; audit_sede text; audit_id text; audit_entity text;
begin
  old_data := case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) else null end;
  new_data := case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) else null end;
  audit_action := case tg_op when 'INSERT' then 'CREAR' when 'UPDATE' then 'MODIFICAR' when 'DELETE' then 'ELIMINAR' end;
  audit_sede := coalesce(new_data ->> 'sede_id', old_data ->> 'sede_id');
  audit_id := coalesce(new_data ->> 'id', old_data ->> 'id');
  audit_entity := case when tg_table_name = 'estudiantes' then 'estudiante' else tg_table_name end;

  if tg_table_name = 'estudiantes' then
    old_data := old_data - array['rut','fecha_nacimiento','diagnostico','nombre_apoderado','telefono_apoderado'];
    new_data := new_data - array['rut','fecha_nacimiento','diagnostico','nombre_apoderado','telefono_apoderado'];
  elsif tg_table_name = 'solicitudes_permiso' then
    old_data := old_data - array['motivo'];
    new_data := new_data - array['motivo'];
  end if;

  insert into public.auditoria
    (accion, entidad, entidad_id, usuario_id, valor_anterior, valor_nuevo, sede_id)
  values (audit_action, audit_entity, audit_id, auth.uid(), old_data, new_data, audit_sede);
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

-- Minimiza tambien los registros historicos que aun contienen esas claves.
update public.auditoria
set valor_anterior = valor_anterior - array['rut','fecha_nacimiento','diagnostico','nombre_apoderado','telefono_apoderado'],
    valor_nuevo = valor_nuevo - array['rut','fecha_nacimiento','diagnostico','nombre_apoderado','telefono_apoderado']
where entidad = 'estudiante';
update public.auditoria
set valor_anterior = valor_anterior - array['motivo'], valor_nuevo = valor_nuevo - array['motivo']
where entidad = 'solicitudes_permiso';

create or replace function public.depurar_auditoria(p_retencion_dias integer default 365)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare eliminadas bigint;
begin
  if not public.has_role(array['director']) then raise exception 'Solo el director puede depurar auditoria'; end if;
  if p_retencion_dias < 180 then raise exception 'La retencion minima es de 180 dias'; end if;
  delete from public.auditoria where created_at < now() - make_interval(days => p_retencion_dias);
  get diagnostics eliminadas = row_count;
  return eliminadas;
end;
$$;
revoke all on function public.depurar_auditoria(integer) from public, anon;
grant execute on function public.depurar_auditoria(integer) to authenticated;

commit;
