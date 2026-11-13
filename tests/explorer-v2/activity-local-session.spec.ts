import { describe, expect, it } from 'vitest';
import {
  activityFromRecord,
  isUuid,
  newClientSessionId,
  parseLocalSessionRecord,
  recordFromActivity,
  sessionPointKey,
  type LocalSessionRecord,
} from '@/features/explorer-v2/activity/localSession';

const CLIENT_ID = '11111111-1111-4111-8111-111111111111';
const SERVER_ID = '22222222-2222-4222-8222-222222222222';

function record(overrides: Partial<LocalSessionRecord> = {}): LocalSessionRecord {
  return {
    version: 1,
    clientSessionId: CLIENT_ID,
    serverSessionId: SERVER_ID,
    sport: 'rando',
    selection: {
      sport: 'rando',
      variantId: 'rando-journee',
      variantLabel: 'Randonnée journée',
      catalogSlug: 'rando',
      environment: 'outdoor',
      metrics: ['distance', 'duration', 'elevation'],
    },
    startedAt: 1_700_000_000_000,
    endedAt: null,
    paused: false,
    distanceM: 1200,
    elevGainM: 80,
    movingS: 600,
    lastPointSeq: 12,
    syncedThroughSeq: 10,
    status: 'active',
    updatedAt: 1_700_000_100_000,
    ...overrides,
  };
}

describe('explorer-v2 · fiche locale de séance', () => {
  it('accepte une fiche complète et conserve les curseurs', () => {
    expect(parseLocalSessionRecord(record())).toEqual(record());
  });

  it('refuse une version inconnue, un identifiant invalide ou des métriques négatives', () => {
    expect(parseLocalSessionRecord({ ...record(), version: 2 })).toBeNull();
    expect(parseLocalSessionRecord({ ...record(), clientSessionId: 'pas-un-uuid' })).toBeNull();
    expect(parseLocalSessionRecord({ ...record(), distanceM: -1 })).toBeNull();
    expect(parseLocalSessionRecord({ ...record(), serverSessionId: 'scene' })).toBeNull();
    expect(parseLocalSessionRecord(null)).toBeNull();
  });

  it('garde l’ordre des points par clé de séquence', () => {
    expect(sessionPointKey(CLIENT_ID, 2) < sessionPointKey(CLIENT_ID, 10)).toBe(true);
    expect(sessionPointKey(CLIENT_ID, 10)).toBe(`${CLIENT_ID}:000000000010`);
  });

  it('crée un UUID stable au format attendu', () => {
    const generated = newClientSessionId();
    expect(isUuid(generated)).toBe(true);
    expect(isUuid('pas-un-uuid')).toBe(false);
  });

  it('reprend une fiche active sans changer l’identité ni reculer les curseurs', () => {
    const built = recordFromActivity(
      {
        sport: 'rando',
        clientSessionId: CLIENT_ID,
        sessionId: null,
        startedAt: 1_700_000_000_000,
        paused: true,
        offRoute: false,
        distanceM: 1300,
        elevGainM: 90,
        movingS: 660,
      },
      record(),
    );
    expect(built.clientSessionId).toBe(CLIENT_ID);
    expect(built.serverSessionId).toBe(SERVER_ID);
    expect(built.lastPointSeq).toBe(12);
    expect(built.syncedThroughSeq).toBe(10);
    expect(built.status).toBe('active');
    expect(built.paused).toBe(true);
  });

  it('ne restitue un bilan que si la séance est terminée', () => {
    expect(activityFromRecord(record())).toBeNull();
    const summary = activityFromRecord(record({ status: 'finished', endedAt: 1_700_000_200_000 }));
    expect(summary?.endedAt).toBe(1_700_000_200_000);
    expect(summary?.sessionId).toBe(SERVER_ID);
    expect(summary?.clientSessionId).toBe(CLIENT_ID);
  });
});
