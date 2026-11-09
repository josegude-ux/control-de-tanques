'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..');
const read=n=>fs.readFileSync(path.join(root,n),'utf8');
const app=read('app.js');
function extract(start,end){const i=app.indexOf(start),j=app.indexOf(end,i+start.length);assert(i>=0&&j>i,'function missing '+start);return app.slice(i,j)}
const receive=extract('async function receivePlanFile(file){','// v0.9.18:');
const exportSource=extract('async function exportPlan(vehicle){','function render(){');
const fakePlan={week:'2026-11-09',vehicle:'camion',version:1,entries:[{id:'p1',date:'2026-11-09',vehicle:'camion',client:'Cliente ficticio',liters:150}]};
function context(role='reparto'){const messages=[],state={role,vehicle:'camion',receivedPlans:{},weeklyPlans:{'2026-11-09':{entries:fakePlan.entries.map(e=>({...e,customerName:e.client,customerId:'c1'})),sent:{}}},customers:[{id:'c1',nombre:'Cliente ficticio',poblacion:'Prueba'}]};let saves=0,parses=0;
const ctx={state,CDTPlanImport:{parse:()=>{parses++;return structuredClone(ctx.input)}},toast:m=>messages.push(m),persist:async()=>{saves++},now:()=> '2026-11-10T00:00:00Z',confirm:()=>true,planWeek:'2026-11-09',weeklyPlan:()=>state.weeklyPlans['2026-11-09'],SheetXLSX:{generate:()=>({type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'})},File:class{constructor(a,n,o){this.name=n;this.type=o.type}},navigator:{},URL:{createObjectURL:()=>'',revokeObjectURL:()=>{}},document:{createElement:()=>({click(){}}),body:{appendChild(){}},getElementById:()=>null},setTimeout:()=>{},fmt:n=>String(n)};
ctx.input=structuredClone(fakePlan);
ctx.run=new Function('ctx',`with(ctx){${receive};return receivePlanFile;}`)(ctx);
return {ctx,state,messages,get saves(){return saves},get parses(){return parses}};
}
const file={name:'plan.xlsx',arrayBuffer:async()=>new ArrayBuffer(1)};
test('Reparto imports and persists a plan; exact retry is idempotent',async()=>{const t=context();await t.ctx.run(file);assert.equal(t.saves,1);assert.equal(t.state.receivedPlans['2026-11-09|camion'].entries.length,1);await t.ctx.run(file);assert.equal(t.saves,1);assert.match(t.messages.at(-1),/no se ha duplicado/);});
test('Reparto rejects stale and same-version divergent plans',async()=>{const t=context();await t.ctx.run(file);t.ctx.input.version=0;await t.ctx.run(file);assert.equal(t.saves,1);t.ctx.input.version=1;t.ctx.input.entries[0].liters=250;await t.ctx.run(file);assert.equal(t.saves,1);assert.match(t.messages.at(-1),/Misma versión/);});
test('Reparto replaces newer version only once',async()=>{const t=context();await t.ctx.run(file);t.ctx.input.version=2;t.ctx.input.entries[0].liters=250;await t.ctx.run(file);assert.equal(t.saves,2);assert.equal(t.state.receivedPlans['2026-11-09|camion'].version,2);assert.equal(t.state.receivedPlans['2026-11-09|camion'].entries[0].liters,250);});
test('Reparto rejects other vehicle and non-Reparto cannot import',async()=>{const t=context();t.ctx.input.vehicle='furgoneta';await t.ctx.run(file);assert.equal(t.saves,0);const u=context('almacen');await u.ctx.run(file);assert.equal(u.parses,0);assert.equal(u.saves,0);});
test('Reparto catches malformed XLSX and leaves state unchanged',async()=>{const t=context();t.ctx.CDTPlanImport.parse=()=>{throw Error('Archivo inválido')};await t.ctx.run(file);assert.equal(t.saves,0);assert.deepEqual(t.state.receivedPlans,{});});
test('Gerencia export creates per-vehicle version and marks only after file handling',async()=>{assert(exportSource.includes('plan.sent[vehicle]={version,at:now(),needsResend:false}'));assert(exportSource.includes('SheetXLSX.generate'));assert(exportSource.includes('await persist()'));});
