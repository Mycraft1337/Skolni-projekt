const assert=require('node:assert/strict');
(async()=>{
 const {localClock,previousDay,isDue,validTime,validSubscription}=await import('../supabase/functions/mindtrack-push/logic.js');
 assert.deepEqual(localClock('Europe/Prague',new Date('2026-01-05T07:00:00Z')),{day:'2026-01-05',minute:480});
 assert.deepEqual(localClock('Europe/Prague',new Date('2026-07-05T06:00:00Z')),{day:'2026-07-05',minute:480});
 assert.equal(previousDay('2026-01-01'),'2025-12-31');
 assert.equal(isDue('08:00:00',480),true);assert.equal(isDue('08:00',494),true);assert.equal(isDue('08:00',495),false);assert.equal(isDue('08:00',479),false);assert.equal(isDue(null,480),false);
 for(const t of ['08:00','23:59',null])assert.equal(validTime(t),true);
 for(const t of ['24:00','8:00','08:60','',undefined])assert.equal(validTime(t),false);
 const sub={endpoint:'https://web.push.apple.com/example',keys:{p256dh:'A'.repeat(87),auth:'B'.repeat(22)}};
 assert.equal(validSubscription(sub),true);
 for(const endpoint of ['http://web.push.apple.com/example','https://127.0.0.1/','https://example.com/','https://web.push.apple.com.evil.test/','https://user:pass@web.push.apple.com/','https://web.push.apple.com:8443/'])assert.equal(validSubscription({...sub,endpoint}),false);
 assert.equal(validSubscription({...sub,keys:{}}),false);
 console.log('Reminder scheduling/validation: passed');
})().catch(e=>{console.error(e);process.exit(1)});
