#!/usr/bin/env node
// Import des vraies prises CC0 (Kenney, dépôts officiels github.com/KenneyNL) → assets/audio/sfx/
// Les dépôts sont clonés ailleurs (données non fiables, hors du dépôt) puis passés en argument :
//   git clone --depth 1 https://github.com/KenneyNL/Starter-Kit-FPS.git <dir>/k-Starter-Kit-FPS
//   git clone --depth 1 https://github.com/KenneyNL/Starter-Kit-3D-Platformer.git <dir>/k-Starter-Kit-3D-Platformer
//   node tools/audio/import-cc0.mjs <dir>
// Conversion : rognage, mono, 48 kHz, 24 bits, crête échantillon ramenée à −3 dBFS (deux passes FFmpeg).
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { SFX_DIR, run } from './lib.mjs';

export const IMPORTS = [
  { out: 'pas-sentier-a', repo: 'Starter-Kit-FPS', commit: '185fd2326d74a5cf858cffc616f87cf9696f9cc0', file: 'sounds/walking.ogg', ss: 2.4, t: 0.8 },
  { out: 'pas-sentier-b', repo: 'Starter-Kit-FPS', commit: '185fd2326d74a5cf858cffc616f87cf9696f9cc0', file: 'sounds/walking.ogg', ss: 3.6, t: 0.8 },
  { out: 'clac-boucle-a', repo: 'Starter-Kit-FPS', commit: '185fd2326d74a5cf858cffc616f87cf9696f9cc0', file: 'sounds/weapon_change.ogg', ss: 0.24, t: 0.18 },
  { out: 'pied-pierre', repo: 'Starter-Kit-3D-Platformer', commit: '3fa8a04b1c01ab23db43123d4ce814a34c3fc7f0', file: 'sounds/land.ogg', ss: 0, t: 0.06 },
];

export function importCommand(src, it, gainDb) {
  return ['-v', 'error', '-y', '-ss', String(it.ss), '-t', String(it.t), '-i', src,
    '-af', `aformat=channel_layouts=mono,aresample=48000,volume=${gainDb.toFixed(2)}dB,afade=t=out:st=${(it.t - 0.012).toFixed(3)}:d=0.012`,
    '-c:a', 'pcm_s24le', join(SFX_DIR, `${it.out}.wav`)];
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const dir = process.argv[2];
  if (!dir) { console.error('Usage : node tools/audio/import-cc0.mjs <dossier des clones Kenney>'); process.exit(2); }
  for (const it of IMPORTS) {
    const src = join(dir, `k-${it.repo}`, it.file);
    if (!existsSync(src)) { console.error(`✗ absent : ${src}`); process.exit(1); }
    const vd = run('ffmpeg', ['-hide_banner', '-ss', String(it.ss), '-t', String(it.t), '-i', src, '-af', 'aformat=channel_layouts=mono,aresample=48000,volumedetect', '-f', 'null', '-']).stderr;
    const max = Number(vd.match(/max_volume:\s*(-?[\d.]+) dB/)[1]);
    let gain = -3 - max;
    let args = importCommand(src, it, gain);
    run('ffmpeg', args);
    // Seconde passe : volumedetect plafonne à 0 dB une source qui dépasse ; on corrige sur le fichier écrit.
    const got = Number(run('ffmpeg', ['-hide_banner', '-i', join(SFX_DIR, `${it.out}.wav`), '-af', 'volumedetect', '-f', 'null', '-']).stderr.match(/max_volume:\s*(-?[\d.]+) dB/)[1]);
    if (Math.abs(got + 3) > 0.05) { gain += -3 - got; args = importCommand(src, it, gain); run('ffmpeg', args); }
    console.log(`✓ ${it.out}.wav ← KenneyNL/${it.repo}@${it.commit.slice(0, 7)}:${it.file} (−ss ${it.ss} −t ${it.t}, gain ${gain.toFixed(2)} dB)`);
    console.log(`  ffmpeg ${args.map((a) => (/[ ,=:]/.test(a) ? `"${a}"` : a)).join(' ').replace(src, `<clone>/${it.file}`)}`);
  }
}
