/**
 * NoopReadinessProvider — contrats futurs uniquement.
 *
 * Aucun connecteur HealthKit / Health Connect / Garmin / Fitbit / BLE :
 * contrats futurs uniquement. Aucune donnée de santé n'est lue, stockée ou
 * transmise, et `external_readiness` reste désactivé (contrainte SQL + double
 * barrière serveur). Ce provider existe pour figer le contrat de la Phase 1.
 */
import type {
  AuthorizationResult,
  ExternalReadinessProvider,
  ExternalReadinessSnapshot,
  ReadinessDataCategory,
} from '../domain/health';

export const NOOP_READINESS_PROVIDER_ID = 'noop';

export const NOOP_READINESS_REASON = 'not_implemented_phase1';

export class NoopReadinessProvider implements ExternalReadinessProvider {
  readonly providerId = NOOP_READINESS_PROVIDER_ID;

  async isAvailable(): Promise<boolean> {
    return false;
  }

  async requestAuthorization(_categories: ReadinessDataCategory[]): Promise<AuthorizationResult> {
    return {
      granted: false,
      categories: [],
      reason: NOOP_READINESS_REASON,
    };
  }

  async getDailyReadiness(_date: string): Promise<ExternalReadinessSnapshot | null> {
    return null;
  }
}
