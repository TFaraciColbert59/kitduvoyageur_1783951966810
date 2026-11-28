import { describe, expect, it, vi } from 'vitest';
import {
  createTrackTrace,
  pushTrackPoint,
  simplifyDouglasPeucker,
  TRACK_MAX_DISPLAY_VERTICES,
  trackGeoJson,
} from '../activity/trackTrace';
import {
  enterGpsActiveMemoryBudget,
  exitGpsActiveMemoryBudget,
} from '../map/gpsActiveMemoryManager';
import { resolveActivityProfile } from '../specs/resolveActivityProfile';
import { gunzipNdjson, gzipNdjson } from '@/app/api/explorer/v2/activity/trace-archive/route';

describe('Lot 05 & 06 — R2 NDJSON.gz, Douglas-Peucker 60 FPS & 3D Memory Unload', () => {
  it('round-trips raw 1 Hz trace points through gzipNdjson / gunzipNdjson cleanly', async () => {
    const sample = Array.from({ length: 50 }, (_, i) => ({
      seq: i + 1,
      t: 1_760_000_000_000 + i * 1000,
      lat: 45.83 + i * 0.0001,
      lng: 6.86 + i * 0.0001,
      ele: 2100 + i * 0.5,
      hr: 148,
    }));
    const gz = await gzipNdjson(sample);
    expect(gz.byteLength).toBeGreaterThan(0);
    const restored = await gunzipNdjson(gz);
    expect(restored).toHaveLength(50);
    expect(restored[49]!.seq).toBe(50);
  });

  it('caps display track vertices at <= 2500 on 5000-point synthetic ultra track (Douglas-Peucker)', () => {
    let trace = createTrackTrace();
    for (let i = 0; i < 4000; i += 1) {
      // Gentle curving path with minor GPS jitter
      const lng = 6.8 + i * 0.00005;
      const lat = 45.8 + Math.sin(i / 80) * 0.002 + (i % 2 === 0 ? 0.000005 : 0);
      trace = pushTrackPoint(trace, [lng, lat]);
    }
    expect(trace.current.length).toBeLessThanOrEqual(TRACK_MAX_DISPLAY_VERTICES);
    const geo = trackGeoJson(trace, 13);
    expect(geo).not.toBeNull();
    const coords = (geo!.features[0]!.geometry as { coordinates: number[][] }).coordinates;
    expect(coords.length).toBeLessThanOrEqual(TRACK_MAX_DISPLAY_VERTICES);
    expect(simplifyDouglasPeucker([[0, 0], [0.5, 0], [1, 0]], 10)).toHaveLength(2);
  });

  it('disposes Three.js 3D context and unloads non-essential GeoJSON sources on GPS_ACTIVE', () => {
    const disposeThree3D = vi.fn();
    const restoreThree3D = vi.fn();
    const unloaded: string[] = [];
    const setMaxTileCacheSize = vi.fn();
    const setPixelRatio = vi.fn();

    const spec = resolveActivityProfile('trail_running');
    const report = enterGpsActiveMemoryBudget(
      {
        disposeThree3D,
        restoreThree3D,
        getLoadedGeoJsonSourceIds: () => [
          'xp-track',
          'trails_gr_pr',
          'water_points',
          'social-stories',
          'clubs-pins',
          'pokedex-3d',
          'bottles-layer',
        ],
        unloadGeoJsonSource: (id) => unloaded.push(id),
        setMaxTileCacheSize,
        setPixelRatio,
      },
      spec,
    );

    expect(report.three3DDisposed).toBe(true);
    expect(disposeThree3D).toHaveBeenCalledTimes(1);
    expect(unloaded).toEqual(['social-stories', 'clubs-pins', 'pokedex-3d', 'bottles-layer']);
    expect(report.keptOverlays).toEqual(['xp-track', 'trails_gr_pr', 'water_points']);
    expect(setMaxTileCacheSize).toHaveBeenCalledWith(24);
    expect(setPixelRatio).toHaveBeenCalledWith(2.0);

    exitGpsActiveMemoryBudget({ restoreThree3D, setMaxTileCacheSize, setPixelRatio }, 3);
    expect(restoreThree3D).toHaveBeenCalledTimes(1);
    expect(setMaxTileCacheSize).toHaveBeenCalledWith(64);
  });
});
