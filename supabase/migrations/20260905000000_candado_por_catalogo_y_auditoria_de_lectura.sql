-- =============================================================================
-- Dos correcciones de la auditoría de septiembre de 2026.
--
-- S-03: el candado de contraseña temporal dejaba de aplicarse solo.
-- S-09: quién *consulta* una ficha clínica no quedaba registrado en ninguna
--       parte. Escribir sí; mirar no.
-- =============================================================================
begin;

-- -----------------------------------------------------------------------------
-- S-03. El candado de sesión se deriva del catálogo, no de una lista a mano.
--
-- La política `sesion_lista` es lo que hace cumplir de verdad el cambio de
-- contraseña inicial y el chequeo de `activo`. Se aplicaba recorriendo un
-- arreglo literal de 27 nombres de tabla escrito en la migración anterior.
--
-- El problema no es el arreglo: es la dirección. Una tabla nueva quedaba fuera
-- por omisión, en silencio, y el modo de fallo era el peor de todos —no revienta
-- nada, simplemente esa tabla no exige sesión habilitada—. Invertir el criterio
-- lo vuelve seguro por defecto: entran todas las tablas con RLS y salen solo las
-- que se excluyen a propósito, cada una con su motivo escrito.
--
-- La prueba `07_candado_de_sesion.sql` falla si aparece una tabla sin candado
-- que nadie declaró exenta.
-- -----------------------------------------------------------------------------

create or replace function public.tablas_exentas_del_candado_de_sesion()
returns text[]
language sql
immutable
set search_path = public
as $$
  select array[
    -- Con contraseña temporal hay que poder leer el perfil propio: es lo que
    -- decide qué pantalla se muestra, y sin eso no se llega ni a la de cambio.
    'perfiles',
    -- No tiene grants para `authenticated` y la escribe la Edge Function con la
    -- clave de servicio. Una política más no agrega nada.
    'admin_user_rate_limits'
  ];
$$;

comment on function public.tablas_exentas_del_candado_de_sesion() is
  'Tablas que a propósito no llevan la política restrictiva sesion_lista. Agregar una acá es una decisión, no un olvido.';

do $$
declare fila record;
begin
  for fila in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'r'
      and c.relrowsecurity
      and c.relname <> all (public.tablas_exentas_del_candado_de_sesion())
    order by c.relname
  loop
    execute format('drop policy if exists sesion_lista on public.%I', fila.relname);
    execute format(
      'create policy sesion_lista on public.%I as restrictive for all to authenticated '
      || 'using (public.session_ready()) with check (public.session_ready())',
      fila.relname
    );
  end loop;
end;
$$;

-- Lo que la prueba consulta. Devolver filas acá significa que alguien creó una
-- tabla con RLS y no decidió si lleva candado.
create or replace function public.tablas_sin_candado_de_sesion()
returns table (tabla text)
language sql
stable
set search_path = public
as $$
  select c.relname::text
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind = 'r'
    and c.relrowsecurity
    and c.relname <> all (public.tablas_exentas_del_candado_de_sesion())
    and not exists (
      select 1
      from pg_policy p
      where p.polrelid = c.oid
        and p.polname = 'sesion_lista'
    )
  order by 1;
$$;

revoke all on function public.tablas_sin_candado_de_sesion() from public, anon;
grant execute on function public.tablas_sin_candado_de_sesion() to authenticated;

-- -----------------------------------------------------------------------------
-- S-09. Auditoría de lectura de la ficha clínica.
--
-- `sesiones_fono` y `estudiantes.diagnostico` son datos de salud de menores.
-- `audit_row_change()` registra quién escribe. Quién *abre* la ficha de un niño
-- no quedaba registrado, y para un dato sensible la consulta importa tanto como
-- la modificación.
--
-- Se registra desde el cliente por RPC y no con un trigger, porque en Postgres
-- no hay disparador de SELECT. La función igual comprueba rol y sede: no sirve
-- para anotar consultas que la RLS no habría permitido.
-- -----------------------------------------------------------------------------

-- La restricción se busca por su definición y no por su nombre: el `check`
-- estaba escrito en línea en la columna, así que el nombre lo puso Postgres y
-- confiar en que sea el esperado es una suposición que puede fallar callada.
do $$
declare nombre text;
begin
  for nombre in
    select con.conname
    from pg_constraint con
    where con.conrelid = 'public.auditoria'::regclass
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) like '%CREAR%'
  loop
    execute format('alter table public.auditoria drop constraint %I', nombre);
  end loop;
end;
$$;

alter table public.auditoria add constraint auditoria_accion_check
  check (accion in ('CREAR', 'MODIFICAR', 'ELIMINAR', 'CERRAR', 'CONSULTAR'));

create or replace function public.registrar_consulta_clinica(p_estudiante_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sede text;
begin
  if not public.session_ready() then
    raise exception 'La sesión no está habilitada';
  end if;

  if not public.has_role(array['director', 'fonoaudiologo', 'jefe_utp']) then
    raise exception 'Solo el equipo clínico consulta la ficha fonoaudiológica';
  end if;

  select sede_id into v_sede
  from public.estudiantes
  where id = p_estudiante_id;

  if v_sede is null or not public.can_access_sede(v_sede) then
    raise exception 'El estudiante no pertenece a una sede autorizada';
  end if;

  -- Una anotación por persona, ficha y hora. El registro sirve para saber quién
  -- miró qué, no para contar cuántas veces se repintó un componente de React.
  if exists (
    select 1
    from public.auditoria
    where accion = 'CONSULTAR'
      and entidad = 'sesiones_fono'
      and entidad_id = p_estudiante_id::text
      and usuario_id = auth.uid()
      and created_at > now() - interval '1 hour'
  ) then
    return;
  end if;

  insert into public.auditoria (accion, entidad, entidad_id, usuario_id, sede_id)
  values ('CONSULTAR', 'sesiones_fono', p_estudiante_id::text, auth.uid(), v_sede);
end;
$$;

revoke all on function public.registrar_consulta_clinica(bigint) from public, anon;
grant execute on function public.registrar_consulta_clinica(bigint) to authenticated;

comment on function public.registrar_consulta_clinica(bigint) is
  'Deja constancia de que alguien abrió la ficha fonoaudiológica de un estudiante. Ley 21.719: en dato sensible, la lectura también se audita.';

commit;
