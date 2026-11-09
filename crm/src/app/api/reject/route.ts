import { z } from 'zod';
import { apiError } from '@/lib/errors';
import { clientIp, guard, jsonOk, methodNotAllowed, readJsonBody, requestRef } from '@/server/http';
import { rateLimit } from '@/server/rate-limit';
import { requireStaffSession } from '@/server/session';
import { rejectRequest } from '@/server/cmd';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const bodySchema = z.object({
  id: z.string().trim().uuid('Identifiant de demande invalide'),
  reason: z.string().trim().min(3, 'Un motif est obligatoire').max(500, 'Motif trop long')
});

/** POST /api/reject — refus motivé d'une demande en attente. */
export async function POST(request: Request): Promise<Response> {
  const ref = requestRef();
  return guard(async () => {
    rateLimit(`reject:ip:${clientIp(request)}`, 120);
    const session = await requireStaffSession();
    rateLimit(`reject:user:${session.user.id}`, 30);

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

    const result = await rejectRequest(session.client, parsed.data.id, parsed.data.reason);
    return jsonOk(result);
  }, ref);
}

export async function GET(): Promise<Response> {
  return methodNotAllowed('POST');
}
