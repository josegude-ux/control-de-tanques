import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createSync} from './engine.mjs';
import {empty} from './storage.mjs';
function setup(remote, online=()=>true) {
 let state=empty(), id=0;
 const storage={read:async()=>structuredClone(state),transaction:async fn=>{const draft=structuredClone(state);fn(draft);state=draft;}};
 const sync=createSync({storage,remote,online,uuid:()=>String(++id)});
 sync.stop();
 return {sync,storage};
}
test('offline writes survive until acknowledged',async()=>{
 let connected=false,calls=0;
 const {sync,storage}=setup({push:async()=>{calls++;return {state:'ok',revision:1};},pull:async()=>[]},()=>connected);
 await sync.enqueue('load','1',{liters:25});await sync.sync();
 assert.equal(calls,0);assert.equal(Object.keys((await storage.read()).pending).length,1);
 connected=true;await sync.sync();assert.equal(calls,1);assert.equal(Object.keys((await storage.read()).pending).length,0);
});
test('lost response retries the same mutation, without losing pending work',async()=>{
 let attempt=0;const mutations=[];
 const {sync,storage}=setup({push:async x=>{mutations.push(x.mutation);if(!attempt++)throw Error('network');return {state:'ok',revision:1};},pull:async()=>[]});
 await sync.enqueue('visit','1',{liters:10});await assert.rejects(sync.sync());
 assert.equal(Object.keys((await storage.read()).pending).length,1);
 await sync.sync();assert.equal(mutations[0],mutations[1]);
});
test('edit made during upload is preserved and rebased',async()=>{
 let release;const gate=new Promise(r=>release=r);let entered;const started=new Promise(r=>entered=r);
 const {sync,storage}=setup({push:async()=>{entered();await gate;return {state:'ok',revision:1};},pull:async()=>[]});
 await sync.enqueue('visit','1',{liters:10});const flight=sync.sync();await started;
 await sync.enqueue('visit','1',{liters:12});release();await flight;
 const pending=(await storage.read()).pending['visit:1'];assert.equal(pending.data.liters,12);assert.equal(pending.base,1);
});
test('conflicts retain local correction and do not retry blindly',async()=>{
 let calls=0;
 const {sync,storage}=setup({push:async()=>{calls++;return {state:'conflict',revision:4};},pull:async()=>[{kind:'visit',id:'1',revision:4,data:{liters:99}}]});
 await sync.enqueue('visit','1',{liters:12});await sync.sync();await sync.sync();
 assert.equal(calls,1);assert.equal((await storage.read()).pending['visit:1'].data.liters,12);assert.equal((await storage.read()).conflicts['visit:1'].remoteRevision,4);
});
test('concurrent sync triggers share one flight',async()=>{
 let calls=0;
 const {sync}=setup({push:async()=>{calls++;return {state:'ok',revision:1};},pull:async()=>[]});
 await sync.enqueue('load','1',{liters:12});await Promise.all([sync.sync(),sync.sync(),sync.sync()]);assert.equal(calls,1);
});
test('partial download failure preserves last successful cache',async()=>{
 const {sync,storage}=setup({pull:async()=>{throw Error('page failed');}});
 await storage.transaction(s=>{s.records['load:old']={revision:2};s.lastSuccess='previous';});
 await assert.rejects(sync.sync());assert.equal((await storage.read()).lastSuccess,'previous');assert.equal((await storage.read()).records['load:old'].revision,2);
});
