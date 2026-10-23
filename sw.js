// Cache del shell; no borrar nunca IndexedDB ni datos de usuario.
const CACHE='control-tanques-demo-v0100-autosync';
const FILES=['./supabase-2.57.4.js','./sync-core.js?v=0.10.0','./cloud-sync.js?v=0.10.0','./','./index.html','./styles.css?v=0.10.0','./app.js?v=0.10.0','./xlsx-local.js?v=0.10.0','./xlsx-import-local.js?v=0.10.0','./xlsx-transfer-local.js?v=0.10.0','./plan-import-local.js?v=0.10.0','./manifest.webmanifest?v=0.10.0','./icon.svg','./mahou-logo.png','./logo-control-tanques.png','./Control_de_Tanques_icon_192.png','./Control_de_Tanques_icon_512.png','./version.json'];
self.addEventListener('install',e=>{e.waitUntil((async()=>{const c=await caches.open(CACHE);await Promise.all(FILES.map(async file=>{const request=new Request(file,{cache:'reload'});const response=await fetch(request);if(!response.ok)throw new Error('No se pudo preparar '+file);await c.put(request,response)}));await self.skipWaiting()})())});
self.addEventListener('message',e=>{if(e.data?.type==='SKIP_WAITING')self.skipWaiting()});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('control-tanques-demo-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET'||new URL(e.request.url).origin!==self.location.origin)return;
  if(new URL(e.request.url).pathname.endsWith('/version.json')){e.respondWith(fetch(e.request,{cache:'no-store'}).catch(async()=>await caches.match(e.request)||(e.request.mode==='navigate'?await caches.match('./index.html'):Response.error())));return}
  e.respondWith(fetch(e.request).then(r=>{if(r.ok){const copy=r.clone();caches.open(CACHE).then(c=>c.put(e.request,copy))}return r}).catch(async()=>await caches.match(e.request)||(e.request.mode==='navigate'?await caches.match('./index.html'):Response.error())));
});
