import { describe, it, expect, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  aggregateSegments,
  AGGREGATE_MAX_AGE_DAYS,
  type AggregateKey,
  type AggregateSegmentsClient,
  type EligiblePassageRow,
} from '@/features/adventure-intelligence/server/aggregateSegments';

const NOW = '2026-09-11T12:00:00.000Z';

const USER_IDS = [
  'a1200000-0000-4000-8000-000000000001',
  'a1200000-0000-4000-8000-000000000002',
  'a1200000-0000-4000-8000-000000000003',
  'a1200000-0000-4000-8000-000000000004',
  'a1200000-0000-4000-8000-000000000005',
];

function recent(days: number): string {
  return new Date(Date.parse(NOW) - days * 86400000).toISOString();
}

function row(overrides: Partial<EligiblePassageRow> = {}): EligiblePassageRow {
  return {
    passageId: `passage-${overrides.userId ?? USER_IDS[0]}-${overrides.observedDurationS ?? 120}`,
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

function usersRows(userIds: string[]): EligiblePassageRow[] {
  return userIds.map((userId, index) => row({ passageId: `passage-${index}`, userId }));
}

function makeClient(rows: EligiblePassageRow[], purgedCount = 0) {
  const upserted: unknown[][] = [];
  const deleted: AggregateKey[][] = [];
  const purged: Array<{ segmentIds: number[]; beforeIso: string }> = [];

  const client: AggregateSegmentsClient = {
    getEligiblePassages: vi.fn(async () => rows),
    getConsents: vi.fn(async (userIds: string[]) =>
      userIds.map((userId) => ({ userId, granted: true }))
    ),
    getExpectedDurations: vi.fn(async (passages: EligiblePassageRow[]) =>
      passages.map((passage) => ({ passageId: passage.passageId, expectedDurationS: 100 }))
    ),
    upsertAggregates: vi.fn(async (aggregateRows: unknown[]) => {
      upserted.push(aggregateRows);
    }),
    deleteAggregates: vi.fn(async (keys: AggregateKey[]) => {
      deleted.push(keys);
    }),
    deleteStaleAggregates: vi.fn(async (segmentIds: number[], beforeIso: string) => {
      purged.push({ segmentIds, beforeIso });
      return purgedCount;
    }),
  };

  return { client, upserted, deleted, purged };
}

describe('A11 — invalidation et récence des agrégats (TEST-A11-AGG)', () => {
  it('TEST-A11-AGG-01: repasser sous 5 utilisateurs supprime la ligne persistée', async () => {
    const { client, upserted, deleted } = makeClient(
      usersRows(USER_IDS.slice(0, 4)),
      0
    );

    const result = await aggregateSegments([42], client, { now: NOW });

    expect(result.aggregatesComputed).toBe(1);
    expect(result.aggregatesWritten).toBe(0);
    expect(result.aggregatesSuppressed).toBe(1);
    expect(upserted).toHaveLength(0);
    expect(deleted).toEqual([
      [{ segmentId: 42, conditionBucket: 'dry', direction: 'forward' }],
    ]);
    expect(JSON.stringify(deleted)).not.toContain(USER_IDS[0]);
  });

  it('TEST-A11-AGG-02: au-dessus du seuil, upsert sans invalidation de la clé', async () => {
    const { client, upserted, deleted } = makeClient(usersRows(USER_IDS), 0);

    const result = await aggregateSegments([42], client, { now: NOW });

    expect(result.aggregatesWritten).toBe(1);
    expect(result.aggregatesSuppressed).toBe(0);
    expect(result.aggregatesInvalidated).toBe(0);
    expect(upserted).toHaveLength(1);
    expect(deleted).toHaveLength(0);
  });

  it('TEST-A11-AGG-03: la garde de récence purge les agrégats de plus de 90 jours', async () => {
    const { client, deleted, purged } = makeClient(usersRows(USER_IDS), 2);

    const result = await aggregateSegments([42, 77], client, { now: NOW });
    const expectedCutoff = new Date(
      Date.parse(NOW) - AGGREGATE_MAX_AGE_DAYS * 86400000
    ).toISOString();

    expect(AGGREGATE_MAX_AGE_DAYS).toBe(90);
    expect(purged).toEqual([
      { segmentIds: [42, 77], beforeIso: expectedCutoff },
    ]);
    expect(result.aggregatesInvalidated).toBe(2);
    expect(deleted).toHaveLength(0);
  });

  it('TEST-A11-AGG-04: sans passage éligible, la purge périmée reste exécutée', async () => {
    const { client, upserted, purged } = makeClient([], 3);

    const result = await aggregateSegments([42], client, { now: NOW });

    expect(result).toEqual({
      status: 'aggregated',
      segmentsProcessed: 1,
      passagesConsidered: 0,
      aggregatesComputed: 0,
      aggregatesWritten: 0,
      aggregatesSuppressed: 0,
      aggregatesInvalidated: 3,
    });
    expect(purged).toHaveLength(1);
    expect(upserted).toHaveLength(0);
  });

  it('TEST-A11-AGG-05: la migration plafonne par segment et globalement, service_role seulement', () => {
    const migration = fs.readFileSync(
      path.resolve(
        process.cwd(),
        'supabase/migrations/20260911320000_a11_aggregation_pagination.sql'
      ),
      'utf8'
    );

    expect(migration).toContain('CREATE OR REPLACE FUNCTION public.a4_recent_eligible_segments');
    expect(migration).toContain('PARTITION BY p.segment_id');
    expect(migration).toContain('segment_rank <= 500');
    expect(migration).toContain('global_rank <= 5000');
    expect(migration).toContain('SECURITY DEFINER');
    expect(migration).toContain('SET search_path = public, pg_temp');
    expect(migration).toMatch(
      /REVOKE ALL ON FUNCTION public\.a4_recent_eligible_segments\(interval, integer\) FROM public;/
    );
    expect(migration).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.a4_recent_eligible_segments\(interval, integer\)[\s\S]*TO service_role;/
    );
    expect(migration).not.toMatch(
      /GRANT (ALL|EXECUTE)[^;]*ON FUNCTION public\.a4_recent_eligible_segments[^;]*TO (anon|authenticated)/
    );
  });
});
