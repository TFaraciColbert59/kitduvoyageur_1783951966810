import { describe, expect, it } from 'vitest';
import {
  buildSportProfileSummary,
  defaultSportProfilePreferences,
  mergeSportProfilePreferences,
  normalizeSportProfilePreferences,
  resolveSportProfileAccess,
} from '../sportProfile';

const OWNER = '11111111-1111-4111-8111-111111111111';
const VIEWER = '22222222-2222-4222-8222-222222222222';

function publicPreferences() {
  return mergeSportProfilePreferences(defaultSportProfilePreferences(), {
    audience: 'public',
    sports: { rando: true, velo: true, trail: false },
    show_totals: true,
    show_records: true,
  });
}

describe('G01 sport profile — préférences', () => {
  it('est privé et sans sport par défaut', () => {
    const prefs = defaultSportProfilePreferences();
    expect(prefs.audience).toBe('private');
    expect(Object.values(prefs.sports).every((value) => value === false)).toBe(true);
    expect(prefs.show_records).toBe(false);
  });

  it('refuse les coercitions et les schémas inconnus', () => {
    const normalized = normalizeSportProfilePreferences({
      schema: 'autre',
      audience: 'public',
      sports: { rando: true },
    });
    expect(normalized.audience).toBe('private');
    expect(normalized.sports.rando).toBe(false);

    const coerced = normalizeSportProfilePreferences({
      schema: 'lkdv.sport-profile.v1',
      audience: 'public',
      sports: { rando: 'true', velo: 1, trail: true },
    });
    expect(coerced.sports.rando).toBe(false);
    expect(coerced.sports.velo).toBe(false);
    expect(coerced.sports.trail).toBe(true);
  });

  it('borne une audience inconnue à privé', () => {
    expect(
      normalizeSportProfilePreferences({
        schema: 'lkdv.sport-profile.v1',
        audience: 'amis',
        sports: {},
      }).audience
    ).toBe('private');
  });
});

describe('G01 sport profile — accès', () => {
  it('autorise toujours le propriétaire', () => {
    const access = resolveSportProfileAccess({
      ownerId: OWNER,
      viewer: { viewerId: OWNER },
      preferences: defaultSportProfilePreferences(),
      profileVisibility: 'private',
    });
    expect(access.allowed).toBe(true);
    expect(access.reason).toBe('owner');
  });

  it('refuse un profil privé même si les préférences sportives sont publiques', () => {
    const access = resolveSportProfileAccess({
      ownerId: OWNER,
      viewer: { viewerId: VIEWER, blocked: false },
      preferences: publicPreferences(),
      profileVisibility: 'private',
    });
    expect(access.allowed).toBe(false);
    expect(access.reason).toBe('profile_private');
  });

  it('refuse un blocage inconnu', () => {
    const access = resolveSportProfileAccess({
      ownerId: OWNER,
      viewer: { viewerId: VIEWER, blocked: null },
      preferences: publicPreferences(),
      profileVisibility: 'public',
    });
    expect(access.allowed).toBe(false);
    expect(access.reason).toBe('blocked_unknown');
  });

  it('demande un suivi prouvé pour l’audience abonnés', () => {
    const prefs = mergeSportProfilePreferences(publicPreferences(), { audience: 'abonnies' });
    const denied = resolveSportProfileAccess({
      ownerId: OWNER,
      viewer: { viewerId: VIEWER, blocked: false, isFollower: false },
      preferences: prefs,
      profileVisibility: 'public',
    });
    expect(denied.allowed).toBe(false);
    expect(denied.reason).toBe('followers_only');

    const allowed = resolveSportProfileAccess({
      ownerId: OWNER,
      viewer: { viewerId: VIEWER, blocked: false, isFollower: true },
      preferences: prefs,
      profileVisibility: 'public',
    });
    expect(allowed.allowed).toBe(true);
  });

  it('autorise un visiteur anonyme sur un profil public', () => {
    const access = resolveSportProfileAccess({
      ownerId: OWNER,
      viewer: { viewerId: null, blocked: false },
      preferences: publicPreferences(),
      profileVisibility: 'public',
    });
    expect(access.allowed).toBe(true);
    expect(access.reason).toBe('anonymous_public');
  });
});

describe('G01 sport profile — résumé', () => {
  const aggregates = [
    {
      sport: 'rando',
      sessions: 4,
      distanceKm: 48.2,
      elevationGainM: 3200,
      durationSeconds: 36000,
    },
    {
      sport: 'velo',
      sessions: 2,
      distanceKm: 90,
      elevationGainM: 800,
      durationSeconds: 14400,
    },
    {
      sport: 'trail',
      sessions: 3,
      distanceKm: 30,
      elevationGainM: 2100,
      durationSeconds: 10800,
    },
    {
      sport: 'ski',
      sessions: 1,
      distanceKm: 10,
      elevationGainM: 400,
      durationSeconds: 3600,
    },
  ];

  const records = [
    {
      id: 'rec-1',
      sport: 'rando',
      stat: 'distance' as const,
      value: 21,
      visibility: 'collective_anonymized',
    },
    {
      id: 'rec-2',
      sport: 'rando',
      stat: 'elevation' as const,
      value: 1200,
      visibility: 'private',
    },
    {
      id: 'rec-3',
      sport: 'velo',
      stat: 'speed' as const,
      value: 32,
      visibility: 'public',
    },
  ];

  it('ne rend que les sports explicitement cochés', () => {
    const summary = buildSportProfileSummary({
      ownerId: OWNER,
      viewer: { viewerId: VIEWER, blocked: false },
      preferences: publicPreferences(),
      profileVisibility: 'public',
      aggregates,
      records,
    });
    expect(summary.visible).toBe(true);
    expect(summary.sports.map((sport) => sport.sport)).toEqual(['rando', 'velo']);
    expect(summary.sports.find((sport) => sport.sport === 'rando')?.distanceLabel).toMatch(/48,2/);
  });

  it('ne divulgue pas les records privés', () => {
    const summary = buildSportProfileSummary({
      ownerId: OWNER,
      viewer: { viewerId: VIEWER, blocked: false },
      preferences: publicPreferences(),
      profileVisibility: 'public',
      aggregates,
      records,
    });
    expect(summary.records.map((record) => record.id)).toEqual(['rec-1', 'rec-3']);
    expect(summary.records.some((record) => record.id === 'rec-2')).toBe(false);
  });

  it('masque les totaux quand l’auteur le demande', () => {
    const prefs = mergeSportProfilePreferences(publicPreferences(), { show_totals: false });
    const summary = buildSportProfileSummary({
      ownerId: OWNER,
      viewer: { viewerId: VIEWER, blocked: false },
      preferences: prefs,
      profileVisibility: 'public',
      aggregates,
    });
    expect(summary.sports[0].distanceLabel).toBeNull();
    expect(summary.sports[0].elevationLabel).toBeNull();
    expect(summary.sports[0].durationLabel).toBeNull();
  });

  it('ne rend rien pour un visiteur non autorisé', () => {
    const summary = buildSportProfileSummary({
      ownerId: OWNER,
      viewer: { viewerId: VIEWER, blocked: false },
      preferences: publicPreferences(),
      profileVisibility: 'private',
      aggregates,
    });
    expect(summary.visible).toBe(false);
    expect(summary.sports).toEqual([]);
    expect(summary.records).toEqual([]);
  });

  it('ne divulgue pas de sport sans donnée', () => {
    const summary = buildSportProfileSummary({
      ownerId: OWNER,
      viewer: { viewerId: VIEWER, blocked: false },
      preferences: publicPreferences(),
      profileVisibility: 'public',
      aggregates: [{ sport: 'rando', sessions: 0 }],
    });
    expect(summary.sports).toEqual([]);
    expect(summary.hasData).toBe(false);
  });
});
