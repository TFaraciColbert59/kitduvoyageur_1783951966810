import { guard, jsonOk, methodNotAllowed, nowIso, requestRef } from '../../../../server/http';
import { rateLimit } from '../../../../server/rate-limit';
import { cronBucket, requireCronAuth } from '../../../../server/cron';
import { clientIp } from '../../../../server/http';
import { runAgents } from '../../../../server/agents/runner';
import { nimConfigured } from '../../../../server/agents/nim';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * GET /api/cron/agents — cycle des 6 agents (Vercel Cron toutes les 5 min).
 * Bearer CRON_SECRET obligatoire. Sans NVIDIA_API_KEY : 503 `{disabled:true}`.
 */
export async function GET(request: Request): Promise<Response> {
  const ref = requestRef();
  return guard(async () => {
    requireCronAuth(request);
    rateLimit(`cron:agents:${clientIp(request)}`, 12);

    if (!nimConfigured()) {
      return jsonOk(
        {
          ok: true,
          disabled: true,
          brick: 'nvidia',
          message: 'Agents éteints : NVIDIA_API_KEY absente. La file humaine continue.',
          time: nowIso(),
          request_ref: ref
        },
        503
      );
    }

    const bucket = cronBucket(5);
    const report = await runAgents({ trigger: 'cron', bucket });
    return jsonOk({
      ...report,
      bucket,
      time: nowIso(),
      request_ref: ref
    });
  }, ref);
}

export async function POST(): Promise<Response> {
  return methodNotAllowed('GET');
}
