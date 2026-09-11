import { describe, it, expect, vi } from 'vitest';
import {
  aggregateSegments,
  hashUserId,
  AGGREGATE_PROCESSOR_VERSION,
  AGGREGATION_WINDOW_DAYS,
  type AggregateSegmentsClient,
  type ConsentGrant,
  type EligiblePassageRow,
} from '@/features/adventure-intelligence/server/aggregateSegments';

const NOW = '2026-09-11T12:00:00.000Z';

const USER_IDS = [
  'a4000000-0000-4000-8000-000000000001',
  'a4000000-0000-4000-8000-000000000002',
  'a4000000-0000-4000-8000-000000000003',
  'a4000000-0000-4000-8000-000000000004',
  'a4000000-0000-4000-8000-000000000005',
  'a4000000-0000-4000-8000-000000000006',
];

function recent(days: number): string {
  return new Date(Date.parse(NOW) - days * 86400000).toISOString();
}

function row(overrides: Partial<EligiblePassageRow> = {}): EligiblePassageRow {
  return {
    passageId: `passage-${Math.abs(
      overrides.observedDurationS ?? 120
    )}-${overrides.userId ?? USER_IDS[0]}`,
    userId: USER_IDS[0],
    segmentId: 42,
    direction: 'forward',
    observedDurationS: 120,
    observedAt: recent(1),
    gpsQuality: 0.9,
    mapMatchQuality: 0.9,
    passageQuality: 0.9,
    plausibleMovement: true,
    sessionFinished: true,
    uturnDetected: false,
    offRoute: false,
    distanceM: 1000,
    gainM: 0,
    lossM: 0,
    ...overrides,
  };
}

function fiveUsers(overrides: Partial<EligiblePassageRow> = {}): EligiblePassageRow[] {
  return USER_IDS.slice(0, 5).map((userId, index) =>
    row({ passageId: `passage-${index}`, userId, ...overrides })
  );
}

function consentsFor(userIds: string[], granted = true): ConsentGrant[] {
  return userIds.map((userId) => ({ userId, granted }));
}

interface FakeCalls {
  segments: Array<[number[], number]>;
  consents: string[][];
  expected: string[][];
}

function makeClient(rows: EligiblePassageRow[], consents: ConsentGrant[]) {
  const upserted: unknown[][] = [];
  const calls: FakeCalls = { segments: [], consents: [], expected: [] };
  const client: AggregateSegmentsClient = {
    getEligiblePassages: vi.fn(async (segmentIds: number[], sinceDays: number) => {
      calls.segments.push([segmentIds, sinceDays]);
      return rows;
    }),
    getConsents: vi.fn(async (userIds: string[]) => {
      calls.consents.push(userIds);
      return consents;
    }),
    getExpectedDurations: vi.fn(async (passages: EligiblePassageRow[]) => {
      calls.expected.push(passages.map((passage) => passage.passageId));
      return passages.map((passage) => ({
        passageId: passage.passageId,
        expectedDurationS: 100,
      }));
    }),
    upsertAggregates: vi.fn(async (aggregateRows: unknown[]) => {
      upserted.push(aggregateRows);
    }),
  };
  return { client, upserted, calls };
}

describe('Orchestrateur collectif serveur — TEST-A4-SRV (client factice)', () => {
  it('TEST-A4-SRV-01: seuls les passages consentis sont agrégés', async () => {
    const rows = [
      ...fiveUsers(),
      row({ passageId: 'sans-consentement', userId: USER_IDS[5] }),
      row({ passageId: 'sans-consentement-2', userId: USER_IDS[5] }),
    ];
    const consents = [
      ...consentsFor(USER_IDS.slice(0, 5)),
      { userId: USER_IDS[5], granted: false },
    ];
    const { client, upserted, calls } = makeClient(rows, consents);

    const result = await aggregateSegments([42], client, { now: NOW });

    expect(calls.segments).toEqual([[[42], AGGREGATION_WINDOW_DAYS]]);
    expect(calls.consents).toHaveLength(1);
    expect([...calls.consents[0]].sort()).toEqual([...USER_IDS].sort());
    expect(result.passagesConsidered).toBe(5);
    expect(upserted).toHaveLength(1);
    const [aggregateRow] = upserted[0] as Record<string, unknown>[];
    expect(aggregateRow.distinct_user_count).toBe(5);
    expect(aggregateRow.passage_count).toBe(5);
  });

  it('TEST-A4-SRV-02: l’upsert est idempotent pour un même jeu d’entrées', async () => {
    const rows = fiveUsers();
    const first = makeClient(rows, consentsFor(USER_IDS.slice(0, 5)));
    const second = makeClient(rows, consentsFor(USER_IDS.slice(0, 5)));

    await aggregateSegments([42], first.client, { now: NOW });
    await aggregateSegments([42], second.client, { now: NOW });

    expect(first.upserted).toHaveLength(1);
    expect(second.upserted).toHaveLength(1);
    const firstRows = first.upserted[0] as Record<string, unknown>[];
    const secondRows = second.upserted[0] as Record<string, unknown>[];

    expect(firstRows).toEqual(secondRows);
    for (const aggregateRow of firstRows) {
      expect(aggregateRow.processor_version).toBe(AGGREGATE_PROCESSOR_VERSION);
      expect(AGGREGATE_PROCESSOR_VERSION).toBe('a4-v1');
      expect(aggregateRow.computed_at).toBe(NOW);
      expect(aggregateRow.segment_id).toBe(42);
      expect(aggregateRow.condition_bucket).toBe('dry');
      expect(aggregateRow.direction).toBe('forward');
      expect(aggregateRow.confidence).toMatchObject({
        method: 'collective_weighted_median_a4',
      });
    }
  });

  it('TEST-A4-SRV-03: sous le seuil, l’agrégat est filtré (non publié)', async () => {
    const under = makeClient(
      fiveUsers().slice(0, 4),
      consentsFor(USER_IDS.slice(0, 4))
    );
    const underResult = await aggregateSegments([42], under.client, { now: NOW });

    expect(underResult.aggregatesComputed).toBe(1);
    expect(underResult.aggregatesWritten).toBe(0);
    expect(underResult.aggregatesSuppressed).toBe(1);
    expect(under.upserted).toHaveLength(0);

    const enough = makeClient(fiveUsers(), consentsFor(USER_IDS.slice(0, 5)));
    const enoughResult = await aggregateSegments([42], enough.client, { now: NOW });

    expect(enoughResult.aggregatesWritten).toBe(1);
    expect(enough.upserted).toHaveLength(1);
    const [aggregateRow] = enough.upserted[0] as Record<string, unknown>[];
    expect(Number(aggregateRow.distinct_user_count)).toBeGreaterThanOrEqual(5);
  });

  it('TEST-A4-SRV-04: aucune identité individuelle dans les lignes ni dans le résumé', async () => {
    const rows = [
      ...fiveUsers(),
      row({ passageId: 'autre-segment', userId: USER_IDS[5], segmentId: 77 }),
    ];
    const consents = consentsFor(USER_IDS);
    const { client, upserted } = makeClient(rows, consents);

    const result = await aggregateSegments([42, 77], client, { now: NOW });
    const serializedResult = JSON.stringify(result);
    const serializedRows = JSON.stringify(upserted);

    for (const userId of USER_IDS) {
      expect(serializedResult).not.toContain(userId);
      expect(serializedRows).not.toContain(userId);
      expect(serializedRows).not.toContain(hashUserId(userId));
    }
    expect(serializedRows).not.toContain('passage-0');

    for (const aggregateRow of upserted[0] as Record<string, unknown>[]) {
      for (const forbidden of ['user_id', 'userId', 'userIdHash', 'passage_id', 'passageId']) {
        expect(Object.keys(aggregateRow)).not.toContain(forbidden);
      }
    }
  });
});
