import { describe, expect, it, vi } from 'vitest';
import { buildPreviewQuery, fetchPreviewPath, readPreviewPath } from '../routePreview';

describe('routePreview · halo du chemin réel (2.4)', () => {
  it('interroge le routeur avec snap=1 et les options du profil', () => {
    const q = new URLSearchParams(
      buildPreviewQuery([[5.1, 45.2], [5.2, 45.3], [5.3, 45.4]], 'vtt', { ebike: true, avoidSteps: true }),
    );
    expect(q.get('snap')).toBe('1');
    expect(q.get('sport')).toBe('vtt');
    expect(q.get('points')).toBe('5.100000,45.200000;5.200000,45.300000;5.300000,45.400000');
    expect(q.get('ebike')).toBe('1');
    expect(q.get('avoidSteps')).toBe('1');
    expect(q.has('avoidFerries')).toBe(false);
  });

  it('lit toutes les jambes en une ligne et cumule les km', () => {
    const res = readPreviewPath({
      status: 'ok',
      provider: 'valhalla',
      legs: [
        { distanceKm: 1.2, geometry: [[5, 45], [5.1, 45.1]] },
        { distanceKm: 0.8, geometry: { type: 'LineString', coordinates: [[5.1, 45.1], [5.2, 45.2]] } },
      ],
    });
    expect(res?.coordinates).toHaveLength(4);
    expect(res?.distanceKm).toBe(2);
    expect(res?.provider).toBe('valhalla');
  });

  it('une réponse incomplète n’est jamais dessinée', () => {
    expect(readPreviewPath(null)).toBeNull();
    expect(readPreviewPath({ status: 'error' })).toBeNull();
    expect(readPreviewPath({ status: 'ok', legs: [] })).toBeNull();
    expect(readPreviewPath({ status: 'ok', legs: [{ geometry: [[5, 45]] }] })).toBeNull();
    expect(readPreviewPath({ status: 'ok', legs: [{ geometry: [[5, 45], ['x', 1]] }] })).toBeNull();
  });

  it('sans réponse du routeur, rend null (le halo est absent, la ligne droite le dit)', async () => {
    const down = vi.fn().mockRejectedValue(new Error('réseau'));
    expect(await fetchPreviewPath([[5, 45], [5.1, 45.1]], 'marche', undefined, undefined, down as unknown as typeof fetch)).toBeNull();
    const refused = vi.fn().mockResolvedValue({ ok: false });
    expect(await fetchPreviewPath([[5, 45], [5.1, 45.1]], 'marche', undefined, undefined, refused as unknown as typeof fetch)).toBeNull();
    const ok = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ status: 'ok', legs: [{ distanceKm: 1, geometry: [[5, 45], [5.1, 45.1]] }] }) });
    const res = await fetchPreviewPath([[5, 45], [5.1, 45.1]], 'marche', undefined, undefined, ok as unknown as typeof fetch);
    expect(res?.coordinates).toHaveLength(2);
    expect(String(ok.mock.calls[0][0])).toContain('/api/route?');
  });
});
