import { describe, expect, it, vi } from 'vitest';

import { englishPlaceName } from '@/features/booking/server/englishPlaceName';

const photon = (
  features: Array<{ type: string; name: string; extent?: [number, number, number, number] }>
) =>
  vi.fn(
    async (_url: string) =>
      new Response(JSON.stringify({ features: features.map((p) => ({ properties: p })) }), {
        status: 200,
      })
  );

describe('englishPlaceName (Photon, lang=en)', () => {
  it('donne le nom anglais de la ville, pas un lieu-dit homonyme', async () => {
    const fetchImpl = photon([
      { type: 'locality', name: 'Lisbonne' },
      { type: 'city', name: 'Lisbon' },
    ]);
    await expect(englishPlaceName('Lisbonne', fetchImpl)).resolves.toBe('Lisbon');
    expect(String(fetchImpl.mock.calls[0]?.[0])).toContain('lang=en');
  });

  it('homonymes : la ville la plus étendue (« Londres » → London, pas Londres en Argentine)', async () => {
    const fetchImpl = photon([
      { type: 'city', name: 'Londres', extent: [-68.0, -27.7, -67.9, -27.75] },
      { type: 'city', name: 'London', extent: [-0.51, 51.69, 0.33, 51.28] },
      { type: 'state', name: 'Greater London', extent: [-0.6, 51.8, 0.4, 51.2] },
    ]);
    await expect(englishPlaceName('Londres', fetchImpl)).resolves.toBe('London');
  });

  it('rien d’inventé : aucun lieu habité ou région → null ; panne → null', async () => {
    await expect(
      englishPlaceName('Chez Paulo', photon([{ type: 'house', name: 'Chez Paulo' }]))
    ).resolves.toBeNull();
    await expect(
      englishPlaceName(
        'Paris',
        vi.fn(async () => new Response('', { status: 503 }))
      )
    ).resolves.toBeNull();
    await expect(
      englishPlaceName(
        'Paris',
        vi.fn(async () => Promise.reject(new Error('réseau')))
      )
    ).resolves.toBeNull();
  });
});
