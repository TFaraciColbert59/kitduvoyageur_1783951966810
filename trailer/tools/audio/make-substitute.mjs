#!/usr/bin/env node
// FICHIER DE SUBSTITUTION — ce n'est PAS la musique du trailer.
// Fabrique un faux « morceau » de 173,5 s (44,1 kHz, stéréo) avec la même grille de temps que STORM II
// (storm-ii.beats.json) et les mêmes sections (niveaux de MUSIQUE.md), une grosse caisse sur chaque temps,
// des nappes d'accords différentes selon la section, puis le passe dans la VRAIE commande de montage.
// Le montage obtenu est ramené à −6,9 LUFS intégrés (comme le master réel), pour éprouver la chaîne.
// Sorties (non versionnées) : qa/tmp/storm-ii-SUBSTITUT.wav, qa/tmp/montage-SUBSTITUT.wav
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { AUDIO_DIR, QA_TMP, SUBST_MONTAGE, loudness, run } from './lib.mjs';
import { buildMontage } from './build-montage.mjs';
import { add, expDecay, mulEnv, pink, rng, sine, svf, white } from './synth.mjs';

const SRC_SR = 44100;
const DUR = 173.5;
export const SUBST_SOURCE = join(QA_TMP, 'storm-ii-SUBSTITUT.wav');

// Sections de MUSIQUE.md : [début, fin, niveau visé en dB, accords (classes de hauteur), densité].
const SECTIONS = [
  [0, 11, -24, [[9, 0, 4]], 0.2],
  [11, 71.495, -14, [[9, 0, 4], [5, 9, 0], [0, 4, 7], [7, 11, 2]], 0.5],
  [71.495, 99.565, -8, [[9, 0, 4], [5, 9, 0], [0, 4, 7], [7, 11, 2]], 1],
  [99.565, 113.5, -14, [[2, 5, 9], [9, 0, 4]], 0.3],
  [113.5, 127.545, -10, [[2, 5, 9], [9, 0, 4], [4, 8, 11], [9, 0, 4]], 0.7],
  [127.545, 155.555, -8, [[0, 4, 7], [7, 11, 2], [9, 0, 4], [5, 9, 0]], 1],
  [155.555, 168, -18, [[9, 0, 4]], 0.25],
  [168, 173.5, -30, [[9, 0, 4]], 0.1],
];

function synthSource(gainDb) {
  const n = Math.round(DUR * SRC_SR);
  const L = new Float32Array(n), R = new Float32Array(n);
  const { beatTimes } = JSON.parse(readFileSync(join(AUDIO_DIR, 'storm-ii.beats.json'), 'utf8'));
  const sec = (t) => SECTIONS.find((s) => t >= s[0] && t < s[1]) ?? SECTIONS[SECTIONS.length - 1];
  const g = (db) => Math.pow(10, db / 20);
  const r = rng(7);
  // Nappes : un accord par mesure (premiers temps = indices % 4 == 3).
  const downbeats = beatTimes.filter((_, i) => i % 4 === 3);
  const bars = [0, ...downbeats, DUR];
  let barIndex = 0;
  for (let b = 0; b < bars.length - 1; b++) {
    const t0 = bars[b], t1 = bars[b + 1];
    const s = sec(t0 + 0.01);
    const chord = s[3][barIndex++ % s[3].length];
    const m = Math.round((t1 - t0) * SRC_SR), at = Math.round(t0 * SRC_SR);
    for (const [k, pc] of chord.entries()) {
      const f = 220 * Math.pow(2, ((pc - 9 + 12) % 12) / 12) * (k === 0 ? 0.5 : 1);
      const x = sine(m, f, f, 1, r() * 6);
      for (let i = 0; i < m && at + i < n; i++) {
        const env = Math.min(1, i / 2000, (m - i) / 2000);
        L[at + i] += x[i] * env * g(s[2]) * 0.18; R[at + i] += x[i] * env * g(s[2]) * 0.16;
      }
    }
  }
  // Grosse caisse sur chaque temps, charleston entre deux temps (dans les sections denses).
  const kickLen = Math.round(0.2 * SRC_SR);
  beatTimes.forEach((t, i) => {
    const s = sec(t);
    const kick = new Float32Array(kickLen);
    const sw = sine(kickLen, 120, 42, 0.3);
    for (let j = 0; j < kickLen; j++) kick[j] = sw[j] * Math.exp(-j / (0.06 * SRC_SR));
    const at = Math.round(t * SRC_SR);
    add(L, kick, at, g(s[2]) * 0.9); add(R, kick, at, g(s[2]) * 0.9);
    if (s[4] >= 0.7 && i + 1 < beatTimes.length) {
      const hh = mulEnv(svf(white(Math.round(0.05 * SRC_SR), 1000 + i), 'hp', 6000, 0.7), expDecay(0.012, 0.0005));
      const mid = Math.round(((t + beatTimes[i + 1]) / 2) * SRC_SR);
      add(L, hh, mid, g(s[2]) * 0.35); add(R, hh, mid, g(s[2]) * 0.3);
    }
  });
  // Lit de bruit rose mis en forme, à densité de section.
  const bed = svf(pink(n, 3), 'lp', 5000, 0.7);
  for (let i = 0; i < n; i++) {
    const s = sec(i / SRC_SR);
    const v = bed[i] * g(s[2]) * 0.4 * s[4];
    L[i] += v; R[i] += v * 0.95;
  }
  const out = new Float32Array(2 * n), gg = g(gainDb);
  for (let i = 0; i < n; i++) { out[2 * i] = L[i] * gg; out[2 * i + 1] = R[i] * gg; }
  const buf = Buffer.from(out.buffer);
  run('ffmpeg', ['-v', 'error', '-y', '-f', 'f32le', '-ar', String(SRC_SR), '-ac', '2', '-i', '-',
    '-af', 'alimiter=limit=0.95:level=false', '-c:a', 'pcm_s24le', SUBST_SOURCE], { input: buf });
}

export function makeSubstitute(target = -6.9) {
  let gain = 6;
  let last;
  for (let k = 0; k < 7; k++) {
    synthSource(gain);
    buildMontage(SUBST_SOURCE, SUBST_MONTAGE);
    last = loudness(SUBST_MONTAGE);
    if (Math.abs(last.integrated - target) <= 0.3) break;
    gain += target - last.integrated;
  }
  return { source: SUBST_SOURCE, montage: SUBST_MONTAGE, gainDb: gain, ...last };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const r = makeSubstitute();
  console.log(`✓ SUBSTITUT ${r.montage} : ${r.integrated} LUFS intégrés, crête vraie ${r.truePeak} dBTP (source ${r.source}, gain ${r.gainDb.toFixed(2)} dB)`);
}
