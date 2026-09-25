begin;

-- Toda tabla de datos protegida por RLS también requiere sesión lista.
create policy sesion_lista on public.inventario_conteos_empaque
  as restrictive for all to authenticated
  using (public.session_ready())
  with check (public.session_ready());

commit;
