'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const TankSyncCore=require('../sync-core.js');

/**
 * Simula la parte esencial de una PWA con almacenamiento IndexedDB transaccional,
 * sin navegador, credenciales reales ni peticiones de red.
 */
function createHarness(){
 const disk=new Map();
 let failNext=false;
 const db={transaction(){
  const writes=[];
  const tx={
   error:null,
   oncomplete:null,onerror:null,onabort:null,
   objectStore(){return {put:(value,key)=>writes.push([key,structuredClone(value)])};}
  };
  queueMicrotask(()=>{
   if(failNext){
    failNext=false;
    tx.error=Error('IDB cuota de almacenamiento agotada');
    tx.onerror?.();
   }else{
    for(const [key,value] of writes)disk.set(key,value);
    tx.oncomplete?.();
   }
  });
  return tx;
 }};
 const membership={user_id:'test-id',role:'almacen',vehicle:null,active:true,nombre:'DEMO Almacén'};
 const client={
  auth:{
   getSession:async()=>({data:{session:{user:{id:'test-id',email:'demo@example.test'}}},error:null}),
   onAuthStateChange:()=>{}
  },
  from(){return {select(){return {eq(){return {maybeSingle:async()=>({data:membership,error:null})};}};}};}
 };
 const memory=new Map();
 const sandbox={
  TankSyncCore,
  window:{
   TankConfig:{
    env:'staging',
    supabaseUrl:'https://iuqmzpahyjganhppcsur.supabase.co',
    supabaseAnonKey:'sb_publishable_testing_only',
    idbName:'cdt_staging_faseb_v1',
    cloudMetaPrefix:'tanques-staging-meta',
    cloudProfilePrefix:'tanques-staging',
    authStorageKey:'tanques-staging-auth-test'
   },
   addEventListener(){}
  },
  navigator:{onLine:true},
  document:{getElementById:()=>null,addEventListener(){},querySelector:()=>null},
  location:{pathname:'/control-de-tanques/demo/'},
  supabase:{createClient:()=>client},
  db,
  dbGet:async key=>disk.get(key)||null,
  dbPut:async(key,value)=>{disk.set(key,structuredClone(value));},
  profileKeys:{almacen:'profile-a',reparto:'profile-r',gerencia:'profile-g'},
  cleanProfile:role=>({role,loads:[],visits:[],customers:[],manager:{}}),
  render(){},toast(){},
  localStorage:{getItem:key=>memory.get(key)||null,setItem:(key,val)=>memory.set(key,val)},
  setTimeout:()=>1,clearTimeout(){},
  state:{role:'almacen'},
  esc:s=>String(s),
  URL
 };
 vm.createContext(sandbox);
 const cloud=fs.readFileSync(path.join(__dirname,'..','cloud-sync.js'),'utf8');
 vm.runInContext(cloud+';globalThis.__tankCloud=TankCloud;',sandbox,{timeout:2000});
 return {cloud:sandbox.__tankCloud,disk,failOnce:()=>{failNext=true;}};
}

test('Fase C: si falla IndexedDB, meta no confirma y el mismo movimiento se recupera al reintentar',async()=>{
 const {cloud,disk,failOnce}=createHarness();
 await cloud.init();
 assert.equal(cloud.connected(),true);
 const state={
  role:'almacen',
  loads:[{id:'movimiento-offline-1',vehicle:'camion',index:0,amount:100,merma:0,at:'2026-10-24T00:00:00Z'}],
  manager:{},visits:[]
 };
 failOnce();
 await assert.rejects(()=>cloud.save(state),/IDB cuota/);
 assert.equal(cloud.count(),0,'una transacción fallida no puede confirmar captura en RAM');
 assert.equal(disk.size,0,'ninguno de los dos registros de IDB debe quedar a medias');
 await cloud.save(state);
 assert.equal(cloud.count(),1,'la operación debe recapturarse');
 const meta=disk.get('tanques-staging-meta:test-id');
 assert.ok(meta.pending['movement:movimiento-offline-1']);
 assert.equal(meta.pending['movement:movimiento-offline-1'].base,0);
 assert.ok(disk.has('tanques-staging:test-id:almacen'));
});
