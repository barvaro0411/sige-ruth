-- =============================================================================
-- Perfiles visibles entre colegas
--
-- Hasta aca cada persona veia solo su propio perfil, y la direccion los veia
-- todos. Eso alcanzaba mientras nadie tuviera que nombrar a otra persona.
--
-- Con prestamos y mantenciones deja de alcanzar: para prestar un notebook hay
-- que elegir a quien, y para asignar una reparacion hay que elegir a quien. Con
-- la politica anterior esos selectores salian vacios para todo el mundo salvo
-- la direccion.
--
-- El alcance nuevo es el minimo que resuelve eso: mi propio perfil, los roles
-- transversales (director y sostenedora, que no tienen sede asignada) y quienes
-- comparten sede conmigo. Nadie ve al personal de una sede en la que no trabaja.
--
-- Reconstruida desde el estado real de produccion (version 20260829183559).
-- =============================================================================

begin;

drop policy if exists "perfiles_select_own_or_director" on public.perfiles;
drop policy if exists "perfiles_select_colegas" on public.perfiles;
create policy "perfiles_select_colegas" on public.perfiles
  for select to authenticated
  using (
    id = auth.uid()
    or (public.is_active_user() and (
          rol in ('director','sostenedor')
          or exists (
            select 1
            from public.perfiles_sedes mia
            join public.perfiles_sedes suya on suya.sede_id = mia.sede_id
            where mia.perfil_id = auth.uid()
              and suya.perfil_id = perfiles.id
          )
       ))
  );

commit;
