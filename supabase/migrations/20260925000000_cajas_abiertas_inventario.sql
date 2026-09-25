-- El total sigue teniendo una sola fuente: inventario_movimientos. Estas dos
-- columnas describen la presentación física, sin duplicar el stock total.
-- Una caja abierta por producto como máximo: bodega usa esa antes de abrir otra.
begin;

alter table public.inventario_items
  add column cajas_cerradas integer,
  add column unidades_caja_abierta integer,
  add constraint inventario_empaque_coherente check (
    (cajas_cerradas is null and unidades_caja_abierta is null)
    or (unidades_por_caja is not null and cajas_cerradas >= 0
        and unidades_caja_abierta >= 0 and unidades_caja_abierta < unidades_por_caja)
  );

alter table public.inventario_movimientos
  add column cantidad_cajas integer not null default 0
  check (cantidad_cajas >= 0);

-- La escuela confirmó que las cajas del conteo original estaban selladas.
-- Solo se precargan productos cuyo único movimiento sigue siendo ese conteo;
-- cualquier caso que haya cambiado se deja pendiente de conteo físico.
with original(referencia, stock, cajas) as (values
  (3, 72::numeric, 6), (6, 218::numeric, 17), (7, 120::numeric, 9),
  (8, 737::numeric, 29), (10, 288::numeric, 24), (11, 72::numeric, 6),
  (19, 448::numeric, 32), (20, 84::numeric, 7), (21, 24::numeric, 2)
)
update public.inventario_items i
set cajas_cerradas = o.cajas, unidades_caja_abierta = 0
from original o
where i.compartido and i.sede_id = 'gambino'
  and substring(i.descripcion from 'Ref\. listado: ([0-9]+)$')::integer = o.referencia
  and i.stock_actual = o.stock
  and (select count(*) from public.inventario_movimientos m where m.item_id = i.id) = 1
  and exists (select 1 from public.inventario_movimientos m
              where m.item_id = i.id
                and m.motivo = 'Conteo inicial de útiles compartidos por ambas escuelas');

-- Los productos nuevos o vacíos no requieren un conteo inicial.
update public.inventario_items
set cajas_cerradas = 0, unidades_caja_abierta = 0
where unidades_por_caja is not null and stock_actual = 0 and cajas_cerradas is null;

-- Protege el desglose igual que el stock total. Cambiar el tamaño de caja
-- invalida el conteo anterior: no se puede reutilizar otra equivalencia.
create or replace function public.proteger_stock_actual()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.stock_actual is distinct from old.stock_actual
     and coalesce(current_setting('app.movimiento_inventario', true), '') <> 'ok' then
    raise exception 'El stock se cambia registrando un movimiento, no editando el producto';
  end if;
  if new.unidades_por_caja is distinct from old.unidades_por_caja then
    new.cajas_cerradas := case when new.unidades_por_caja is not null and new.stock_actual = 0 then 0 else null end;
    new.unidades_caja_abierta := case when new.unidades_por_caja is not null and new.stock_actual = 0 then 0 else null end;
  elsif (new.cajas_cerradas is distinct from old.cajas_cerradas
         or new.unidades_caja_abierta is distinct from old.unidades_caja_abierta)
     and coalesce(current_setting('app.movimiento_inventario', true), '') <> 'ok'
     and coalesce(current_setting('app.conteo_empaque', true), '') <> 'ok' then
    raise exception 'Las cajas se actualizan mediante movimientos o conteo de presentación';
  end if;
  return new;
end;
$$;

create or replace function public.inicializar_empaque_producto()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.unidades_por_caja is not null then
    new.cajas_cerradas := 0;
    new.unidades_caja_abierta := 0;
  else
    new.cajas_cerradas := null;
    new.unidades_caja_abierta := null;
  end if;
  return new;
end;
$$;
create trigger inventario_items_inicializar_empaque
before insert on public.inventario_items
for each row execute function public.inicializar_empaque_producto();

-- Las entradas por caja suman cajas cerradas. Las salidas de unidades usan
-- primero la caja abierta, luego las unidades sueltas, y por último abren una
-- caja cerrada. Si aún no hay conteo confiable, el total se mueve normalmente
-- pero el desglose permanece desconocido hasta que bodega lo concilie.
create or replace function public.aplicar_movimiento_inventario()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  it public.inventario_items;
  resultante numeric(12,2);
  cerradas integer;
  abierta integer;
  sueltas integer;
  por_sacar integer;
  tomado integer;
begin
  select * into it from public.inventario_items where id = new.item_id for update;
  if not found then raise exception 'El producto no existe'; end if;
  if not it.activo then
    raise exception 'El producto "%" está dado de baja: reactívalo antes de moverlo', it.nombre;
  end if;
  new.sede_id := it.sede_id;
  resultante := it.stock_actual + new.cantidad;
  if resultante < 0 then
    raise exception 'Stock insuficiente de "%": hay % % y se intentan sacar %',
      it.nombre, it.stock_actual, it.unidad, abs(new.cantidad);
  end if;
  if new.cantidad_cajas > 0 and
     (it.unidades_por_caja is null
       or abs(new.cantidad) <> new.cantidad_cajas * it.unidades_por_caja) then
    raise exception 'La cantidad de cajas no coincide con la equivalencia del producto';
  end if;

  cerradas := it.cajas_cerradas;
  abierta := it.unidades_caja_abierta;
  if cerradas is not null and abierta is not null then
    sueltas := it.stock_actual::integer - cerradas * it.unidades_por_caja - abierta;
    if sueltas < 0 then
      cerradas := null;
      abierta := null;
    elsif new.cantidad > 0 then
      if new.cantidad_cajas > 0 then cerradas := cerradas + new.cantidad_cajas; end if;
      -- Las otras entradas son unidades sueltas; el nuevo total las refleja.
    elsif new.cantidad_cajas > 0 then
      if cerradas < new.cantidad_cajas then
        raise exception 'No hay suficientes cajas cerradas de "%". Revisa el conteo de presentación.', it.nombre;
      end if;
      cerradas := cerradas - new.cantidad_cajas;
    else
      por_sacar := abs(new.cantidad)::integer;
      tomado := least(por_sacar, abierta);
      abierta := abierta - tomado;
      por_sacar := por_sacar - tomado;
      tomado := least(por_sacar, sueltas);
      por_sacar := por_sacar - tomado;
      while por_sacar > 0 loop
        if cerradas = 0 then
          raise exception 'El desglose de cajas de "%" no alcanza. Realiza un conteo de presentación.', it.nombre;
        end if;
        cerradas := cerradas - 1;
        tomado := least(por_sacar, it.unidades_por_caja);
        abierta := it.unidades_por_caja - tomado;
        por_sacar := por_sacar - tomado;
      end loop;
    end if;
  end if;

  perform set_config('app.movimiento_inventario', 'ok', true);
  update public.inventario_items
  set stock_actual = resultante, cajas_cerradas = cerradas,
      unidades_caja_abierta = abierta, updated_at = now()
  where id = new.item_id;
  perform set_config('app.movimiento_inventario', '', true);
  return new;
end;
$$;

-- El desglose manual no altera el total ni inventa movimientos de stock; deja
-- constancia de quién confirmó las cajas, la caja abierta y las unidades libres.
create table public.inventario_conteos_empaque (
  id bigint generated by default as identity primary key,
  item_id bigint not null references public.inventario_items(id) on delete restrict,
  stock_total numeric(12,2) not null,
  cajas_cerradas integer not null,
  unidades_caja_abierta integer not null,
  unidades_sueltas integer not null,
  motivo text not null,
  actor_id uuid references public.perfiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create index inventario_conteos_empaque_item_idx
  on public.inventario_conteos_empaque (item_id, created_at desc);
alter table public.inventario_conteos_empaque enable row level security;
create policy "conteos_empaque_select_bodega" on public.inventario_conteos_empaque
  for select to authenticated using (
    public.gestiona_bodega() and exists (
      select 1 from public.inventario_items i
      where i.id = item_id and public.can_access_sede(i.sede_id)
    )
  );
grant select on public.inventario_conteos_empaque to authenticated;
revoke all on public.inventario_conteos_empaque from anon;

create function public.conciliar_empaque_inventario(
  p_item_id bigint, p_cajas_cerradas integer,
  p_unidades_caja_abierta integer, p_unidades_sueltas integer,
  p_motivo text default 'Conteo físico de presentaciones'
) returns void language plpgsql security definer set search_path = public as $$
declare it public.inventario_items;
begin
  select * into it from public.inventario_items where id = p_item_id for update;
  if not found then raise exception 'Producto no encontrado'; end if;
  if not (public.gestiona_bodega() and public.can_access_sede(it.sede_id)) then
    raise exception 'No tienes autorización para contar este producto';
  end if;
  if it.unidades_por_caja is null then
    raise exception 'Este producto no tiene unidades por caja configuradas';
  end if;
  if p_cajas_cerradas is null or p_cajas_cerradas < 0
     or p_unidades_caja_abierta is null or p_unidades_caja_abierta < 0
     or p_unidades_caja_abierta >= it.unidades_por_caja
     or p_unidades_sueltas is null or p_unidades_sueltas < 0 then
    raise exception 'El conteo de cajas y unidades no es válido';
  end if;
  if p_cajas_cerradas * it.unidades_por_caja
      + p_unidades_caja_abierta + p_unidades_sueltas <> it.stock_actual then
    raise exception 'El desglose no coincide con el stock de % %; corrige primero el total si el conteo físico es distinto',
      it.stock_actual, it.unidad;
  end if;
  perform set_config('app.conteo_empaque', 'ok', true);
  update public.inventario_items set cajas_cerradas = p_cajas_cerradas,
    unidades_caja_abierta = p_unidades_caja_abierta where id = p_item_id;
  perform set_config('app.conteo_empaque', '', true);
  insert into public.inventario_conteos_empaque
    (item_id, stock_total, cajas_cerradas, unidades_caja_abierta,
     unidades_sueltas, motivo)
  values (p_item_id, it.stock_actual, p_cajas_cerradas,
    p_unidades_caja_abierta, p_unidades_sueltas,
    coalesce(nullif(btrim(p_motivo), ''), 'Conteo físico de presentaciones'));
end;
$$;
revoke all on function public.conciliar_empaque_inventario(bigint, integer, integer, integer, text) from public, anon;
grant execute on function public.conciliar_empaque_inventario(bigint, integer, integer, integer, text) to authenticated;

-- La vista agrega el desglose al final para no cambiar sus columnas anteriores.
create or replace view public.inventario_estado_vista with (security_invoker = true) as
select
  i.id, i.sede_id, i.categoria_id, c.nombre as categoria, i.nombre, i.descripcion,
  i.unidad, u.nombre as unidad_nombre, i.stock_actual, i.stock_minimo,
  i.ubicacion, i.activo,
  case when i.stock_actual <= 0 then 'agotado'
       when i.stock_minimo > 0 and i.stock_actual <= i.stock_minimo then 'bajo'
       else 'ok' end as estado_stock,
  greatest(i.stock_minimo - i.stock_actual, 0)::numeric(12,2) as faltante,
  i.created_at, i.updated_at, i.compartido, i.unidades_por_caja,
  i.cajas_cerradas, i.unidades_caja_abierta,
  case when i.cajas_cerradas is not null and i.unidades_caja_abierta is not null
            and i.unidades_por_caja is not null
            and i.stock_actual >= i.cajas_cerradas * i.unidades_por_caja + i.unidades_caja_abierta
       then (i.stock_actual - i.cajas_cerradas * i.unidades_por_caja
             - i.unidades_caja_abierta)::integer end as unidades_sueltas,
  (i.cajas_cerradas is not null and i.unidades_caja_abierta is not null
   and i.unidades_por_caja is not null
   and i.stock_actual >= i.cajas_cerradas * i.unidades_por_caja
      + i.unidades_caja_abierta) as empaque_verificado
from public.inventario_items i
join public.inventario_categorias c on c.id = i.categoria_id
join public.inventario_unidades u on u.codigo = i.unidad;

create or replace view public.mis_productos_frecuentes_vista
with (security_invoker = true) as
select f.id as frecuente_id, f.orden, f.rol, f.perfil_id, i.*
from public.productos_frecuentes f
join public.inventario_estado_vista i on i.id = f.item_id
where f.rol = public.current_profile_role() or f.perfil_id = auth.uid();

-- Si se repara un total que estaba descuadrado, el desglose necesita un
-- conteo nuevo. Nunca se siguen mostrando cajas supuestamente verificadas.
create or replace function public.recalcular_stock(p_item_id bigint default null)
returns integer language plpgsql security definer set search_path = public as $$
declare corregidos integer := 0;
begin
  if not public.gestiona_bodega() then
    raise exception 'No tienes autorización para recalcular el stock';
  end if;
  perform set_config('app.movimiento_inventario', 'ok', true);
  with real as (
    select i.id, coalesce(sum(m.cantidad), 0)::numeric(12,2) as stock
    from public.inventario_items i
    left join public.inventario_movimientos m on m.item_id = i.id
    where (p_item_id is null or i.id = p_item_id)
      and public.can_access_sede(i.sede_id)
    group by i.id
  )
  update public.inventario_items i
  set stock_actual = real.stock, cajas_cerradas = null,
      unidades_caja_abierta = null, updated_at = now()
  from real
  where i.id = real.id and i.stock_actual is distinct from real.stock;
  get diagnostics corregidos = row_count;
  perform set_config('app.movimiento_inventario', '', true);
  return corregidos;
end;
$$;

-- Se conserva la entrega atómica existente; cada línea por caja marca en el
-- movimiento que efectivamente salió una caja cerrada.
create or replace function public.entregar_solicitud_material(p_id bigint, p_entregas jsonb)
returns void language plpgsql security definer set search_path = public as $$
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
  for entrega in select * from jsonb_array_elements(p_entregas) loop
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
        (item_id, tipo, cantidad, cantidad_cajas, motivo, observaciones, solicitud_id)
      values (
        it.item_id, 'entrega', -cant,
        case when it.cantidad_cajas > 0 then (cant / it.unidades_por_caja_solicitada)::integer else 0 end,
        'Solicitud #' || p_id || ' — ' || s.titulo,
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

-- «Pedir insumos» es una sola operación: si falla una línea o el envío, no
-- queda un borrador huérfano. El nombre, la unidad y el factor vienen del
-- catálogo, nunca de lo que mande el navegador.
create function public.crear_pedido_insumos(
  p_sede_id text, p_titulo text, p_nota text, p_items jsonb
) returns bigint language plpgsql security definer set search_path = public as $$
declare
  nuevo_id bigint;
  linea jsonb;
  producto public.inventario_items;
  unidades numeric(10,2);
  cajas integer;
begin
  if not public.can_access_sede(p_sede_id) then
    raise exception 'No tienes autorización para pedir materiales de esta sede';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) = 0 or jsonb_array_length(p_items) > 100 then
    raise exception 'El pedido debe tener entre 1 y 100 líneas';
  end if;
  if length(btrim(coalesce(p_titulo, ''))) not between 3 and 160
     or length(coalesce(p_nota, '')) > 1000 then
    raise exception 'El título o la nota del pedido no son válidos';
  end if;
  insert into public.solicitudes_materiales
    (solicitante_id, sede_id, titulo, justificacion, prioridad)
  values (auth.uid(), p_sede_id, btrim(p_titulo), nullif(btrim(p_nota), ''), 'normal')
  returning id into nuevo_id;

  for linea in select * from jsonb_array_elements(p_items) loop
    select * into producto from public.inventario_items
    where id = (linea ->> 'item_id')::bigint
      and activo and (sede_id = p_sede_id or compartido);
    if not found then raise exception 'Uno de los productos no está disponible en esta sede'; end if;
    unidades := (linea ->> 'cantidad')::numeric(10,2);
    cajas := coalesce((linea ->> 'cantidad_cajas')::integer, 0);
    if unidades is null or unidades <= 0 or cajas < 0 then
      raise exception 'Indica cantidades positivas';
    end if;
    if cajas > 0 and (producto.unidades_por_caja is null
                       or unidades <> cajas * producto.unidades_por_caja) then
      raise exception 'La caja de "%" no coincide con su equivalencia actual', producto.nombre;
    end if;
    if producto.unidad not in ('litro', 'kilo') and mod(unidades, 1) <> 0 then
      raise exception 'El producto "%" se pide en unidades completas', producto.nombre;
    end if;
    if exists (select 1 from public.solicitudes_materiales_items i
               where i.solicitud_id = nuevo_id and i.item_id = producto.id
                 and (i.cantidad_cajas > 0) = (cajas > 0)) then
      raise exception 'El producto "%" está repetido en la misma presentación', producto.nombre;
    end if;
    insert into public.solicitudes_materiales_items
      (solicitud_id, nombre, cantidad, unidad, item_id, cantidad_cajas,
       unidades_por_caja_solicitada)
    values (nuevo_id, producto.nombre, unidades, producto.unidad, producto.id,
            cajas, case when cajas > 0 then producto.unidades_por_caja end);
  end loop;
  perform public.enviar_solicitud_material(nuevo_id);
  return nuevo_id;
end;
$$;
revoke all on function public.crear_pedido_insumos(text, text, text, jsonb) from public, anon;
grant execute on function public.crear_pedido_insumos(text, text, text, jsonb) to authenticated;

commit;
