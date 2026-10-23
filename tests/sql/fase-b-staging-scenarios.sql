-- Escenarios Fase B staging (tras fase-a-scenarios en BD aislada).
-- Cubre: affectsStock=false rechazado; Reparto furgoneta ≠ camión; opening DEMO ficticio.

\set ON_ERROR_STOP on

-- Cuarto usuario: Reparto furgoneta
insert into auth.users(id,email) values
 ('44444444-4444-4444-8444-444444444444','reparto-fur@test.local')
on conflict do nothing;

insert into public.tanques_members(user_id,nombre,role,vehicle,active) values
 ('44444444-4444-4444-8444-444444444444','Reparto Furgoneta Test','reparto','furgoneta',true)
on conflict (user_id) do update set role=excluded.role, vehicle=excluded.vehicle, active=excluded.active;

-- --- affectsStock=false NO sincroniza ni descuenta ---
set role authenticated;
select set_config('app.uid','33333333-3333-4333-8333-333333333333', false);
do $$
begin
  begin
    perform public.tanques_sync_batch(jsonb_build_array(jsonb_build_object(
      'key','movement:barallete-pending','kind','movement','vehicle','camion','base',0,'deleted',false,
      'payload', jsonb_build_object(
        'id','barallete-pending','type','DESCARGA','vehicle','camion','tank',1,
        'litres',240.61,'loss',0,'time','2026-10-21T14:00:00Z',
        'affectsStock',false,'client','BARALLETE BAR'
      )
    )));
    raise exception 'ASSERT FAIL: affectsStock=false debió rechazarse';
  exception when others then
    if SQLERRM like 'ASSERT FAIL:%' then raise; end if;
    if SQLERRM not like '%affectsStock=false%' then
      raise exception 'ASSERT FAIL: esperado rechazo affectsStock, got %', SQLERRM;
    end if;
    raise notice 'OK affectsStock=false rechazado: %', SQLERRM;
  end;
end $$;

-- --- Reparto furgoneta no escribe DESCARGA de camión ---
select set_config('app.uid','44444444-4444-4444-8444-444444444444', false);
do $$
begin
  begin
    perform public.tanques_sync_batch(jsonb_build_array(jsonb_build_object(
      'key','movement:cross-vehicle','kind','movement','vehicle','camion','base',0,'deleted',false,
      'payload', jsonb_build_object(
        'id','cross-vehicle','type','DESCARGA','vehicle','camion','tank',1,
        'litres',1,'loss',0,'time','2026-10-21T14:05:00Z'
      )
    )));
    raise exception 'ASSERT FAIL: furgoneta no debió escribir camión';
  exception when others then
    if SQLERRM like 'ASSERT FAIL:%' then raise; end if;
    raise notice 'OK furgoneta≠camión denegado: %', SQLERRM;
  end;
end $$;

-- --- Reparto furgoneta: descarga válida en su vehículo (ajuste base T1 furgoneta=990 tras adj-1) ---
-- Tras fase-a-scenarios, último ajuste: furgoneta [990]. Descarga 10 L OK.
select * from public.tanques_sync_batch(jsonb_build_array(jsonb_build_object(
  'key','movement:fur-ok','kind','movement','vehicle','furgoneta','base',0,'deleted',false,
  'payload', jsonb_build_object(
    'id','fur-ok','type','DESCARGA','vehicle','furgoneta','tank',1,
    'litres',10,'loss',0,'time','2026-10-21T14:10:00Z'
  )
)));

-- --- Gerencia: opening DEMO ficticio (valores canónicos staging) vía adjustment next ---
-- (opening:global ya existe; usamos adjustment DEMO para fijar 10000/[500,400,300]/[800])
select set_config('app.uid','11111111-1111-4111-8111-111111111111', false);
select * from public.tanques_sync_batch(jsonb_build_array(jsonb_build_object(
  'key','adjustment:demo-stocks','kind','adjustment','vehicle',null,'base',0,'deleted',false,
  'payload', jsonb_build_object(
    'id','demo-stocks','at','2026-10-21T15:00:00Z','reason','APERTURA DEMO STAGING — DATOS FICTICIOS',
    'demo',true,
    'next', jsonb_build_object(
      'cisterna',10000,
      'camion',jsonb_build_array(500,400,300),
      'furgoneta',jsonb_build_array(800),
      'demo',true,
      'label','DEMO iuqmzpahyjganhppcsur'
    )
  )
)));

reset role;
select public.test_assert(
  (select count(*) from public.tanques_records where key='movement:barallete-pending')=0,
  'affectsStock=false no persistido');
select public.test_assert(
  (select count(*) from public.tanques_records where key='movement:cross-vehicle')=0,
  'cross-vehicle no persistido');
select public.test_assert(
  (select count(*) from public.tanques_records where key='movement:fur-ok' and not deleted)=1,
  'descarga furgoneta OK');
select public.test_assert(
  (select (payload->'next'->>'cisterna')::numeric from public.tanques_records where key='adjustment:demo-stocks')=10000,
  'DEMO cisterna 10000');
select public.test_assert(
  (select payload->'next'->'camion' from public.tanques_records where key='adjustment:demo-stocks')
    = jsonb_build_array(500,400,300),
  'DEMO camión [500,400,300]');
select public.test_assert(
  (select payload->'next'->'furgoneta' from public.tanques_records where key='adjustment:demo-stocks')
    = jsonb_build_array(800),
  'DEMO furgoneta [800]');

\echo 'FASE_B_STAGING_SCENARIOS_PASS'
