/* Shared validation and research export. No names or free-text notes in v2. */
(function (root) {
  const dateISO = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  function yesterday(now = new Date()) { const d = new Date(now); d.setDate(d.getDate()-1); return dateISO(d); }
  function validDate(s) {
    if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
    const d = new Date(s+'T12:00:00'); return !Number.isNaN(+d) && dateISO(d) === s;
  }
  function validate(e, latest = yesterday()) {
    if (!e || ![2,3].includes(e.schemaVersion)) return 'Použij podporovaný záznam verze 2 nebo 3.';
    if (!validDate(e.date) || e.date < '2020-01-01' || e.date > latest) return 'Vyber dokončený den od roku 2020, nejpozději včerejšek.';
    for (const [key,min,max,integer] of [['socialMinutes',0,1440,true],['sleepHours',0,24,false],['sleepQuality',1,5,true],['mood',1,5,true]]) {
      const v=e[key]; if (typeof v !== 'number' || !Number.isFinite(v) || v<min || v>max || (integer && !Number.isInteger(v))) return 'Zkontroluj vyplněné hodnoty a jejich rozsah.';
    }
    if(e.schemaVersion===3 && typeof e.beforeBed !== 'boolean') return 'Vyber Ano nebo Ne u používání před spaním.';
    if(e.schemaVersion===3 && e.beforeBed && e.socialMinutes===0) return 'Používání před spaním je součástí celkového času na sítích.';
    if(e.schemaVersion===2 && (!Number.isInteger(e.bedMinutes)||e.bedMinutes<0||e.bedMinutes>60)) return 'Neplatný starší čas před spaním.';
    if (e.schemaVersion===2 && e.bedMinutes>e.socialMinutes) return 'Čas na sítích před spaním nemůže být vyšší než celkový čas na sítích.';
    return '';
  }
  function clean(e) { return {schemaVersion:e.schemaVersion, date:e.date, socialMinutes:e.socialMinutes, ...(e.schemaVersion===2?{bedMinutes:e.bedMinutes}:{beforeBed:e.beforeBed}), sleepHours:e.sleepHours, sleepQuality:e.sleepQuality, mood:e.mood}; }
  function row(e,userId) { return {user_id:userId,day:e.date,social_minutes:e.socialMinutes,bed_minutes:e.schemaVersion===2?e.bedMinutes:null,before_bed:e.schemaVersion===3?e.beforeBed:null,sleep_hours:e.sleepHours,sleep_quality:e.sleepQuality,mood:e.mood}; }
  function fromRow(r) { return clean({schemaVersion:typeof r.before_bed==='boolean'?3:2,date:r.day,socialMinutes:r.social_minutes,bedMinutes:r.bed_minutes,beforeBed:r.before_bed,sleepHours:Number(r.sleep_hours),sleepQuality:r.sleep_quality,mood:r.mood}); }
  function csv(entries) {
    const headers=['verze','den_socialnich_siti_a_nalady','site_min','site_pred_spanim_ano_ne','puvodni_cas_pred_spanim_min','nasledujici_spanek_h','kvalita_nasledujiciho_spanku_1_5','nalada_1_5'];
    return '\uFEFF'+[headers.join(';'),...entries.map(e=>[e.schemaVersion,e.date,e.socialMinutes,e.schemaVersion===3?(e.beforeBed?'ano':'ne'):'',e.schemaVersion===2?e.bedMinutes:'',e.sleepHours,e.sleepQuality,e.mood].map(x=>'"'+String(x).replace(/"/g,'""')+'"').join(';'))].join('\r\n');
  }
  function parseBackup(text) {
    const data=JSON.parse(text);
    if (![2,3].includes(data.version) || !Array.isArray(data.entries)) throw Error('Starší záloha má jinak přiřazený spánek. Uchovej ji odděleně; import podporuje verze 2 a 3.');
    if (data.entries.some(e=>validate(e))) throw Error('Záloha obsahuje neplatný záznam. Nic nebylo importováno.');
    if(new Set(data.entries.map(e=>e.date)).size!==data.entries.length) throw Error('Záloha obsahuje opakované datum.');
    return data.entries.map(clean);
  }
  const api={dateISO,yesterday,validDate,validate,clean,row,fromRow,csv,parseBackup};
  if (typeof module !== 'undefined' && module.exports) module.exports=api; else root.MindTrackCore=api;
})(globalThis);
