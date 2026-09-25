-- Pruebas transaccionales de empaque: nunca ejecutar contra producción.
begin;

create temp table prueba_cajas (item_id bigint, pedido_id bigint) on commit drop;
grant all on prueba_cajas to authenticated;
insert into prueba_cajas (item_id)
select id from public.inventario_items
where compartido and sede_id = 'gambino'
  and substring(descripcion from 'Ref\. listado: ([0-9]+)$')::integer = 10;

do $prueba_movimientos$
declare
  item bigint := (select item_id from prueba_cajas);
  p public.inventario_items;
  n integer;
begin
  if item is null then raise exception 'Falta el producto sintético de lápices'; end if;
  set local role authenticated;
  perform set_config('request.jwt.claims',
    '{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated"}', true);
  select * into p from public.inventario_items where id = item;
  if p.stock_actual <> 288 or p.cajas_cerradas <> 24 or p.unidades_caja_abierta <> 0 then
    raise exception 'El conteo inicial de cajas selladas no se precargó correctamente';
  end if;

  begin
    update public.inventario_items set unidades_por_caja = 13 where id = item;
    insert into public.inventario_movimientos (item_id, tipo, cantidad, cantidad_cajas)
    values (item, 'entrega', -13, 1);
    raise exception 'Se entregó una caja sin conteo físico';
  exception when raise_exception then
    if sqlerrm <> 'Confirma primero cuántas cajas cerradas quedan en Bodega' then raise; end if;
  end;

  insert into public.inventario_movimientos (item_id, tipo, cantidad, motivo)
  values (item, 'entrega', -4, 'Prueba de cuatro lápices sueltos');
  select * into p from public.inventario_items where id = item;
  if p.stock_actual <> 284 or p.cajas_cerradas <> 23 or p.unidades_caja_abierta <> 8 then
    raise exception 'Al entregar cuatro lápices no quedó una caja abierta con ocho';
  end if;

  insert into public.inventario_movimientos (item_id, tipo, cantidad, cantidad_cajas, motivo)
  values (item, 'entrega', -12, 1, 'Prueba de caja cerrada');
  select * into p from public.inventario_items where id = item;
  if p.stock_actual <> 272 or p.cajas_cerradas <> 22 or p.unidades_caja_abierta <> 8 then
    raise exception 'Una caja cerrada no se descontó por separado';
  end if;

  begin
    insert into public.inventario_movimientos (item_id, tipo, cantidad, cantidad_cajas)
    values (item, 'entrega', -12, 2);
    raise exception 'Se aceptó una cantidad de cajas inconsistente';
  exception when check_violation or raise_exception then
    if sqlerrm = 'Se aceptó una cantidad de cajas inconsistente' then raise; end if;
  end;

  perform public.conciliar_empaque_inventario(item, 22, 8, 0, 'Conteo de prueba');
  select count(*) into n from public.inventario_conteos_empaque where item_id = item;
  if n <> 1 then raise exception 'No se auditó el conteo de cajas'; end if;
end;
$prueba_movimientos$;

do $prueba_pedido$
declare
  item bigint := (select item_id from prueba_cajas);
  antes integer;
  despues integer;
  pedido bigint;
  suelta_id bigint;
  caja_id bigint;
begin
  set local role authenticated;
  perform set_config('request.jwt.claims',
    '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}', true);
  select count(*) into antes from public.solicitudes_materiales
  where solicitante_id = auth.uid();
  begin
    perform public.crear_pedido_insumos('gambino', 'Pedido inválido de prueba', '',
      jsonb_build_array(
        jsonb_build_object('item_id', item, 'cantidad', 4, 'cantidad_cajas', 0),
        jsonb_build_object('item_id', -999, 'cantidad', 1, 'cantidad_cajas', 0)
      ));
    raise exception 'Se aceptó un producto inexistente';
  exception when raise_exception then
    if sqlerrm = 'Se aceptó un producto inexistente' then raise; end if;
  end;
  select count(*) into despues from public.solicitudes_materiales
  where solicitante_id = auth.uid();
  if despues <> antes then raise exception 'Un pedido fallido dejó un borrador huérfano'; end if;

  pedido := public.crear_pedido_insumos('gambino', 'Pedido de prueba de lápices', '',
    jsonb_build_array(
      jsonb_build_object('item_id', item, 'cantidad', 4, 'cantidad_cajas', 0),
      jsonb_build_object('item_id', item, 'cantidad', 12, 'cantidad_cajas', 1)
    ));
  if (select estado from public.solicitudes_materiales where id = pedido) <> 'pendiente' then
    raise exception 'El pedido atómico no quedó enviado';
  end if;
  select id into suelta_id from public.solicitudes_materiales_items
  where solicitud_id = pedido and cantidad_cajas = 0;
  select id into caja_id from public.solicitudes_materiales_items
  where solicitud_id = pedido and cantidad_cajas = 1;
  if suelta_id is null or caja_id is null then
    raise exception 'El pedido no conservó líneas separadas para caja y sueltos';
  end if;
  update prueba_cajas set pedido_id = pedido;
end;
$prueba_pedido$;

do $prueba_entrega$
declare
  item bigint := (select item_id from prueba_cajas);
  pedido bigint := (select pedido_id from prueba_cajas);
  suelta_id bigint;
  caja_id bigint;
  p public.inventario_items;
begin
  set local role authenticated;
  perform set_config('request.jwt.claims',
    '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}', true);
  perform public.revisar_solicitud_material(pedido, 'aprobada', null, null);
  perform set_config('request.jwt.claims',
    '{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated"}', true);
  select id into suelta_id from public.solicitudes_materiales_items
  where solicitud_id = pedido and cantidad_cajas = 0;
  select id into caja_id from public.solicitudes_materiales_items
  where solicitud_id = pedido and cantidad_cajas = 1;
  perform public.entregar_solicitud_material(pedido, jsonb_build_array(
    jsonb_build_object('item_id', suelta_id, 'cantidad', 4),
    jsonb_build_object('item_id', caja_id, 'cantidad', 12)
  ));
  select * into p from public.inventario_items where id = item;
  if p.stock_actual <> 256 or p.cajas_cerradas <> 21 or p.unidades_caja_abierta <> 4 then
    raise exception 'La entrega mixta no descontó 4 lápices y una caja cerrada';
  end if;
  if (select estado from public.solicitudes_materiales where id = pedido) <> 'entregada' then
    raise exception 'La solicitud no terminó entregada';
  end if;
end;
$prueba_entrega$;

rollback;
