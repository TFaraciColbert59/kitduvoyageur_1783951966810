import { z } from 'zod';

import { requireUser } from '@/lib/api/requireUser';
import { fail, ok } from '@/lib/api/respond';
import { CONSENT_PURPOSES, setConsent } from '@/features/adventure-intelligence/server/consents';
import { hydrateConnectorConsentFromDb } from '@/lib/connectors/consents';
import { getConnectorCatalog } from '@/lib/connectors/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bodySchema = z
  .object({
    purpose: z.enum(CONSENT_PURPOSES),
    granted: z.boolean(),
  })
  .strict();

/**
 * Accorde ou retire une finalité P01 depuis l'écran Connecteurs.
 * La source de vérité reste `adventure_data_consents` (et son journal de
 * révocation) : ce lot ne crée pas un second registre de consentement.
 * `external_readiness` reste refusé par le service amont.
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

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return fail('bad_request', 'Finalité ou valeur de consentement invalide.');
  }

  const result = await setConsent(parsed.data.purpose, parsed.data.granted);
  if (!result.ok) {
    if (result.error === 'external_readiness_disabled' || result.error === 'invalid_purpose') {
      return fail('bad_request', 'Cette finalité ne peut pas être accordée en Phase 1.');
    }
    if (result.error === 'unauthenticated') {
      return fail('unauthorized', 'Session requise.');
    }
    return fail('server', 'Impossible d’enregistrer ce consentement.');
  }

  await hydrateConnectorConsentFromDb(auth.user.id, auth.supabase);
  return ok({ catalog: getConnectorCatalog(auth.user.id) });
}
