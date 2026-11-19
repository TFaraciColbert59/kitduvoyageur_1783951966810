import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface DiffOutcome {
  compared: { w: number; h: number };
  diffPixels: number;
  maskedPixels: number;
  totalPixels: number;
  ratio: number;
  hotspots: Array<{ y: number; h: number; ratio: number }>;
  diffPng: Buffer;
}

const MASK = [255, 0, 255, 255];

function paint(png: PNG, rects: Rect[]): void {
  for (const rect of rects) {
    const x0 = Math.max(0, Math.floor(rect.x));
    const y0 = Math.max(0, Math.floor(rect.y));
    const x1 = Math.min(png.width, Math.ceil(rect.x + rect.w));
    const y1 = Math.min(png.height, Math.ceil(rect.y + rect.h));
    for (let y = y0; y < y1; y += 1) {
      for (let x = x0; x < x1; x += 1) {
        const i = (y * png.width + x) * 4;
        png.data[i] = MASK[0];
        png.data[i + 1] = MASK[1];
        png.data[i + 2] = MASK[2];
        png.data[i + 3] = MASK[3];
      }
    }
  }
}

function crop(png: PNG, w: number, h: number): PNG {
  const out = new PNG({ width: w, height: h });
  PNG.bitblt(png, out, 0, 0, w, h, 0, 0);
  return out;
}

/**
 * Diff pixel sur l'intersection des deux cadres (origine en haut à gauche).
 * Les masques (union des zones des deux côtés) sont peints à l'identique dans
 * les deux images et retirés du dénominateur.
 */
export function diffImages(appBuf: Buffer, maqBuf: Buffer, masks: Rect[]): DiffOutcome {
  const appFull = PNG.sync.read(appBuf);
  const maqFull = PNG.sync.read(maqBuf);
  const w = Math.min(appFull.width, maqFull.width);
  const h = Math.min(appFull.height, maqFull.height);
  const app = crop(appFull, w, h);
  const maq = crop(maqFull, w, h);
  paint(app, masks);
  paint(maq, masks);

  const isMasked = (i: number) =>
    app.data[i] === MASK[0] && app.data[i + 1] === MASK[1] && app.data[i + 2] === MASK[2] && maq.data[i] === MASK[0] && maq.data[i + 1] === MASK[1] && maq.data[i + 2] === MASK[2];

  const diff = new PNG({ width: w, height: h });
  const diffPixels = pixelmatch(app.data, maq.data, diff.data, w, h, { threshold: 0.1, includeAA: false });

  let maskedPixels = 0;
  const bands = new Map<number, number>();
  const bandMasked = new Map<number, number>();
  let counted = 0;
  for (let y = 0; y < h; y += 1) {
    const band = Math.floor(y / 64);
    for (let x = 0; x < w; x += 1) {
      const i = (y * w + x) * 4;
      if (isMasked(i)) {
        maskedPixels += 1;
        bandMasked.set(band, (bandMasked.get(band) ?? 0) + 1);
        continue;
      }
      counted += 1;
      // pixelmatch peint les pixels différents en rouge (255,0,0).
      if (diff.data[i] === 255 && diff.data[i + 1] === 0 && diff.data[i + 2] === 0) {
        bands.set(band, (bands.get(band) ?? 0) + 1);
      }
    }
  }
  const hotspots = Array.from(bands.entries())
    .map(([band, n]) => {
      const bandH = Math.min(64, h - band * 64);
      const total = bandH * w - (bandMasked.get(band) ?? 0);
      return { y: band * 64, h: bandH, ratio: total > 0 ? n / total : 0 };
    })
    .filter((b) => b.ratio > 0.02)
    .sort((a, b) => b.ratio * b.h - a.ratio * a.h)
    .slice(0, 5);

  return {
    compared: { w, h },
    diffPixels,
    maskedPixels,
    totalPixels: counted,
    ratio: counted > 0 ? diffPixels / counted : 0,
    hotspots,
    diffPng: PNG.sync.write(diff),
  };
}
