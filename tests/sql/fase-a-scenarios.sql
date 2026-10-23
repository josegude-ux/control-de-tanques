-- Escenarios Fase A como rol authenticated (base aislada).
-- Espera: stub + tanques-sync + tanques-validation + fase-a ya aplicados.

\set ON_ERROR_STOP on

create or replace function public.test_assert(cond boolean, msg text) returns void
language plpgsql as $$
begin
  if not cond then raise exception 'ASSERT FAIL: %', msg; end if;
end $$;

-- Usuarios de prueba
insert into auth.users(id,email) values
 ('11111111-1111-4111-8111-111111111111','gerencia@test.local'),
 ('22222222-2222-4222-8222-222222222222','almacen@test.local'),
 ('33333333-3333-4333-8333-333333333333','reparto@test.local')
on conflict do nothing;

insert into public.tanques_members(user_id,nombre,role,vehicle,active) values
 ('11111111-1111-4111-8111-111111111111','Gerencia Test','gerencia',null,true),
 ('22222222-2222-4222-8222-222222222222','Almacen Test','almacen',null,true),
 ('33333333-3333-4333-8333-333333333333','Reparto Test','reparto','camion',true)
on conflict (user_id) do update set role=excluded.role, vehicle=excluded.vehicle, active=excluded.active;

-- Permisos de EXECUTE: authenticated puede llamar helpers (mínimo privilegio)
select has_function_privilege('authenticated', 'tanques_private.round2(numeric)', 'EXECUTE') as round2_ok;
select has_function_privilege('authenticated', 'tanques_private.stock_problems()', 'EXECUTE') as stock_ok;
select has_function_privilege('anon', 'tanques_private.round2(numeric)', 'EXECUTE') as anon_round2_should_be_false;
select public.test_assert(has_function_privilege('authenticated', 'tanques_private.round2(numeric)', 'EXECUTE'), 'authenticated EXECUTE round2');
select public.test_assert(has_function_privilege('authenticated', 'tanques_private.stock_problems()', 'EXECUTE'), 'authenticated EXECUTE stock_problems');
select public.test_assert(not has_function_privilege('anon', 'tanques_private.round2(numeric)', 'EXECUTE'), 'anon NO EXECUTE round2');
select public.test_assert(not has_function_privilege('anon', 'tanques_private.stock_problems()', 'EXECUTE'), 'anon NO EXECUTE stock_problems');

-- --- Gerencia: opening ---
set role authenticated;
select set_config('app.uid','11111111-1111-4111-8111-111111111111', false);

select * from public.tanques_sync_batch(jsonb_build_array(jsonb_build_object(
  'key','opening:global','kind','opening','vehicle',null,'base',0,'deleted',false,
  'payload', jsonb_build_object('cisterna',23000,'camion',jsonb_build_array(977,413.57,0),'furgoneta',jsonb_build_array(990))
)));

-- --- Almacén: carga válida (T1=977 → cabe 23 L sin merma; usamos 20 L) ---
select set_config('app.uid','22222222-2222-4222-8222-222222222222', false);
select * from public.tanques_sync_batch(jsonb_build_array(jsonb_build_object(
  'key','movement:carga-1','kind','movement','vehicle','camion','base',0,'deleted',false,
  'payload', jsonb_build_object(
    'id','carga-1','type','CARGA','vehicle','camion','tank',1,'litres',20,'loss',0,
    'time','2026-10-21T08:00:00Z'
  )
)));

-- --- Almacén: ajuste RECHAZADO (solo gerencia) ---
do $$
begin
  begin
    perform public.tanques_sync_batch(jsonb_build_array(jsonb_build_object(
      'key','adjustment:hack','kind','adjustment','vehicle',null,'base',0,'deleted',false,
      'payload', jsonb_build_object(
        'id','hack','at','2026-10-21T09:00:00Z','reason','no',
        'next', jsonb_build_object('cisterna',1,'camion',jsonb_build_array(1,1,1),'furgoneta',jsonb_build_array(1))
      )
    )));
    raise exception 'ASSERT FAIL: Almacén no debió poder escribir adjustment';
  exception when others then
    if SQLERRM like 'ASSERT FAIL:%' then raise; end if;
    -- esperado: new row violates row-level security / Usuario no autorizado / etc.
    raise notice 'OK rechazo adjustment Almacén: %', SQLERRM;
  end;
end $$;

-- --- Gerencia: ajuste autorizado (saldos dentro de 0–1000) ---
select set_config('app.uid','11111111-1111-4111-8111-111111111111', false);
select * from public.tanques_sync_batch(jsonb_build_array(jsonb_build_object(
  'key','adjustment:adj-1','kind','adjustment','vehicle',null,'base',0,'deleted',false,
  'payload', jsonb_build_object(
    'id','adj-1','at','2026-10-21T09:30:00Z','reason','Conciliación Gerencia',
    'next', jsonb_build_object('cisterna',22980,'camion',jsonb_build_array(500,400,0),'furgoneta',jsonb_build_array(990))
  )
)));

-- --- Reparto: descarga válida (después del ajuste: T1=500) ---
select set_config('app.uid','33333333-3333-4333-8333-333333333333', false);
select * from public.tanques_sync_batch(jsonb_build_array(
  jsonb_build_object(
    'key','visit:v1','kind','visit','vehicle','camion','base',0,'deleted',false,
    'payload', jsonb_build_object('id','v1','vehicle','camion','client','Bar','started','2026-10-21T10:00:00Z','ended','2026-10-21T10:10:00Z',
      'discharges', jsonb_build_array(jsonb_build_object('id','d1','source',0,'dest','1','reading',40,'liters',40,'at','2026-10-21T10:05:00Z')))
  ),
  jsonb_build_object(
    'key','movement:d1','kind','movement','vehicle','camion','base',0,'deleted',false,
    'payload', jsonb_build_object(
      'id','d1','type','DESCARGA','vehicle','camion','tank',1,'litres',40,'loss',0,
      'time','2026-10-21T10:05:00Z','client','Bar','dest','1','visitId','v1'
    )
  )
));

-- --- Duplicado: mismo movement key base=0 → CONFLICT ---
do $$
begin
  begin
    perform public.tanques_sync_batch(jsonb_build_array(jsonb_build_object(
      'key','movement:d1','kind','movement','vehicle','camion','base',0,'deleted',false,
      'payload', jsonb_build_object(
        'id','d1','type','DESCARGA','vehicle','camion','tank',1,'litres',40,'loss',0,
        'time','2026-10-21T10:05:00Z','visitId','v1'
      )
    )));
    raise exception 'ASSERT FAIL: duplicado debió CONFLICT';
  exception when others then
    if SQLERRM like 'ASSERT FAIL:%' then raise; end if;
    if SQLERRM not like '%CONFLICT%' then raise exception 'ASSERT FAIL: esperado CONFLICT, got %', SQLERRM; end if;
    raise notice 'OK duplicado CONFLICT: %', SQLERRM;
  end;
end $$;

-- --- Existencias insuficientes: vaciar T3 (0 L) ---
do $$
begin
  begin
    perform public.tanques_sync_batch(jsonb_build_array(jsonb_build_object(
      'key','movement:d-over','kind','movement','vehicle','camion','base',0,'deleted',false,
      'payload', jsonb_build_object(
        'id','d-over','type','DESCARGA','vehicle','camion','tank',3,'litres',1,'loss',0,
        'time','2026-10-21T11:00:00Z'
      )
    )));
    raise exception 'ASSERT FAIL: STOCK debió rechazar descarga en tanque vacío';
  exception when others then
    if SQLERRM like 'ASSERT FAIL:%' then raise; end if;
    if SQLERRM not like '%STOCK%' then raise exception 'ASSERT FAIL: esperado STOCK, got %', SQLERRM; end if;
    raise notice 'OK existencias insuficientes STOCK: %', SQLERRM;
  end;
end $$;

reset role;
select public.test_assert(
  (select count(*) from public.tanques_records where key='movement:carga-1' and not deleted)=1,
  'carga persistida');
select public.test_assert(
  (select count(*) from public.tanques_records where key='movement:d1' and not deleted)=1,
  'descarga persistida');
select public.test_assert(
  (select count(*) from public.tanques_records where key='adjustment:adj-1' and not deleted)=1,
  'ajuste gerencia persistido');
select public.test_assert(
  (select count(*) from public.tanques_records where key='adjustment:hack')=0,
  'ajuste almacén no persistido');
select public.test_assert(
  (select count(*) from public.tanques_records where key='movement:d-over')=0,
  'descarga insuficiente no persistida');
select public.test_assert(
  (select count(*) from public.tanques_audit)>=3,
  'auditoría tiene entradas');

\echo 'FASE_A_SQL_SCENARIOS_PASS'
