begin;

-- Bodega necesita leer las solicitudes y sus líneas para preparar entregas.
-- La RPC de entrega ya autoriza este rol, pero las políticas de lectura
-- anteriores solo contemplaban al solicitante y al equipo directivo.
drop policy if exists materiales_select_propio_o_gestion on public.solicitudes_materiales;
create policy materiales_select_propio_o_gestion on public.solicitudes_materiales
  as permissive for select to authenticated
  using (
    solicitante_id = (select auth.uid())
    or (public.can_access_sede(sede_id) and public.gestiona_bodega())
  );

drop policy if exists materiales_items_select on public.solicitudes_materiales_items;
create policy materiales_items_select on public.solicitudes_materiales_items
  as permissive for select to authenticated
  using (exists (
    select 1 from public.solicitudes_materiales s
    where s.id = solicitud_id
      and (
        s.solicitante_id = (select auth.uid())
        or (public.can_access_sede(s.sede_id) and public.gestiona_bodega())
      )
  ));

commit;
