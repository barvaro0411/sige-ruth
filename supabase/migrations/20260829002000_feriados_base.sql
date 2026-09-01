-- Parte minima del esquema previo que las migraciones incrementales esperan.
begin;

create table if not exists public.feriados (
  fecha date primary key,
  nombre text not null,
  irrenunciable boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.feriados enable row level security;
drop policy if exists "feriados_select" on public.feriados;
create policy "feriados_select" on public.feriados
  for select to authenticated using (public.is_active_user());

grant select, insert, update, delete on public.feriados to authenticated;
revoke all on public.feriados from anon;

commit;
