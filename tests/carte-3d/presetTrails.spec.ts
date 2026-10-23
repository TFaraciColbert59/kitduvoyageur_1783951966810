import { describe, it, expect } from 'vitest';
import { PRESET_TRAILS } from '@/features/carte-3d/data/presetTrails';

describe('Carte 3D — Preset Mythic Trails', () => {
  it('contient exactement 5 sentiers mythiques préchargés', () => {
    expect(PRESET_TRAILS).toHaveLength(5);
    const ids = PRESET_TRAILS.map((t) => t.id);
    expect(ids).toEqual([
      'tmb-mont-blanc',
      'gr20-corse',
      'gavarnie-breche',
      'dolomites-av1',
      'haute-route-zermatt',
    ]);
  });

  it('chaque sentier respecte les contraintes structurelles et altimétriques', () => {
    for (const trail of PRESET_TRAILS) {
      expect(trail.id.length).toBeGreaterThan(0);
      expect(trail.name.length).toBeGreaterThan(0);
      expect(trail.massif.length).toBeGreaterThan(0);
      expect(trail.country.length).toBeGreaterThan(0);
      expect(trail.distanceKm).toBeGreaterThan(5);
      expect(trail.elevationGainM).toBeGreaterThan(500);
      expect(trail.minElevationM).toBeGreaterThan(0);
      expect(trail.maxElevationM).toBeGreaterThan(trail.minElevationM);
      expect(trail.estimatedDurationHours).toBeGreaterThan(1);

      // Bounding box valide [minLng, minLat, maxLng, maxLat]
      const [minLng, minLat, maxLng, maxLat] = trail.bounds;
      expect(minLng).toBeLessThan(maxLng);
      expect(minLat).toBeLessThan(maxLat);

      // Coordonnées continues
      expect(trail.coordinates.length).toBeGreaterThanOrEqual(10);
      for (const coord of trail.coordinates) {
        expect(coord[0]).toBeGreaterThanOrEqual(-180);
        expect(coord[0]).toBeLessThanOrEqual(180);
        expect(coord[1]).toBeGreaterThanOrEqual(-90);
        expect(coord[1]).toBeLessThanOrEqual(90);
        if (coord[2] !== undefined) {
          expect(coord[2]).toBeGreaterThan(0);
          expect(coord[2]).toBeLessThan(6000); // Pas d'Everest dans les Alpes/Pyrénées
        }
      }

      // Profil altimétrique synchronisé
      expect(trail.elevationProfile.length).toBe(trail.coordinates.length);
      expect(trail.elevationProfile[0].distanceKm).toBe(0);
      expect(trail.elevationProfile[trail.elevationProfile.length - 1].distanceKm).toBe(
        trail.distanceKm
      );

      // Waypoints enrichis
      expect(trail.waypoints.length).toBeGreaterThanOrEqual(3);
      for (const wpt of trail.waypoints) {
        expect(wpt.id.length).toBeGreaterThan(0);
        expect(wpt.name.length).toBeGreaterThan(0);
        expect(wpt.altitudeM).toBeGreaterThan(0);
        expect(['summit', 'refuge', 'water', 'viewpoint', 'weather', 'photo', 'pass']).toContain(
          wpt.category
        );
      }
    }
  });

  it('le Tour du Mont-Blanc comprend des sommets et refuges emblématiques', () => {
    const tmb = PRESET_TRAILS.find((t) => t.id === 'tmb-mont-blanc')!;
    expect(tmb).toBeDefined();
    const categories = tmb.waypoints.map((w) => w.category);
    expect(categories).toContain('summit');
    expect(categories).toContain('refuge');
    expect(categories).toContain('pass');
    expect(categories).toContain('water');

    const montBlanc = tmb.waypoints.find((w) => w.name.includes('Mont Blanc'));
    expect(montBlanc?.altitudeM).toBe(4809);
  });
});
