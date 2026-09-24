-- Un producto compartido conserva un solo saldo y puede ser pedido desde
-- cualquiera de las dos sedes. sede_id identifica la bodega que lo administra;
-- compartido indica que el stock pertenece a ambas escuelas.
begin;

alter table public.inventario_items
  add column if not exists compartido boolean not null default false;

insert into public.inventario_unidades (codigo, nombre)
values ('estuche', 'Estuche'), ('lapiz', 'Lápiz'), ('pack', 'Pack')
on conflict (codigo) do nothing;

-- PostgreSQL permite agregar columnas al final de una vista existente sin
-- invalidar las vistas que ya dependen de sus columnas anteriores.
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
  i.created_at, i.updated_at,
  i.compartido
from public.inventario_items i
join public.inventario_categorias c on c.id = i.categoria_id
join public.inventario_unidades u on u.codigo = i.unidad;

create or replace view public.mis_productos_frecuentes_vista
with (security_invoker = true) as
select f.id as frecuente_id, f.orden, f.rol, f.perfil_id, i.*
from public.productos_frecuentes f
join public.inventario_estado_vista i on i.id = f.item_id
where f.rol = public.current_profile_role() or f.perfil_id = auth.uid();

-- La lista de compra usa la misma regla de visibilidad que la bodega.
create or replace view public.lista_compra_sugerida_vista
with (security_invoker = true) as
with consumo as (
  select mv.item_id, sum(-mv.cantidad) as consumo_90d
  from public.inventario_movimientos mv
  where mv.tipo = 'entrega' and mv.created_at >= now() - interval '90 days'
  group by mv.item_id
), ultima_compra as (
  select mv.item_id, max(mv.created_at) as fecha
  from public.inventario_movimientos mv
  where mv.tipo in ('compra', 'ingreso')
  group by mv.item_id
)
select
  i.id, i.sede_id, i.categoria_id, i.categoria, i.nombre,
  i.unidad, i.unidad_nombre, i.ubicacion,
  i.stock_actual, i.stock_minimo, i.estado_stock, i.faltante,
  coalesce(c.consumo_90d, 0)::numeric(12,2) as consumo_90d,
  (coalesce(c.consumo_90d, 0) / 3)::numeric(12,2) as consumo_mensual,
  ceil(i.faltante + coalesce(c.consumo_90d, 0) / 3)::numeric(12,2) as sugerido,
  u.fecha as ultima_compra,
  i.compartido
from public.inventario_estado_vista i
left join consumo c on c.item_id = i.id
left join ultima_compra u on u.item_id = i.id
where i.activo and i.estado_stock in ('agotado', 'bajo');

create or replace view public.panel_operaciones_vista
with (security_invoker = true) as
select
  s.id as sede_id,
  s.nombre as sede_nombre,
  (select count(*) from public.solicitudes_materiales m
    where m.sede_id = s.id and m.estado = 'pendiente') as materiales_por_revisar,
  (select count(*) from public.solicitudes_materiales m
    where m.sede_id = s.id and m.estado in ('aprobada','en_compra','compra_parcial')) as materiales_por_comprar,
  (select count(*) from public.solicitudes_materiales m
    where m.sede_id = s.id and m.estado in ('comprada','preparando','entregada_parcial')) as materiales_por_entregar,
  (select count(*) from public.solicitudes_permiso p
    where p.sede_id = s.id and p.estado = 'pendiente') as permisos_por_resolver,
  (select count(*) from public.inventario_estado_vista i
    where (i.sede_id = s.id or i.compartido) and i.activo and i.estado_stock = 'agotado') as productos_agotados,
  (select count(*) from public.inventario_estado_vista i
    where (i.sede_id = s.id or i.compartido) and i.activo and i.estado_stock = 'bajo') as productos_bajo_minimo,
  (select count(*) from public.mantenciones t
    where t.sede_id = s.id and t.estado not in ('cerrada','cancelada')) as mantenciones_abiertas,
  (select count(*) from public.mantenciones t
    where t.sede_id = s.id and t.prioridad = 'urgente'
      and t.estado not in ('resuelta','cerrada','cancelada')) as mantenciones_urgentes,
  (select count(*) from public.mantenciones t
    where t.sede_id = s.id and t.estado = 'resuelta') as mantenciones_por_cerrar,
  (select count(*) from public.preventivas_estado_vista v
    where v.sede_id = s.id and v.activo and v.estado_preventiva = 'vencida') as preventivas_vencidas,
  (select count(*) from public.preventivas_estado_vista v
    where v.sede_id = s.id and v.activo and v.estado_preventiva = 'proxima') as preventivas_proximas,
  (select count(*) from public.prestamos_vista pr
    where pr.sede_id = s.id and pr.situacion = 'atrasado') as prestamos_atrasados
from public.sedes s
where s.activo;

drop policy if exists "items_select_sede" on public.inventario_items;
create policy "items_select_sede" on public.inventario_items
  for select to authenticated
  using (public.can_access_sede(sede_id) or (compartido and public.is_active_user()));

drop policy if exists "items_manage_bodega" on public.inventario_items;
create policy "items_manage_bodega" on public.inventario_items
  for all to authenticated
  using (public.gestiona_bodega() and (public.can_access_sede(sede_id) or compartido))
  with check (public.gestiona_bodega() and (public.can_access_sede(sede_id) or compartido));

drop policy if exists "movimientos_select_sede" on public.inventario_movimientos;
create policy "movimientos_select_sede" on public.inventario_movimientos
  for select to authenticated
  using (exists (
    select 1 from public.inventario_items i
    where i.id = item_id
      and (public.can_access_sede(i.sede_id) or (i.compartido and public.is_active_user()))
  ));

drop policy if exists "movimientos_insert_bodega" on public.inventario_movimientos;
create policy "movimientos_insert_bodega" on public.inventario_movimientos
  for insert to authenticated
  with check (public.gestiona_bodega() and exists (
    select 1 from public.inventario_items i
    where i.id = item_id and (public.can_access_sede(i.sede_id) or i.compartido)
  ));

drop policy if exists "frecuentes_select" on public.productos_frecuentes;
create policy "frecuentes_select" on public.productos_frecuentes
  for select to authenticated
  using (exists (
    select 1 from public.inventario_items i
    where i.id = item_id
      and (public.can_access_sede(i.sede_id) or (i.compartido and public.is_active_user()))
  ));

drop policy if exists "frecuentes_manage" on public.productos_frecuentes;
create policy "frecuentes_manage" on public.productos_frecuentes
  for all to authenticated
  using (public.gestiona_bodega() and exists (
    select 1 from public.inventario_items i
    where i.id = item_id and (public.can_access_sede(i.sede_id) or i.compartido)
  ))
  with check (public.gestiona_bodega() and exists (
    select 1 from public.inventario_items i
    where i.id = item_id and (public.can_access_sede(i.sede_id) or i.compartido)
  ));

create or replace function public.validar_item_material_sede()
returns trigger
language plpgsql security definer set search_path = public as $$
declare solicitud_sede text; inventario_sede text; es_compartido boolean;
begin
  if new.item_id is null then return new; end if;
  select sede_id into solicitud_sede
  from public.solicitudes_materiales where id = new.solicitud_id;
  select sede_id, compartido into inventario_sede, es_compartido
  from public.inventario_items where id = new.item_id;
  if not found or (not es_compartido and solicitud_sede is distinct from inventario_sede) then
    raise exception 'El producto de inventario no pertenece a la sede de la solicitud';
  end if;
  return new;
end;
$$;

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

    if it.item_id is not null then
      if not exists (
        select 1 from public.inventario_items i
        where i.id = it.item_id and (i.sede_id = s.sede_id or i.compartido)
      ) then
        raise exception 'El producto "%" no pertenece a la sede de la solicitud', it.nombre;
      end if;
      insert into public.inventario_movimientos (item_id, tipo, cantidad, motivo, solicitud_id)
      values (it.item_id, 'entrega', -cant, 'Solicitud #' || p_id || ' — ' || s.titulo, p_id);
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
