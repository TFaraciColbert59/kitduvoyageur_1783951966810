#!/usr/bin/env node
// Planches d'aperçu des cadres 9:16, une par acte.
//   node tools/crops/preview.mjs [--out dossier] [--footage dossier]
// Par plan : l'image source en 16:9 (assets/footage/<img>.png, posée en cover comme dans le film), ou une mire
// (tiers, centre, nom de l'image attendue) si elle n'est pas encore arrivée ; le cadre de début en trait plein sauge,
// le cadre de fin en tirets crème, le point d'intérêt ; à droite, ce que montre la version verticale au début du plan.
// Sortie : qa/snapshots/grade/crops-acte-NN.jpg (+ un .png par plan avec --tiles).
import sharp from 'sharp';
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readTrame } from './trame.mjs';
import { CROPS } from './validate.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const TRAILER = resolve(HERE, '../..');
const arg = (n, d) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : d; };
const OUT = resolve(arg('--out', resolve(TRAILER, 'qa/snapshots/grade')));
const FOOTAGE = resolve(arg('--footage', resolve(TRAILER, 'assets/footage')));
const TW = 480, TH = 270, VW = 152, PAD = 10, LABEL = 26;
const CELL_W = TW + VW + PAD * 3, CELL_H = TH + LABEL + PAD * 2;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');

async function sourceImage(src) {
  const file = ['png', 'jpg', 'jpeg', 'webp'].map((e) => resolve(FOOTAGE, `${src}.${e}`)).find(existsSync);
  if (file) return { buf: await sharp(file).resize(1920, 1080, { fit: 'cover' }).png().toBuffer(), real: true };
  // mire : fond encre, tiers et centre, nom de l'image attendue
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080">
    <rect width="1920" height="1080" fill="#0B1F17"/>
    ${[640, 1280].map((x) => `<line x1="${x}" y1="0" x2="${x}" y2="1080" stroke="#5B7F55" stroke-width="3"/>`).join('')}
    ${[360, 720].map((y) => `<line x1="0" y1="${y}" x2="1920" y2="${y}" stroke="#5B7F55" stroke-width="3"/>`).join('')}
    ${Array.from({ length: 17 }, (_, i) => `<line x1="${i * 120}" y1="0" x2="${i * 120}" y2="1080" stroke="#17402C" stroke-width="1"/>`).join('')}
    <circle cx="960" cy="540" r="14" fill="none" stroke="#FAF8F5" stroke-width="3"/>
    <text x="960" y="1000" font-family="sans-serif" font-size="72" fill="#5B7F55" text-anchor="middle">${esc(src)} (absente)</text>
  </svg>`;
  return { buf: await sharp(Buffer.from(svg)).png().toBuffer(), real: false };
}

const px = (r, W, H) => ({ x: (r.x / 100) * W, y: (r.y / 100) * H, w: (r.w / 100) * W, h: (r.h / 100) * H });
function overlay(shot) {
  const rects = [];
  const pairs = shot.bands ? shot.bands.map((b) => [b.start, b.end]) : [[shot.start, shot.end]];
  for (const [a, b] of pairs) {
    if (a) { const r = px(a, TW, TH); rects.push(`<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" fill="none" stroke="#9CC48F" stroke-width="2.5"/>`); }
    if (b) { const r = px(b, TW, TH); rects.push(`<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" fill="none" stroke="#FAF8F5" stroke-width="1.6" stroke-dasharray="6 4"/>`); }
  }
  const p = { x: (shot.poi.x / 100) * TW, y: (shot.poi.y / 100) * TH };
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${TW}" height="${TH}">${rects.join('')}
    <circle cx="${p.x}" cy="${p.y}" r="5" fill="#E0A43A" stroke="#0B1F17" stroke-width="1.5"/></svg>`);
}

async function vertical(shot, full) {
  // image verticale au début du plan (P14 : trois tranches empilées)
  if (shot.bands) {
    const parts = await Promise.all(shot.bands.map(async (b) => {
      const r = px(b.start, 1920, 1080);
      return sharp(full).extract({ left: Math.round(r.x), top: Math.round(r.y), width: Math.round(r.w), height: Math.round(r.h) }).resize(VW, Math.round(TH / 3), { fit: 'fill' }).png().toBuffer();
    }));
    return sharp({ create: { width: VW, height: TH, channels: 3, background: '#000' } })
      .composite(parts.map((input, i) => ({ input, left: 0, top: i * Math.round(TH / 3) }))).png().toBuffer();
  }
  const r = px(shot.start, 1920, 1080);
  return sharp(full).extract({ left: Math.round(r.x), top: Math.round(r.y), width: Math.min(1920 - Math.round(r.x), Math.round(r.w)), height: Math.min(1080 - Math.round(r.y), Math.round(r.h)) })
    .resize(VW, TH, { fit: 'fill' }).png().toBuffer();
}

async function cell(shot) {
  const src = shot.sources[0] || 'code';
  const { buf, real } = await sourceImage(src);
  const tile = await sharp(buf).resize(TW, TH).composite([{ input: overlay(shot) }]).png().toBuffer();
  const vert = await vertical(shot, buf);
  const star = shot.type === 'star' ? ' ★' : '';
  const label = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${CELL_W}" height="${LABEL}">
    <text x="${PAD}" y="18" font-family="sans-serif" font-size="15" font-weight="700" fill="#FAF8F5">${shot.id.toUpperCase()}${star}</text>
    <text x="${PAD + 64}" y="18" font-family="sans-serif" font-size="13" fill="#9CC48F">${esc(shot.sources.join(' → ') || 'code')} · ${shot.frames[0]}–${shot.frames[1]} · ${esc(shot.type)}${real ? '' : ' · mire'}${shot.layout ? ' · ' + esc(shot.layout) : ''}</text></svg>`);
  return sharp({ create: { width: CELL_W, height: CELL_H, channels: 3, background: '#14221B' } })
    .composite([{ input: label, left: 0, top: PAD / 2 }, { input: tile, left: PAD, top: LABEL + PAD }, { input: vert, left: TW + PAD * 2, top: LABEL + PAD }])
    .png().toBuffer();
}

async function main() {
  const crops = JSON.parse(readFileSync(CROPS, 'utf8'));
  const trame = readTrame();
  mkdirSync(OUT, { recursive: true });
  const acts = new Map();
  for (const s of crops.shots) {
    const a = trame.find((t) => t.id === s.id).act;
    if (!acts.has(a.number)) acts.set(a.number, { name: a.name, shots: [] });
    acts.get(a.number).shots.push(s);
  }
  for (const [n, { name, shots }] of acts) {
    const cols = Math.min(3, shots.length), rows = Math.ceil(shots.length / cols);
    const head = 34;
    const cells = await Promise.all(shots.map(cell));
    const title = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${cols * CELL_W}" height="${head}"><text x="${PAD}" y="24" font-family="sans-serif" font-size="20" font-weight="700" fill="#FAF8F5">Acte ${n} — ${esc(name)} · cadres 9:16 provisoires (plein : début, tirets : fin, point : intérêt)</text></svg>`);
    const file = resolve(OUT, `crops-acte-${String(n).padStart(2, '0')}.jpg`);
    await sharp({ create: { width: cols * CELL_W, height: head + rows * CELL_H, channels: 3, background: '#0B1F17' } })
      .composite([{ input: title, left: 0, top: 4 }, ...cells.map((input, i) => ({ input, left: (i % cols) * CELL_W, top: head + Math.floor(i / cols) * CELL_H }))])
      .jpeg({ quality: 82 }).toFile(file);
    console.log(`${file} (${shots.length} plans)`);
  }
}

await main();
