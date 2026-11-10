'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('app.js','utf8');
const start=source.indexOf('let tankDetailSelectionR5=');
const end=source.indexOf('function home()',start);
assert.ok(start>0&&end>start,'R5 navigation exists');
function harness(){
 const initial={page:'inicio',vehicle:'camion',role:'almacen',tanks:{camion:[960,0],furgoneta:[500]},cloudStockReady:true,cloudStockProblems:[]};
 const state=structuredClone(initial);
 let renderCount=0,writeCount=0,backCount=0,scroll=175;
 let popstate=()=>{};
 const history={state:{},pushState(s){this.state=s},replaceState(s){this.state=s},back(){backCount++;this.state={};popstate()}};
 const window={get scrollY(){return scroll},scrollTo(_x,y){scroll=y},addEventListener(name,cb){if(name==='popstate')popstate=cb}};
 const ctx={state,TankCloud:{connected:()=>true,member:()=>({active:true})},history,window,requestAnimationFrame:cb=>cb(),fmt:n=>String(n),render:()=>{renderCount++}};
 vm.createContext(ctx);vm.runInContext(source.slice(start,end),ctx);
 return {ctx,state,initial,history,window,get renderCount(){return renderCount},get writeCount(){return writeCount},get backCount(){return backCount},pop:()=>popstate()};
}
test('open and browser Back are reversible without persisted selection or state writes',()=>{
 const h=harness();
 h.ctx.tankR5Open(0);
 assert.equal(h.ctx.tankDetailSelectionR5.index,0);
 assert.equal(h.history.state.visuraTankR5,true);
 assert.equal(h.window.scrollY,0);
 h.ctx.tankR5Back();
 assert.equal(h.ctx.tankDetailSelectionR5,null);
 assert.equal(h.window.scrollY,175);
 assert.equal(h.backCount,1);
 assert.deepEqual(h.state,h.initial);
 assert.equal(h.writeCount,0);
});
test('invalid index and inactive role cannot open a tank',()=>{
 const h=harness();h.ctx.tankR5Open(99);assert.equal(h.ctx.tankDetailSelectionR5,null);
 h.state.page='carga';h.ctx.tankR5Open(0);assert.equal(h.ctx.tankDetailSelectionR5,null);
});
test('vehicle and role change close ephemeral detail without mutating stocks',()=>{
 const h=harness();h.ctx.tankR5Open(0);
 h.state.vehicle='furgoneta';h.ctx.tankR5Close(false);
 assert.equal(h.ctx.tankDetailSelectionR5,null);
 assert.equal(h.history.state.visuraTankR5,false);
 assert.deepEqual(h.state.tanks,h.initial.tanks);
 h.state.vehicle='camion';h.ctx.tankR5Open(1);h.state.role='reparto';h.ctx.tankR5Close(false);
 assert.equal(h.ctx.tankDetailSelectionR5,null);
});
test('unvalidated, conflicting and malformed stocks never show fabricated levels',()=>{
 const h=harness();
 for(const [values,ready,problems] of [[[960],false,[]],[[960],true,['conflict']],[[NaN],true,[]],[[-1],true,[]],[[1001],true,[]]]){
  const html=h.ctx.tankDetailR5(values,'camion',0,ready,problems);
  assert.doesNotMatch(html,/role="progressbar"|960 L|1001 L/);
  assert.match(html,/Sin datos validados/);
 }
});
test('valid values and different vehicles render consistent data',()=>{
 const h=harness();
 const a=h.ctx.tankDetailR5([960],'camion',0,true,[]);
 assert.match(a,/960 L/);assert.match(a,/96 %/);assert.match(a,/aria-valuenow="96"/);
 const b=h.ctx.tankDetailR5([500],'furgoneta',0,true,[]);
 assert.match(b,/500 L/);assert.match(b,/50 %/);assert.match(b,/Furgoneta/);
});
test('selection is transient and resets on reload simulation',()=>{
 const h=harness();h.ctx.tankR5Open(0);
 assert.equal(Object.hasOwn(h.state,'tankDetailSelectionR5'),false);
 const other=harness();
 assert.equal(other.ctx.tankDetailSelectionR5,null);
});
