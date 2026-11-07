function renderCalendar(){
 const month=document.getElementById('historyMonth').value;if(!/^\d{4}-\d{2}$/.test(month))return;
 const first=new Date(month+'-01T12:00:00'),count=new Date(first.getFullYear(),first.getMonth()+1,0).getDate();
 const cells=Array.from({length:(first.getDay()+6)%7},()=>'<span></span>');
 for(let n=1;n<=count;n++){
  const day=month+'-'+String(n).padStart(2,'0'),morning=entries.find(e=>e.date===C.shiftDay(day,-1)),evening=entries.find(e=>e.date===day),future=day>C.today();
  cells.push(`<button type="button" data-calendar="${day}" ${future?'disabled':''}><strong>${n}</strong><span>Ráno ${C.hasMorning(morning)?'✓':'—'}</span><span>Večer ${C.hasEvening(evening)?'✓':'—'}</span></button>`);
 }
 $('calendar').innerHTML=['Po','Út','St','Čt','Pá','So','Ne'].map(d=>'<strong>'+d+'</strong>').join('')+cells.join('');
 document.querySelectorAll('[data-calendar]').forEach(b=>b.onclick=()=>home(b.dataset.calendar));
}
function initExtras(){
 $('historyMonth').value=C.today().slice(0,7);$('historyMonth').onchange=renderCalendar;renderCalendar();
 $('showGuide').onclick=()=>$('guideDialog').showModal();$('closeGuide').onclick=()=>{localStorage.setItem('mindtrack.guide.v1','done');$('guideDialog').close();};
 if(!localStorage.getItem('mindtrack.guide.v1'))$('guideDialog').showModal();
 $('recoverySettings').onclick=()=>{$('recoveryOutput').value='';$('recoveryOutputLabel').hidden=true;$('recoveryMessage').textContent='';$('recoveryDialog').showModal();};
 $('closeRecovery').onclick=()=>{if(!busy){$('recoveryInput').value='';$('recoveryOutput').value='';$('recoveryDialog').close();}};
 $('createRecovery').onclick=async()=>{
  if(syncing||busy){$('recoveryMessage').textContent='Počkej na dokončení odesílání.';return;}
  if(!confirm('Vytvořit nový kód? Dříve uložený obnovovací kód přestane fungovat.'))return;
  busy=true;
  try{await cloud.identify(state.ownerId,true);state.ownerId=cloud.userId;saveEntries();const r=await cloud.account('create-code');$('recoveryOutput').value=r.code;$('recoveryOutputLabel').hidden=false;$('recoveryMessage').textContent='Kód si bezpečně ulož. Po zavření ho již nezobrazíme.';}
  catch(e){$('recoveryMessage').textContent=e.message;}finally{busy=false;sync();}
 };
 $('loadCloud').onclick=async()=>{await restoreCloud();$('recoveryMessage').textContent=$('syncStatus').textContent;};
 $('recoverForm').onsubmit=async event=>{
  event.preventDefault();if(syncing||busy){$('recoveryMessage').textContent='Počkej na dokončení odesílání.';return;}
  if(entries.length&&!confirm('Obnovení přepne místní historii na původní účast. Nejdříve si případná místní data ulož pomocí JSON zálohy v Historii. Pokračovat?'))return;
  busy=true;
  try{
   const client=await cloud.clientReady();let session=(await client.auth.getSession()).data.session;
   if(!session){const result=await client.auth.signInAnonymously();if(result.error)throw result.error;session=result.data.session;}
   const r=await cloud.account('recover',{code:$('recoveryInput').value.trim()});
   // The server has authorized this device; fetch before replacing local data.
   cloud.userId=r.ownerId;const restored=await cloud.load();
   entries=restored.map(e=>({...e,dirty:false}));state.ownerId=r.ownerId;state.deleted=[];state.deletionVersions={};
   localStorage.removeItem(DRAFT_KEY);saveEntries();$('recoveryInput').value='';$('recoveryMessage').textContent='Účast a odeslaná historie byly obnoveny. Připomínky zapni znovu na tomto zařízení.';refreshStatus();
  }catch(e){$('recoveryMessage').textContent=e.message;}finally{busy=false;}
 };
}
