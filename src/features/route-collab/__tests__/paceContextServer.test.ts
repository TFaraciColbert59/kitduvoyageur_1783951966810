import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn(async () => { throw new Error('pas de client réel en test'); }) }));

import { getPaceContextForUser, getPaceProfileForUser } from '../server/paceProfile';

const USER = '00000000-0000-4000-8000-000000000001';

const FULL_ROW = {
  user_id: USER,
  flat_speed_kmh: '5.2',
  ascent_speed_m_per_h: '450',
  descent_speed_m_per_h: '700',
  grade_response: { points: [{ x: 0, value: 1 }], interpolate: 'linear' },
  surface_response: { points: [{ x: 0, value: 1 }], interpolate: 'linear' },
  fatigue_curve: { points: [{ x: 0, value: 0 }], decayPerHour: 0 },
  pause_model: { pauseMinutesPerHour: 5, pauseMinutesPerAscentM: 0, minPauseMinutes: 0 },
  pack_response: { points: [{ x: 0, value: 1 }], interpolate: 'linear' },
  confidence: { score: 0.8, level: 'high', sampleCount: 12, method: 'test', reasons: [] },
  sample_count: 12,
  calibration_level: 'personalization',
  model_version: 'test',
  computed_at: '2026-11-01T10:00:00.000Z',
};

function client(authId: string | null, row: Record<string, unknown> | null, error: unknown = null): SupabaseClient {
  const query = {
    select: () => query,
    eq: () => query,
    maybeSingle: async () => ({ data: row, error }),
  };
  return {
    auth: { getUser: async () => ({ data: { user: authId ? { id: authId } : null } }) },
    from: () => query,
  } as unknown as SupabaseClient;
}

describe('10.8 · lecture serveur du profil pour /compas/itineraire', () => {
  it('profil appris : allure lisible et profil complet', async () => {
    const ctx = await getPaceContextForUser(USER, client(USER, FULL_ROW));
    expect(ctx?.pace).toEqual({ flatSpeedKmh: 5.2, ascentMPerHour: 450, calibrationLevel: 'personalization', sampleCount: 12 });
    expect(ctx?.performance?.flatSpeedKmH).toBe(5.2);
  });

  it('profil à froid : null (comportement actuel, allure standard dite)', async () => {
    expect(await getPaceContextForUser(USER, client(USER, { ...FULL_ROW, calibration_level: 'cold', sample_count: 0 }))).toBeNull();
  });

  it('aucun profil, erreur de lecture ou client en échec : null, jamais d’exception', async () => {
    expect(await getPaceContextForUser(USER, client(USER, null))).toBeNull();
    expect(await getPaceContextForUser(USER, client(USER, null, { message: 'boom' }))).toBeNull();
    expect(await getPaceContextForUser(USER)).toBeNull();
  });

  it('jamais le profil d’un tiers : l’identifiant demandé doit être celui de la session', async () => {
    expect(await getPaceProfileForUser('autre-personne', client(USER, FULL_ROW))).toBeNull();
    expect(await getPaceContextForUser(USER, client(null, FULL_ROW))).toBeNull();
  });
});
