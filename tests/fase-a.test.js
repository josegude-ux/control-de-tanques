'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');
const path=require('path');
const C=require('../sync-core.js');

const opening20={
 key:'opening:global',kind:'opening',owner_id:'boss',revision:1,
 payload:{cisterna:23000,camion:[977,413.57,0],furgoneta:[990]}
};

function ackAll(m,user='u'){
 const sent=C.batch(m);
 C.acknowledge(m,sent,sent.map(r=>({...r,revision:(m.rows[r.key]?.revision||0)+1,owner_id:user})));
}

test('1. dos móviles sincronizan sin duplicar: carga + descarga concurrentes',()=>{
 const shared={};
 const a=C.empty(),b=C.empty();
 C.receive(a,[opening20]);C.receive(b,[opening20]);
 C.capture(a,{role:'almacen',loads:[{id:'carga-a',vehicle:'camion',index:0,amount:50,merma:0,at:'2026-10-21T08:00:00Z'}]},'almacen');
 const sentA=C.batch(a);
 for(const r of sentA)shared[r.key]={...r,revision:1,owner_id:'almacen'};
 C.acknowledge(a,sentA,Object.values(shared).filter(r=>sentA.some(s=>s.key===r.key)));
 C.receive(b,Object.values(shared));
 C.capture(b,{role:'reparto',visits:[],openVisit:{id:'v-b',vehicle:'camion',client:'Bar',started:'2026-10-21T09:00:00Z',discharges:[{id:'d-b',source:0,dest:'1',reading:40,liters:40,at:'2026-10-21T09:01:00Z'}]}},'reparto');
 const sentB=C.batch(b);
 for(const r of sentB){
  assert.ok(!shared[r.key]||shared[r.key].revision===r.base,'no overwrite sin base');
  shared[r.key]={...r,revision:(shared[r.key]?.revision||0)+1,owner_id:'reparto'};
 }
 C.acknowledge(b,sentB,sentB.map(r=>shared[r.key]));
 C.receive(a,Object.values(shared));
 assert.equal(Object.keys(a.pending).length,0);
 assert.equal(Object.keys(b.pending).length,0);
 assert.equal(C.balances(a).balances.camion[0],987); // 977+50-40
 assert.equal(C.balances(b).balances.camion[0],987);
 assert.equal([...Object.values(shared)].filter(r=>r.kind==='movement').length,2);
});

test('2. descarga duplicada por reintento no crea segundo registro',()=>{
 const m=C.empty();
 C.receive(m,[opening20]);
 const visit={id:'v1',vehicle:'camion',client:'X',started:'2026-10-21T10:00:00Z',discharges:[{id:'d1',source:1,dest:'1',reading:10,liters:10,at:'2026-10-21T10:01:00Z'}]};
 C.capture(m,{role:'reparto',visits:[],openVisit:visit},'drv');
 const sent=C.copy(Object.values(m.pending));
 const rows=sent.map(r=>({...r,revision:1}));
 // Respuesta perdida: pending sigue; pull recibe lo mismo → limpia pending.
 C.receive(m,rows);
 assert.equal(Object.keys(m.pending).length,0);
 C.receive(m,rows); // reintento pull
 assert.equal(Object.keys(m.pending).length,0);
 assert.equal(C.balances(m).balances.camion[1],403.57);
});

test('3. fallo de red: pendientes se conservan en meta serializada',()=>{
 const m=C.empty();
 C.receive(m,[opening20]);
 C.capture(m,{role:'almacen',loads:[{id:'offline-1',vehicle:'furgoneta',index:0,amount:10,merma:0,at:'2026-10-21T11:00:00Z'}]},'a');
 const snap=JSON.parse(JSON.stringify(m));
 assert.equal(Object.keys(snap.pending).length,1);
 assert.equal(snap.pending['movement:offline-1'].payload.litres,10);
});

test('4. respuesta perdida tras aceptación: receive limpia cola sin duplicar',()=>{
 const m=C.empty();
 C.receive(m,[opening20]);
 C.capture(m,{role:'almacen',loads:[{id:'lost-ack',vehicle:'camion',index:2,amount:5,merma:0,at:'2026-10-21T12:00:00Z'}]},'a');
 const sent=Object.values(m.pending);
 // Servidor aceptó pero el cliente no recibió ACK; pull trae la fila.
 C.receive(m,[{...sent[0],revision:1}]);
 assert.equal(Object.keys(m.pending).length,0);
 assert.equal(C.balances(m).balances.camion[2],5);
});

test('5. reabrir PWA: meta IDB-like revive cola y visita atómica',()=>{
 let m=C.empty();
 C.receive(m,[opening20]);
 const visit={id:'v-reopen',vehicle:'camion',client:'Bar',started:'2026-10-21T13:00:00Z',discharges:[{id:'d-reopen',source:0,dest:'2',reading:25.5,liters:25.5,at:'2026-10-21T13:01:00Z'}]};
 C.capture(m,{role:'reparto',visits:[],openVisit:visit},'drv');
 m=JSON.parse(JSON.stringify(m)); // simula cierre/apertura
 const batch=C.batch(m);
 assert.equal(batch.length,2);
 assert.ok(batch.some(r=>r.kind==='visit'));
 assert.ok(batch.some(r=>r.kind==='movement'&&r.payload.visitId==='v-reopen'));
});

test('6. usuario sin permiso: Almacén no extrae adjustments',()=>{
 const m=C.empty();
 C.receive(m,[opening20]);
 const adj={id:'adj-hack',at:'2026-10-21T14:00:00Z',reason:'x',next:{camion:[1,2,3],furgoneta:[4],cisterna:100},cisternKnown:true};
 C.capture(m,{role:'almacen',loads:[],stockAdjustmentHistory:[adj]},'almacen');
 assert.equal(Object.keys(m.pending).filter(k=>k.startsWith('adjustment:')).length,0);
 C.capture(m,{role:'gerencia',manager:{opening:opening20.payload},stockAdjustmentHistory:[adj],customers:[],weeklyPlans:{}},'boss');
 assert.ok(m.pending['adjustment:adj-hack']);
});

test('7. cuenta desactivada: retryAfterGate conserva pendientes y no empuja',()=>{
 const plan=C.retryAfterGate({busy:false,online:true,active:false,stopped:false,editingTab:true,pendingCount:3});
 assert.equal(plan.action,'hold');
 assert.equal(plan.keepPending,true);
 assert.equal(plan.reason,'deactivated');
 const offline=C.retryAfterGate({busy:false,online:false,active:true,stopped:false,editingTab:true,pendingCount:2});
 assert.equal(offline.action,'idle');
 assert.equal(offline.ms,null);
 assert.equal(offline.keepPending,true);
 assert.equal(offline.reason,'offline-wait-event');
 const busy=C.retryAfterGate({busy:true,online:true,active:true,stopped:false,editingTab:true,pendingCount:1});
 assert.equal(busy.action,'defer');
});

test('8. existencias insuficientes y capacidad excedida',()=>{
 const m=C.empty();
 C.receive(m,[opening20]);
 C.capture(m,{role:'reparto',visits:[],openVisit:{id:'v-over',vehicle:'camion',client:'X',started:'2026-10-21T15:00:00Z',discharges:[{id:'d-over',source:2,dest:'1',reading:1,liters:1,at:'2026-10-21T15:01:00Z'}]}},'d');
 assert.ok(C.balances(m).problems.includes('d-over')); // T3=0
 assert.equal(C.stockOk(m),false);
 const m2=C.empty();
 C.receive(m2,[opening20]);
 C.capture(m2,{role:'almacen',loads:[{id:'cap',vehicle:'furgoneta',index:0,amount:20,merma:0,at:'2026-10-21T15:02:00Z'}]},'a');
 // 990+20=1010 > 1000
 assert.ok(C.balances(m2).problems.includes('cap'));
});

test('9. anulación conserva históricos y no restaura saldo automáticamente',()=>{
 const m=C.empty();
 C.receive(m,[opening20]);
 const visit={id:'v-can',vehicle:'camion',client:'BAR X',started:'2026-10-21T16:00:00Z',ended:'2026-10-21T16:10:00Z',cancelledAt:'2026-10-21T17:00:00Z',discharges:[{id:'d-bar',source:0,dest:'1',reading:40,liters:40,at:'2026-10-21T16:05:00Z'}]};
 C.capture(m,{role:'reparto',visits:[visit],openVisit:null},'drv');
 assert.equal(m.pending['movement:d-bar'].deleted,false);
 assert.equal(C.balances(m).balances.camion[0],C.litres(977-40));
 // Soft-delete en meta no restaura saldo (proyección incluye movements deleted).
 m.pending['movement:d-bar']={...m.pending['movement:d-bar'],deleted:true};
 assert.equal(C.balances(m).balances.camion[0],C.litres(977-40));
});

test('9b. source=null no asigna tanque 1 ni descuenta (BARALLETE 240,61 L)',()=>{
 const m=C.empty();
 C.receive(m,[opening20]);
 const before=C.balances(m).balances.camion.slice();
 const visit={
  id:'v-pending-origen',vehicle:'camion',client:'BARALLETE BAR',
  started:'2026-10-21T16:00:00Z',ended:'2026-10-21T16:10:00Z',
  discharges:[{id:'pendiente-barallete-2026-10-21-24061',source:null,sourceTank:null,dest:'3',reading:240.61,liters:240.61,at:'2026-10-21T16:05:00Z',affectsStock:false}]
 };
 C.capture(m,{role:'reparto',visits:[visit],openVisit:null,vehicle:'camion'},'drv');
 assert.equal(m.pending['movement:pendiente-barallete-2026-10-21-24061'],undefined);
 assert.ok(m.pending['visit:v-pending-origen']);
 assert.deepEqual(C.balances(m).balances.camion,before);
 // null+1 no debe colarse: sin movement de stock.
 assert.equal(C.validSource({source:null}),false);
 assert.equal(C.validSource({source:0}),true);
});

test('9c. Reparto no reenvía provisionales de otro vehículo',()=>{
 const extracted=C.extract({
  role:'reparto',vehicle:'camion',visits:[],openVisit:null,
  provisionalHistory:[
   {id:'p-fur',vehicle:'furgoneta',amounts:[100],at:'2026-10-21T07:00:00Z'},
   {id:'p-cam',vehicle:'camion',amounts:[1,2,3],at:'2026-10-21T07:01:00Z'}
  ]
 });
 assert.equal(extracted['provisional:p-fur'],undefined);
 assert.ok(extracted['provisional:p-cam']);
 const m=C.empty();
 C.receive(m,[opening20,
  {key:'provisional:p-fur',kind:'provisional',owner_id:'other',revision:1,deleted:false,vehicle:'furgoneta',
   payload:{id:'p-fur',vehicle:'furgoneta',amounts:[100],at:'2026-10-21T07:00:00Z'}},
  {key:'provisional:p-cam',kind:'provisional',owner_id:'drv',revision:1,deleted:false,vehicle:'camion',
   payload:{id:'p-cam',vehicle:'camion',amounts:[1,2,3],at:'2026-10-21T07:01:00Z'}}
 ]);
 const s={role:'reparto',vehicle:'camion',visits:[],openVisit:null};
 C.hydrate(m,s,'drv');
 assert.equal(s.provisionalHistory.length,1);
 assert.equal(s.provisionalHistory[0].vehicle,'camion');
});

test('10. precisión decimal sin descuadres (413,57 + operaciones)',()=>{
 assert.equal(C.litres(413.57),413.57);
 assert.equal(C.litres(0.1+0.2),0.3);
 const m=C.empty();
 C.receive(m,[opening20]);
 C.capture(m,{role:'reparto',visits:[],openVisit:{id:'v-dec',vehicle:'camion',client:'Y',started:'2026-10-21T18:00:00Z',discharges:[{id:'d-dec',source:1,dest:'1',reading:13.57,liters:13.57,at:'2026-10-21T18:01:00Z'}]}},'d');
 assert.equal(C.balances(m).balances.camion[1],400);
 assert.equal(C.balances(m).balances.cisterna,23000);
});

test('11. service worker no toca IndexedDB (actualización segura)',()=>{
 const sw=fs.readFileSync(path.join(__dirname,'../sw.js'),'utf8');
 // No llamadas a la API IndexedDB (el comentario puede mencionarla).
 assert.equal(/\bindexedDB\s*\./.test(sw),false);
 assert.equal(/openDB|IDBKeyRange|indexedDB\.open/.test(sw),false);
 assert.match(sw,/caches\.(open|keys|match)/);
 assert.match(sw,/control-tanques-demo-v0101/);
});

test('12. compatibilidad apertura 20/10/2026 y forbidSyncedDelete',()=>{
 const m=C.empty();
 C.receive(m,[opening20]);
 assert.deepEqual(C.balances(m).balances,{cisterna:23000,camion:[977,413.57,0],furgoneta:[990]});
 C.capture(m,{role:'reparto',visits:[{id:'v-old',vehicle:'camion',client:'Z',started:'2026-10-20T12:00:00Z',ended:'2026-10-20T12:30:00Z',discharges:[{id:'d-old',source:0,dest:'1',reading:10,liters:10,at:'2026-10-20T12:10:00Z'}]}],openVisit:null},'drv');
 ackAll(m,'drv');
 assert.throws(()=>{
  C.capture(m,{role:'reparto',visits:[],openVisit:null},'drv',{forbidSyncedDelete:true});
 },/No se pueden borrar/);
 // Sin forbid, tombstone permitido (modo demo local).
 C.capture(m,{role:'reparto',visits:[],openVisit:null},'drv');
 assert.equal(m.pending['visit:v-old'].deleted,true);
 assert.equal(m.pending['movement:d-old'].deleted,true);
});

test('gate serial evita solapamiento save/sync',async()=>{
 const gate=C.createGate();
 const order=[];
 await Promise.all([
  gate(async()=>{order.push('a-start');await new Promise(r=>setTimeout(r,20));order.push('a-end');}),
  gate(async()=>{order.push('b-start');order.push('b-end');})
 ]);
 assert.deepEqual(order,['a-start','a-end','b-start','b-end']);
});

test('SQL Fase A preparado: RPC definer, lock, sin INSERT directo, SIN_APERTURA',()=>{
 const sql=fs.readFileSync(path.join(__dirname,'../database/fase-a-seguridad-inventario.sql'),'utf8');
 assert.match(sql,/m\.role='almacen' and k='movement' and p->>'type'='CARGA'/);
 assert.doesNotMatch(sql,/m\.role='almacen' and \(\(k='movement' and p->>'type'='CARGA'\) or k='adjustment'\)/);
 assert.match(sql,/STOCK: existencias inválidas/);
 assert.match(sql,/SIN_APERTURA/);
 assert.match(sql,/faltan existencias iniciales de Gerencia/);
 assert.match(sql,/unique_violation/);
 assert.match(sql,/No se puede borrar un movimiento sincronizado/);
 assert.match(sql,/Solo Gerencia puede anular visitas sincronizadas/);
 assert.match(sql,/jsonb_typeof\(new\.payload->'tank'\)<>'number'/);
 assert.match(sql,/NO ejecutar aún/i);
 assert.match(sql,/function public\.tanques_sync_batch\(changes jsonb\)[\s\S]*?security definer/i);
 assert.match(sql,/pg_advisory_xact_lock\(881002301\)/);
 assert.match(sql,/revoke insert, update, delete on public\.tanques_records from authenticated/i);
 assert.match(sql,/grant select on public\.tanques_records to authenticated/i);
 assert.match(sql,/grant execute on function tanques_private\.round2\(numeric\) to authenticated/i);
 assert.doesNotMatch(sql,/grant execute on function tanques_private\.stock_problems\(\) to authenticated/i);
 assert.match(sql,/revoke all on function tanques_private\.round2\(numeric\) from public, anon/i);
 assert.match(sql,/revoke all on function tanques_private\.stock_problems\(\) from public, anon, authenticated/i);
 assert.match(sql,/affectsStock=false no admite sincronización de inventario/);
});

test('SQL Fase B staging definitiva: destino iuqmzpahyjganhppcsur y anti-prod',()=>{
 const sql=fs.readFileSync(path.join(__dirname,'../database/fase-b-staging-seguridad.sql'),'utf8');
 assert.match(sql,/iuqmzpahyjganhppcsur/);
 assert.match(sql,/oevetnszmfxeukcncwji/);
 assert.match(sql,/NO EJECUTAR en producción/i);
 assert.match(sql,/affectsStock=false no admite sincronización de inventario/);
 assert.match(sql,/pg_advisory_xact_lock\(881002301\)/);
 assert.match(sql,/revoke insert, update, delete on public\.tanques_records from authenticated/i);
 assert.match(sql,/security definer/i);
 assert.match(sql,/SIN_APERTURA/);
});

test('referencia Cervecería Ejemplo 450 L no entra en opening de prueba',()=>{
 // Los 450 L ficticios no forman parte del opening canónico de referencia.
 assert.equal(opening20.payload.camion.reduce((a,b)=>a+b,0)+opening20.payload.furgoneta[0],977+413.57+0+990);
 assert.ok(!JSON.stringify(opening20).includes('450'));
});
