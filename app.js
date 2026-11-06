const C=MindTrackCore, $=id=>document.getElementById(id), KEY='mindtrack.state.v2';
let state={entries:[],deleted:[],consent:false,ownerId:null},editingId=null,toastTimer,busy=false;
try {const saved=JSON.parse(localStorage.getItem(KEY));if(saved && Array.isArray(saved.entries))state=saved;}catch{}
let entries=state.entries;
const cloud=new MindTrackCloud(window.MINDTRACK_CONFIG);
function saveEntries(){entries.sort((a,b)=>b.date.localeCompare(a.date));state.entries=entries;localStorage.setItem(KEY,JSON.stringify(state));}
function status(message){$('syncStatus').textContent=message;}
async function sync(){
 if(busy || !state.consent)return;
 busy=true;status('Odesílám změny…');
 try{await cloud.identify(state.ownerId);await cloud.upload(entries.filter(e=>e.dirty),state.deleted);entries.forEach(e=>e.dirty=false);state.deleted=[];saveEntries();status('Změny byly odeslány do školního projektu.');}
 catch(e){status('Záznamy zůstávají místně. Odeslání se nepodařilo: '+e.message);}
 finally{busy=false;}
}
function available(){if(busy){showToast('Počkej na dokončení odesílání.');return false;}return true;}
function showView(name){document.querySelectorAll('.view').forEach(v=>v.classList.toggle('active',v.id===name+'View'));document.querySelectorAll('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.view===name));if(name==='dashboard')renderDashboard();if(name==='history')renderHistory();window.scrollTo(0,0);}
function openForm(entry=null){if(!available())return;editingId=entry?.date||null;$('entryForm').reset();$('date').max=C.yesterday();$('date').value=entry?.date||C.yesterday();setMinutePicker('socialMinutes',entry?.socialMinutes||0);setMinutePicker('bedMinutes',entry?.bedMinutes||0);setMinutePicker('sleepHours',entry?.sleepHours??8);$('sleepQuality').value=entry?.sleepQuality||'';if(entry)document.querySelector(`input[name="mood"][value="${entry.mood}"]`).checked=true;showView('entry');}
function renderDashboard(){const list=recentDays();for(const [id,key,formatter] of [['avgSocial','socialMinutes',minutesLabel],['avgSleep','sleepHours',hoursLabel],['avgMood','mood',v=>v.toFixed(1)+' / 5']]){const v=average(list,key);$(id).textContent=v===null?'—':formatter(v);}$('entryCount').textContent=list.length;$('trendChart').innerHTML=makeChart(list);renderInsights(list);$('recentEntries').innerHTML=entries.slice(0,4).map(entryRow).join('')||'Zatím nejsou záznamy.';wireRows();}
function entryRow(e){return `<div class="entry-row"><div>${esc(formatDate(e.date))}<small class="entry-sub">Den a následující noc</small></div><div>${minutesLabel(e.socialMinutes)}<small> na sítích</small></div><div>${hoursLabel(e.sleepHours)}<small> spánek (${e.sleepQuality}/5)</small></div><div>Nálada ${e.mood}/5</div><div class="row-actions"><button class="icon-button" data-edit="${esc(e.date)}" aria-label="Upravit">✎</button><button class="icon-button" data-delete="${esc(e.date)}" aria-label="Smazat">×</button></div></div>`;}
function renderHistory(){$('historyCount').textContent=entries.length+' záznamů';$('historyEntries').innerHTML=entries.map(entryRow).join('')||'Zatím nejsou záznamy.';wireRows();}
function wireRows(){document.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>openForm(entries.find(e=>e.date===b.dataset.edit)));document.querySelectorAll('[data-delete]').forEach(b=>b.onclick=()=>{if(!available()||!confirm('Smazat tento den? Po obnovení sdílení se smaže také z databáze.'))return;state.deleted.push(b.dataset.delete);entries=entries.filter(e=>e.date!==b.dataset.delete);saveEntries();renderDashboard();renderHistory();sync();});}
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
  const vals = arr.map(e=>Number(e[key])).filter(Number.isFinite);
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


function initMinutePickers() {
  document.querySelectorAll(".minute-picker").forEach(picker => {
    const wheel = picker.querySelector(".minute-wheel");
    const input = $(picker.dataset.input);
    const max = Number(picker.dataset.max);
    const step = Number(picker.dataset.step);
    const precision = (String(step).split(".")[1] || "").length;
    const values = Array.from(
      {length: Math.floor(max / step) + 1},
      (_, index) => Number((index * step).toFixed(precision))
    );

    wheel.innerHTML = values.map(value => {
      const label = picker.dataset.unit === "hours" ? hoursLabel(value) : `${value} min`;
      return `<div class="minute-option" role="option" data-value="${value}">${label}</div>`;
    }).join("");

    const updateSelection = index => {
      const safeIndex = Math.max(0, Math.min(values.length - 1, index));
      const options = wheel.querySelectorAll(".minute-option");
      options.forEach((option, optionIndex) => {
        const selected = optionIndex === safeIndex;
        option.classList.toggle("selected", selected);
        option.setAttribute("aria-selected", String(selected));
      });
      input.value = values[safeIndex];
      return safeIndex;
    };

    const selectIndex = (index, smooth=false) => {
      const safeIndex = updateSelection(index);
      wheel.scrollTo({top: safeIndex * 40, behavior: smooth ? "smooth" : "auto"});
    };

    picker.setValue = value => selectIndex(Math.round(Number(value || 0) / step));
    wheel.addEventListener("scroll", () => updateSelection(Math.round(wheel.scrollTop / 40)));
    wheel.addEventListener("click", event => {
      const option = event.target.closest(".minute-option");
      if(option) selectIndex(values.indexOf(Number(option.dataset.value)), true);
    });
    wheel.addEventListener("keydown", event => {
      const keys = {ArrowUp:-1, ArrowDown:1, PageUp:-6, PageDown:6};
      if(!(event.key in keys) && event.key !== "Home" && event.key !== "End") return;
      event.preventDefault();
      const current = values.indexOf(Number(input.value));
      selectIndex(event.key === "Home" ? 0 : event.key === "End" ? values.length - 1 : current + keys[event.key], true);
    });
    picker.querySelectorAll(".minute-step").forEach(button => button.addEventListener("click", () => {
      const current = values.indexOf(Number(input.value));
      selectIndex(current + Number(button.dataset.direction), true);
    }));

    picker.setValue(input.value);
  });
}

function setMinutePicker(inputId, value) {
  document.querySelector(`.minute-picker[data-input="${inputId}"]`).setValue(value);
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
  const segments=key=>{let out=[],cur=[];days.forEach((d,i)=>{if(d.entry)cur.push([x(i),y(Math.min(24,Number(d.entry[key])*(key==="socialMinutes"?1/60:1)))]);else if(cur.length){out.push(cur);cur=[];}});if(cur.length)out.push(cur);return out;};
  segments("socialMinutes").forEach(seg=>{svg+=`<polyline fill="none" stroke="#7967e8" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" points="${seg.map(p=>p.join(",")).join(" ")}"/>`;seg.forEach(p=>svg+=`<circle cx="${p[0]}" cy="${p[1]}" r="4" fill="#7967e8" stroke="#fff" stroke-width="2"/>`);});
  segments("sleepHours").forEach(seg=>{svg+=`<polyline fill="none" stroke="#4698df" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" points="${seg.map(p=>p.join(",")).join(" ")}"/>`;seg.forEach(p=>svg+=`<circle cx="${p[0]}" cy="${p[1]}" r="4" fill="#4698df" stroke="#fff" stroke-width="2"/>`);});
  days.forEach((d,i)=>{svg+=`<text x="${x(i)}" y="${H-12}" fill="#929bad" font-size="10" text-anchor="middle">${esc(d.label)}</text>`;});
  svg+="</svg>";return svg;
}
function renderInsights(list) {
  const insights=[];
  if(list.length<3) insights.push(["✦","Sbírej první data",`Máš ${list.length} ${list.length===1?"záznam":"záznamy"}. Po alespoň třech dnech půjde lépe sledovat vlastní vzorce.`]);
  if(list.length>=3) {
    const s=average(list,"socialMinutes"), sl=average(list,"sleepHours"), m=average(list,"mood");
    insights.push(["◷","Čas na sítích",`Za posledních 7 dokončených dní máš průměr ${minutesLabel(s)} denně. Ber to jako orientační přehled, ne jako dobré nebo špatné skóre.`]);
    insights.push(["☾","Spánek",`Průměrná délka spánku v záznamech je ${hoursLabel(sl)}. Kvalita spánku se může lišit den ode dne.`]);
    insights.push(["☺","Nálada",`Průměrné hodnocení nálady je ${m.toFixed(1).replace(".",",")} z 5. Jednotlivé hodnocení je subjektivní a běžně kolísá.`]);
    if(list.length>=5) {
      const evening=average(list,"bedMinutes");
      insights.push(["⌁","Večerní používání",`Před spaním zaznamenáváš průměrně ${minutesLabel(evening)} na sítích. Zkus si všimnout, jak se to pojí s délkou a kvalitou následujícího spánku.`]);
    }
  }
  $("insights").innerHTML=insights.slice(0,4).map(i=>`<div class="insight-card"><span class="insight-symbol">${i[0]}</span><div><strong>${i[1]}</strong><p>${i[2]}</p></div></div>`).join("");
}
initMinutePickers();
$('appVersion').textContent='v2.0.0';$('todayLabel').textContent=new Date().toLocaleDateString('cs-CZ');$('rangeLabel').textContent='Posledních 7 dokončených dní';
document.querySelectorAll('.nav-item').forEach(b=>b.onclick=()=>b.dataset.view==='entry'?openForm():showView(b.dataset.view));
$('topAdd').onclick=$('historyAdd').onclick=()=>openForm();$('viewHistory').onclick=()=>showView('history');$('cancelEntry').onclick=()=>showView('dashboard');
$('entryForm').onsubmit=e=>{e.preventDefault();if(!available())return;const f=new FormData(e.target);const record={schemaVersion:2,date:String(f.get('date'))};for(const key of ['socialMinutes','bedMinutes','sleepHours','sleepQuality','mood'])record[key]=Number(f.get(key));const error=C.validate(record);if(error){showToast(error);return;}if(entries.some(x=>x.date===record.date && x.date!==editingId)&&!confirm('Nahradit existující záznam tohoto dne?'))return;if(editingId&&editingId!==record.date)state.deleted.push(editingId);entries=entries.filter(x=>x.date!==record.date&&x.date!==editingId);entries.push({...C.clean(record),dirty:true});saveEntries();editingId=null;showView('dashboard');showToast('Záznam byl uložen místně.');sync();};
$('exportCsv').onclick=()=>downloadBlob(C.csv(entries),'mindtrack-v2.csv','text/csv;charset=utf-8');
const backup=document.createElement('button');backup.className='button button-secondary';backup.textContent='Záloha JSON';backup.onclick=()=>downloadBlob(JSON.stringify({version:2,entries:entries.map(C.clean)},null,2),'mindtrack-v2.json','application/json');$('exportCsv').parentElement.appendChild(backup);
$('importJson').onchange=async e=>{try{if(!available())return;const file=e.target.files[0];if(!file)return;const imported=C.parseBackup(await file.text());if(!confirm('Importovat '+imported.length+' záznamů? Shodné dny budou nahrazeny a při sdílení odeslány.'))return;const map=new Map(entries.map(x=>[x.date,x]));imported.forEach(x=>map.set(x.date,{...x,dirty:true}));entries=[...map.values()];state.deleted=state.deleted.filter(d=>!map.has(d));saveEntries();renderDashboard();renderHistory();sync();}catch(err){showToast(err.message);}finally{e.target.value='';}};
$('clearAll').onclick=()=>{if(!available()||!confirm('Smazat všechny záznamy? Při obnovení sdílení budou smazány také z databáze.'))return;state.deleted.push(...entries.map(e=>e.date));entries=[];saveEntries();renderDashboard();renderHistory();sync();};
$('privacySettings').onclick=()=>{$('cloudError').textContent='';$('consentCheck').checked=false;$('participantCode').textContent=state.ownerId?'Tvůj kód: '+state.ownerId:'';$('withdrawSharing').hidden=!state.ownerId;$('consentDialog').showModal();};
$('closePrivacy').onclick=()=>{if(available())$('consentDialog').close();};
$('declineSharing').onclick=()=>{if(!available())return;state.consent=false;saveEntries();status('Sdílení je pozastavené. Dříve odeslané údaje zůstávají v databázi.');$('consentDialog').close();};
$('acceptSharing').onclick=async()=>{if(!available())return;if(!$('consentCheck').checked){$('cloudError').textContent='Nejprve potvrď, že rozumíš sdílení.';return;}busy=true;try{const id=await cloud.identify(state.ownerId,true);state.ownerId=id;saveEntries();await cloud.enroll();state.consent=true;entries.forEach(e=>e.dirty=true);saveEntries();$('consentDialog').close();}catch(e){$('cloudError').textContent=e.message;}finally{busy=false;}sync();};
$('withdrawSharing').onclick=async()=>{if(!available()||!confirm('Smazat všechny odeslané záznamy a ukončit účast? Místní kopie zůstane.'))return;state.consent=false;saveEntries();busy=true;try{await cloud.identify(state.ownerId);await cloud.withdraw();state.deleted=[];entries.forEach(e=>e.dirty=false);saveEntries();status('Odeslané záznamy byly smazány. Sdílení je vypnuté.');$('consentDialog').close();}catch(e){$('cloudError').textContent='Sdílení je pozastavené, ale smazání se nepodařilo. Zkus ho znovu online. '+e.message;}finally{busy=false;}};
$('syncNow').onclick=()=>state.consent?sync():$('privacySettings').click();window.addEventListener('online',sync);
const legacy=localStorage.getItem('mindtrack.entries.v1');if(legacy){$('legacyExport').hidden=$('legacyNote').hidden=false;$('legacyExport').onclick=()=>downloadBlob(legacy,'mindtrack-puvodni-v1.json','application/json');}
renderDashboard();if(state.consent)sync();
if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
