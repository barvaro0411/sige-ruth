-- =============================================================================
-- Corrección — Los roles transversales tienen que ver a todo el personal
--
-- La política `perfiles_select_colegas` quedó con una condición que mira el
-- lado equivocado. Dice:
--
--     rol in ('director','sostenedor')
--
-- y eso es una propiedad de la fila mirada, no de quien mira: hace que todos
-- vean a la dirección, que es correcto, pero en el camino se perdió la regla
-- que traía la política anterior — que la dirección ve a todos.
--
-- La consecuencia no es teórica. Director y sostenedora son transversales y
-- por definición no tienen filas en `perfiles_sedes`, así que
-- `comparte_sede_conmigo()` les devuelve falso contra cualquiera. Verificado
-- contra la base real: el director veía exactamente un perfil, el suyo. Con
-- eso, el módulo de Usuarios le mostraba la lista vacía, los selectores de
-- «a quién se le presta» y «quién se hace cargo» salían sin nadie, y
-- `prestamos_vista` —que une con `perfiles`— no le devolvía ni un préstamo.
--
-- La corrección agrega la mitad que faltaba: quien mira, si es transversal,
-- ve a todo el personal activo. Las otras dos ramas se mantienen tal cual.
-- =============================================================================

begin;

drop policy if exists "perfiles_select_colegas" on public.perfiles;
create policy "perfiles_select_colegas" on public.perfiles
  for select to authenticated
  using (
    id = auth.uid()
    or (public.is_active_user() and (
          -- Quien mira es transversal: ve a todo el personal.
          public.has_role(array['director','sostenedor'])
          -- A quien mira es transversal: dirección es visible para todos.
          or rol in ('director','sostenedor')
          -- O comparten sede.
          or public.comparte_sede_conmigo(id)
       ))
  );

commit;
