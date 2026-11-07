const assert=require('node:assert/strict'),{JSDOM}=require('jsdom'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
function boot({permission='default',failSave=false}={}){
 const dom=new JSDOM(fs.readFileSync(path.join(root,'index.html'),'utf8'),{url:'https://mycraft1337.github.io/Skolni-projekt/',runScripts:'outside-only'}),w=dom.window,d=w.document;
 w.matchMedia=()=>({matches:false});w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};
 let permissionRequests=0,subscribed=0,unsubscribed=0,owner=null;
 const calls=[];
 w.Notification={permission,requestPermission:async()=>{permissionRequests++;return 'granted';}};w.PushManager=class{};
 const sub={toJSON:()=>({endpoint:'https://web.push.apple.com/example',keys:{p256dh:'A'.repeat(87),auth:'B'.repeat(22)}}),unsubscribe:async()=>{unsubscribed++;}};
 const reg={pushManager:{getSubscription:async()=>subscribed?sub:null,subscribe:async()=>{subscribed++;return sub;}}};
 Object.defineProperty(w.navigator,'serviceWorker',{value:{register:async()=>reg,ready:Promise.resolve(reg),getRegistration:async()=>reg}});
 const cloud={identify:async()=>{cloud.userId='test';},client:{functions:{invoke:async(_,req)=>{calls.push(req.body);if(req.body.action==='save'&&failSave)return {error:Error('offline')};return {data:req.body.action==='key'?{publicKey:'B'.repeat(87)}:req.body.action==='status'?{settings:null}:{ok:true}};}}}};
 w.eval(fs.readFileSync(path.join(root,'reminders.js'),'utf8'));
 const c=new w.MindTrackReminders(cloud,()=>owner,id=>owner=id);
 return {w,d,c,calls,dom,stats:()=>({permissionRequests,subscribed,unsubscribed})};
}
(async()=>{
 const t=boot();await t.c.open();assert.equal(t.stats().permissionRequests,0);assert.equal(t.calls.length,0);
 t.d.getElementById('morningReminderTime').value='07:25';t.d.getElementById('eveningReminderEnabled').checked=false;
 await t.c.save();assert.equal(t.stats().permissionRequests,1);assert.equal(t.stats().subscribed,1);
 const saved=t.calls.find(x=>x.action==='save');assert.equal(saved.morning,'07:25');assert.equal(saved.evening,null);assert.ok(saved.timezone);
 await t.c.test();assert.ok(t.calls.some(x=>x.action==='test'));
 await t.c.disable();assert.equal(t.stats().unsubscribed,1);assert.ok(t.calls.some(x=>x.action==='disable'));
 const denied=boot({permission:'denied'});await denied.c.open();await denied.c.save();assert.equal(denied.calls.length,0);assert.match(denied.d.getElementById('reminderMessage').textContent,/nejsou povolená/);
 const fail=boot({failSave:true});await fail.c.open();await fail.c.save();assert.equal(fail.stats().unsubscribed,1);
 for(const x of [t,denied,fail])x.dom.window.close();
 console.log('Reminder UI: passed (opt-in only, custom time, one period, test, disable, denied permission, failed-save cleanup)');
})().catch(e=>{console.error(e);process.exit(1)});
