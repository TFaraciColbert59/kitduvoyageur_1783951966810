import { beforeEach, describe, expect, it } from 'vitest';
import {
  deleteOfflineMapPack,
  formatPackSize,
  readOfflineMapPack,
  saveOfflineMapPack,
} from '@/features/hub/cockpit/offlineMapPack';
import {
  clearCarnetDraft,
  loadCarnetDraft,
  saveCarnetDraft,
} from '@/features/hub/cockpit/CarnetDraftStore';

describe('cockpit offline map pack and carnet draft', () => {
  beforeEach(async () => {
    await deleteOfflineMapPack('trip-map-1');
    clearCarnetDraft('trip-map-1');
  });

  it('saves, reads and deletes an offline map pack with accurate size', async () => {
    const saved = await saveOfflineMapPack({
      tripId: 'trip-map-1',
      title: 'Tour du Mont-Blanc',
      route: [[[6.86, 45.92], [6.89, 45.94]]],
      steps: [],
      distance: 14.2,
      elevation: 850,
    });
    expect(saved.sizeBytes).toBeGreaterThan(20);
    expect(formatPackSize(saved.sizeBytes)).toMatch(/Ko$/);

    const read = await readOfflineMapPack('trip-map-1');
    expect(read?.title).toBe('Tour du Mont-Blanc');
    expect(read?.route[0]).toHaveLength(2);

    await deleteOfflineMapPack('trip-map-1');
    expect(await readOfflineMapPack('trip-map-1')).toBeNull();
  });

  it('persists and clears a local carnet moment draft across restarts', () => {
    const saved = saveCarnetDraft({
      tripId: 'trip-map-1',
      day: 2,
      caption: 'Vue superbe au col',
      place: 'Col du Bonhomme',
      capturedAt: '2026-11-21T10:15:00Z',
      timeZone: 'Europe/Paris',
    });
    expect(saved.caption).toBe('Vue superbe au col');

    const loaded = loadCarnetDraft('trip-map-1');
    expect(loaded?.place).toBe('Col du Bonhomme');
    expect(loaded?.day).toBe(2);

    clearCarnetDraft('trip-map-1');
    expect(loadCarnetDraft('trip-map-1')).toBeNull();
  });
});
