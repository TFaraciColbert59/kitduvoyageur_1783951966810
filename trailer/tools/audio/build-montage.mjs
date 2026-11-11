#!/usr/bin/env node
// Montage musical de 60 s : applique à l'identique la commande FFmpeg de MUSIQUE.md,
// puis vérifie 48 kHz, 24 bits, exactement 2 880 000 échantillons (60,000 s).
// Usage : node tools/audio/build-montage.mjs                    (storm-ii.mp3 → storm-ii-montage-60s.wav)
//         node tools/audio/build-montage.mjs --input X --out Y  (essai sur un fichier de substitution)
import { existsSync } from 'node:fs';
import { DURATION, MONTAGE, MONTAGE_FILTER, MP3, SR, ffmpegVersion, probe, run } from './lib.mjs';

export function buildMontage(input = MP3, out = MONTAGE) {
  if (!existsSync(input)) {
    const err = new Error(
      `MP3 absent : ${input}\n` +
      '  STORM II (GENER8ION) est un titre commercial, non versionné et jamais téléchargé par les agents.\n' +
      '  Déposez le fichier fourni par Tony à cet emplacement, puis relancez : node tools/audio/build-all.mjs');
    err.code = 'NO_MP3';
    throw err;
  }
  run('ffmpeg', ['-hide_banner', '-v', 'error', '-y', '-i', input, '-filter_complex', MONTAGE_FILTER,
    '-map', '[o]', '-ar', String(SR), '-c:a', 'pcm_s24le', out]);
  const p = probe(out);
  const expected = SR * DURATION;
  const problems = [];
  if (p.sampleRate !== SR) problems.push(`fréquence ${p.sampleRate} Hz au lieu de ${SR}`);
  if (p.codec !== 'pcm_s24le') problems.push(`codec ${p.codec} au lieu de pcm_s24le`);
  if (p.samples !== expected) problems.push(`${p.samples} échantillons au lieu de ${expected} (${p.duration} s)`);
  if (problems.length) throw new Error(`Montage non conforme (${out}) : ${problems.join(' ; ')}`);
  return { out, ...p, ffmpeg: ffmpegVersion() };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : undefined; };
  try {
    const r = buildMontage(arg('--input') ?? MP3, arg('--out') ?? MONTAGE);
    console.log(`✓ ${r.out}\n  ${r.samples} échantillons = ${(r.samples / r.sampleRate).toFixed(6)} s · ${r.sampleRate} Hz · ${r.codec} · ${r.channels} canaux · ${r.ffmpeg}`);
  } catch (e) {
    console.error(`✗ ${e.message}`);
    process.exit(e.code === 'NO_MP3' ? 2 : 1);
  }
}
