-- Las politicas evaluan auth.uid() una vez, no una vez por fila (advisor 0003).
-- Cambio de rendimiento, no de autorizacion: la envoltura no altera el valor
-- comparado, y con sesion anonima auth.uid() sigue siendo null en ambas formas.
-- Cada politica se recrea desde su definicion vigente en la base; lo unico que
-- cambia en el texto es la envoltura.

drop policy if exists adjuntos_delete_propio on public.adjuntos_solicitudes;
create policy adjuntos_delete_propio on public.adjuntos_solicitudes
  as permissive for delete to authenticated
  using ((subido_por = (select auth.uid())));

drop policy if exists adjuntos_insert_propio on public.adjuntos_solicitudes;
create policy adjuntos_insert_propio on public.adjuntos_solicitudes
  as permissive for insert to authenticated
  with check (((subido_por = (select auth.uid())) AND can_access_sede(sede_id)));

drop policy if exists adjuntos_select on public.adjuntos_solicitudes;
create policy adjuntos_select on public.adjuntos_solicitudes
  as permissive for select to authenticated
  using (((subido_por = (select auth.uid())) OR (can_access_sede(sede_id) AND (has_role(ARRAY['director'::text, 'sostenedor'::text, 'secretaria'::text]) OR ((origen = 'mantencion'::text) AND gestiona_mantencion())))));

drop policy if exists cupos_select_propio_o_jefatura on public.cupos_permiso;
create policy cupos_select_propio_o_jefatura on public.cupos_permiso
  as permissive for select to authenticated
  using (((perfil_id = (select auth.uid())) OR has_role(ARRAY['director'::text, 'sostenedor'::text])));

drop policy if exists documentos_delete_academico on public.estudiantes_documentos;
create policy documentos_delete_academico on public.estudiantes_documentos
  as permissive for delete to authenticated
  using ((can_access_academic_sede(sede_id) AND ((subido_por = (select auth.uid())) OR has_role(ARRAY['director'::text, 'secretaria'::text]))));

drop policy if exists documentos_insert_academico on public.estudiantes_documentos;
create policy documentos_insert_academico on public.estudiantes_documentos
  as permissive for insert to authenticated
  with check ((can_access_academic_sede(sede_id) AND (subido_por = (select auth.uid())) AND has_role(ARRAY['director'::text, 'secretaria'::text, 'fonoaudiologo'::text])));

drop policy if exists historial_materiales_select on public.historial_solicitudes_materiales;
create policy historial_materiales_select on public.historial_solicitudes_materiales
  as permissive for select to authenticated
  using ((EXISTS ( SELECT 1
   FROM solicitudes_materiales s
  WHERE ((s.id = historial_solicitudes_materiales.solicitud_id) AND ((s.solicitante_id = (select auth.uid())) OR (can_access_sede(s.sede_id) AND has_role(ARRAY['director'::text, 'sostenedor'::text, 'secretaria'::text])))))));

drop policy if exists historial_permiso_select on public.historial_solicitudes_permiso;
create policy historial_permiso_select on public.historial_solicitudes_permiso
  as permissive for select to authenticated
  using ((EXISTS ( SELECT 1
   FROM solicitudes_permiso s
  WHERE ((s.id = historial_solicitudes_permiso.solicitud_id) AND ((s.solicitante_id = (select auth.uid())) OR (can_access_sede(s.sede_id) AND has_role(ARRAY['director'::text, 'sostenedor'::text])))))));

drop policy if exists mantenciones_insert_personal on public.mantenciones;
create policy mantenciones_insert_personal on public.mantenciones
  as permissive for insert to authenticated
  with check ((can_access_sede(sede_id) AND (reportado_por = (select auth.uid()))));

drop policy if exists mantenciones_update on public.mantenciones;
create policy mantenciones_update on public.mantenciones
  as permissive for update to authenticated
  using ((can_access_sede(sede_id) AND ((reportado_por = (select auth.uid())) OR gestiona_mantencion())))
  with check ((can_access_sede(sede_id) AND ((reportado_por = (select auth.uid())) OR gestiona_mantencion())));

drop policy if exists notificaciones_select_propias on public.notificaciones;
create policy notificaciones_select_propias on public.notificaciones
  as permissive for select to authenticated
  using ((destinatario_id = (select auth.uid())));

drop policy if exists notificaciones_update_propias on public.notificaciones;
create policy notificaciones_update_propias on public.notificaciones
  as permissive for update to authenticated
  using ((destinatario_id = (select auth.uid())))
  with check ((destinatario_id = (select auth.uid())));

-- Ojo: esta es la de la regresion que dejo al director viendo un solo perfil.
-- Comprueba el rol de QUIEN MIRA (has_role) y por separado deja ver a la
-- direccion (rol = any) para que aparezca aunque no tenga filas en
-- perfiles_sedes.
drop policy if exists perfiles_select_colegas on public.perfiles;
create policy perfiles_select_colegas on public.perfiles
  as permissive for select to authenticated
  using (((id = (select auth.uid())) OR (is_active_user() AND (has_role(ARRAY['director'::text, 'sostenedor'::text]) OR (rol = ANY (ARRAY['director'::text, 'sostenedor'::text])) OR comparte_sede_conmigo(id)))));

drop policy if exists perfiles_sedes_select on public.perfiles_sedes;
create policy perfiles_sedes_select on public.perfiles_sedes
  as permissive for select to authenticated
  using (((perfil_id = (select auth.uid())) OR (current_profile_role() = 'director'::text)));

drop policy if exists sesiones_fono_insert_clinical on public.sesiones_fono;
create policy sesiones_fono_insert_clinical on public.sesiones_fono
  as permissive for insert to authenticated
  with check ((can_access_sede(sede_id) AND has_role(ARRAY['director'::text, 'fonoaudiologo'::text]) AND (fonoaudiologo_id = (select auth.uid()))));

drop policy if exists sesiones_fono_update_clinical on public.sesiones_fono;
create policy sesiones_fono_update_clinical on public.sesiones_fono
  as permissive for update to authenticated
  using ((can_access_sede(sede_id) AND has_role(ARRAY['director'::text, 'fonoaudiologo'::text])))
  with check ((can_access_sede(sede_id) AND has_role(ARRAY['director'::text, 'fonoaudiologo'::text]) AND (fonoaudiologo_id = (select auth.uid()))));

drop policy if exists materiales_delete_borrador on public.solicitudes_materiales;
create policy materiales_delete_borrador on public.solicitudes_materiales
  as permissive for delete to authenticated
  using (((solicitante_id = (select auth.uid())) AND (estado = 'borrador'::text)));

drop policy if exists materiales_insert_propio on public.solicitudes_materiales;
create policy materiales_insert_propio on public.solicitudes_materiales
  as permissive for insert to authenticated
  with check (((solicitante_id = (select auth.uid())) AND can_access_sede(sede_id) AND (estado = 'borrador'::text)));

drop policy if exists materiales_select_propio_o_gestion on public.solicitudes_materiales;
create policy materiales_select_propio_o_gestion on public.solicitudes_materiales
  as permissive for select to authenticated
  using (((solicitante_id = (select auth.uid())) OR (can_access_sede(sede_id) AND has_role(ARRAY['director'::text, 'sostenedor'::text, 'secretaria'::text]))));

drop policy if exists materiales_update_propio_o_gestion on public.solicitudes_materiales;
create policy materiales_update_propio_o_gestion on public.solicitudes_materiales
  as permissive for update to authenticated
  using (((solicitante_id = (select auth.uid())) OR (can_access_sede(sede_id) AND has_role(ARRAY['director'::text, 'sostenedor'::text, 'secretaria'::text]))))
  with check (((solicitante_id = (select auth.uid())) OR (can_access_sede(sede_id) AND has_role(ARRAY['director'::text, 'sostenedor'::text, 'secretaria'::text]))));

drop policy if exists materiales_items_select on public.solicitudes_materiales_items;
create policy materiales_items_select on public.solicitudes_materiales_items
  as permissive for select to authenticated
  using ((EXISTS ( SELECT 1
   FROM solicitudes_materiales s
  WHERE ((s.id = solicitudes_materiales_items.solicitud_id) AND ((s.solicitante_id = (select auth.uid())) OR (can_access_sede(s.sede_id) AND has_role(ARRAY['director'::text, 'sostenedor'::text, 'secretaria'::text])))))));

drop policy if exists materiales_items_write_propio on public.solicitudes_materiales_items;
create policy materiales_items_write_propio on public.solicitudes_materiales_items
  as permissive for all to authenticated
  using ((EXISTS ( SELECT 1
   FROM solicitudes_materiales s
  WHERE ((s.id = solicitudes_materiales_items.solicitud_id) AND ((s.solicitante_id = (select auth.uid())) OR (can_access_sede(s.sede_id) AND has_role(ARRAY['director'::text, 'sostenedor'::text, 'secretaria'::text])))))))
  with check ((EXISTS ( SELECT 1
   FROM solicitudes_materiales s
  WHERE ((s.id = solicitudes_materiales_items.solicitud_id) AND ((s.solicitante_id = (select auth.uid())) OR (can_access_sede(s.sede_id) AND has_role(ARRAY['director'::text, 'sostenedor'::text, 'secretaria'::text])))))));

drop policy if exists permisos_select_propio_o_jefatura on public.solicitudes_permiso;
create policy permisos_select_propio_o_jefatura on public.solicitudes_permiso
  as permissive for select to authenticated
  using (((solicitante_id = (select auth.uid())) OR (can_access_sede(sede_id) AND has_role(ARRAY['director'::text, 'sostenedor'::text]))));

drop policy if exists permisos_update_propio_o_jefatura on public.solicitudes_permiso;
create policy permisos_update_propio_o_jefatura on public.solicitudes_permiso
  as permissive for update to authenticated
  using (((solicitante_id = (select auth.uid())) OR (can_access_sede(sede_id) AND has_role(ARRAY['director'::text, 'sostenedor'::text]))))
  with check (((solicitante_id = (select auth.uid())) OR (can_access_sede(sede_id) AND has_role(ARRAY['director'::text, 'sostenedor'::text]))));

-- Red de seguridad: si alguna quedo fuera o se transcribio mal, esto revienta
-- la migration en vez de dejar el aviso puesto para dentro de seis meses.
do $verificar$
declare sueltas text;
begin
  select string_agg(tablename || '.' || policyname, ', ')
  into sueltas
  from pg_policies
  where schemaname = 'public'
    and (qual       ~ '(?<![Ss][Ee][Ll][Ee][Cc][Tt] )auth\.uid\(\)'
      or with_check ~ '(?<![Ss][Ee][Ll][Ee][Cc][Tt] )auth\.uid\(\)');

  if sueltas is not null then
    raise exception 'Quedaron politicas evaluando auth.uid() por fila: %', sueltas;
  end if;
end
$verificar$;;
