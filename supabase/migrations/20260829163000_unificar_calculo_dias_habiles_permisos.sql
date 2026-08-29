-- =============================================================================
-- Fase 0 · corrección — Un solo cálculo de días hábiles, un solo dueño del estado
--
-- Detectado al probar las tres migrations anteriores contra la base real.
--
-- Sobre `solicitudes_permiso` convivían dos implementaciones:
--   solicitudes_permiso_dias    → set_dias_habiles_permiso   → dias_habiles_permiso    (con feriados)
--   solicitudes_permiso_prepare → prepare_permission_request → calculate_business_days (sin feriados)
--
-- Los triggers BEFORE corren en orden alfabético, así que `_prepare` pisaba a
-- `_dias` y el descuento de feriados no se aplicaba nunca.
--
-- Además `_prepare` fijaba resuelta_por/resuelta_en ante cualquier cambio de
-- estado, lo que viola la constraint `resolucion_coherente` creada en
-- 20260829160100 al pasar a 'observada': observar una solicitud fallaba.
--
-- Reparto de responsabilidades a partir de acá:
--   _prepare    → identidad del solicitante e inmutabilidad del encuadre
--   _dias       → días hábiles en el INSERT
--   _transicion → quién puede pasar a qué estado, y los datos de resolución
-- =============================================================================

begin;

create or replace function public.prepare_permission_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.solicitante_id := auth.uid();
    select nombre into new.solicitante_nombre
    from public.perfiles
    where id = auth.uid() and activo = true;

    if new.solicitante_nombre is null then
      raise exception 'No existe un perfil activo para crear la solicitud';
    end if;

    -- Nadie nace aprobado.
    new.estado := 'pendiente';
    new.resuelta_por := null;
    new.resuelta_en := null;
    new.comentario_resolucion := null;
  else
    -- Identidad y encuadre de la solicitud: inmutables.
    new.solicitante_id     := old.solicitante_id;
    new.solicitante_nombre := old.solicitante_nombre;
    new.sede_id            := old.sede_id;
    new.tipo               := old.tipo;

    -- Fechas, jornada, motivo y estado NO se tocan acá: los gobierna
    -- enforce_permiso_transicion, que corre después (_prepare < _transicion).
  end if;

  return new;
end;
$$;

-- Ya no la usa nadie: dias_habiles_permiso la reemplaza y sí descuenta feriados.
drop function if exists public.calculate_business_days(date, date, text);

-- Advisor 0011: sin search_path fijo, una función queda expuesta a que el
-- search_path de la sesión decida qué objetos resuelve.
create or replace function public.hoy_santiago()
returns date
language sql
stable
set search_path = public
as $$ select (now() at time zone 'America/Santiago')::date; $$;

revoke all on function public.prepare_permission_request() from public, anon, authenticated;

commit;
