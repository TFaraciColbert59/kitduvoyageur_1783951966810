import { describe, it, expect, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  createTerrainReport,
  confirmTerrainReport,
  createSupabaseTerrainReportsClient,
  isUniqueViolation,
  UniqueViolationError,
  UNIQUE_VIOLATION_CODE,
  type TerrainReportRow,
  type TerrainReportsClient,
  type MergeTerrainReportInput,
} from '@/features/adventure-intelligence/server/terrainReports';

vi.mock('server-only', () => ({}));

const NOW = '2026-09-11T12:00:00.000Z';
const USER_ID = 'a1100000-0000-4000-8000-000000000001';
const OTHER_USER_ID = 'a1100000-0000-4000-8000-000000000002';
const REPORT_ID = 'a1100000-0000-4000-8000-0000000000aa';

function hoursAgo(hours: number): string {
  return new Date(Date.parse(NOW) - hours * 3600000).toISOString();
}

function reportRow(overrides: Partial<TerrainReportRow> = {}): TerrainReportRow {
  return {
    id: REPORT_ID,
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

function makeClient(overrides: Partial<TerrainReportsClient> = {}) {
  const merges: MergeTerrainReportInput[] = [];
  const confirmations: Record<string, unknown>[] = [];
  const updates: Array<{ id: string; patch: Record<string, unknown> }> = [];
  const inserted: Record<string, unknown>[] = [];

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
      return reportRow();
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

  return { client, merges, confirmations, updates, inserted };
}

function dedupCandidate() {
  return {
    id: REPORT_ID,
    category: 'obstacle' as const,
    segmentId: 42,
    lat: 42.8,
    lng: 0.15,
    createdAt: hoursAgo(1),
  };
}

describe('A11 — fusion Terrain Live atomique (TEST-A11-TL)', () => {
  it('TEST-A11-TL-01: la fusion passe par la RPC atomique, sans lecture-écriture locale', async () => {
    const { client, merges, inserted } = makeClient({
      findDedupCandidates: vi.fn(async () => [dedupCandidate()]),
    });

    const result = await createTerrainReport(
      {
        userId: USER_ID,
        category: 'obstacle',
        severity: 'critical',
        passability: 'difficult',
        segmentId: 42,
        lat: 42.8,
        lng: 0.15,
      },
      client,
      { now: NOW }
    );

    expect(result).toMatchObject({ status: 'merged', mergedWith: REPORT_ID });
    expect(inserted).toHaveLength(0);
    expect(merges).toEqual([
      {
        reportId: REPORT_ID,
        contributorId: USER_ID,
        severity: 'critical',
        passability: 'difficult',
        now: NOW,
      },
    ]);
    // Plus de read-modify-write : le compte n'est jamais recalculé côté serveur.
    expect(client.getReport).not.toHaveBeenCalled();
  });

  it('TEST-A11-TL-02: un contributeur déjà compté ne réincrémente pas le rapport (RPC merged=false)', async () => {
    const { client, merges, updates } = makeClient({
      findDedupCandidates: vi.fn(async () => [dedupCandidate()]),
      mergeReport: vi.fn(async (input: MergeTerrainReportInput) => {
        merges.push(input);
        return { merged: false, reportCount: 2 };
      }),
    });

    const first = await createTerrainReport(
      { userId: USER_ID, category: 'obstacle', segmentId: 42, lat: 42.8, lng: 0.15 },
      client,
      { now: NOW }
    );
    const second = await createTerrainReport(
      { userId: USER_ID, category: 'obstacle', segmentId: 42, lat: 42.8, lng: 0.15 },
      client,
      { now: NOW }
    );

    expect(first.status).toBe('merged');
    expect(second.status).toBe('merged');
    expect(merges).toHaveLength(2);
    for (const merge of merges) {
      expect(merge).toMatchObject({ reportId: REPORT_ID, contributorId: USER_ID });
      expect(merge).not.toHaveProperty('patch');
      expect(merge).not.toHaveProperty('report_count');
    }
    expect(updates).toHaveLength(0);
  });

  it('TEST-A11-TL-03: une course de confirmation (23505) devient duplicate, jamais une erreur', async () => {
    const conflict = new UniqueViolationError('duplicate key value violates unique constraint');
    const { client, confirmations, updates } = makeClient({
      getReport: vi.fn(async () => reportRow({ status: 'confirmed', presentCount: 1 })),
      insertConfirmation: vi.fn(async (row: Record<string, unknown>) => {
        confirmations.push(row);
        throw conflict;
      }),
    });

    const result = await confirmTerrainReport(
      { reportId: REPORT_ID, userId: USER_ID, confirmation: 'present' },
      client,
      { now: NOW }
    );

    expect(result).toEqual({ status: 'duplicate' });
    expect(confirmations).toHaveLength(1);
    expect(updates).toHaveLength(0);
    expect(UNIQUE_VIOLATION_CODE).toBe('23505');
    expect(isUniqueViolation(conflict)).toBe(true);
    expect(isUniqueViolation({ code: '23505' })).toBe(true);
    expect(isUniqueViolation(new Error('autre'))).toBe(false);
  });

  it('TEST-A11-TL-05: l’adaptateur appelle la RPC a11_merge_terrain_report et normalise la réponse', async () => {
    const rpc = vi.fn(async () => ({ data: { merged: true, report_count: 3 }, error: null }));
    const supabase = { rpc } as unknown as SupabaseClient;
    const client = createSupabaseTerrainReportsClient(supabase);

    const merged = await client.mergeReport({
      reportId: REPORT_ID,
      contributorId: OTHER_USER_ID,
      severity: 'warning',
      passability: null,
      now: NOW,
    });

    expect(rpc).toHaveBeenCalledWith('a11_merge_terrain_report', {
      p_report_id: REPORT_ID,
      p_contributor_id: OTHER_USER_ID,
      p_severity: 'warning',
      p_passability: null,
      p_now: NOW,
    });
    expect(merged).toEqual({ merged: true, reportCount: 3 });

    const failing = vi.fn(async () => ({ data: null, error: { message: 'rpc ko' } }));
    const failingClient = createSupabaseTerrainReportsClient({
      rpc: failing,
    } as unknown as SupabaseClient);
    await expect(
      failingClient.mergeReport({
        reportId: REPORT_ID,
        contributorId: OTHER_USER_ID,
        now: NOW,
      })
    ).rejects.toThrow('rpc ko');
  });

  it('TEST-A11-TL-05b: la migration A11 verrouille le registre et la RPC (service_role)', () => {
    const migration = fs.readFileSync(
      path.resolve(
        process.cwd(),
        'supabase/migrations/20260911310000_a11_terrain_atomic.sql'
      ),
      'utf8'
    );

    expect(migration).toContain('CREATE TABLE IF NOT EXISTS public.terrain_report_contributors');
    expect(migration).toContain('PRIMARY KEY (report_id, user_id)');
    expect(migration).toMatch(/ON CONFLICT \(report_id, user_id\) DO NOTHING/);
    expect(migration).toContain('SECURITY DEFINER');
    expect(migration).toContain('SET search_path = public, pg_temp');
    expect(migration).toMatch(/REVOKE ALL ON TABLE public\.terrain_report_contributors FROM public;/);
    expect(migration).toMatch(/GRANT EXECUTE ON FUNCTION public\.a11_merge_terrain_report/);
    expect(migration).not.toMatch(/GRANT (ALL|EXECUTE)[^;]*TO (anon|authenticated)/);
    expect(migration).toContain("'merged', v_new_contributor");
    expect(migration).toContain("'report_count', v_report_count");
  });
});
