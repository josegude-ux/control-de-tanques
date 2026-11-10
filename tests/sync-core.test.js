const {test}=require('node:test');const assert=require('node:assert/strict');const C=require('../sync-core.js');
const opening={key:'opening:global',kind:'opening',owner_id:'boss',revision:1,payload:{cisterna:10000,camion:[500,0,0],furgoneta:[0]}};
const load={id:'l1',vehicle:'camion',index:0,amount:200,merma:0,at:'2026-10-23T08:00:00Z'};
const visit={id:'v1',vehicle:'camion',client:'Bar',started:'2026-10-23T09:00:00Z',discharges:[{id:'d1',source:0,dest:'1',reading:100,liters:100,at:'2026-10-23T09:01:00Z'}]};
test('offline load is durable, retries do not duplicate, received discharge affects common stock',()=>{
 let m=C.empty();C.receive(m,[opening]);C.capture(m,{role:'almacen',loads:[load]},'worker');m=JSON.parse(JSON.stringify(m));assert.equal(Object.keys(m.pending).length,1);
 const sent=Object.values(m.pending);const row={...sent[0],revision:1};C.receive(m,[row]);assert.equal(Object.keys(m.pending).length,0);C.receive(m,[row]);assert.equal(C.balances(m).balances.camion[0],700);
 C.capture(m,{role:'reparto',visits:[],openVisit:visit},'driver');assert.equal(Object.keys(m.pending).length,2);assert.equal(C.balances(m).balances.camion[0],600);
});
test('edit during request stays queued at acknowledged revision',()=>{
 const m=C.empty(),s={role:'almacen',loads:[structuredClone(load)]};C.capture(m,s,'u');const sent=C.copy(Object.values(m.pending));s.loads[0].amount=250;C.capture(m,s,'u');C.acknowledge(m,sent,[{...sent[0],revision:1}]);assert.equal(m.pending['movement:l1'].base,1);assert.equal(m.pending['movement:l1'].payload.litres,250);
});
test('concurrent remote correction is flagged without replacing offline edit',()=>{
 const m=C.empty(),s={role:'almacen',loads:[structuredClone(load)]};C.capture(m,s,'u');let sent=Object.values(m.pending);C.acknowledge(m,sent,[{...sent[0],revision:1}]);s.loads[0].amount=250;C.capture(m,s,'u');C.receive(m,[{...m.rows['movement:l1'],revision:2,payload:{...m.rows['movement:l1'].payload,litres:300}}]);assert.equal(Object.keys(m.conflicts).length,1);assert.equal(m.pending['movement:l1'].payload.litres,250);
});
test('closing and reopening a visit never deletes its movements',()=>{
 const m=C.empty(),s={role:'reparto',visits:[],openVisit:structuredClone(visit)};C.capture(m,s,'u');let sent=Object.values(m.pending);C.acknowledge(m,sent,sent.map(r=>({...r,revision:1})));s.openVisit.ended='2026-10-23T09:05:00Z';s.visits.push(s.openVisit);s.openVisit=null;C.capture(m,s,'u');assert.equal(Object.keys(m.pending).length,1);assert.equal(m.pending['visit:v1'].deleted,false);assert.equal(m.rows['movement:d1'].deleted,false);
});
test('deleted visit produces tombstones for visit and discharges',()=>{
 const m=C.empty(),s={role:'reparto',visits:[structuredClone(visit)],openVisit:null};C.capture(m,s,'u');let sent=Object.values(m.pending);C.acknowledge(m,sent,sent.map(r=>({...r,revision:1})));s.visits=[];C.capture(m,s,'u');assert.equal(m.pending['visit:v1'].deleted,true);assert.equal(m.pending['movement:d1'].deleted,true);
});
test('other device receives plans and account history remains isolated',()=>{
 const m=C.empty();C.receive(m,[opening,{key:'visit:v1',kind:'visit',owner_id:'other',payload:visit,revision:1},{key:'plan:2026-10-19',kind:'plan',payload:{entries:[{id:'p1',vehicle:'camion'}]},revision:1}]);const s={role:'reparto'};C.hydrate(m,s,'me');assert.equal(s.openVisit,null);assert.equal(s.receivedPlans['2026-10-19|camion'].entries.length,1);assert.equal(s.receivedPlans['2026-10-19|furgoneta'].entries.length,0);
});
test('gerencia splits weekly plan into per-vehicle sync rows',()=>{
 const m=C.empty();
 const week='2026-10-19';
 const weekly={entries:[
  {id:'e1',vehicle:'camion',customerName:'Bar',liters:40},
  {id:'e2',vehicle:'furgoneta',customerName:'Bar2',liters:20}
 ],sent:{camion:{version:1}}};
 C.capture(m,{role:'gerencia',customers:[],weeklyPlans:{[week]:weekly},manager:{},stockAdjustmentHistory:[]},'boss');
 assert.ok(m.pending['plan:2026-10-19|camion']);
 assert.ok(m.pending['plan:2026-10-19|furgoneta']);
 assert.equal(m.pending['plan:2026-10-19'],undefined);
 assert.equal(m.pending['plan:2026-10-19|camion'].vehicle,'camion');
 assert.equal(m.pending['plan:2026-10-19|camion'].payload.entries.length,1);
 assert.equal(m.pending['plan:2026-10-19|furgoneta'].payload.entries.length,1);
 assert.equal(m.pending['plan:2026-10-19|camion'].payload.entries[0].id,'e1');
});
test('hydrate merges per-vehicle plans for gerencia full view',()=>{
 const m=C.empty();
 C.receive(m,[
  {key:'plan:2026-10-19|camion',kind:'plan',vehicle:'camion',revision:1,payload:{week:'2026-10-19',vehicle:'camion',entries:[{id:'e1',vehicle:'camion'}],sent:{}}},
  {key:'plan:2026-10-19|furgoneta',kind:'plan',vehicle:'furgoneta',revision:1,payload:{week:'2026-10-19',vehicle:'furgoneta',entries:[{id:'e2',vehicle:'furgoneta'}],sent:{}}}
 ]);
 const s={role:'gerencia'};C.hydrate(m,s,'boss');
 assert.equal(s.weeklyPlans['2026-10-19'].entries.length,2);
 assert.equal(s.receivedPlans['2026-10-19|camion'].entries.length,1);
 assert.equal(s.receivedPlans['2026-10-19|furgoneta'].entries.length,1);
});
test('unknown opening blocks stocks; excessive shared withdrawals raise review',()=>{
 const m=C.empty();assert.equal(C.balances(m).ready,false);C.receive(m,[opening]);C.capture(m,{role:'reparto',visits:[],openVisit:{...visit,discharges:[{...visit.discharges[0],liters:600}]}},'u');assert.equal(C.balances(m).problems.length,1);
});
test('large queues batch without splitting a visit and its movements',()=>{
 const m=C.empty();for(let i=0;i<499;i++)m.pending['customer:'+i]={key:'customer:'+i,kind:'customer',payload:{id:String(i)},base:0};
 C.capture(m,{role:'reparto',openVisit:visit},'u');const first=C.batch(m);assert.equal(first.length,499);for(const r of first)delete m.pending[r.key];assert.equal(C.batch(m).length,2);
});
test('conflict resolution keeps a visit and all pending discharges together',()=>{
 const m=C.empty();C.capture(m,{role:'reparto',openVisit:visit},'u');for(const p of Object.values(m.pending))m.rows[p.key]={...p,revision:2};m.conflicts['visit:v1']=m.rows['visit:v1'];C.resolve(m,'visit:v1',true);assert.equal(m.pending['movement:d1'].base,2);assert.equal(Object.keys(m.conflicts).length,0);
});
