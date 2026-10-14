import { describe, expect, it } from 'vitest';

import { storyMediaUrl } from '../media';

/**
 * Stories V2 — normalisation de l'URL d'affichage d'une story.
 * Privé (storage_path) → route contrôlée ; legacy → URL publique conservée ;
 * aucun média → null (la slide est ignorée, jamais de slide vide).
 */
describe('storyMediaUrl — normalisation média', () => {
  it('story privée → route contrôlée /api/stories/:id/media', () => {
    expect(
      storyMediaUrl({ id: 'abc', image_url: null, storage_path: 'uid/abc/f.jpg' })
    ).toBe('/api/stories/abc/media');
  });

  it('story legacy → URL publique conservée telle quelle', () => {
    expect(
      storyMediaUrl({ id: 'abc', image_url: 'https://cdn.test/a.jpg', storage_path: null })
    ).toBe('https://cdn.test/a.jpg');
  });

  it('les deux présents → le privé gagne (jamais de fuite par l’ancienne URL)', () => {
    expect(
      storyMediaUrl({
        id: 'abc',
        image_url: 'https://cdn.test/a.jpg',
        storage_path: 'uid/abc/f.jpg',
      })
    ).toBe('/api/stories/abc/media');
  });

  it('aucun média lisible → null', () => {
    expect(storyMediaUrl({ id: 'abc', image_url: null })).toBeNull();
    expect(storyMediaUrl({ id: 'abc', image_url: null, storage_path: null })).toBeNull();
  });
});
