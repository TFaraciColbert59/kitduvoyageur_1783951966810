import { z } from 'zod';
import { requireUser } from '@/lib/api/requireUser';
import { fail, ok } from '@/lib/api/respond';
import { consentPurposeSchema, setConsentForUser } from '@/features/adventure-intelligence/server/consents';
import { loadConsentSettings } from '@/features/compte/server/consents';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Patch = z
  .object({
    purpose: consentPurposeSchema,
    granted: z.boolean(),
  })
  .strict();

/**
 * Consentements du propriétaire courant, par usage autorisé par le contrat.
 * Aucun fournisseur n'est connecté : la réponse le déclare explicitement.
 */
export async function GET() {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  try {
    return ok(await loadConsentSettings(auth.supabase, auth.user.id));
  } catch {
    return fail('server', 'Impossible de charger tes consentements.');
  }
}

/**
 * Accorde ou révoque un usage. La révocation passe par le service existant :
 * elle écrit le consentement puis émet `consent.revoked` pour la purge RGPD.
 * Une finalité désactivée reste refusée côté serveur.
 */
export async function PATCH(request: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const parsed = Patch.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail('not_found', 'Consentement invalide.');

  try {
    const result = await setConsentForUser(
      auth.supabase,
      auth.user.id,
      parsed.data.purpose,
      parsed.data.granted
    );

    if (!result.ok) {
      if (result.error === 'external_readiness_disabled') {
        return fail('conflict', 'Les données de santé restent désactivées par le contrat.');
      }
      if (result.error === 'invalid_purpose') {
        return fail('not_found', 'Finalité inconnue.');
      }
      if (result.error === 'unauthenticated') {
        return fail('unauthorized', 'Session requise.');
      }
      return fail('server', 'Impossible d’enregistrer ce consentement.');
    }

    return ok(await loadConsentSettings(auth.supabase, auth.user.id));
  } catch {
    return fail('server', 'Impossible d’enregistrer ce consentement.');
  }
}
