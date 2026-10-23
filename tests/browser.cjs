const {chromium}=require('playwright');const assert=require('node:assert/strict');
const origin='http://127.0.0.1:8765',id='00000000-0000-4000-8000-000000000001';
const rows=new Map();let calls=0;
const token=['eyJhbGciOiJub25lIn0',Buffer.from(JSON.stringify({sub:id,exp:Math.floor(Date.now()/1000)+3600})).toString('base64url'),'mock'].join('.');
const user={id,email:'test@example.invalid',aud:'authenticated',role:'authenticated'};
async function mock(route){
 const req=route.request(),url=new URL(req.url()),headers={'access-control-allow-origin':'*','access-control-allow-headers':'*','content-type':'application/json'};
 const send=(x,status=200)=>route.fulfill({status,headers,body:JSON.stringify(x)});
 if(req.method()==='OPTIONS')return send({});
 if(url.pathname.includes('/auth/v1/token'))return send({access_token:token,token_type:'bearer',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,refresh_token:'mock',user});
 if(url.pathname.includes('/auth/v1/user'))return send(user);
 if(url.pathname.endsWith('/tanques_members'))return send(req.headers().accept?.includes('object')?{user_id:id,nombre:'Prueba',active:true,role:'gerencia'}:[{user_id:id,nombre:'Prueba',active:true,role:'gerencia'}]);
 if(url.pathname.endsWith('/tanques_records'))return send([...rows.values()].sort((a,b)=>a.key.localeCompare(b.key)));
 if(url.pathname.endsWith('/rpc/tanques_sync_batch')){
  calls++;const changes=req.postDataJSON().changes;
  for(const c of changes)if((rows.get(c.key)?.revision||0)!==c.base)return send({message:'CONFLICT: '+c.key},409);
  const result=changes.map(c=>({...c,owner_id:rows.get(c.key)?.owner_id||id,revision:c.base+1,updated_at:new Date().toISOString()}));for(const r of result)rows.set(r.key,r);return send(result);
 }
 throw Error('Unexpected API call: '+url.pathname);
}
(async()=>{
 const fs=require('fs'),path=require('path');const server=require('http').createServer((req,res)=>{const file=path.join(__dirname,'..',decodeURIComponent(req.url.split('?')[0]==='/'?'/index.html':req.url.split('?')[0]));try{res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.html')?'text/html':file.endsWith('.css')?'text/css':'application/octet-stream');res.end(fs.readFileSync(file));}catch{res.statusCode=404;res.end();}});await new Promise(r=>server.listen(8765,'127.0.0.1',r));
 const b=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']}: {})});const errors=[];
 async function device(){const c=await b.newContext({viewport:{width:390,height:844},isMobile:true});await c.route('https://oevetnszmfxeukcncwji.supabase.co/**',mock);const p=await c.newPage();p.setDefaultTimeout(15000);p.on('pageerror',e=>errors.push(e.message));p.on('dialog',d=>d.accept());await p.goto(origin);await p.locator('[data-cloud=settings]').first().click();await p.locator('#cloudEmail').fill('test@example.invalid');await p.locator('#cloudPassword').fill('TestPassword123!');await p.locator('#cloudLoginForm button').click();await p.waitForFunction(()=>TankCloud.member()?.active);await p.waitForFunction(()=>!document.getElementById('cloudBadge').textContent.includes('Sincronizando'));return {c,p};}
 const a=await device();console.log('login OK');await a.p.locator('[data-act=go-gerencia]').first().click();
 await a.p.locator('#openingCisterna').fill('10000');for(const i of [0,1,2])await a.p.locator('#openingCamion'+i).fill('0');await a.p.locator('#openingFurgoneta').fill('0');await a.p.locator('#openingForm button').click();
 await a.p.waitForFunction(()=>Object.keys(TankCloud.meta().pending).length===0&&state.cloudStockReady);
 console.log('opening OK');assert.equal(rows.get('opening:global').payload.cisterna,10000);
 async function role(p,r){await p.locator('#roleButton').click();await p.locator('[data-profile='+r+']').click();await p.waitForFunction(r=>state.role===r,r);}
 await role(a.p,'almacen');await a.p.locator('[data-act=go-carga]').click();await a.p.locator('#loadLiters').fill('100');await a.p.locator('#zeroLoad').check();await a.p.locator('#loadForm button[type=submit]').click();
 await a.p.waitForFunction(()=>state.loads.length===1&&Object.keys(TankCloud.meta().pending).length===0);
 console.log('load OK');const d=await device();await role(d.p,'reparto');assert.equal(await d.p.evaluate(()=>state.tanks.camion[0]),100);
 await d.p.locator('[data-act=go-visita]').click();await d.p.locator('#extraClient').fill('Bar de prueba');await d.p.locator('#extraZero').check();await d.p.locator('#extraVisitForm button').click();
 await d.p.locator('#destTank').selectOption('1');await d.p.locator('#reading').fill('50');await d.p.locator('#dischargeForm button[type=submit]').click();
 await d.p.waitForFunction(()=>state.openVisit?.discharges.length===1&&Object.keys(TankCloud.meta().pending).length===0);
 console.log('discharge OK');await d.c.setOffline(true);await d.p.locator('#destTank').selectOption('2');await d.p.locator('#reading').fill('75');await d.p.locator('#dischargeForm button[type=submit]').click();await d.p.waitForFunction(()=>Object.keys(TankCloud.meta().pending).length>0);
 assert.equal(await d.p.evaluate(()=>state.tanks.camion[0]),25);
 await d.p.evaluate(()=>navigator.serviceWorker.ready);console.log('offline save OK');await d.p.reload();await d.p.waitForFunction(()=>TankCloud.connected());assert.equal(await d.p.evaluate(()=>state.openVisit.discharges.length),2);
 await d.c.setOffline(false);await d.p.waitForFunction(()=>Object.keys(TankCloud.meta().pending).length===0);
 await a.p.locator('[data-page=inicio]').click();await a.p.locator('#cloudForce').click();await a.p.waitForFunction(()=>state.tanks.camion[0]===25);
 await d.p.locator('#cloudForce').click();assert.equal([...rows.values()].filter(r=>r.kind==='movement').length,3);
 await a.p.screenshot({path:'/tmp/tanques-home.png',fullPage:true});assert.deepEqual(errors,[]);console.log('PASS: two devices, opening, load, discharge, offline reload, automatic/manual retry, no duplicates; RPC calls='+calls);await b.close();server.close();
})().catch(e=>{console.error(e);process.exit(1)});
