-- =============================================================================
-- Helper: comparte_sede_conmigo()
--
-- La politica anterior llevaba el cruce de sedes escrito adentro, como un
-- `exists` sobre `perfiles_sedes`. Una subconsulta dentro de una politica RLS
-- se evalua con los permisos de quien consulta, asi que arrastraba tambien la
-- RLS de `perfiles_sedes` — donde cada persona solo ve sus propias filas. El
-- cruce con las filas de la otra persona volvia vacio y el efecto era el
-- contrario al buscado: nadie veia a nadie.
--
-- El helper es `security definer` con `search_path` fijo, igual que
-- `can_access_sede()` y `has_role()`: resuelve el cruce por dentro y devuelve
-- solo un booleano. Es el mismo patron que ya usa el resto de la autorizacion.
--
-- Reconstruida desde el estado real de produccion (version 20260829183642).
-- =============================================================================

begin;

create or replace function public.comparte_sede_conmigo(otro_perfil uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $fn$
  select coalesce(exists (
    select 1
    from public.perfiles_sedes mia
    join public.perfiles_sedes suya on suya.sede_id = mia.sede_id
    where mia.perfil_id = auth.uid()
      and suya.perfil_id = otro_perfil
  ), false);
$fn$;

drop policy if exists "perfiles_select_colegas" on public.perfiles;
create policy "perfiles_select_colegas" on public.perfiles
  for select to authenticated
  using (
    id = auth.uid()
    or (public.is_active_user() and (
          rol in ('director','sostenedor')
          or public.comparte_sede_conmigo(id)
       ))
  );

revoke all on function public.comparte_sede_conmigo(uuid) from anon;

commit;
