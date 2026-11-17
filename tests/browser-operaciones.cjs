'use strict';
/**
 * Etiqueta visible «Operaciones»: ninguna pantalla muestra «Gerencia», y el rol interno sigue siendo 'gerencia'.
 * Datos ficticios + Supabase simulado. No contacta el proyecto real.
 */
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const http=require('http');
const fs=require('fs');
const path=require('path');

const ORIGIN='http://127.0.0.1:8768';
const USER={id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',email:'gerencia@test.invalid',role:'gerencia',vehicle:null};
const rows=new Map(),memberPatches=[];
const OTHER={user_id:'dddddddd-dddd-4ddd-8ddd-dddddddddddd',nombre:'Conductor Prueba',active:true,role:'almacen',vehicle:null};
const token=['eyJhbGciOiJub25lIn0',Buffer.from(JSON.stringify({sub:USER.id,exp:Math.floor(Date.now()/1000)+3600})).toString('base64url'),'mock'].join('.');
async function mock(route){
 const req=route.request(),url=new URL(req.url());
 const headers={'access-control-allow-origin':'*','access-control-allow-headers':'*','content-type':'application/json'};
 const send=(x,status=200)=>route.fulfill({status,headers,body:JSON.stringify(x)});
 const authUser={id:USER.id,email:USER.email,aud:'authenticated',role:'authenticated'};
 const member={user_id:USER.id,nombre:'Operaciones Prueba',active:true,role:USER.role,vehicle:null};
 if(req.method()==='OPTIONS')return send({});
 if(url.pathname.includes('/auth/v1/token'))return send({access_token:token,token_type:'bearer',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,refresh_token:'mock',user:authUser});
 if(url.pathname.includes('/auth/v1/user'))return send(authUser);
 if(url.pathname.includes('tanques_members')){
  if(req.method()==='PATCH'){memberPatches.push(req.postDataJSON());return send([]);}
  if(req.headers().accept?.includes('object'))return send(member);
  return send(String(url.search).includes('user_id=')?[member]:[member,OTHER]);
 }
 if(url.pathname.includes('tanques_records'))return send([...rows.values()]);
 if(url.pathname.includes('tanques_sync_batch')){
  const out=req.postDataJSON().changes.map(c=>({...c,deleted:!!c.deleted,owner_id:rows.get(c.key)?.owner_id||USER.id,revision:(rows.get(c.key)?.revision||0)+1,updated_at:new Date().toISOString()}));
  for(const r of out)rows.set(r.key,r);return send(out);
 }
 return send({message:'Unexpected '+url.pathname},404);
}

const PAGES=['inicio','carga','visita','historial','admin','jornada','gerencia','clientes','planificacion','informes'];

(async()=>{
 const root=path.join(__dirname,'..');
 const server=http.createServer((req,res)=>{
  const u=decodeURIComponent((req.url||'/').split('?')[0]);const file=path.join(root,u==='/'?'/index.html':u);
  try{res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.html')?'text/html':file.endsWith('.css')?'text/css':'application/octet-stream');res.setHeader('Cache-Control','no-store');res.end(fs.readFileSync(file));}
  catch{res.statusCode=404;res.end();}
 });
 await new Promise(r=>server.listen(8768,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'/usr/local/bin/google-chrome',args:['--no-sandbox','--disable-dev-shm-usage']});
 const pageErrors=[],dialogs=[];

 // Texto visible + atributos legibles + aviso; sin valores de formularios.
 const leftovers=page=>page.evaluate(async()=>{
  await new Promise(r=>setTimeout(r,50));
  const found=[];
  const text=document.body.innerText;
  for(const m of text.matchAll(/.{0,40}gerencia.{0,40}/gi))found.push('texto: '+m[0]);
  for(const e of document.querySelectorAll('[aria-label],[title],[placeholder],[alt]'))
   for(const a of ['aria-label','title','placeholder','alt']){const v=e.getAttribute(a);if(v&&/gerencia/i.test(v))found.push(a+': '+v);}
  return found;
 });
 async function sweep(page,mode){
  const report={};
  // Menú de perfiles abierto
  await page.locator('#roleButton').click();
  report['menú perfiles']=await leftovers(page)
  assert.equal((await page.locator('[data-profile=gerencia]').textContent()).trim(),'Operaciones');
  await page.keyboard.press('Escape').catch(()=>{});
  await page.evaluate(()=>document.querySelector('[data-profile=gerencia]')?.click());
  await page.waitForFunction(()=>state.role==='gerencia');
  for(const p of PAGES){
   await page.evaluate(p=>{state.page=p;render();},p);
   report[p]=await leftovers(page)
  }
  // Capa visual R9.5 sigue clasificando las pantallas renombradas
  for(const [p,kind] of [['gerencia','balances'],['clientes','customers'],['planificacion','planner']]){
   const got=await page.evaluate(p=>{state.page=p;render();return new Promise(r=>setTimeout(()=>r(document.getElementById('screen').dataset.vr95Page),50));},p);
   assert.equal(got,kind,mode+': R9.5 '+p);
  }
  // Avisos
  await page.evaluate(()=>toast('Solo Gerencia puede editar clientes'));
  assert.equal(await page.evaluate(()=>new Promise(r=>setTimeout(()=>r(document.getElementById('toast').textContent),20))),'Solo Operaciones puede editar clientes');
  const bad=Object.entries(report).filter(([,v])=>v.length);
  assert.deepEqual(bad,[],mode+': quedan textos «Gerencia» visibles');
  // El rol interno no cambia
  assert.equal(await page.evaluate(()=>state.role),'gerencia');
  if(mode==='demo')assert.equal(await page.evaluate(()=>dbGet('active-role-v08')),'gerencia');
  else assert.equal(await page.evaluate(()=>TankCloud.member().role),'gerencia');
  console.log('OK  '+mode+': '+(PAGES.length+1)+' pantallas sin «Gerencia» visible; rol interno gerencia');
 }

 // 1. Modo demostración (sin sesión)
 {
  const ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true});
  await ctx.route('https://oevetnszmfxeukcncwji.supabase.co/**',mock);
  const page=await ctx.newPage();page.setDefaultTimeout(25000);
  page.on('pageerror',e=>pageErrors.push('demo: '+e.message));page.on('dialog',d=>{dialogs.push(d.message());d.accept();});
  await page.goto(ORIGIN);await page.waitForFunction(()=>typeof state!=='undefined'&&state);
  await sweep(page,'demo');
  // Diálogo nativo
  await page.evaluate(()=>confirm('¿Enviar a Gerencia?'));
  assert.equal(dialogs.at(-1),'¿Enviar a Operaciones?');
  console.log('OK  diálogos nativos con la etiqueta vigente');
  await ctx.close();
 }
 // 2. Conectado como gerencia
 {
  const ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true});
  await ctx.route('https://oevetnszmfxeukcncwji.supabase.co/**',mock);
  const page=await ctx.newPage();page.setDefaultTimeout(25000);
  page.on('pageerror',e=>pageErrors.push('cloud: '+e.message));page.on('dialog',d=>d.accept());
  await page.goto(ORIGIN);
  await page.locator('[data-cloud=settings]').first().click();
  await page.locator('#cloudEmail').fill(USER.email);
  await page.locator('#cloudPassword').fill('TestPassword123!');
  await page.locator('#cloudLoginForm button').click();
  await page.waitForFunction(()=>TankCloud.member()?.active);
  assert.equal(await page.evaluate(()=>TankCloud.member().role),'gerencia');
  await sweep(page,'conectado');
  // Gestionar accesos: texto visible con etiqueta, valor guardado con clave interna
  await page.evaluate(()=>{state.page='admin';render();});
  await page.locator('[data-cloud=members]').click();
  const sel='#memberRole-'+OTHER.user_id;
  await page.locator(sel).waitFor();
  const opts=await page.evaluate(s=>[...document.querySelectorAll(s+' option')].map(o=>[o.value,o.textContent]),sel);
  assert.deepEqual(opts,[['pendiente','pendiente'],['gerencia','Operaciones'],['almacen','Almacén'],['reparto','Reparto']]);
  assert.equal(await page.evaluate(s=>document.querySelector(s).value,sel),'almacen');
  await page.locator(sel).selectOption({label:'Operaciones'});
  assert.equal(await page.evaluate(s=>document.querySelector(s).value,sel),'gerencia','se guardaría la clave interna');
  assert.deepEqual(await leftovers(page),[]);
  console.log('OK  Gestionar accesos: muestra Operaciones y conserva el valor gerencia');
  await ctx.close();
 }
 await browser.close();server.close();
 assert.deepEqual(pageErrors,[],'sin errores de página');
 console.log('PASS browser-operaciones');
 process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
