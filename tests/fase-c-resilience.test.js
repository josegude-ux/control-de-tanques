'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const C=require('../sync-core.js');

const opening={key:'opening:global',kind:'opening',revision:1,owner_id:'gerencia',vehicle:null,deleted:false,payload:{cisterna:10000,camion:[500,400,300],furgoneta:[800]}};
const load={id:'load-test-1',vehicle:'camion',index:0,amount:100,merma:0,at:'2026-10-24T00:00:00Z'};

test('Fase C: el retroceso progresivo es acotado y no crece indefinidamente',()=>{
 const expected=[[0,2000],[1,2000],[2,4000],[3,8000],[4,16000],[5,32000],[6,64000],[7,120000],[99,120000]];
 for(const [fails,delay] of expected)assert.equal(C.retryDelay(fails),delay);
 assert.equal(C.retryDelay(NaN),2000);
});

test('Fase C: lectura RLS completa limpia la caché inaccesible, pero conserva pendientes',()=>{
 const m=C.empty();
 m.rows['customer:antiguo']={key:'customer:antiguo',kind:'customer',owner_id:'gerencia',revision:1,payload:{nombre:'OCULTO'}};
 m.rows['opening:global']=structuredClone(opening);
 m.conflicts['customer:antiguo']=structuredClone(m.rows['customer:antiguo']);
 m.pending['visit:offline']={key:'visit:offline',kind:'visit',base:0,payload:{id:'offline',discharges:[]}};
 const n=C.reconcileSnapshot(m,[opening]);
 assert.equal(n,1);
 assert.equal(m.rows['customer:antiguo'],undefined);
 assert.equal(m.conflicts['customer:antiguo'],undefined);
 assert.ok(m.pending['visit:offline'],'la cola offline nunca debe desaparecer');
 assert.equal(m.rows['opening:global'].revision,1);
});

test('Fase C: respuesta ACK perdida no duplica movimiento cuando aparece en el siguiente pull',()=>{
 const m=C.empty();C.receive(m,[opening]);
 C.capture(m,{role:'almacen',loads:[structuredClone(load)]},'almacen-1');
 const queued=m.pending['movement:load-test-1'];assert.ok(queued);
 C.reconcileSnapshot(m,[opening,{...structuredClone(queued),owner_id:'almacen-1',revision:1}]);
 assert.equal(m.pending['movement:load-test-1'],undefined);
 assert.equal(C.balances(m).balances.camion[0],600);
});

test('Fase C: conflicto de revisión preserva cambios locales y no modifica su base',()=>{
 const m=C.empty();C.receive(m,[opening]);
 C.capture(m,{role:'almacen',loads:[structuredClone(load)]},'almacen-1');
 const previous=structuredClone(m.pending['movement:load-test-1']);
 C.acknowledge(m,[previous],[{...previous,owner_id:'almacen-1',revision:1}]);
 const modified={...load,amount:180};
 C.capture(m,{role:'almacen',loads:[modified]},'almacen-1');
 const pending=structuredClone(m.pending['movement:load-test-1']);
 C.reconcileSnapshot(m,[opening,{...m.rows['movement:load-test-1'],revision:2,payload:{...previous.payload,litres:140}}]);
 assert.equal(m.pending['movement:load-test-1'].payload.litres,180);
 assert.equal(m.pending['movement:load-test-1'].base,1);
 assert.equal(m.conflicts['movement:load-test-1'].revision,2);
 assert.equal(pending.base,1);
});

test('Fase C: un movimiento compartido NO expone cliente, destino ni identificador del plan',()=>{
 const v={id:'visita-privada',vehicle:'camion',client:'Establecimiento confidencial',planEntryId:'plan-privado',discharges:[
  {id:'descarga-privada',source:0,dest:'3',liters:25,at:'2026-10-24T00:00:00Z'}
 ]};
 const all=C.extract({role:'reparto',visits:[v]});
 const movement=all['movement:descarga-privada'];
 assert.ok(movement);
 for(const field of ['client','dest','planEntryId'])assert.equal(movement.payload[field],undefined);
 assert.equal(movement.payload.visitId,'visita-privada');
 assert.equal(all['visit:visita-privada'].payload.client,'Establecimiento confidencial');
 assert.equal(all['visit:visita-privada'].payload.discharges[0].dest,'3');
 assert.equal(movement.payload.litres,25);
});

test('Fase C: aislamiento entre aplicación DEMO y original para bloqueo, caché de usuario y perfiles',()=>{
 const cloud=fs.readFileSync(path.join(__dirname,'..','cloud-sync.js'),'utf8');
 assert.match(cloud,/EDIT_LOCK_NAME='tanques-edit-session:'\+\(cfg\.idbName\|\|'cdt_demo_v1'\)/);
 assert.match(cloud,/navigator\.locks\.request\(EDIT_LOCK_NAME/);
 assert.match(cloud,/MEMBER_CACHE_PREFIX=IS_STAGING\?'tanques-staging-member:'/);
 assert.match(cloud,/MEMBER_CACHE_PREFIX=IS_STAGING[^\n]+cfg\.idbName/);
 assert.match(cloud,/localStorage\.getItem\(MEMBER_CACHE_PREFIX\+account\)/);
 assert.match(cloud,/localStorage\.setItem\(MEMBER_CACHE_PREFIX\+account/);
 assert.doesNotMatch(cloud,/navigator\.locks\.request\('tanques-edit-session'/);
});

test('Fase C: no confirmar captura local antes de completar transacción durable',()=>{
 const cloud=fs.readFileSync(path.join(__dirname,'..','cloud-sync.js'),'utf8');
 const save=cloud.slice(cloud.indexOf(' async function save(s){'),cloud.indexOf(' function applyBalances('));
 assert.ok(save.includes('const staged=C.copy(meta);'));
 assert.ok(save.includes('C.capture(staged,s,account'));
 assert.ok(save.includes('await tx([[profileKeys[s.role],s],[key(),staged]])'));
 assert.ok(save.indexOf('meta=staged')>save.indexOf('await tx('));
 assert.ok(save.indexOf('meta=staged')<save.indexOf('schedule();'));
});

test('Fase C: errores STOCK y de permisos conservan pendientes y usan backoff',()=>{
 const cloud=fs.readFileSync(path.join(__dirname,'..','cloud-sync.js'),'utf8');
 assert.match(cloud,/rejected='stock'/);
 assert.match(cloud,/rejected='conflict'/);
 assert.match(cloud,/consecutiveFailures\+\+/);
 assert.match(cloud,/C\.retryDelay\(consecutiveFailures\)/);
 assert.match(cloud,/Pendientes conservados; reintento progresivo/);
});

test('Fase C: los registros remotos se reconcilian solo tras recuperar el listado completo',()=>{
 const cloud=fs.readFileSync(path.join(__dirname,'..','cloud-sync.js'),'utf8');
 const pull=cloud.slice(cloud.indexOf(' async function pull(){'),cloud.indexOf(' async function sync(){'));
 assert.match(pull,/if\(data.length<500\)break/);
 assert.match(pull,/C\.reconcileSnapshot\(meta,rows\)/);
 assert.ok(pull.indexOf('C.reconcileSnapshot')>pull.indexOf('if(data.length<500)break'));
});
