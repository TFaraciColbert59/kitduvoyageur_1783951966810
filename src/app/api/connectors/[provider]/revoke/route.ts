import { requireUser } from '@/lib/api/requireUser';
import { fail, ok } from '@/lib/api/respond';
import { parseProviderId } from '@/lib/connectors/schemas';
import { revokeConnector } from '@/lib/connectors/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Révocation immédiate : coupe la collecte et les envois, annule les jobs en
 * attente et purge les références de jeton. La révocation locale réussit même
 * si l'appel distant échoue.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ provider: string }> }) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const providerId = parseProviderId((await params).provider);
  if (!providerId) return fail('not_found', 'Connecteur partenaire inconnu.');

  try {
    const result = await revokeConnector({ userId: auth.user.id, providerId });
    return ok(result);
  } catch {
    return fail('server', 'Impossible de révoquer ce connecteur.');
  }
}
