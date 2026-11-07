const assert=require('node:assert/strict');
const C=require('../core.js');
const today=C.today(), yesterday=C.yesterday();
const blank={schemaVersion:4,date:yesterday,socialMinutes:null,mood:null,sleepHours:null,sleepQuality:null,beforeBed:null};
const morning={...blank,sleepHours:7.5,sleepQuality:4,beforeBed:true};
const evening={...blank,date:today,socialMinutes:0,mood:3};
assert.equal(C.validate(morning),'');assert.equal(C.validate(evening),'');
assert.ok(C.validate(blank));assert.ok(C.validate({...morning,date:today}));
assert.ok(C.validate({...morning,sleepQuality:null}));assert.ok(C.validate({...evening,mood:null}));
assert.ok(C.validate({...evening,socialMinutes:1441}));
assert.equal(C.validate({...morning,socialMinutes:0,mood:3}),''); // use after evening report is possible
assert.equal(C.shiftDay('2026-11-01',-1),'2026-10-31');
assert.equal(C.shiftDay('2026-01-01',-1),'2025-12-31');
assert.equal(C.shiftDay('2024-03-01',-1),'2024-02-29');
assert.equal(C.row(evening,'test').sleep_hours,null);
assert.equal(C.fromRow(C.row(evening,'test')).sleepHours,null);
assert.equal(C.csv([evening]).split('\r\n')[1],`"4";"${today}";"0";"";"";"";"";"3";"";"";"";""`);
for(const version of [2,3]){
 const legacy={schemaVersion:version,date:yesterday,socialMinutes:80,mood:4,sleepHours:8,sleepQuality:3,...(version===2?{bedMinutes:20}:{beforeBed:true})};
 assert.deepEqual(C.parseBackup(JSON.stringify({version,entries:[legacy]})),[legacy]);
}
assert.deepEqual(C.parseBackup(JSON.stringify({version:4,entries:[morning]})),[morning]);
console.log('Core check-ins: passed');
