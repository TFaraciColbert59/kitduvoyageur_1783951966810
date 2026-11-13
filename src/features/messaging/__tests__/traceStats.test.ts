import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabase/client', () => ({ createClient: vi.fn() }));

import { GPXEngine } from '@/features/hiking/gpx/GPXEngine';
import { lngLatLengthKm, simplifySegments, type LngLat } from '@/lib/geo/traceCoordinates';
import { buildTrailMessageMeta, savedTrailFromRow, toMessageLine } from '../data/realTrailsData';
import { formatTraceStats } from '../lib/traceFormat';
import { analyzeGpxUpload, buildGpxMessageMeta, geometryDistanceKm, gpxStats, messageTraceStats } from '../lib/traceStats';
import { readLimitedText, GpxTooLargeError } from '../lib/gpxFetch';

/** Trace sinueuse (zigzags serrés) : sa version simplifiée est bien plus courte que la réalité. */
function windingTrack(n: number, lng0: number, lat0: number): LngLat[] {
  return Array.from({ length: n }, (_, i) => [lng0 + i * 0.0002, lat0 + (i % 2 === 0 ? 0 : 0.004)] as LngLat);
}

function gpxOf(segments: LngLat[][]): string {
  return GPXEngine.fromSegments(segments, 'Test');
}

const file = (text: string, size = text.length) => ({ size, text: async () => text });

describe('GPX à deux segments : pas de droite entre eux, distance correcte', () => {
  const A = windingTrack(40, 6.0, 45.0);
  const B = windingTrack(40, 6.6, 45.0);

  it('deux segments éloignés de ~50 km : distance = somme des segments, pas 50 km de plus', async () => {
    const analysis = await analyzeGpxUpload(file(gpxOf([A, B])));
    expect(analysis.blockReason).toBeNull();
    expect(analysis.geojson?.type).toBe('MultiLineString');
    const expected = lngLatLengthKm(A) + lngLatLengthKm(B);
    expect(analysis.distanceKm).toBeCloseTo(Math.round(expected * 10) / 10, 5);
    expect(lngLatLengthKm([...A, ...B]) - expected).toBeGreaterThan(40);
  });
});

describe('fichier sans tracé exploitable : envoi bloqué avec une raison lisible', () => {
  it('points d’intérêt seuls, faux .gpx, vide', async () => {
    for (const text of ['<gpx><wpt lat="45" lon="6"/></gpx>', 'ceci n’est pas un GPX', '', '<gpx><trkseg><trkpt lat="45" lon="6"/></trkseg></gpx>']) {
      const analysis = await analyzeGpxUpload(file(text));
      expect(analysis.geojson).toBeNull();
      expect(analysis.blockReason).toMatch(/aucun tracé exploitable/);
    }
  });

  it('fichier trop volumineux : jamais lu', async () => {
    const text = vi.fn(async () => '<gpx/>');
    const analysis = await analyzeGpxUpload({ size: 5 * 1024 * 1024 + 1, text });
    expect(text).not.toHaveBeenCalled();
    expect(analysis.blockReason).toMatch(/5 Mo/);
  });

  it('lecture en échec : bloqué', async () => {
    const analysis = await analyzeGpxUpload({ size: 10, text: async () => Promise.reject(new Error('io')) });
    expect(analysis.blockReason).toMatch(/pas pu être lu/);
  });

  it('un fichier valide n’est pas bloqué', async () => {
    const analysis = await analyzeGpxUpload(file(gpxOf([windingTrack(10, 6, 45)])));
    expect(analysis.blockReason).toBeNull();
    expect(analysis.geojson).not.toBeNull();
  });
});

describe('distance : celle de la trace COMPLÈTE, jamais celle du tracé simplifié', () => {
  const long = windingTrack(3000, 6.0, 45.0);

  it('la trace simplifiée à 200 points est nettement plus courte que la trace réelle', () => {
    const full = lngLatLengthKm(long);
    const simplified = lngLatLengthKm(simplifySegments([long], 200)[0]);
    expect(simplified).toBeLessThan(full / 2);
  });

  it('GPX : le message porte distance et dénivelé de la trace complète', async () => {
    const analysis = await analyzeGpxUpload(file(gpxOf([long])));
    const geometry = toMessageLine(analysis.geojson);
    const meta = buildGpxMessageMeta({
      fileName: 'sinueux.gpx',
      fileSize: 1,
      url: 'u',
      geometry,
      distanceKm: analysis.distanceKm,
      elevationGainM: analysis.elevationGainM,
    });
    expect(meta.distance_km).toBe(Math.round(lngLatLengthKm(long) * 10) / 10);
    expect(meta).not.toHaveProperty('coordinates');
    const drawn = (meta.geojson as { coordinates: unknown[] }).coordinates.length;
    expect(drawn).toBeLessThanOrEqual(200);
  });

  it('randonnée : distance de la géométrie complète quand l’élément n’en porte pas', () => {
    const item = savedTrailFromRow({ id: 'r', trail_data: {} });
    const full = { type: 'LineString' as const, coordinates: long };
    const meta = buildTrailMessageMeta(item, full);
    expect(meta.distance_km).toBe(geometryDistanceKm(full));
    expect(meta.distance_km).toBeGreaterThan(lngLatLengthKm(simplifySegments([long], 200)[0]) * 2);
  });

  it('aperçu, tiroir et bulle affichent les MÊMES chiffres pour un même tracé', async () => {
    const A = windingTrack(300, 6.0, 45.0);
    const B = windingTrack(300, 6.6, 45.1);
    const text = GPXEngine.fromSegments([A, B], 'Deux segments').replace(/<trkpt lat="([^"]+)" lon="([^"]+)"\/>/g, (m, lat, lon, off) => {
      const e = 1000 + (off % 977);
      return `<trkpt lat="${lat}" lon="${lon}"><ele>${e}</ele></trkpt>`;
    });
    const analysis = await analyzeGpxUpload(file(text));
    const preview = formatTraceStats({ distanceKm: analysis.distanceKm, elevationGainM: analysis.elevationGainM });
    const meta = buildGpxMessageMeta({
      fileName: 'a.gpx',
      fileSize: text.length,
      url: 'u',
      geometry: toMessageLine(analysis.geojson),
      distanceKm: analysis.distanceKm,
      elevationGainM: analysis.elevationGainM,
    });
    const bubble = formatTraceStats(messageTraceStats(meta));
    const drawer = formatTraceStats(messageTraceStats(meta));
    expect(preview).not.toBeNull();
    expect(bubble).toBe(preview);
    expect(drawer).toBe(preview);
  });

  it('anciens messages sans chiffres : aucune distance recalculée sur le tracé simplifié', () => {
    const stats = messageTraceStats({ geojson: { type: 'LineString', coordinates: [[6, 45], [6.1, 45]] } });
    expect(stats).toEqual({ distanceKm: null, elevationGainM: null });
    expect(formatTraceStats(stats)).toBeNull();
  });

  it('gpxStats somme le dénivelé segment par segment', () => {
    const stats = gpxStats([
      { coordinates: [[6, 45], [6.1, 45]], elevations: [1000, 1100] },
      { coordinates: [[7, 45], [7.1, 45]], elevations: [2000, 2150] },
    ]);
    expect(stats.elevationGainM).toBe(250);
  });
});

describe('readLimitedText', () => {
  it('lit une réponse raisonnable, refuse une réponse déclarée ou lue trop grosse', async () => {
    expect(await readLimitedText(new Response('<gpx/>'))).toBe('<gpx/>');
    await expect(readLimitedText(new Response('x'.repeat(50)), 10)).rejects.toBeInstanceOf(GpxTooLargeError);
    const declared = new Response('x', { headers: { 'content-length': '999999999' } });
    await expect(readLimitedText(declared, 1000)).rejects.toBeInstanceOf(GpxTooLargeError);
  });
});
