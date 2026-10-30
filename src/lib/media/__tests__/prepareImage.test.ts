import { describe, expect, it } from 'vitest';
import { fitWithin, prepareImage } from '../prepareImage';

describe('fitWithin', () => {
  it('ne grossit jamais une petite image', () => {
    expect(fitWithin(800, 600, 2048)).toEqual({ width: 800, height: 600 });
  });

  it('réduit le côté le plus long en gardant les proportions', () => {
    expect(fitWithin(4000, 3000, 2000)).toEqual({ width: 2000, height: 1500 });
    expect(fitWithin(3000, 4000, 2000)).toEqual({ width: 1500, height: 2000 });
  });

  it('garde au moins 1 px par côté', () => {
    expect(fitWithin(10000, 1, 100)).toEqual({ width: 100, height: 1 });
  });
});

describe('prepareImage', () => {
  it('laisse passer un fichier non image tel quel', async () => {
    const file = new File(['x'], 'a.mp4', { type: 'video/mp4' });
    expect(await prepareImage(file)).toBe(file);
  });

  it('laisse passer un GIF tel quel (animation conservée)', async () => {
    const file = new File(['x'], 'a.gif', { type: 'image/gif' });
    expect(await prepareImage(file)).toBe(file);
  });

  it('renvoie l’original hors navigateur au lieu de lever', async () => {
    const file = new File(['x'], 'a.jpg', { type: 'image/jpeg' });
    expect(await prepareImage(file)).toBe(file);
  });
});
