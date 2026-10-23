-- Escenarios RLS de lectura (API/SQL directo como authenticated).
-- Requiere: stub + sync + validation + fase-a/fase-b-seguridad + este RLS + datos de escenarios previos
-- o seed mínimo propio. Se invoca tras fase-b-staging-scenarios en el harness.

\set ON_ERROR_STOP on

-- Garantizar filas de contraste: visita camión (owner reparto-camión) ya existe (visit:v1).
-- Crear visita furgoneta ajena + customer + plan solo visibles según rol.

set role authenticated;
select set_config('app.uid','44444444-4444-4444-8444-444444444444', false);
-- provisional propio furgoneta
select * from public.tanques_sync_batch(jsonb_build_array(jsonb_build_object(
  'key','provisional:fur-p1','kind','provisional','vehicle','furgoneta','base',0,'deleted',false,
  'payload', jsonb_build_object('id','fur-p1','vehicle','furgoneta','amounts',jsonb_build_array(50),'at','2026-10-21T16:00:00Z')
)));

select set_config('app.uid','11111111-1111-4111-8111-111111111111', false);
select * from public.tanques_sync_batch(jsonb_build_array(
  jsonb_build_object(
    'key','customer:c-demo','kind','customer','vehicle',null,'base',0,'deleted',false,
    'payload', jsonb_build_object('id','c-demo','name','Cliente DEMO RLS')
  ),
  jsonb_build_object(
    'key','plan:2026-W42','kind','plan','vehicle',null,'base',0,'deleted',false,
    'payload', jsonb_build_object('week','2026-W42','entries',jsonb_build_array(
      jsonb_build_object('id','e1','vehicle','camion','customerName','Bar'),
      jsonb_build_object('id','e2','vehicle','furgoneta','customerName','Bar2')
    ))
  )
));
reset role;

-- --- API directa: Reparto CAMIÓN no lee visit de otro (no hay otra visit camión distinta);
--     no lee provisional de furgoneta; no lee customer ---
set role authenticated;
select set_config('app.uid','33333333-3333-4333-8333-333333333333', false);

select public.test_assert(
  (select count(*) from public.tanques_records where key='provisional:fur-p1')=0,
  'reparto-camión NO lee provisional furgoneta (SELECT API)');
select public.test_assert(
  (select count(*) from public.tanques_records where key='customer:c-demo')=0,
  'reparto-camión NO lee customer (SELECT API)');
select public.test_assert(
  (select count(*) from public.tanques_records where key='visit:v1')=1,
  'reparto-camión SÍ lee su visit:v1');
select public.test_assert(
  (select count(*) from public.tanques_records where kind='opening' and not deleted)>=1,
  'reparto-camión SÍ lee opening (saldo compartido)');
select public.test_assert(
  (select count(*) from public.tanques_records where key='movement:carga-1')=1,
  'reparto-camión SÍ lee CARGA ajena (saldo compartido)');
select public.test_assert(
  (select count(*) from public.tanques_records where key='plan:2026-W42')=1,
  'reparto-camión SÍ lee plan');

-- --- Reparto FURGONETA no lee visit:v1 (camión / otro owner) ---
select set_config('app.uid','44444444-4444-4444-8444-444444444444', false);
select public.test_assert(
  (select count(*) from public.tanques_records where key='visit:v1')=0,
  'reparto-furgoneta NO lee visit camión ajena (SELECT API)');
select public.test_assert(
  (select count(*) from public.tanques_records where key='provisional:fur-p1')=1,
  'reparto-furgoneta SÍ lee su provisional');
select public.test_assert(
  (select count(*) from public.tanques_records where key='movement:d1')=1,
  'reparto-furgoneta SÍ lee DESCARGA camión (saldo compartido)');

-- --- Almacén: lee opening/cargas; NO visit ni customer ni provisional ---
select set_config('app.uid','22222222-2222-4222-8222-222222222222', false);
select public.test_assert(
  (select count(*) from public.tanques_records where key='movement:carga-1')=1,
  'almacén SÍ lee CARGA');
select public.test_assert(
  (select count(*) from public.tanques_records where key='visit:v1')=0,
  'almacén NO lee visit (SELECT API)');
select public.test_assert(
  (select count(*) from public.tanques_records where key='customer:c-demo')=0,
  'almacén NO lee customer (SELECT API)');
select public.test_assert(
  (select count(*) from public.tanques_records where key='provisional:fur-p1')=0,
  'almacén NO lee provisional (SELECT API)');
select public.test_assert(
  (select count(*) from public.tanques_records where key='plan:2026-W42')=0,
  'almacén NO lee plan (SELECT API)');
select public.test_assert(
  (select count(*) from public.tanques_records where kind='opening' and not deleted)>=1,
  'almacén SÍ lee opening');

-- --- Gerencia: lee todo lo anterior ---
select set_config('app.uid','11111111-1111-4111-8111-111111111111', false);
select public.test_assert(
  (select count(*) from public.tanques_records where key in (
    'visit:v1','customer:c-demo','plan:2026-W42','provisional:fur-p1','movement:carga-1'
  ))=5,
  'gerencia lee visit+customer+plan+provisional+carga');

-- --- Sync no rota: Reparto puede empujar descarga tras leer saldos ---
select set_config('app.uid','33333333-3333-4333-8333-333333333333', false);
-- Tras adjustment demo-stocks T1=500; ya hubo movimientos posteriores en escenarios.
-- Usar ajuste fresco vía gerencia en este bloque:
reset role;
set role authenticated;
select set_config('app.uid','11111111-1111-4111-8111-111111111111', false);
select * from public.tanques_sync_batch(jsonb_build_array(jsonb_build_object(
  'key','adjustment:rls-sync-base','kind','adjustment','vehicle',null,'base',0,'deleted',false,
  'payload', jsonb_build_object(
    'id','rls-sync-base','at','2026-10-21T19:00:00Z','reason','Base sync RLS',
    'demo',true,
    'next', jsonb_build_object('cisterna',10000,'camion',jsonb_build_array(200,0,0),'furgoneta',jsonb_build_array(100))
  )
)));
select set_config('app.uid','33333333-3333-4333-8333-333333333333', false);
select * from public.tanques_sync_batch(jsonb_build_array(jsonb_build_object(
  'key','movement:rls-sync-ok','kind','movement','vehicle','camion','base',0,'deleted',false,
  'payload', jsonb_build_object(
    'id','rls-sync-ok','type','DESCARGA','vehicle','camion','tank',1,
    'litres',15,'loss',0,'time','2026-10-21T19:05:00Z'
  )
)));
select public.test_assert(
  (select count(*) from public.tanques_records where key='movement:rls-sync-ok')=1,
  'sync automática (RPC) OK tras RLS read');

-- anon sin SELECT privilegiado de función sync
reset role;
select public.test_assert(
  not has_function_privilege('anon', 'public.tanques_sync_batch(jsonb)', 'EXECUTE'),
  'anon sin EXECUTE sync_batch');

\echo 'FASE_B_RLS_READ_SCENARIOS_PASS'
