'use strict';
/**
 * Regresión: una descarga abierta de Reparto no debe bloquear «Nueva carga» a Gerencia ni a Almacén.
 * Datos ficticios + Supabase simulado. No contacta el proyecto real.
 */
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const http=require('http');
const fs=require('fs');
const path=require('path');

const ORIGIN='http://127.0.0.1:8767';
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
 await new Promise(r=>server.listen(8767,'127.0.0.1',r));
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

 // Existencias iniciales (Gerencia)
 const ger=await openDevice('gerencia');
 await ger.page.locator('[data-act=go-gerencia]').first().click();
 await ger.page.locator('#openingCisterna').fill('23000');
 for(const [i,v] of [[0,'200'],[1,'100'],[2,'0']])await ger.page.locator('#openingCamion'+i).fill(v);
 await ger.page.locator('#openingFurgoneta').fill('50');
 await ger.page.locator('#openingForm button').click();
 await waitSynced(ger.page);

 // Reparto abre una descarga en su camión y la deja abierta
 const rep=await openDevice('reparto');
 await rep.page.waitForFunction(()=>state.tanks.camion[0]===200);
 await rep.page.locator('[data-act=go-visita]').click();
 await rep.page.locator('#extraClient').fill('Bar Ficticio');
 await rep.page.locator('#extraVisitForm button').click();
 await rep.page.locator('#destTank').selectOption('1');
 await rep.page.locator('#reading').fill('30');
 await rep.page.locator('#dischargeForm button[type=submit]').click();
 await waitSynced(rep.page);
 assert.equal(await rep.page.evaluate(()=>state.openVisit?.vehicle),'camion');
 // Reparto sí queda bloqueado para su propio vehículo
 assert.equal(await rep.page.evaluate(()=>TankRoles.openVisitBlocksLoad(state)),true);
 console.log('OK  Reparto: su descarga abierta bloquea la carga de su vehículo');

 // Gerencia recibe la visita abierta del conductor y aun así puede cargar
 await ger.page.locator('[data-page=inicio]').click();
 await ger.page.locator('#cloudForce').click();
 // Recibe la visita abierta del conductor, pero no la toma como propia (solo continúa las suyas).
 await ger.page.waitForFunction(()=>Object.values(TankCloud.meta().rows).some(r=>r.kind==='visit'&&!r.payload.ended&&r.vehicle==='camion'));
 assert.equal(await ger.page.evaluate(()=>state.openVisit),null);
 await ger.page.evaluate(()=>navigate('carga'));
 assert.equal(await ger.page.evaluate(()=>state.page),'carga','Gerencia debe entrar en Nueva carga');
 assert.notEqual(await toastText(ger.page),'Finaliza primero la visita en curso');
 await ger.page.locator('#loadVehicle').selectOption('furgoneta');
 assert.equal(await ger.page.evaluate(()=>el('loadVehicle').value),'furgoneta','Gerencia puede elegir otro vehículo');
 console.log('OK  Gerencia: entra en Nueva carga y elige vehículo con una descarga de Reparto abierta');

 // Almacén tampoco queda bloqueado
 const alm=await openDevice('almacen');
 await alm.page.locator('[data-act=go-carga]').click();
 assert.equal(await alm.page.evaluate(()=>state.page),'carga');
 await alm.page.locator('#loadVehicle').selectOption('camion');
 await alm.page.locator('#loadLiters').fill('40');
 await alm.page.locator('#loadForm button[type=submit]').click();
 await waitSynced(alm.page);
 assert.equal(await alm.page.evaluate(()=>state.tanks.camion[0]),210);
 console.log('OK  Almacén: carga el camión con la descarga de Reparto abierta');

 await browser.close();server.close();
 assert.deepEqual(pageErrors,[],'sin errores de página');
 console.log('PASS browser-carga-visita');
 process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
