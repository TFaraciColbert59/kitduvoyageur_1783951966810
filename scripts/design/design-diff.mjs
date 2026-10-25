#!/usr/bin/env node
// scripts/design/design-diff.mjs
// Diff pixel de deux captures au même viewport, avec seuil explicite.
//
//   npm run design:diff -- avant.png apres.png [--out diff.png] [--max-percent 0.2]
//
// Sort : pourcentage de pixels différents, image de diff (rouge = écart).

import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const files = args.filter((a) => !a.startsWith('--') && /\.(png|jpe?g|webp)$/i.test(a));
const getOpt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};

if (files.length < 2) {
  console.error('Usage : npm run design:diff -- avant.png apres.png [--out diff.png] [--max-percent 0.2]');
  process.exit(2);
}

const [aPath, bPath] = files;
const out = getOpt('out', aPath.replace(/\.(png|jpe?g|webp)$/i, '') + '-diff.png');
const maxPercent = Number(getOpt('max-percent', '0.2'));

const a = sharp(aPath).ensureAlpha();
const b = sharp(bPath).ensureAlpha();
const [am, bm] = await Promise.all([a.metadata(), b.metadata()]);

if (am.width !== bm.width || am.height !== bm.height) {
  console.error(`Tailles différentes : ${am.width}×${am.height} vs ${bm.width}×${bm.height}. Même viewport obligatoire.`);
  process.exit(2);
}

const [ra, rb] = await Promise.all([
  a.raw().toBuffer(),
  b.raw().toBuffer(),
]);

const { width, height } = am;
const channels = 4;
const diff = Buffer.alloc(width * height * channels);
let changed = 0;

for (let i = 0; i < width * height; i++) {
  const o = i * channels;
  const dr = Math.abs(ra[o] - rb[o]);
  const dg = Math.abs(ra[o + 1] - rb[o + 1]);
  const db = Math.abs(ra[o + 2] - rb[o + 2]);
  const delta = Math.max(dr, dg, db);
  const isDiff = delta > 8; // bruit de compression toléré
  if (isDiff) changed++;
  diff[o] = isDiff ? 255 : ra[o];
  diff[o + 1] = isDiff ? 0 : ra[o + 1];
  diff[o + 2] = isDiff ? 0 : ra[o + 2];
  diff[o + 3] = 255;
}

await sharp(diff, { raw: { width, height, channels } }).png().toFile(out);
const percent = (changed / (width * height)) * 100;
const ok = percent <= maxPercent;

console.log(`\nDIFF ${path.basename(aPath)} → ${path.basename(bPath)}  ${width}×${height}`);
console.log(`  pixels différents : ${percent.toFixed(3)} % (seuil ${maxPercent} %)`);
console.log(`  image de diff     : ${out}`);
console.log(`  ${ok ? 'OK' : 'ÉCART'} — ${ok ? 'sous le seuil' : 'au-dessus du seuil'}\n`);
process.exit(ok ? 0 : 1);
