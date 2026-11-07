export function localClock(timeZone, now=new Date()) {
 const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(now).map(x=>[x.type,x.value]));
 return {day:`${parts.year}-${parts.month}-${parts.day}`,minute:Number(parts.hour)*60+Number(parts.minute)};
}
export function previousDay(day){const d=new Date(day+'T12:00:00Z');d.setUTCDate(d.getUTCDate()-1);return d.toISOString().slice(0,10);}
export function isDue(time,minute){if(!time)return false;const [h,m]=time.split(':').map(Number);const delta=minute-h*60-m;return delta>=0&&delta<15;}
export function validTime(t){return t===null || typeof t==='string'&&/^([01]\d|2[0-3]):[0-5]\d$/.test(t);}
export function validSubscription(s){
 try{
  const u=new URL(s.endpoint),host=u.hostname;
  const allowed=host==='fcm.googleapis.com'||host==='updates.push.services.mozilla.com'||host==='web.push.apple.com'||host.endsWith('.push.apple.com')||host.endsWith('.notify.windows.com');
  return allowed&&u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&u.href.length<4096&&typeof s.keys?.p256dh==='string'&&/^[A-Za-z0-9_-]{87}=?$/.test(s.keys.p256dh)&&typeof s.keys?.auth==='string'&&/^[A-Za-z0-9_-]{22}={0,2}$/.test(s.keys.auth);
 }catch{return false;}
}
