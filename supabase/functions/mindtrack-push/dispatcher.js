// Bounded concurrent work: no fixed first-N subscriber cutoff and no unbounded
// promise fan-out. Unclaimed jobs remain eligible for the next minute's tick.
export async function dispatchBatches(claim,process,now=Date.now){
 const deadline=now()+40000;
 let processed=0;
 for(let batch=0;batch<4&&now()<deadline;batch++){
  const jobs=await claim(25);if(!jobs.length)break;
  let cursor=0;
  await Promise.all(Array.from({length:Math.min(5,jobs.length)},async()=>{
   while(cursor<jobs.length){const job=jobs[cursor++];await process(job);processed++;}
  }));
  if(jobs.length<25)break;
 }
 return processed;
}
