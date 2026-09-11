import { describe, it, expect, vi } from 'vitest';
import {
  processHikeSession,
  PROCESSOR_VERSION,
  MAX_TIMED_SAMPLES,
  persistedGpsSamplesSchema,
  type GpsPoint,
  type HikeProcessingClient,
  type HikeSessionRow,
  type PersistTranscriptInput,
} from '@/features/adventure-intelligence/server/processHikeSession';
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

interface FakeCalls {
  candidateBatches: Array<{ points: GpsPoint[]; radiusM: number }>;
  transcripts: PersistTranscriptInput[];
  marks: Array<[string, Record<string, unknown>]>;
}

interface FakeStore {
  /** clé complète `segment|direction|entered_at` → id persisté */
  passages: Map<string, string>;
  /** `passageId|processorVersion` → ligne d'observation résolue */
  observations: Map<string, Record<string, unknown>>;
}

const candidateNorth: SegmentCandidate = { segmentId: 777, distanceM: 5, bearingDeg: 0 };

/**
 * Client factice transactionnel : `persistTranscript` ne rend visibles les
 * écritures qu'une fois toutes les observations rattachées (comme la RPC).
 */
function makeClient(
  session: HikeSessionRow | null,
  candidateBatchFor?: (points: GpsPoint[], radiusM: number) => SegmentCandidate[][] | never,
  options: { persistError?: Error } = {}
): { client: HikeProcessingClient; calls: FakeCalls; store: FakeStore } {
  const calls: FakeCalls = { candidateBatches: [], transcripts: [], marks: [] };
  const store: FakeStore = { passages: new Map(), observations: new Map() };
  let passageCounter = 0;

  const client: HikeProcessingClient = {
    getSession: vi.fn().mockResolvedValue(session),
    getCandidatesBatch: vi.fn().mockImplementation(async (points: GpsPoint[], radiusM: number) => {
      calls.candidateBatches.push({ points, radiusM });
      if (!candidateBatchFor) return points.map(() => [candidateNorth]);
      return candidateBatchFor(points, radiusM);
    }),
    persistTranscript: vi.fn().mockImplementation(async (input: PersistTranscriptInput) => {
      calls.transcripts.push(input);
      if (options.persistError) throw options.persistError;

      const passages = new Map(store.passages);
      for (const row of input.passages as Record<string, unknown>[]) {
        const key = `${row.segment_id}|${row.direction}|${row.entered_at}`;
        if (!passages.has(key)) {
          passageCounter += 1;
          passages.set(key, `passage-${passageCounter}`);
        }
      }

      const observations = new Map(store.observations);
      for (const row of input.observations as Record<string, unknown>[]) {
        const passageId = passages.get(String(row.passage_key));
        if (!passageId) throw new Error(`passage introuvable pour ${String(row.passage_key)}`);
        observations.set(`${passageId}|${input.processorVersion}`, {
          ...row,
          passage_id: passageId,
        });
      }

      store.passages = passages;
      store.observations = observations;
    }),
    markSession: vi.fn().mockImplementation(async (id: string, patch: Record<string, unknown>) => {
      calls.marks.push([id, patch]);
    }),
  };
  return { client, calls, store };
}

describe('Orchestrateur de session — TEST-A2-PROC (client factice)', () => {
  it('TEST-A2-PROC-01: session déjà traitée par la même version ⇒ skipped', async () => {
    const already = sessionRow({ processing_status: 'processed', processor_version: PROCESSOR_VERSION });
    const { client, calls } = makeClient(already, (batch) => batch.map(() => [candidateNorth]));

    const result = await processHikeSession(SESSION_ID, client);

    expect(result).toEqual({ status: 'skipped', passages: 0, reason: 'already_processed' });
    expect(calls.candidateBatches).toHaveLength(0);
    expect(calls.transcripts).toHaveLength(0);
    expect(calls.marks).toHaveLength(0);

    const { client: staleClient, calls: staleCalls } = makeClient(
      sessionRow({
        processing_status: 'processed',
        processor_version: 'a1-v0',
        positions_geojson: northTrack(4),
      }),
      (batch) => batch.map(() => [candidateNorth])
    );
    const stale = await processHikeSession(SESSION_ID, staleClient);
    expect(stale.status).toBe('processed');
    expect(staleCalls.transcripts).toHaveLength(1);
    expect(staleCalls.marks).toHaveLength(0);
  });

  it('TEST-A2-PROC-02: payload de positions invalide ⇒ failed sans écriture', async () => {
    const broken = sessionRow({
      positions_geojson: { type: 'LineString', coordinates: [['a', 'b']] },
    });
    const { client, calls } = makeClient(broken, (batch) => batch.map(() => [candidateNorth]));

    const result = await processHikeSession(SESSION_ID, client);

    expect(result.status).toBe('failed');
    expect(result.reason).toBe('invalid_payload');
    expect(calls.transcripts).toHaveLength(0);
    expect(calls.marks[0][1].processing_status).toBe('failed');
    expect(calls.marks[0][1].processor_version).toBe(PROCESSOR_VERSION);

    const tooShort = sessionRow({ positions_geojson: { type: 'LineString', coordinates: [[6, 44]] } });
    const { client: shortClient, calls: shortCalls } = makeClient(tooShort, (batch) => batch.map(() => [candidateNorth]));
    const shortResult = await processHikeSession(SESSION_ID, shortClient);
    expect(shortResult.status).toBe('failed');
    expect(shortCalls.transcripts).toHaveLength(0);
  });

  it('TEST-A2-PROC-03: écrit un passage et une observation par passage', async () => {
    const points = Array.from({ length: 5 }, (_, index) => ({
      lat: 44 + index * 0.00001,
      lng: 6,
      timestamp: at(index * 10),
    }));
    const { client, calls, store } = makeClient(
      sessionRow({ positions_geojson: points }),
      (batch) => batch.map(() => [candidateNorth])
    );

    const result = await processHikeSession(SESSION_ID, client);

    expect(result).toEqual({ status: 'processed', passages: 1 });
    expect(calls.candidateBatches).toHaveLength(1);
    expect(calls.candidateBatches[0].points[0].lat).toBeCloseTo(44, 6);
    expect(calls.candidateBatches[0].radiusM).toBe(35);

    const transcript = calls.transcripts[0];
    expect(transcript.passages).toHaveLength(1);
    const passages = transcript.passages as Record<string, unknown>[];
    expect(passages[0]).toMatchObject({
      session_id: SESSION_ID,
      user_id: USER_ID,
      segment_id: 777,
      direction: 'forward',
      uturn_detected: false,
      off_route: false,
      eligible_for_collective: true,
      processor_version: PROCESSOR_VERSION,
    });
    expect(passages[0].entered_at).toBe(at(0));
    expect(passages[0].exited_at).toBe(at(40));
    expect(passages[0].duration_s).toBe(40);
    expect(passages[0].map_match_quality).toBeCloseTo(1, 5);

    expect(transcript.observations).toHaveLength(1);
    const observations = transcript.observations as Record<string, unknown>[];
    expect(observations[0]).toMatchObject({
      session_id: SESSION_ID,
      user_id: USER_ID,
      passage_key: `777|forward|${at(0)}`,
      observed_at: at(40),
      declared_fatigue: null,
      perceived_difficulty: null,
      pack_weight_kg: null,
      processor_version: PROCESSOR_VERSION,
    });
    expect(observations[0].passage_id).toBeUndefined();
    expect(Number(observations[0].duration_s)).toBeGreaterThan(0);
    expect(typeof observations[0].quality).toBe('number');
    expect(store.observations.get(`passage-1|${PROCESSOR_VERSION}`)).toMatchObject({
      passage_id: 'passage-1',
    });

    // Le succès est marqué par la RPC transactionnelle, pas par markSession.
    expect(calls.marks).toHaveLength(0);
    expect(transcript.trackQuality).toMatchObject({ overall: expect.any(Number) });

    // Deux passages sur le même segment (aller/retour) : clés complètes et ids distincts.
    const backAndForth = [
      ...northTrack(4),
      { lat: 44.0002, lng: 6, timestamp: at(40) },
      { lat: 44.0001, lng: 6, timestamp: at(50) },
      { lat: 44, lng: 6, timestamp: at(60) },
    ];
    const { client: loopClient, calls: loopCalls, store: loopStore } = makeClient(
      sessionRow({ positions_geojson: backAndForth }),
      (batch) => batch.map(() => [candidateNorth])
    );
    await processHikeSession(SESSION_ID, loopClient);
    const loopObservations = loopCalls.transcripts[0].observations as Record<string, unknown>[];
    expect(loopObservations).toHaveLength(2);
    expect(loopObservations[0].passage_key).not.toBe(loopObservations[1].passage_key);
    expect(Array.from(loopStore.observations.values()).map((row) => row.passage_id)).toEqual([
      'passage-1',
      'passage-2',
    ]);
  });

  it('TEST-A2-PROC-04: sous le seuil de map-matching, le passage n’est pas collectif', async () => {
    const points = northTrack(6);
    const { client, calls } = makeClient(sessionRow({ positions_geojson: points }), (batch) =>
      batch.map((point) => (point.lat < 44.00025 ? [candidateNorth] : []))
    );

    const result = await processHikeSession(SESSION_ID, client);

    expect(result).toEqual({ status: 'processed', passages: 1 });
    const passages = calls.transcripts[0].passages as Record<string, unknown>[];
    expect(passages[0].map_match_quality).toBeCloseTo(0.5, 5);
    expect(Number(passages[0].gps_quality)).toBeGreaterThanOrEqual(0.6);
    expect(passages[0].eligible_for_collective).toBe(false);
  });

  it('TEST-A2-PROC-05: une erreur de candidats ⇒ failed, rien n’est écrit', async () => {
    const { client, calls, store } = makeClient(sessionRow({ positions_geojson: northTrack(4) }), () => {
      throw new Error('postgis indisponible');
    });

    const result = await processHikeSession(SESSION_ID, client);

    expect(result.status).toBe('failed');
    expect(result.reason).toBe('postgis indisponible');
    expect(calls.transcripts).toHaveLength(0);
    expect(store.passages.size).toBe(0);
    expect(store.observations.size).toBe(0);
    expect(calls.marks[0][1].processing_status).toBe('failed');
  });

  it('TEST-A2-PROC-06: un GeoJSON LineString legacy produit un passage privé sans observation', async () => {
    const geojson = {
      type: 'LineString',
      coordinates: [
        [6, 44, 1000],
        [6, 44.0001, 1005],
        [6, 44.0002, 1010],
        [6, 44.0003, 1015],
      ],
    };
    const { client, calls } = makeClient(
      sessionRow({ positions_geojson: geojson, ended_at: at(30) }),
      (batch) => batch.map(() => [candidateNorth])
    );

    const result = await processHikeSession(SESSION_ID, client);

    expect(result).toEqual({
      status: 'processed',
      passages: 1,
      warning: 'timed_samples_missing',
    });
    expect(calls.candidateBatches[0].points[0].lat).toBeCloseTo(44, 6);
    expect(calls.candidateBatches[0].points[0].lng).toBeCloseTo(6, 6);

    const passages = calls.transcripts[0].passages as Record<string, unknown>[];
    expect(passages).toHaveLength(1);
    expect(Number(passages[0].distance_m)).toBeGreaterThan(30);
    expect(typeof passages[0].gain_m).toBe('number');
    expect(passages[0].entered_at).toBe(at(0));
    expect(passages[0].exited_at).toBe(at(30));
    expect(passages[0].eligible_for_collective).toBe(false);
    expect(calls.transcripts[0].observations).toHaveLength(0);
  });
});

describe('A10 — GPS horodaté (TEST-A10-GPS)', () => {
  const timedSamples = Array.from({ length: 5 }, (_, index) => ({
    lat: 44 + index * 0.0001,
    lng: 6,
    timestamp: at(100 + index * 10),
    elevationM: 1000 + index,
  }));

  it('TEST-A10-GPS-01: positions_timed est la source unique de temps (geojson ignoré)', async () => {
    const geojson = {
      type: 'LineString',
      coordinates: [
        [6, 45, 0],
        [6, 45.0001, 0],
        [6, 45.0002, 0],
        [6, 45.0003, 0],
      ],
    };
    const { client, calls } = makeClient(
      sessionRow({
        positions_geojson: geojson,
        positions_timed: timedSamples,
        ended_at: at(999),
      }),
      (batch) => batch.map(() => [candidateNorth])
    );

    const result = await processHikeSession(SESSION_ID, client);

    expect(result).toEqual({ status: 'processed', passages: 1 });
    const passages = calls.transcripts[0].passages as Record<string, unknown>[];
    expect(passages[0].entered_at).toBe(at(100));
    expect(passages[0].exited_at).toBe(at(140));
    expect(passages[0].eligible_for_collective).toBe(true);
    expect(calls.transcripts[0].observations).toHaveLength(1);
  });

  it('TEST-A10-GPS-02: legacy sans horodatage ⇒ privé, aucune observation, avertissement', async () => {
    const geojson = {
      type: 'LineString',
      coordinates: [
        [6, 44, 1000],
        [6, 44.0003, 1005],
        [6, 44.0006, 1010],
        [6, 44.0009, 1015],
      ],
    };
    const { client, calls } = makeClient(
      sessionRow({ positions_geojson: geojson, ended_at: at(30) }),
      (batch) => batch.map(() => [candidateNorth])
    );

    const result = await processHikeSession(SESSION_ID, client);

    expect(result).toEqual({
      status: 'processed',
      passages: 1,
      warning: 'timed_samples_missing',
    });
    const passages = calls.transcripts[0].passages as Record<string, unknown>[];
    expect(passages[0].eligible_for_collective).toBe(false);
    expect(calls.transcripts[0].observations).toHaveLength(0);
    expect(calls.marks).toHaveLength(0);
  });

  it('TEST-A10-GPS-03: positions_timed invalide ⇒ failed sans écriture', async () => {
    const { client, calls } = makeClient(
      sessionRow({ positions_timed: { not: 'an-array' } }),
      (batch) => batch.map(() => [candidateNorth])
    );

    const result = await processHikeSession(SESSION_ID, client);

    expect(result).toEqual({
      status: 'failed',
      passages: 0,
      reason: 'invalid_timed_samples',
    });
    expect(calls.transcripts).toHaveLength(0);
    expect(calls.marks[0][1].processing_status).toBe('failed');
  });

  it('TEST-A10-GPS-04: le schéma rejette plus de 50 000 échantillons', () => {
    const sample = { lat: 44, lng: 6, timestamp: at(0) };
    const tooMany = Array.from({ length: MAX_TIMED_SAMPLES + 1 }, () => sample);
    expect(persistedGpsSamplesSchema.safeParse(tooMany).success).toBe(false);

    const withinCap = Array.from({ length: MAX_TIMED_SAMPLES }, () => sample);
    expect(persistedGpsSamplesSchema.safeParse(withinCap).success).toBe(true);

    expect(
      persistedGpsSamplesSchema.safeParse([{ lat: 44, lng: null, timestamp: at(0) }]).success
    ).toBe(false);
  });

  it('TEST-A10-GPS-05: aucun horodatage exploitable (timed vide + geojson null) ⇒ failed', async () => {
    const { client, calls } = makeClient(
      sessionRow({ positions_geojson: null, positions_timed: [] }),
      (batch) => batch.map(() => [candidateNorth])
    );

    const result = await processHikeSession(SESSION_ID, client);

    expect(result).toEqual({ status: 'failed', passages: 0, reason: 'invalid_payload' });
    expect(calls.transcripts).toHaveLength(0);
  });
});

describe('A10 — RPC transactionnelles (TEST-A10-TX)', () => {
  it('TEST-A10-TX-01: aller-retour sur le même segment ⇒ passages et observations distincts', async () => {
    const points = [
      { lat: 44, lng: 6, timestamp: at(0) },
      { lat: 44.0001, lng: 6, timestamp: at(10) },
      { lat: 44.0002, lng: 6, timestamp: at(20) },
      { lat: 44.0001, lng: 6, timestamp: at(30) },
      { lat: 44, lng: 6, timestamp: at(40) },
    ];
    const { client, calls, store } = makeClient(
      sessionRow({ positions_geojson: points }),
      (batch) => batch.map(() => [candidateNorth])
    );

    const result = await processHikeSession(SESSION_ID, client);

    expect(result.status).toBe('processed');
    const observations = calls.transcripts[0].observations as Record<string, unknown>[];
    expect(observations).toHaveLength(2);
    expect(new Set(observations.map((row) => row.passage_key)).size).toBe(2);
    const persistedIds = Array.from(store.observations.values()).map((row) => row.passage_id);
    expect(new Set(persistedIds).size).toBe(2);
    expect(persistedIds).not.toContain(null);
  });

  it('TEST-A10-TX-02: un rejeu ne crée aucun doublon (upsert par clé complète)', async () => {
    const points = northTrack(5);
    const { client, store, calls } = makeClient(
      sessionRow({ positions_geojson: points }),
      (batch) => batch.map(() => [candidateNorth])
    );

    await processHikeSession(SESSION_ID, client);
    await processHikeSession(SESSION_ID, client);

    expect(calls.transcripts).toHaveLength(2);
    expect(store.passages.size).toBe(1);
    expect(store.observations.size).toBe(1);
  });

  it('TEST-A10-TX-03: échec partiel ⇒ aucune écriture partielle (atomique)', async () => {
    const { client, store, calls } = makeClient(
      sessionRow({ positions_geojson: northTrack(5) }),
      (batch) => batch.map(() => [candidateNorth]),
      { persistError: new Error('transaction annulée') }
    );

    const result = await processHikeSession(SESSION_ID, client);

    expect(result.status).toBe('failed');
    expect(result.reason).toBe('transaction annulée');
    expect(store.passages.size).toBe(0);
    expect(store.observations.size).toBe(0);
    expect(calls.marks[0][1].processing_status).toBe('failed');
  });

  it('TEST-A10-TX-04: chaque observation porte une clé complète, jamais un segment nu', async () => {
    const { client, calls } = makeClient(
      sessionRow({ positions_geojson: northTrack(5) }),
      (batch) => batch.map(() => [candidateNorth])
    );

    await processHikeSession(SESSION_ID, client);

    const observations = calls.transcripts[0].observations as Record<string, unknown>[];
    expect(observations.length).toBeGreaterThan(0);
    for (const observation of observations) {
      expect(typeof observation.passage_key).toBe('string');
      const [segmentId, direction, enteredAt] = (observation.passage_key as string).split('|');
      expect(Number.isInteger(Number(segmentId))).toBe(true);
      expect(['forward', 'reverse']).toContain(direction);
      expect(Number.isNaN(Date.parse(enteredAt))).toBe(false);
      expect(observation.passage_id).toBeUndefined();
      expect(observation.segment_id).toBeUndefined();
    }
  });
});
