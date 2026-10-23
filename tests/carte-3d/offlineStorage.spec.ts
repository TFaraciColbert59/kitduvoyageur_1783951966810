import { describe, it, expect } from 'vitest';
import {
  computeBoundingBoxTiles,
  latToTileY,
  lngToTileX,
  getCarte3DOfflineDb,
  downloadTrailOfflinePack,
  checkTrailOfflineStatus,
  deleteTrailOfflinePack,
} from '@/features/carte-3d/offline/carte3dOfflineStorage';

describe('Carte 3D — Offline Storage & Tile Math', () => {
  it('lngToTileX & latToTileY : calcule les coordonnées XYZ de tuiles Web Mercator', () => {
    // Méridien de Greenwich à zoom 0
    expect(lngToTileX(0, 0)).toBe(0);
    expect(latToTileY(0, 0)).toBe(0);

    // Zoom 10 (1024 tuiles de côté)
    const xParis = lngToTileX(2.3522, 10);
    const yParis = latToTileY(48.8566, 10);

    expect(xParis).toBeGreaterThanOrEqual(0);
    expect(xParis).toBeLessThan(1024);
    expect(yParis).toBeGreaterThanOrEqual(0);
    expect(yParis).toBeLessThan(1024);

    // Chamonix (zoom 12)
    const xCham = lngToTileX(6.8694, 12);
    const yCham = latToTileY(45.9237, 12);
    expect(xCham).toBeGreaterThan(0);
    expect(yCham).toBeGreaterThan(0);
  });

  it('computeBoundingBoxTiles : génère les tuiles nécessaires au sein des seuils de sécurité', () => {
    // Bbox Chamonix Mont-Blanc
    const bounds: [number, number, number, number] = [6.80, 45.85, 6.95, 45.95];
    const tiles = computeBoundingBoxTiles(bounds, [12]);

    expect(tiles.length).toBeGreaterThan(0);
    expect(tiles.length).toBeLessThan(250);

    for (const t of tiles) {
      expect(t.z).toBe(12);
      expect(t.x).toBeGreaterThan(0);
      expect(t.y).toBeGreaterThan(0);
    }
  });

  it('getCarte3DOfflineDb : initialise la base Dexie avec le store offline_packs', () => {
    const db = getCarte3DOfflineDb();
    expect(db).toBeDefined();
    expect(db.name).toBe('lkdv-carte3d-offline');
    expect(db.offline_packs).toBeDefined();
  });

  it('downloadTrailOfflinePack : prépare le pack de tuiles et les métadonnées hors-ligne', async () => {
    const mockTrail = {
      id: 'test-offline-trail-1',
      name: 'Trek Test',
      massif: 'Alpes',
      country: 'France',
      distanceKm: 25,
      elevationGainM: 1200,
      elevationLossM: 1200,
      minElevationM: 1000,
      maxElevationM: 2200,
      estimatedDurationHours: 7,
      bounds: [6.8, 45.8, 6.9, 45.9] as [number, number, number, number],
      coordinates: [[6.8, 45.8], [6.9, 45.9]] as [number, number, number?][],
      elevationProfile: [],
      waypoints: [],
    };

    let progressCalled = false;
    const pack = await downloadTrailOfflinePack(mockTrail, () => {
      progressCalled = true;
    });

    expect(pack).toBeDefined();
    expect(pack.trailId).toBe('test-offline-trail-1');
    expect(pack.trailName).toBe('Trek Test');
    expect(pack.isComplete).toBe(true);
    expect(pack.tileCount).toBeGreaterThan(0);
    expect(progressCalled).toBe(true);
  });
});

