import Stripe from 'stripe';
import { apiError, logServer, translateDbError } from '../../../../lib/errors';
import { guard, jsonOk, methodNotAllowed, nowIso, requestRef } from '../../../../server/http';
import { serviceDb } from '../../../../server/db';
import { finishJob, startJob } from '../../../../server/jobs';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 20;

/** Événements écoutés par le CRM — jamais le webhook LKDV, qui reste intact. */
const ALLOWED_EVENTS = new Set(['charge.refunded', 'charge.dispute.created', 'charge.dispute.closed']);

/**
 * POST /api/stripe/webhook — point d'entrée dédié au CRM.
 *
 *  - signature vérifiée avec `STRIPE_WEBHOOK_SECRET_CRM` (aucune confiance sans signature) ;
 *  - idempotent sur `event.id` (base + `ops.job_runs`) ;
 *  - n'écrit aucune table : `admin.stripe_event_ingest` (service_role) reflète l'état Stripe ;
 *  - ne décide jamais d'argent, ne modifie pas le webhook de LKDV.
 */
export async function POST(request: Request): Promise<Response> {
  const ref = requestRef();
  return guard(async () => {
    const secret = process.env.STRIPE_WEBHOOK_SECRET_CRM;
    if (!secret || secret.length < 8) {
      return jsonOk(
        {
          ok: true,
          disabled: true,
          brick: 'stripe_webhook',
          message: 'Webhook Stripe désactivé : STRIPE_WEBHOOK_SECRET_CRM absente.',
          time: nowIso(),
          request_ref: ref
        },
        503
      );
    }

    const signature = request.headers.get('stripe-signature');
    if (!signature) throw apiError('invalid_body');

    const raw = await request.text();
    if (!raw) throw apiError('invalid_body');

    let event: Stripe.Event;
    try {
      event = Stripe.webhooks.constructEvent(raw, signature, secret);
    } catch {
      // Signature fausse : refus net, aucun détail.
      throw apiError('not_allowed');
    }

    const db = serviceDb();
    const handle = await startJob(db, 'stripe:webhook', event.id, { type: event.type });

    if (handle.alreadyDone) {
      return jsonOk({ ok: true, duplicate: true, event_id: event.id, time: nowIso(), request_ref: ref });
    }

    if (!ALLOWED_EVENTS.has(event.type)) {
      await finishJob(db, handle, 'skipped', { type: event.type, reason: 'événement hors périmètre' });
      return jsonOk({ ok: true, ignored: true, event_id: event.id, time: nowIso(), request_ref: ref });
    }

    const { data, error } = await db.schema('admin').rpc('stripe_event_ingest', {
      p_event_id: event.id,
      p_type: event.type,
      p_payload: event.data.object
    });

    if (error) {
      const missing = error.code === 'PGRST202' || error.code === '42P01' || error.code === 'PGRST205';
      if (missing) {
        await finishJob(db, handle, 'skipped', { type: event.type, reason: 'stripe_event_ingest_absente' });
        logServer({
          level: 'warn',
          scope: 'crm',
          event: 'stripe_ingest_missing',
          message: 'RPC stripe_event_ingest absente : événement reçu mais non enregistré.'
        });
        return jsonOk(
          {
            ok: true,
            ingested: false,
            event_id: event.id,
            raison: 'rpc_absente',
            time: nowIso(),
            request_ref: ref
          }
        );
      }
      await finishJob(db, handle, 'error', undefined, error.code ?? 'ingest_failed');
      throw translateDbError(error);
    }

    const payload = (data ?? {}) as { ok?: unknown; ingested?: unknown; duplicate?: unknown; status?: unknown; order_id?: unknown };
    const result = {
      ok: true,
      ingested: payload.ingested !== false,
      duplicate: payload.duplicate === true,
      status: typeof payload.status === 'string' ? payload.status : 'received',
      order_id: typeof payload.order_id === 'string' ? payload.order_id : null,
      event_id: event.id,
      type: event.type,
      time: nowIso(),
      request_ref: ref
    };
    await finishJob(db, handle, 'ok', { type: event.type, status: result.status, order_id: result.order_id });
    return jsonOk(result);
  }, ref);
}

export async function GET(): Promise<Response> {
  return methodNotAllowed('POST');
}
