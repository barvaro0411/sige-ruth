begin;

-- Una salida rotulada como «caja cerrada» no puede apoyarse solo en el stock
-- total. Si aún no se contó la presentación física, bodega debe confirmarla.
-- El nombre del trigger lo sitúa antes de inventario_movimientos_aplicar;
-- toma el bloqueo de la fila para que el conteo no cambie entre ambos pasos.
create function public.exigir_conteo_caja_cerrada()
returns trigger language plpgsql security definer set search_path = public as $$
declare cerradas integer;
begin
  if new.cantidad < 0 and new.cantidad_cajas > 0 then
    select i.cajas_cerradas into cerradas
    from public.inventario_items i where i.id = new.item_id for update;
    if cerradas is null then
      raise exception 'Confirma primero cuántas cajas cerradas quedan en Bodega';
    end if;
    if cerradas < new.cantidad_cajas then
      raise exception 'No hay suficientes cajas cerradas; revisa el conteo de presentación';
    end if;
  end if;
  return new;
end;
$$;
create trigger ab_exigir_conteo_caja_cerrada
before insert on public.inventario_movimientos
for each row execute function public.exigir_conteo_caja_cerrada();
revoke all on function public.exigir_conteo_caja_cerrada() from public, anon, authenticated;

commit;
