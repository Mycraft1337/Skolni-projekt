const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict'),path=require('node:path');
(async()=>{
 const handlers={},scope='https://mycraft1337.github.io/Skolni-projekt/';let skipped=0,deleted=[],response;
 const cache={match:async req=>req==='./index.html'?{offline:true}:undefined,addAll:async()=>{}};
 const self={registration:{scope},location:{origin:'https://mycraft1337.github.io'},addEventListener:(n,f)=>handlers[n]=f,skipWaiting:()=>skipped++,clients:{claim:async()=>{}}};
 const caches={open:async()=>cache,keys:async()=>['mindtrack-old-'+scope,'unrelated-cache'],delete:async n=>deleted.push(n)};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../sw.js'),'utf8'),{self,caches,URL,Response,fetch:async()=>{throw Error('offline')}});
 handlers.fetch({request:{url:scope+'?checkin=morning&day=2026-11-07',method:'GET',mode:'navigate'},respondWith:p=>response=p});assert.equal((await response).offline,true);
 assert.equal(skipped,0);handlers.message({data:{type:'activate-update'}});assert.equal(skipped,1);
 handlers.activate({waitUntil:p=>response=p});await response;assert.deepEqual(deleted,['mindtrack-old-'+scope]);
 let cachedResearch=false;handlers.fetch({request:{url:scope+'research.html',method:'GET'},respondWith:()=>cachedResearch=true});assert.equal(cachedResearch,false);
 console.log('Offline/update: passed (query navigation fallback, explicit update, scoped cleanup, research excluded)');
})().catch(e=>{console.error(e);process.exit(1)});
