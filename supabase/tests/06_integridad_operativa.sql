-- Regresiones de integridad operativa. Ejecutar solo en una base aislada.
begin;

create temp table resultado_operativo (
  n int primary key, prueba text, esperado text, obtenido text
) on commit drop;
grant all on resultado_operativo to authenticated;
create temp table fixture_operativa (clave text primary key, valor text) on commit drop;
grant all on fixture_operativa to authenticated;

do $preparar$
declare
  director uuid; tercero uuid; sede_principal text; sede_ajena text;
  categoria_inventario bigint; categoria_mantencion bigint;
  item_local bigint; item_ajeno bigint; preventiva bigint; recurso bigint;
  sufijo text := txid_current()::text;
begin
  select id into director from public.perfiles
  where activo and rol = 'director' order by id limit 1;
  select id into tercero from public.perfiles
  where activo and id is distinct from director order by id limit 1;
  select id into sede_principal from public.sedes where activo order by id limit 1;
  select id into sede_ajena from public.sedes
  where activo and id <> sede_principal order by id limit 1;
  select id into categoria_inventario from public.inventario_categorias
  where activo order by id limit 1;
  select id into categoria_mantencion from public.mantencion_categorias
  where activo order by id limit 1;

  if director is null or tercero is null or sede_principal is null or sede_ajena is null
     or categoria_inventario is null or categoria_mantencion is null then
    raise exception 'Faltan fixtures base para probar integridad operativa';
  end if;

  insert into public.inventario_items
    (sede_id, categoria_id, nombre, unidad, stock_minimo)
  values (sede_principal, categoria_inventario, 'Auditoria local ' || sufijo, 'unidad', 0)
  returning id into item_local;
  insert into public.inventario_items
    (sede_id, categoria_id, nombre, unidad, stock_minimo)
  values (sede_ajena, categoria_inventario, 'Auditoria ajena ' || sufijo, 'unidad', 0)
  returning id into item_ajeno;
  insert into public.mantenciones_preventivas
    (sede_id, categoria_id, nombre, frecuencia_dias, fecha_inicio)
  values (sede_principal, categoria_mantencion, 'Preventiva auditoria ' || sufijo, 30, current_date)
  returning id into preventiva;
  insert into public.recursos (sede_id, nombre, codigo)
  values (sede_principal, 'Recurso auditoria ' || sufijo, 'AUD-' || sufijo)
  returning id into recurso;

  insert into fixture_operativa values
    ('director', director::text), ('tercero', tercero::text),
    ('sede_principal', sede_principal), ('item_local', item_local::text),
    ('item_ajeno', item_ajeno::text), ('preventiva', preventiva::text),
    ('recurso', recurso::text);
end
$preparar$;

do $probar$
declare
  director uuid := (select valor::uuid from fixture_operativa where clave = 'director');
  tercero uuid := (select valor::uuid from fixture_operativa where clave = 'tercero');
  sede_principal text := (select valor from fixture_operativa where clave = 'sede_principal');
  item_local bigint := (select valor::bigint from fixture_operativa where clave = 'item_local');
  item_ajeno bigint := (select valor::bigint from fixture_operativa where clave = 'item_ajeno');
  preventiva bigint := (select valor::bigint from fixture_operativa where clave = 'preventiva');
  recurso bigint := (select valor::bigint from fixture_operativa where clave = 'recurso');
  solicitud bigint; item_solicitud bigint; prestamo bigint; actor_obtenido uuid;
begin
  set local role authenticated;
  perform set_config('request.jwt.claims',
    json_build_object('sub', director, 'role', 'authenticated')::text, true);

  insert into public.inventario_movimientos
    (item_id, sede_id, tipo, cantidad, motivo, actor_id)
  values (item_local, sede_principal, 'ingreso', 1, 'Prueba de actor', tercero)
  returning actor_id into actor_obtenido;
  insert into resultado_operativo values
    (1, 'Inventario ignora actor_id del cliente', director::text, actor_obtenido::text);

  insert into public.preventivas_ejecuciones
    (preventiva_id, fecha, realizada_por, observaciones)
  values (preventiva, current_date, tercero, 'Prueba de actor')
  returning realizada_por into actor_obtenido;
  insert into resultado_operativo values
    (2, 'Preventivas ignora realizada_por del cliente', director::text, actor_obtenido::text);

  insert into public.recursos_prestamos
    (recurso_id, sede_id, prestado_a, entregado_por, fecha_devolucion_esperada)
  values (recurso, sede_principal, director, tercero, current_date + 1)
  returning id, entregado_por into prestamo, actor_obtenido;
  insert into resultado_operativo values
    (3, 'Prestamos ignora entregado_por del cliente', director::text, actor_obtenido::text);

  begin
    update public.recursos_prestamos set entregado_por = tercero where id = prestamo;
    insert into resultado_operativo values
      (4, 'El actor del prestamo es inmutable', 'rechazada', 'PASO');
  exception when others then
    insert into resultado_operativo values
      (4, 'El actor del prestamo es inmutable', 'rechazada', 'rechazada');
  end;

  insert into public.solicitudes_materiales
    (solicitante_id, sede_id, titulo, justificacion, prioridad)
  values (director, sede_principal, 'Aislamiento entre sedes', 'Prueba de integridad', 'normal')
  returning id into solicitud;
  insert into public.solicitudes_materiales_items
    (solicitud_id, nombre, cantidad, unidad)
  values (solicitud, 'Material de prueba', 1, 'unidad')
  returning id into item_solicitud;

  begin
    update public.solicitudes_materiales_items
    set item_id = item_ajeno where id = item_solicitud;
    insert into resultado_operativo values
      (5, 'Inventario ajeno no se enlaza a la solicitud', 'rechazada', 'PASO');
  exception when others then
    insert into resultado_operativo values
      (5, 'Inventario ajeno no se enlaza a la solicitud', 'rechazada', 'rechazada');
  end;
  reset role;

  insert into resultado_operativo values (
    6,
    'El rate limit atomico admite cinco intentos y rechaza el sexto',
    'false',
    (public.consume_admin_user_rate_limit(director)
      and public.consume_admin_user_rate_limit(director)
      and public.consume_admin_user_rate_limit(director)
      and public.consume_admin_user_rate_limit(director)
      and public.consume_admin_user_rate_limit(director)
      and public.consume_admin_user_rate_limit(director))::text
  );
end
$probar$;

select n, prueba, esperado, obtenido,
       case when esperado = obtenido then 'OK' else 'FALLA' end as veredicto
from resultado_operativo order by n;

do $veredicto$
declare fallas int;
begin
  select count(*) into fallas from resultado_operativo
  where esperado is distinct from obtenido;
  if fallas > 0 then
    raise exception 'integridad operativa: % comprobaciones fallaron', fallas;
  end if;
  raise notice 'integridad operativa: % comprobaciones OK',
    (select count(*) from resultado_operativo);
end
$veredicto$;

rollback;
