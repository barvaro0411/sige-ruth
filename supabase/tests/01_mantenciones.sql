-- =============================================================================
-- Pruebas: mantenciones correctivas
--
-- Comprueban las reglas que sostienen el modulo, que viven en la base y no en
-- el frontend. Las que importan son las que tienen que FALLAR: son las que
-- demuestran que esconder un boton no es lo que protege el dato.
--
-- Todo corre dentro de una transaccion que se revierte: no queda ni una fila.
-- Se puede ejecutar contra produccion sin riesgo.
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/01_mantenciones.sql
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
    raise exception 'Faltan actores para las pruebas (se necesita direccion, personal operativo y una sede activa)';
  end if;
  insert into actor values ('gestiona', v_gestiona, v_sede), ('simple', v_simple, v_sede);
end
$prep$;

do $pruebas$
declare
  gestiona uuid; simple uuid; v_sede text;
  m_id bigint; v_estado text; v_quien uuid; v_cerrada timestamptz;
  n int;
begin
  select perfil, sede into gestiona, v_sede from actor where papel = 'gestiona';
  select perfil into simple from actor where papel = 'simple';

  set local role authenticated;

  -- ── Reportar ────────────────────────────────────────────────────────────
  perform set_config('request.jwt.claims',
    json_build_object('sub', simple, 'role','authenticated')::text, true);

  -- Se manda estado 'resuelta' a proposito: el trigger tiene que ignorarlo.
  insert into public.mantenciones (sede_id, categoria_id, lugar, descripcion, prioridad, estado)
  values (v_sede, (select id from public.mantencion_categorias order by id limit 1),
          'Bano de prueba', 'Descripcion de prueba automatizada', 'alta', 'resuelta')
  returning id, estado, reportado_por into m_id, v_estado, v_quien;

  insert into resultado values
    (1, 'El cliente no elige el estado inicial', 'reportada', v_estado),
    (2, 'El reportante lo pone la base con auth.uid()', 'si',
        case when v_quien = simple then 'si' else 'no' end);

  select count(*) into n from public.mantenciones_historial where mantencion_id = m_id;
  insert into resultado values (3, 'Reportar deja historial', '1', n::text);

  -- ── Lo que tiene que ser rechazado ──────────────────────────────────────
  begin
    update public.mantenciones set estado='resuelta', trabajo_realizado='x' where id = m_id;
    insert into resultado values (4, 'Quien no gestiona no resuelve', 'rechazada', 'PASO');
  exception when others then
    insert into resultado values (4, 'Quien no gestiona no resuelve', 'rechazada', 'rechazada');
  end;

  begin
    update public.mantenciones set descripcion='texto reescrito' where id = m_id;
    insert into resultado values (5, 'El reporte original no se reescribe', 'rechazada', 'PASO');
  exception when others then
    insert into resultado values (5, 'El reporte original no se reescribe', 'rechazada', 'rechazada');
  end;

  perform set_config('request.jwt.claims',
    json_build_object('sub', gestiona, 'role','authenticated')::text, true);

  begin
    update public.mantenciones set estado='resuelta' where id = m_id;
    insert into resultado values (6, 'No se resuelve sin describir el trabajo', 'rechazada', 'PASO');
  exception when others then
    insert into resultado values (6, 'No se resuelve sin describir el trabajo', 'rechazada', 'rechazada');
  end;

  begin
    update public.mantenciones set estado='cerrada' where id = m_id;
    insert into resultado values (7, 'No se cierra sin resolver antes', 'rechazada', 'PASO');
  exception when others then
    insert into resultado values (7, 'No se cierra sin resolver antes', 'rechazada', 'rechazada');
  end;

  -- ── Camino feliz ────────────────────────────────────────────────────────
  update public.mantenciones
     set estado='resuelta', trabajo_realizado='Se cambio la pieza', costo=18500
   where id = m_id;
  select estado, resuelta_por into v_estado, v_quien from public.mantenciones where id = m_id;
  insert into resultado values
    (8, 'La gestion resuelve', 'resuelta', v_estado),
    (9, 'resuelta_por lo pone la base', 'si', case when v_quien = gestiona then 'si' else 'no' end);

  update public.mantenciones set estado='cerrada' where id = m_id;
  select estado, cerrada_en into v_estado, v_cerrada from public.mantenciones where id = m_id;
  insert into resultado values
    (10, 'Cerrar desde resuelta', 'cerrada', v_estado),
    (11, 'cerrada_en la pone la base', 'si', case when v_cerrada is not null then 'si' else 'no' end);

  begin
    update public.mantenciones set costo = 1 where id = m_id;
    insert into resultado values (12, 'Una cerrada ya no admite cambios', 'rechazada', 'PASO');
  exception when others then
    insert into resultado values (12, 'Una cerrada ya no admite cambios', 'rechazada', 'rechazada');
  end;

  -- ── Quien reporto puede cancelar lo suyo ────────────────────────────────
  perform set_config('request.jwt.claims',
    json_build_object('sub', simple, 'role','authenticated')::text, true);
  insert into public.mantenciones (sede_id, categoria_id, lugar, descripcion)
  values (v_sede, (select id from public.mantencion_categorias order by id limit 1),
          'Sala de prueba', 'Otra descripcion de prueba')
  returning id into m_id;

  begin
    update public.mantenciones set estado='en_reparacion' where id = m_id;
    insert into resultado values (13, 'Quien no gestiona no mueve el estado', 'rechazada', 'PASO');
  exception when others then
    insert into resultado values (13, 'Quien no gestiona no mueve el estado', 'rechazada', 'rechazada');
  end;

  update public.mantenciones set estado='cancelada' where id = m_id;
  select estado into v_estado from public.mantenciones where id = m_id;
  insert into resultado values (14, 'Quien reporto cancela lo suyo', 'cancelada', v_estado);

  reset role;
end
$pruebas$;

-- Informe legible
select n, prueba, esperado, obtenido,
       case when esperado = obtenido then 'OK' else 'FALLA' end as veredicto
from resultado order by n;

-- Veredicto: si algo fallo, la transaccion muere aca con codigo distinto de cero.
do $veredicto$
declare fallas int;
begin
  select count(*) into fallas from resultado where esperado is distinct from obtenido;
  if fallas > 0 then
    raise exception 'mantenciones: % de % comprobaciones fallaron',
      fallas, (select count(*) from resultado);
  end if;
  raise notice 'mantenciones: % comprobaciones OK', (select count(*) from resultado);
end
$veredicto$;

rollback;
