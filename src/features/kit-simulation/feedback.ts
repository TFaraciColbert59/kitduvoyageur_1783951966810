export interface Feedback {
 eventId:string;tripId:string;gearId:string;participantId:string;
 distanceM:number;minimumTempC:number|null;comfortScore:number|null;
 unused:boolean;safetyCritical:boolean;consentAggregate:boolean;
}
export function uniqueFeedback(events:readonly Feedback[]):Feedback[] {
 const seen=new Set<string>();const result:Feedback[]=[];
 for(const e of [...events].sort((a,b)=>a.eventId.localeCompare(b.eventId,'en'))) {
  if(!e.eventId||!e.tripId||!e.gearId||!e.participantId)throw new Error('FEEDBACK_ID_INVALID');
  if(!Number.isFinite(e.distanceM)||e.distanceM<0||e.distanceM>10000000)throw new Error('DISTANCE_INVALID');
  if(e.comfortScore!==null&&(!Number.isInteger(e.comfortScore)||e.comfortScore<1||e.comfortScore>5))
   throw new Error('SCORE_INVALID');
  if(e.minimumTempC!==null&&(!Number.isFinite(e.minimumTempC)||e.minimumTempC < -80||e.minimumTempC>60))
   throw new Error('TEMP_INVALID');
  const key=JSON.stringify([e.tripId,e.gearId,e.participantId]);
  if(!seen.has(key)){seen.add(key);result.push(e);}
 }
 return result;
}
export function summarizeFeedback(events:readonly Feedback[],minimumSamples=20):{
 samples:number;medianComfort:number|null;unusedRate:number|null;removalAdviceAllowed:false
} {
 if(!Number.isInteger(minimumSamples)||minimumSamples<5)throw new Error('PRIVACY_FLOOR_INVALID');
 const unique=uniqueFeedback(events).filter(e=>e.consentAggregate);
 const scores=unique.map(e=>e.comfortScore).filter((x):x is number=>x!==null).sort((a,b)=>a-b);
 const median=(scores.length%2?scores[Math.floor(scores.length/2)]:
  (scores[scores.length/2-1]+scores[scores.length/2])/2);
 return {samples:unique.length,medianComfort:scores.length>=minimumSamples?median:null,
  unusedRate:unique.length>=minimumSamples?unique.filter(e=>e.unused).length/unique.length:null,
  removalAdviceAllowed:false};
}
