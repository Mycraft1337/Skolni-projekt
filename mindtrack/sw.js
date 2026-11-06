const CACHE='mindtrack-v2-'+self.registration.scope;
const ASSETS=['./','./index.html','./styles.css?v=2.0.0','./app.js?v=2.0.0','./core.js?v=2.0.0','./cloud.js?v=2.0.0','./config.js?v=2.0.0','./icon.svg','./manifest.json'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)));self.skipWaiting();});
self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));
self.addEventListener('fetch',e=>{if(e.request.method!=='GET'||new URL(e.request.url).origin!==self.location.origin)return;e.respondWith(fetch(e.request).catch(()=>caches.open(CACHE).then(c=>c.match(e.request)).then(r=>r||Response.error())));});
