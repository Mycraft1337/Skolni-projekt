import {createClient} from 'npm:@supabase/supabase-js@2.49.8';
const db=createClient(Deno.env.get('SUPABASE_URL'),Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),{auth:{persistSession:false}});
const headers={'Access-Control-Allow-Origin':'https://mycraft1337.github.io','Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Content-Type':'application/json','Cache-Control':'no-store'};
const reply=(data,status=200)=>new Response(JSON.stringify(data),{status,headers});
function check(r){if(r.error)throw Error('database');return r.data;}
async function owner(id){return check(await db.from('mindtrack_device_links').select('owner_id').eq('device_id',id).maybeSingle())?.owner_id||id;}
async function digest(code){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(code)))].map(b=>b.toString(16).padStart(2,'0')).join('');}
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return reply({});if(req.method!=='POST')return reply({error:'Method'},405);
 try{
 const raw=await req.text();if(raw.length>4096)return reply({error:'Too large'},413);const b=JSON.parse(raw);
 if(b.action==='research'){
  if(typeof b.key!=='string'||b.key.length!==72)return reply({error:'Neplatný klíč správce.'},401);
  const cfg=check(await db.from('mindtrack_push_config').select('research_token').eq('id',1).single());
  if(await digest(b.key)!==await digest(cfg.research_token))return reply({error:'Neplatný klíč správce.'},401);
  const offset=Number(b.offset||0);if(!Number.isInteger(offset)||offset<0||offset>1000000)return reply({error:'Rozsah'},400);
  if(b.table==='participants')return reply({rows:check(await db.from('mindtrack_participants').select('user_id,consent_at').order('user_id').range(offset,offset+499))});
  return reply({rows:check(await db.from('mindtrack_entries').select('user_id,day,social_minutes,sleep_minutes,sleep_hours,sleep_quality,mood,before_bed,bed_minutes,morning_recorded_at,evening_recorded_at,morning_received_at,evening_received_at').order('user_id').order('day').range(offset,offset+499))});
 }
 const jwt=req.headers.get('authorization')?.replace(/^Bearer\s+/i,'');if(!jwt)return reply({error:'Přihlášení chybí.'},401);
 const {data,error}=await db.auth.getUser(jwt);if(error||!data.user)return reply({error:'Přihlášení není platné.'},401);
 const device=data.user.id,canonical=await owner(device);
 if(b.action==='create-code'){
  const code=[...crypto.getRandomValues(new Uint8Array(32))].map(v=>v.toString(16).padStart(2,'0')).join('');
  check(await db.from('mindtrack_recovery').upsert({owner_id:canonical,token_hash:await digest(code)}));return reply({code});
 }
 if(b.action==='recover'){
  if(typeof b.code!=='string'||!/^[a-f0-9]{64}$/.test(b.code))return reply({error:'Neplatný obnovovací kód.'},400);
  const saved=check(await db.from('mindtrack_recovery').select('owner_id').eq('token_hash',await digest(b.code)).maybeSingle());
  if(!saved)return reply({error:'Kód není platný nebo byl nahrazen.'},403);
  if(saved.owner_id!==canonical){
   const own=check(await db.from('mindtrack_participants').select('user_id').eq('user_id',device).maybeSingle());
   const ownCode=check(await db.from('mindtrack_recovery').select('owner_id').eq('owner_id',device).maybeSingle());
   if(own||ownCode)return reply({error:'Tento prohlížeč už má vlastní účast. Pro obnovení použij nový profil prohlížeče nebo zařízení.'},409);
   check(await db.from('mindtrack_device_links').upsert({device_id:device,owner_id:saved.owner_id}));
  }
  return reply({ownerId:saved.owner_id});
 }
 return reply({error:'Unknown action'},400);
 }catch{return reply({error:'Operaci se nepodařilo dokončit. Zkus to znovu online.'},500);}
});
