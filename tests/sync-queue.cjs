const {JSDOM}=require('jsdom'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');const root=path.resolve(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8');
const tick=()=>new Promise(r=>setTimeout(r,10));
(async()=>{
 const dom=new JSDOM(read('index.html'),{url:'https://example.test/',runScripts:'outside-only'}),w=dom.window,d=w.document;
 w.scrollTo=()=>{};w.confirm=()=>true;w.HTMLDialogElement.prototype.showModal=function(){};w.MINDTRACK_CONFIG={};const releases=[],uploads=[];
 w.MindTrackCloud=class{async identify(){this.userId='test';}async enroll(){}async upload(e,deleted){uploads.push(JSON.parse(JSON.stringify({e,deleted})));await new Promise(r=>releases.push(r));return e;}async load(){return []}};
 w.eval(read('core.js'));w.eval(read('reminders.js'));w.eval(read('extras.js')+'\n'+read('app.js'));
 const wheel=(id,v)=>d.querySelector(`#${id}Wheel [data-index="${v+1}"]`).click();
 const choose=(n,v)=>d.querySelector(`input[name="${n}"][value="${v}"]`).checked=true;
 const save=()=>d.getElementById('entryForm').dispatchEvent(new w.Event('submit',{cancelable:true}));
 d.getElementById('eveningChoice').click();wheel('socialH',1);wheel('socialM',0);choose('mood',3);save();await tick();assert.equal(uploads.length,1);
 // Edit while the first upload is deliberately held open.
 d.getElementById('eveningChoice').click();wheel('socialM',30);save();await tick();
 let s=JSON.parse(w.localStorage.getItem('mindtrack.state.v2'));assert.equal(s.entries[0].socialMinutes,90);assert.equal(s.entries[0].dirty,true);
 releases.shift()();await tick();assert.equal(uploads.length,2);assert.equal(uploads[1].e[0].socialMinutes,90);
 s=JSON.parse(w.localStorage.getItem('mindtrack.state.v2'));assert.equal(s.entries[0].dirty,true);
 releases.shift()();await tick();s=JSON.parse(w.localStorage.getItem('mindtrack.state.v2'));assert.equal(s.entries[0].dirty,false);
 assert.ok(s.entries[0].eveningRecordedAt);assert.match(d.getElementById('eveningStatus').textContent,/Odesláno/);
 d.getElementById('morningChoice').click();wheel('sleepH',8);wheel('sleepM',15);assert.ok(w.localStorage.getItem('mindtrack.drafts.v4'));
 d.getElementById('rangeDays').value='30';d.getElementById('rangeDays').dispatchEvent(new w.Event('change'));assert.match(d.getElementById('rangeLabel').textContent,/30/);
 assert.ok(d.querySelectorAll('[data-calendar]').length>=28);
 dom.window.close();console.log('Sync queue: passed (in-flight edits, retry queue, exact acknowledgements, timestamp, persistent draft, calendar/range)');
})().catch(e=>{console.error(e);process.exit(1)});
