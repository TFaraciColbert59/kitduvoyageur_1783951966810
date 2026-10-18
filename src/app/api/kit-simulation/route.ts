import {NextRequest,NextResponse} from 'next/server';
import {createClient} from '@/lib/supabase/server';
import {enforceRateLimit} from '@/lib/rate-limit/routes';
import {simulationRequest} from '@/features/kit-simulation/schema';
import {adaptCandidates} from '@/features/kit-simulation/catalogAdapter';
import {readBoundedJson} from '@/features/kit-simulation/requestBody';
import {fingerprint} from '@/features/kit-simulation/idempotency';
import {optimize,requirements,ENGINE_VERSION} from '@/features/kit-simulation/core';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=30;
const headers={'Cache-Control':'private, no-store','Vary':'Cookie, Authorization'};
const reply=(body:unknown,status=200)=>NextResponse.json(body,{status,headers});
export async function POST(req:NextRequest) {
  if(process.env.KIT_SIMULATION_ENABLED!=='true') return reply({error:'DISABLED'},404);
  if(req.headers.get('origin')!==process.env.APP_ORIGIN) return reply({error:'ORIGIN_DENIED'},403);
  try {
    const db=await createClient();
    const {data:{user},error:authError}=await db.auth.getUser();
    if(authError||!user) return reply({error:'AUTH_REQUIRED'},401);
    const limited=await enforceRateLimit(user.id,{scope:'kit-simulation',limit:20,windowMs:60000,failMode:'closed'});
    if(limited){limited.headers.set('Cache-Control','private, no-store');return limited;}
    const key=req.headers.get('Idempotency-Key');
    if(!key||!/^[a-zA-Z0-9_-]{16,128}$/.test(key)) return reply({error:'IDEMPOTENCY_KEY_REQUIRED'},400);
    const parsed=simulationRequest.safeParse(await readBoundedJson(req));
    if(!parsed.success) return reply({error:'INVALID_INPUT'},400);
    const input=parsed.data,hash=fingerprint({version:ENGINE_VERSION,input});
    const prior=await db.from('kit_simulation_runs').select('request_hash,result')
      .eq('user_id',user.id).eq('idempotency_key',key).maybeSingle();
    if(prior.error) throw new Error('READ_FAILURE');
    if(prior.data) return prior.data.request_hash===hash?reply(prior.data.result):reply({error:'KEY_CONFLICT'},409);
    const wanted=requirements(input);
    const fetched=await db.rpc('kit_simulation_candidates',{p_slots:wanted.map(x=>x.slot),p_limit:24});
    if(fetched.error) throw new Error('CATALOG_UNAVAILABLE');
    const candidates=adaptCandidates(fetched.data);
    const now=new Date().toISOString();
    const result=optimize(candidates,wanted,input,{mode:input.mode,budgetCents:input.budgetCents,
      packWeightG:input.maxPackWeightG,packedVolumeMl:input.packVolumeMl,beamWidth:64,candidatesPerSlot:16},now,input.consumablesG);
    const snapshot={...result,generatedAt:now,candidateHash:fingerprint(candidates),inputHash:hash};
    // Les candidats et entrées restent privés. La réponse est figée par clé.
    const saved=await db.from('kit_simulation_runs').insert({user_id:user.id,idempotency_key:key,
      request_hash:hash,engine_version:ENGINE_VERSION,input_snapshot:input,
      candidate_snapshot:candidates,result:snapshot}).select('result').single();
    if(saved.error?.code==='23505') {
      const winner=await db.from('kit_simulation_runs').select('request_hash,result')
        .eq('user_id',user.id).eq('idempotency_key',key).single();
      if(winner.error) throw new Error('REPLAY_FAILURE');
      return winner.data.request_hash===hash?reply(winner.data.result):reply({error:'KEY_CONFLICT'},409);
    }
    if(saved.error) throw new Error('SAVE_FAILURE');
    return reply(saved.data.result);
  } catch(error) {
    const reason=error instanceof Error?error.message:'UNAVAILABLE';
    const status=reason==='BODY_TOO_LARGE'?413:reason==='UNSUPPORTED_MEDIA_TYPE'?415:reason==='INVALID_JSON'?400:503;
    return reply({error:status===503?'SIMULATION_UNAVAILABLE':reason},status);
  }
}
