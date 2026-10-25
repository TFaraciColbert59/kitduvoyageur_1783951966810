import { describe, it, expect, vi } from 'vitest';
import {
  createTerrainReport,
  confirmTerrainReport,
  listNearbyTerrainReports,
  expireStaleReports,
  DEFAULT_NEARBY_RADIUS_M,
  STALE_AFTER_HOURS,
  CONFIRMATION_COOLDOWN_MINUTES,
  type TerrainReportRow,
  type TerrainReportsClient,
  type NearbyTerrainReport,
  type MergeTerrainReportInput,
} from '@/features/adventure-intelligence/server/terrainReports';
import type { TerrainReportPublic } from '@/features/adventure-intelligence/schemas/live.schema';

vi.mock('server-only', () => ({}));

const NOW = '2026-09-11T12:00:00.000Z';
const USER_ID = 'a5000000-0000-4000-8000-000000000001';
const OTHER_USER_ID = 'a5000000-0000-4000-8000-000000000002';

function hoursAgo(hours: number): string {
  return new Date(Date.parse(NOW) - hours * 3600000).toISOString();
}

function reportRow(overrides: Partial<TerrainReportRow> = {}): TerrainReportRow {
  return {
    id: 'report-1',
    status: 'active',
    expiresAt: hoursAgo(-24),
    createdAt: hoursAgo(2),
    updatedAt: hoursAgo(1),
    presentCount: 1,
    goneCount: 0,
    unknownCount: 0,
    reportCount: 1,
    ...overrides,
  };
}

function publicReport(overrides: Partial<NearbyTerrainReport> = {}): NearbyTerrainReport {
  return {
    id: 'public-1',
    category: 'obstacle',
    severity: 'warning',
    passability: 'unknown',
    lat: 42.8,
    lng: 0.15,
    sourceType: 'user',
    status: 'active',
    presentCount: 2,
    goneCount: 0,
    unknownCount: 0,
    reportCount: 1,
    createdAt: hoursAgo(1),
    distanceM: 100,
    ...overrides,
  };
}

function makeClient(overrides: Partial<TerrainReportsClient> = {}) {
  const inserted: Record<string, unknown>[] = [];
  const merges: MergeTerrainReportInput[] = [];
  const confirmations: Record<string, unknown>[] = [];
  const updates: Array<{ id: string; patch: Record<string, unknown> }> = [];

  const client: TerrainReportsClient = {
    countReportsSince: vi.fn(async () => 0),
    countConfirmationsSince: vi.fn(async () => 0),
    getUserModerationContext: vi.fn(async () => ({ accountAgeDays: 30, reputation: 50 })),
    findDedupCandidates: vi.fn(async () => []),
    mergeReport: vi.fn(async (input: MergeTerrainReportInput) => {
      merges.push(input);
      return { merged: true, reportCount: 2 };
    }),
    insertReport: vi.fn(async (row: Record<string, unknown>) => {
      inserted.push(row);
      return reportRow({ id: 'nouveau-rapport', status: (row.status as TerrainReportRow['status']) ?? 'pending' });
    }),
    getReport: vi.fn(async () => reportRow()),
    confirmationExists: vi.fn(async () => false),
    insertConfirmation: vi.fn(async (row: Record<string, unknown>) => {
      confirmations.push(row);
    }),
    updateReport: vi.fn(async (id: string, patch: Record<string, unknown>) => {
      updates.push({ id, patch });
    }),
    listPublicNearby: vi.fn(async () => []),
    listExpirationCandidates: vi.fn(async () => []),
    ...overrides,
  };

  return { client, inserted, merges, confirmations, updates };
}

describe('Serveur Terrain Live — création (TEST-A5-SRV-01)', () => {
  it('TEST-A5-SRV-01: crée un signalement utilisateur pending et un signalement officiel active', async () => {
    const { client, inserted } = makeClient();

    const userResult = await createTerrainReport(
      {
        userId: USER_ID,
        category: 'obstacle',
        severity: 'critical',
        lat: 42.8,
        lng: 0.15,
        description: 'arbre tombé en travers',
      },
      client,
      { now: NOW }
    );

    expect(userResult.status).toBe('created');
    expect(inserted).toHaveLength(1);
    expect(inserted[0]).toMatchObject({
      reporter_id: USER_ID,
      category: 'obstacle',
      severity: 'critical',
      source_type: 'user',
      status: 'pending',
      created_at: NOW,
      expires_at: hoursAgo(-72),
      report_count: 1,
    });

    const official = makeClient();
    const officialResult = await createTerrainReport(
      {
        userId: OTHER_USER_ID,
        category: 'closure',
        lat: 42.9,
        lng: 0.2,
        officialSource: true,
      },
      official.client,
      { now: NOW }
    );

    expect(officialResult.status).toBe('created');
    expect(official.inserted[0]).toMatchObject({
      source_type: 'official',
      status: 'active',
      expires_at: hoursAgo(-168),
    });
  });

  it('TEST-A5-SRV-01b: la modération refuse un signalement abusif', async () => {
    const { client, inserted } = makeClient({
      countReportsSince: vi.fn(async () => 10),
    });

    const result = await createTerrainReport(
      { userId: USER_ID, category: 'obstacle', lat: 42.8, lng: 0.15 },
      client,
      { now: NOW }
    );

    expect(result).toEqual({
      status: 'rejected',
      reasons: ['limite_signalements_atteinte'],
    });
    expect(inserted).toHaveLength(0);
  });
});

describe('Serveur Terrain Live — fusion (TEST-A5-SRV-02)', () => {
  it('TEST-A5-SRV-02: un doublon est fusionné via la RPC atomique, jamais réinséré', async () => {
    const { client, inserted, merges } = makeClient({
      findDedupCandidates: vi.fn(async () => [
        {
          id: 'existant-42',
          category: 'obstacle' as const,
          segmentId: 42,
          lat: 42.8001,
          lng: 0.1501,
          createdAt: hoursAgo(1),
        },
      ]),
    });

    const result = await createTerrainReport(
      { userId: USER_ID, category: 'obstacle', segmentId: 42, lat: 42.8, lng: 0.15 },
      client,
      { now: NOW }
    );

    expect(result).toMatchObject({
      status: 'merged',
      mergedWith: 'existant-42',
      reason: 'doublon_meme_segment',
    });
    expect(inserted).toHaveLength(0);
    expect(merges).toHaveLength(1);
    expect(merges[0]).toMatchObject({
      reportId: 'existant-42',
      contributorId: USER_ID,
      now: NOW,
    });
  });
});

describe('Serveur Terrain Live — confirmation (TEST-A5-SRV-03)', () => {
  it('TEST-A5-SRV-03: une seule confirmation par utilisateur, compteurs et statut mis à jour', async () => {
    let alreadyConfirmed = false;
    const { client, confirmations, updates } = makeClient({
      getReport: vi.fn(async () => reportRow({ status: 'confirmed', presentCount: 1 })),
      confirmationExists: vi.fn(async () => alreadyConfirmed),
    });

    const first = await confirmTerrainReport(
      { reportId: 'report-1', userId: USER_ID, confirmation: 'present', gpsQuality: 0.8 },
      client,
      { now: NOW }
    );

    expect(first).toEqual({ status: 'confirmed', reportStatus: 'active' });
    expect(confirmations).toHaveLength(1);
    expect(confirmations[0]).toMatchObject({
      report_id: 'report-1',
      user_id: USER_ID,
      confirmation: 'present',
      created_at: NOW,
    });
    expect(updates).toEqual([{ id: 'report-1', patch: { status: 'active', updated_at: NOW } }]);

    alreadyConfirmed = true;
    const second = await confirmTerrainReport(
      { reportId: 'report-1', userId: USER_ID, confirmation: 'present' },
      client,
      { now: NOW }
    );

    expect(second).toEqual({ status: 'duplicate' });
    expect(confirmations).toHaveLength(1);
    expect(updates).toHaveLength(1);
  });

  it('TEST-A5-SRV-03b: rapport inconnu ou terminal jamais confirmé', async () => {
    const missing = makeClient({ getReport: vi.fn(async () => null) });
    expect(
      await confirmTerrainReport(
        { reportId: 'inconnu', userId: USER_ID, confirmation: 'present' },
        missing.client,
        { now: NOW }
      )
    ).toEqual({ status: 'not_found' });
    expect(missing.confirmations).toHaveLength(0);

    const closed = makeClient({
      getReport: vi.fn(async () => reportRow({ status: 'resolved' })),
    });
    expect(
      await confirmTerrainReport(
        { reportId: 'report-1', userId: USER_ID, confirmation: 'gone' },
        closed.client,
        { now: NOW }
      )
    ).toEqual({ status: 'closed' });
    expect(closed.confirmations).toHaveLength(0);
  });
});

describe('Serveur Terrain Live — cooldown de confirmation (TEST-A5-SRV-06)', () => {
  it('TEST-A5-SRV-06: une 3ᵉ confirmation en 5 minutes est refusée sans écriture', async () => {
    const throttled = makeClient({
      countConfirmationsSince: vi.fn(async () => 2),
    });

    const result = await confirmTerrainReport(
      { reportId: 'report-1', userId: USER_ID, confirmation: 'present' },
      throttled.client,
      { now: NOW }
    );

    expect(result).toEqual({ status: 'rate_limited', reason: 'confirmation_cooldown' });
    expect(throttled.confirmations).toHaveLength(0);
    expect(throttled.updates).toHaveLength(0);
    expect(throttled.client.countConfirmationsSince).toHaveBeenCalledWith(
      USER_ID,
      hoursAgo(CONFIRMATION_COOLDOWN_MINUTES / 60)
    );
    expect(CONFIRMATION_COOLDOWN_MINUTES).toBe(5);

    const allowed = makeClient({
      countConfirmationsSince: vi.fn(async () => 1),
      getReport: vi.fn(async () => reportRow({ status: 'confirmed', presentCount: 1 })),
    });
    const confirmed = await confirmTerrainReport(
      { reportId: 'report-1', userId: USER_ID, confirmation: 'present' },
      allowed.client,
      { now: NOW }
    );
    expect(confirmed).toEqual({ status: 'confirmed', reportStatus: 'active' });
    expect(allowed.confirmations).toHaveLength(1);
  });
});

describe('Serveur Terrain Live — liste filtrée (TEST-A5-SRV-04)', () => {
  it('TEST-A5-SRV-04: la liste proche filtre statuts/expiration, trie par distance et n’expose aucune identité', async () => {
    const rows: NearbyTerrainReport[] = [
      publicReport({ id: 'proche', distanceM: 120, status: 'confirmed' }),
      publicReport({ id: 'loin', distanceM: 900 }),
      publicReport({ id: 'expire', distanceM: 40, expiresAt: hoursAgo(1) }),
      publicReport({ id: 'rejete', distanceM: 10, status: 'rejected' }),
    ];
    const { client } = makeClient({ listPublicNearby: vi.fn(async () => rows) });

    const result = await listNearbyTerrainReports({ lat: 42.8, lng: 0.15 }, client, { now: NOW });

    expect(result.map((row) => row.id)).toEqual(['proche', 'loin']);
    expect(result[0].distanceM).toBeLessThan(result[1].distanceM);
    expect(JSON.stringify(result)).not.toContain('reporter');
    expect(JSON.stringify(result)).not.toContain('reporterId');
    expect(DEFAULT_NEARBY_RADIUS_M).toBe(2000);

    const withoutRadius = makeClient({ listPublicNearby: vi.fn(async () => rows) });
    await listNearbyTerrainReports({ lat: 42.8, lng: 0.15 }, withoutRadius.client, { now: NOW });
    expect(withoutRadius.client.listPublicNearby).toHaveBeenCalledWith(
      42.8,
      0.15,
      DEFAULT_NEARBY_RADIUS_M
    );
  });

  it('TEST-A5-SRV-04b: le type public de la vue ne porte jamais reporterId', () => {
    const sample: TerrainReportPublic = publicReport();
    expect(Object.keys(sample)).not.toContain('reporterId');
    expect(Object.keys(sample)).not.toContain('reporter_id');
  });
});

describe('Serveur Terrain Live — expiration (TEST-A5-SRV-05)', () => {
  it('TEST-A5-SRV-05: expire les rapports périmés et fait vieillir les inactifs', async () => {
    const candidates: TerrainReportRow[] = [
      reportRow({ id: 'perime', status: 'active', expiresAt: hoursAgo(2) }),
      reportRow({ id: 'inactif', status: 'active', expiresAt: hoursAgo(-48), updatedAt: hoursAgo(30) }),
      reportRow({ id: 'recent', status: 'active', expiresAt: hoursAgo(-48), updatedAt: hoursAgo(1) }),
      reportRow({ id: 'pending-vieux', status: 'pending', expiresAt: hoursAgo(-48), updatedAt: hoursAgo(30) }),
      reportRow({ id: 'verify-perime', status: 'verify', expiresAt: hoursAgo(1) }),
    ];
    const { client, updates } = makeClient({
      listExpirationCandidates: vi.fn(async () => candidates),
    });

    const result = await expireStaleReports(client, { now: NOW });

    expect(result).toEqual({ scanned: 5, aged: 1, expired: 2 });
    expect(updates).toEqual([
      { id: 'perime', patch: { status: 'expired', updated_at: NOW } },
      { id: 'inactif', patch: { status: 'stale', updated_at: NOW } },
      { id: 'verify-perime', patch: { status: 'expired', updated_at: NOW } },
    ]);
    expect(STALE_AFTER_HOURS).toBe(24);
  });
});
