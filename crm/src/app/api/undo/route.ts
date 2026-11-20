import { z } from 'zod';
import { apiError } from '../../../lib/errors';
import { clientIp, guard, jsonOk, methodNotAllowed, readJsonBody, requestRef } from '../../../server/http';
import { rateLimit } from '../../../server/rate-limit';
import { requireStaffSession } from '../../../server/session';
import { undoAction } from '../../../server/cmd';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const auditId = z.union([
  z.number().int().nonnegative(),
  z.string().trim().regex(/^\d{1,19}$/, 'Identifiant d’audit invalide')
]);

const bodySchema = z.object({ audit_id: auditId });

/** POST /api/undo — annulation pendant 10 s (`admin.undo`, commandes `undoable`). */
export async function POST(request: Request): Promise<Response> {
  const ref = requestRef();
  return guard(async () => {
    rateLimit(`undo:ip:${clientIp(request)}`, 120);
    const session = await requireStaffSession();
    rateLimit(`undo:user:${session.user.id}`, 30);

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

    const result = await undoAction(session.client, parsed.data.audit_id);
    return jsonOk(result);
  }, ref);
}

export async function GET(): Promise<Response> {
  return methodNotAllowed('POST');
}
