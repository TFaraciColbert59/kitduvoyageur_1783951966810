import {
  applyConsentMutation,
  consentMutationSchema,
  consentResponsePayload,
  normalizeHealthConsentState,
} from '../../_lib/consent';
import {
  clearConsentCookie,
  readConsentCookie,
  writeConsentCookie,
} from '../../_lib/consentCookie';
import { invalidPayload, jsonNoStore, readJsonBody } from '../../_lib/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/sensors/health/consent
 * Rend l'état P01 courant (cookie HttpOnly) et le résumé des scopes.
 */
export async function GET() {
  const nowMs = Date.now();
  const state = await readConsentCookie(nowMs);
  return jsonNoStore(consentResponsePayload(state, nowMs));
}

/**
 * POST /api/sensors/health/consent
 * Applique une transition granulaire au consentement. Le contrat
 * `src/features/sensors/consentP01` reste l'unique implémentation des règles.
 */
export async function POST(request: Request) {
  const body = await readJsonBody(request);
  if (body === null) return invalidPayload('Corps JSON invalide.');

  const parsed = consentMutationSchema.safeParse(body);
  if (!parsed.success) {
    return invalidPayload('Consentement invalide.', parsed.error.issues.map((issue) => issue.path.join('.')));
  }

  const nowMs = parsed.data.nowMs ?? Date.now();
  const current = await readConsentCookie(nowMs);
  const next = applyConsentMutation(current, parsed.data, nowMs);
  await writeConsentCookie(next);
  return jsonNoStore(consentResponsePayload(next, nowMs));
}

/**
 * DELETE /api/sensors/health/consent
 * Révoque tous les scopes et supprime le cookie.
 */
export async function DELETE() {
  const nowMs = Date.now();
  await clearConsentCookie();
  const state = normalizeHealthConsentState(null, nowMs);
  return jsonNoStore(consentResponsePayload(state, nowMs));
}
