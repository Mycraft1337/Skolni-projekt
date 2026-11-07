/* Shared validation and research export. No names or free-text notes in v2. */
(function (root) {
  const dateISO = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  function yesterday(now = new Date()) { const d = new Date(now); d.setDate(d.getDate()-1); return dateISO(d); }
  function validDate(s) {
    if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
    const d = new Date(s+'T12:00:00'); return !Number.isNaN(+d) && dateISO(d) === s;
  }
  const today = () => dateISO(new Date());
  function shiftDay(day, offset) { const d=new Date(day+'T12:00:00');d.setDate(d.getDate()+offset);return dateISO(d); }
  const hasEvening = e => e?.socialMinutes != null && e?.mood != null;
  const hasMorning = e => e?.sleepHours != null && e?.sleepQuality != null;
  function validate(e, latest = today()) {
    if (!e || ![2,3,4].includes(e.schemaVersion)) return 'Nepodporovaná verze záznamu.';
    if (!validDate(e.date) || e.date < '2020-01-01' || e.date > latest) return 'Vyber platné datum od roku 2020, nejpozději dnešek.';
    if(e.schemaVersion===4) {
      const evening=hasEvening(e), morning=hasMorning(e);
      if(!evening&&!morning) return 'Vyplň alespoň ranní nebo večerní zápis.';
      if((e.socialMinutes!=null)!==(e.mood!=null)) return 'Doplň obě večerní odpovědi.';
      if((e.sleepHours!=null)!==(e.sleepQuality!=null) || (typeof e.beforeBed==='boolean')!==morning) return 'Doplň všechny ranní odpovědi.';
      if(!morning && e.beforeBed!=null) return 'Neplatná ranní odpověď.';
    }
    for(const k of ['morningRecordedAt','eveningRecordedAt','morningReceivedAt','eveningReceivedAt'])if(e[k]!=null&&(typeof e[k]!=='string'||!Number.isFinite(Date.parse(e[k]))))return 'Neplatný čas záznamu.';
    if(hasMorning(e) && e.date>=latest) return 'Spánek zapiš až následující ráno.';
    for (const [key,min,max,integer] of [['socialMinutes',0,1440,true],['sleepHours',0,24,false],['sleepQuality',1,5,true],['mood',1,5,true]]) {
      const v=e[key]; if(e.schemaVersion===4 && v==null)continue; if (typeof v !== 'number' || !Number.isFinite(v) || v<min || v>max || (integer && !Number.isInteger(v))) return 'Zkontroluj vyplněné hodnoty a jejich rozsah.';
    }
    if(e.schemaVersion===3 && typeof e.beforeBed !== 'boolean') return 'Vyber Ano nebo Ne u používání před spaním.';
    if(e.schemaVersion===3 && e.beforeBed && e.socialMinutes===0) return 'Používání před spaním je součástí celkového času na sítích.';
    if(e.schemaVersion===2 && (!Number.isInteger(e.bedMinutes)||e.bedMinutes<0||e.bedMinutes>60)) return 'Neplatný starší čas před spaním.';
    if (e.schemaVersion===2 && e.bedMinutes>e.socialMinutes) return 'Čas na sítích před spaním nemůže být vyšší než celkový čas na sítích.';
    return '';
  }
  function clean(e) { return {...Object.fromEntries(['morningRecordedAt','eveningRecordedAt','morningReceivedAt','eveningReceivedAt'].filter(k=>e[k]!=null).map(k=>[k,e[k]])),schemaVersion:e.schemaVersion, date:e.date, socialMinutes:e.socialMinutes??null, ...(e.schemaVersion===2?{bedMinutes:e.bedMinutes}:{beforeBed:e.beforeBed??null}), sleepHours:e.sleepHours??null, sleepQuality:e.sleepQuality??null, mood:e.mood??null}; }
  function row(e,userId) { return {user_id:userId,day:e.date,morning_recorded_at:e.morningRecordedAt??null,evening_recorded_at:e.eveningRecordedAt??null,social_minutes:e.socialMinutes,bed_minutes:e.schemaVersion===2?e.bedMinutes:null,before_bed:e.schemaVersion>=3?e.beforeBed:null,sleep_hours:e.sleepHours,sleep_quality:e.sleepQuality,mood:e.mood??null}; }
  function fromRow(r) { return clean({schemaVersion:r.bed_minutes!=null?2:4,date:r.day,morningRecordedAt:r.morning_recorded_at,eveningRecordedAt:r.evening_recorded_at,morningReceivedAt:r.morning_received_at,eveningReceivedAt:r.evening_received_at,socialMinutes:r.social_minutes,bedMinutes:r.bed_minutes,beforeBed:r.before_bed,sleepHours:r.sleep_hours==null?null:Number(r.sleep_hours),sleepQuality:r.sleep_quality,mood:r.mood}); }
  function csv(entries) {
    const headers=['verze','den_socialnich_siti_a_nalady','site_min','site_pred_spanim_ano_ne','puvodni_cas_pred_spanim_min','nasledujici_spanek_min','kvalita_nasledujiciho_spanku_1_5','nalada_1_5','rano_zapsano_UTC','vecer_zapsano_UTC','rano_prijato_UTC','vecer_prijato_UTC'];
    return '\uFEFF'+[headers.join(';'),...entries.map(e=>[e.schemaVersion,e.date,e.socialMinutes,typeof e.beforeBed==='boolean'?(e.beforeBed?'ano':'ne'):'',e.schemaVersion===2?e.bedMinutes:'',e.sleepHours==null?'':Math.round(e.sleepHours*60),e.sleepQuality,e.mood,e.morningRecordedAt,e.eveningRecordedAt,e.morningReceivedAt,e.eveningReceivedAt].map(x=>'"'+String(x??'').replace(/"/g,'""')+'"').join(';'))].join('\r\n');
  }
  function parseBackup(text) {
    const data=JSON.parse(text);
    if (![2,3,4].includes(data.version) || !Array.isArray(data.entries)) throw Error('Starší záloha má jinak přiřazený spánek. Uchovej ji odděleně; import podporuje verze 2, 3 a 4.');
    if (data.entries.some(e=>validate(e))) throw Error('Záloha obsahuje neplatný záznam. Nic nebylo importováno.');
    if(new Set(data.entries.map(e=>e.date)).size!==data.entries.length) throw Error('Záloha obsahuje opakované datum.');
    return data.entries.map(clean);
  }
  const api={today,shiftDay,hasMorning,hasEvening,dateISO,yesterday,validDate,validate,clean,row,fromRow,csv,parseBackup};
  if (typeof module !== 'undefined' && module.exports) module.exports=api; else root.MindTrackCore=api;
})(globalThis);
