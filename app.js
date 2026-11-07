const C=MindTrackCore, $=id=>document.getElementById(id), KEY='mindtrack.state.v2';
let state={entries:[],deleted:[],consent:true,ownerId:null},toastTimer,busy=false;
try {const saved=JSON.parse(localStorage.getItem(KEY));if(saved && Array.isArray(saved.entries))state=saved;}catch{}
let entries=state.entries;
const cloud=new MindTrackCloud(window.MINDTRACK_CONFIG);
function updateSharingNotice(){ $('sharingNotice').textContent=state.consent?'Uložením se odpovědi automaticky odešlou autorovi školního projektu pod náhodným kódem, bez jména a e-mailu.':'Odesílání je vypnuté. Odpovědi se uloží pouze do tohoto prohlížeče.';}
function saveEntries(){updateSharingNotice();entries.sort((a,b)=>b.date.localeCompare(a.date));state.entries=entries;localStorage.setItem(KEY,JSON.stringify(state));}
function status(message){$('syncStatus').textContent=message;}
async function sync(){
 if(busy || !state.consent || (!entries.some(e=>e.dirty)&&!state.deleted.length))return;
 busy=true;status('Odesílám změny…');
 try{await cloud.identify(state.ownerId,true);state.ownerId=cloud.userId;saveEntries();await cloud.enroll();await cloud.upload(entries.filter(e=>e.dirty),state.deleted);entries.forEach(e=>e.dirty=false);state.deleted=[];saveEntries();status('Změny byly odeslány do školního projektu.');}
 catch(e){status('Záznamy zůstávají místně. Odeslání se nepodařilo: '+e.message);}
 finally{busy=false;}
}
function available(){if(busy){showToast('Počkej na dokončení odesílání.');return false;}return true;}
function showView(name){document.querySelectorAll('.view').forEach(v=>v.classList.toggle('active',v.id===name+'View'));document.querySelectorAll('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.view===name));if(name==='dashboard')renderDashboard();if(name==='history')renderHistory();window.scrollTo(0,0);}
let activePeriod=null;
const DRAFT_KEY='mindtrack.drafts.v4';
function draftKey(){return $('date').value+':'+activePeriod;}
function readDrafts(){try{return JSON.parse(sessionStorage.getItem(DRAFT_KEY))||{};}catch{return {};}}
function home(day=C.today()){
 if(!available())return;
 activePeriod=null;showView('entry');$('entryForm').hidden=true;
 $('date').max=C.today();$('date').value=typeof day==='string'?day:C.today();
 updateChoices();
}
function updateChoices(){
 const day=$('date').value;
 for(const period of ['morning','evening']){
   const key=period==='morning'?C.shiftDay(day,-1):day;
   const record=entries.find(e=>e.date===key);
   const done=period==='morning'?C.hasMorning(record):C.hasEvening(record);
   $(period+'Status').textContent=(done?'✓ Vyplněno · upravit':'Nevyplněno · otevřít')+' · '+(period==='morning'?'noc '+formatDate(key)+' → '+formatDate(day):formatDate(day));
   $(period+'Choice').setAttribute('aria-expanded',String(activePeriod===period));
 }
}
function openForm(period){
 if(!available())return;
 activePeriod=period;
 const key=period==='morning'?C.shiftDay($('date').value,-1):$('date').value;
 const entry=entries.find(e=>e.date===key);
 $('entryForm').reset();$('entryForm').hidden=false;$('formMessage').textContent='';
 for(const [selector,enabled] of [['.day-block',period==='evening'],['.night-block',period==='morning']]){
   const block=document.querySelector(selector);block.hidden=!enabled;
   block.querySelectorAll('input,button').forEach(el=>el.disabled=!enabled);
 }
 for(const [prefix,total] of [['social',entry?.socialMinutes],['sleep',entry?.sleepHours==null?null:Math.round(entry.sleepHours*60)]]){
   $(prefix+'H').value=total==null?'':Math.floor(total/60);$(prefix+'M').value=total==null?'':total%60;
 }
 for(const name of ['sleepQuality','mood']){const el=document.querySelector(`input[name="${name}"][value="${entry?.[name]}"]`);if(el)el.checked=true;}
 if(typeof entry?.beforeBed==='boolean')document.querySelector(`input[name="beforeBed"][value="${entry.beforeBed?'yes':'no'}"]`).checked=true;
 $('oldEvening').hidden=entry?.schemaVersion!==2;
 const draft=readDrafts()[draftKey()];
 if(draft)for(const [name,value]of Object.entries(draft)){for(const el of document.getElementsByName(name)){if(el.type==='radio')el.checked=el.value===value;else el.value=value;}}
 updatePeriodLabels();updateChoices();refreshWheels();
}
function renderDashboard(){const list=recentDays();for(const [id,key,formatter] of [['avgSocial','socialMinutes',minutesLabel],['avgSleep','sleepHours',hoursLabel],['avgMood','mood',v=>v.toFixed(1)+' / 5']]){const v=average(list,key);$(id).textContent=v===null?'—':formatter(v);}$('entryCount').textContent=list.length;$('trendChart').innerHTML=makeChart(list);renderInsights(list);$('recentEntries').innerHTML=entries.slice(0,4).map(entryRow).join('')||'Zatím nejsou záznamy.';wireRows();}
function entryRow(e){return `<div class="entry-row"><div>${esc(formatDate(e.date))}<small class="entry-sub">Den a následující noc</small></div><div>${e.socialMinutes==null?'—':minutesLabel(e.socialMinutes)}<small> na sítích</small></div><div>${e.sleepHours==null?'—':hoursLabel(e.sleepHours)}<small> spánek${e.sleepQuality==null?'':` (${e.sleepQuality}/5)`}</small></div><div>Nálada ${e.mood==null?'—':e.mood+'/5'}</div><div class="row-actions"><button class="text-button" data-edit="${esc(e.date)}" data-period="evening">Večer</button><button class="text-button" data-edit="${esc(e.date)}" data-period="morning" ${e.date>=C.today()?'disabled title="Zapiš až následující ráno"':''}>Noc / ráno</button><button class="icon-button" data-delete="${esc(e.date)}" aria-label="Smazat">×</button></div></div>`;}
function renderHistory(){$('historyCount').textContent=entries.length+' záznamů';$('historyEntries').innerHTML=entries.map(entryRow).join('')||'Zatím nejsou záznamy.';wireRows();}
function wireRows(){document.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>{home(b.dataset.period==='morning'?C.shiftDay(b.dataset.edit,1):b.dataset.edit);openForm(b.dataset.period);});document.querySelectorAll('[data-delete]').forEach(b=>b.onclick=()=>{if(!available()||!confirm('Smazat tento den? Po obnovení sdílení se smaže také z databáze.'))return;state.deleted.push(b.dataset.delete);entries=entries.filter(e=>e.date!==b.dataset.delete);saveEntries();renderDashboard();renderHistory();sync();});}
function downloadBlob(content,name,type){const url=URL.createObjectURL(new Blob([content],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function formatDate(iso, options={day:"numeric",month:"short"}) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("cs-CZ", options);
}
function minutesLabel(value) {
  const m = Math.round(Number(value)||0);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m/60), rest = m%60;
  return rest ? `${h} h ${rest} min` : `${h} h`;
}
function hoursLabel(value) {
  const h = Number(value)||0;
  const whole = Math.floor(h), mins = Math.round((h-whole)*60);
  return mins ? `${whole} h ${mins} min` : `${whole} h`;
}
function average(arr, key) {
  const vals = arr.filter(e=>e[key]!=null).map(e=>Number(e[key])).filter(Number.isFinite);
  return vals.length ? vals.reduce((a,b)=>a+b,0)/vals.length : null;
}
function recentDays(n=7) {
  const end=C.yesterday(), d=new Date(end+'T12:00:00');d.setDate(d.getDate()-(n-1));
  return entries.filter(e=>e.date>=C.dateISO(d) && e.date<=end);
}
function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}
function showToast(message) {
  const el=$("toast"); el.textContent=message; el.classList.add("show");
  clearTimeout(toastTimer); toastTimer=setTimeout(()=>el.classList.remove("show"),2600);
}


function makeChart(list) {
  if(!list.length) return '<div class="empty-state">Zatím tu nejsou data. Přidej svůj první denní záznam.</div>';
  const days=[];
  for(let i=6;i>=0;i--){const d=new Date();d.setHours(0,0,0,0);d.setDate(d.getDate()-1-i);const iso=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;days.push({iso,label:d.toLocaleDateString("cs-CZ",{weekday:"short"}),entry:list.find(e=>e.date===iso)});}
  const W=620,H=230,left=42,right=18,top=20,bottom=35,plotW=W-left-right,plotH=H-top-bottom;
  const x=i=>left+(days.length===1?plotW/2:i*plotW/6);
  const y=v=>top+plotH-(v/24)*plotH;
  let svg=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Graf času na sociálních sítích a délky spánku za posledních sedm dokončených dní">`;
  [0,6,12,18,24].forEach(v=>{svg+=`<line x1="${left}" y1="${y(v)}" x2="${W-right}" y2="${y(v)}" stroke="#edf0f6" stroke-width="1"/><text x="${left-10}" y="${y(v)+4}" fill="#a1a9b7" font-size="10" text-anchor="end">${v}</text>`;});
  const path=(key,scale)=>days.map((d,i)=>d.entry?`${i?"L":"M"} ${x(i)} ${y(Math.min(24,Number(d.entry[key])*scale))}`:"").filter(Boolean).join(" ");
  // Break lines where dates are missing.
  const segments=key=>{let out=[],cur=[];days.forEach((d,i)=>{if(d.entry && d.entry[key]!=null)cur.push([x(i),y(Math.min(24,Number(d.entry[key])*(key==="socialMinutes"?1/60:1)))]);else if(cur.length){out.push(cur);cur=[];}});if(cur.length)out.push(cur);return out;};
  segments("socialMinutes").forEach(seg=>{svg+=`<polyline fill="none" stroke="#7967e8" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" points="${seg.map(p=>p.join(",")).join(" ")}"/>`;seg.forEach(p=>svg+=`<circle cx="${p[0]}" cy="${p[1]}" r="4" fill="#7967e8" stroke="#fff" stroke-width="2"/>`);});
  segments("sleepHours").forEach(seg=>{svg+=`<polyline fill="none" stroke="#4698df" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" points="${seg.map(p=>p.join(",")).join(" ")}"/>`;seg.forEach(p=>svg+=`<circle cx="${p[0]}" cy="${p[1]}" r="4" fill="#4698df" stroke="#fff" stroke-width="2"/>`);});
  days.forEach((d,i)=>{svg+=`<text x="${x(i)}" y="${H-12}" fill="#929bad" font-size="10" text-anchor="middle">${esc(d.label)}</text>`;});
  svg+="</svg>";return svg;
}
function renderInsights(list) {
  list=list.filter(e=>C.hasMorning(e)&&C.hasEvening(e));
  const insights=[];
  if(list.length<3) insights.push(["✦","Sbírej první data",`Máš ${list.length} úplných dvojic den + noc. Po alespoň třech dnech půjde lépe sledovat vlastní vzorce.`]);
  if(list.length>=3) {
    const s=average(list,"socialMinutes"), sl=average(list,"sleepHours"), m=average(list,"mood");
    insights.push(["◷","Čas na sítích",`Z úplných dvojic za posledních 7 dokončených dní máš průměr ${minutesLabel(s)} denně. Ber to jako orientační přehled, ne jako dobré nebo špatné skóre.`]);
    insights.push(["☾","Spánek",`Průměrná délka spánku v záznamech je ${hoursLabel(sl)}. Kvalita spánku se může lišit den ode dne.`]);
    insights.push(["☺","Nálada",`Průměrné hodnocení nálady je ${m.toFixed(1).replace(".",",")} z 5. Jednotlivé hodnocení je subjektivní a běžně kolísá.`]);
    if(list.length>=5) {
      const answers=list.filter(e=>typeof e.beforeBed==='boolean'), yes=answers.filter(e=>e.beforeBed).length;
      insights.push(["⌁","Večerní používání",`Z ${answers.length} nových odpovědí uvádíš používání sítí před spaním ${yes}×. Starší minutové záznamy se do tohoto počtu nezahrnují.`]);
    }
  }
  $("insights").innerHTML=insights.slice(0,4).map(i=>`<div class="insight-card"><span class="insight-symbol">${i[0]}</span><div><strong>${i[1]}</strong><p>${i[2]}</p></div></div>`).join("");
}

$('appVersion').textContent='v4.0.0';$('todayLabel').textContent=new Date().toLocaleDateString('cs-CZ');$('rangeLabel').textContent='Posledních 7 dokončených dní';
document.querySelectorAll('.nav-item').forEach(b=>b.onclick=()=>b.dataset.view==='entry'?home():showView(b.dataset.view));
$('topAdd').onclick=()=>home();$('historyAdd').onclick=()=>home();$('viewHistory').onclick=()=>showView('history');$('cancelEntry').onclick=()=>home($('date').value);
$('date').onchange=()=>{if(!C.validDate($('date').value)||$('date').value>C.today()||$('date').value<'2020-01-02'){$('date').value=C.today();}home($('date').value);};
$('morningChoice').onclick=()=>openForm('morning');$('eveningChoice').onclick=()=>openForm('evening');
$('entryForm').onsubmit=e=>{
 e.preventDefault();if(!available()||!activePeriod)return;
 const f=new FormData(e.target),morning=activePeriod==='morning',prefix=morning?'sleep':'social';
 if([prefix+'H',prefix+'M'].some(k=>!f.has(k)||f.get(k)==='')){$('formMessage').textContent='Vyber hodiny i minuty (můžeš zvolit i 0).';return;}
 const day=morning?C.shiftDay($('date').value,-1):$('date').value;
 const old=entries.find(x=>x.date===day);
 const record={schemaVersion:4,date:day,socialMinutes:null,mood:null,sleepHours:null,sleepQuality:null,beforeBed:null,...(old?C.clean(old):{})};
 if(morning){record.schemaVersion=4;delete record.bedMinutes;record.sleepHours=(Number(f.get('sleepH'))*60+Number(f.get('sleepM')))/60;record.sleepQuality=Number(f.get('sleepQuality'));record.beforeBed=f.get('beforeBed')==='yes'?true:f.get('beforeBed')==='no'?false:null;}
 else{record.socialMinutes=Number(f.get('socialH'))*60+Number(f.get('socialM'));record.mood=Number(f.get('mood'));if(old?.schemaVersion!==2)record.schemaVersion=4;}
 const error=C.validate(record);if(error){$('formMessage').textContent=error;return;}
 entries=entries.filter(x=>x.date!==day);entries.push({...C.clean(record),dirty:true});state.deleted=state.deleted.filter(d=>d!==day);saveEntries();
 const drafts=readDrafts();delete drafts[draftKey()];sessionStorage.setItem(DRAFT_KEY,JSON.stringify(drafts));
 home($('date').value);showToast(morning?'Ranní zápis uložen.':'Večerní zápis uložen.');sync();
};
$('exportCsv').onclick=()=>downloadBlob(C.csv(entries),'mindtrack-v4.csv','text/csv;charset=utf-8');
const backup=document.createElement('button');backup.className='button button-secondary';backup.textContent='Záloha JSON';backup.onclick=()=>downloadBlob(JSON.stringify({version:4,entries:entries.map(C.clean)},null,2),'mindtrack-v4.json','application/json');$('exportCsv').parentElement.appendChild(backup);
$('importJson').onchange=async e=>{try{if(!available())return;const file=e.target.files[0];if(!file)return;const imported=C.parseBackup(await file.text());if(!confirm('Importovat '+imported.length+' záznamů? Shodné dny budou nahrazeny a při sdílení odeslány.'))return;const map=new Map(entries.map(x=>[x.date,x]));imported.forEach(x=>map.set(x.date,{...x,dirty:true}));entries=[...map.values()];state.deleted=state.deleted.filter(d=>!map.has(d));saveEntries();renderDashboard();renderHistory();sync();}catch(err){showToast(err.message);}finally{e.target.value='';}};
$('clearAll').onclick=()=>{if(!available()||!confirm('Smazat všechny záznamy? Při obnovení sdílení budou smazány také z databáze.'))return;state.deleted.push(...entries.map(e=>e.date));entries=[];saveEntries();renderDashboard();renderHistory();sync();};
$('privacySettings').onclick=()=>{$('cloudError').textContent='';$('participantCode').textContent=state.ownerId?'Tvůj kód: '+state.ownerId:'';$('withdrawSharing').hidden=!state.ownerId;$('consentDialog').showModal();};
$('closePrivacy').onclick=()=>{if(available())$('consentDialog').close();};
$('declineSharing').onclick=()=>{if(!available())return;state.consent=false;saveEntries();status('Sdílení je pozastavené. Dříve odeslané údaje zůstávají v databázi.');$('consentDialog').close();};
$('acceptSharing').onclick=async()=>{if(!available())return;busy=true;try{const id=await cloud.identify(state.ownerId,true);state.ownerId=id;saveEntries();await cloud.enroll();state.consent=true;entries.forEach(e=>e.dirty=true);saveEntries();$('consentDialog').close();}catch(e){$('cloudError').textContent=e.message;}finally{busy=false;}sync();};
$('withdrawSharing').onclick=async()=>{if(!available()||!confirm('Smazat všechny odeslané záznamy a ukončit účast? Místní kopie zůstane.'))return;state.consent=false;saveEntries();busy=true;try{await cloud.identify(state.ownerId);await cloud.withdraw();state.deleted=[];entries.forEach(e=>e.dirty=false);saveEntries();status('Odeslané záznamy byly smazány. Sdílení je vypnuté.');$('consentDialog').close();}catch(e){$('cloudError').textContent='Sdílení je pozastavené, ale smazání se nepodařilo. Zkus ho znovu online. '+e.message;}finally{busy=false;}};
$('syncNow').onclick=()=>state.consent?sync():$('privacySettings').click();window.addEventListener('online',sync);
const legacy=localStorage.getItem('mindtrack.entries.v1');if(legacy){$('legacyExport').hidden=$('legacyNote').hidden=false;$('legacyExport').onclick=()=>downloadBlob(legacy,'mindtrack-puvodni-v1.json','application/json');}

$('entryForm').addEventListener('input',()=>{if(!activePeriod)return;const drafts=readDrafts();drafts[draftKey()]=Object.fromEntries(new FormData($('entryForm')));sessionStorage.setItem(DRAFT_KEY,JSON.stringify(drafts));});
function updatePeriodLabels(){
 const day=$('date').value,opts={weekday:'long',day:'numeric',month:'numeric'};
 $('dayHeading').textContent='Jaký byl tvůj den?';$('dayDates').textContent=formatDate(day,opts)+' · vyplň večer';
 $('nightHeading').textContent='Jaká byla tvoje noc?';$('nightDates').textContent=formatDate(C.shiftDay(day,-1),opts)+' → '+formatDate(day,opts);
 $('saveCheckin').textContent=activePeriod==='morning'?'Uložit ranní zápis':'Uložit večerní zápis';
}
function initWheels(){document.querySelectorAll('.time-wheel').forEach(w=>{const input=$(w.dataset.input),values=['',...Array.from({length:Number(w.dataset.max)+1},(_,i)=>String(i))];w.innerHTML=values.map((v,i)=>`<div class="time-option" role="option" id="${input.id}Option${i}" data-index="${i}" aria-selected="false">${v===''?'—':v.padStart(2,'0')}</div>`).join('');
 const select=(i,emit=true,scroll=true)=>{i=Math.max(0,Math.min(values.length-1,i));input.value=values[i];w.querySelectorAll('.time-option').forEach((o,j)=>{o.setAttribute('aria-selected',String(i===j));});w.setAttribute('aria-activedescendant',input.id+'Option'+i);if(scroll)w.scrollTop=i*40;if(emit)input.dispatchEvent(new Event('input',{bubbles:true}));};
 w.refresh=()=>select(Math.max(0,values.indexOf(input.value)),false);w.move=step=>select(values.indexOf(input.value)+step);w.addEventListener('scroll',()=>{if(!input.disabled&&w.closest('.view').classList.contains('active')&&!$('entryForm').hidden)select(Math.round(w.scrollTop/40),true,false);});w.addEventListener('click',e=>{const o=e.target.closest('.time-option');if(o)select(Number(o.dataset.index));});w.addEventListener('keydown',e=>{const steps={ArrowUp:-1,ArrowDown:1,PageUp:-5,PageDown:5};if(e.key in steps){e.preventDefault();w.move(steps[e.key]);}else if(e.key==='Home'||e.key==='End'){e.preventDefault();select(e.key==='Home'?1:values.length-1);}});
 });document.querySelectorAll('[data-wheel]').forEach(b=>b.onclick=()=>$(b.dataset.wheel+'Wheel').move(Number(b.dataset.step)));}
function refreshWheels(){document.querySelectorAll('.time-wheel').forEach(w=>w.refresh());}
initWheels();updateSharingNotice();$('formPrivacy').onclick=()=>$('privacySettings').click();
if(!state.consent)status('Odesílání je vypnuté. Záznamy zůstávají pouze v tomto prohlížeči.');
renderDashboard();home();if(state.consent)sync();
if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
