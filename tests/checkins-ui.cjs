// Run with jsdom 26.1.0 installed in NODE_PATH (test-only dependency).
const {JSDOM}=require('jsdom'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),read=n=>fs.readFileSync(path.join(root,n),'utf8');
const key='mindtrack.state.v2';
function boot(saved){
 const dom=new JSDOM(read('index.html'),{url:'https://example.test/',runScripts:'outside-only'}),w=dom.window;
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};w.scrollTo=()=>{};w.confirm=()=>true;w.MINDTRACK_CONFIG={};
 const uploads=[];
 w.MindTrackCloud=class{async identify(){this.userId='test';return 'test'}async enroll(){}async upload(entries){uploads.push(JSON.parse(JSON.stringify(entries)));}};
 if(saved)w.localStorage.setItem(key,JSON.stringify(saved));
 w.eval(read('core.js'));w.eval(read('reminders.js'));w.eval(read('extras.js')+'\n'+read('app.js'));
 return {w,d:w.document,uploads,dom,state:()=>JSON.parse(w.localStorage.getItem(key))};
}
const settle=()=>new Promise(r=>setTimeout(r,10));
function choose(t,name,value){const el=t.d.querySelector(`input[name="${name}"][value="${value}"]`);el.checked=true;el.dispatchEvent(new t.w.Event('input',{bubbles:true}));}
function wheel(t,id,value){t.d.querySelector(`#${id}Wheel [data-index="${value+1}"]`).click();}
function submit(t){t.d.getElementById('entryForm').dispatchEvent(new t.w.Event('submit',{cancelable:true,bubbles:true}));}
(async()=>{
 const t=boot(),C=t.w.MindTrackCore;
 assert.equal(t.d.getElementById('entryForm').hidden,true);
 t.d.getElementById('morningChoice').click();
 assert.equal(t.d.querySelector('.day-block').hidden,true);assert.equal(t.d.querySelector('[name=mood]').disabled,true);
 wheel(t,'sleepH',7);wheel(t,'sleepM',30);choose(t,'sleepQuality',4);choose(t,'beforeBed','yes');
 t.d.getElementById('eveningChoice').click();t.d.getElementById('morningChoice').click();
 assert.equal(t.d.getElementById('sleepH').value,'7'); // independent unsaved draft retained
 submit(t);await settle();
 let s=t.state();assert.equal(s.entries.length,1);assert.equal(s.entries[0].date,C.yesterday());assert.equal(s.entries[0].socialMinutes,null);assert.equal(s.entries[0].sleepHours,7.5);assert.equal(t.uploads.length,1);
 assert.match(t.d.getElementById('morningStatus').textContent,/Vyplněno/);
 assert.match(t.d.getElementById('eveningStatus').textContent,/Nevyplněno/);
 // Backfill yesterday evening and preserve this morning's sleep in the same research row.
 t.d.getElementById('date').value=C.yesterday();t.d.getElementById('date').dispatchEvent(new t.w.Event('change'));
 t.d.getElementById('eveningChoice').click();wheel(t,'socialH',0);wheel(t,'socialM',0);choose(t,'mood',3);submit(t);await settle();
 s=t.state();assert.equal(s.entries.length,1);assert.equal(s.entries[0].sleepHours,7.5);assert.equal(s.entries[0].socialMinutes,0);assert.equal(s.entries[0].beforeBed,true);
 // Today evening is a different row with an absent following-night sleep.
 t.d.getElementById('topAdd').click();t.d.getElementById('eveningChoice').click();wheel(t,'socialH',2);wheel(t,'socialM',15);choose(t,'mood',5);submit(t);await settle();
 s=t.state();assert.equal(s.entries.length,2);assert.equal(s.entries.find(e=>e.date===C.today()).sleepHours,null);
 assert.equal(t.w.average(s.entries,"sleepHours"),7.5);
 t.d.getElementById('eveningChoice').click();wheel(t,'socialM',30);submit(t);await settle();
 assert.equal(t.state().entries.length,2);assert.equal(t.state().entries.find(e=>e.date===C.today()).socialMinutes,150);
 const offline=boot({...t.state(),consent:false});offline.d.getElementById('morningChoice').click();wheel(offline,'sleepM',45);submit(offline);await settle();assert.equal(offline.uploads.length,0);
 // Existing v2/v3 records remain; opening/editing one half never erases the other.
 const legacy=boot({entries:[{schemaVersion:2,date:C.yesterday(),socialMinutes:80,mood:4,sleepHours:8,sleepQuality:3,bedMinutes:20}],deleted:[],consent:false,ownerId:null});
 legacy.d.getElementById('morningChoice').click();assert.equal(legacy.d.getElementById('sleepH').value,'8');choose(legacy,'beforeBed','no');submit(legacy);
 assert.equal(legacy.state().entries[0].socialMinutes,80);assert.equal(legacy.state().entries[0].schemaVersion,4);
 for(const x of [t,offline,legacy])x.dom.window.close();
 console.log('UI check-ins: passed (morning-first, partial upload, merge, edits, drafts, null averages, consent, legacy)');
})().catch(e=>{console.error(e);process.exit(1)});
