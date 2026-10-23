import {performance} from 'node:perf_hooks';
const base=process.env.STAGING_ORIGIN,token=process.env.TEST_SESSION_COOKIE;
if(!base||!token||process.env.ALLOW_STAGING_LOAD!=='yes')throw new Error('Staging et autorisation requis');
const url=new URL(base);
if(url.protocol!=='https:'||!url.hostname.includes('staging'))throw new Error('Hote staging requis');
const input={mode:'balanced',accommodation:'hotel',cooking:false,naturalWater:false,
 minTempC:null,minimumPadR:null,coldMarginC:3,budgetCents:50000,maxPackWeightG:10000,
 packVolumeMl:50000,consumablesG:1000};
const statuses={},times=[];
// Smoke HTTP serial, PAS benchmark 10M. Limitation serveur 20/min respectee.
for(let i=0;i<5;i++){
 const start=performance.now();
 const r=await fetch(new URL('/api/kit-simulation',url),{method:'POST',headers:{
 'Cookie':token,'Origin':url.origin,'Content-Type':'application/json',
 'Idempotency-Key':crypto.randomUUID()},body:JSON.stringify(input)});
 statuses[r.status]=(statuses[r.status]??0)+1;await r.arrayBuffer();times.push(performance.now()-start);
}
times.sort((a,b)=>a-b);
console.log(JSON.stringify({scenario:'smoke-5-serial',statuses,medianMs:times[2],maxMs:times[4]},null,2));
