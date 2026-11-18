'use strict';
/**
 * Operaciones (rol interno gerencia): acceso completo a Carga y Descarga e informe PDF diario por vehículo.
 * Datos ficticios + Supabase simulado. No contacta el proyecto real.
 */
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const http=require('http');
const fs=require('fs');
const path=require('path');

const ORIGIN='http://127.0.0.1:8769';
const USERS={
 gerencia:{id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',email:'gerencia@test.invalid',role:'gerencia',vehicle:null},
 almacen:{id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',email:'almacen@test.invalid',role:'almacen',vehicle:null},
 reparto:{id:'cccccccc-cccc-4ccc-8ccc-cccccccccccc',email:'reparto@test.invalid',role:'reparto',vehicle:'camion'}
};
const rows=new Map();
const tokenFor=u=>['eyJhbGciOiJub25lIn0',Buffer.from(JSON.stringify({sub:u.id,exp:Math.floor(Date.now()/1000)+3600})).toString('base64url'),'mock'].join('.');

function mockFor(user){
 return async route=>{
  const req=route.request(),url=new URL(req.url());
  const headers={'access-control-allow-origin':'*','access-control-allow-headers':'*','content-type':'application/json'};
  const send=(x,status=200)=>route.fulfill({status,headers,body:JSON.stringify(x)});
  const authUser={id:user.id,email:user.email,aud:'authenticated',role:'authenticated'};
  if(req.method()==='OPTIONS')return send({});
  if(url.pathname.includes('/auth/v1/token'))return send({access_token:tokenFor(user),token_type:'bearer',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,refresh_token:'mock',user:authUser});
  if(url.pathname.includes('/auth/v1/user'))return send(authUser);
  if(url.pathname.includes('tanques_members')){
   if(req.method()==='GET'&&!String(url.search).includes('user_id=')&&!req.headers().accept?.includes('object'))
    return send(Object.values(USERS).map(u=>({user_id:u.id,nombre:u.email,active:true,role:u.role,vehicle:u.vehicle})));
   return send({user_id:user.id,nombre:user.email,active:true,role:user.role,vehicle:user.vehicle});
  }
  if(url.pathname.includes('tanques_records'))return send([...rows.values()].sort((a,b)=>a.key.localeCompare(b.key)));
  if(url.pathname.includes('tanques_sync_batch')){
   const out=[];
   for(const c of req.postDataJSON().changes){
    const cur=rows.get(c.key);
    if((cur?.revision||0)!==(c.base|0))return send({message:'CONFLICT: '+c.key,code:'P0001'},409);
    const next={key:c.key,kind:c.kind,vehicle:c.vehicle,payload:c.payload,deleted:!!c.deleted,owner_id:cur?.owner_id||user.id,revision:(cur?.revision||0)+1,updated_at:new Date().toISOString()};
    rows.set(c.key,next);out.push(next);
   }
   return send(out);
  }
  return send({message:'Unexpected '+url.pathname},404);
 };
}

(async()=>{
 const root=path.join(__dirname,'..');
 const server=http.createServer((req,res)=>{
  const u=decodeURIComponent((req.url||'/').split('?')[0]);const file=path.join(root,u==='/'?'/index.html':u);
  try{res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.html')?'text/html':file.endsWith('.css')?'text/css':'application/octet-stream');res.setHeader('Cache-Control','no-store');res.end(fs.readFileSync(file));}
  catch{res.statusCode=404;res.end();}
 });
 await new Promise(r=>server.listen(8769,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'/usr/local/bin/google-chrome',args:['--no-sandbox','--disable-dev-shm-usage']});
 const pageErrors=[];
 async function openDevice(profile){
  const user=USERS[profile];
  const ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true});
  await ctx.route('https://oevetnszmfxeukcncwji.supabase.co/**',mockFor(user));
  const page=await ctx.newPage();page.setDefaultTimeout(25000);
  page.on('pageerror',e=>pageErrors.push(profile+': '+e.message));page.on('dialog',d=>d.accept());
  await page.goto(ORIGIN);
  await page.locator('[data-cloud=settings]').first().click();
  await page.locator('#cloudEmail').fill(user.email);
  await page.locator('#cloudPassword').fill('TestPassword123!');
  await page.locator('#cloudLoginForm button').click();
  await page.waitForFunction(()=>TankCloud.member()?.active);
  await page.waitForFunction(()=>!(document.getElementById('cloudBadge')?.textContent||'').includes('Sincronizando'));
  return {ctx,page};
 }
 const waitSynced=page=>page.waitForFunction(()=>Object.keys(TankCloud.meta().pending).length===0&&!document.getElementById('cloudBadge')?.textContent.includes('Sincronizando'));
 const toastText=page=>page.evaluate(()=>document.getElementById('toast').style.display==='block'?document.getElementById('toast').textContent:'');


 // Existencias iniciales (Operaciones)
 const ops=await openDevice('gerencia');
 await ops.page.locator('[data-act=go-gerencia]').first().click();
 await ops.page.locator('#openingCisterna').fill('23000');
 for(const [i,v] of [[0,'200'],[1,'100'],[2,'0']])await ops.page.locator('#openingCamion'+i).fill(v);
 await ops.page.locator('#openingFurgoneta').fill('50');
 await ops.page.locator('#openingForm button').click();
 await waitSynced(ops.page);

 // Un conductor deja una descarga abierta en el camión
 const rep=await openDevice('reparto');
 await rep.page.waitForFunction(()=>state.tanks.camion[0]===200);
 await rep.page.locator('[data-act=go-visita]').click();
 await rep.page.locator('#extraClient').fill('Bar del Conductor');
 await rep.page.locator('#extraVisitForm button').click();
 await rep.page.locator('#destTank').selectOption('1');
 await rep.page.locator('#reading').fill('30');
 await rep.page.locator('#dischargeForm button[type=submit]').click();
 await waitSynced(rep.page);

 // Operaciones: ve Carga y Descarga, y no hereda la descarga del conductor
 await ops.page.locator('[data-page=inicio]').click();
 await ops.page.locator('#cloudForce').click();await waitSynced(ops.page);
 await ops.page.waitForFunction(()=>state.tanks.camion[0]===170);
 assert.equal(await ops.page.evaluate(()=>state.openVisit),null,'no toma como propia la descarga del conductor');
 for(const p of ['carga','visita'])assert.equal(await ops.page.locator(`nav [data-page=${p}]`).isHidden(),false,'botón '+p+' visible');
 assert.equal(await ops.page.locator('[data-act=go-carga]').count()>0,true);
 assert.equal(await ops.page.locator('[data-act=go-visita]').count()>0,true);
 console.log('OK  Operaciones: Carga y Descarga visibles; no hereda la descarga abierta de otro conductor');

 // Nueva carga
 await ops.page.locator('[data-act=go-carga]').first().click();
 await ops.page.locator('#loadVehicle').selectOption('camion');
 await ops.page.locator('#loadLiters').fill('40');
 await ops.page.locator('#loadForm button[type=submit]').click();
 await ops.page.waitForFunction(()=>Object.values(TankCloud.meta().rows).some(r=>r.payload?.type==='CARGA'&&r.payload.litres===40));
 await waitSynced(ops.page);
 const opsLoad=[...rows.values()].find(r=>r.kind==='movement'&&r.payload.type==='CARGA'&&r.owner_id===USERS.gerencia.id);
 assert.ok(opsLoad,'la carga de Operaciones llega al servidor');assert.equal(opsLoad.payload.litres,40);
 assert.equal(await ops.page.evaluate(()=>state.tanks.camion[0]),210);
 console.log('OK  Operaciones: carga sincronizada (40 L, camión T1)');

 // Nueva descarga completa
 await ops.page.locator('[data-page=visita]').click();
 await ops.page.locator('#vehicle').selectOption('camion');
 await ops.page.locator('#extraClient').fill('Bar de Operaciones');
 await ops.page.locator('#extraVisitForm button').click();
 await ops.page.locator('#destTank').selectOption('1');
 await ops.page.locator('#reading').fill('20');
 await ops.page.locator('#dischargeForm button[type=submit]').click();
 await ops.page.locator('[data-act=finish-visit]').click();
 await ops.page.waitForFunction(()=>!state.openVisit);
 await ops.page.waitForFunction(()=>Object.values(TankCloud.meta().rows).some(r=>r.kind==='visit'&&r.payload?.ended&&r.payload.client==='Bar de Operaciones'));
 await waitSynced(ops.page);
 const opsVisit=[...rows.values()].find(r=>r.kind==='visit'&&r.owner_id===USERS.gerencia.id);
 assert.ok(opsVisit?.payload.ended,'visita de Operaciones cerrada en servidor');
 const opsDis=[...rows.values()].find(r=>r.kind==='movement'&&r.payload.type==='DESCARGA'&&r.owner_id===USERS.gerencia.id);
 assert.equal(opsDis?.payload.litres,20);
 assert.equal(await ops.page.evaluate(()=>state.tanks.camion[0]),190);
 const driverVisit=[...rows.values()].find(r=>r.kind==='visit'&&r.owner_id===USERS.reparto.id);
assert.equal(driverVisit.payload.ended,undefined,'la visita del conductor sigue abierta e intacta');
 assert.equal(driverVisit.payload.discharges.length,1);
 console.log('OK  Operaciones: descarga iniciada, registrada y finalizada; la del conductor intacta');

 // Informe PDF diario del camión
 await ops.page.evaluate(()=>{reportFilters.reportVehicle='camion';reportFilters.reportOperator='';});
 const rep1=await ops.page.evaluate(()=>{const r=currentReport();const v=r.vehicles.find(x=>x.id==='camion');
  const bytes=TankReportPDF.renderReport(r,TankReport);
  return {ids:r.vehicles.map(x=>x.id),loads:v.totals.loads,dis:v.totals.discharges,file:TankReport.fileName(r.date,r.vehicleId),title:r.title,pdf:String.fromCharCode(...bytes.slice(0,5)),size:bytes.length};});
 assert.deepEqual(rep1.ids,['camion']);
 assert.equal(rep1.loads,40);assert.equal(rep1.dis,50);
 assert.match(rep1.file,/^VISURA_TANQUES_MOVIMIENTOS_\d{4}-\d{2}-\d{2}_CAMION\.pdf$/);
 assert.equal(rep1.title,'Informe general — Operaciones');
 assert.equal(rep1.pdf,'%PDF-');assert.ok(rep1.size>1000);
 console.log('OK  Informe PDF diario del camión: 40 L cargados, 50 L descargados ('+rep1.file+')');

 // Almacén ve la carga de Operaciones
 const alm=await openDevice('almacen');
 await alm.page.waitForFunction(()=>state.tanks.camion[0]===190);
 assert.ok(await alm.page.evaluate(id=>state.loads.some(l=>l.id===id),opsLoad.payload.id));
 console.log('OK  Almacén: recibe la carga y las existencias de Operaciones');

 await browser.close();server.close();
 assert.deepEqual(pageErrors,[],'sin errores de página');
 console.log('PASS browser-operaciones-carga-descarga');
 process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
