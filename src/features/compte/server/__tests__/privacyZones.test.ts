import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  createOutingShareLink,
  createPrivacyZone,
  isBlockedBetween,
  listOwnerPrivacyZones,
  resolveOutingShareToken,
  revokeAllOutingShareLinks,
  upsertOutingTracePrivacy,
  validatePrivacyZoneInput,
} from '../privacyZones';
import { resolveTraceMasks, projectTraceSampleSegments } from '../tracePrivacy';

function missingRelationSupabase(options: { blocked?: boolean } = {}): SupabaseClient {
  const err = { code: '42P01', message: 'relation does not exist' };
  const makeQuery = (table: string) => {
    const query = {
      select: () => query,
      insert: () => query,
      update: () => query,
      upsert: () => query,
      delete: () => query,
      eq: () => query,
      is: () => query,
      order: () => query,
      limit: () => query,
      single: async () => ({ data: null, error: err }),
      maybeSingle: async () =>
        table === 'user_blocks'
          ? { data: options.blocked ? { id: 'blk-1' } : null, error: null }
          : { data: null, error: err },
      then: (resolve: (v: unknown) => unknown, reject?: (r: unknown) => unknown) =>
        Promise.resolve({ data: null, error: err }).then(resolve, reject),
    };
    return query;
  };

  return {
    from: (table: string) => makeQuery(table),
  } as unknown as SupabaseClient;
}

describe('P01 privacyZones, tracePrivacy & revocable share links', () => {
  it('valide les bornes de rayon d’une zone privée (200..5000 m)', () => {
    expect(() =>
      validatePrivacyZoneInput({
        label: 'Maison',
        centerLat: 45.9,
        centerLng: 6.1,
        radiusM: 50,
      })
    ).toThrow('invalid_radius');

    expect(
      validatePrivacyZoneInput({
        label: '  Maison  ',
        centerLat: 45.9,
        centerLng: 6.1,
        radiusM: 500,
      })
    ).toMatchObject({ label: 'Maison', radiusM: 500, isActive: true });
  });

  it('génère et révoque immédiatement un lien de partage (K7.04)', async () => {
    const sb = missingRelationSupabase();
    const { token } = await createOutingShareLink(sb, 'owner-1', 'session-k704', 24);
    expect(token).toBeTruthy();

    const resolvedBefore = await resolveOutingShareToken(token);
    expect(resolvedBefore).toEqual({ sessionId: 'session-k704', ownerId: 'owner-1' });

    await revokeAllOutingShareLinks(sb, 'owner-1', 'session-k704');
    const resolvedAfter = await resolveOutingShareToken(token);
    expect(resolvedAfter).toBeNull();
  });

  it('applique les zones privées et le masquage départ/arrivée sur la trace projetée (K7.05 / S6.14)', async () => {
    const sb = missingRelationSupabase();
    const zone = await createPrivacyZone(sb, 'owner-pz', {
      label: 'Domicile',
      centerLat: 45.8,
      centerLng: 6.8,
      radiusM: 500,
    });
    const zones = await listOwnerPrivacyZones(sb, 'owner-pz');
    expect(zones.some((z) => z.id === zone.id)).toBe(true);

    const tp = await upsertOutingTracePrivacy(sb, 'owner-pz', 'sess-pz', {
      hideStartM: 300,
      hideEndM: 200,
      hideAll: false,
    });
    expect(tp.hideStartM).toBe(300);

    const masks = resolveTraceMasks({
      viewer: 'visitor',
      visibility: 'public',
      privacyZones: zones,
      tracePrivacy: tp,
    });

    const segments = [
      [
        { lat: 45.8, lng: 6.8, elevationM: 500, timestamp: '2026-10-01T08:00:00Z' },
        { lat: 45.81, lng: 6.8, elevationM: 600, timestamp: '2026-10-01T08:05:00Z' },
        { lat: 45.82, lng: 6.8, elevationM: 700, timestamp: '2026-10-01T08:10:00Z' },
        { lat: 45.83, lng: 6.8, elevationM: 800, timestamp: '2026-10-01T08:15:00Z' },
      ],
    ];
    const projected = projectTraceSampleSegments(segments, masks);
    expect(projected.masked).toBe(true);
    expect(projected.fullyMasked).toBe(false);
    const flat = projected.segments.flat();
    // Point de départ dans la zone privée 45.8 / 6.8 ne doit jamais fuiter
    expect(flat.some((pt) => Math.abs(pt.lat - 45.8) < 0.0005)).toBe(false);
  });

  it('détecte un blocage bidirectionnel (S6.19)', async () => {
    expect(await isBlockedBetween(missingRelationSupabase({ blocked: true }), 'u1', 'u2')).toBe(
      true
    );
    expect(await isBlockedBetween(missingRelationSupabase({ blocked: false }), 'u1', 'u2')).toBe(
      false
    );
  });
});
