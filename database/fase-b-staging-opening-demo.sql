-- FASE B — Opening DEMO (datos 100 % ficticios) para staging iuqmzpahyjganhppcsur.
-- Ejecutar SOLO tras fase-b-staging-seguridad.sql y con sesión Gerencia vía RPC
-- (o service role en SQL Editor staging — NUNCA en producción).
--
-- Existencias DEMO: cisterna 10000 · camión [500,400,300] · furgoneta [800]
--
-- Preferido (como usuario Gerencia autenticado):
-- select * from public.tanques_sync_batch(jsonb_build_array(jsonb_build_object(
--   'key','opening:global','kind','opening','vehicle',null,'base',0,'deleted',false,
--   'payload', jsonb_build_object(
--     'cisterna',10000,
--     'camion',jsonb_build_array(500,400,300),
--     'furgoneta',jsonb_build_array(800),
--     'demo',true,
--     'label','APERTURA DEMO STAGING — DATOS FICTICIOS — iuqmzpahyjganhppcsur'
--   )
-- )));

select 'FASE_B_OPENING_DEMO_TEMPLATE — cisterna 10000 · [500,400,300] · [800]' as estado;
