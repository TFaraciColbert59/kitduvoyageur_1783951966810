import { describe, it, expect, vi } from 'vitest';
import {
  TERRAIN_MAP_DEFAULT_RADIUS_M,
  TERRAIN_MAP_MAX_RADIUS_M,
  TERRAIN_MAP_MIN_RADIUS_M,
  TERRAIN_MAP_MAX_MARKERS,
  clampTerrainRadiusM,
  confirmTerrainReportRequest,
  confirmTerrainReportViaApi,
  createTerrainReportRequest,
  createTerrainReportViaApi,
  isTerrainLiveEnabled,
  sanitizeTerrainReports,
  shouldFetchTerrainReports,
  terrainMarkerSpec,
} from '@/features/terrain-live/lib/terrainMap';
import { SEVERITY_COLORS } from '@/features/terrain-live/lib/terrainDisplay';
import type { TerrainLiveReport } from '@/features/terrain-live/lib/terrainDisplay';

const NOW = '2026-09-11T10:00:00.000Z';

function report(overrides: Partial<TerrainLiveReport> = {}): TerrainLiveReport {
  return {
    id: 'a1366666-6666-4666-8666-666666666666',
    category: 'obstacle',
    severity: 'warning',
    passability: 'difficult',
    lat: 44.1,
    lng: 6.2,
    sourceType: 'user',
    status: 'active',
    presentCount: 1,
    goneCount: 0,
    unknownCount: 0,
    reportCount: 1,
    createdAt: NOW,
    distanceM: 200,
    ...overrides,
  };
}

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

function jsonResponse(status: number, payload: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
  } as unknown as Response;
}

describe('A13 — Montage Terrain Live sur la carte (TEST-A13-MAP)', () => {
  it('TEST-A13-MAP-01: marqueurs déterministes, coordonnées valides uniquement, zéro orange', () => {
    const invalid = report({
      id: 'a1366666-6666-4666-8666-666666666601',
      lat: Number.NaN,
    });
    const outOfRange = report({
      id: 'a1366666-6666-4666-8666-666666666602',
      lat: 120,
    });
    const valid = report({ id: 'a1366666-6666-4666-8666-666666666603' });

    const sanitized = sanitizeTerrainReports([invalid, outOfRange, valid]);
    expect(sanitized.map((entry) => entry.id)).toEqual([valid.id]);

    const bounded = sanitizeTerrainReports(
      Array.from({ length: TERRAIN_MAP_MAX_MARKERS + 25 }, (_, index) =>
        report({ id: `a1366666-6666-4666-8666-${String(index).padStart(12, '0')}` })
      )
    );
    expect(bounded).toHaveLength(TERRAIN_MAP_MAX_MARKERS);

    for (const severity of ['info', 'warning', 'critical'] as const) {
      const spec = terrainMarkerSpec(report({ severity, category: 'closure' }));
      expect(spec.color).toBe(SEVERITY_COLORS[severity]);
      expect(spec.color.toUpperCase()).not.toBe('#E4501C');
      expect(spec.lat).toBe(44.1);
      expect(spec.lng).toBe(6.2);
      expect(spec.radius).toBeGreaterThan(0);
      expect(spec.tooltip).toBe('Chemin fermé');
      expect(spec.ariaLabel).toContain('Chemin fermé');
    }
  });

  it('TEST-A13-MAP-02: flag OFF ou position absente ⇒ aucun fetch ; rayon borné', () => {
    expect(shouldFetchTerrainReports({ enabled: true, lat: 44.1, lng: 6.2 })).toBe(true);
    expect(shouldFetchTerrainReports({ enabled: false, lat: 44.1, lng: 6.2 })).toBe(false);
    expect(shouldFetchTerrainReports({ enabled: true, lat: null, lng: 6.2 })).toBe(false);
    expect(shouldFetchTerrainReports({ enabled: true, lat: 44.1, lng: null })).toBe(false);
    expect(shouldFetchTerrainReports({ enabled: true, lat: Number.NaN, lng: 6.2 })).toBe(false);

    expect(clampTerrainRadiusM()).toBe(TERRAIN_MAP_DEFAULT_RADIUS_M);
    expect(clampTerrainRadiusM(10)).toBe(TERRAIN_MAP_MIN_RADIUS_M);
    expect(clampTerrainRadiusM(999_999)).toBe(TERRAIN_MAP_MAX_RADIUS_M);
    expect(clampTerrainRadiusM(8_000)).toBe(8_000);

    expect(isTerrainLiveEnabled({ terrain_live: true })).toBe(true);
    expect(isTerrainLiveEnabled({ terrain_live: false })).toBe(false);
    expect(isTerrainLiveEnabled(null)).toBe(false);
    expect(isTerrainLiveEnabled(undefined)).toBe(false);
  });

  it('TEST-A13-MAP-03: confirmation branchée sur /api/terrain/reports/[id]/confirm', async () => {
    const request = confirmTerrainReportRequest(report().id, 'present');
    expect(request.url).toBe(`/api/terrain/reports/${report().id}/confirm`);
    expect(request.init.method).toBe('POST');
    expect(JSON.parse(String(request.init.body))).toEqual({ confirmation: 'present' });

    const okFetch = vi.fn(async () => jsonResponse(200, { status: 'confirmed' })) as unknown as FetchLike;
    await expect(confirmTerrainReportViaApi(report().id, 'gone', okFetch)).resolves.toMatchObject({
      ok: true,
      status: 200,
    });

    for (const status of [404, 409, 429]) {
      const failing = vi.fn(async () => jsonResponse(status, { error: 'refus' })) as unknown as FetchLike;
      const result = await confirmTerrainReportViaApi(report().id, 'unknown', failing);
      expect(result.ok).toBe(false);
      expect(result.status).toBe(status);
    }

    const networkError = vi.fn(async () => {
      throw new Error('offline');
    }) as unknown as FetchLike;
    await expect(confirmTerrainReportViaApi(report().id, 'present', networkError)).resolves.toEqual({
      ok: false,
      status: 0,
    });
  });

  it('TEST-A13-MAP-04: création 3 gestes branchée sur /api/terrain/reports (sans identité)', async () => {
    const request = createTerrainReportRequest({
      category: 'mud',
      severity: 'warning',
      passability: 'difficult',
      description: 'Boue profonde au col',
      lat: 44.12,
      lng: 6.22,
      gpsAccuracyM: 9,
    });
    expect(request.url).toBe('/api/terrain/reports');
    expect(request.init.method).toBe('POST');
    const body = JSON.parse(String(request.init.body)) as Record<string, unknown>;
    expect(body).toEqual({
      category: 'mud',
      severity: 'warning',
      passability: 'difficult',
      description: 'Boue profonde au col',
      lat: 44.12,
      lng: 6.22,
      gpsAccuracyM: 9,
    });
    // Aucune identité ne part du client : elle vient exclusivement de la session.
    expect(body).not.toHaveProperty('userId');
    expect(body).not.toHaveProperty('reporterId');
    expect(body).not.toHaveProperty('sourceType');

    const created = vi.fn(async () => jsonResponse(201, { reportId: report().id })) as unknown as FetchLike;
    await expect(
      createTerrainReportViaApi(
        { category: 'obstacle', severity: 'info', lat: 44.1, lng: 6.2 },
        created
      )
    ).resolves.toMatchObject({ ok: true, status: 201, reportId: report().id });

    const merged = vi.fn(async () => jsonResponse(200, { merged: true, reportId: report().id })) as unknown as FetchLike;
    await expect(
      createTerrainReportViaApi({ category: 'obstacle', severity: 'info', lat: 44.1, lng: 6.2 }, merged)
    ).resolves.toMatchObject({ ok: true, status: 200, reportId: report().id });

    const rejected = vi.fn(async () => jsonResponse(422, { error: 'Signalement refusé' })) as unknown as FetchLike;
    await expect(
      createTerrainReportViaApi({ category: 'obstacle', severity: 'info', lat: 44.1, lng: 6.2 }, rejected)
    ).resolves.toMatchObject({ ok: false, status: 422 });
  });
});
