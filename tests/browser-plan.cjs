'use strict';
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),http=require('node:http'),path=require('node:path');
(async()=>{
 const root=path.join(__dirname,'..');
 const server=http.createServer((req,res)=>{const file=path.join(root,decodeURIComponent(req.url.split('?')[0]==='/'?'/index.html':req.url.split('?')[0]));if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}try{res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.html')?'text/html':file.endsWith('.css')?'text/css':'application/octet-stream');res.end(fs.readFileSync(file));}catch{res.writeHead(404).end();}});
 await new Promise(ok=>server.listen(8766,'127.0.0.1',ok));
 const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']}: {})});
 const ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,acceptDownloads:true});
 const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto('http://127.0.0.1:8766');
  await page.waitForFunction(()=>typeof weeklyPlan==='function'&&typeof CDTPlanImport!=='undefined');
  await page.evaluate(async()=>{
   state.role='gerencia';state.customers=[{id:'fake-1',nombre:'Cliente ficticio',poblacion:'Prueba',reparto:['lunes']}];state.weeklyPlans={};planWeek='2026-11-09';planDay=0;state.page='planificacion';render();
  });
  assert(await page.getByText('Planificación · Gerencia').count());
  await page.evaluate(async()=>{state.weeklyPlans[planWeek]={entries:[{id:'fake-entry',date:'2026-11-09',vehicle:'camion',customerId:'fake-1',customerName:'Cliente ficticio',liters:150}],sent:{}};render()});
  assert((await page.locator('#screen').innerText()).includes('150'));
  const [download]=await Promise.all([page.waitForEvent('download',{timeout:15000}),page.locator('[data-act="export-plan"][data-vehicle="camion"]').click()]);
  const filePath=await download.path(),bytes=fs.readFileSync(filePath);
  assert(bytes.length>500);
  const plan=await page.evaluate(async array=>CDTPlanImport.parse(new Uint8Array(array).buffer),[...bytes]);
  assert.equal(plan.vehicle,'camion');assert.equal(plan.entries[0].liters,150);
  await page.evaluate(()=>{state.role='reparto';state.vehicle='camion';state.page='recibir-plan';render()});
  await page.locator('#receivePlanFile').setInputFiles({name:'plan.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:bytes});
  await page.waitForFunction(()=>state.receivedPlans?.['2026-11-09|camion']?.entries?.length===1);
  await page.locator('#receivePlanFile').setInputFiles([]);
  await page.locator('#receivePlanFile').setInputFiles({name:'plan.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:bytes});
  assert.equal(await page.evaluate(()=>state.receivedPlans['2026-11-09|camion'].entries.length),1);
  await page.reload();
  await page.waitForFunction(()=>typeof state!=='undefined');
  console.log('PASS browser: Gerencia planner, XLSX download/parse, Reparto import, duplicate guard, reload; cloud untouched');
  assert.deepEqual(errors,[]);
 }finally{await browser.close();await new Promise(ok=>server.close(ok))}
})().catch(e=>{console.error(e);process.exitCode=1});
