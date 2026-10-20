// Cache del shell; no borrar nunca IndexedDB ni datos de usuario.
const CACHE='control-tanques-demo-v098-reconciliation';
const FILES=['./','./index.html','./styles.css?v=0.9.8','./app.js?v=0.9.8','./xlsx-local.js?v=0.9.8','./xlsx-import-local.js?v=0.9.8','./xlsx-transfer-local.js?v=0.9.8','./manifest.webmanifest','./icon.svg','./mahou-logo.png','./version.json'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)))});
self.addEventListener('message',e=>{if(e.data?.type==='SKIP_WAITING')self.skipWaiting()});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('control-tanques-demo-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET'||new URL(e.request.url).origin!==self.location.origin)return;
  if(new URL(e.request.url).pathname.endsWith('/version.json')){e.respondWith(fetch(e.request,{cache:'no-store'}).catch(()=>caches.match(e.request)));return}
  e.respondWith(fetch(e.request).then(r=>{if(r.ok){const copy=r.clone();caches.open(CACHE).then(c=>c.put(e.request,copy))}return r}).catch(()=>caches.match(e.request)));
});
