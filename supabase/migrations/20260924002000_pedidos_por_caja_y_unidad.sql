-- El stock sigue expresado en la unidad base del producto. Una caja es una
-- presentación para pedir/entregar, no un segundo stock que pueda desfasarse.
begin;

alter table public.inventario_items
  add column unidades_por_caja integer
  check (unidades_por_caja between 2 and 1000),
  add constraint inventario_caja_distinta_de_unidad check (
    unidades_por_caja is null or unidad <> 'caja'
  );

-- Solo se configuran cajas que contienen varias unidades de inventario. Una
-- caja de 12 colores que ya se cuenta como «1 caja» no se transforma en 12
-- lápices: son productos y unidades de stock distintos.
update public.inventario_items
set unidades_por_caja = case
  when substring(descripcion from 'Ref\. listado: ([0-9]+)$')::integer = 8 then 24
  when substring(descripcion from 'Ref\. listado: ([0-9]+)$')::integer = 19 then 14
  else 12
end
where compartido
  and sede_id = 'gambino'
  and substring(descripcion from 'Ref\. listado: ([0-9]+)$')::integer
      in (3, 6, 7, 8, 10, 11, 19, 20, 21);

do $$
begin
  if (select count(*) from public.inventario_items
      where compartido and sede_id = 'gambino' and unidades_por_caja is not null) <> 9 then
    raise exception 'No se configuraron las 9 presentaciones por caja esperadas';
  end if;
end;
$$;

-- Se agrega al final para conservar las columnas existentes de la vista.
create or replace view public.inventario_estado_vista
with (security_invoker = true) as
select
  i.id, i.sede_id, i.categoria_id,
  c.nombre as categoria, i.nombre, i.descripcion, i.unidad,
  u.nombre as unidad_nombre, i.stock_actual, i.stock_minimo,
  i.ubicacion, i.activo,
  case
    when i.stock_actual <= 0 then 'agotado'
    when i.stock_minimo > 0 and i.stock_actual <= i.stock_minimo then 'bajo'
    else 'ok'
  end as estado_stock,
  greatest(i.stock_minimo - i.stock_actual, 0)::numeric(12,2) as faltante,
  i.created_at, i.updated_at, i.compartido,
  i.unidades_por_caja
from public.inventario_items i
join public.inventario_categorias c on c.id = i.categoria_id
join public.inventario_unidades u on u.codigo = i.unidad;

create or replace view public.mis_productos_frecuentes_vista
with (security_invoker = true) as
select f.id as frecuente_id, f.orden, f.rol, f.perfil_id, i.*
from public.productos_frecuentes f
join public.inventario_estado_vista i on i.id = f.item_id
where f.rol = public.current_profile_role() or f.perfil_id = auth.uid();

-- La equivalencia se guarda en cada línea del pedido. Si bodega cambia la
-- configuración del producto después, el pedido histórico no cambia.
alter table public.solicitudes_materiales_items
  add column cantidad_cajas integer not null default 0,
  add column unidades_por_caja_solicitada integer,
  add constraint materiales_items_cajas_consistentes check (
    (cantidad_cajas = 0 and unidades_por_caja_solicitada is null)
    or (cantidad_cajas > 0 and unidades_por_caja_solicitada between 2 and 1000
        and cantidad = cantidad_cajas * unidades_por_caja_solicitada)
  );

create or replace function public.validar_presentacion_material()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  unidad_producto text;
  factor_producto integer;
begin
  if new.item_id is null then
    if new.cantidad_cajas > 0 then
      raise exception 'Una caja debe estar enlazada a un producto de bodega';
    end if;
    return new;
  end if;

  select unidad, unidades_por_caja into unidad_producto, factor_producto
  from public.inventario_items where id = new.item_id;
  if not found or new.unidad <> unidad_producto then
    raise exception 'La unidad solicitada no coincide con la del producto de bodega';
  end if;
  if unidad_producto not in ('litro', 'kilo') and mod(new.cantidad, 1) <> 0 then
    raise exception 'El producto "%" se solicita en unidades completas', new.nombre;
  end if;
  if new.cantidad_cajas > 0 and
     (factor_producto is null or factor_producto <> new.unidades_por_caja_solicitada) then
    raise exception 'La equivalencia de la caja no coincide con el producto';
  end if;
  return new;
end;
$$;

create trigger materiales_items_validar_presentacion
before insert or update of item_id, cantidad, unidad, cantidad_cajas, unidades_por_caja_solicitada
on public.solicitudes_materiales_items
for each row execute function public.validar_presentacion_material();

create or replace function public.validar_cantidad_discreta_inventario()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  unidad_producto text;
begin
  select unidad into unidad_producto from public.inventario_items where id = new.item_id;
  if unidad_producto not in ('litro', 'kilo') and mod(new.cantidad, 1) <> 0 then
    raise exception 'El producto se cuenta en unidades completas';
  end if;
  return new;
end;
$$;

create trigger inventario_movimientos_cantidad_discreta
before insert or update of cantidad, item_id on public.inventario_movimientos
for each row execute function public.validar_cantidad_discreta_inventario();

-- La RPC sigue descontando unidades base y mantiene la entrega atómica. Una
-- línea pedida por caja solo se puede entregar en cajas completas.
create or replace function public.entregar_solicitud_material(p_id bigint, p_entregas jsonb)
returns void
language plpgsql security definer set search_path = public as $$
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
    if it.cantidad_cajas > 0 and mod(cant, it.unidades_por_caja_solicitada) <> 0 then
      raise exception 'El material "%" se pidió por cajas completas', it.nombre;
    end if;

    if it.item_id is not null then
      if not exists (
        select 1 from public.inventario_items i
        where i.id = it.item_id and (i.sede_id = s.sede_id or i.compartido)
      ) then
        raise exception 'El producto "%" no pertenece a la sede de la solicitud', it.nombre;
      end if;
      insert into public.inventario_movimientos
        (item_id, tipo, cantidad, motivo, observaciones, solicitud_id)
      values (
        it.item_id, 'entrega', -cant, 'Solicitud #' || p_id || ' — ' || s.titulo,
        case when it.cantidad_cajas > 0 then
          (cant / it.unidades_por_caja_solicitada)::integer || ' caja(s) de '
          || it.unidades_por_caja_solicitada || ' ' || it.unidad
        else null end,
        p_id
      );
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

commit;
