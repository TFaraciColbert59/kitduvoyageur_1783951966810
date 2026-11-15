import { requireUser } from '@/lib/api/requireUser';
import { fail, ok } from '@/lib/api/respond';
import { routeSendBodySchema } from '@/lib/connectors/schemas';
import { sendRouteToConnector, getConnectorSendTargets } from '@/lib/connectors/service';
import { hydrateConnectorConsentFromDb } from '@/lib/connectors/consents';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Envoi d'un itinéraire vers un GPS / une montre.
 *
 * Le corps porte l'itinéraire canonique déjà résolu (trace + waypoints +
 * ascensions). La route ne contacte aucun partenaire : elle prépare le plan,
 * expose le repli GPX/FIT et met le job en file idempotente. Sans credentials,
 * le mode est `manual_file_fallback`, jamais un faux succès cloud.
 */
export async function POST(request: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail('bad_request', 'Corps JSON requis.');
  }

  const parsed = routeSendBodySchema.safeParse(body);
  if (!parsed.success) {
    return fail('bad_request', 'Itinéraire ou connecteur invalide.');
  }

  await hydrateConnectorConsentFromDb(auth.user.id, auth.supabase);
  const target = getConnectorSendTargets(auth.user.id).find(
    (candidate) => candidate.providerId === parsed.data.providerId
  );
  if (!target || !target.canSend) {
    return fail('bad_request', 'Ce connecteur ne prend pas en charge l’envoi d’itinéraire.');
  }

  try {
    return ok(
      sendRouteToConnector({
        userId: auth.user.id,
        providerId: parsed.data.providerId,
        route: parsed.data.route,
        deviceModelId: parsed.data.deviceModelId,
      })
    );
  } catch {
    return fail('server', 'Impossible de préparer l’envoi de l’itinéraire.');
  }
}
