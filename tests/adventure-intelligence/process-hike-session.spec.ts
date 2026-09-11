import { describe, it, expect, vi } from 'vitest';
import {
  processHikeSession,
  PROCESSOR_VERSION,
  type HikeProcessingClient,
  type HikeSessionRow,
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
  candidates: [number, number, number][];
  upserted: unknown[][];
  observations: unknown[][];
  marks: Array<[string, Record<string, unknown>]>;
}

function makeClient(
  session: HikeSessionRow | null,
  candidateFor: (lat: number, lng: number, radiusM: number) => SegmentCandidate[] | never
): { client: HikeProcessingClient; calls: FakeCalls } {
  const calls: FakeCalls = { candidates: [], upserted: [], observations: [], marks: [] };
  const client: HikeProcessingClient = {
    getSession: vi.fn().mockResolvedValue(session),
    getCandidates: vi.fn().mockImplementation(async (lat: number, lng: number, radiusM: number) => {
      calls.candidates.push([lat, lng, radiusM]);
      return candidateFor(lat, lng, radiusM);
    }),
    upsertPassages: vi.fn().mockImplementation(async (rows: unknown[]) => {
      calls.upserted.push(rows);
    }),
    insertObservations: vi.fn().mockImplementation(async (rows: unknown[]) => {
      calls.observations.push(rows);
    }),
    markSession: vi.fn().mockImplementation(async (id: string, patch: Record<string, unknown>) => {
      calls.marks.push([id, patch]);
    }),
  };
  return { client, calls };
}

const candidateNorth: SegmentCandidate = { segmentId: 777, distanceM: 5, bearingDeg: 0 };

describe('Orchestrateur de session — TEST-A2-PROC (client factice)', () => {
  it('TEST-A2-PROC-01: session déjà traitée par la même version ⇒ skipped', async () => {
    const already = sessionRow({ processing_status: 'processed', processor_version: PROCESSOR_VERSION });
    const { client, calls } = makeClient(already, () => [candidateNorth]);

    const result = await processHikeSession(SESSION_ID, client);

    expect(result).toEqual({ status: 'skipped', passages: 0, reason: 'already_processed' });
    expect(calls.candidates).toHaveLength(0);
    expect(calls.upserted).toHaveLength(0);
    expect(calls.marks).toHaveLength(0);

    const { client: staleClient, calls: staleCalls } = makeClient(
      sessionRow({
        processing_status: 'processed',
        processor_version: 'a1-v0',
        positions_geojson: northTrack(4),
      }),
      () => [candidateNorth]
    );
    const stale = await processHikeSession(SESSION_ID, staleClient);
    expect(stale.status).toBe('processed');
    expect(staleCalls.marks[0][1].processing_status).toBe('processed');
  });

  it('TEST-A2-PROC-02: payload de positions invalide ⇒ failed sans écriture', async () => {
    const broken = sessionRow({
      positions_geojson: { type: 'LineString', coordinates: [['a', 'b']] },
    });
    const { client, calls } = makeClient(broken, () => [candidateNorth]);

    const result = await processHikeSession(SESSION_ID, client);

    expect(result.status).toBe('failed');
    expect(result.reason).toBe('invalid_payload');
    expect(calls.upserted).toHaveLength(0);
    expect(calls.observations).toHaveLength(0);
    expect(calls.marks[0][1].processing_status).toBe('failed');
    expect(calls.marks[0][1].processor_version).toBe(PROCESSOR_VERSION);

    const tooShort = sessionRow({ positions_geojson: { type: 'LineString', coordinates: [[6, 44]] } });
    const { client: shortClient, calls: shortCalls } = makeClient(tooShort, () => [candidateNorth]);
    const shortResult = await processHikeSession(SESSION_ID, shortClient);
    expect(shortResult.status).toBe('failed');
    expect(shortCalls.upserted).toHaveLength(0);
  });

  it('TEST-A2-PROC-03: écrit un passage et une observation par passage', async () => {
    const points = Array.from({ length: 5 }, (_, index) => ({
      lat: 44 + index * 0.00001,
      lng: 6,
      timestamp: at(index * 10),
    }));
    const { client, calls } = makeClient(sessionRow({ positions_geojson: points }), () => [
      candidateNorth,
    ]);

    const result = await processHikeSession(SESSION_ID, client);

    expect(result).toEqual({ status: 'processed', passages: 1 });
    expect(calls.candidates).toHaveLength(1);
    expect(calls.candidates[0][0]).toBeCloseTo(44, 6);
    expect(calls.candidates[0][2]).toBe(35);

    expect(calls.upserted).toHaveLength(1);
    const passages = calls.upserted[0] as Record<string, unknown>[];
    expect(passages).toHaveLength(1);
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

    expect(calls.observations).toHaveLength(1);
    const observations = calls.observations[0] as Record<string, unknown>[];
    expect(observations).toHaveLength(1);
    expect(observations[0]).toMatchObject({
      session_id: SESSION_ID,
      user_id: USER_ID,
      passage_id: null,
      observed_at: at(40),
      declared_fatigue: null,
      perceived_difficulty: null,
      pack_weight_kg: null,
      processor_version: PROCESSOR_VERSION,
    });
    expect(Number(observations[0].duration_s)).toBeGreaterThan(0);
    expect(typeof observations[0].quality).toBe('number');

    expect(calls.marks).toHaveLength(1);
    expect(calls.marks[0][0]).toBe(SESSION_ID);
    expect(calls.marks[0][1].processing_status).toBe('processed');
    expect(calls.marks[0][1].processor_version).toBe(PROCESSOR_VERSION);
    expect(typeof calls.marks[0][1].processed_at).toBe('string');
    expect(calls.marks[0][1].track_quality).toMatchObject({ overall: expect.any(Number) });
  });

  it('TEST-A2-PROC-04: sous le seuil de map-matching, le passage n’est pas collectif', async () => {
    const points = northTrack(6);
    const { client, calls } = makeClient(sessionRow({ positions_geojson: points }), (lat) =>
      lat < 44.00025 ? [candidateNorth] : []
    );

    const result = await processHikeSession(SESSION_ID, client);

    expect(result).toEqual({ status: 'processed', passages: 1 });
    const passages = calls.upserted[0] as Record<string, unknown>[];
    expect(passages[0].map_match_quality).toBeCloseTo(0.5, 5);
    expect(Number(passages[0].gps_quality)).toBeGreaterThanOrEqual(0.6);
    expect(passages[0].eligible_for_collective).toBe(false);
  });

  it('TEST-A2-PROC-05: une erreur de candidats ⇒ failed, rien n’est écrit', async () => {
    const { client, calls } = makeClient(sessionRow({ positions_geojson: northTrack(4) }), () => {
      throw new Error('postgis indisponible');
    });

    const result = await processHikeSession(SESSION_ID, client);

    expect(result.status).toBe('failed');
    expect(result.reason).toBe('postgis indisponible');
    expect(calls.upserted).toHaveLength(0);
    expect(calls.observations).toHaveLength(0);
    expect(calls.marks[0][1].processing_status).toBe('failed');
  });

  it('TEST-A2-PROC-06: convertit un GeoJSON LineString en points horodatés', async () => {
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
      () => [candidateNorth]
    );

    const result = await processHikeSession(SESSION_ID, client);

    expect(result).toEqual({ status: 'processed', passages: 1 });
    expect(calls.candidates[0][0]).toBeCloseTo(44, 6);
    expect(calls.candidates[0][1]).toBeCloseTo(6, 6);

    const passages = calls.upserted[0] as Record<string, unknown>[];
    expect(passages).toHaveLength(1);
    expect(Number(passages[0].distance_m)).toBeGreaterThan(30);
    expect(typeof passages[0].gain_m).toBe('number');
    expect(passages[0].entered_at).toBe(at(0));
    expect(passages[0].exited_at).toBe(at(30));
  });
});
