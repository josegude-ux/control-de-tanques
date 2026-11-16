'use strict';
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),http=require('node:http'),path=require('node:path');
(async()=>{
 const root=path.join(__dirname,'..');
 const server=http.createServer((req,res)=>{const pathname=decodeURIComponent(req.url.split('?')[0]);const file=path.join(root,pathname==='/'?'/index.html':pathname);if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return}try{res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.html')?'text/html':file.endsWith('.css')?'text/css':'application/octet-stream');res.end(fs.readFileSync(file))}catch{res.writeHead(404).end()}});
 await new Promise(ok=>server.listen(8767,'127.0.0.1',ok));
 const browser=await chromium.launch({headless:true});
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true});
 const page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto('http://127.0.0.1:8767');
  await page.waitForFunction(()=>typeof tankR5Open==='function'&&typeof state!=='undefined');
  await page.evaluate(()=>{
   TankCloud.connected=()=>true;TankCloud.member=()=>({active:true,role:state.role});TankCloud.decorate=()=>{};
   state.role='almacen';state.page='inicio';state.vehicle='camion';state.cloudStockReady=true;state.cloudStockProblems=[];
   state.tanks.camion=[960,0];state.tanks.furgoneta=[500];render();
  });
  const before=await page.evaluate(()=>JSON.stringify(state.tanks));
  await page.getByRole('button',{name:'Ver detalle del tanque 1'}).click();
  assert(await page.getByRole('heading',{name:'Tanque 1'}).count());
  assert.match(await page.locator('#screen').innerText(),/960 L/);
  assert.equal(await page.locator('.tank-r5-detail [role="progressbar"]').getAttribute('aria-valuenow'),'96');
  await page.goBack();
  assert(await page.getByRole('button',{name:'Ver detalle del tanque 1'}).count());
  assert.equal(await page.evaluate(()=>JSON.stringify(state.tanks)),before);
  await page.getByRole('button',{name:'Ver detalle del tanque 2'}).click();
  assert(await page.getByRole('heading',{name:'Tanque 2'}).count());
  await page.getByRole('button',{name:'Volver a tanques'}).click();
  assert(await page.getByRole('button',{name:'Ver detalle del tanque 1'}).count());
  await page.evaluate(()=>{state.cloudStockReady=false;render()});
  await page.getByRole('button',{name:'Ver detalle del tanque 1'}).click();
  assert.match(await page.locator('#screen').innerText(),/Sin datos validados/);
  assert.equal(await page.locator('.tank-r5-detail [role="progressbar"]').count(),0);
  await page.evaluate(()=>{state.role='reparto';render()});
  assert.equal(await page.locator('.tank-r5-detail').count(),0);
  assert.equal(await page.evaluate(()=>JSON.stringify(state.tanks)),before);
  await page.reload();
  await page.waitForFunction(()=>typeof tankDetailSelectionR5!=='undefined');
  assert.equal(await page.locator('.tank-r5-detail').count(),0);
  assert.deepEqual(errors,[]);
  console.log('PASS browser R5: open, Back, close, role change, invalid stock, reload, no stock writes');
 }finally{await browser.close();await new Promise(ok=>server.close(ok))}
})().catch(e=>{console.error(e);process.exitCode=1});
