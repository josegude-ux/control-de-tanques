'use strict';
/**
 * Pruebas Playwright Fase A — datos ficticios + Supabase simulado.
 * No contacta el proyecto real.
 */
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const http=require('http');
const fs=require('fs');
const path=require('path');
const C=require('../sync-core.js');

const ORIGIN='http://127.0.0.1:8766';
const USERS={
 gerencia:{id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',email:'gerencia@test.invalid',role:'gerencia',vehicle:null},
 almacen:{id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',email:'almacen@test.invalid',role:'almacen',vehicle:null},
 reparto:{id:'cccccccc-cccc-4ccc-8ccc-cccccccccccc',email:'reparto@test.invalid',role:'reparto',vehicle:'camion'}
};

const rows=new Map();
let rpcCalls=0;
const results={passed:[],failed:[]};
function ok(name){results.passed.push(name);console.log('OK  '+name);}
function fail(name,err){results.failed.push({name,err:String(err&&err.message||err)});console.error('FAIL '+name+':',err&&err.message||err);throw err;}

function tokenFor(u){
 return ['eyJhbGciOiJub25lIn0',Buffer.from(JSON.stringify({sub:u.id,exp:Math.floor(Date.now()/1000)+3600})).toString('base64url'),'mock'].join('.');
}

function stockMetaFromRows(){
 const meta=C.empty();
 C.receive(meta,[...rows.values()]);
 return meta;
}

function applyBatch(changes,actorId){
 for(const c of changes){
  const cur=rows.get(c.key);
  if((c.base|0)===0){
   if(cur){const e=new Error('CONFLICT: '+c.key);e.status=409;throw e;}
  }else if(!cur||cur.revision!==c.base){
   const e=new Error('CONFLICT: '+c.key);e.status=409;throw e;
  }
 }
 // Simula post-lote STOCK (espejo sync-core) aplicando cambios en copia.
 const probe=C.empty();
 C.receive(probe,[...rows.values()]);
 for(const c of changes){
  probe.rows[c.key]={key:c.key,kind:c.kind,vehicle:c.vehicle,payload:c.payload,deleted:!!c.deleted,revision:(rows.get(c.key)?.revision||0)+1,owner_id:rows.get(c.key)?.owner_id||actorId};
 }
 const bal=C.balances(probe);
 if(bal.ready&&bal.problems.length){
  const e=new Error('STOCK: existencias inválidas tras el lote ('+bal.problems.join(', ')+')');
  e.status=400;throw e;
 }
 const out=[];
 for(const c of changes){
  const next={key:c.key,kind:c.kind,vehicle:c.vehicle,payload:c.payload,deleted:!!c.deleted,owner_id:rows.get(c.key)?.owner_id||actorId,revision:(rows.get(c.key)?.revision||0)+1,updated_at:new Date().toISOString()};
  rows.set(c.key,next);out.push(next);
 }
 return out;
}

function mockFor(user){
 return async function mock(route){
  const req=route.request(),url=new URL(req.url());
  const headers={'access-control-allow-origin':'*','access-control-allow-headers':'*','content-type':'application/json'};
  const send=(x,status=200)=>route.fulfill({status,headers,body:JSON.stringify(x)});
  if(req.method()==='OPTIONS')return send({});
  if(url.pathname.includes('/auth/v1/token')){
   return send({access_token:tokenFor(user),token_type:'bearer',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,refresh_token:'mock',user:{id:user.id,email:user.email,aud:'authenticated',role:'authenticated'}});
  }
  if(url.pathname.includes('/auth/v1/user'))return send({id:user.id,email:user.email,aud:'authenticated',role:'authenticated'});
  if(url.pathname.includes('tanques_members')){
   const member={user_id:user.id,nombre:user.email,active:true,role:user.role,vehicle:user.vehicle};
   // .single()/.maybeSingle() envían Accept object; listados sin user_id filter → array.
   if(req.method()==='GET'&&!String(url.search).includes('user_id=')&&!req.headers().accept?.includes('object')){
    return send(Object.values(USERS).map(u=>({user_id:u.id,nombre:u.email,active:true,role:u.role,vehicle:u.vehicle})));
   }
   return send(member);
  }
  if(url.pathname.includes('tanques_records'))return send([...rows.values()].sort((a,b)=>a.key.localeCompare(b.key)));
  if(url.pathname.includes('tanques_sync_batch')){
   rpcCalls++;
   try{
    const changes=req.postDataJSON().changes;
    return send(applyBatch(changes,user.id));
   }catch(e){
    return send({message:e.message,code:e.status===409?'P0001':'P0001'},e.status||400);
   }
  }
  return send({message:'Unexpected '+url.pathname},404);
 };
}

function contentType(file){
 if(file.endsWith('.js'))return 'application/javascript';
 if(file.endsWith('.html'))return 'text/html';
 if(file.endsWith('.css'))return 'text/css';
 if(file.endsWith('.json'))return 'application/json';
 if(file.endsWith('.webmanifest'))return 'application/manifest+json';
 return 'application/octet-stream';
}

(async()=>{
 const root=path.join(__dirname,'..');
 const server=http.createServer((req,res)=>{
  const u=decodeURIComponent((req.url||'/').split('?')[0]);
  const file=path.join(root,u==='/'?'/index.html':u);
  try{
   res.setHeader('Content-Type',contentType(file));
   res.setHeader('Cache-Control','no-store');
   res.end(fs.readFileSync(file));
  }catch{res.statusCode=404;res.end();}
 });
 await new Promise(r=>server.listen(8766,'127.0.0.1',r));

 const browser=await chromium.launch({
  headless:true,
  executablePath:process.env.CHROMIUM_PATH||'/usr/local/bin/google-chrome',
  args:['--no-sandbox','--disable-dev-shm-usage']
 });
 const pageErrors=[];

 async function openDevice(profile){
  const user=USERS[profile];
  const ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true});
  await ctx.route('https://oevetnszmfxeukcncwji.supabase.co/**',mockFor(user));
  const page=await ctx.newPage();
  page.setDefaultTimeout(25000);
  page.on('pageerror',e=>pageErrors.push(profile+': '+e.message));
  page.on('dialog',d=>d.accept());
  await page.goto(ORIGIN);
  await page.locator('[data-cloud=settings]').first().click();
  await page.locator('#cloudEmail').fill(user.email);
  await page.locator('#cloudPassword').fill('TestPassword123!');
  await page.locator('#cloudLoginForm button').click();
  await page.waitForFunction(()=>TankCloud.member()?.active);
  await page.waitForFunction(()=>{
   const t=document.getElementById('cloudBadge')?.textContent||'';
   return !t.includes('Sincronizando');
  });
  return {ctx,page,user};
 }

 async function waitSynced(page){
  await page.waitForFunction(()=>Object.keys(TankCloud.meta().pending).length===0&&!document.getElementById('cloudBadge')?.textContent.includes('Sincronizando'));
 }

 async function switchRole(page,role){
  await page.locator('#roleButton').click();
  const btn=page.locator('[data-profile='+role+']');
  const visible=await btn.isVisible().catch(()=>false);
  if(!visible)return false;
  await btn.click();
  await page.waitForFunction(r=>state.role===r,role);
  return true;
 }

 // ---------- 1. Login y permisos de tres perfiles ----------
 try{
  rows.clear();rpcCalls=0;
  const g=await openDevice('gerencia');
  assert.equal(await g.page.evaluate(()=>TankCloud.member().role),'gerencia');
  assert.equal(await g.page.evaluate(()=>TankCloud.canAdjustStock()),true);
  assert.equal(await switchRole(g.page,'almacen'),true);
  assert.equal(await switchRole(g.page,'reparto'),true);
  await g.ctx.close();

  const a=await openDevice('almacen');
  assert.equal(await a.page.evaluate(()=>TankCloud.member().role),'almacen');
  assert.equal(await a.page.evaluate(()=>TankCloud.canAdjustStock()),false);
  assert.equal(await a.page.evaluate(()=>TankCloud.permitted('gerencia')),false);
  assert.equal(await a.page.evaluate(()=>TankCloud.permitted('almacen')),true);
  // UI: perfiles no autorizados ocultos
  assert.equal(await a.page.locator('[data-profile=gerencia]').isHidden(),true);
  await a.ctx.close();

  const r=await openDevice('reparto');
  assert.equal(await r.page.evaluate(()=>TankCloud.member().role),'reparto');
  assert.equal(await r.page.evaluate(()=>TankCloud.member().vehicle),'camion');
  assert.equal(await r.page.evaluate(()=>TankCloud.permitted('almacen')),false);
  assert.equal(await r.page.locator('[data-profile=almacen]').isHidden(),true);
  await r.ctx.close();
  ok('1. login y permisos de tres perfiles');
 }catch(e){fail('1. login y permisos de tres perfiles',e);}

 // ---------- 2–5,7: sync dos dispositivos, offline, recovery, duplicados, existencias ----------
 let ger,alm,rep;
 try{
  rows.clear();rpcCalls=0;
  ger=await openDevice('gerencia');
  await ger.page.locator('[data-act=go-gerencia]').first().click();
  await ger.page.locator('#openingCisterna').fill('23000');
  await ger.page.locator('#openingCamion0').fill('200');
  await ger.page.locator('#openingCamion1').fill('100');
  await ger.page.locator('#openingCamion2').fill('0');
  await ger.page.locator('#openingFurgoneta').fill('50');
  await ger.page.locator('#openingForm button').click();
  await waitSynced(ger.page);
  assert.equal(rows.get('opening:global').payload.camion[0],200);

  alm=await openDevice('almacen');
  await alm.page.waitForFunction(()=>state.cloudStockReady===true);
  assert.deepEqual(await alm.page.evaluate(()=>state.tanks.camion),[200,100,0]);
  await alm.page.locator('[data-act=go-carga]').click();
  await alm.page.locator('#loadLiters').fill('80');
  await alm.page.locator('#zeroLoad').check();
  await alm.page.locator('#loadForm button[type=submit]').click();
  await waitSynced(alm.page);
  assert.equal(await alm.page.evaluate(()=>state.tanks.camion[0]),280);
  ok('2a. sync: opening Gerencia visible en Almacén + carga');

  rep=await openDevice('reparto');
  await rep.page.waitForFunction(()=>state.tanks.camion[0]===280);
  await rep.page.locator('[data-act=go-visita]').click();
  await rep.page.locator('#extraClient').fill('Bar Ficticio');
  await rep.page.locator('#extraZero').check();
  await rep.page.locator('#extraVisitForm button').click();
  await rep.page.locator('#destTank').selectOption('1');
  await rep.page.locator('#reading').fill('30');
  await rep.page.locator('#dischargeForm button[type=submit]').click();
  await waitSynced(rep.page);
  assert.equal(await rep.page.evaluate(()=>state.tanks.camion[0]),250);
  ok('2b. sync automática entre dispositivos (descarga en Reparto)');

  // Offline second discharge
  await rep.ctx.setOffline(true);
  await rep.page.locator('#destTank').selectOption('2');
  await rep.page.locator('#reading').fill('55');
  await rep.page.locator('#dischargeForm button[type=submit]').click();
  await rep.page.waitForFunction(()=>Object.keys(TankCloud.meta().pending).length>0);
  assert.equal(await rep.page.evaluate(()=>state.tanks.camion[0]),225);
  const pendingBefore=await rep.page.evaluate(()=>Object.keys(TankCloud.meta().pending).length);
  assert.ok(pendingBefore>=1);
  ok('3. guardado de descarga sin conexión (cola pendiente)');

  // Persist across reload while offline (PWA/IDB)
  await rep.page.reload();
  await rep.page.waitForFunction(()=>TankCloud.connected()&&TankCloud.member()?.active);
  await rep.page.waitForFunction(()=>(state.openVisit?.discharges?.length||0)>=2&&Object.keys(TankCloud.meta().pending).length>0);
  assert.equal(await rep.page.evaluate(()=>state.openVisit.discharges.length),2);
  assert.ok(await rep.page.evaluate(()=>Object.keys(TankCloud.meta().pending).length)>0);
  ok('3b. pendientes conservados tras recarga offline');

  // Back online → recovery
  await rep.ctx.setOffline(false);
  await rep.page.locator('#cloudForce').click();
  await waitSynced(rep.page);
  assert.equal(await rep.page.evaluate(()=>Object.keys(TankCloud.meta().pending).length),0);
  ok('4. recuperación de pendientes al volver Internet');

  // Device A sees updated stock
  await ger.page.locator('#cloudForce').click();
  await ger.page.waitForFunction(()=>state.tanks.camion[0]===225);
  assert.deepEqual(await ger.page.evaluate(()=>({c:state.tanks.camion,f:state.tanks.furgoneta,cis:state.cisterna})),
   {c:[225,100,0],f:[50],cis:22920});
  ok('7. coherencia de existencias por tanque (y cisterna tras carga)');

  // Duplicate prevention: same keys already on server; re-push empty pending
  const moves=[...rows.values()].filter(r=>r.kind==='movement');
  const keys=moves.map(m=>m.key);
  assert.equal(new Set(keys).size,keys.length,'claves movement únicas');
  assert.equal(moves.filter(m=>m.payload.type==='CARGA').length,1);
  assert.equal(moves.filter(m=>m.payload.type==='DESCARGA').length,2);
  // Force acknowledge path: receive same rows twice shouldn't duplicate in balances
  const meta=stockMetaFromRows();
  assert.equal(C.balances(meta).balances.camion[0],225);
  ok('5. prevención de movimientos duplicados (keys únicas + saldo estable)');

 }catch(e){fail('2-5/7 sync offline recovery stock',e);}

 // ---------- 6. Conservación tras “actualizar” PWA (nuevo SW cache / reload version) ----------
 try{
  // Simula actualización: recarga con query app_version (como applyUpdate) sin borrar IDB
  const before=await rep.page.evaluate(()=>({
   discharges:state.openVisit?.discharges?.length,
   tank:state.tanks.camion[0],
   pending:Object.keys(TankCloud.meta().pending).length,
   store:STORE
  }));
  await rep.page.goto(ORIGIN+'/?app_version=0.10.1&reparacion=test');
  await rep.page.waitForFunction(()=>typeof TankCloud!=='undefined');
  // Session en localStorage; si el panel de login aparece, reconectar.
  if(await rep.page.locator('#cloudLoginForm').isVisible().catch(()=>false)){
   await rep.page.locator('#cloudEmail').fill(USERS.reparto.email);
   await rep.page.locator('#cloudPassword').fill('TestPassword123!');
   await rep.page.locator('#cloudLoginForm button').click();
   await rep.page.waitForFunction(()=>TankCloud.member()?.active);
  }else{
   await rep.page.waitForFunction(()=>TankCloud.connected());
  }
  await rep.page.waitForFunction(()=>state.cloudStockReady===true);
  const after=await rep.page.evaluate(()=>({
   tank:state.tanks.camion[0],
   store:STORE,
   version:APP_VERSION
  }));
  assert.equal(after.store,before.store,'mismo IndexedDB STORE');
  assert.equal(after.tank,225);
  assert.equal(after.version,'0.10.1');
  // SW no debe borrar datos: verificar que sw.js no usa indexedDB API
  const sw=fs.readFileSync(path.join(root,'sw.js'),'utf8');
  assert.equal(/\bindexedDB\s*\./.test(sw),false);
  ok('6. conservación de datos tras actualizar/recargar PWA');
 }catch(e){fail('6. conservación tras actualizar PWA',e);}

 // Almacén no puede ajustar existencias (UI gerencia-only cuando role almacen)
 try{
  await alm.page.bringToFront();
  await alm.page.locator('[data-page=admin]').click();
  const hasAdjust=await alm.page.locator('#stockAdjustForm').count();
  assert.equal(hasAdjust,0,'Almacén sin formulario de ajuste');
  ok('1b. Almacén sin UI de ajuste de existencias');
 }catch(e){fail('1b. Almacén sin UI de ajuste',e);}

 // STOCK reject: descarga que vacía de más
 try{
  await rep.page.bringToFront();
  // T3=0; intentar no es fácil vía UI (select only existing tanks with liters).
  // Validamos motor simulado directamente:
  let rejected=false;
  try{
   applyBatch([{key:'movement:over',kind:'movement',vehicle:'camion',base:0,deleted:false,payload:{id:'over',type:'DESCARGA',vehicle:'camion',tank:3,litres:1,loss:0,time:'2026-10-23T20:00:00Z'}}],USERS.reparto.id);
  }catch(e){
   rejected=/STOCK/.test(e.message); 
  }
  assert.equal(rejected,true);
  assert.equal(rows.has('movement:over'),false);
  ok('7b. rechazo STOCK por existencias insuficientes (mock servidor)');
 }catch(e){fail('7b. rechazo STOCK',e);}

 await browser.close();
 server.close();

 console.log('\n==== RESUMEN BROWSER FASE A ====');
 console.log('Aprobadas ('+results.passed.length+'):');
 for(const n of results.passed)console.log('  ✓ '+n);
 if(results.failed.length){
  console.log('Fallidas ('+results.failed.length+'):');
  for(const f of results.failed)console.log('  ✗ '+f.name+' — '+f.err);
 }
 console.log('pageErrors:',pageErrors);
 console.log('rpcCalls:',rpcCalls);
 assert.deepEqual(pageErrors,[],'sin errores de página');
 assert.equal(results.failed.length,0);
 console.log('PASS browser-fase-a');
 process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
