(()=>{
 const $=id=>document.getElementById(id),C=MindTrackCore;let rows=[],people=[],key='';
 async function pages(table){const all=[];for(let offset=0;;offset+=500){const r=await fetch(MINDTRACK_CONFIG.url+'/functions/v1/mindtrack-account',{method:'POST',headers:{'Content-Type':'application/json',apikey:MINDTRACK_CONFIG.publishableKey},body:JSON.stringify({action:'research',key,table,offset}),cache:'no-store'});const d=await r.json();if(!r.ok)throw Error(d.error||'Načtení se nepodařilo.');all.push(...d.rows);if(d.rows.length<500)return all;}}
 function render(){
  const n=Number($('researchRange').value),end=C.yesterday(),start=C.shiftDay(end,1-n);
  $('researchSummary').textContent=people.length+' účastníků · '+rows.length+' řádků celkem · období '+start+' až '+end;
  const index=new Map(rows.map(r=>[r.user_id+':'+r.day,r]));$('researchRows').replaceChildren();
  for(const p of people){let complete=0,missingMorning=0,missingEvening=0;const joined=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Prague',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(p.consent_at));
   for(let d=start;d<=end;d=C.shiftDay(d,1)){if(d<joined)continue;const r=index.get(p.user_id+':'+d);const m=r?.sleep_hours!=null,e=r?.social_minutes!=null;if(m&&e)complete++;if(!m)missingMorning++;if(!e)missingEvening++;}
   const tr=document.createElement('tr');for(const v of [p.user_id,complete,missingMorning,missingEvening]){const td=document.createElement('td');td.textContent=v;tr.append(td);}$('researchRows').append(tr);
  }
 }
 $('researchLogin').onsubmit=async e=>{e.preventDefault();key=$('researchKey').value.trim();$('researchKey').value='';$('researchStatus').textContent='Načítám…';$('researchContent').hidden=true;try{people=await pages('participants');rows=await pages('entries');render();$('researchContent').hidden=false;$('researchStatus').textContent='Načteno '+new Date().toLocaleString('cs-CZ');}catch(err){rows=[];people=[];$('researchStatus').textContent=err.message;}finally{key='';}};
 $('researchRange').onchange=render;
 $('researchLogout').onclick=()=>{rows=[];people=[];key='';$('researchRows').replaceChildren();$('researchContent').hidden=true;$('researchStatus').textContent='Přehled zamčený.';};
 $('researchExport').onclick=()=>{const fields=['user_id','day','social_minutes','mood','sleep_minutes','sleep_quality','before_bed','bed_minutes','morning_recorded_at','evening_recorded_at','morning_received_at','evening_received_at'];const csv='\uFEFF'+[fields.join(';'),...rows.map(r=>fields.map(k=>'"'+String(r[k]??'').replace(/"/g,'""')+'"').join(';'))].join('\r\n');const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='mindtrack-vyzkum.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
})();
