import { describe, expect, it } from 'vitest';
import {
  IMAGE_LIMITS,
  STORY_LIMITS,
  mediaProgress,
  moveItem,
  uploadedObjectsOf,
  validateMediaFile,
} from '../fields/media';
import { createMediaItemV2 } from '../engine/createSchemasV2';

function imageFile(name = 'photo.jpg', size = 1024): File {
  return new File([new Uint8Array(size)], name, { type: 'image/jpeg' });
}

describe('limites de médias (03 § 7)', () => {
  it('images seules ≤ 10 Mo hors story', () => {
    expect(validateMediaFile(imageFile(), IMAGE_LIMITS).ok).toBe(true);
    const video = new File(['x'], 'clip.mp4', { type: 'video/mp4' });
    expect(validateMediaFile(video, IMAGE_LIMITS)).toMatchObject({ ok: false });
    const big = imageFile('big.jpg', 11 * 1024 * 1024);
    expect(validateMediaFile(big, IMAGE_LIMITS)).toMatchObject({ ok: false });
    expect(validateMediaFile(big, IMAGE_LIMITS).message).toContain('10 Mo');
  });

  it('story : vidéo acceptée jusqu’à 25 Mo', () => {
    const video = new File(['x'], 'clip.mp4', { type: 'video/mp4' });
    expect(validateMediaFile(video, STORY_LIMITS).ok).toBe(true);
    const big = new File([new Uint8Array(26 * 1024 * 1024)], 'clip.mp4', { type: 'video/mp4' });
    expect(validateMediaFile(big, STORY_LIMITS).ok).toBe(false);
  });
});

describe('médias : ordre et progression', () => {
  it('déplace un média sans perdre les autres', () => {
    expect(moveItem(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a']);
    expect(moveItem(['a', 'b', 'c'], 2, 0)).toEqual(['c', 'a', 'b']);
    expect(moveItem(['a', 'b'], 1, 1)).toEqual(['a', 'b']);
    expect(moveItem(['a'], 3, 0)).toEqual(['a']);
  });

  it('agrège la progression et liste les objets envoyés', () => {
    const items = [
      createMediaItemV2({ status: 'uploaded', progress: 100, storagePath: 'u/a.jpg', storageBucket: 'carnet-media' }),
      createMediaItemV2({ status: 'uploading', progress: 50 }),
      createMediaItemV2({ status: 'error', progress: 20 }),
    ];
    const progress = mediaProgress(items);
    expect(progress.pending).toBe(2);
    expect(progress.percent).toBe(Math.round((100 + 50 + 20) / 3));
    expect(uploadedObjectsOf(items)).toEqual([{ bucket: 'carnet-media', path: 'u/a.jpg' }]);
  });
});
