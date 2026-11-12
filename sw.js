// Cache del shell únicamente. Nunca abre IndexedDB ni borra datos de usuario.
const CACHE='control-tanques-demo-v0101-visura14-transversal-r91-315-operativa-r2-inicio-r92-banners-r93-secundarias-r94-gerencia-r95';
const FILES=['./supabase-2.57.4.js','./sync-core.js?v=0.10.1','./cloud-sync.js?v=0.10.1','./','./index.html','./styles.css?v=0.10.1','./app.js?v=0.10.1-home-r5-315-operativa-r2','./visura315-import.js?v=1','./xlsx-local.js?v=0.10.1','./xlsx-import-local.js?v=0.10.1','./xlsx-transfer-local.js?v=0.10.1','./plan-import-local.js?v=0.10.1','./manifest.webmanifest?v=0.10.1','./assets/visura-prepara.svg','./icon.svg','./mahou-logo.png','./logo-control-tanques.png','./Control_de_Tanques_icon_192.png','./Control_de_Tanques_icon_512.png','./version.json','./visura-r5-visual.js?v=interiores-r6','./visura-r5-visual.css?v=cp030','./referencia-clientes.jpg','./referencia-cargas.jpg','./assets/cargas-aprobada.png','./assets/descargas-aprobada.png','./visura-tanques-botones-r4.js?v=r4','./visura-tanques-botones-r4.css?v=r5-home','./visura-tanques-interiores-r6.css?v=r6','./visura-tanques-interiores-r61.css?v=r61','./visura-tanques-interiores-r61.js?v=r61','./visura-gerencia-dual-r7.css?v=r7','./visura-gerencia-dual-r7.js?v=r7','./visura-gerencia-imagenes-r8.css?v=r8','./visura-gerencia-imagenes-r8.js?v=r8','./assets/gerencia-r8-cisterna.jpg','./assets/gerencia-r8-camion.jpg','./assets/gerencia-r8-furgoneta.jpg','./assets/voldis-logo-autorizado-r8.jpeg','./visura-transversal-r9.css?v=r91','./visura-transversal-r9.js?v=r91','./visura-inicio-sync-r92.css?v=r92','./visura-inicio-sync-r92.js?v=r92','./visura-banners-r93.css?v=r93','./visura-banners-r93.js?v=r93','./visura-secundarias-r94.css?v=r94','./visura-secundarias-r94.js?v=r94','./visura-gerencia-interiores-r95.css?v=r95','./visura-gerencia-interiores-r95.js?v=r95'];
// Exclusivamente los dos PNG aprobados; el resto de recursos conserva su política.
const BANNERS=new Set(['assets/cargas-aprobada.png','assets/descargas-aprobada.png'].map(p=>new URL(p,self.registration.scope).href));
const isBanner=request=>BANNERS.has(request.url);
const validBanner=response=>!!response&&response.ok&&/^image\/png(?:\s*;|$)/i.test(response.headers.get('content-type')||'');
async function getBanner(request){
 const cache=await caches.open(CACHE).catch(()=>null);
 let response;
 try{response=await fetch(request);if(validBanner(response)){if(cache)try{await cache.put(request,response.clone())}catch{}return response}}catch{}
 const stored=cache?await cache.match(request).catch(()=>null):null;
 return validBanner(stored)?stored:(response||Response.error());
}
self.addEventListener('install',e=>{e.waitUntil((async()=>{const c=await caches.open(CACHE);await Promise.all(FILES.map(async file=>{const request=new Request(file,{cache:'reload'});const response=await fetch(request);if(!response.ok)throw new Error('No se pudo preparar '+file);await c.put(request,response)}));await self.skipWaiting()})())});
self.addEventListener('message',e=>{if(e.data?.type==='SKIP_WAITING')self.skipWaiting()});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('control-tanques-demo-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET'||new URL(e.request.url).origin!==self.location.origin)return;
  if(isBanner(e.request)){e.respondWith(getBanner(e.request));return}
  if(new URL(e.request.url).pathname.endsWith('/version.json')){e.respondWith(fetch(e.request,{cache:'no-store'}).catch(async()=>await caches.match(e.request)||(e.request.mode==='navigate'?await caches.match('./index.html'):Response.error())));return}
  e.respondWith(fetch(e.request).then(r=>{if(r.ok){const copy=r.clone();caches.open(CACHE).then(c=>c.put(e.request,copy))}return r}).catch(async()=>await caches.match(e.request)||(e.request.mode==='navigate'?await caches.match('./index.html'):Response.error())));
});
