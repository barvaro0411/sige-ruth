-- Ejecutar una vez en Supabase > SQL Editor.
-- Protege la cuenta actual, evita eliminar al último director y audita perfiles.

create or replace function public.protect_admin_profiles()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.id = auth.uid() and new.activo = false then
    raise exception 'No puedes desactivar tu propia cuenta';
  end if;

  if old.rol = 'director'
     and old.activo = true
     and (new.rol <> 'director' or new.activo = false)
     and not exists (
       select 1 from public.perfiles
       where id <> old.id and rol = 'director' and activo = true
     ) then
    raise exception 'Debe existir al menos un director activo';
  end if;

  return new;
end;
$$;

drop trigger if exists perfiles_protect_admin on public.perfiles;
create trigger perfiles_protect_admin
  before update on public.perfiles
  for each row execute function public.protect_admin_profiles();

drop trigger if exists perfiles_audit on public.perfiles;
create trigger perfiles_audit
  after insert or update or delete on public.perfiles
  for each row execute function public.audit_row_change();
