-- Datos completamente sintéticos para desarrollo local y pruebas RLS.
-- Supabase no aplica este archivo con `db push`; nunca corresponde a producción.
begin;

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('11111111-1111-4111-8111-111111111111', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'director@example.invalid',
   crypt('Local-Only-Director-2026!', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{"nombre":"Directora Local"}', now(), now()),
  ('22222222-2222-4222-8222-222222222222', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'docente@example.invalid',
   crypt('Local-Only-Docente-2026!', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{"nombre":"Docente Local"}', now(), now()),
  ('33333333-3333-4333-8333-333333333333', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'bodega@example.invalid',
   crypt('Local-Only-Bodega-2026!', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{"nombre":"Bodega Local"}', now(), now())
on conflict (id) do nothing;

-- GoTrue actual espera cadenas vacías, no NULL, en estos tokens al iniciar
-- sesión. Los usuarios sintéticos anteriores a ese cambio se normalizan aquí.
update auth.users
set confirmation_token = coalesce(confirmation_token, ''),
    recovery_token = coalesce(recovery_token, ''),
    email_change_token_new = coalesce(email_change_token_new, ''),
    email_change_token_current = coalesce(email_change_token_current, ''),
    email_change = coalesce(email_change, ''),
    phone_change = coalesce(phone_change, ''),
    reauthentication_token = coalesce(reauthentication_token, ''),
    phone_change_token = coalesce(phone_change_token, '')
where id in (
  '11111111-1111-4111-8111-111111111111',
  '22222222-2222-4222-8222-222222222222',
  '33333333-3333-4333-8333-333333333333'
);

update public.perfiles
set rol = 'director', activo = true, sede_id = null
where id = '11111111-1111-4111-8111-111111111111';
update public.perfiles
set rol = 'docente', activo = true, sede_id = 'gambino'
where id = '22222222-2222-4222-8222-222222222222';
update public.perfiles
set rol = 'bodega', activo = true, sede_id = 'gambino'
where id = '33333333-3333-4333-8333-333333333333';

insert into public.perfiles_sedes (perfil_id, sede_id) values
  ('22222222-2222-4222-8222-222222222222', 'gambino'),
  ('33333333-3333-4333-8333-333333333333', 'gambino')
on conflict do nothing;

commit;
