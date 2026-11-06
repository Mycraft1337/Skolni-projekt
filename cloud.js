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
      const client=await this.clientReady();
      let {data,error}=await client.auth.getSession(); if(error) throw error;
      let session=data.session;
      if(!session) {
        if(expectedId || !allowCreate) throw Error('Původní přihlášení chybí. Exportuj své záznamy a kontaktuj autora projektu; nový účastník se automaticky nevytvoří.');
        const result=await client.auth.signInAnonymously(); if(result.error) throw result.error; session=result.data.session;
      }
      if(!session?.user?.id || (expectedId && session.user.id!==expectedId)) throw Error('Přihlášení neodpovídá účastníkovi v tomto prohlížeči.');
      this.userId=session.user.id;return this.userId;
    }
    async enroll() {
      const current=await this.client.from('mindtrack_participants').select('user_id').eq('user_id',this.userId).maybeSingle();
      if(current.error) throw current.error;
      if(!current.data) {const r=await this.client.from('mindtrack_participants').insert({user_id:this.userId,consent_version:'2026-11-v2'});if(r.error)throw r.error;}
    }
    async upload(entries, deleted) {
      // Tombstones remain locally until the entire operation succeeds; retries are idempotent.
      for(const day of deleted) {const r=await this.client.from('mindtrack_entries').delete().eq('user_id',this.userId).eq('day',day);if(r.error)throw r.error;}
      if(entries.length) {const r=await this.client.from('mindtrack_entries').upsert(entries.map(e=>root.MindTrackCore.row(e,this.userId)),{onConflict:'user_id,day'});if(r.error)throw r.error;}
    }
    async withdraw() {
      const r=await this.client.from('mindtrack_participants').delete().eq('user_id',this.userId).select('user_id');
      if(r.error)throw r.error;
    }
  }
  root.MindTrackCloud=MindTrackCloud;
  if(typeof module!=='undefined' && module.exports) module.exports=MindTrackCloud;
})(globalThis);
