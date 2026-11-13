import { WebUnavailableHealthBridge, P01_CONSENT_POLICY_VERSION } from '@/features/sensors';
import { jsonNoStore } from '../../_lib/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/sensors/health/availability
 *
 * Le serveur Web ne peut pas atteindre HealthKit ni Health Connect : la
 * réponse est explicitement `native_bridge_unavailable`, jamais un faux
 * « disponible ». L'application native interroge son propre adaptateur.
 */
export async function GET() {
  const bridge = new WebUnavailableHealthBridge('web');
  const availability = await bridge.getAvailability();
  return jsonNoStore({
    availability,
    policyVersion: P01_CONSENT_POLICY_VERSION,
    checkedAtMs: Date.now(),
  });
}
