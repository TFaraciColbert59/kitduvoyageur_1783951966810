#!/usr/bin/env node
// Piste d'effets : sfx-cues.json → qa/sfx-v1.wav (60,000 s, 48 kHz, mono, flottant 32 bits pour ne rien écrêter
// avant le mixage). Le pic de chaque fichier tombe une image après son image (frame + 1).
// Les gains visent `overBedDb` au-dessus du lit (RMS 100 ms autour du pic, passe-haut 120 Hz).
// Usage : node tools/audio/build-sfx.mjs [--bed montage.wav] [--out qa/sfx-v1.wav] [--report qa/tmp/sfx-placements.json]
// Sans --bed : montage réel s'il existe, sinon le montage de SUBSTITUTION (dit dans la sortie).
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { FPS, HERE, MONTAGE, QA_DIR, QA_TMP, SFX_DIR, SR, SUBST_MONTAGE, TOTAL_FRAMES, fmt, readMono, rmsDb } from './lib.mjs';
import { svf, writeWav } from './synth.mjs';

const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : undefined; };

export function loadCues() {
  const j = JSON.parse(readFileSync(join(HERE, 'sfx-cues.json'), 'utf8'));
  const problems = [];
  let lastWhoosh = null;
  const sorted = [...j.cues].sort((a, b) => a.frame - b.frame);
  for (const c of sorted) {
    if (!existsSync(join(SFX_DIR, c.file))) problems.push(`fichier absent : ${c.file}`);
    if (!(c.frame >= 0 && c.frame < TOTAL_FRAMES)) problems.push(`image hors film : ${c.frame}`);
    if (!c.cause?.trim()) problems.push(`cause manquante : ${c.file} @ ${c.frame}`);
    if (c.file.startsWith('whoosh')) {
      if (c.file === lastWhoosh) problems.push(`même whoosh deux fois de suite : ${c.file} @ ${c.frame}`);
      lastWhoosh = c.file;
    }
  }
  if (problems.length) throw new Error(problems.join('\n'));
  return sorted;
}

// Pic d'un signal : maximum de l'enveloppe RMS sur 5 ms.
export function peakOf(x, from = 0, to = x.length) {
  const win = Math.round(SR * 0.005);
  let best = -1, at = from;
  for (let i = Math.max(0, from); i + win <= Math.min(x.length, to); i += Math.round(win / 2)) {
    let s = 0;
    for (let k = i; k < i + win; k++) s += x[k] * x[k];
    if (s > best) { best = s; at = i + win / 2; }
  }
  return at;
}

// Demi-fenêtre de mesure d'un effet ponctuel autour de son pic (50 ms en tout : un clac dure 10 à 30 ms).
export const HALF = 0.025;
// Gain plafond d'un effet (au-delà, le limiteur du mixage écraserait le transitoire et pomperait le lit).
export const MAX_GAIN_DB = 24;
const win = (x, a, b) => x.subarray(Math.max(0, Math.round(a)), Math.min(x.length, Math.round(b)));

export function buildSfx({ bed, out = join(QA_DIR, 'sfx-v1.wav'), report = join(QA_TMP, 'sfx-placements.json') } = {}) {
  const cues = loadCues();
  const bedHp = bed ? svf(readMono(bed), 'hp', 120, 0.7) : null;
  const N = SR * 60;
  const track = new Float32Array(N);
  const placed = [];
  for (const c of cues) {
    let x = readMono(join(SFX_DIR, c.file));
    const peakFile = peakOf(x) / SR;
    let start = c.align === 'peak' ? (c.frame + 1) / FPS - peakFile : c.frame / FPS;
    let cutHead = 0;
    if (start < 0) { cutHead = -start; start = 0; }
    if (cutHead) x = x.subarray(Math.round(cutHead * SR));
    if (c.until != null) {
      const maxLen = Math.max(0, Math.round((c.until / FPS - start) * SR));
      if (x.length > maxLen) {
        x = Float32Array.from(x.subarray(0, maxLen));
        const f = Math.min(x.length, Math.round(0.15 * SR));
        for (let i = 0; i < f; i++) x[x.length - 1 - i] *= i / f;
      }
    }
    const s0 = Math.round(start * SR);
    const xHp = svf(x, 'hp', 120, 0.7);
    let gainDb = c.gainDb ?? 0, sfxDb = null, bedDb = null;
    if (bedHp) {
      if (c.align === 'peak') {
        const p = peakOf(x);
        // Fenêtre complète de 50 ms même si le pic est au tout début du fichier (zéros avant).
        const w = win(xHp, p - HALF * SR, p + HALF * SR);
        sfxDb = rmsDb(w) + 10 * Math.log10(w.length / Math.round(2 * HALF * SR));
        bedDb = rmsDb(win(bedHp, s0 + p - HALF * SR, s0 + p + HALF * SR));
      } else {
        sfxDb = rmsDb(xHp);
        bedDb = rmsDb(win(bedHp, s0, s0 + x.length));
      }
      gainDb = Math.min(MAX_GAIN_DB, c.overBedDb - (sfxDb - bedDb));
    }
    const g = Math.pow(10, gainDb / 20);
    for (let i = 0; i < x.length && s0 + i < N; i++) track[s0 + i] += x[i] * g;
    // Pic remesuré sur le signal tel qu'il est posé (après rognage éventuel) : image réelle du pic.
    const measuredPeakSec = (s0 + peakOf(x)) / SR;
    placed.push({ ...c, startSec: start, peakInFileSec: peakFile, targetPeakSec: c.align === 'peak' ? (c.frame + 1) / FPS : null,
      measuredPeakSec, measuredPeakFrame: measuredPeakSec * FPS,
      peakErrorFrames: c.align === 'peak' ? measuredPeakSec * FPS - (c.frame + 1) : null,
      gainDb, sfxRmsDb: sfxDb, bedRmsDb: bedDb, s0, len: x.length });
  }
  // Niveau au-dessus du lit sur la piste SOMMÉE (les effets superposés comptent ensemble), 50 ms autour du pic.
  if (bedHp) {
    for (const p of placed) {
      if (p.align !== 'peak') continue;
      const t = Math.round(p.measuredPeakSec * SR), m = Math.round(0.3 * SR);
      const trHp = svf(win(track, t - m, t + m), 'hp', 120, 0.7);
      p.overBedMeasuredDb = rmsDb(trHp.subarray(m - HALF * SR, m + HALF * SR)) - rmsDb(win(bedHp, t - HALF * SR, t + HALF * SR));
    }
  }
  writeWav(out, track, { codec: 'pcm_f32le' }); // flottant : les sommets au-delà de 0 dBFS ne sont pas écrêtés
  const meta = { out, bed: bed ?? null, substitute: bed === SUBST_MONTAGE, cues: placed.map(({ s0, len, ...r }) => r) };
  writeFileSync(report, JSON.stringify(meta, null, 2));
  return meta;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  let bed = arg('--bed');
  if (!bed) bed = existsSync(MONTAGE) ? MONTAGE : existsSync(SUBST_MONTAGE) ? SUBST_MONTAGE : undefined;
  try {
    const r = buildSfx({ bed, out: arg('--out'), report: arg('--report') });
    console.log(`✓ ${r.out} · ${r.cues.length} effets · lit de mesure : ${bed ? (r.substitute ? 'SUBSTITUT ' : 'RÉEL ') + bed : 'aucun (gains de repli)'}`);
    console.log('| Image | Plan | Fichier | Pic dans le fichier (s) | Pic mesuré (image) | Écart (images) | Gain (dB) | Au-dessus du lit (dB) |');
    console.log('|---|---|---|---|---|---|---|---|');
    for (const c of r.cues) {
      console.log(`| ${c.frame} | ${c.plan} | ${c.file} | ${fmt(c.peakInFileSec, 3)} | ${c.measuredPeakFrame != null ? fmt(c.measuredPeakFrame, 1) : 'début ' + fmt(c.startSec * FPS, 0)} | ${c.peakErrorFrames != null ? fmt(c.peakErrorFrames, 2) : '—'} | ${fmt(c.gainDb, 1)} | ${c.overBedMeasuredDb != null ? fmt(c.overBedMeasuredDb, 1) : c.bedRmsDb != null ? fmt(c.sfxRmsDb + c.gainDb - c.bedRmsDb, 1) + ' (ambiance)' : '—'} |`);
    }
  } catch (e) {
    console.error(`✗ ${e.message}`);
    process.exit(1);
  }
}
