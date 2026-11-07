const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
(async()=>{
 const handlers={},shown=[],opened=[],messages=[],scope='https://mycraft1337.github.io/Skolni-projekt/';let windows=[];
 const self={registration:{scope,showNotification:async(title,options)=>shown.push({title,options})},addEventListener:(name,fn)=>handlers[name]=fn,clients:{matchAll:async()=>windows,openWindow:async url=>opened.push(url)}};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../sw.js'),'utf8'),{self,URL});
 let pending;const waitUntil=p=>pending=p;
 handlers.push({data:{json:()=>({title:'Ráno',body:'Zápis',period:'morning',day:'2026-11-07'})},waitUntil});await pending;
 assert.equal(shown[0].options.data.period,'morning');
 const notification={data:shown[0].options.data,close(){}};
 handlers.notificationclick({notification,waitUntil});await pending;
 assert.equal(opened[0],scope+'?checkin=morning&day=2026-11-07');
 windows=[{url:scope,focus:async()=>{},postMessage:data=>messages.push(data)}];
 handlers.notificationclick({notification,waitUntil});await pending;
 assert.equal(opened.length,1);assert.equal(messages[0].type,'mindtrack-open');assert.equal(messages[0].period,'morning');
 console.log('Service worker: passed (notification display, cold open, existing window routing)');
})().catch(e=>{console.error(e);process.exit(1)});
