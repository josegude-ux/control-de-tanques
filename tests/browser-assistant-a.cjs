'use strict';
/* Aislado: prueba la UX del asistente A con datos ficticios en Chromium.
   No se envía información a Supabase ni se despliega la app. */
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const ROOT=path.resolve(__dirname,'..');
const ORIGIN='http://127.0.0.1:8787';
let server,browser;
const accepted=[];
async function openPage() {
  const ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  await ctx.route('https://**.supabase.co/**',r=>r.abort('blockedbyclient'));
  const page=await ctx.newPage();
  page.on('dialog',d=>d.accept());
  page.on('pageerror',err=>{ throw err; });
  await page.goto(ORIGIN+'/demo/',{waitUntil:'load'});
  await page.waitForFunction(()=>typeof state!=='undefined'&&!!state&&typeof TankCloud!=='undefined'&&typeof render==='function');
  await page.evaluate(()=>{
    TankCloud.connected=()=>true;
    TankCloud.member=()=>({active:true,role:'gerencia'});
    TankCloud.canOperate=()=>true;
    TankCloud.permitted=()=>true;
    TankCloud.decorate=()=>{};
    TankCloud.save=async()=>{};
    state=baseline();
    state.cloudStockReady=true;
    state.cloudStockProblems=[];
    state.role='almacen';
    state.page='inicio';
    state.cisterna=10000;
    state.tanks={camion:[150,0,0],furgoneta:[300]};
    render();
  });
  return {ctx,page};
}
async function main() {
  server=http.createServer((req,res)=>{
    try {
      const pathname=decodeURIComponent(new URL(req.url,ORIGIN).pathname);
      const safePath=pathname==='/'?'/demo/index.html':pathname;
      const file=path.resolve(ROOT,'.'+safePath);
      if(!file.startsWith(ROOT+path.sep))throw Error('Invalid path');
      const mime=file.endsWith('.html')?'text/html':file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':file.endsWith('.json')?'application/json':file.endsWith('.webmanifest')?'application/manifest+json':'application/octet-stream';
      res.writeHead(200,{'content-type':mime});res.end(fs.readFileSync(file));
    }catch(e){res.writeHead(404);res.end('Not found');}
  });
  await new Promise(resolve=>server.listen(8787,'127.0.0.1',resolve));
  browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']}: {})});
  const {page,ctx}=await openPage();
  assert.equal(await page.locator('.assistant-landing').count(),1);
  assert.match(await page.locator('.assistant-total').innerText(),/150/);
  accepted.push('Inicio compacto: vehículo, existencias y una acción');
  await page.locator('[data-guide=start]').click();
  assert.match(await page.locator('.assistant-head .assistant-count').innerText(),/Paso 1 de 3/);
  assert.equal(await page.locator('#loadVehicle').isVisible(),true);
  assert.equal(await page.locator('#loadLiters').isVisible(),false);
  accepted.push('Carga 1/3: solo vehículo y tanque');
  await page.locator('[data-guide=next]').click();
  assert.equal(await page.locator('#loadLiters').isVisible(),true);
  await page.locator('#loadLiters').fill('120');
  await page.locator('[data-guide=next]').click();
  assert.match(await page.locator('.assistant-review').innerText(),/120 L/);
  await page.locator('[data-guide=back]').click();
  assert.equal(await page.locator('#loadLiters').inputValue(),'120');
  accepted.push('Carga 2/3: introducir litros y volver sin perder los datos');
  await page.locator('[data-guide=next]').click();
  await page.locator('#zeroLoad').check();
  await page.locator('#loadForm button[type=submit]').click();
  await page.waitForFunction(()=>state.loads.length===1);
  assert.equal(await page.evaluate(()=>state.tanks.camion[0]),270);
  assert.equal(await page.locator('.assistant-success').count(),1);
  accepted.push('Carga 3/3: confirmación registrada mediante función existente');
  await page.locator('[data-guide=home]').click();
  await page.waitForSelector('.assistant-landing');
  await page.evaluate(()=>{state.role='reparto';state.page='visita';render();});
  await page.locator('[data-guide=extra]').click();
  assert.equal(await page.locator('#extraClient').isVisible(),true);
  await page.locator('#extraClient').fill('Cliente de prueba');
  await page.locator('#extraZero').check();
  await page.locator('#extraVisitForm button[type=submit]').click();
  await page.waitForFunction(()=>!!state.openVisit);
  accepted.push('Reparto: elección no planificada e inicio de visita');
  assert.match(await page.locator('.assistant-head .assistant-count').innerText(),/Paso 1 de 3/);
  await page.locator('[data-guide=next]').click();
  await page.locator('#destTank').selectOption('1');
  await page.locator('[data-guide=next]').click();
  await page.locator('#reading').fill('40');
  assert.match(await page.locator('#assistantLitresPreview').innerText(),/40/);
  await page.locator('#dischargeForm button[type=submit]').click();
  await page.waitForFunction(()=>state.openVisit?.discharges?.length===1);
  assert.equal(await page.evaluate(()=>state.tanks.camion[0]),230);
  accepted.push('Descarga en tres pasos: validación de lectura acumulada y descuento');
  await page.locator('[data-act=finish-visit]').click();
  await page.waitForFunction(()=>!state.openVisit&&state.visits.length===1);
  assert.equal(await page.locator('.assistant-success').count(),1);
  accepted.push('Cierre: visita persistida, confirmación visible');
  assert.equal(await page.evaluate(()=>state.visits[0].discharges[0].liters),40);
  await ctx.close();
  console.log('ASSISTANT_A_BROWSER_PASS: '+accepted.length+' escenarios');
  for(const t of accepted) console.log('OK '+t);
}
main().then(async()=>{if(browser)await browser.close();if(server)await new Promise(r=>server.close(r));})
.catch(async err=>{console.error(err);if(browser)await browser.close();if(server)await new Promise(r=>server.close(r));process.exitCode=1;});
