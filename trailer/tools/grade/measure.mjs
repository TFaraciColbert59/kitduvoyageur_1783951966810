#!/usr/bin/env node
// Mesures avant/après de l'étalonnage, sur les captures du moteur (lab.mjs).
//   node tools/grade/measure.mjs [variante ...]     (défaut : 60 100 130)
// Par image : RVB moyen des 1 % de pixels les plus sombres et des 1 % les plus clairs, chroma moyenne des verts,
// écart de teinte et ΔE2000 sur les peaux et sur l'olive du sac, ΔE2000 moyen global, et l'écart entre la
// capture du moteur et l'application de la LUT par notre propre interpolation (preuve que le moteur lit bien le cube).
import sharp from 'sharp';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SAMPLES } from './lab.mjs';
import { srgbToOklab, oklabToLch, srgbToLab, deltaE2000, hueDiff, displayLuma, parseCube, sampleLut, rgbToHex } from './lib/color.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const TRAILER = resolve(HERE, '../..');
const RENDERS = resolve(TRAILER, 'grade-lab/samples/renders');
const LUTS = { '60': ['lkdv-trailer.cube', 0.6], '100': ['lkdv-trailer.cube', 1], '130': ['lkdv-trailer-130.cube', 1] };

async function load(path) {
  const { data, info } = await sharp(path).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, w: info.width, h: info.height };
}
// rectangle utile d'une image posée en object-fit: contain dans 1920×1080
async function contentRect(src) {
  const m = await sharp(resolve(TRAILER, src)).metadata();
  const s = Math.min(1920 / m.width, 1080 / m.height);
  const w = Math.floor(m.width * s), h = Math.floor(m.height * s);
  const x = Math.ceil((1920 - w) / 2) + 2, y = Math.ceil((1080 - h) / 2) + 2;
  return { x, y, w: w - 4, h: h - 4 };
}

const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : NaN);
const f = (v, d = 2) => (Number.isFinite(v) ? v.toFixed(d) : '—');

export async function measure(id, src, variant) {
  const before = await load(resolve(RENDERS, 'neutre', id + '.png'));
  const after = await load(resolve(RENDERS, variant, id + '.png'));
  const r = await contentRect(src);
  const [cubeFile, inten] = LUTS[variant];
  const cube = parseCube(readFileSync(resolve(TRAILER, 'grade-lab/assets/luts', cubeFile), 'utf8'));
  const px = [];
  for (let y = r.y; y < r.y + r.h; y += 2)
    for (let x = r.x; x < r.x + r.w; x += 2) {
      const i = (y * before.w + x) * 3;
      px.push([[before.data[i] / 255, before.data[i + 1] / 255, before.data[i + 2] / 255], [after.data[i] / 255, after.data[i + 1] / 255, after.data[i + 2] / 255]]);
    }
  const byLuma = (k) => px.map((p) => [displayLuma(p[k]), p[k]]).sort((a, b) => a[0] - b[0]);
  const pct = (k, top) => { const s = byLuma(k); const n = Math.max(1, Math.floor(s.length / 100)); const part = top ? s.slice(-n) : s.slice(0, n); return [0, 1, 2].map((c) => Math.round(mean(part.map((q) => q[1][c])) * 255)); };
  const greens = [], skins = [], olives = [], dE = [], model = [];
  for (const [b, a] of px) {
    const [L, C, h] = oklabToLch(srgbToOklab(b));
    const [, Ca, ha] = oklabToLch(srgbToOklab(a));
    const lb = srgbToLab(b), la = srgbToLab(a);
    const d = deltaE2000(lb, la);
    dE.push(d);
    if (h > 125 && h < 170 && C > 0.04) greens.push([C, Ca]);
    if (h > 35 && h < 75 && C > 0.03 && C < 0.14 && L > 0.45 && L < 0.92) skins.push([hueDiff(ha, h), d]);
    if (h > 105 && h < 130 && C > 0.07 && L > 0.45) olives.push([hueDiff(ha, h), d]);
    const m = sampleLut(cube.table, cube.size, b).map((v, k) => b[k] + (v - b[k]) * inten);
    model.push(deltaE2000(srgbToLab(m), la));
  }
  return {
    id, variant,
    darkBefore: pct(0, false), darkAfter: pct(1, false), brightBefore: pct(0, true), brightAfter: pct(1, true),
    greenN: greens.length, greenChromaRatio: greens.length ? mean(greens.map((g) => g[1])) / mean(greens.map((g) => g[0])) : NaN,
    skinN: skins.length, skinHueShift: mean(skins.map((s) => s[0])), skinDE: mean(skins.map((s) => s[1])),
    oliveN: olives.length, oliveHueShift: mean(olives.map((s) => s[0])), oliveDE: mean(olives.map((s) => s[1])),
    meanDE: mean(dE), p95DE: dE.sort((a, b) => a - b)[Math.floor(dE.length * 0.95)], modelDE: mean(model),
  };
}

async function main() {
  const variants = process.argv.slice(2).length ? process.argv.slice(2) : ['60', '100', '130'];
  const all = [];
  for (const v of variants) for (const [id, src] of SAMPLES) all.push(await measure(id, src, v));
  const hex = (c) => rgbToHex(c.map((x) => x / 255));
  const lines = ['| image | var. | 1 % sombres av. → ap. | 1 % clairs av. → ap. | chroma verts | peau Δh° / ΔE | olive Δh° / ΔE | ΔE moy. / p95 | écart moteur |', '|---|---|---|---|---|---|---|---|---|'];
  for (const m of all)
    lines.push(`| ${m.id} | ${m.variant} | ${hex(m.darkBefore)} → ${hex(m.darkAfter)} | ${hex(m.brightBefore)} → ${hex(m.brightAfter)} | ${m.greenN > 200 ? '×' + f(m.greenChromaRatio, 3) : '—'} | ${m.skinN > 200 ? f(m.skinHueShift, 1) + ' / ' + f(m.skinDE) : '—'} | ${m.oliveN > 200 ? f(m.oliveHueShift, 1) + ' / ' + f(m.oliveDE) : '—'} | ${f(m.meanDE)} / ${f(m.p95DE)} | ${f(m.modelDE)} |`);
  const out = resolve(TRAILER, 'qa/snapshots/grade');
  mkdirSync(out, { recursive: true });
  writeFileSync(resolve(out, 'mesures.json'), JSON.stringify(all, null, 1));
  writeFileSync(resolve(out, 'mesures.md'), lines.join('\n') + '\n');
  console.log(lines.join('\n'));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
