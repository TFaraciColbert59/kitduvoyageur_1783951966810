import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/features/discovery/providers/tripadvisor/tripadvisorClient', () => ({
  taSearchLocations: vi.fn(),
  taLocationDetails: vi.fn(),
}));

import {
  taLocationDetails,
  taSearchLocations,
} from '@/features/discovery/providers/tripadvisor/tripadvisorClient';
import {
  legacySearchByCategory,
  normalizeLocation,
} from '@/features/discovery/providers/tripadvisor/tripadvisorAdapter';

const searchMock = vi.mocked(taSearchLocations);
const detailsMock = vi.mocked(taLocationDetails);

function makeSearchItems(count: number) {
  return Array.from({ length: count }).map((_, index) => ({
    location_id: 1000 + index,
    name: `Lieu ${index}`,
    address_obj: { city: 'Reykjavík', address_string: `${index} rue` },
  })) as Awaited<ReturnType<typeof taSearchLocations>>;
}

describe('tripadvisor adapter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('ne demande les détails que pour les `limit` premiers résultats (1 + limit appels)', async () => {
    searchMock.mockResolvedValue(makeSearchItems(10));
    detailsMock.mockResolvedValue({ name: 'Détail' } as Awaited<ReturnType<typeof taLocationDetails>>);

    const items = await legacySearchByCategory({
      countryCode: 'IS',
      searchQuery: 'Islande',
      category: 'attractions',
      limit: 6,
    });

    expect(items).toHaveLength(6);
    expect(searchMock).toHaveBeenCalledTimes(1);
    expect(detailsMock).toHaveBeenCalledTimes(6);
  });

  it('normalise la note, le nombre d’avis, la photo et l’URL Tripadvisor', async () => {
    const item = normalizeLocation({
      countryCode: 'IS',
      category: 'restaurants',
      searchItem: { location_id: 42, name: 'Fallback' } as never,
      details: {
        name: 'Dill',
        rating: '4.5',
        num_reviews: '120',
        rating_image_url: 'https://static.tacdn.com/bubbles.png',
        web_url: 'https://www.tripadvisor.com/Restaurant_Review-g123',
        latitude: '64.1466',
        longitude: '-21.9426',
        cuisine: [{ localized_name: 'Nouvelle cuisine nordique' }],
        photo: { images: { original: { url: 'https://media-cdn.tripadvisor.com/photo.jpg' } } },
      } as never,
    });

    expect(item.rating).toBe(4.5);
    expect(item.reviewCount).toBe(120);
    expect(item.photoUrl).toBe('https://media-cdn.tripadvisor.com/photo.jpg');
    expect(item.ratingImageUrl).toBe('https://static.tacdn.com/bubbles.png');
    expect(item.tripadvisorUrl).toContain('tripadvisor.com');
    expect(item.latitude).toBeCloseTo(64.1466);
    expect(item.category).toBe('Nouvelle cuisine nordique');
    expect(item.isBookable).toBe(false);
  });

  it('n’invente jamais 0/5, 0 avis ni photo lorsque la donnée est absente', () => {
    const item = normalizeLocation({
      countryCode: 'IS',
      category: 'hotels',
      searchItem: { location_id: 7, name: 'Hôtel X' } as never,
      details: null,
    });

    expect(item.rating).toBeNull();
    expect(item.reviewCount).toBeNull();
    expect(item.photoUrl).toBeNull();
    expect(item.ratingImageUrl).toBeNull();
    expect(item.name).toBe('Hôtel X');
  });

  it('conserve les cartes dont le détail a échoué (dégradation partielle)', async () => {
    searchMock.mockResolvedValue(makeSearchItems(3));
    detailsMock
      .mockResolvedValueOnce({ name: 'OK' } as never)
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce({ name: 'OK2' } as never);

    const items = await legacySearchByCategory({
      countryCode: 'IS',
      searchQuery: 'Islande',
      category: 'attractions',
      limit: 3,
    });

    expect(items).toHaveLength(3);
    expect(items[0].name).toBe('OK');
    expect(items[1].rating).toBeNull();
    expect(items[2].name).toBe('OK2');
  });
});
