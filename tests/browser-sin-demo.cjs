'use strict';
/**
 * Producción sin restos de demo: con sesión iniciada, ninguna pantalla de ningún perfil muestra textos de demostración.
 * Datos ficticios + Supabase simulado. No contacta el proyecto real.
 */
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const http=require('http');
const fs=require('fs');
const path=require('path');

const ORIGIN='http://127.0.0.1:8770';
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

// «jornada» no se incluye: solo se abre desde la configuración de demostración, nunca con sesión iniciada.
const PAGES=['inicio','carga','visita','historial','admin','gerencia','clientes','planificacion','informes'];
const DEMO=/ficticia|ficticio|demostraci[oó]n|\bDEMO\b|de prueba|\(demo\)|prototipo/i;

(async()=>{
 const root=path.join(__dirname,'..');
 const server=http.createServer((req,res)=>{
  const u=decodeURIComponent((req.url||'/').split('?')[0]);const file=path.join(root,u==='/'?'/index.html':u);
  try{res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.html')?'text/html':file.endsWith('.css')?'text/css':'application/octet-stream');res.setHeader('Cache-Control','no-store');res.end(fs.readFileSync(file));}
  catch{res.statusCode=404;res.end();}
 });
 await new Promise(r=>server.listen(8770,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'/usr/local/bin/google-chrome',args:['--no-sandbox','--disable-dev-shm-usage']});
 const pageErrors=[],dialogs=[];
 const ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true});
 await ctx.route('https://oevetnszmfxeukcncwji.supabase.co/**',mock);
 const page=await ctx.newPage();page.setDefaultTimeout(25000);
 page.on('pageerror',e=>pageErrors.push(e.message));page.on('dialog',d=>{dialogs.push(d.message()+' | '+(d.defaultValue()||''));d.accept();});
 await page.goto(ORIGIN);
 await page.locator('[data-cloud=settings]').first().click();
 await page.locator('#cloudEmail').fill(USER.email);
 await page.locator('#cloudPassword').fill('TestPassword123!');
 await page.locator('#cloudLoginForm button').click();
 await page.waitForFunction(()=>TankCloud.member()?.active);
 const scan=()=>page.evaluate(src=>{
  const re=new RegExp(src,'i'),found=[];
  for(const m of document.body.innerText.matchAll(new RegExp('.{0,40}(?:'+src+').{0,40}','gi')))found.push('texto: '+m[0]);
  for(const e of document.querySelectorAll('[aria-label],[title],[placeholder],[alt]'))
   for(const a of ['aria-label','title','placeholder','alt']){const v=e.getAttribute(a);if(v&&re.test(v))found.push(a+': '+v);}
  const d=document.querySelector('meta[name=description]')?.content||'';if(re.test(d))found.push('meta description: '+d);
  return found;
 },DEMO.source);
 const report={};
 for(const role of ['gerencia','almacen','reparto']){
  await page.evaluate(r=>document.querySelector(`[data-profile=${r}]`)?.click(),role);
  await page.waitForFunction(r=>state.role===r,role);
  for(const p of PAGES){
   await page.evaluate(p=>{state.page=p;render();},p);
   await page.waitForTimeout(40);
   const f=await scan();if(f.length)report[role+'/'+p]=[...new Set(f)];
  }
 }
 // Aviso al cerrar una visita: texto de producción, sin «ficticia» ni dobles espacios
 const src=fs.readFileSync(path.join(root,'app.js'),'utf8');
 if(src.includes("toast('Visita ficticia guardada')"))report['aviso visita guardada']=['app.js conserva «Visita ficticia guardada»'];
 await browser.close();server.close();
 console.log(JSON.stringify(report,null,1));
 assert.deepEqual(pageErrors,[],'sin errores de página');
 assert.deepEqual(report,{},'restos de demostración visibles con sesión iniciada');
 console.log('PASS browser-sin-demo');
 process.exit(0);
})().catch(e=>{console.error(e.message.slice(0,4000));process.exit(1);});
