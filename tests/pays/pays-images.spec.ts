import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { searchCountryImages } from '@/features/pays/images/unsplash';

const UNSPLASH_ITEM = {
  urls: { regular: 'https://images.unsplash.com/photo-x?w=800', thumb: 'https://images.unsplash.com/photo-x?w=200' },
  alt_description: 'Cascade en Islande',
  user: { name: 'Jane Doe', username: 'janedoe' },
};

function jsonResponse(body: unknown, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

describe('searchCountryImages', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.stubEnv('UNSPLASH_ACCESS_KEY', '');
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('retourne un tableau vide sans cle', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    expect(await searchCountryImages('Islande')).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('normalise resultats + attribution, alt de repli', async () => {
    vi.stubEnv('UNSPLASH_ACCESS_KEY', 'k-test');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({
          results: [
            UNSPLASH_ITEM,
            { urls: { regular: 'https://images.unsplash.com/photo-y?w=800' }, alt_description: null, user: { name: null, username: 'x' } },
          ],
        })
      )
    );
    const images = await searchCountryImages('Islande', { perPage: 2 });
    expect(images).toHaveLength(2);
    expect(images[0]).toEqual({
      url: 'https://images.unsplash.com/photo-x?w=800',
      thumbUrl: 'https://images.unsplash.com/photo-x?w=200',
      alt: 'Cascade en Islande',
      authorName: 'Jane Doe',
      authorUrl: 'https://unsplash.com/@janedoe',
    });
    expect(images[1].alt).toContain('Islande');
  });

  it('degrade en tableau vide sur HTTP non-ok', async () => {
    vi.stubEnv('UNSPLASH_ACCESS_KEY', 'k-test');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ errors: ['x'] }, 401)));
    expect(await searchCountryImages('Islande')).toEqual([]);
  });
});
