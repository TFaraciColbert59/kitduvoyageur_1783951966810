#!/usr/bin/env node
// Montage v6 A, B ou C (qa/MUSIQUE-V6.md) : musique seule, aucun effet.
//   storm-ii.mp3 → assets/audio/storm-ii-montage-60s-v6x.wav (flottant, gains de section) → qa/mix-v6x.wav
//   (un gain unique vers −14 LUFS, sans limiteur, 48 kHz 24 bits) → livraison/LKDV-musique-v6-X.m4a (AAC 256 kb/s).
// Usage : node tools/audio/build-v6.mjs A|B|C
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { MP3, QA_TMP, SR, V6, ffmpegVersion, loudness, montageV6Filter, probe, requireFile, run, v6Paths } from './lib.mjs';
import { buildMontage } from './build-montage.mjs';

const TARGET = -14;

export function buildV6(k) {
  if (!V6[k]) throw new Error(`variante inconnue : ${k} (A, B ou C)`);
  requireFile(MP3, 'storm-ii.mp3');
  const p = v6Paths(k);
  buildMontage(MP3, p.montage, montageV6Filter(k), 'pcm_f32le');
  const src = loudness(p.montage);
  let gain = TARGET - src.integrated;
  const tries = [];
  let m;
  for (let i = 0; i < 4; i++) {
    run('ffmpeg', ['-hide_banner', '-v', 'error', '-y', '-i', p.montage, '-af', `volume=${gain.toFixed(3)}dB`, '-ar', String(SR), '-c:a', 'pcm_s24le', p.mix]);
    m = loudness(p.mix);
    tries.push({ gainDb: Number(gain.toFixed(3)), integrated: m.integrated, truePeak: m.truePeak });
    if (Math.abs(m.integrated - TARGET) <= 0.1) break;
    gain += TARGET - m.integrated;
  }
  mkdirSync(dirname(p.m4a), { recursive: true });
  run('ffmpeg', ['-hide_banner', '-v', 'error', '-y', '-i', p.mix, '-c:a', 'aac', '-b:a', '256k', '-aac_pns', '0', '-ar', String(SR), '-ac', '2', '-movflags', '+faststart', p.m4a]);
  const aac = loudness(p.m4a);
  const pr = probe(p.mix);
  const meta = { variante: k, nom: V6[k].name, ffmpeg: ffmpegVersion(), source: src, tries, final: { ...m, samples: pr.samples, sampleRate: pr.sampleRate, codec: pr.codec, channels: pr.channels }, m4a: { file: p.m4a, ...aac } };
  writeFileSync(join(QA_TMP, `mix-report-v6${k.toLowerCase()}.json`), JSON.stringify(meta, null, 2));
  return { p, meta };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const k = (process.argv[2] || '').toUpperCase();
  const { p, meta } = buildV6(k);
  const f = meta.final;
  console.log(`✓ ${p.mix} (v6 ${k} « ${meta.nom} »)\n  ${f.samples} échantillons · ${f.sampleRate} Hz · ${f.codec} · ${f.channels} canaux · ${meta.ffmpeg}`);
  console.log(`  montage ${meta.source.integrated} LUFS → gain ${meta.tries.at(-1).gainDb} dB → ${f.integrated} LUFS · crête vraie ${f.truePeak} dBTP · LRA ${f.lra} LU`);
  console.log(`✓ ${p.m4a} : ${meta.m4a.integrated} LUFS · crête vraie ${meta.m4a.truePeak} dBTP`);
  const ok = Math.abs(f.integrated - TARGET) <= 0.3 && f.truePeak <= -1 && meta.m4a.truePeak <= -1 && f.samples === SR * 60 && f.codec === 'pcm_s24le';
  if (!ok) { console.error('✗ v6 hors cible'); process.exit(1); }
}
