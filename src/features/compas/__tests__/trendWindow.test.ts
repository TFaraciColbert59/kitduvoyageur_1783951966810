/**
 * Plan 1.8 : la tendance NASA POWER se demande sur des mois entiers, pour que
 * la même URL (et le même cache) serve tout le mois.
 */
import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { trendWindow, trendUrl } from '../server/weather';

describe('fenêtre de la tendance NASA POWER', () => {
  it('calée sur des mois entiers : cinq ans avant le premier jour, un an avant le dernier', () => {
    expect(trendWindow('2026-10-09', '2026-11-19')).toEqual({ start: '2021-10-01', end: '2025-11-30' });
  });

  it('deux jours du même mois : la même fenêtre, donc la même URL en cache', () => {
    const a = trendWindow('2026-10-09', '2026-11-19');
    const b = trendWindow('2026-10-20', '2026-11-30');
    expect(b).toEqual(a);
    expect(trendUrl(45.9, 6.87, b.start, b.end)).toBe(trendUrl(45.9, 6.87, a.start, a.end));
  });

  it('couvre toujours les jours demandés (fins de mois, février)', () => {
    expect(trendWindow('2026-01-31', '2026-03-13')).toEqual({ start: '2021-01-01', end: '2025-03-31' });
    expect(trendWindow('2028-01-20', '2028-02-29')).toEqual({ start: '2023-01-01', end: '2027-02-28' });
  });
});
