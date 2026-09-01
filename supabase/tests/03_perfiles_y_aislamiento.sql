-- =============================================================================
-- Pruebas: visibilidad de perfiles y aislamiento entre sedes
--
-- Este archivo protege la regla mas delicada del proyecto: quien ve que. Un
-- fallo aca no revienta nada — simplemente muestra datos de mas, o de menos, y
-- nadie se entera.
--
-- La comprobacion 1 es una regresion concreta: la politica
-- `perfiles_select_colegas` llego a comprobar el rol de la fila mirada en vez
-- del rol de quien mira. Como director y sostenedora no tienen filas en
-- `perfiles_sedes`, el director terminaba viendo un solo perfil: el suyo. Eso
-- dejaba el modulo de Usuarios vacio y los prestamos invisibles.
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/03_perfiles_y_aislamiento.sql
-- =============================================================================

begin;

create temp table resultado (n int, prueba text, esperado text, obtenido text) on commit drop;
grant all on resultado to authenticated;
grant all on resultado to anon;
create temp table actor (papel text primary key, perfil uuid, sede text) on commit drop;
grant all on actor to authenticated;

do $prep$
declare v_dir uuid; v_simple uuid; v_sede text;
begin
  select id into v_dir from public.perfiles
   where activo and rol in ('director','sostenedor') order by rol limit 1;
  -- Se prefiere a quien tenga MENOS sedes asignadas: es el actor mas acotado,
  -- y el unico con el que la prueba de aislamiento entre sedes tiene sentido.
  -- Con alguien que trabaja en todas las sedes, ese escenario no existe.
  select p.id into v_simple
  from public.perfiles p
  left join public.perfiles_sedes ps on ps.perfil_id = p.id
  where p.activo and p.rol in ('docente','fonoaudiologo','aseo','jefe_utp')
  group by p.id
  order by count(ps.sede_id), p.id
  limit 1;
  select id into v_sede from public.sedes where activo order by id limit 1;
  if v_dir is null or v_simple is null or v_sede is null then
    raise exception 'Faltan actores para las pruebas';
  end if;
  insert into actor values ('dir', v_dir, v_sede), ('simple', v_simple, v_sede);
end
$prep$;

do $pruebas$
declare
  dir uuid; simple uuid; v_sede text; otra_sede text;
  activos int; visibles int; n int; m_id bigint;
begin
  select perfil, sede into dir, v_sede from actor where papel = 'dir';
  select perfil into simple from actor where papel = 'simple';

  -- `otra_sede` tiene que ser una sede que ESTA persona no tenga asignada. Si
  -- se toma «cualquier otra sede», el actor elegido puede trabajar en las dos
  -- y la prueba de aislamiento se vuelve falsa: veria la otra sede con todo
  -- derecho. Sin una sede ajena real, el escenario no aplica.
  select s.id into otra_sede
  from public.sedes s
  where s.activo
    and not exists (
      select 1 from public.perfiles_sedes ps
      where ps.sede_id = s.id and ps.perfil_id = simple
    )
  limit 1;

  select count(*) into activos from public.perfiles where activo;

  set local role authenticated;

  -- ── 1. Regresion: la direccion ve a todo el personal ────────────────────
  perform set_config('request.jwt.claims',
    json_build_object('sub', dir, 'role','authenticated')::text, true);
  select count(*) into visibles from public.perfiles;
  insert into resultado values
    (1, 'La direccion ve a todo el personal activo', activos::text, visibles::text);

  -- ── 2. El personal ve a la direccion (para poder dirigirle solicitudes) ──
  perform set_config('request.jwt.claims',
    json_build_object('sub', simple, 'role','authenticated')::text, true);
  select count(*) into n from public.perfiles where rol in ('director','sostenedor');
  insert into resultado values
    (2, 'El personal ve a la direccion', 'si', case when n > 0 then 'si' else 'no' end);

  -- ── 3. Cada quien se ve a si mismo ──────────────────────────────────────
  select count(*) into n from public.perfiles where id = simple;
  insert into resultado values (3, 'Cada quien ve su propio perfil', '1', n::text);

  -- ── 4. Nadie ve perfiles de sedes que no comparte ───────────────────────
  if otra_sede is not null then
    select count(*) into n
    from public.perfiles p
    where p.rol not in ('director','sostenedor')
      and p.id <> simple
      and not public.comparte_sede_conmigo(p.id);
    insert into resultado values
      (4, 'No se ven colegas de sedes que no se comparten', '0', n::text);
  else
    insert into resultado values (4, 'No se ven colegas de otras sedes (sin sede ajena: n/a)', '0', '0');
  end if;

  -- ── 5. Aislamiento de datos entre sedes ─────────────────────────────────
  if otra_sede is not null then
    reset role;
    -- Se crea una incidencia en la otra sede, por fuera de la RLS.
    insert into public.mantenciones (sede_id, categoria_id, lugar, descripcion, reportado_por)
    values (otra_sede, (select id from public.mantencion_categorias order by id limit 1),
            'Lugar de otra sede', 'Incidencia de prueba en otra sede', dir)
    returning id into m_id;

    set local role authenticated;
    perform set_config('request.jwt.claims',
      json_build_object('sub', simple, 'role','authenticated')::text, true);
    select count(*) into n from public.mantenciones where id = m_id;
    insert into resultado values
      (5, 'No se ven mantenciones de una sede ajena', '0', n::text);
  else
    -- Esta persona trabaja en todas las sedes activas: no hay sede ajena que probar.
    insert into resultado values (5, 'Aislamiento entre sedes (sin sede ajena: n/a)', '0', '0');
  end if;

  -- ── 6. anon no ve absolutamente nada ────────────────────────────────────
  reset role;
  set local role anon;
  begin
    select count(*) into n from public.perfiles;
    insert into resultado values (6, 'Un visitante sin sesion no lee perfiles', '0', n::text);
  exception when others then
    insert into resultado values (6, 'Un visitante sin sesion no lee perfiles', '0', '0');
  end;
  begin
    select count(*) into n from public.estudiantes;
    insert into resultado values (7, 'Un visitante sin sesion no lee estudiantes', '0', n::text);
  exception when others then
    insert into resultado values (7, 'Un visitante sin sesion no lee estudiantes', '0', '0');
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
  if fallas > 0 then
    raise exception 'perfiles y aislamiento: % de % comprobaciones fallaron',
      fallas, (select count(*) from resultado);
  end if;
  raise notice 'perfiles y aislamiento: % comprobaciones OK', (select count(*) from resultado);
end
$veredicto$;

rollback;
