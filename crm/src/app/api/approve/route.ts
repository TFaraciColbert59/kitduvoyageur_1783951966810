import { z } from 'zod';
import { apiError } from '@/lib/errors';
import { clientIp, guard, jsonOk, methodNotAllowed, readJsonBody, requestRef } from '@/server/http';
import { rateLimit } from '@/server/rate-limit';
import { requireStaffSession } from '@/server/session';
import { approveRequest } from '@/server/cmd';
import { settleApprovedRequest } from '@/server/stripe';
import { sendTeamAlert } from '@/server/resend';
import { logServer } from '@/lib/errors';

type RequestSnapshot = { command: string; params: Record<string, unknown> } | null;

/** Lit la demande AVANT validation : l'effet externe (Stripe) en a besoin. */
async function snapshotRequest(
  client: Awaited<ReturnType<typeof requireStaffSession>>['client'],
  id: string
): Promise<RequestSnapshot> {
  const { data, error } = await client.schema('admin').rpc('request_detail', { p_request: id });
  if (error) return null;
  const detail = (data ?? {}) as { command?: unknown; params?: unknown };
  if (typeof detail.command !== 'string') return null;
  const params = detail.params && typeof detail.params === 'object' ? (detail.params as Record<string, unknown>) : {};
  return { command: detail.command, params };
}

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const bodySchema = z.object({
  id: z.string().trim().uuid('Identifiant de demande invalide'),
  confirmation: z
    .string()
    .trim()
    .length(8, 'Le code de confirmation fait 8 caractères')
    .regex(/^[a-f0-9]{8}$/i, 'Le code de confirmation est hexadécimal')
});

/** POST /api/approve — validation humaine d'une demande en attente. */
export async function POST(request: Request): Promise<Response> {
  const ref = requestRef();
  return guard(async () => {
    rateLimit(`approve:ip:${clientIp(request)}`, 120);
    const session = await requireStaffSession();
    rateLimit(`approve:user:${session.user.id}`, 30);

    const raw = await readJsonBody(request);
    const parsed = bodySchema.safeParse(raw);
    if (!parsed.success) {
      throw apiError(
        'invalid_params',
        parsed.error.issues.slice(0, 5).map((issue) => ({
          path: issue.path.length ? issue.path.join('.') : '(racine)',
          message: issue.message
        }))
      );
    }

    const snapshot = await snapshotRequest(session.client, parsed.data.id);
    const result = await approveRequest(session.client, parsed.data.id, parsed.data.confirmation);

    // Effet externe uniquement APRÈS `admin.approve_request` réussi.
    const external =
      result.status === 'executed' ? await settleApprovedRequest(session.client, parsed.data.id, snapshot ?? undefined) : null;

    if (external?.attempted) {
      await sendTeamAlert({
        subject: `[LKDV Control] Remboursement ${external.ok ? 'exécuté (test)' : 'échoué'} — demande ${parsed.data.id}`,
        text: `${external.message}\nDemande : ${parsed.data.id}\nCommande : ${String(snapshot?.params.order_id ?? 'non renseignée')}`,
        idempotencyKey: `refund-notice-${parsed.data.id}`
      });
      logServer({
        level: external.ok ? 'info' : 'warn',
        scope: 'crm',
        event: 'approve_external_effect',
        message: external.message
      });
    }

    return jsonOk({ ...result, external });
  }, ref);
}

export async function GET(): Promise<Response> {
  return methodNotAllowed('POST');
}
