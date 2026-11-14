#!/usr/bin/env node
// Mires d'essai de l'étalonnage (le réseau refuse les banques d'images libres) :
//   - nuancier : rampe de gris en 32 pas + couleurs clés du film (turquoise, forêt, sauge, olive, or, feu, nuit, peaux…)
//   - six « plaques de lumière » synthétiques : aube rose, midi turquoise, heure dorée, feu de nuit, Voie lactée, intérieur ambré.
// Ce ne sont pas des photos : elles servent à mesurer des zones connues, pas à juger le goût.
//   node tools/grade/make-charts.mjs [dossier]   (défaut : grade-lab/samples/mires)
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { hexToRgb } from './lib/color.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(process.argv[2] || resolve(HERE, '../../grade-lab/samples/mires'));
const W = 1920, H = 1080;

export const SWATCHES = [
  ['turquoise', '#3FC1C0'], ['lac profond', '#1E8C8A'], ['forêt', '#17402C'], ['sauge', '#5B7F55'],
  ['olive sac', '#8A9A3A'], ['herbe alpage', '#7FA046'], ['feuillage', '#3E5E2A'], ['pin', '#2E4A2C'],
  ['or', '#E0A43A'], ['feu', '#E2701E'], ['bleu nuit', '#14223F'], ['ciel nuit', '#0A1226'],
  ['peau claire', '#E8B898'], ['peau moyenne', '#C68863'], ['peau mate', '#A86F4C'], ['peau foncée', '#7A4E35'],
  ['bordeaux', '#5E1F2A'], ['bleu encre', '#1E2A44'], ['sable', '#CDB891'], ['roche dolomie', '#D9CFC6'],
  ['encre', '#0B1F17'], ['crème', '#FAF8F5'], ['noir', '#000000'], ['blanc', '#FFFFFF'],
];

let seed = 7;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
const lerp = (a, b, t) => a + (b - a) * t;
const mix = (c1, c2, t) => c1.map((v, i) => lerp(v, c2[i], t));
const H2 = (h) => hexToRgb(h);

function canvas(fn) {
  const buf = Buffer.alloc(W * H * 3);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const c = fn(x, y);
      const i = (y * W + x) * 3;
      buf[i] = Math.round(Math.min(1, Math.max(0, c[0])) * 255);
      buf[i + 1] = Math.round(Math.min(1, Math.max(0, c[1])) * 255);
      buf[i + 2] = Math.round(Math.min(1, Math.max(0, c[2])) * 255);
    }
  return buf;
}
const save = (name, buf) => sharp(buf, { raw: { width: W, height: H, channels: 3 } }).png().toFile(resolve(OUT, name));

// crête de montagne déterministe
const ridge = (x, base, amp, f) => base - amp * (0.55 * Math.abs(Math.sin(x * f)) + 0.3 * Math.abs(Math.sin(x * f * 2.7 + 1.3)) + 0.15 * Math.sin(x * f * 7.1));
const grain = () => (rnd() - 0.5) * 0.02;

function nuancier() {
  return canvas((x, y) => {
    if (y < 216) { const v = Math.floor(x / (W / 32)) / 31; return [v, v, v]; }
    const col = Math.floor(x / (W / 8)), row = Math.floor((y - 216) / 288);
    return H2(SWATCHES[Math.min(SWATCHES.length - 1, row * 8 + col)][1]);
  });
}

const plates = {
  'aube-rose': (x, y) => {
    const sky = mix(H2('#6F7FB0'), H2('#F0B4A8'), y / 600);
    const r1 = ridge(x, 640, 260, 0.004), r2 = ridge(x + 900, 820, 160, 0.006);
    if (y > r2) return mix(H2('#2B3550'), H2('#141C2C'), (y - r2) / 300).map((v) => v + grain());
    if (y > r1) return mix(H2('#E7A9A4'), H2('#8C7D96'), Math.min(1, (y - r1) / 220)).map((v) => v + grain());
    return sky.map((v) => v + grain());
  },
  'midi-lac-turquoise': (x, y) => {
    const r1 = ridge(x, 520, 330, 0.005);
    if (y > 700) return mix(H2('#55D0CB'), H2('#177F80'), (y - 700) / 380).map((v) => v + grain());
    if (y > 640) return H2('#E9E4DC').map((v) => v + grain());
    if (y > r1) return mix(H2('#F2EDE6'), H2('#9A928A'), Math.min(1, (y - r1) / 300)).map((v) => v + grain());
    return mix(H2('#3B79C9'), H2('#A9CBEA'), y / 520).map((v) => v + grain());
  },
  'heure-doree': (x, y) => {
    const sun = Math.exp(-(((x - 520) ** 2 + (y - 380) ** 2) / 16000));
    const r1 = ridge(x, 600, 220, 0.0045);
    if (y > 760) return mix(H2('#C99A3E'), H2('#5C4A22'), (y - 760) / 320).map((v, i) => v + grain() + sun * 0.2);
    if (y > r1) return mix(H2('#7A5A3A'), H2('#3A3020'), (y - r1) / 300).map((v) => v + grain());
    return mix(mix(H2('#E6B866'), H2('#FFF4D8'), sun), H2('#9AA6B8'), Math.max(0, 1 - y / 600) * 0.4).map((v) => v + grain());
  },
  'feu-de-nuit': (x, y) => {
    const fire = Math.exp(-(((x - 960) ** 2) / 9000 + ((y - 760) ** 2) / 22000));
    const glow = Math.exp(-(((x - 960) ** 2 + (y - 700) ** 2) / 180000));
    const base = mix(H2('#03060A'), H2('#0B1018'), y / H);
    const c = mix(base, H2('#7A3410'), glow * 0.8);
    return mix(c, H2('#FFB050'), fire).map((v) => v + grain());
  },
  'voie-lactee': (x, y) => {
    const band = Math.exp(-(((y - (900 - x * 0.45)) ** 2) / 26000));
    const r = rnd();
    const star = r > 0.9985 ? 0.9 : r > 0.992 ? 0.35 : 0;
    const sky = mix(H2('#05080F'), H2('#14223F'), y / H);
    let c = mix(sky, H2('#6A6A78'), band * 0.35).map((v) => v + star + band * 0.05 * rnd());
    if (y > ridge(x, 900, 160, 0.006)) c = H2('#04070A').map((v) => v + grain() * 0.3);
    return c;
  },
  'interieur-ambre': (x, y) => {
    const lamp = Math.exp(-(((x - 1450) ** 2 + (y - 300) ** 2) / 120000));
    const win = x < 520 && y > 150 && y < 820 ? 1 : 0;
    let c = mix(H2('#2A1E14'), H2('#E9D8BC'), lamp * 0.9);
    if (win) c = mix(H2('#22344F'), H2('#5A7194'), (820 - y) / 670);
    if (y > 860) c = mix(H2('#8E6A3E'), H2('#4A3520'), (y - 860) / 220);
    return c.map((v) => v + grain());
  },
};

mkdirSync(OUT, { recursive: true });
await save('nuancier.png', nuancier());
for (const [name, fn] of Object.entries(plates)) { seed = 7; await save(`${name}.png`, canvas(fn)); }
console.log(`mires écrites dans ${OUT}`);
