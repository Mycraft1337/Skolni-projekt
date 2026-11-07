const {JSDOM}=require('jsdom'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');const root=path.resolve(__dirname,'..');
(async()=>{
 const dom=new JSDOM(fs.readFileSync(path.join(root,'research.html'),'utf8'),{url:'https://example.test/research.html',runScripts:'outside-only'}),w=dom.window,d=w.document;
 w.MINDTRACK_CONFIG={url:'https://example.test',publishableKey:'public'};w.eval(fs.readFileSync(path.join(root,'core.js'),'utf8'));
 const calls=[];w.fetch=async(_,args)=>{const b=JSON.parse(args.body);calls.push(b);return {ok:true,json:async()=>({rows:b.table==='participants'?[{user_id:'test',consent_at:w.MindTrackCore.yesterday()+'T00:00:00Z'}]:[{user_id:'test',day:w.MindTrackCore.yesterday(),social_minutes:60,mood:3,sleep_hours:8,sleep_minutes:480,sleep_quality:4}]})};};
 w.eval(fs.readFileSync(path.join(root,'research.js'),'utf8'));d.getElementById('researchKey').value='private-test';d.getElementById('researchLogin').dispatchEvent(new w.Event('submit',{cancelable:true}));await new Promise(r=>setTimeout(r,10));
 assert.equal(d.getElementById('researchKey').value,'');assert.equal(d.getElementById('researchContent').hidden,false);assert.equal(d.querySelectorAll('#researchRows tr').length,1);assert.equal(d.querySelectorAll('#researchRows td')[1].textContent,'1');assert.equal(w.localStorage.length,0);
 d.getElementById('researchLogout').click();assert.equal(d.getElementById('researchContent').hidden,true);assert.equal(d.querySelectorAll('#researchRows tr').length,0);dom.window.close();console.log('Research overview: passed (load, completion counts, no stored key, lock)');
})().catch(e=>{console.error(e);process.exit(1)});
