import { z } from 'zod';
import { apiError } from '../../../lib/errors';
import { guard, jsonOk, methodNotAllowed, readJsonBody, requestRef, clientIp } from '../../../server/http';
import { rateLimit } from '../../../server/rate-limit';
import { requireStaffSession } from '../../../server/session';
import { runCommand } from '../../../server/cmd';
import { executeDelegated } from '../../../server/external';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const bodySchema = z.object({
  command: z.string().trim().min(1).max(80),
  params: z.unknown().optional()
});

/** POST /api/cmd — toute action humaine, via `admin.run_command`. */
export async function POST(request: Request): Promise<Response> {
  const ref = requestRef();
  return guard(async () => {
    rateLimit(`cmd:ip:${clientIp(request)}`, 180);
    const session = await requireStaffSession();
    rateLimit(`cmd:user:${session.user.id}`, 60);

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

    const result = await runCommand(session.client, parsed.data.command, parsed.data.params);

    // EX-COM-04 : effet externe marqué `delegated` par la base → exécution ici,
    // avec service_role, clé d'idempotence request_id/audit_id, et statut explicite
    // si la brique est absente. Jamais silencieux.
    const data = result.data && typeof result.data === 'object' ? (result.data as Record<string, unknown>) : {};
    const delegated = data.delegated === true;
    const external = delegated
      ? await executeDelegated({
          client: session.client,
          command: parsed.data.command,
          data,
          requestId: result.request_id ?? null,
          auditId: result.audit_id ?? null
        })
      : null;
    return jsonOk({ ...result, external });
  }, ref);
}

export async function GET(): Promise<Response> {
  return methodNotAllowed('POST');
}
