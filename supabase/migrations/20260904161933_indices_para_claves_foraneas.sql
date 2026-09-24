-- Un indice por cada clave foranea (advisor 0001).
-- Postgres indexa la clave primaria sola; el lado que apunta queda sin indice.
-- Eso pesa al borrar la fila apuntada (recorre la tabla hija entera buscando
-- huerfanas) y en los joins que la aplicacion hace todo el rato.
-- Se hace ahora porque las tablas estan vacias o casi: los indices se crean al
-- instante y sin bloquear. Con historial encima seria una ventana de mantencion.

create index if not exists idx_adjuntos_solicitudes_sede_id on public.adjuntos_solicitudes (sede_id);
create index if not exists idx_adjuntos_solicitudes_subido_por on public.adjuntos_solicitudes (subido_por);
create index if not exists idx_estudiantes_documentos_sede_id on public.estudiantes_documentos (sede_id);
create index if not exists idx_estudiantes_documentos_subido_por on public.estudiantes_documentos (subido_por);

-- FK compuesta: el indice empieza por las mismas columnas y en el mismo orden.
create index if not exists idx_estudiantes_curso_id_sede_id on public.estudiantes (curso_id, sede_id);

create index if not exists idx_historial_solicitudes_materiales_actor_id on public.historial_solicitudes_materiales (actor_id);
create index if not exists idx_historial_solicitudes_permiso_actor_id on public.historial_solicitudes_permiso (actor_id);
create index if not exists idx_mantenciones_historial_actor_id on public.mantenciones_historial (actor_id);
create index if not exists idx_inventario_movimientos_actor_id on public.inventario_movimientos (actor_id);

create index if not exists idx_inventario_items_categoria_id on public.inventario_items (categoria_id);
create index if not exists idx_inventario_items_created_by on public.inventario_items (created_by);
create index if not exists idx_inventario_items_unidad on public.inventario_items (unidad);
create index if not exists idx_productos_frecuentes_item_id on public.productos_frecuentes (item_id);

create index if not exists idx_mantenciones_asignado_a on public.mantenciones (asignado_a);
create index if not exists idx_mantenciones_categoria_id on public.mantenciones (categoria_id);
create index if not exists idx_mantenciones_resuelta_por on public.mantenciones (resuelta_por);
create index if not exists idx_mantenciones_preventivas_categoria_id on public.mantenciones_preventivas (categoria_id);
create index if not exists idx_mantenciones_preventivas_responsable_id on public.mantenciones_preventivas (responsable_id);
create index if not exists idx_preventivas_ejecuciones_realizada_por on public.preventivas_ejecuciones (realizada_por);

create index if not exists idx_recursos_prestamos_entregado_por on public.recursos_prestamos (entregado_por);
create index if not exists idx_recursos_prestamos_recibido_por on public.recursos_prestamos (recibido_por);

-- perfiles_sedes.sede_id lo recorre can_access_sede(), que corre dentro de
-- casi todas las politicas del proyecto.
create index if not exists idx_perfiles_sedes_sede_id on public.perfiles_sedes (sede_id);

create index if not exists idx_sesiones_fono_fonoaudiologo_id on public.sesiones_fono (fonoaudiologo_id);

create index if not exists idx_solicitudes_materiales_curso_id_sede_id on public.solicitudes_materiales (curso_id, sede_id);
create index if not exists idx_solicitudes_materiales_entrega_confirmada_por on public.solicitudes_materiales (entrega_confirmada_por);
create index if not exists idx_solicitudes_materiales_revisada_por on public.solicitudes_materiales (revisada_por);;
