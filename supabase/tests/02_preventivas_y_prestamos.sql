-- =============================================================================
-- Pruebas: mantenciones preventivas y prestamos de recursos
--
-- Las dos reglas que se comprueban acá no se pueden verificar leyendo el
-- codigo: dependen de una columna generada y de un indice unico parcial, que
-- son garantias del motor y no del programa.
--
-- Todo corre dentro de una transaccion que se revierte.
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/02_preventivas_y_prestamos.sql
-- =============================================================================

begin;

create temp table resultado (n int, prueba text, esperado text, obtenido text) on commit drop;
grant all on resultado to authenticated;
create temp table actor (papel text primary key, perfil uuid, sede text) on commit drop;
grant all on actor to authenticated;

do $prep$
declare v_gestiona uuid; v_simple uuid; v_sede text;
begin
  select id into v_gestiona from public.perfiles
   where activo and rol in ('director','sostenedor') order by rol limit 1;
  select id into v_simple from public.perfiles
   where activo and rol in ('docente','fonoaudiologo','aseo','jefe_utp') limit 1;
  select id into v_sede from public.sedes where activo order by id limit 1;
  if v_gestiona is null or v_simple is null or v_sede is null then
    raise exception 'Faltan actores para las pruebas';
  end if;
  insert into actor values ('gestiona', v_gestiona, v_sede), ('simple', v_simple, v_sede);
end
$prep$;

do $pruebas$
declare
  gestiona uuid; simple uuid; v_sede text; cat bigint;
  p_id bigint; r_id bigint; pr_id bigint;
  v_prox date; v_ultima date; v_estado text; v_sede_heredada text;
  v_recibido uuid; v_situacion text; n int;
begin
  select perfil, sede into gestiona, v_sede from actor where papel = 'gestiona';
  select perfil into simple from actor where papel = 'simple';
  select id into cat from public.mantencion_categorias order by id limit 1;

  set local role authenticated;
  perform set_config('request.jwt.claims',
    json_build_object('sub', gestiona, 'role','authenticated')::text, true);

  -- ── PREVENTIVAS ─────────────────────────────────────────────────────────
  insert into public.mantenciones_preventivas
    (sede_id, categoria_id, nombre, frecuencia_dias, fecha_inicio)
  values (v_sede, cat, 'Rutina de prueba', 180, date '2026-01-01')
  returning id, proxima_fecha into p_id, v_prox;

  insert into resultado values
    (1, 'proxima_fecha se calcula sola (1 ene + 180 dias)', '2026-06-30', v_prox::text);

  begin
    update public.mantenciones_preventivas set proxima_fecha = date '2030-01-01' where id = p_id;
    insert into resultado values (2, 'El vencimiento no se escribe a mano', 'rechazada', 'PASO');
  exception when others then
    insert into resultado values (2, 'El vencimiento no se escribe a mano', 'rechazada', 'rechazada');
  end;

  -- Marcarla hecha reagenda la proxima.
  insert into public.preventivas_ejecuciones (preventiva_id, fecha, costo)
  values (p_id, public.hoy_santiago(), 74900);
  select ultima_fecha, proxima_fecha, estado_preventiva
    into v_ultima, v_prox, v_estado
  from public.preventivas_estado_vista where id = p_id;

  insert into resultado values
    (3, 'Marcarla hecha actualiza la ultima fecha', public.hoy_santiago()::text, v_ultima::text),
    (4, 'Y reagenda la proxima', (public.hoy_santiago() + 180)::text, v_prox::text),
    (5, 'Y deja de estar vencida', 'al_dia', v_estado);

  -- Cargar una ejecucion vieja con retraso no debe adelantar el vencimiento.
  insert into public.preventivas_ejecuciones (preventiva_id, fecha)
  values (p_id, public.hoy_santiago() - 200);
  select proxima_fecha into v_prox from public.mantenciones_preventivas where id = p_id;
  insert into resultado values
    (6, 'Una ejecucion vieja no mueve el vencimiento',
        (public.hoy_santiago() + 180)::text, v_prox::text);

  -- Quien no gestiona mantencion no configura ni marca.
  perform set_config('request.jwt.claims',
    json_build_object('sub', simple, 'role','authenticated')::text, true);
  begin
    insert into public.mantenciones_preventivas (sede_id, categoria_id, nombre, frecuencia_dias)
    values (v_sede, cat, 'Rutina no autorizada', 30);
    insert into resultado values (7, 'Quien no gestiona no crea rutinas', 'rechazada', 'PASO');
  exception when others then
    insert into resultado values (7, 'Quien no gestiona no crea rutinas', 'rechazada', 'rechazada');
  end;
  begin
    insert into public.preventivas_ejecuciones (preventiva_id, fecha)
    values (p_id, public.hoy_santiago());
    insert into resultado values (8, 'Quien no gestiona no marca hecha una rutina', 'rechazada', 'PASO');
  exception when others then
    insert into resultado values (8, 'Quien no gestiona no marca hecha una rutina', 'rechazada', 'rechazada');
  end;

  -- La RLS filtra sin lanzar error: se mide en filas afectadas, no en excepcion.
  with u as (update public.mantenciones_preventivas set activo=false where id=p_id returning 1)
  select count(*) into n from u;
  insert into resultado values (9, 'Quien no gestiona no retira una rutina (filas)', '0', n::text);

  -- ── PRESTAMOS ───────────────────────────────────────────────────────────
  perform set_config('request.jwt.claims',
    json_build_object('sub', gestiona, 'role','authenticated')::text, true);

  insert into public.recursos (sede_id, nombre, tipo)
  values (v_sede, 'Equipo de prueba', 'Notebook') returning id into r_id;

  -- Se manda una sede equivocada a proposito: la base la toma del recurso.
  insert into public.recursos_prestamos
    (recurso_id, sede_id, prestado_a, fecha_entrega, fecha_devolucion_esperada)
  values (r_id, coalesce((select id from public.sedes where id <> v_sede and activo limit 1), v_sede),
          simple, public.hoy_santiago() - 3, public.hoy_santiago() - 1)
  returning id, sede_id into pr_id, v_sede_heredada;

  insert into resultado values
    (10, 'La sede se hereda del recurso, no la manda el cliente', v_sede, v_sede_heredada);

  select estado into v_estado from public.recursos where id = r_id;
  insert into resultado values (11, 'Prestar marca el recurso como prestado', 'prestado', v_estado);

  select situacion into v_situacion from public.prestamos_vista where id = pr_id;
  insert into resultado values (12, 'Un plazo vencido sale atrasado', 'atrasado', coalesce(v_situacion,'no visible'));

  begin
    insert into public.recursos_prestamos (recurso_id, sede_id, prestado_a, fecha_devolucion_esperada)
    values (r_id, v_sede, gestiona, public.hoy_santiago() + 7);
    insert into resultado values (13, 'Un recurso no se presta dos veces', 'rechazada', 'PASO');
  exception when others then
    insert into resultado values (13, 'Un recurso no se presta dos veces', 'rechazada', 'rechazada');
  end;

  -- Quien no administra bodega no recibe: la RLS filtra en silencio.
  perform set_config('request.jwt.claims',
    json_build_object('sub', simple, 'role','authenticated')::text, true);
  with u as (update public.recursos_prestamos
             set fecha_devolucion_real = public.hoy_santiago() where id = pr_id returning 1)
  select count(*) into n from u;
  insert into resultado values (14, 'Quien no administra bodega no recibe (filas)', '0', n::text);

  -- Devolver.
  perform set_config('request.jwt.claims',
    json_build_object('sub', gestiona, 'role','authenticated')::text, true);
  update public.recursos_prestamos
     set fecha_devolucion_real = public.hoy_santiago(), estado_al_devolver = 'sin cargador'
   where id = pr_id;
  select recibido_por into v_recibido from public.recursos_prestamos where id = pr_id;
  select estado into v_estado from public.recursos where id = r_id;
  insert into resultado values
    (15, 'Quien recibe lo pone la base', 'si', case when v_recibido = gestiona then 'si' else 'no' end),
    (16, 'Devolver libera el recurso', 'disponible', v_estado);

  begin
    update public.recursos_prestamos set fecha_devolucion_real = null where id = pr_id;
    insert into resultado values (17, 'Un prestamo devuelto no se reabre', 'rechazada', 'PASO');
  exception when others then
    insert into resultado values (17, 'Un prestamo devuelto no se reabre', 'rechazada', 'rechazada');
  end;
  begin
    update public.recursos_prestamos set prestado_a = gestiona where id = pr_id;
    insert into resultado values (18, 'No se cambia a quien se presto', 'rechazada', 'PASO');
  exception when others then
    insert into resultado values (18, 'No se cambia a quien se presto', 'rechazada', 'rechazada');
  end;

  -- Un equipo en mantencion no se presta, y ese estado no lo pisa el trigger.
  update public.recursos set estado = 'mantencion' where id = r_id;
  begin
    insert into public.recursos_prestamos (recurso_id, sede_id, prestado_a, fecha_devolucion_esperada)
    values (r_id, v_sede, simple, public.hoy_santiago() + 7);
    insert into resultado values (19, 'No se presta un equipo en mantencion', 'rechazada', 'PASO');
  exception when others then
    insert into resultado values (19, 'No se presta un equipo en mantencion', 'rechazada', 'rechazada');
  end;
  select estado into v_estado from public.recursos where id = r_id;
  insert into resultado values (20, 'El estado puesto a mano no se pisa', 'mantencion', v_estado);

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
  if fallas > 0 then
    raise exception 'preventivas y prestamos: % de % comprobaciones fallaron',
      fallas, (select count(*) from resultado);
  end if;
  raise notice 'preventivas y prestamos: % comprobaciones OK', (select count(*) from resultado);
end
$veredicto$;

rollback;
