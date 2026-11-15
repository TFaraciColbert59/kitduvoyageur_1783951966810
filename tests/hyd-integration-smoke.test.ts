/**
 * Smoke test d'intégration hyd/integrated — 1 describe par lot (8 familles).
 * N'exerce que du code pur (aucun réseau, aucun Supabase, aucun DOM).
 */
import { describe, expect, it } from 'vitest';

// Lot 1 — devices-ops (D01-D04, O01, O02) : carbone évité
import { estimateAvoidedCarbon } from '@/features/offers/domain/carbonAndMetro';
// Lot 2 — social (G01-G03) : classements
import { rankingsMeta } from '@/lib/rankings/builders';
// Lot 3 — seg-priv (S01-S03, P01-P02) : audiences de sortie
import {
  normalizeStoredOutingVisibility,
  outingVisibilityLabel,
} from '@/features/compte/domain/outingAudience';
// Lot 4 — carto (C01-C04) : lieux enregistrés
import { isPlaceSavedInList } from '@/features/explorer-v2/savedPlaces';
// Lot 5 — nav (N01-N02) : normalisation d'URI hors ligne
import { normalizeResourceUri } from '@/features/offline/integrity';
// Lot 6 — act-session (A01-A03) : import GPX
import { parseGpx } from '@/features/hiking/import/gpx';
// Lot 7 — act-perf (A04-A08) : séries de progression
import { computeActivityStreaks } from '@/features/compte/progression/streaks';
// Lot 8 — routes (R01-R04) : bibliothèque de parcours
import { copyRouteToDraft } from '@/features/routes/library/routeLibrary';

describe('hyd/integrated — fumée 8 lots', () => {
  it('lot devices-ops : carbone évité vélotaf', () => {
    const res = estimateAvoidedCarbon({
      sport: 'velo',
      distanceKm: 10,
      authorized: true,
      replacesCarTrip: true,
    });
    expect(res.eligible).toBe(true);
    expect(res.kgCo2Avoided).toBeCloseTo(1.93, 2);
  });

  it('lot social : méta classements fail-closed', () => {
    const meta = rankingsMeta();
    expect(meta.privacy).toBe('fail_closed');
    expect(typeof meta.generatedAt).toBe('string');
  });

  it('lot seg-priv : visibilités de sortie', () => {
    expect(normalizeStoredOutingVisibility('public')).toBe('public');
    expect(normalizeStoredOutingVisibility('nimporte-quoi')).toBe('private');
    expect(typeof outingVisibilityLabel('private')).toBe('string');
  });

  it('lot carto : lieux enregistrés', () => {
    expect(isPlaceSavedInList([], 'x')).toBe(false);
    expect(
      isPlaceSavedInList(
        [
          {
            id: 'a',
            name: 'Refuge',
            kind: 'poi',
            lat: 45.9,
            lng: 6.8,
            savedAt: '2026-11-01T00:00:00Z',
          },
        ],
        'a',
      ),
    ).toBe(true);
  });

  it('lot nav : URI hors ligne sans jeton éphémère', () => {
    expect(normalizeResourceUri('https://tiles.example.com/z?token=abc&x=1')).toBe(
      'https://tiles.example.com/z?x=1',
    );
  });

  it('lot act-session : import GPX minimal', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="lkdv-smoke" xmlns="http://www.topografix.com/GPX/1/1">
  <trk><name>Test</name><trkseg>
    <trkpt lat="45.9000" lon="6.8000"><ele>1200</ele></trkpt>
    <trkpt lat="45.9001" lon="6.8001"><ele>1205</ele></trkpt>
  </trkseg></trk>
</gpx>`;
    const parsed = parseGpx(xml);
    expect(parsed.points.length).toBeGreaterThanOrEqual(2);
  });

  it('lot act-perf : séries vides = aucune série', () => {
    const summary = computeActivityStreaks([], 'Europe/Paris');
    expect(summary.global.currentDayStreak).toBe(0);
    expect(summary.global.longestDayStreak).toBe(0);
    expect(summary.bySport).toEqual([]);
  });

  it('lot routes : copie de tracé vers brouillon', () => {
    const copied = copyRouteToDraft({
      sourceId: 'r1',
      name: 'Boucle test',
      geojson: {
        type: 'LineString',
        coordinates: [
          [6.8, 45.9],
          [6.81, 45.91],
        ],
      },
      distanceKm: 2.5,
    });
    expect(copied).not.toBeNull();
    expect(copied!.draft.points.length).toBeGreaterThanOrEqual(2);
  });
});
