import { apiError, translateDbError } from '@/lib/errors';
import { guard, jsonOk, methodNotAllowed, nowIso, requestRef, clientIp } from '@/server/http';
import { rateLimit } from '@/server/rate-limit';
import { dayBucket, purgeDays, requireCronAuth } from '@/server/cron';
import { serviceDb } from '@/server/db';
import { finishJob, startJob } from '@/server/jobs';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * GET /api/cron/purge — purge quotidienne des journaux techniques.
 * `admin.purge_logs(p_days)` ne touche jamais une table métier ; le journal
 * d'audit garde sa rétention légale de 3 ans côté base.
 */
export async function GET(request: Request): Promise<Response> {
  const ref = requestRef();
  return guard(async () => {
    requireCronAuth(request);
    rateLimit(`cron:purge:${clientIp(request)}`, 6);

    const url = new URL(request.url);
    const days = purgeDays(url.searchParams.get('days'));
    const db = serviceDb();
    const bucket = dayBucket();
    const handle = await startJob(db, 'cron:purge', bucket, { days });

    if (handle.alreadyDone) {
      return jsonOk({ ok: true, skipped: true, reason: 'déjà exécuté', bucket, time: nowIso(), request_ref: ref });
    }

    const { data, error } = await db.schema('admin').rpc('purge_logs', { p_days: days });
    if (error) {
      const missing = error.code === 'PGRST202' || error.code === '42P01' || error.code === 'PGRST205';
      if (missing) {
        await finishJob(db, handle, 'skipped', { reason: 'purge_non_deployee' });
        return jsonOk(
          {
            ok: true,
            disabled: true,
            brick: 'purge',
            reason: 'purge_non_deployee',
            message: 'La purge n’est pas encore déployée en base. Aucune donnée supprimée.',
            time: nowIso(),
            request_ref: ref
          },
          503
        );
      }
      await finishJob(db, handle, 'error', undefined, error.code ?? 'purge_failed');
      throw translateDbError(error);
    }

    if (!data) throw apiError('server_error');
    const payload = data as { ok?: boolean; deleted?: unknown; cutoff_technical?: unknown; cutoff_audit?: unknown };
    await finishJob(db, handle, 'ok', {
      deleted: payload.deleted ?? null,
      cutoff_technical: payload.cutoff_technical ?? null
    });

    return jsonOk({
      ok: true,
      days,
      deleted: payload.deleted ?? null,
      cutoff_technical: payload.cutoff_technical ?? null,
      cutoff_audit: payload.cutoff_audit ?? null,
      legend: 'Le journal d’audit n’est jamais purgé sur paramètre : rétention légale de 3 ans en base.',
      bucket,
      time: nowIso(),
      request_ref: ref
    });
  }, ref);
}

export async function POST(): Promise<Response> {
  return methodNotAllowed('GET');
}
