-- El calendario de ausencias se lee, no se escribe.
-- `calendario_ausencias_vista` es a proposito la unica vista sin
-- `security_invoker`: con la RLS de quien consulta, cada persona veria solo sus
-- propias ausencias y el calendario no serviria para coordinar reemplazos.
--
-- Lo que no estaba previsto es que la vista tambien se pueda ESCRIBIR. Es una
-- vista simple sobre una tabla, asi que Postgres la considera actualizable; sin
-- `security_invoker` esas escrituras corren con los permisos de su dueño
-- (`postgres`, con `rolbypassrls`), de modo que la RLS de `solicitudes_permiso`
-- no se evalua. Y `authenticated` conservaba INSERT, UPDATE y DELETE: el
-- `revoke` original solo alcanzo a `anon`.
--
-- UPDATE e INSERT ya estaban contenidos por los triggers de la tabla
-- (`enforce_permiso_transicion` y `prepare_permission_request`). El DELETE no
-- tenia nada delante: `solicitudes_permiso` no tiene trigger BEFORE DELETE, y
-- `permisos_delete_director` queda fuera de juego al pasar por la vista.
-- Cualquier persona con sesion podia borrar un permiso aprobado de su sede,
-- contra la regla 4: no se borra historia.

revoke insert, update, delete on public.calendario_ausencias_vista
  from authenticated, anon, public;

grant select on public.calendario_ausencias_vista to authenticated;

comment on view public.calendario_ausencias_vista is
  'Ausencias aprobadas para planificar cobertura. No expone tipo ni motivo: un permiso puede ser una licencia medica. Solo lectura: sin security_invoker, una escritura por aqui rodearia la RLS de solicitudes_permiso.';;
