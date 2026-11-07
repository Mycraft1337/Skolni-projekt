const BUILD='5.0.0-20261107.1';
const CACHE='mindtrack-'+BUILD+'-'+self.registration.scope;
const ASSETS=['./','./index.html','./styles.css?v=5.0.0','./app.js?v=5.0.0','./core.js?v=5.0.0','./cloud.js?v=5.0.0','./config.js?v=5.0.0','./reminders.js?v=5.0.0','./extras.js?v=5.0.0','./icon.svg','./manifest.json'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS))));
self.addEventListener('message',e=>{if(e.data?.type==='activate-update')self.skipWaiting();});
self.addEventListener('activate',e=>e.waitUntil((async()=>{for(const name of await caches.keys())if(name.startsWith('mindtrack-')&&name.endsWith(self.registration.scope)&&name!==CACHE)await caches.delete(name);await self.clients.claim();})()));
self.addEventListener('fetch',e=>{
 const url=new URL(e.request.url);if(e.request.method!=='GET'||url.origin!==self.location.origin)return;
 // Research requests and credentials are never stored in the offline cache.
 if(url.pathname.endsWith('/research.html')||url.pathname.endsWith('/research.js'))return;
 e.respondWith((async()=>{try{const r=await fetch(e.request);if(r.ok)return r;throw Error('network');}catch{
 const c=await caches.open(CACHE);return await c.match(e.request)||(e.request.mode==='navigate'?await c.match('./index.html'):null)||Response.error();}})());
});
self.addEventListener('push',event=>{
 let data={};try{data=event.data?.json()||{};}catch{}
 const period=['morning','evening'].includes(data.period)?data.period:null;
 event.waitUntil(self.registration.showNotification(data.title||'MindTrack',{body:data.body||'Čas na krátký zápis.',tag:data.tag||'mindtrack',icon:'./icon.svg',data:{period,day:data.day}}));
});
self.addEventListener('notificationclick',event=>{
 event.notification.close();const {period,day}=event.notification.data||{};const url=new URL('./',self.registration.scope);
 if(['morning','evening'].includes(period)){url.searchParams.set('checkin',period);if(/^\d{4}-\d{2}-\d{2}$/.test(day))url.searchParams.set('day',day);}
 event.waitUntil((async()=>{const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});const existing=windows.find(c=>c.url.startsWith(self.registration.scope)&&!c.url.includes('research.html'));if(existing){await existing.focus();existing.postMessage({type:'mindtrack-open',period,day});}else await self.clients.openWindow(url.href);})());
});
