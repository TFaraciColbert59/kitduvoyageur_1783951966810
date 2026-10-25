import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  MAX_TILES,
  MIN_ZOOM,
  planTiles,
  prefetchTiles,
  tileUrl,
  latToY,
  lonToX,
} from '../offline/tilePlan';
import { installMode, manifestProblems } from '../offline/pwaInstall';

describe('plan des tuiles hors ligne', () => {
  it('sans point valide : rien à garder', () => {
    expect(planTiles([])).toEqual([]);
    expect(planTiles([null, { lat: NaN, lon: 2 }, {}])).toEqual([]);
  });
  it('coordonnées connues (Paris z10)', () => {
    expect(lonToX(0, 1)).toBe(1);
    expect(latToY(48.8566, 10)).toBe(352);
    expect(lonToX(2.3522, 10)).toBe(518);
  });
  it('plafond respecté, vue d’ensemble toujours gardée, sans doublon', () => {
    const pts = Array.from({ length: 40 }, (_, i) => ({ lat: 45 + i * 0.05, lon: 5 + i * 0.05 }));
    const tiles = planTiles(pts);
    expect(tiles.length).toBeLessThanOrEqual(MAX_TILES);
    expect(tiles.some((t) => t.z === MIN_ZOOM)).toBe(true);
    expect(new Set(tiles.map((t) => `${t.z}/${t.x}/${t.y}`)).size).toBe(tiles.length);
  });
  it('un seul point : zooms 9 à 14 avec voisines', () => {
    const tiles = planTiles([{ lat: 45.05, lon: 5.45 }]);
    expect(Math.max(...tiles.map((t) => t.z))).toBe(14);
    expect(tiles).toHaveLength(9 * 6);
  });
  it('URL et préchargement : échecs ignorés', async () => {
    expect(tileUrl('https://t/{z}/{x}/{y}.png', { z: 1, x: 2, y: 3 })).toBe('https://t/1/2/3.png');
    const tiles = planTiles([{ lat: 45, lon: 5 }]).slice(0, 10);
    let n = 0;
    const got = await prefetchTiles('https://t/{z}/{x}/{y}', tiles, async () => {
      n += 1;
      if (n % 2 === 0) throw new Error('x');
      return { ok: true };
    });
    expect(got).toBe(5);
  });
});

describe('PWA installable', () => {
  const android = 'Mozilla/5.0 (Linux; Android 14) Chrome/120';
  const safari = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) Safari/605.1';
  it('modes', () => {
    expect(installMode({ userAgent: android, standalone: true, hasPromptEvent: true })).toBe(
      'installed'
    );
    expect(installMode({ userAgent: android, standalone: false, hasPromptEvent: true })).toBe(
      'prompt'
    );
    expect(installMode({ userAgent: safari, standalone: false, hasPromptEvent: false })).toBe(
      'ios-manual'
    );
    expect(installMode({ userAgent: android, standalone: false, hasPromptEvent: false })).toBe(
      'none'
    );
  });
  it('le manifeste du dépôt est installable', () => {
    const m = JSON.parse(readFileSync(join(process.cwd(), 'public/manifest.json'), 'utf8'));
    expect(manifestProblems(m)).toEqual([]);
  });
});
