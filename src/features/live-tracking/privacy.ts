import type {
  GuestPositionView,
  LivePositionPoint,
  LiveSessionState,
  P01PrivacyContext,
  PersistedShareTokenRecord,
  PositionFreshness,
} from './types';

export const FRESH_THRESHOLD_SECONDS = 60;
export const OFFLINE_THRESHOLD_SECONDS = 300;

export type AccessEvaluationResult =
  | { allowed: true }
  | {
      allowed: false;
      reason: 'invalid_token' | 'revoked' | 'expired' | 'session_ended' | 'privacy_denied';
    };

/**
 * Évaluation fail-closed stricte combinant état du jeton, état de la séance et règles P01.
 */
export function evaluateShareAccess(
  tokenRecord: PersistedShareTokenRecord | null,
  session: LiveSessionState | null,
  privacy: P01PrivacyContext,
  nowMs: number,
): AccessEvaluationResult {
  if (!tokenRecord) {
    return { allowed: false, reason: 'invalid_token' };
  }
  if (tokenRecord.revokedAtMs !== null) {
    return { allowed: false, reason: 'revoked' };
  }
  if (nowMs >= tokenRecord.expiresAtMs) {
    return { allowed: false, reason: 'expired' };
  }
  if (!session || session.status === 'ended') {
    return { allowed: false, reason: 'session_ended' };
  }
  if (!privacy.liveSharingAllowed) {
    return { allowed: false, reason: 'privacy_denied' };
  }
  if (
    privacy.viewerId &&
    session.blockedViewerIds &&
    session.blockedViewerIds.includes(privacy.viewerId)
  ) {
    return { allowed: false, reason: 'privacy_denied' };
  }
  return { allowed: true };
}

export function computePositionFreshness(
  recordedAtMs: number,
  nowMs: number,
): { ageSeconds: number; freshness: PositionFreshness; isStale: boolean } {
  const ageSeconds = Math.max(0, Math.floor((nowMs - recordedAtMs) / 1000));
  if (ageSeconds <= FRESH_THRESHOLD_SECONDS) {
    return { ageSeconds, freshness: 'live', isStale: false };
  }
  if (ageSeconds <= OFFLINE_THRESHOLD_SECONDS) {
    return { ageSeconds, freshness: 'stale', isStale: true };
  }
  return { ageSeconds, freshness: 'offline', isStale: true };
}

/**
 * Applique l'éventuel floutage P01 (grille métrique) avant exposition à un invité.
 */
export function applyPositionPrivacy(
  point: LivePositionPoint,
  nowMs: number,
  obfuscationRadiusM = 0,
): GuestPositionView {
  let lat = point.lat;
  let lng = point.lng;

  if (obfuscationRadiusM > 0) {
    // 1 degré de latitude ~ 111 320 m
    const latStep = obfuscationRadiusM / 111_320;
    const cosLat = Math.max(0.1, Math.cos((lat * Math.PI) / 180));
    const lngStep = obfuscationRadiusM / (111_320 * cosLat);
    lat = Math.round(lat / latStep) * latStep;
    lng = Math.round(lng / lngStep) * lngStep;
  }

  const { ageSeconds, freshness, isStale } = computePositionFreshness(point.recordedAtMs, nowMs);

  return {
    lat: Number(lat.toFixed(6)),
    lng: Number(lng.toFixed(6)),
    accuracyM: point.accuracyM ?? null,
    recordedAtIso: new Date(point.recordedAtMs).toISOString(),
    ageSeconds,
    freshness,
    isStale,
  };
}

export function assertValidCoordinates(lat: number, lng: number): void {
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
    throw new Error('Latitude invalide (attendu entre -90 et 90).');
  }
  if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
    throw new Error('Longitude invalide (attendu entre -180 et 180).');
  }
}
