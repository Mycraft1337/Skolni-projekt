const STORAGE_KEY = "mindtrack.entries.v1";
const CONSENT_KEY = "mindtrack.anonymous-sharing.v1";
const SUPABASE_URL = "https://rukeziypxobbwzrjnlqj.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_ZyPRQFMwUXGSedp_2vhoVg_2jsckHhD";
const $ = (id) => document.getElementById(id);
let entries = loadEntries();
let editingId = null;
let toastTimer;

function loadEntries() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.filter(validEntry).sort((a,b) => b.date.localeCompare(a.date)) : [];
  } catch { return []; }
}
function validEntry(e) {
  return e && typeof e.id === "string" && /^\d{4}-\d{2}-\d{2}$/.test(e.date) &&
    Number.isFinite(Number(e.socialMinutes)) && Number.isFinite(Number(e.sleepHours));
}
function saveEntries() {
  entries.sort((a,b) => b.date.localeCompare(a.date));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}
function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
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
  const cutoff = new Date(); cutoff.setHours(0,0,0,0); cutoff.setDate(cutoff.getDate()-(n-1));
  const iso = `${cutoff.getFullYear()}-${String(cutoff.getMonth()+1).padStart(2,"0")}-${String(cutoff.getDate()).padStart(2,"0")}`;
  return entries.filter(e=>e.date>=iso && e.date<=todayISO());
}
function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}
function showToast(message) {
  const el=$("toast"); el.textContent=message; el.classList.add("show");
  clearTimeout(toastTimer); toastTimer=setTimeout(()=>el.classList.remove("show"),2600);
}

function getSharingConsent() {
  try { return localStorage.getItem(CONSENT_KEY); }
  catch { return null; }
}

function setSharingConsent(value) {
  localStorage.setItem(CONSENT_KEY, value);
  $("consentDialog").close();
  showToast(value === "accepted" ? "Anonymní sdílení je zapnuté." : "Záznamy zůstávají pouze v tomto prohlížeči.");
}

function openConsentDialog() {
  const dialog = $("consentDialog");
  if(!dialog.open) dialog.showModal();
}

async function submitAnonymousRecord(record) {
  const controller = new AbortController();
  const timeout = setTimeout(()=>controller.abort(), 8000);
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/anonymous_entries`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "apikey": SUPABASE_PUBLISHABLE_KEY,
        "Authorization": `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
        "Content-Type": "application/json",
        "Prefer": "return=minimal"
      },
      body: JSON.stringify({
        social_minutes: record.socialMinutes,
        bed_minutes: record.bedMinutes,
        sleep_hours: record.sleepHours,
        sleep_quality: record.sleepQuality,
        mood: record.mood
      })
    });
    if(!response.ok) throw new Error(`Supabase request failed: ${response.status}`);
  } finally {
    clearTimeout(timeout);
  }
}

function showView(name) {
  document.querySelectorAll(".view").forEach(v=>v.classList.remove("active"));
  $(name+"View").classList.add("active");
  document.querySelectorAll(".nav-item").forEach(b=>b.classList.toggle("active",b.dataset.view===name));
  if(name==="dashboard") renderDashboard();
  if(name==="history") renderHistory();
  window.scrollTo({top:0,behavior:"smooth"});
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

initMinutePickers();
$("acceptSharing").addEventListener("click",()=>setSharingConsent("accepted"));
$("declineSharing").addEventListener("click",()=>setSharingConsent("declined"));
$("privacySettings").addEventListener("click",openConsentDialog);
$("consentDialog").addEventListener("cancel",event=>{
  if(getSharingConsent()===null) event.preventDefault();
});
if(getSharingConsent()===null) setTimeout(openConsentDialog, 0);
document.querySelectorAll(".nav-item").forEach(b=>b.addEventListener("click",()=>showView(b.dataset.view)));
$("todayLabel").textContent = new Date().toLocaleDateString("cs-CZ",{weekday:"short",day:"numeric",month:"short"});
$("topAdd").addEventListener("click",()=>openForm());
$("historyAdd").addEventListener("click",()=>openForm());
$("viewHistory").addEventListener("click",()=>showView("history"));
$("cancelEntry").addEventListener("click",()=>showView("dashboard"));

function openForm(entry=null) {
  editingId = entry?.id || null;
  $("entryForm").reset();
  $("date").value = entry?.date || todayISO();
  setMinutePicker("socialMinutes", entry?.socialMinutes ?? 0);
  setMinutePicker("bedMinutes", entry?.bedMinutes ?? 0);
  setMinutePicker("sleepHours", entry?.sleepHours ?? 8);
  $("sleepQuality").value = entry?.sleepQuality ?? "";
  $("notes").value = entry?.notes ?? "";
  if(entry) {
    const radio = document.querySelector(`input[name="mood"][value="${entry.mood}"]`);
    if(radio) radio.checked=true;
  }
  $("formMessage").textContent = "";
  document.querySelector("#entryView h1").textContent = entry ? "Upravit záznam" : "Jaký byl dnešek?";
  showView("entry");
}
$("entryForm").addEventListener("submit",async e=>{
  e.preventDefault();
  const f = new FormData(e.currentTarget);
  const record = {
    id: editingId || (crypto.randomUUID ? crypto.randomUUID() : String(Date.now())+Math.random().toString(16).slice(2)),
    date: String(f.get("date")),
    socialMinutes: Number(f.get("socialMinutes")),
    bedMinutes: Number(f.get("bedMinutes")),
    sleepHours: Number(f.get("sleepHours")),
    sleepQuality: Number(f.get("sleepQuality")),
    mood: Number(f.get("mood")),
    notes: String(f.get("notes")||"").trim(),
    updatedAt: new Date().toISOString()
  };
  if(record.bedMinutes>record.socialMinutes) {
    showToast("Pozor: čas před spaním je vyšší než celkový čas na sítích. Zkontroluj údaje.");
    return;
  }
  const duplicate = entries.find(x=>x.date===record.date && x.id!==record.id);
  if(duplicate && !confirm("Pro toto datum už záznam existuje. Chceš ho nahradit?")) return;
  const shouldShare = !editingId && !duplicate && getSharingConsent()==="accepted";
  entries = entries.filter(x=>x.id!==record.id && x.date!==record.date);
  entries.push(record); saveEntries();
  const wasEditing = Boolean(editingId);
  editingId=null;
  showView("dashboard");

  if(shouldShare) {
    try {
      await submitAnonymousRecord(record);
      showToast("Záznam byl uložen a anonymně sdílen.");
    } catch {
      showToast("Záznam je uložen lokálně, ale anonymní sdílení se nepodařilo.");
    }
  } else {
    showToast(wasEditing ? "Záznam byl upraven." : "Záznam byl uložen.");
  }
});

function renderDashboard() {
  const list=recentDays(7);
  const social=average(list,"socialMinutes"), sleep=average(list,"sleepHours"), mood=average(list,"mood");
  $("avgSocial").textContent=social===null?"—":minutesLabel(social);
  $("avgSleep").textContent=sleep===null?"—":hoursLabel(sleep);
  $("avgMood").textContent=mood===null?"—":mood.toFixed(1).replace(".",",")+" / 5";
  $("entryCount").textContent=list.length;
  $("trendChart").innerHTML=makeChart(list);
  renderInsights(list);
  const recent=entries.slice(0,4);
  $("recentEntries").innerHTML=recent.length?recent.map(e=>entryRow(e,false)).join(""):'<div class="empty-state">Zatím nemáš žádné záznamy. Začni krátkým denním check-inem.</div>';
  wireRowButtons();
}
function makeChart(list) {
  if(!list.length) return '<div class="empty-state">Zatím tu nejsou data. Přidej svůj první denní záznam.</div>';
  const days=[];
  for(let i=6;i>=0;i--){const d=new Date();d.setHours(0,0,0,0);d.setDate(d.getDate()-i);const iso=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;days.push({iso,label:d.toLocaleDateString("cs-CZ",{weekday:"short"}),entry:list.find(e=>e.date===iso)});}
  const W=620,H=230,left=42,right=18,top=20,bottom=35,plotW=W-left-right,plotH=H-top-bottom;
  const x=i=>left+(days.length===1?plotW/2:i*plotW/6);
  const y=v=>top+plotH-(v/10)*plotH;
  let svg=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Graf času na sociálních sítích a délky spánku za posledních sedm dní">`;
  [0,2.5,5,7.5,10].forEach(v=>{svg+=`<line x1="${left}" y1="${y(v)}" x2="${W-right}" y2="${y(v)}" stroke="#edf0f6" stroke-width="1"/><text x="${left-10}" y="${y(v)+4}" fill="#a1a9b7" font-size="10" text-anchor="end">${v}</text>`;});
  const path=(key,scale)=>days.map((d,i)=>d.entry?`${i?"L":"M"} ${x(i)} ${y(Math.min(10,Number(d.entry[key])*scale))}`:"").filter(Boolean).join(" ");
  // Break lines where dates are missing.
  const segments=key=>{let out=[],cur=[];days.forEach((d,i)=>{if(d.entry)cur.push([x(i),y(Math.min(10,Number(d.entry[key])*(key==="socialMinutes"?1/60:1)))]);else if(cur.length){out.push(cur);cur=[];}});if(cur.length)out.push(cur);return out;};
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
    insights.push(["◷","Čas na sítích",`Za posledních 7 dní máš průměr ${minutesLabel(s)} denně. Ber to jako orientační přehled, ne jako dobré nebo špatné skóre.`]);
    insights.push(["☾","Spánek",`Průměrná délka spánku v záznamech je ${hoursLabel(sl)}. Kvalita spánku se může lišit den ode dne.`]);
    insights.push(["☺","Nálada",`Průměrné hodnocení nálady je ${m.toFixed(1).replace(".",",")} z 5. Jednotlivé hodnocení je subjektivní a běžně kolísá.`]);
    if(list.length>=5) {
      const evening=average(list,"bedMinutes");
      insights.push(["⌁","Večerní používání",`Před spaním zaznamenáváš průměrně ${minutesLabel(evening)} na sítích. Zkus si všimnout, jestli se to pojí s tím, jak se ti usíná.`]);
    }
  }
  $("insights").innerHTML=insights.slice(0,4).map(i=>`<div class="insight-card"><span class="insight-symbol">${i[0]}</span><div><strong>${i[1]}</strong><p>${i[2]}</p></div></div>`).join("");
}
function entryRow(e,full=true) {
  const cols=`<div class="entry-metric">${minutesLabel(e.socialMinutes)}<small>na sítích</small></div>
  <div class="entry-metric">${hoursLabel(e.sleepHours)}<small>spánek</small></div>
  ${full?`<div class="entry-metric">${e.sleepQuality}/5<small>kvalita spánku</small></div>`:""}
  <div class="mood-pill"><span>${["","😞","🙁","😐","🙂","😄"][e.mood]||"—"}</span><span>${e.mood}/5</span></div>`;
  return `<div class="entry-row"><div><div class="entry-date">${formatDate(e.date,{weekday:"short",day:"numeric",month:"short",year:"numeric"})}</div><div class="entry-sub">${e.notes?esc(e.notes.slice(0,46))+(e.notes.length>46?"…":""):"Denní check-in"}</div></div>${cols}<div class="row-actions"><button class="icon-button" data-edit="${e.id}" aria-label="Upravit záznam" title="Upravit">✎</button><button class="icon-button" data-delete="${e.id}" aria-label="Smazat záznam" title="Smazat">×</button></div></div>`;
}
function wireRowButtons() {
  document.querySelectorAll("[data-edit]").forEach(b=>b.addEventListener("click",()=>{const e=entries.find(x=>x.id===b.dataset.edit);if(e)openForm(e);}));
  document.querySelectorAll("[data-delete]").forEach(b=>b.addEventListener("click",()=>{const e=entries.find(x=>x.id===b.dataset.delete);if(e&&confirm(`Opravdu smazat záznam z ${formatDate(e.date,{day:"numeric",month:"long",year:"numeric"})}?`)){entries=entries.filter(x=>x.id!==e.id);saveEntries();renderDashboard();renderHistory();showToast("Záznam byl smazán.");}}));
}
function renderHistory() {
  $("historyCount").textContent=`${entries.length} ${entries.length===1?"záznam":entries.length>=2&&entries.length<=4?"záznamy":"záznamů"}`;
  $("historyEntries").innerHTML=entries.length?entries.map(e=>entryRow(e,true)).join(""):'<div class="empty-state">Zatím nemáš žádné záznamy.</div>';
  wireRowButtons();
}
$("exportCsv").addEventListener("click",()=>{
  if(!entries.length){showToast("Nejdřív vytvoř alespoň jeden záznam.");return;}
  const headers=["datum","cas_na_sitich_min","siti_pred_spanim_min","spanek_hodiny","kvalita_spanku_1_5","nalada_1_5","poznamka"];
  const quote=v=>`"${String(v??"").replace(/"/g,'""')}"`;
  const rows=entries.map(e=>[e.date,e.socialMinutes,e.bedMinutes,e.sleepHours,e.sleepQuality,e.mood,e.notes].map(quote).join(";"));
  downloadBlob("\uFEFF"+[headers.join(";"),...rows].join("\r\n"),"mindtrack-data.csv","text/csv;charset=utf-8");
  showToast("CSV export byl připraven.");
});
$("importJson").addEventListener("change",async e=>{
  const file=e.target.files?.[0];if(!file)return;
  try {
    const raw=JSON.parse(await file.text());
    const imported=Array.isArray(raw)?raw:raw.entries;
    if(!Array.isArray(imported)||!imported.every(validEntry))throw new Error("Neplatný formát");
    if(!confirm(`Importovat ${imported.length} záznamů? Záznamy se stejným datem nahradí stávající.`))return;
    const map=new Map(entries.map(x=>[x.date,x]));
    imported.forEach(x=>map.set(x.date,{...x,id:String(x.id||Date.now()+Math.random())}));
    entries=[...map.values()];saveEntries();renderHistory();renderDashboard();showToast("Import dokončen.");
  } catch { showToast("Soubor se nepodařilo načíst. Použij JSON zálohu z MindTrack."); }
  finally {e.target.value="";}
});
$("clearAll").addEventListener("click",()=>{
  if(!entries.length){showToast("Nemáš žádné záznamy ke smazání.");return;}
  if(confirm("Opravdu chceš trvale smazat všechny MindTrack záznamy z tohoto prohlížeče? Pokud nemáš export, nepůjdou obnovit.")){
    entries=[];saveEntries();renderDashboard();renderHistory();showToast("Všechny záznamy byly smazány.");
  }
});
function downloadBlob(content,name,type) {
  const blob=new Blob([content],{type});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
// JSON backup is available through a small secondary shortcut in the history heading.
const backupButton=document.createElement("button");
backupButton.className="button button-secondary";backupButton.textContent="↓ Záloha JSON";
backupButton.addEventListener("click",()=>{
  if(!entries.length){showToast("Nejdřív vytvoř alespoň jeden záznam.");return;}
  downloadBlob(JSON.stringify({app:"MindTrack",version:1,exportedAt:new Date().toISOString(),entries},null,2),"mindtrack-zaloha.json","application/json");
  showToast("JSON záloha byla připravena.");
});
$("exportCsv").parentElement.appendChild(backupButton);
renderDashboard();
if("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js").catch(()=>{}));
}
