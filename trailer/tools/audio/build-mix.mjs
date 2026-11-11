#!/usr/bin/env node
// Mixage : montage musical + piste d'effets → −14 LUFS intégrés (±0,5), crête vraie ≤ −1 dBTP.
// Chaîne FFmpeg : somme (effets mono au centre) → gain unique → limiteur suréchantillonné ×4 (192 kHz) → 48 kHz, 24 bits.
// Le gain est réajusté jusqu'à 5 fois d'après la mesure EBU R128 du fichier rendu.
// Usage : node tools/audio/build-mix.mjs                          (montage réel → qa/mix-v1.wav)
//         node tools/audio/build-mix.mjs --substitut              (montage de SUBSTITUTION → qa/mix-v1-SUBSTITUT.wav)
//         [--sfx qa/sfx-v1.wav] [--report qa/tmp/mix-report.json]
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { MONTAGE, QA_DIR, QA_TMP, SR, SUBST_MONTAGE, ffmpegVersion, fmt, loudness, probe, readMono, requireFile, rmsDb, run } from './lib.mjs';
import { svf } from './synth.mjs';
import { HALF } from './build-sfx.mjs';

export const TARGET_LUFS = -14;
export const LIMIT_DBTP = -1.5; // plafond du limiteur, sous le −1 dBTP exigé (marge pour la reconstruction inter-échantillons)

function render(bed, sfx, out, gainDb, limitDb = LIMIT_DBTP) {
  const lim = Math.pow(10, limitDb / 20).toFixed(5);
  const graph =
    `[1:a]aformat=channel_layouts=mono,pan=stereo|c0=c0|c1=c0[s];` +
    `[0:a]aformat=sample_fmts=fltp:channel_layouts=stereo[b];` +
    `[b][s]amix=inputs=2:normalize=0:duration=first,volume=${gainDb.toFixed(3)}dB,` +
    `aresample=192000,alimiter=limit=${lim}:attack=1:release=60:level=false,aresample=${SR},` +
    `apad=whole_dur=60,atrim=0:60[o]`;
  run('ffmpeg', ['-hide_banner', '-v', 'error', '-y', '-i', bed, '-i', sfx, '-filter_complex', graph, '-map', '[o]',
    '-ar', String(SR), '-c:a', 'pcm_s24le', out]);
}

export function buildMix({ bed, sfx = join(QA_DIR, 'sfx-v1.wav'), out, report = join(QA_TMP, 'mix-report.json'), placements = join(QA_TMP, 'sfx-placements.json') }) {
  requireFile(bed, 'Lit musical');
  requireFile(sfx, "Piste d'effets");
  // Point de départ : gain qui amène la somme non limitée à −14 LUFS.
  const sumTmp = join(QA_TMP, 'mix-sum-unlimited.wav');
  run('ffmpeg', ['-hide_banner', '-v', 'error', '-y', '-i', bed, '-i', sfx, '-filter_complex',
    '[1:a]aformat=channel_layouts=mono,pan=stereo|c0=c0|c1=c0[s];[0:a]aformat=sample_fmts=fltp:channel_layouts=stereo[b];[b][s]amix=inputs=2:normalize=0:duration=first[o]',
    '-map', '[o]', '-c:a', 'pcm_f32le', sumTmp]);
  const sumL = loudness(sumTmp);
  let gain = TARGET_LUFS - sumL.integrated;
  let m, limit = LIMIT_DBTP;
  const tries = [];
  for (let k = 0; k < 6; k++) {
    render(bed, sfx, out, gain, limit);
    m = loudness(out);
    tries.push({ gainDb: gain, limitDb: limit, integrated: m.integrated, truePeak: m.truePeak });
    const okL = Math.abs(m.integrated - TARGET_LUFS) <= 0.2;
    const okP = m.truePeak <= -1.0;
    if (okL && okP) break;
    if (!okP) limit -= m.truePeak - -1.1;
    if (!okL) gain += TARGET_LUFS - m.integrated;
  }
  const p = probe(out);
  // Réduction de gain du limiteur au moment de chaque effet ponctuel (le rapport effet/lit est conservé
  // par un gain commun ; le limiteur l'écrase d'autant qu'il réduit le transitoire).
  const unlim = readMono(sumTmp), lim = readMono(out);
  const g = Math.pow(10, tries.at(-1).gainDb / 20);
  const hp = (x) => svf(x, 'hp', 120, 0.7);
  const cues = existsSync(placements) ? JSON.parse(readFileSync(placements, 'utf8')).cues : [];
  const perCue = cues.filter((c) => c.align === 'peak').map((c) => {
    const t = Math.round(c.measuredPeakSec * SR), h = Math.round(HALF * SR), m3 = Math.round(0.3 * SR);
    const a = hp(unlim.subarray(t - m3, t + m3)).subarray(m3 - h, m3 + h);
    const b = hp(lim.subarray(t - m3, t + m3)).subarray(m3 - h, m3 + h);
    const limiterGrDb = rmsDb(b) - (rmsDb(a) + 20 * Math.log10(g));
    return { frame: c.frame, file: c.file, overBedDb: c.overBedMeasuredDb, limiterGrDb, effectiveOverBedDb: c.overBedMeasuredDb };
  });
  const hf = run('npx', ['hyperframes', 'audio', out, '--json', '--only', 'loudness,onsets'], { allowFail: true });
  let hfLoud = null, hfOnsets = [];
  try { const it = JSON.parse(hf.stdout).items[0]; hfLoud = it.loudness; hfOnsets = it.onsets?.events ?? []; } catch { /* rapporté plus bas */ }
  const meta = { out, bed, sfx, ffmpeg: ffmpegVersion(), substitute: bed === SUBST_MONTAGE, sumUnlimitedLufs: sumL.integrated,
    tries, final: { ...m, samples: p.samples, sampleRate: p.sampleRate, codec: p.codec }, hyperframesLoudness: hfLoud, perCue,
    onsetsNearCues: perCue.map((c) => ({ frame: c.frame, onsets: hfOnsets.filter((o) => Math.abs(o.t - (c.frame + 1) / 60) < 0.05).map((o) => o.t) })) };
  writeFileSync(report, JSON.stringify(meta, null, 2));
  return meta;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : undefined; };
  const subst = process.argv.includes('--substitut');
  const bed = subst ? SUBST_MONTAGE : MONTAGE;
  if (!subst && !existsSync(MONTAGE)) {
    console.error(`✗ Montage réel absent (${MONTAGE}). mix-v1.wav ne se fabrique qu'avec la vraie musique.\n  Déposez storm-ii.mp3 puis : node tools/audio/build-all.mjs   (essai sans musique : --substitut)`);
    process.exit(2);
  }
  const out = join(QA_DIR, subst ? 'mix-v1-SUBSTITUT.wav' : 'mix-v1.wav');
  const r = buildMix({ bed, sfx: arg('--sfx'), out, report: arg('--report') });
  const f = r.final;
  console.log(`✓ ${out}${r.substitute ? '  (LIT DE SUBSTITUTION, pas la musique)' : ''}`);
  console.log(`  ${f.samples} échantillons · ${f.sampleRate} Hz · ${f.codec} · ${r.ffmpeg}`);
  console.log(`  ebur128 : ${f.integrated} LUFS intégrés · crête vraie ${f.truePeak} dBTP · LRA ${f.lra} LU (essais : ${r.tries.map((t) => `${fmt(t.gainDb, 2)} dB/${fmt(t.limitDb, 2)} → ${t.integrated}/${t.truePeak}`).join(' ; ')})`);
  if (r.hyperframesLoudness) console.log(`  hyperframes audio : ${r.hyperframesLoudness.lufsIntegrated} LUFS · crête vraie ${r.hyperframesLoudness.truePeakDb} dBTP · écrêtages ${r.hyperframesLoudness.clipping?.count}`);
  const grs = r.perCue.map((c) => c.limiterGrDb);
  console.log(`  Limiteur sur les effets ponctuels : réduction médiane ${fmt(grs.sort((a, b) => a - b)[Math.floor(grs.length / 2)], 1)} dB, maximale ${fmt(Math.min(...grs), 1)} dB`);
  const ok = Math.abs(f.integrated - TARGET_LUFS) <= 0.5 && f.truePeak <= -1 && f.samples === SR * 60;
  if (!ok) { console.error('✗ Mixage hors cible'); process.exit(1); }
}
