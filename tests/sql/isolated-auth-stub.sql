-- Stub mínimo tipo Supabase Auth para pruebas locales aisladas (NO es Supabase real).
create schema if not exists auth;
create table if not exists auth.users (
  id uuid primary key,
  email text
);

-- uid efectivo controlado por GUC de sesión (simula JWT sub).
create or replace function auth.uid() returns uuid
language sql stable set search_path='' as $$
  select nullif(current_setting('app.uid', true), '')::uuid;
$$;

do $$ begin
  create role authenticated nologin;
exception when duplicate_object then null;
end $$;
do $$ begin
  create role anon nologin;
exception when duplicate_object then null;
end $$;

grant usage on schema public to authenticated, anon;
grant usage on schema auth to authenticated;

-- Tabla legada referenciada por el seed de gerencia en tanques-sync.sql
create table if not exists public.usuarios_app (
  id uuid primary key references auth.users(id),
  nombre text not null default '',
  rol text not null,
  activo boolean not null default false
);
