'use strict';
const {test}=require('node:test');
const assert=require('assert/strict');
const fs=require('fs');
const path=require('path');

const root=path.join(__dirname,'..');
const cloud=fs.readFileSync(path.join(root,'cloud-sync.js'),'utf8');
const app=fs.readFileSync(path.join(root,'app.js'),'utf8');
const demoConfig=fs.readFileSync(path.join(root,'demo/config.js'),'utf8');
const demoIndex=fs.readFileSync(path.join(root,'demo/index.html'),'utf8');
const demoSw=fs.readFileSync(path.join(root,'demo/sw.js'),'utf8');

test('Fase B: cloud-sync bloquea host de producción en staging',()=>{
 assert.match(cloud,/assertStagingIsolation/);
 assert.match(cloud,/oevetnszmfxeukcncwji\.supabase\.co/);
 assert.match(cloud,/STAGING bloqueado/);
 assert.match(cloud,/IS_STAGING/);
 assert.match(cloud,/authStorageKey/);
 assert.match(cloud,/cloudMetaPrefix|META_PREFIX/);
});

test('Fase B: IndexedDB usa TankConfig.idbName cuando existe',()=>{
 assert.match(app,/TankConfig&&window\.TankConfig\.idbName/);
 assert.match(app,/cdt_demo_v1/);
});

test('Fase B: demo/config no apunta a producción',()=>{
 assert.match(demoConfig,/env:'staging'/);
 assert.match(demoConfig,/cdt_staging_faseb_v1/);
 assert.match(demoConfig,/tanques-auth-staging-v1/);
 assert.match(demoConfig,/iuqmzpahyjganhppcsur\.supabase\.co/);
 assert.match(demoConfig,/sb_publishable_/);
 // supabaseUrl debe ser DEMO staging, nunca producción.
 const urlMatch=demoConfig.match(/supabaseUrl:'([^']+)'/);
 assert.ok(urlMatch);
 assert.match(urlMatch[1],/iuqmzpahyjganhppcsur/);
 assert.doesNotMatch(urlMatch[1],/oevetnszmfxeukcncwji/);
 const keyMatch=demoConfig.match(/supabaseAnonKey:'([^']+)'/);
 assert.ok(keyMatch);
 assert.match(keyMatch[1],/^sb_publishable_/);
 assert.doesNotMatch(keyMatch[1],/service_role/i);
 assert.match(demoConfig,/productionHosts:\['oevetnszmfxeukcncwji\.supabase\.co'\]/);
});

test('Fase B: demo/index carga config antes de cloud-sync',()=>{
 assert.match(demoIndex,/config\.js/);
 assert.match(demoIndex,/DEMO STAGING/);
 const cfgAt=demoIndex.indexOf('config.js');
 const cloudAt=demoIndex.indexOf('cloud-sync.js');
 assert.ok(cfgAt>=0&&cloudAt>cfgAt);
});

test('Fase B: SW staging con caché propia',()=>{
 assert.match(demoSw,/control-tanques-staging-v0101-/);
 assert.doesNotMatch(demoSw,/control-tanques-demo-v0101-fase-a/);
 assert.match(demoSw,/control-tanques-staging-/);
});

test('Fase B: migración RLS read restringe por rol/vehículo',()=>{
 const sql=fs.readFileSync(path.join(root,'database/fase-b-staging-rls-read.sql'),'utf8');
 assert.match(sql,/iuqmzpahyjganhppcsur/);
 assert.match(sql,/tanques_private\.can_read/);
 assert.match(sql,/drop policy if exists records_read/);
 assert.match(sql,/m\.role='almacen'/);
 assert.match(sql,/m\.role='reparto'/);
 assert.match(sql,/k='visit' and owner=\(select auth\.uid\(\)\)/);
 assert.match(sql,/k='plan' and v is not distinct from m\.vehicle/);
 assert.match(sql,/NO EJECUTAR hasta autorización/i);
 assert.match(sql,/revoke all on function public\.tanques_sync_batch/);
});

test('Fase B: migración plan por vehículo (API)',()=>{
 const sql=fs.readFileSync(path.join(root,'database/fase-b-staging-plan-by-vehicle.sql'),'utf8');
 assert.match(sql,/iuqmzpahyjganhppcsur/);
 assert.match(sql,/oevetnszmfxeukcncwji/);
 assert.match(sql,/k='plan' and v is not distinct from m\.vehicle/);
 assert.match(sql,/NO EJECUTAR hasta autorización/i);
 assert.doesNotMatch(sql,/k in \('opening','adjustment','plan'\)/);
 const core=fs.readFileSync(path.join(root,'sync-core.js'),'utf8');
 assert.match(core,/week\+'\|'\+vehicle/);
 assert.match(core,/plan:SEMANA\|camion\|furgoneta|plan:SEMANA\|vehiculo/);
});

test('Fase B: guardrail lógico (espejo de assertStagingIsolation)',()=>{
 const prod='oevetnszmfxeukcncwji.supabase.co';
 function blocked(url,key,env){
  if(env!=='staging')return false;
  const host=new URL(url).hostname;
  return host===prod||/YOUR_STAGING/i.test(url)||/YOUR_STAGING/i.test(key);
 }
 assert.equal(blocked('https://oevetnszmfxeukcncwji.supabase.co','x','staging'),true);
 assert.equal(blocked('https://YOUR_STAGING_PROJECT.supabase.co','YOUR_STAGING_KEY','staging'),true);
 assert.equal(blocked('https://abcdxyz.supabase.co','sb_publishable_ok','staging'),false);
 assert.equal(blocked('https://oevetnszmfxeukcncwji.supabase.co','x','production'),false);
});
