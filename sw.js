// Cache del shell; no borrar nunca IndexedDB ni datos de usuario.
const CACHE='control-tanques-demo-v0929-resilient';
const FILES=['./','./index.html','./styles.css?v=0.9.28','./app.js?v=0.9.28','./xlsx-local.js?v=0.9.28','./xlsx-import-local.js?v=0.9.28','./xlsx-transfer-local.js?v=0.9.28','./plan-import-local.js?v=0.9.28','./manifest.webmanifest?v=0.9.28','./icon.svg','./mahou-logo.png','./logo-control-tanques.png','./Control_de_Tanques_icon_192.png','./Control_de_Tanques_icon_512.png','./version.json'];
self.addEventListener('install',e=>{e.waitUntil((async()=>{const c=await caches.open(CACHE);await Promise.allSettled(FILES.map(async file=>{const request=new Request(file,{cache:'reload'});const response=await fetch(request);if(response.ok)await c.put(request,response)}));await self.skipWaiting()})())});
self.addEventListener('message',e=>{if(e.data?.type==='SKIP_WAITING')self.skipWaiting()});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('control-tanques-demo-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET'||new URL(e.request.url).origin!==self.location.origin)return;
  if(new URL(e.request.url).pathname.endsWith('/version.json')){e.respondWith(fetch(e.request,{cache:'no-store'}).catch(()=>caches.match(e.request)));return}
  e.respondWith(fetch(e.request).then(r=>{if(r.ok){const copy=r.clone();caches.open(CACHE).then(c=>c.put(e.request,copy))}return r}).catch(()=>caches.match(e.request)));
});
