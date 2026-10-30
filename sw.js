const CACHE = "mindtrack-pwa-v2";
const ASSETS = ["./","./index.html","./styles.css","./app.js","./manifest.json","./icon.svg"];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key))))
      .then(()=>self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if(request.method!=="GET" || new URL(request.url).origin!==self.location.origin) return;

  event.respondWith(
    fetch(request)
      .then(response=>{
        if(response.status===200) {
          const copy=response.clone();
          caches.open(CACHE).then(cache=>cache.put(request,copy));
        }
        return response;
      })
      .catch(async()=>{
        const cached=await caches.match(request);
        if(cached) return cached;
        if(request.mode==="navigate") return caches.match("./index.html");
        return Response.error();
      })
  );
});
