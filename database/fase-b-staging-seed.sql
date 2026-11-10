-- FASE B — Seed DEMO para proyecto Supabase STAGING (NO producción).
-- Ejecutar SOLO tras tanques-sync.sql + tanques-validation.sql + fase-a-seguridad-inventario.sql
-- en un proyecto NUEVO. NO ejecutar en oevetnszmfxeukcncwji.
--
-- Antes: crear en Auth (Dashboard) estos usuarios y anotar sus UUID:
--   demo.gerencia@example.test
--   demo.almacen@example.test
--   demo.reparto.camion@example.test
--   demo.reparto.furgoneta@example.test
-- Sustituir los UUID siguientes y luego ejecutar este script.

\set ON_ERROR_STOP on

-- Guardrail: abortar si este script se lanza por error en un host conocido de prod
-- (comprobar manualmente el project ref en el SQL editor antes de ejecutar).

-- === SUSTITUIR UUID ===
-- Gerencia
-- insert into public.tanques_members(user_id,nombre,role,vehicle,active) values
--  ('xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx','DEMO Gerencia','gerencia',null,true);
-- Almacén
-- insert into public.tanques_members(user_id,nombre,role,vehicle,active) values
--  ('xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx','DEMO Almacén','almacen',null,true);
-- Reparto camión
-- insert into public.tanques_members(user_id,nombre,role,vehicle,active) values
--  ('xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx','DEMO Reparto Camión','reparto','camion',true);
-- Reparto furgoneta
-- insert into public.tanques_members(user_id,nombre,role,vehicle,active) values
--  ('xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx','DEMO Reparto Furgoneta','reparto','furgoneta',true);

-- Opening DEMO (claramente ficticio). Preferible crearlo vía app como Gerencia
-- (RPC tanques_sync_batch). Valores de referencia:
-- cisterna 10000 · camión [500,400,300] · furgoneta [800]
--
-- Ejemplo (ejecutar como service role / tras login Gerencia vía RPC, no como atajo en prod):
-- select public.tanques_sync_batch(jsonb_build_array(jsonb_build_object(
--   'key','opening:global','kind','opening','vehicle',null,'base',0,'deleted',false,
--   'payload', jsonb_build_object(
--     'cisterna',10000,
--     'camion',jsonb_build_array(500,400,300),
--     'furgoneta',jsonb_build_array(800),
--     'demo',true,
--     'label','APERTURA DEMO STAGING — DATOS FICTICIOS'
--   )
-- )));

select 'FASE_B_SEED_TEMPLATE_LISTO — sustituye UUID y descomenta inserts' as estado;
