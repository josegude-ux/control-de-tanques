-- Escenarios: planificación por vehículo (SELECT API + sync).
-- Requiere harness tras fase-b-rls-read-scenarios (miembros + opening + planes).

\set ON_ERROR_STOP on

-- Reparto FURGONETA: ve su plan; no ve plan camión ni legado
set role authenticated;
select set_config('app.uid','44444444-4444-4444-8444-444444444444', false);
select public.test_assert(
  (select count(*) from public.tanques_records where key='plan:2026-10-19|furgoneta')=1,
  'reparto-furgoneta SÍ lee plan propio');
select public.test_assert(
  (select count(*) from public.tanques_records where key='plan:2026-10-19|camion')=0,
  'reparto-furgoneta NO lee plan camión (SELECT API)');
select public.test_assert(
  (select count(*) from public.tanques_records where key='plan:2026-W42')=0,
  'reparto-furgoneta NO lee plan legado agregado');
select public.test_assert(
  (select count(*) from public.tanques_records where key='movement:carga-1')=1,
  'reparto-furgoneta SÍ lee CARGA (existencias compartidas)');

-- Gerencia actualiza plan camión vía RPC; furgoneta no ve el cambio de camión
select set_config('app.uid','11111111-1111-4111-8111-111111111111', false);
select * from public.tanques_sync_batch(jsonb_build_array(jsonb_build_object(
  'key','plan:2026-10-19|camion','kind','plan','vehicle','camion','base',1,'deleted',false,
  'payload', jsonb_build_object(
    'week','2026-10-19','vehicle','camion','sent','{}'::jsonb,
    'entries', jsonb_build_array(
      jsonb_build_object('id','e1','vehicle','camion','customerName','Bar'),
      jsonb_build_object('id','e1b','vehicle','camion','customerName','BarExtra')
    )
  )
)));

select set_config('app.uid','44444444-4444-4444-8444-444444444444', false);
select public.test_assert(
  (select count(*) from public.tanques_records where key='plan:2026-10-19|camion')=0,
  'tras sync Gerencia, furgoneta sigue sin SELECT plan camión');
select public.test_assert(
  (select jsonb_array_length(payload->'entries') from public.tanques_records where key='plan:2026-10-19|furgoneta')=1,
  'plan furgoneta intacto tras sync plan camión');

-- Camión ve su plan actualizado (2 entradas)
select set_config('app.uid','33333333-3333-4333-8333-333333333333', false);
select public.test_assert(
  (select jsonb_array_length(payload->'entries') from public.tanques_records where key='plan:2026-10-19|camion')=2,
  'reparto-camión ve plan camión actualizado');
select public.test_assert(
  (select count(*) from public.tanques_records where key='plan:2026-10-19|furgoneta')=0,
  'reparto-camión NO ve plan furgoneta');

-- Sync automática: descarga camión tras leer saldos (movimientos compartidos intactos)
reset role;
set role authenticated;
select set_config('app.uid','11111111-1111-4111-8111-111111111111', false);
select * from public.tanques_sync_batch(jsonb_build_array(jsonb_build_object(
  'key','adjustment:plan-veh-base','kind','adjustment','vehicle',null,'base',0,'deleted',false,
  'payload', jsonb_build_object(
    'id','plan-veh-base','at','2026-10-21T19:30:00Z','reason','Base plan-by-vehicle',
    'demo',true,
    'next', jsonb_build_object('cisterna',10000,'camion',jsonb_build_array(100,0,0),'furgoneta',jsonb_build_array(50))
  )
)));
select set_config('app.uid','33333333-3333-4333-8333-333333333333', false);
select * from public.tanques_sync_batch(jsonb_build_array(jsonb_build_object(
  'key','movement:plan-veh-ok','kind','movement','vehicle','camion','base',0,'deleted',false,
  'payload', jsonb_build_object(
    'id','plan-veh-ok','type','DESCARGA','vehicle','camion','tank',1,
    'litres',10,'loss',0,'time','2026-10-21T19:35:00Z'
  )
)));
select public.test_assert(
  (select count(*) from public.tanques_records where key='movement:plan-veh-ok')=1,
  'sync DESCARGA OK con plan separado por vehículo');

-- Auditoría intacta: solo Gerencia lee tanques_audit
select set_config('app.uid','33333333-3333-4333-8333-333333333333', false);
select public.test_assert(
  (select count(*) from public.tanques_audit)=0,
  'reparto NO lee auditoría');
select set_config('app.uid','11111111-1111-4111-8111-111111111111', false);
select public.test_assert(
  (select count(*) from public.tanques_audit where record_key like 'plan:%')>=1,
  'gerencia SÍ lee auditoría de planes');

reset role;
\echo 'FASE_B_PLAN_BY_VEHICLE_SCENARIOS_PASS'
