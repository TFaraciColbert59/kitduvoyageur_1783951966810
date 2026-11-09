import { z } from 'zod';
import { apiError } from '@/lib/errors';
import { guard, jsonOk, methodNotAllowed, readJsonBody, requestRef, clientIp } from '@/server/http';
import { rateLimit } from '@/server/rate-limit';
import { requireStaffSession } from '@/server/session';
import { runCommand } from '@/server/cmd';
import { logServer } from '@/lib/errors';

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

    // Commande à effet externe (Auth, e-mail) : la base a journalisé et autorisé,
    // mais cette route ne l'exécute pas. On le dit, on ne prétend pas l'avoir fait.
    const delegated = Boolean(
      result.data && typeof result.data === 'object' && (result.data as Record<string, unknown>).delegated === true
    );
    if (delegated) {
      logServer({
        level: 'warn',
        scope: 'crm',
        event: 'delegated_effect_not_executed',
        message: `commande=${parsed.data.command} : effet externe non exécuté par /api/cmd`
      });
    }
    return jsonOk({ ...result, external: delegated ? { handled: false, message: 'Effet externe non exécuté par cette route.' } : null });
  }, ref);
}

export async function GET(): Promise<Response> {
  return methodNotAllowed('POST');
}
