/* Optional Web Push. No permission prompt until the user presses Save/Enable. */
window.MindTrackReminders=class {
 constructor(cloud,getOwner,setOwner){
  this.cloud=cloud;this.getOwner=getOwner;this.setOwner=setOwner;this.busy=false;
  this.$=id=>document.getElementById(id);
  this.$('reminderSettings').onclick=()=>this.open();
  this.$('closeReminders').onclick=()=>{if(!this.busy)this.$('reminderDialog').close();};
  this.$('reminderForm').onsubmit=e=>{e.preventDefault();this.save();};
  this.$('disableReminders').onclick=()=>this.disable();
  this.$('testReminder').onclick=()=>this.test();
  for(const p of ['morning','evening'])this.$(p+'ReminderEnabled').onchange=()=>this.$(p+'ReminderTime').disabled=!this.$(p+'ReminderEnabled').checked;
 }
 supported(){return 'serviceWorker' in navigator&&'PushManager' in window&&'Notification' in window;}
 message(s){this.$('reminderMessage').textContent=s;}
 lock(value){this.busy=value;for(const id of ['saveReminders','disableReminders','testReminder','closeReminders'])this.$(id).disabled=value;}
 async api(action,extra={},create=false){
  await this.cloud.identify(this.getOwner(),create);this.setOwner(this.cloud.userId);
  const {data,error}=await this.cloud.client.functions.invoke('mindtrack-push',{body:{action,...extra}});
  if(error){let message;try{message=(await error.context.json()).error;}catch{}throw Error(message||'Připojení se nepodařilo. Zkus to znovu online.');}
  if(data?.error)throw Error(data.error);return data;
 }
 setFields(s){for(const p of ['morning','evening']){this.$(p+'ReminderEnabled').checked=!!s[p];this.$(p+'ReminderTime').value=s[p]?.slice(0,5)||(p==='morning'?'08:00':'20:00');this.$(p+'ReminderTime').disabled=!s[p];}}
 async registration(){
  await navigator.serviceWorker.register('./sw.js');
  return Promise.race([navigator.serviceWorker.ready,new Promise((_,reject)=>setTimeout(()=>reject(Error('Aplikace se ještě připravuje. Obnov stránku a zkus to znovu.')),15000))]);
 }
 async open(){
  this.$('reminderDialog').showModal();
  this.setFields({morning:'08:00',evening:'20:00'});
  this.$('reminderTimezone').textContent=Intl.DateTimeFormat().resolvedOptions().timeZone;
  const ios=/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
  this.$('iosPushHelp').hidden=!(ios&&!window.matchMedia('(display-mode: standalone)').matches&&!navigator.standalone);
  this.$('saveReminders').disabled=!this.supported();
  this.$('testReminder').disabled=!this.supported();
  this.message(this.supported()?'Připomínky jsou volitelné. Aktivují se až po uložení a povolení oznámení.':'Tento prohlížeč oznámení nepodporuje. Na iPhonu otevři aplikaci z plochy.');
  if(this.getOwner()){
   this.lock(true);
   try{const r=await this.api('status');if(r.settings){this.setFields(r.settings);this.message('Připomínky jsou zapnuté. Uložené časové pásmo: '+r.settings.timezone+'. Uložením použiješ aktuální pásmo zařízení.');}else this.message('Připomínky jsou vypnuté.');}
   catch(e){this.message(e.message);}finally{this.lock(false);this.$('saveReminders').disabled=!this.supported();this.$('testReminder').disabled=!this.supported();}
  }
 }
 async save(){
  if(this.busy||!this.supported())return;
  const settings={timezone:Intl.DateTimeFormat().resolvedOptions().timeZone};
  for(const p of ['morning','evening'])settings[p]=this.$(p+'ReminderEnabled').checked?this.$(p+'ReminderTime').value:null;
  if(!settings.morning&&!settings.evening){this.message('Vyber alespoň jednu připomínku, nebo použij Vypnout připomínky.');return;}
  if(Object.values(settings).some(v=>v==='')){this.message('Vyber čas připomínky.');return;}
  // Call within the click/submit gesture before any network await (required on iOS).
  const permission=Notification.permission==='default'?Notification.requestPermission():Promise.resolve(Notification.permission);
  this.lock(true);
  let subscription,created=false;
  try{
   if(await permission!=='granted')throw Error('Oznámení nejsou povolená. Pokud jsi je dříve zamítl/a, změň oprávnění v nastavení prohlížeče nebo telefonu.');
   const reg=await this.registration(),r=await this.api('key',{},true);
   subscription=await reg.pushManager.getSubscription();
   if(!subscription){const b64=r.publicKey.replace(/-/g,'+').replace(/_/g,'/');const key=Uint8Array.from(atob(b64+'='.repeat((4-b64.length%4)%4)),c=>c.charCodeAt(0));subscription=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:key});created=true;}
   await this.api('save',{...settings,subscription:subscription.toJSON()});
   this.message('Připomínky jsou zapnuté. Můžeš poslat zkušební oznámení.');
  }catch(e){if(created)await subscription?.unsubscribe().catch(()=>{});this.message(e.message);}
  finally{this.lock(false);}
 }
 async disable(){
  if(this.busy)return;this.lock(true);let serverError=null;
  try{
   if(this.getOwner())try{await this.api('disable');}catch(e){serverError=e;}
   if('serviceWorker' in navigator){const reg=await navigator.serviceWorker.getRegistration();const sub=await reg?.pushManager?.getSubscription();if(sub)await sub.unsubscribe();}
   this.message(serverError?'Odběr v zařízení byl vypnut. Nastavení na serveru se nepodařilo smazat; zopakuj vypnutí online.':'Připomínky jsou vypnuté.');
  }catch(e){this.message('Vypnutí se nepodařilo dokončit: '+e.message);}finally{this.lock(false);}
 }
 async test(){if(this.busy)return;this.lock(true);try{await this.api('test');this.message('Zkušební oznámení bylo předáno doručovací službě. Zkontroluj oznámení telefonu.');}catch(e){this.message(e.message);}finally{this.lock(false);}}
};
