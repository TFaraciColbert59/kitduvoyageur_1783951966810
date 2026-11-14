#!/usr/bin/env node
// Planches d'acte à partir d'images RENDUES (et non des sources) :
//   node tools/crops/sheet.mjs frames169 <dossier snapshots 16:9> <sortie-dir>
//     -> une planche par acte : l'image 16:9 du milieu de chaque plan, cadre 9:16 au milieu du plan (moyenne
//        start/end) en trait sauge, cadres start (plein crème fin) et end (tirets), bandes d'interface en rouge.
//   node tools/crops/sheet.mjs frames916 <dossier snapshots 9:16> <sortie-dir>
//     -> une planche verticale par acte (une image par plan, au milieu du plan), JPEG < 300 Ko.
// Les snapshots sont ceux de `hyperframes snapshot --at <milieux>` (frame-NN-at-*.png, dans l'ordre des plans).
import sharp from 'sharp';
import { readFileSync, readdirSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const FILM = resolve(HERE, '../../film');
const [mode, dir, out] = process.argv.slice(2);
const { shots } = JSON.parse(readFileSync(resolve(FILM, 'shots.json'), 'utf8'));
const crops = Object.fromEntries(JSON.parse(readFileSync(resolve(FILM, 'crops.json'), 'utf8')).shots.map((s) => [s.id, s]));
const files = readdirSync(dir).filter((f) => /^frame-\d+-at-.*\.png$/.test(f)).sort();
if (files.length !== shots.length) throw new Error(`${files.length} images pour ${shots.length} plans`);
mkdirSync(out, { recursive: true });
const acts = [...new Set(shots.map((s) => s.act.number))];
const mid = (a, b) => (b ? { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, w: (a.w + b.w) / 2, h: (a.h + b.h) / 2 } : a);

for (const act of acts) {
  const list = shots.map((s, i) => ({ s, f: resolve(dir, files[i]) })).filter((o) => o.s.act.number === act);
  const tiles = [];
  if (mode === 'frames169') {
    const TW = 640, TH = 360, L = 28;
    for (const { s, f } of list) {
      const c = crops[s.id];
      const rect = (r, extra) => r ? `<rect x="${(r.x / 100) * TW}" y="${(r.y / 100) * TH}" width="${(r.w / 100) * TW}" height="${(r.h / 100) * TH}" fill="none" ${extra}/>` : '';
      const m = c.start ? mid(c.start, c.end) : null;
      // bandes d'interface des plateformes, ramenées dans l'image 16:9 au milieu du plan (haut 168 px, bas > 1330 px)
      const ui = m ? `<rect x="${(m.x / 100) * TW}" y="${(m.y / 100) * TH}" width="${(m.w / 100) * TW}" height="${(m.h / 100) * TH * 168 / 1920}" fill="rgba(200,40,40,0.25)"/>
        <rect x="${(m.x / 100) * TW}" y="${((m.y + m.h * 1330 / 1920) / 100) * TH}" width="${(m.w / 100) * TW}" height="${(m.h / 100) * TH * 590 / 1920}" fill="rgba(200,40,40,0.25)"/>` : '';
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${TW}" height="${TH + L}"><rect y="${TH}" width="${TW}" height="${L}" fill="#0B1F17"/>
        ${ui}${rect(c.start, 'stroke="#FAF8F5" stroke-width="1.5"')}${rect(c.end, 'stroke="#FAF8F5" stroke-width="1.5" stroke-dasharray="6 4"')}${rect(m, 'stroke="#7FD06F" stroke-width="3"')}
        <text x="8" y="${TH + 20}" font-family="sans-serif" font-size="18" fill="#FAF8F5">${s.id} · ${c.type}${c.layout ? ' · ' + c.layout : ''}</text></svg>`;
      const base = await sharp(f).resize(TW, TH).extend({ bottom: L, background: '#0B1F17' }).png().toBuffer();
      tiles.push(await sharp(base).composite([{ input: Buffer.from(svg) }]).png().toBuffer());
    }
    const cols = 3, rows = Math.ceil(tiles.length / cols), W = 640, H = 388;
    await sharp({ create: { width: cols * W, height: rows * H, channels: 3, background: '#0B1F17' } })
      .composite(tiles.map((t, i) => ({ input: t, left: (i % cols) * W, top: Math.floor(i / cols) * H })))
      .jpeg({ quality: 70 }).toFile(resolve(out, `planche169-acte-${String(act).padStart(2, '0')}.jpg`));
  } else {
    const TW = 216, TH = 384, L = 22;
    for (const { s, f } of list) {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${TW}" height="${TH + L}"><rect y="${TH}" width="${TW}" height="${L}" fill="#0B1F17"/>
        <text x="6" y="${TH + 16}" font-family="sans-serif" font-size="14" fill="#FAF8F5">${s.id}</text></svg>`;
      const base = await sharp(f).resize(TW, TH).extend({ bottom: L, background: '#0B1F17' }).png().toBuffer();
      tiles.push(await sharp(base).composite([{ input: Buffer.from(svg) }]).png().toBuffer());
    }
    const W = 216 + 6, H = 406;
    await sharp({ create: { width: tiles.length * W, height: H, channels: 3, background: '#0B1F17' } })
      .composite(tiles.map((t, i) => ({ input: t, left: i * W, top: 0 })))
      .jpeg({ quality: 72 }).toFile(resolve(out, `acte-${String(act).padStart(2, '0')}.jpg`));
  }
}
console.log(`${acts.length} planches (${mode}) dans ${out}`);
