/* Supabase adapter. Only a public key belongs in config.js. RLS owns authorization. */
(function(root) {
  class MindTrackCloud {
    constructor(config, factory) { this.config=config; this.factory=factory; this.client=null; this.userId=null; }
    async clientReady() {
      if (!this.config.enabled) throw Error('Sdílení čeká na dokončení nastavení Supabase. Záznamy zatím zůstávají v tomto prohlížeči.');
      if (!this.client) {
        if (!this.factory) {
          if(!root.supabase) await new Promise((resolve,reject)=>{
            const script=document.createElement('script');
            script.src='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.8/dist/umd/supabase.js';
            const timer=setTimeout(()=>{script.remove();reject(Error('Připojení se nepodařilo načíst. Zkus to znovu online.'));},12000);
            script.onload=()=>{clearTimeout(timer);resolve();}; script.onerror=()=>{clearTimeout(timer);script.remove();reject(Error('Připojení se nepodařilo načíst.'));};document.head.appendChild(script);
          });
          this.factory=root.supabase.createClient;
        }
        this.client=this.factory(this.config.url,this.config.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,storageKey:'mindtrack.auth.v2'}});
      }
      return this.client;
    }
    async identify(expectedId, allowCreate=false) {
      if(this.identifying)await this.identifying;
      this.identifying=this.identifyOnce(expectedId,allowCreate);
      try{return await this.identifying;}finally{this.identifying=null;}
    }
    async identifyOnce(expectedId, allowCreate=false) {
      const client=await this.clientReady();
      let {data,error}=await client.auth.getSession(); if(error) throw error;
      let session=data.session;
      if(!session) {
        if(expectedId || !allowCreate) throw Error('Původní přihlášení chybí. Exportuj své záznamy a kontaktuj autora projektu; nový účastník se automaticky nevytvoří.');
        const result=await client.auth.signInAnonymously(); if(result.error) throw result.error; session=result.data.session;
      }
      const resolved=await client.rpc('mindtrack_owner');if(resolved.error)throw resolved.error;const owner=resolved.data||session?.user?.id;
      if(!session?.user?.id || (expectedId && owner!==expectedId)) throw Error('Přihlášení neodpovídá účastníkovi v tomto prohlížeči.');
      this.userId=owner;return this.userId;
    }
    async enroll() {
      const current=await this.client.from('mindtrack_participants').select('user_id').eq('user_id',this.userId).maybeSingle();
      if(current.error) throw current.error;
      if(!current.data) {const r=await this.client.from('mindtrack_participants').insert({user_id:this.userId,consent_version:'2026-11-v3-auto-notice'});if(r.error)throw r.error;}
    }
    async upload(entries, deleted) {
      // Tombstones remain locally until the entire operation succeeds; retries are idempotent.
      for(const day of deleted) {const r=await this.client.from('mindtrack_entries').delete().eq('user_id',this.userId).eq('day',day);if(r.error)throw r.error;}
      const saved=[];for(const e of entries){const r=await this.client.rpc('mindtrack_save_entry',{p_record:root.MindTrackCore.row(e,this.userId),p_parts:e.changedParts||['morning','evening']});if(r.error)throw r.error;const row=Array.isArray(r.data)?r.data[0]:r.data;if(!row?.day)throw Error('Server nevrátil potvrzení zápisu.');saved.push(root.MindTrackCore.fromRow(row));}return saved;
    }
    async load() {
      const rows=[];for(let offset=0;;offset+=500){const r=await this.client.from('mindtrack_entries').select('*').eq('user_id',this.userId).order('day').range(offset,offset+499);if(r.error)throw r.error;rows.push(...r.data.map(root.MindTrackCore.fromRow));if(r.data.length<500)return rows;}
    }
    async account(action,extra={}){const r=await this.client.functions.invoke('mindtrack-account',{body:{action,...extra}});if(r.error){let msg;try{msg=(await r.error.context.json()).error;}catch{}throw Error(msg||'Připojení se nepodařilo.');}if(r.data.error)throw Error(r.data.error);return r.data;}
    async withdraw() {
      const r=await this.client.from('mindtrack_participants').delete().eq('user_id',this.userId).select('user_id');
      if(r.error)throw r.error;
    }
  }
  root.MindTrackCloud=MindTrackCloud;
  if(typeof module!=='undefined' && module.exports) module.exports=MindTrackCloud;
})(globalThis);
