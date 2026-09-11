import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

import { createClient } from '@/lib/supabase/server';
import {
  processHikeSession,
  PROCESSOR_VERSION,
  type GpsPoint,
  type HikeProcessingClient,
  type HikeSessionRow,
  type PersistTranscriptInput,
} from '@/features/adventure-intelligence/server/processHikeSession';
import {
  setConsent,
  CONSENT_POLICY_VERSION,
  CONSENT_REVOCATION_PROCESSOR_VERSION,
} from '@/features/adventure-intelligence/server/consents';
import {
  processAdventureEvents,
  type AdventureEventProcessingClient,
  type AdventureEventRow,
} from '@/features/adventure-intelligence/server/processAdventureEvents';
import type { SegmentCandidate } from '@/features/adventure-intelligence/domain/mapMatching';
import type { TrackPoint } from '@/features/adventure-intelligence/domain/trackNormalization';

const SESSION_ID = '72100000-0000-4000-8000-0000000000aa';
const USER_ID = 'a2111111-1111-1111-1111-111111111111';

function at(seconds: number): string {
  return new Date(Date.UTC(2026, 8, 11, 8, 0, 0) + seconds * 1000).toISOString();
}

function sessionRow(overrides: Partial<HikeSessionRow> = {}): HikeSessionRow {
  return {
    id: SESSION_ID,
    user_id: USER_ID,
    positions_geojson: null,
    processing_status: 'pending',
    processor_version: null,
    ended_at: at(300),
    ...overrides,
  };
}

function northTrack(count: number, startLat = 44, stepDeg = 0.0001): TrackPoint[] {
  return Array.from({ length: count }, (_, index) => ({
    lat: startLat + index * stepDeg,
    lng: 6,
    timestamp: at(index * 10),
  }));
}

const candidateNorth: SegmentCandidate = { segmentId: 777, distanceM: 5, bearingDeg: 0 };

interface ConsentOptions {
  personal?: boolean;
  collective?: boolean;
  throws?: boolean;
}

function makeClient(
  session: HikeSessionRow | null,
  consents: ConsentOptions = {}
): {
  client: HikeProcessingClient;
  transcripts: PersistTranscriptInput[];
  consentCalls: Array<{ userId: string; purpose: string }>;
} {
  const transcripts: PersistTranscriptInput[] = [];
  const consentCalls: Array<{ userId: string; purpose: string }> = [];

  const client: HikeProcessingClient = {
    getSession: vi.fn().mockResolvedValue(session),
    hasActiveConsent: vi.fn().mockImplementation(async (userId: string, purpose: string) => {
      consentCalls.push({ userId, purpose });
      if (consents.throws) throw new Error('rpc indisponible');
      if (purpose === 'personal_performance') return consents.personal === true;
      if (purpose === 'collective_terrain') return consents.collective === true;
      return false;
    }),
    getCandidatesBatch: vi.fn().mockImplementation(async (points: GpsPoint[]) =>
      points.map(() => [candidateNorth])
    ),
    persistTranscript: vi.fn().mockImplementation(async (input: PersistTranscriptInput) => {
      transcripts.push(input);
    }),
    markSession: vi.fn().mockResolvedValue(undefined),
  };
  return { client, transcripts, consentCalls };
}

describe('A10 — Consentement imposé au traitement GPS (TEST-A10-CONS)', () => {
  it('TEST-A10-CONS-01: personal_performance inactif ⇒ aucune observation, passages privés', async () => {
    const { client, transcripts, consentCalls } = makeClient(
      sessionRow({ positions_geojson: northTrack(5) }),
      { personal: false, collective: false }
    );

    const result = await processHikeSession(SESSION_ID, client);

    expect(result).toEqual({ status: 'processed', passages: 1 });
    expect(consentCalls).toEqual([
      { userId: USER_ID, purpose: 'personal_performance' },
      { userId: USER_ID, purpose: 'collective_terrain' },
    ]);
    const transcript = transcripts[0];
    expect(transcript.passages).toHaveLength(1);
    expect(transcript.observations).toHaveLength(0);
    const passages = transcript.passages as Record<string, unknown>[];
    expect(passages[0]).toMatchObject({ eligible_for_collective: false, processor_version: PROCESSOR_VERSION });
  });

  it('TEST-A10-CONS-02: collective_terrain inactif ⇒ aucune inclusion collective, observations privées conservées', async () => {
    const { client, transcripts } = makeClient(
      sessionRow({ positions_geojson: northTrack(5) }),
      { personal: true, collective: false }
    );

    await processHikeSession(SESSION_ID, client);

    const transcript = transcripts[0];
    expect(transcript.observations).toHaveLength(1);
    const passages = transcript.passages as Record<string, unknown>[];
    expect(passages[0].eligible_for_collective).toBe(false);
  });

  it('TEST-A10-CONS-03: les deux consentements actifs ⇒ observations et éligibilité collective', async () => {
    const { client, transcripts } = makeClient(
      sessionRow({ positions_geojson: northTrack(5) }),
      { personal: true, collective: true }
    );

    await processHikeSession(SESSION_ID, client);

    const transcript = transcripts[0];
    expect(transcript.observations).toHaveLength(1);
    const passages = transcript.passages as Record<string, unknown>[];
    expect(passages[0].eligible_for_collective).toBe(true);
  });

  it('TEST-A10-CONS-04: une erreur du contrôle de consentement ⇒ repli fermé (aucune dérivation)', async () => {
    const { client, transcripts } = makeClient(
      sessionRow({ positions_geojson: northTrack(5) }),
      { throws: true }
    );

    const result = await processHikeSession(SESSION_ID, client);

    expect(result).toEqual({ status: 'processed', passages: 1 });
    const transcript = transcripts[0];
    expect(transcript.observations).toHaveLength(0);
    const passages = transcript.passages as Record<string, unknown>[];
    expect(passages[0].eligible_for_collective).toBe(false);
  });
});

function authenticatedClient(from: unknown) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: USER_ID } }, error: null }),
    },
    from,
  };
}

describe('A10 — Révocation : événement et purge (TEST-A10-CONS)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('TEST-A10-CONS-05: la révocation émet consent.revoked avec une clé stable, sans jamais bloquer', async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    const insert = vi.fn().mockResolvedValue({ error: null });
    const from = vi.fn((table: string) =>
      table === 'adventure_data_consents' ? { upsert } : { insert }
    );
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue(authenticatedClient(from));

    await expect(setConsent('personal_performance', false)).resolves.toEqual({ ok: true });

    expect(insert).toHaveBeenCalledTimes(1);
    const [event] = insert.mock.calls[0];
    expect(event).toMatchObject({
      event_type: 'consent.revoked',
      entity_type: 'adventure_data_consent',
      entity_id: `${USER_ID}:personal_performance`,
      actor_id: USER_ID,
      status: 'pending',
      processor_version: CONSENT_REVOCATION_PROCESSOR_VERSION,
    });
    expect(event.payload).toMatchObject({
      userId: USER_ID,
      purpose: 'personal_performance',
      policyVersion: CONSENT_POLICY_VERSION,
    });
    expect(String(event.idempotency_key)).toContain(`consent.revoked:${USER_ID}:personal_performance:`);
    expect(event.idempotency_key).toBe(event.idempotency_key.trim());

    // Un accord ne doit émettre aucun événement de révocation.
    insert.mockClear();
    await expect(setConsent('collective_terrain', true)).resolves.toEqual({ ok: true });
    expect(insert).not.toHaveBeenCalled();

    // Une panne de la file ne bloque jamais la révocation.
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue(
      authenticatedClient((table: string) =>
        table === 'adventure_data_consents'
          ? { upsert }
          : {
              insert: () => {
                throw new Error('file indisponible');
              },
            }
      )
    );
    await expect(setConsent('collective_terrain', false)).resolves.toEqual({ ok: true });
  });

  it('TEST-A10-CONS-05b: consent.revoked purge observations, profil, prédictions et agrégats contribués', async () => {
    const calls: string[] = [];
    const event: AdventureEventRow = {
      id: 'evt-1',
      event_type: 'consent.revoked',
      entity_type: 'adventure_data_consent',
      entity_id: `${USER_ID}:personal_performance`,
      actor_id: USER_ID,
      payload: { userId: USER_ID, purpose: 'personal_performance' },
      status: 'processing',
      attempts: 1,
    };
    const deletedAggregates: number[][] = [];
    const client: AdventureEventProcessingClient = {
      claimPendingEvents: vi.fn().mockResolvedValue([event]),
      listContributedSegmentIds: vi.fn(async () => {
        calls.push('segments');
        return [10, 20, 20];
      }),
      deleteObservations: vi.fn(async () => {
        calls.push('observations');
      }),
      deleteProfileVersions: vi.fn(async () => {
        calls.push('profile_versions');
      }),
      deleteProfile: vi.fn(async () => {
        calls.push('profile');
      }),
      deleteSegmentPredictions: vi.fn(async () => {
        calls.push('segment_predictions');
      }),
      deleteRoutePredictions: vi.fn(async () => {
        calls.push('route_predictions');
      }),
      deleteCollectiveAggregates: vi.fn(async (segmentIds: number[]) => {
        calls.push('aggregates');
        deletedAggregates.push(segmentIds);
      }),
      markEventProcessed: vi.fn(async (id: string) => {
        calls.push(`processed:${id}`);
      }),
      markEventFailed: vi.fn(async (id: string, error: string) => {
        calls.push(`failed:${id}:${error}`);
      }),
    };

    const result = await processAdventureEvents(client, { limit: 5 });

    expect(result).toEqual({ processed: 1, failed: 0, skipped: 0 });
    expect(calls).toEqual([
      'observations',
      'profile_versions',
      'profile',
      'segment_predictions',
      'route_predictions',
      'segments',
      'aggregates',
      'processed:evt-1',
    ]);
    expect(deletedAggregates).toEqual([[10, 20]]);
  });

  it('TEST-A10-CONS-05c: événement inexploitable marqué en échec, jamais traité silencieusement', async () => {
    const event: AdventureEventRow = {
      id: 'evt-2',
      event_type: 'consent.revoked',
      entity_type: 'adventure_data_consent',
      entity_id: 'orphelin',
      actor_id: null,
      payload: {},
      status: 'processing',
      attempts: 1,
    };
    const client: AdventureEventProcessingClient = {
      claimPendingEvents: vi.fn().mockResolvedValue([event]),
      listContributedSegmentIds: vi.fn(),
      deleteObservations: vi.fn(),
      deleteProfileVersions: vi.fn(),
      deleteProfile: vi.fn(),
      deleteSegmentPredictions: vi.fn(),
      deleteRoutePredictions: vi.fn(),
      deleteCollectiveAggregates: vi.fn(),
      markEventProcessed: vi.fn(),
      markEventFailed: vi.fn(),
    };

    const result = await processAdventureEvents(client);

    expect(result).toEqual({ processed: 0, failed: 1, skipped: 0 });
    expect(client.markEventFailed).toHaveBeenCalledWith('evt-2', 'missing_user_id');
    expect(client.markEventProcessed).not.toHaveBeenCalled();
  });

  it('TEST-A10-CONS-05d: aucun événement à traiter ⇒ aucun effet', async () => {
    const client: AdventureEventProcessingClient = {
      claimPendingEvents: vi.fn().mockResolvedValue([]),
      listContributedSegmentIds: vi.fn(),
      deleteObservations: vi.fn(),
      deleteProfileVersions: vi.fn(),
      deleteProfile: vi.fn(),
      deleteSegmentPredictions: vi.fn(),
      deleteRoutePredictions: vi.fn(),
      deleteCollectiveAggregates: vi.fn(),
      markEventProcessed: vi.fn(),
      markEventFailed: vi.fn(),
    };

    const result = await processAdventureEvents(client);

    expect(result).toEqual({ processed: 0, failed: 0, skipped: 0 });
    expect(client.deleteObservations).not.toHaveBeenCalled();
  });
});
