import { guard, jsonOk, methodNotAllowed, nowIso, requestRef, clientIp } from '@/server/http';
import { rateLimit } from '@/server/rate-limit';
import { cronBucket, requireCronAuth } from '@/server/cron';
import { serviceDb } from '@/server/db';
import { escalateOverdueSos } from '@/server/sos';
import { finishJob, startJob } from '@/server/jobs';
import { sendTeamAlert } from '@/server/resend';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

type OverdueRequests = { count: number; expired: number; available: boolean };

async function expiredRequests(db: ReturnType<typeof serviceDb>): Promise<OverdueRequests> {
  const { data, error } = await db.schema('admin').rpc('requests_overdue', {});
  if (error) {
    return { count: 0, expired: 0, available: false };
  }
  const payload = (data ?? {}) as { count?: unknown; expired?: unknown };
  return {
    count: typeof payload.count === 'number' ? payload.count : 0,
    expired: typeof payload.expired === 'number' ? payload.expired : 0,
    available: true
  };
}

/**
 * GET /api/cron/sla — compte à rebours et escalades.
 *  1. SOS ouverts sans « Je prends » depuis > 5 min → e-mail d'astreinte + journal.
 *  2. Demandes expirées → un récapitulatif horaire (jamais un e-mail par ligne).
 */
export async function GET(request: Request): Promise<Response> {
  const ref = requestRef();
  return guard(async () => {
    requireCronAuth(request);
    rateLimit(`cron:sla:${clientIp(request)}`, 12);

    const db = serviceDb();
    const bucket = cronBucket(5);
    const handle = await startJob(db, 'cron:sla', bucket, {});

    if (handle.alreadyDone) {
      return jsonOk({ ok: true, skipped: true, reason: 'déjà exécuté', bucket, time: nowIso(), request_ref: ref });
    }

    const sos = await escalateOverdueSos(db, 5);
    const requests = await expiredRequests(db);

    let emailed = false;
    if (requests.expired > 0) {
      const email = await sendTeamAlert({
        subject: `[LKDV Control] ${requests.expired} demande(s) expirée(s) à traiter`,
        text: [
          `${requests.expired} demande(s) en attente ont expiré sans décision.`,
          requests.count > requests.expired ? `${requests.count - requests.expired} autre(s) demande(s) en attente.` : '',
          'Ouvrez le CRM, écran Valider, et décidez.'
        ]
          .filter(Boolean)
          .join('\n'),
        idempotencyKey: `sla-expired-${new Date().toISOString().slice(0, 13)}`
      });
      emailed = email.sent;
    }

    const result = { sos, requests, emailed };
    await finishJob(db, handle, 'ok', result);
    return jsonOk({ ok: true, ...result, bucket, time: nowIso(), request_ref: ref });
  }, ref);
}

export async function POST(): Promise<Response> {
  return methodNotAllowed('GET');
}
