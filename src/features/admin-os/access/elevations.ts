/**
 * JIT elevations — logique pure. Durée max 8 h, motif ≥ 10, break-glass
 * (Tier4 sans permission permanente) exige un ticket d'incident.
 */

export const MAX_ELEVATION_MIN = 8 * 60;

export interface ElevationRow {
  expires_at: string;
  revoked_at: string | null;
}

export function isElevationActive(e: ElevationRow, now = Date.now()): boolean {
  return e.revoked_at === null && Date.parse(e.expires_at) > now;
}

export interface ElevationRequest {
  permission_code: string;
  reason: string;
  ticket_id?: string;
  duration_min: number;
  tier: 0 | 1 | 2 | 3 | 4;
}

/** Retourne null si valide, sinon le code d'erreur. */
export function validateElevationRequest(r: ElevationRequest): string | null {
  if (!r.permission_code?.trim()) return 'permission_required';
  if (!r.reason?.trim() || r.reason.trim().length < 10) return 'reason_required';
  if (!Number.isFinite(r.duration_min) || r.duration_min <= 0) return 'invalid_duration';
  if (r.duration_min > MAX_ELEVATION_MIN) return 'elevation_too_long';
  if (r.tier >= 4 && !r.ticket_id?.trim()) return 'break_glass_ticket_required';
  return null;
}
