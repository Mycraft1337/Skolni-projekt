const CACHE='mindtrack-v4.1.0-'+self.registration.scope;
const ASSETS=['./','./index.html','./styles.css?v=4.1.0','./app.js?v=4.1.0','./core.js?v=4.1.0','./cloud.js?v=4.1.0','./config.js?v=4.1.0','./reminders.js?v=4.1.0','./icon.svg','./manifest.json'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)));self.skipWaiting();});
self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));
self.addEventListener('fetch',e=>{if(e.request.method!=='GET'||new URL(e.request.url).origin!==self.location.origin)return;e.respondWith(fetch(e.request).catch(()=>caches.open(CACHE).then(c=>c.match(e.request)).then(r=>r||Response.error())));});

self.addEventListener('push',event=>{
 let data={};try{data=event.data?.json()||{};}catch{}
 const period=['morning','evening'].includes(data.period)?data.period:null;
 event.waitUntil(self.registration.showNotification(data.title||'MindTrack',{body:data.body||'Čas na krátký zápis.',tag:data.tag||'mindtrack',icon:'./icon.svg',data:{period,day:data.day}}));
});
self.addEventListener('notificationclick',event=>{
 event.notification.close();const {period,day}=event.notification.data||{};
 const url=new URL('./',self.registration.scope);
 if(['morning','evening'].includes(period)){url.searchParams.set('checkin',period);if(/^\d{4}-\d{2}-\d{2}$/.test(day))url.searchParams.set('day',day);}
 event.waitUntil((async()=>{
  const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
  const existing=windows.find(c=>c.url.startsWith(self.registration.scope));
  if(existing){await existing.focus();existing.postMessage({type:'mindtrack-open',period,day});}
  else await self.clients.openWindow(url.href);
 })());
});
