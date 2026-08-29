-- =============================================================================
-- Fase 3 — Entregar una solicitud descontando del inventario
--
-- Hasta ahora el flujo era de compra: aprobada → en_compra → comprada, y el
-- solicitante confirmaba haber recibido. Faltaba el caso más común en la
-- escuela: el material YA está en bodega y solo hay que entregarlo.
--
-- Se agrega ese camino, que converge en el mismo estado final:
--   desde stock:  aprobada → [preparando] → entregada | entregada_parcial
--   comprando:    aprobada → en_compra → comprada → entregada
--
-- `preparando` es opcional a propósito: una entrega simple va directo.
-- =============================================================================

begin;

alter table public.solicitudes_materiales drop constraint if exists solicitudes_materiales_estado_check;
alter table public.solicitudes_materiales add constraint solicitudes_materiales_estado_check
  check (estado in ('borrador','pendiente','observada','aprobada','rechazada',
                    'en_compra','compra_parcial','comprada','preparando',
                    'entregada_parcial','entregada','cancelada'));

-- El item de la solicitud se puede enlazar a un producto de bodega. Nullable a
-- propósito: una profesora puede pedir algo que no está en el inventario, y esa
-- solicitud tiene que poder existir igual.
alter table public.solicitudes_materiales_items
  add column if not exists item_id bigint
    references public.inventario_items(id) on update cascade on delete set null;

alter table public.solicitudes_materiales_items
  add column if not exists cantidad_entregada numeric(10,2) not null default 0;

alter table public.solicitudes_materiales_items
  drop constraint if exists entrega_no_excede_lo_pedido;
alter table public.solicitudes_materiales_items
  add constraint entrega_no_excede_lo_pedido
  check (cantidad_entregada >= 0 and cantidad_entregada <= cantidad);

create index if not exists solicitudes_materiales_items_producto_idx
  on public.solicitudes_materiales_items (item_id) where item_id is not null;

drop index if exists public.solicitudes_materiales_atrasadas_idx;
create index solicitudes_materiales_atrasadas_idx
  on public.solicitudes_materiales (fecha_necesidad)
  where estado in ('pendiente','observada','aprobada','en_compra','compra_parcial',
                   'preparando','entregada_parcial');

-- Los items siguen editables durante la preparación y la entrega parcial, pero
-- solo en lo que corresponde: nunca cambia lo que se pidió.
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

  if tg_op = 'UPDATE' and estado_actual in ('aprobada','en_compra','compra_parcial','comprada',
                                            'preparando','entregada_parcial') then
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

-- Marcar que bodega está juntando el pedido. Paso opcional.
create or replace function public.preparar_solicitud_material(p_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare s public.solicitudes_materiales;
begin
  select * into s from public.solicitudes_materiales where id = p_id for update;
  if not found then raise exception 'Solicitud no encontrada'; end if;
  if not (public.gestiona_bodega() and public.can_access_sede(s.sede_id)) then
    raise exception 'No tienes autorizacion para preparar solicitudes de esta sede';
  end if;
  if s.estado <> 'aprobada' then
    raise exception 'Solo se prepara una solicitud aprobada';
  end if;

  perform set_config('app.transicion_material', 'ok', true);
  update public.solicitudes_materiales set estado = 'preparando' where id = p_id;

  perform public.crear_notificacion(
    s.solicitante_id, 'material_preparando', 'Bodega esta preparando tus materiales',
    s.titulo, '/materiales/' || p_id);
end;
$$;

-- La entrega. Todo o nada.
--
-- Valida el stock, crea los movimientos, actualiza lo entregado, recalcula el
-- estado y deja historial. Si falta stock de un solo producto no queda nada
-- aplicado: el descuento y el registro viven en la misma transacción.
--
-- p_entregas: [{"item_id": <id del item de la solicitud>, "cantidad": 7}, ...]
create or replace function public.entregar_solicitud_material(
  p_id bigint,
  p_entregas jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  s          public.solicitudes_materiales;
  entrega    jsonb;
  it         public.solicitudes_materiales_items;
  cant       numeric(10,2);
  pendientes integer;
  entregados integer;
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

  for entrega in select * from jsonb_array_elements(p_entregas)
  loop
    select * into it
    from public.solicitudes_materiales_items
    where id = (entrega ->> 'item_id')::bigint and solicitud_id = p_id
    for update;

    if not found then
      raise exception 'Uno de los materiales no pertenece a esta solicitud';
    end if;

    cant := (entrega ->> 'cantidad')::numeric(10,2);
    if cant is null or cant <= 0 then
      raise exception 'La cantidad a entregar de "%" debe ser mayor que cero', it.nombre;
    end if;

    -- Impide descontar dos veces por el mismo material.
    if it.cantidad_entregada + cant > it.cantidad then
      raise exception 'De "%" se pidieron %, ya se entregaron % y ahora se intentan entregar % mas',
        it.nombre, it.cantidad, it.cantidad_entregada, cant;
    end if;

    -- Si está enlazado al inventario, el movimiento descuenta el stock. El
    -- trigger de inventario bloquea la fila y rechaza si no alcanza, con lo
    -- que toda la entrega se revierte.
    if it.item_id is not null then
      insert into public.inventario_movimientos (item_id, tipo, cantidad, motivo, solicitud_id)
      values (it.item_id, 'entrega', -cant,
              'Solicitud #' || p_id || ' — ' || s.titulo, p_id);
    end if;

    update public.solicitudes_materiales_items
    set cantidad_entregada = cantidad_entregada + cant
    where id = it.id;
  end loop;

  select
    count(*) filter (where cantidad_entregada < cantidad),
    count(*) filter (where cantidad_entregada > 0)
  into pendientes, entregados
  from public.solicitudes_materiales_items
  where solicitud_id = p_id;

  perform set_config('app.transicion_material', 'ok', true);
  update public.solicitudes_materiales
  set estado = case when pendientes = 0 then 'entregada' else 'entregada_parcial' end,
      entrega_confirmada_por = case when pendientes = 0 then auth.uid() else entrega_confirmada_por end,
      entrega_confirmada_en  = case when pendientes = 0 then now() else entrega_confirmada_en end
  where id = p_id;

  perform public.crear_notificacion(
    s.solicitante_id,
    case when pendientes = 0 then 'material_entregada' else 'material_entrega_parcial' end,
    case when pendientes = 0 then 'Recibiste tus materiales'
         else 'Recibiste parte de tus materiales' end,
    s.titulo, '/materiales/' || p_id);
end;
$$;

comment on function public.entregar_solicitud_material(bigint, jsonb) is
  'Entrega total o parcial. Descuenta el inventario de los materiales enlazados a un producto de bodega, en una sola transacción.';

revoke all on function public.preparar_solicitud_material(bigint)       from public, anon;
revoke all on function public.entregar_solicitud_material(bigint,jsonb) from public, anon;
grant execute on function public.preparar_solicitud_material(bigint)       to authenticated;
grant execute on function public.entregar_solicitud_material(bigint,jsonb) to authenticated;

commit;
