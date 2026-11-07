import {createClient} from 'npm:@supabase/supabase-js@2.49.8';
import webpush from 'npm:web-push@3.6.7';
import {localClock,previousDay,isDue,validTime,validSubscription} from './logic.js';
const SITE='https://mycraft1337.github.io/Skolni-projekt/';
const db=createClient(Deno.env.get('SUPABASE_URL'),Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),{auth:{persistSession:false,autoRefreshToken:false}});
const cors={'Access-Control-Allow-Origin':'https://mycraft1337.github.io','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS','Vary':'Origin'};
const reply=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{...cors,'Content-Type':'application/json'}});
function check(r){if(r.error)throw Error('database');return r.data;}
async function config(){
 let c=check(await db.from('mindtrack_push_config').select('*').eq('id',1).single());
 if(!c.vapid_public){const k=webpush.generateVAPIDKeys();check(await db.from('mindtrack_push_config').update({vapid_public:k.publicKey,vapid_private:k.privateKey}).eq('id',1).is('vapid_public',null));c=check(await db.from('mindtrack_push_config').select('*').eq('id',1).single());}
 return c;
}
async function send(subscription,payload,c){
 if(!validSubscription(subscription))return 400;
 const req=webpush.generateRequestDetails(subscription,JSON.stringify(payload),{TTL:900,urgency:'normal',vapidDetails:{subject:SITE,publicKey:c.vapid_public,privateKey:c.vapid_private}});
 // No redirects to arbitrary hosts, and no raw endpoint/error data in logs.
 const r=await fetch(req.endpoint,{method:'POST',headers:req.headers,body:req.body,redirect:'error',signal:AbortSignal.timeout(10000)});
 await r.body?.cancel();return r.status;
}
function payload(period,day){return {title:period==='morning'?'MindTrack · ranní zápis':'MindTrack · večerní zápis',body:period==='morning'?'Jaká byla tvoje noc? Zapiš si spánek.':'Jaký byl tvůj den? Zapiš sítě a náladu.',period,day,tag:`mindtrack-${day}-${period}`};}
async function tick(c){
 const subscriptions=check(await db.from('mindtrack_push_subscriptions').select('*').order('user_id').limit(1000));
 let sent=0,skipped=0,failed=0;
 for(const s of subscriptions){
  let clock;try{clock=localClock(s.timezone);}catch{continue;}
  for(const period of ['morning','evening']){
   if(!isDue(s[period],clock.minute))continue;
   const claim=await db.from('mindtrack_push_deliveries').insert({user_id:s.user_id,day:clock.day,period,status:'claimed'});
   if(claim.error?.code==='23505')continue;check(claim);
   let result='failed';
   try{
    const entryDay=period==='morning'?previousDay(clock.day):clock.day;
    const entry=check(await db.from('mindtrack_entries').select('sleep_hours,social_minutes').eq('user_id',s.user_id).eq('day',entryDay).maybeSingle());
    const current=check(await db.from('mindtrack_push_subscriptions').select('*').eq('user_id',s.user_id).maybeSingle());
    if(!current||current.updated_at!==s.updated_at||entry?.[period==='morning'?'sleep_hours':'social_minutes']!=null){result='skipped';skipped++;}
    else{
     const code=await send(current.subscription,payload(period,clock.day),c);
     if(code>=200&&code<300){result='sent';sent++;}else{failed++;if(code===404||code===410)check(await db.from('mindtrack_push_subscriptions').delete().eq('user_id',s.user_id).eq('updated_at',s.updated_at));}
    }
   }catch{failed++;}
   check(await db.from('mindtrack_push_deliveries').update({status:result}).eq('user_id',s.user_id).eq('day',clock.day).eq('period',period));
  }
 }
 // Retain only recent technical delivery records.
 check(await db.from('mindtrack_push_deliveries').delete().lt('day',new Date(Date.now()-30*864e5).toISOString().slice(0,10)));
 return {sent,skipped,failed};
}
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response(null,{headers:cors});
 if(req.method!=='POST')return reply({error:'Method not allowed'},405);
 try{
  const raw=await req.text();if(raw.length>10000)return reply({error:'Too large'},413);
  let body;try{body=JSON.parse(raw);}catch{return reply({error:'Invalid JSON'},400);}
  if(body.action==='tick'){
   // Scheduler token is generated inside Postgres and never exposed to clients or Git.
   const token=req.headers.get('x-mindtrack-cron');if(!token)return reply({error:'Unauthorized'},401);
   const c=await config();if(token!==c.cron_token)return reply({error:'Unauthorized'},401);
   return reply(await tick(c));
  }
  const jwt=req.headers.get('authorization')?.replace(/^Bearer\s+/i,'');if(!jwt)return reply({error:'Unauthorized'},401);
  const {data,error}=await db.auth.getUser(jwt);if(error||!data.user)return reply({error:'Unauthorized'},401);
  const user=data.user.id;
  if(body.action==='disable'){check(await db.from('mindtrack_push_subscriptions').delete().eq('user_id',user));return reply({ok:true});}
  if(body.action==='status'){
   const s=check(await db.from('mindtrack_push_subscriptions').select('morning,evening,timezone').eq('user_id',user).maybeSingle());return reply({settings:s});
  }
  if(body.action==='key')return reply({publicKey:(await config()).vapid_public});
  if(body.action==='save'){
   if(!validSubscription(body.subscription)||!validTime(body.morning)||!validTime(body.evening)||(!body.morning&&!body.evening))return reply({error:'Neplatné nastavení připomínek.'},400);
   if(typeof body.timezone!=='string'||body.timezone.length>80)return reply({error:'Neplatné časové pásmo.'},400);
   try{localClock(body.timezone);}catch{return reply({error:'Neplatné časové pásmo.'},400);}
   check(await db.from('mindtrack_push_subscriptions').upsert({user_id:user,subscription:body.subscription,morning:body.morning,evening:body.evening,timezone:body.timezone,updated_at:new Date().toISOString()},{onConflict:'user_id'}));return reply({ok:true});
  }
  if(body.action==='test'){
   const s=check(await db.from('mindtrack_push_subscriptions').update({last_test_at:new Date().toISOString()}).eq('user_id',user).or(`last_test_at.is.null,last_test_at.lt.${new Date(Date.now()-60000).toISOString()}`).select('*').maybeSingle());
   if(!s)return reply({error:'Nejprve zapni připomínky. Další test lze poslat za minutu.'},429);
   const code=await send(s.subscription,{title:'MindTrack · zkouška',body:'Připomínky na tomto zařízení fungují.',tag:'mindtrack-test'},await config());
   if(code===404||code===410)check(await db.from('mindtrack_push_subscriptions').delete().eq('user_id',user).eq('updated_at',s.updated_at));
   return code>=200&&code<300?reply({ok:true}):reply({error:'Doručení se nepodařilo. Zkus připomínky vypnout a znovu zapnout.'},502);
  }
  return reply({error:'Unknown action'},400);
 }catch{return reply({error:'Služba připomínek je dočasně nedostupná. Zkus to znovu.'},500);}
});
