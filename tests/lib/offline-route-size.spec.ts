/**
 * Revue Codex sur #83 : plus aucune tuile n'est téléchargée, la place d'une
 * randonnée gardée hors ligne est donc celle de son tracé et de ses points.
 */
import { describe, expect, it } from 'vitest';
import { formatSize, getOfflineRouteSize, type OfflineRoute } from '@/lib/offlineStorage';

const route: OfflineRoute = {
  routeId: 'r1',
  name: 'Tour du lac — étape',
  distanceKm: 12.4,
  difficulty: 'moyenne',
  geojson: { type: 'LineString', coordinates: [[6.1, 45.9], [6.2, 45.95]] },
  pois: [{ id: 'p1', name: 'Source', type: 'water', latitude: 45.92, longitude: 6.15 } as never],
  cachedAt: '2026-10-09T04:00:00.000Z',
  tileCount: 0,
};

describe('place prise par une randonnée hors ligne', () => {
  it('le tracé et ses points comptent (octets UTF-8), jamais « — » pour une randonnée gardée', async () => {
    const size = await getOfflineRouteSize(route);
    expect(size).toBe(new TextEncoder().encode(JSON.stringify(route)).byteLength);
    expect(size).toBeGreaterThan(JSON.stringify(route).length - 1);
    expect(formatSize(size)).not.toBe('—');
  });
});
