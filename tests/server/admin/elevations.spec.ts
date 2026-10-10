import { describe, expect, it } from 'vitest';

import { isElevationActive, validateElevationRequest } from '@/features/admin-os/access/elevations';

const NOW = Date.now();

describe('JIT elevations', () => {
  it('active seulement si non révoquée et non expirée', () => {
    expect(
      isElevationActive({ expires_at: new Date(NOW + 3600000).toISOString(), revoked_at: null }, NOW)
    ).toBe(true);
    expect(
      isElevationActive({ expires_at: new Date(NOW - 1000).toISOString(), revoked_at: null }, NOW)
    ).toBe(false);
    expect(
      isElevationActive({ expires_at: new Date(NOW + 3600000).toISOString(), revoked_at: new Date().toISOString() }, NOW)
    ).toBe(false);
  });

  it('break-glass Tier4 exige un ticket, durée ≤ 8 h', () => {
    expect(
      validateElevationRequest({ permission_code: 'commerce.refund.approve', reason: 'incident de paiement majeur en cours', ticket_id: 'INC-1', duration_min: 60, tier: 4 })
    ).toBeNull();
    expect(
      validateElevationRequest({ permission_code: 'commerce.refund.approve', reason: 'incident de paiement majeur en cours', duration_min: 60, tier: 4 })
    ).toBe('break_glass_ticket_required');
    expect(
      validateElevationRequest({ permission_code: 'users.profile.read', reason: 'courte', duration_min: 30, tier: 0 })
    ).toBe('reason_required');
    expect(
      validateElevationRequest({ permission_code: 'users.profile.read', reason: 'motif suffisant ici', duration_min: 600, tier: 0 })
    ).toBe('elevation_too_long');
  });
});
