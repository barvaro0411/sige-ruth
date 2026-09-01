-- =============================================================================
-- Regresiones de la auditoria integral: datos academicos, contraseña temporal,
-- campos derivados y mass assignment. Todo se revierte al terminar.
-- =============================================================================

begin;

create temp table resultado (n int, prueba text, esperado text, obtenido text) on commit drop;
grant all on resultado to authenticated;
create temp table actor (papel text primary key, perfil uuid, sede text) on commit drop;
grant all on actor to authenticated;

do $prep$
declare academico uuid; operativo uuid; v_sede text; estudiante bigint; ruta text;
begin
  select p.id, ps.sede_id into academico, v_sede
  from public.perfiles p join public.perfiles_sedes ps on ps.perfil_id = p.id
  where p.activo and p.rol in ('secretaria','docente','fonoaudiologo','jefe_utp')
  order by p.id limit 1;

  select p.id into operativo from public.perfiles p
  where p.activo and p.rol in ('sostenedor','aseo','bodega','mantencion')
    and (p.rol = 'sostenedor' or exists (
      select 1 from public.perfiles_sedes ps where ps.perfil_id = p.id and ps.sede_id = v_sede
    ))
  order by p.id limit 1;

  if academico is null or operativo is null or v_sede is null then
    raise exception 'Falta un actor academico y otro operativo para probar la segregacion';
  end if;

  insert into public.estudiantes
    (rut, nombre, apellido_paterno, apellido_materno, nivel, jornada, sede_id)
  values ('999999999', 'Estudiante', 'Prueba', 'Seguridad', 'NT1', 'Mañana', v_sede)
  returning id into estudiante;

  ruta := v_sede || '/' || estudiante || '/auditoria-rls.pdf';
  insert into public.estudiantes_documentos
    (estudiante_id, nombre_archivo, ruta_archivo, url_archivo, subido_por, sede_id)
  values (estudiante, 'auditoria-rls.pdf', ruta, ruta, academico, v_sede);
  insert into storage.objects (bucket_id, name)
  values ('documentos_estudiantes', ruta);

  insert into actor values
    ('academico', academico, v_sede), ('operativo', operativo, v_sede),
    ('estudiante', null, estudiante::text), ('ruta', null, ruta);
end
$prep$;

do $pruebas$
declare academico uuid; operativo uuid; v_sede text; estudiante bigint;
  ruta text; n int; permiso_id bigint; material_id bigint; item_material_id bigint; dias numeric;
begin
  select perfil, sede into academico, v_sede from actor where papel = 'academico';
  select perfil into operativo from actor where papel = 'operativo';
  select sede::bigint into estudiante from actor where papel = 'estudiante';
  select sede into ruta from actor where papel = 'ruta';

  set local role authenticated;

  perform set_config('request.jwt.claims',
    json_build_object('sub', operativo, 'role','authenticated')::text, true);
  select count(*) into n from public.estudiantes where id = estudiante;
  insert into resultado values (1, 'Un rol operativo no ve estudiantes', '0', n::text);

  select count(*) into n from public.estudiantes_documentos where estudiante_id = estudiante;
  insert into resultado values (2, 'Un rol operativo no ve metadata de documentos', '0', n::text);

  select count(*) into n from storage.objects
  where bucket_id = 'documentos_estudiantes' and name = ruta;
  insert into resultado values (3, 'Un rol operativo no enumera objetos de estudiantes', '0', n::text);

  perform set_config('request.jwt.claims',
    json_build_object('sub', academico, 'role','authenticated')::text, true);
  select count(*) into n from public.estudiantes where id = estudiante;
  insert into resultado values (4, 'Un rol academico autorizado ve al estudiante de su sede', '1', n::text);

  select count(*) into n from public.estudiantes_documentos where estudiante_id = estudiante;
  insert into resultado values (5, 'Un rol academico autorizado ve metadata de su sede', '1', n::text);

  select count(*) into n from storage.objects
  where bucket_id = 'documentos_estudiantes' and name = ruta;
  insert into resultado values (6, 'Un rol academico autorizado ve el objeto de su sede', '1', n::text);

  perform set_config('request.jwt.claims', json_build_object(
    'sub', academico, 'role','authenticated',
    'app_metadata', json_build_object('must_change_password', true)
  )::text, true);
  select count(*) into n from public.sedes;
  insert into resultado values (7, 'La contraseña temporal bloquea los datos de la aplicacion', '0', n::text);

  perform set_config('request.jwt.claims',
    json_build_object('sub', academico, 'role','authenticated')::text, true);

  insert into public.solicitudes_permiso
    (solicitante_id, sede_id, tipo, fecha_inicio, fecha_fin, jornada, dias_habiles, motivo)
  values (academico, v_sede, 'otro', date '2099-04-06', date '2099-04-07', 'completa', -99, 'Prueba')
  returning id, dias_habiles into permiso_id, dias;
  insert into resultado values
    (8, 'dias_habiles ignora el valor del cliente al insertar',
      trim_scale(public.dias_habiles_permiso(date '2099-04-06', date '2099-04-07', 'completa'))::text,
      trim_scale(dias)::text);

  update public.solicitudes_permiso set dias_habiles = -50 where id = permiso_id;
  select dias_habiles into dias from public.solicitudes_permiso where id = permiso_id;
  insert into resultado values
    (9, 'dias_habiles se recalcula tambien en cada update',
      trim_scale(public.dias_habiles_permiso(date '2099-04-06', date '2099-04-07', 'completa'))::text,
      trim_scale(dias)::text);

  insert into public.solicitudes_materiales
    (solicitante_id, sede_id, titulo, justificacion, prioridad)
  values (academico, v_sede, 'Solicitud de prueba', 'Regresion de seguridad', 'normal')
  returning id into material_id;

  begin
    update public.solicitudes_materiales set presupuesto_autorizado = 1 where id = material_id;
    insert into resultado values (10, 'El solicitante no altera el presupuesto', 'rechazada', 'PASO');
  exception when others then
    insert into resultado values (10, 'El solicitante no altera el presupuesto', 'rechazada', 'rechazada');
  end;

  insert into public.solicitudes_materiales_items
    (solicitud_id, nombre, cantidad, unidad, costo_estimado)
  values (material_id, 'Item de prueba', 1, 'unidad', 100)
  returning id into item_material_id;
  begin
    update public.solicitudes_materiales_items set costo_real = 1 where id = item_material_id;
    insert into resultado values (11, 'El solicitante no altera costos reales', 'rechazada', 'PASO');
  exception when others then
    insert into resultado values (11, 'El solicitante no altera costos reales', 'rechazada', 'rechazada');
  end;

  reset role;
end
$pruebas$;

select n, prueba, esperado, obtenido,
       case when esperado = obtenido then 'OK' else 'FALLA' end as veredicto
from resultado order by n;

do $veredicto$
declare fallas int;
begin
  select count(*) into fallas from resultado where esperado is distinct from obtenido;
  if fallas > 0 then raise exception 'auditoria integral: % comprobaciones fallaron', fallas; end if;
  raise notice 'auditoria integral: % comprobaciones OK', (select count(*) from resultado);
end
$veredicto$;

rollback;
