#!/usr/bin/env node
// Habillage v4 : les trois sons de habillageV4Cues() (lib.mjs) posés sur 60,000 s → qa/tmp/habillage-v4-brut.wav
// (stéréo au centre, flottant 32 bits, gain final appliqué au mixage). Rien d'autre (les coupes image ne sont pas fixées).
// Usage : node tools/audio/build-habillage-v4.mjs
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { HABILLAGE_V4_RAW, QA_TMP, SFX_DIR, SR, habillageV4Cues, probe, run } from './lib.mjs';

export function buildHabillageV4(out = HABILLAGE_V4_RAW) {
  mkdirSync(QA_TMP, { recursive: true });
  const cues = habillageV4Cues();
  const inputs = [], parts = [];
  cues.forEach((c, i) => {
    const f = join(SFX_DIR, c.file);
    if (!existsSync(f)) throw new Error(`effet absent : ${f} (node tools/audio/gen-sfx.mjs ${c.file.replace('.wav', '')})`);
    inputs.push('-i', f);
    parts.push(`[${i}:a]aformat=sample_fmts=fltp:channel_layouts=mono,volume=${c.gainDb}dB,adelay=delays=${Math.round(c.at * SR)}S:all=1[c${i}]`);
  });
  const graph = `${parts.join(';')};${cues.map((_, i) => `[c${i}]`).join('')}amix=inputs=${cues.length}:normalize=0:duration=longest,` +
    `pan=stereo|c0=c0|c1=c0,apad=whole_dur=60,atrim=end_sample=${SR * 60}[o]`;
  run('ffmpeg', ['-hide_banner', '-v', 'error', '-y', ...inputs, '-filter_complex', graph, '-map', '[o]', '-ar', String(SR), '-c:a', 'pcm_f32le', out]);
  const p = probe(out);
  if (p.samples !== SR * 60) throw new Error(`habillage : ${p.samples} échantillons`);
  return { out, cues, ...p };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const r = buildHabillageV4();
  console.log(`✓ ${r.out} · ${r.samples} échantillons\n${r.cues.map((c) => `  ${c.at.toFixed(3)} s (image ${(c.at * 24).toFixed(1)}) ${c.file} ${c.gainDb} dB — ${c.cause}`).join('\n')}`);
}
