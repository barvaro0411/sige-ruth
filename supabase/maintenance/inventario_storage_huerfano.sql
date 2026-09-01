-- Inventario de inconsistencias entre metadata y Storage.
-- Solo lee nombres, fechas y tamaño declarado; no descarga objetos ni elimina.
begin transaction read only;

select
  'objeto_sin_metadata' as tipo,
  o.bucket_id,
  o.name as ruta,
  o.metadata ->> 'size' as tamano_bytes,
  o.created_at
from storage.objects o
where (
  o.bucket_id = 'documentos_estudiantes'
  and not exists (
    select 1 from public.estudiantes_documentos d where d.ruta_archivo = o.name
  )
) or (
  o.bucket_id = 'adjuntos_solicitudes'
  and not exists (
    select 1 from public.adjuntos_solicitudes a where a.ruta_archivo = o.name
  )
)
order by o.bucket_id, o.created_at;

select
  'metadata_sin_objeto' as tipo,
  'documentos_estudiantes' as bucket_id,
  d.ruta_archivo as ruta,
  d.created_at
from public.estudiantes_documentos d
where not exists (
  select 1 from storage.objects o
  where o.bucket_id = 'documentos_estudiantes' and o.name = d.ruta_archivo
)
union all
select
  'metadata_sin_objeto',
  'adjuntos_solicitudes',
  a.ruta_archivo,
  a.created_at
from public.adjuntos_solicitudes a
where not exists (
  select 1 from storage.objects o
  where o.bucket_id = 'adjuntos_solicitudes' and o.name = a.ruta_archivo
)
order by bucket_id, created_at;

rollback;
