const assert=require('node:assert/strict');
(async()=>{
 const {dispatchBatches}=await import('../supabase/functions/mindtrack-push/dispatcher.js');
 let queue=Array.from({length:75},(_,i)=>i),calls=0,active=0,maxActive=0;const seen=[];
 const count=await dispatchBatches(async n=>{calls++;return queue.splice(0,n);},async job=>{active++;maxActive=Math.max(active,maxActive);await new Promise(r=>setTimeout(r,1));seen.push(job);active--;});
 assert.equal(count,75);assert.equal(new Set(seen).size,75);assert.equal(maxActive,5);assert.equal(calls,4);
 queue=Array.from({length:200},(_,i)=>i);
 assert.equal(await dispatchBatches(async n=>queue.splice(0,n),async()=>{}),100);assert.equal(queue.length,100);
 let time=0;calls=0;
 assert.equal(await dispatchBatches(async n=>{calls++;return Array.from({length:n});},async()=>{time=45000;},()=>time),25);assert.equal(calls,1);
 calls=0;assert.equal(await dispatchBatches(async()=>[],async()=>{calls++;}),0);assert.equal(calls,0);
 console.log('Dispatcher: passed (batch drain, concurrency cap, per-run cap, time budget, empty queue)');
})().catch(e=>{console.error(e);process.exit(1)});
