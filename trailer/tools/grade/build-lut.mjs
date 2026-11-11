#!/usr/bin/env node
// LUT commune du trailer LKDV (bible §8) : couleurs réelles, étalonnage léger.
//   node tools/grade/build-lut.mjs                      -> film/assets/luts/lkdv-trailer.cube (33³, force 1)
//   node tools/grade/build-lut.mjs --strength 1.3 --out grade-lab/assets/luts/lkdv-trailer-130.cube
//   node tools/grade/build-lut.mjs --print              -> écrit aussi ce que deviennent les couleurs clés
// Entrée et sortie en sRGB encodé (Rec.709/SDR, ce que lit le moteur de HyperFrames).
// Ordre des opérations : courbe -> retenue des verts -> pied (noirs encre) -> épaule (blancs crème).
// Les opérations de teinte se font en Oklab ; le pied et l'épaule ne teintent que les tons quasi neutres,
// et jamais les peaux ni le bleu nuit (qui ne reçoivent que la remontée de luminance).

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  clamp01, smoothstep, hexToRgb, rgbToHex, srgbToOklab, oklabToSrgb, oklabToLch, lchToOklab,
  hueDiff, hueWindow,
} from './lib/color.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

// ---------- Paramètres lisibles (force 1 = « 100 % ») ----------
export const PARAMS = {
  size: 33,
  // Point noir : les noirs vont vers l'encre verte, sans jamais être purs.
  blackPoint: '#0B1F17',
  blackMix: 0.7,        // part du chemin vers l'encre parcourue par un noir pur (0..1)
  toeEnd: 0.24,         // Oklab L où le pied s'éteint (au-delà, les ombres ne bougent plus)
  // Point blanc : les blancs vont vers la crème, en douceur.
  whitePoint: '#FAF8F5',
  whiteMix: 0.85,       // part du chemin vers la crème parcourue par un blanc pur
  shoulderStart: 0.78,  // Oklab L où l'épaule commence
  // Courbe : un S très doux autour du gris moyen (0 = droite).
  contrast: 0.06,
  pivot: 0.5,
  // Retenue des verts : moins de chroma et un pas vers la teinte du sauge.
  sage: '#5B7F55',
  greenCenter: 145,     // teinte Oklch du centre de la fenêtre (verts francs, feuillage)
  greenHalfWidth: 32,   // l'olive du sac (118°) et le turquoise (194°) restent hors fenêtre ou presque
  greenChromaCut: 0.14, // -14 % de chroma au centre de la fenêtre
  greenHueToSage: 0.25, // 25 % du chemin vers la teinte du sauge
  // Teinte des noirs et des blancs réservée aux tons quasi neutres (chroma Oklch).
  neutralChroma: [0.02, 0.08],
  // Protections : teintes que le pied et l'épaule ne colorent pas.
  skinHue: 55, skinHalfWidth: 32, skinProtect: 1,
  nightHue: 262, nightHalfWidth: 45, nightProtect: 1,
};

const cut = (x) => Math.min(1, Math.max(0, x));

export function makeTransform(strength = 1, p = PARAMS) {
  const s = strength;
  const ink = srgbToOklab(hexToRgb(p.blackPoint));
  const cream = srgbToOklab(hexToRgb(p.whitePoint));
  const sageHue = oklabToLch(srgbToOklab(hexToRgb(p.sage)))[2];
  const blackMix = cut(p.blackMix * s), whiteMix = Math.min(0.95, p.whiteMix * s);
  const k = p.contrast * s, chromaCut = cut(p.greenChromaCut * s), toSage = cut(p.greenHueToSage * s);

  return function transform(rgb) {
    let [L, C, h] = oklabToLch(srgbToOklab(rgb));
    // 1. courbe (S cubique, extrémités fixes)
    L = L + k * 4 * L * (1 - L) * (L - p.pivot);
    // 2. retenue des verts
    const chromaGate = smoothstep(0.015, 0.05, C);
    const wg = hueWindow(h, p.greenCenter, p.greenHalfWidth) * chromaGate;
    C = C * (1 - chromaCut * wg);
    h = h + hueDiff(sageHue, h) * toSage * wg;
    let [, a, b] = lchToOklab([L, C, h]);
    // protections communes au pied et à l'épaule
    const neutral = 1 - smoothstep(p.neutralChroma[0], p.neutralChroma[1], C);
    const protect = Math.max(
      p.skinProtect * hueWindow(h, p.skinHue, p.skinHalfWidth) * smoothstep(0.02, 0.05, C),
      p.nightProtect * hueWindow(h, p.nightHue, p.nightHalfWidth) * smoothstep(0.015, 0.04, C),
    );
    const tintGate = neutral * (1 - protect);
    // 3. pied : remontée de luminance (monotone : la pente reste > 0 car toeEnd >= 1,8 x la remontée),
    //    teinte vers l'encre sur les seuls tons neutres
    const lift = blackMix * ink[0];
    const toeEnd = Math.max(p.toeEnd, 1.8 * lift);
    const fall = 1 - smoothstep(0, toeEnd, L);
    const wt = blackMix * fall * fall;
    L = L + lift * fall;
    a = a + (ink[1] - a) * wt * tintGate;
    b = b + (ink[2] - b) * wt * tintGate;
    // 4. épaule : les blancs roulent vers la crème
    const ws = whiteMix * smoothstep(p.shoulderStart, 1, L) ** 2;
    if (L > cream[0]) L = L + (cream[0] - L) * ws;
    const hiGate = (1 - smoothstep(0.03, 0.09, Math.hypot(a, b))) * (1 - protect);
    a = a + (cream[1] - a) * ws * hiGate;
    b = b + (cream[2] - b) * ws * hiGate;
    return oklabToSrgb([L, a, b]).map(clamp01);
  };
}

export function buildTable(strength = 1, p = PARAMS) {
  const t = makeTransform(strength, p);
  const n = p.size, out = new Float64Array(n ** 3 * 3);
  let i = 0;
  for (let bi = 0; bi < n; bi++)
    for (let gi = 0; gi < n; gi++)
      for (let ri = 0; ri < n; ri++) {
        const v = t([ri / (n - 1), gi / (n - 1), bi / (n - 1)]);
        out[i++] = v[0]; out[i++] = v[1]; out[i++] = v[2];
      }
  return out;
}

export function toCube(table, size, strength) {
  const lines = [
    `TITLE "LKDV trailer common grade (strength ${strength})"`,
    `# Genere par trailer/tools/grade/build-lut.mjs - ne pas editer a la main.`,
    `# Noirs vers ${PARAMS.blackPoint}, blancs vers ${PARAMS.whitePoint}, verts retenus vers le sauge, peaux et bleu nuit proteges.`,
    `LUT_3D_SIZE ${size}`,
    'DOMAIN_MIN 0.0 0.0 0.0',
    'DOMAIN_MAX 1.0 1.0 1.0',
  ];
  for (let i = 0; i < table.length; i += 3)
    lines.push(`${table[i].toFixed(6)} ${table[i + 1].toFixed(6)} ${table[i + 2].toFixed(6)}`);
  return lines.join('\n') + '\n';
}

export const KEY_COLORS = {
  'noir pur': '#000000', 'encre (cible)': '#0B1F17', 'gris 18 %': '#767676', 'blanc pur': '#FFFFFF',
  'crème (cible)': '#FAF8F5', 'forêt #17402C': '#17402C', 'sauge #5B7F55': '#5B7F55', 'olive sac #8A9A3A': '#8A9A3A',
  'herbe d\'alpage': '#7FA046', 'feuillage': '#3E5E2A', 'turquoise lac': '#3FC1C0', 'or': '#E0A43A',
  'orange du feu': '#E2701E', 'bleu nuit': '#14223F', 'ciel nuit profond': '#0A1226', 'peau claire': '#E8B898',
  'peau moyenne': '#C68863', 'peau foncée': '#7A4E35',
};

function main(argv) {
  const arg = (name, def) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : def; };
  const strength = Number(arg('--strength', '1'));
  const size = Number(arg('--size', String(PARAMS.size)));
  const out = resolve(arg('--out', resolve(HERE, '../../film/assets/luts/lkdv-trailer.cube')));
  const p = { ...PARAMS, size };
  const table = buildTable(strength, p);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, toCube(table, size, strength));
  console.log(`écrit ${out} (${size}³, force ${strength})`);
  if (argv.includes('--print')) {
    const t = makeTransform(strength, p);
    for (const [name, hex] of Object.entries(KEY_COLORS)) console.log(`${name.padEnd(20)} ${hex} -> ${rgbToHex(t(hexToRgb(hex)))}`);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main(process.argv.slice(2));
