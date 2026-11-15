import { requireUser } from '@/lib/api/requireUser';
import { fail, ok } from '@/lib/api/respond';
import { getConnectorSyncQueue } from '@/lib/connectors/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** File de synchronisation réelle de l'appelant (aucun job d'un autre compte). */
export async function GET() {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  try {
    return ok(getConnectorSyncQueue(auth.user.id));
  } catch {
    return fail('server', 'Impossible de charger la file de synchronisation.');
  }
}
