import { requireUser } from '@/lib/api/requireUser';
import { fail, ok } from '@/lib/api/respond';
import { getConnectorCatalog } from '@/lib/connectors/service';
import { hydrateConnectorConsentFromDb } from '@/lib/connectors/consents';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Catalogue réel des connecteurs partenaires du compte.
 * Les credentials ne sont jamais exposés : seuls les noms de variables
 * manquantes sortent, et l'état reste fail-closed côté registre D01.
 */
export async function GET() {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  try {
    await hydrateConnectorConsentFromDb(auth.user.id, auth.supabase);
    return ok(getConnectorCatalog(auth.user.id));
  } catch {
    return fail('server', 'Impossible de charger les connecteurs partenaires.');
  }
}
