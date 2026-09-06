-- =============================================================================
-- El candado de sesión no se olvida en ninguna tabla, y abrir una ficha clínica
-- deja rastro. Todo se revierte al terminar.
--
-- La comprobación 1 es la que importa: existe porque la lista de tablas con
-- `sesion_lista` estaba escrita a mano y una tabla nueva quedaba fuera en
-- silencio. Si esta prueba falla, alguien creó una tabla con RLS y no decidió
-- si lleva candado — la decisión se declara en
-- `public.tablas_exentas_del_candado_de_sesion()`.
-- =============================================================================

begin;

create temp table resultado (n int, prueba text, esperado text, obtenido text) on commit drop;
grant all on resultado to authenticated;
create temp table actor (papel text primary key, perfil uuid, sede text) on commit drop;
grant all on actor to authenticated;

do $prep$
declare clinico uuid; operativo uuid; v_sede text; estudiante bigint;
begin
  select p.id, ps.sede_id into clinico, v_sede
  from public.perfiles p
  join public.perfiles_sedes ps on ps.perfil_id = p.id
  where p.activo and p.rol in ('fonoaudiologo', 'jefe_utp')
  order by p.id limit 1;

  -- Si no hay equipo clínico con sede, se prueba con el director, que también
  -- tiene el permiso pero es transversal: se le presta una sede cualquiera.
  if clinico is null then
    select p.id into clinico from public.perfiles p
    where p.activo and p.rol = 'director' order by p.id limit 1;
    select s.id into v_sede from public.sedes s where s.activo order by s.id limit 1;
  end if;

  select p.id into operativo
  from public.perfiles p
  where p.activo and p.rol in ('aseo', 'bodega', 'mantencion')
  order by p.id limit 1;

  if clinico is null or operativo is null or v_sede is null then
    raise exception 'Faltan actores: se necesita alguien del equipo clínico y alguien operativo';
  end if;

  insert into public.estudiantes
    (rut, nombre, apellido_paterno, apellido_materno, nivel, jornada, sede_id)
  values ('999999998', 'Estudiante', 'Prueba', 'Lectura', 'NT1', 'Mañana', v_sede)
  returning id into estudiante;

  insert into actor values
    ('clinico', clinico, v_sede),
    ('operativo', operativo, v_sede),
    ('estudiante', null, estudiante::text);
end
$prep$;

do $pruebas$
declare
  clinico uuid; operativo uuid; v_sede text; estudiante bigint;
  faltantes text; n int; antes int; despues int;
begin
  select perfil, sede into clinico, v_sede from actor where papel = 'clinico';
  select perfil into operativo from actor where papel = 'operativo';
  select sede::bigint into estudiante from actor where papel = 'estudiante';

  -- 1. Ninguna tabla con RLS quedó sin candado sin declararlo.
  select coalesce(string_agg(tabla, ', ' order by tabla), '')
    into faltantes
  from public.tablas_sin_candado_de_sesion();

  insert into resultado values (
    1,
    'toda tabla con RLS lleva sesion_lista o está declarada exenta',
    '', faltantes
  );

  -- 2. Las exenciones son las declaradas, no una lista que fue creciendo.
  insert into resultado values (
    2,
    'las exenciones al candado son solo perfiles y admin_user_rate_limits',
    'admin_user_rate_limits, perfiles',
    (select string_agg(t, ', ' order by t)
     from unnest(public.tablas_exentas_del_candado_de_sesion()) as t)
  );

  -- 3. El candado se aplica de verdad: una tabla cualquiera lo tiene.
  insert into resultado values (
    3,
    'sesiones_fono lleva la política restrictiva',
    'restrictive',
    (select case when p.polpermissive then 'permissive' else 'restrictive' end
     from pg_policy p
     where p.polrelid = 'public.sesiones_fono'::regclass and p.polname = 'sesion_lista')
  );

  set local role authenticated;

  -- 4. Un rol operativo no puede anotar una consulta clínica: la RPC comprueba
  --    el rol, no se limita a escribir lo que le pidan.
  perform set_config('request.jwt.claims',
    json_build_object('sub', operativo, 'role', 'authenticated')::text, true);
  begin
    perform public.registrar_consulta_clinica(estudiante);
    insert into resultado values (4, 'un rol operativo no registra consultas clínicas', 'rechazado', 'aceptado');
  exception when others then
    insert into resultado values (4, 'un rol operativo no registra consultas clínicas', 'rechazado', 'rechazado');
  end;

  -- 5. El equipo clínico sí, y queda la fila en auditoría.
  perform set_config('request.jwt.claims',
    json_build_object('sub', clinico, 'role', 'authenticated')::text, true);

  select count(*) into antes from public.auditoria
  where accion = 'CONSULTAR' and entidad = 'sesiones_fono' and entidad_id = estudiante::text;

  perform public.registrar_consulta_clinica(estudiante);

  select count(*) into despues from public.auditoria
  where accion = 'CONSULTAR' and entidad = 'sesiones_fono' and entidad_id = estudiante::text;

  insert into resultado values (5, 'abrir la ficha clínica queda registrado', '1', (despues - antes)::text);

  -- 6. Repetir en la misma hora no duplica la anotación.
  perform public.registrar_consulta_clinica(estudiante);
  perform public.registrar_consulta_clinica(estudiante);

  select count(*) into n from public.auditoria
  where accion = 'CONSULTAR' and entidad = 'sesiones_fono' and entidad_id = estudiante::text;

  insert into resultado values (6, 'tres aperturas seguidas dejan una sola anotación', '1', (n - antes)::text);

  -- 7. Un estudiante inexistente no genera registro ni filtra su existencia.
  begin
    perform public.registrar_consulta_clinica(-1);
    insert into resultado values (7, 'una ficha inexistente se rechaza', 'rechazado', 'aceptado');
  exception when others then
    insert into resultado values (7, 'una ficha inexistente se rechaza', 'rechazado', 'rechazado');
  end;

  reset role;
end
$pruebas$;

select n, prueba, esperado, obtenido,
       case when esperado is not distinct from obtenido then 'OK' else 'FALLA' end as veredicto
from resultado order by n;

do $veredicto$
declare fallas int; detalle text;
begin
  select count(*), string_agg(prueba || ' (esperaba «' || esperado || '», obtuvo «' || obtenido || '»)', '; ')
    into fallas, detalle
  from resultado where esperado is distinct from obtenido;

  if fallas > 0 then
    raise exception 'candado de sesión y lectura clínica: % comprobaciones fallaron: %', fallas, detalle;
  end if;
  raise notice 'candado de sesión y lectura clínica: % comprobaciones OK', (select count(*) from resultado);
end
$veredicto$;

rollback;
