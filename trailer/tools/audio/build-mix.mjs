#!/usr/bin/env node
// Mixage : montage musical + piste d'effets → −14 LUFS intégrés (±0,5), crête vraie ≤ −1 dBTP.
// Chaîne FFmpeg : somme (effets mono au centre) → gain unique → limiteur suréchantillonné ×4 (192 kHz) → 48 kHz, 24 bits.
// Le gain est réajusté jusqu'à 5 fois d'après la mesure EBU R128 du fichier rendu.
// Usage : node tools/audio/build-mix.mjs                          (montage réel → qa/mix-v1.wav)
//         node tools/audio/build-mix.mjs --substitut              (montage de SUBSTITUTION → qa/mix-v1-SUBSTITUT.wav)
//         node tools/audio/build-mix.mjs --v2                     (montage v2 + qa/sfx-v2.wav → qa/mix-v2.wav, voir qa/SON-AUDIT.md)
//         node tools/audio/build-mix.mjs --v3                     (montage v3 seul, sans effet → qa/mix-v3.wav, voir qa/MUSIQUE-V3.md)
//         node tools/audio/build-mix.mjs --v4                     (montage v4 + habillage v4 → qa/mix-v4.wav, -musique.wav, -habillage.wav)
//         [--sfx qa/sfx-v1.wav] [--report qa/tmp/mix-report.json]
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { HABILLAGE_V4_RAW, MIX_V3, MIX_V4, MIX_V4_HABILLAGE, MIX_V4_MUSIQUE, MONTAGE, MONTAGE_V2, MONTAGE_V3, MONTAGE_V4, QA_DIR, QA_TMP, SR, SUBST_MONTAGE, ffmpegVersion, fmt, loudness, probe, readMono, requireFile, rmsDb, run } from './lib.mjs';
import { svf } from './synth.mjs';
import { HALF } from './build-sfx.mjs';

export const TARGET_LUFS = -14;
export const LIMIT_DBTP = -1.5; // plafond du limiteur, sous le −1 dBTP exigé (marge pour la reconstruction inter-échantillons)

// Retrait bref du lit sous un effet ponctuel (v2, champ `duckDb` d'un effet) : le lit baisse de duckDb dB de 40 ms avant
// à 100 ms après le pic, rampes de 15 ms, pour que le limiteur n'écrase pas le transitoire de l'effet.
export function duckExpr(ducks) {
  if (!ducks.length) return null;
  const r = 0.015;
  return ducks.map(({ t, db }) => {
    const g = Math.pow(10, -db / 20).toFixed(5), a = (t - 0.04).toFixed(4), b = (t + 0.1).toFixed(4);
    return `if(between(t,${a},${b}),${g},if(between(t,${(t - 0.04 - r).toFixed(4)},${a}),1-(1-${g})*(t-${(t - 0.04 - r).toFixed(4)})/${r},` +
      `if(between(t,${b},${(t + 0.1 + r).toFixed(4)}),${g}+(1-${g})*(t-${b})/${r},1)))`;
  }).join('*');
}
// v2 : passe-bas sur la piste d'effets (bruits générés riches jusqu'à 24 kHz ; la musique, issue d'un MP3, s'arrête vers 19 kHz).
// Sans lui, l'encodeur AAC de FFmpeg (substitution de bruit PNS) fabriquait un clic de +6,8 dB à 37,541 s (éclaboussure P37).
const sfxChain = (lp) => `[1:a]aformat=channel_layouts=mono${lp ? `,lowpass=f=${lp}:p=2,lowpass=f=${lp}:p=2` : ''},pan=stereo|c0=c0|c1=c0[s];`;
const bedChain = (ducks) => {
  const e = duckExpr(ducks);
  return `[0:a]aformat=sample_fmts=fltp:channel_layouts=stereo${e ? `,asetnsamples=n=64,volume=eval=frame:volume='${e}'` : ''}[b];`;
};

function render(bed, sfx, out, gainDb, limitDb = LIMIT_DBTP, ducks = [], sfxLp = 0) {
  const lim = Math.pow(10, limitDb / 20).toFixed(5);
  const graph =
    sfxChain(sfxLp) +
    bedChain(ducks) +
    `[b][s]amix=inputs=2:normalize=0:duration=first,volume=${gainDb.toFixed(3)}dB,` +
    `aresample=192000,alimiter=limit=${lim}:attack=1:release=60:level=false,aresample=${SR},` +
    `apad=whole_dur=60,atrim=0:60[o]`;
  run('ffmpeg', ['-hide_banner', '-v', 'error', '-y', '-i', bed, '-i', sfx, '-filter_complex', graph, '-map', '[o]',
    '-ar', String(SR), '-c:a', 'pcm_s24le', out]);
}

export function buildMix({ bed, sfx = join(QA_DIR, 'sfx-v1.wav'), out, report = join(QA_TMP, 'mix-report.json'), placements = join(QA_TMP, 'sfx-placements.json'), sumTmp = join(QA_TMP, 'mix-sum-unlimited.wav'), limitDb = LIMIT_DBTP, sfxLowpassHz = 0 }) {
  requireFile(bed, 'Lit musical');
  requireFile(sfx, "Piste d'effets");
  const ducks = existsSync(placements)
    ? JSON.parse(readFileSync(placements, 'utf8')).cues.filter((c) => c.duckDb > 0).map((c) => ({ t: c.measuredPeakSec, db: c.duckDb, frame: c.frame }))
    : [];
  // Point de départ : gain qui amène la somme non limitée (lit déjà retiré sous les effets, s'il y a lieu) à −14 LUFS.
  run('ffmpeg', ['-hide_banner', '-v', 'error', '-y', '-i', bed, '-i', sfx, '-filter_complex',
    sfxChain(sfxLowpassHz) + bedChain(ducks) + '[b][s]amix=inputs=2:normalize=0:duration=first[o]',
    '-map', '[o]', '-c:a', 'pcm_f32le', sumTmp]);
  const sumL = loudness(sumTmp);
  let gain = TARGET_LUFS - sumL.integrated;
  let m, limit = limitDb;
  const tries = [];
  for (let k = 0; k < 6; k++) {
    render(bed, sfx, out, gain, limit, ducks, sfxLowpassHz);
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
    return { frame: c.frame, file: c.file, overBedDb: c.overBedMeasuredDb, duckDb: c.duckDb ?? 0, limiterGrDb, effectiveOverBedDb: c.overBedMeasuredDb + (c.duckDb ?? 0) + limiterGrDb };
  });
  const hf = run('npx', ['hyperframes', 'audio', out, '--json', '--only', 'loudness,onsets'], { allowFail: true });
  let hfLoud = null, hfOnsets = [];
  try { const it = JSON.parse(hf.stdout).items[0]; hfLoud = it.loudness; hfOnsets = it.onsets?.events ?? []; } catch { /* rapporté plus bas */ }
  const meta = { out, bed, sfx, ducks, ffmpeg: ffmpegVersion(), substitute: bed === SUBST_MONTAGE, sumUnlimitedLufs: sumL.integrated,
    tries, final: { ...m, samples: p.samples, sampleRate: p.sampleRate, codec: p.codec }, hyperframesLoudness: hfLoud, perCue,
    onsetsNearCues: perCue.map((c) => ({ frame: c.frame, onsets: hfOnsets.filter((o) => Math.abs(o.t - (c.frame + 1) / 60) < 0.05).map((o) => o.t) })) };
  writeFileSync(report, JSON.stringify(meta, null, 2));
  return meta;
}

// v3 : musique seule. Un gain unique (aucun limiteur : le montage, ramené à −14 LUFS, a ~5 dB de marge de crête,
// et un limiteur n'apporterait qu'un risque de décalage). Gain réajusté jusqu'à ±0,1 LU d'après la mesure du fichier rendu.
export function buildMasterV3({ bed = MONTAGE_V3, out = MIX_V3, report = join(QA_TMP, 'mix-report-v3.json') } = {}) {
  requireFile(bed, 'Montage v3');
  const src = loudness(bed);
  let gain = TARGET_LUFS - src.integrated;
  const tries = [];
  let m;
  for (let k = 0; k < 4; k++) {
    run('ffmpeg', ['-hide_banner', '-v', 'error', '-y', '-i', bed, '-af', `volume=${gain.toFixed(3)}dB`,
      '-ar', String(SR), '-c:a', 'pcm_s24le', out]);
    m = loudness(out);
    tries.push({ gainDb: Number(gain.toFixed(3)), integrated: m.integrated, truePeak: m.truePeak });
    if (Math.abs(m.integrated - TARGET_LUFS) <= 0.1) break;
    gain += TARGET_LUFS - m.integrated;
  }
  const p = probe(out);
  const meta = { out, bed, ffmpeg: ffmpegVersion(), source: src, tries, final: { ...m, samples: p.samples, sampleRate: p.sampleRate, codec: p.codec, channels: p.channels } };
  writeFileSync(report, JSON.stringify(meta, null, 2));
  return meta;
}

// v4 : musique + habillage, un seul gain G (aucun limiteur). Les deux pistes séparées reçoivent le même G :
// mix-v4-musique.wav + mix-v4-habillage.wav = mix-v4.wav (à la quantification 24 bits près). Mesures sur mix-v4.wav.
export function buildMasterV4({ bed = MONTAGE_V4, hab = HABILLAGE_V4_RAW, report = join(QA_TMP, 'mix-report-v4.json') } = {}) {
  requireFile(bed, 'Montage v4');
  requireFile(hab, 'Habillage v4');
  const sumTmp = join(QA_TMP, 'mix-v4-somme.wav');
  run('ffmpeg', ['-hide_banner', '-v', 'error', '-y', '-i', bed, '-i', hab, '-filter_complex',
    '[0:a][1:a]amix=inputs=2:normalize=0:duration=first[o]', '-map', '[o]', '-c:a', 'pcm_f32le', sumTmp]);
  const src = loudness(sumTmp);
  let gain = TARGET_LUFS - src.integrated;
  const tries = [];
  let m;
  for (let k = 0; k < 4; k++) {
    run('ffmpeg', ['-hide_banner', '-v', 'error', '-y', '-i', sumTmp, '-af', `volume=${gain.toFixed(3)}dB`, '-ar', String(SR), '-c:a', 'pcm_s24le', MIX_V4]);
    m = loudness(MIX_V4);
    tries.push({ gainDb: Number(gain.toFixed(3)), integrated: m.integrated, truePeak: m.truePeak });
    if (Math.abs(m.integrated - TARGET_LUFS) <= 0.1) break;
    gain += TARGET_LUFS - m.integrated;
  }
  const g = tries.at(-1).gainDb.toFixed(3);
  for (const [inp, out] of [[bed, MIX_V4_MUSIQUE], [hab, MIX_V4_HABILLAGE]]) {
    run('ffmpeg', ['-hide_banner', '-v', 'error', '-y', '-i', inp, '-af', `volume=${g}dB`, '-ar', String(SR), '-c:a', 'pcm_s24le', out]);
  }
  const p = probe(MIX_V4);
  const meta = { out: MIX_V4, stems: [MIX_V4_MUSIQUE, MIX_V4_HABILLAGE], bed, hab, ffmpeg: ffmpegVersion(), source: src, tries,
    final: { ...m, samples: p.samples, sampleRate: p.sampleRate, codec: p.codec, channels: p.channels } };
  writeFileSync(report, JSON.stringify(meta, null, 2));
  return meta;
}

// v5 : musique v4 (avec le creux de respiration avant le drop 1) + habillage v4 + effets v5 (passe-bas 18 kHz, deux passes),
// un seul gain G (aucun limiteur), réajusté jusqu'à ±0,1 LU de −14 LUFS. Les trois pistes séparées reçoivent le même G :
// mix-v5-musique + mix-v5-habillage + mix-v5-effets = mix-v5 (à la quantification 24 bits près).
// Contrôle de la crête vraie sur le WAV et après encodage AAC 320 et 192 kb/s (FFmpeg, -aac_pns 0), décodé et mesuré.
export const MIX_V5 = join(QA_DIR, 'mix-v5.wav');
export const MIX_V5_STEMS = { musique: join(QA_DIR, 'mix-v5-musique.wav'), habillage: join(QA_DIR, 'mix-v5-habillage.wav'), effets: join(QA_DIR, 'mix-v5-effets.wav') };
export function buildMasterV5({ bed = MONTAGE_V4, hab = HABILLAGE_V4_RAW, fx = join(QA_TMP, 'effets-v5-brut.wav'), cues = join(QA_TMP, 'sfx-v5-placements.json'), report = join(QA_TMP, 'mix-report-v5.json') } = {}) {
  for (const [f, w] of [[bed, 'Montage v4'], [hab, 'Habillage v4'], [fx, 'Effets v5'], [cues, 'Placements v5']]) requireFile(f, w);
  const creux = JSON.parse(readFileSync(cues, 'utf8')).creux;
  const g = Math.pow(10, creux.db / 20).toFixed(6), r = creux.rampe, a = creux.debut, b = creux.fin;
  const dip = `if(between(t,${a},${b}),${g},if(between(t,${(a - r).toFixed(4)},${a}),1-(1-${g})*(t-${(a - r).toFixed(4)})/${r},` +
    `if(between(t,${b},${(b + r).toFixed(4)}),${g}+(1-${g})*(t-${b})/${r},1)))`;
  const music = join(QA_TMP, 'musique-v5.wav'), fxLp = join(QA_TMP, 'effets-v5-lp.wav'), sumTmp = join(QA_TMP, 'mix-v5-somme.wav');
  run('ffmpeg', ['-hide_banner', '-v', 'error', '-y', '-i', bed, '-af', `aformat=sample_fmts=fltp:channel_layouts=stereo,asetnsamples=n=48,volume=eval=frame:volume='${dip}'`, '-c:a', 'pcm_f32le', music]);
  run('ffmpeg', ['-hide_banner', '-v', 'error', '-y', '-i', fx, '-af', 'lowpass=f=18000:p=2,lowpass=f=18000:p=2', '-c:a', 'pcm_f32le', fxLp]);
  run('ffmpeg', ['-hide_banner', '-v', 'error', '-y', '-i', music, '-i', hab, '-i', fxLp, '-filter_complex',
    '[0:a][1:a][2:a]amix=inputs=3:normalize=0:duration=first[o]', '-map', '[o]', '-c:a', 'pcm_f32le', sumTmp]);
  const src = loudness(sumTmp);
  let gain = TARGET_LUFS - src.integrated;
  const tries = [];
  let m;
  for (let k = 0; k < 4; k++) {
    run('ffmpeg', ['-hide_banner', '-v', 'error', '-y', '-i', sumTmp, '-af', `volume=${gain.toFixed(3)}dB`, '-ar', String(SR), '-c:a', 'pcm_s24le', MIX_V5]);
    m = loudness(MIX_V5);
    tries.push({ gainDb: Number(gain.toFixed(3)), integrated: m.integrated, truePeak: m.truePeak });
    if (Math.abs(m.integrated - TARGET_LUFS) <= 0.1) break;
    gain += TARGET_LUFS - m.integrated;
  }
  const G = tries.at(-1).gainDb.toFixed(3);
  for (const [inp, out] of [[music, MIX_V5_STEMS.musique], [hab, MIX_V5_STEMS.habillage], [fxLp, MIX_V5_STEMS.effets]]) {
    run('ffmpeg', ['-hide_banner', '-v', 'error', '-y', '-i', inp, '-af', `volume=${G}dB`, '-ar', String(SR), '-c:a', 'pcm_s24le', out]);
  }
  const aac = {};
  for (const kb of [320, 192]) {
    const f = join(QA_TMP, `mix-v5-aac${kb}.m4a`);
    run('ffmpeg', ['-hide_banner', '-v', 'error', '-y', '-i', MIX_V5, '-c:a', 'aac', '-b:a', `${kb}k`, '-aac_pns', '0', '-ar', String(SR), f]);
    aac[kb] = loudness(f);
  }
  const stems = Object.fromEntries(Object.entries(MIX_V5_STEMS).map(([k, f]) => [k, loudness(f)]));
  const p = probe(MIX_V5);
  const meta = { out: MIX_V5, stems: MIX_V5_STEMS, bed, hab, fx, creux, ffmpeg: ffmpegVersion(), source: src, tries,
    final: { ...m, samples: p.samples, sampleRate: p.sampleRate, codec: p.codec, channels: p.channels }, aac, stemsLoudness: stems };
  writeFileSync(report, JSON.stringify(meta, null, 2));
  return meta;
}

if (import.meta.url === `file://${process.argv[1]}` && process.argv.includes('--v5')) {
  const r = buildMasterV5();
  const f = r.final;
  console.log(`✓ ${r.out} (+ ${Object.values(r.stems).join(', ')})\n  ${f.samples} échantillons · ${f.sampleRate} Hz · ${f.codec} · ${f.channels} canaux · ${r.ffmpeg}`);
  console.log(`  somme ${r.source.integrated} LUFS → gain ${r.tries.at(-1).gainDb} dB → ${f.integrated} LUFS intégrés · crête vraie ${f.truePeak} dBTP · LRA ${f.lra} LU`);
  for (const kb of [320, 192]) console.log(`  AAC ${kb} kb/s : ${r.aac[kb].integrated} LUFS · crête vraie ${r.aac[kb].truePeak} dBTP`);
  for (const [k, l] of Object.entries(r.stemsLoudness)) console.log(`  piste ${k} : ${l.integrated} LUFS · crête vraie ${l.truePeak} dBTP`);
  const ok = Math.abs(f.integrated - TARGET_LUFS) <= 0.3 && f.truePeak <= -1 && r.aac[320].truePeak <= -1 && r.aac[192].truePeak <= -1 &&
    f.samples === SR * 60 && f.codec === 'pcm_s24le';
  if (!ok) { console.error('✗ Mixage v5 hors cible'); process.exit(1); }
} else if (import.meta.url === `file://${process.argv[1]}` && process.argv.includes('--v4')) {
  const r = buildMasterV4();
  const f = r.final;
  console.log(`✓ ${r.out} (+ ${r.stems.join(', ')})\n  ${f.samples} échantillons · ${f.sampleRate} Hz · ${f.codec} · ${f.channels} canaux · ${r.ffmpeg}`);
  console.log(`  somme ${r.source.integrated} LUFS → gain ${r.tries.at(-1).gainDb} dB → ${f.integrated} LUFS intégrés · crête vraie ${f.truePeak} dBTP · LRA ${f.lra} LU`);
  const ok = Math.abs(f.integrated - TARGET_LUFS) <= 0.3 && f.truePeak <= -1 && f.samples === SR * 60 && f.codec === 'pcm_s24le';
  if (!ok) { console.error('✗ Mixage v4 hors cible'); process.exit(1); }
} else if (import.meta.url === `file://${process.argv[1]}` && process.argv.includes('--v3')) {
  const r = buildMasterV3();
  const f = r.final;
  console.log(`✓ ${r.out}\n  ${f.samples} échantillons · ${f.sampleRate} Hz · ${f.codec} · ${f.channels} canaux · ${r.ffmpeg}`);
  console.log(`  montage ${r.source.integrated} LUFS → gain ${r.tries.at(-1).gainDb} dB → ${f.integrated} LUFS intégrés · crête vraie ${f.truePeak} dBTP · LRA ${f.lra} LU`);
  const ok = Math.abs(f.integrated - TARGET_LUFS) <= 0.3 && f.truePeak <= -1 && f.samples === SR * 60 && f.codec === 'pcm_s24le';
  if (!ok) { console.error('✗ Mixage v3 hors cible'); process.exit(1); }
} else if (import.meta.url === `file://${process.argv[1]}`) {
  const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : undefined; };
  const subst = process.argv.includes('--substitut');
  const v2 = process.argv.includes('--v2');
  const bed = subst ? SUBST_MONTAGE : v2 ? MONTAGE_V2 : MONTAGE;
  if (!subst && !existsSync(MONTAGE)) {
    console.error(`✗ Montage réel absent (${MONTAGE}). mix-v1.wav ne se fabrique qu'avec la vraie musique.\n  Déposez storm-ii.mp3 puis : node tools/audio/build-all.mjs   (essai sans musique : --substitut)`);
    process.exit(2);
  }
  const out = join(QA_DIR, subst ? 'mix-v1-SUBSTITUT.wav' : v2 ? 'mix-v2.wav' : 'mix-v1.wav');
  const r = v2
    ? buildMix({ bed, sfx: arg('--sfx') ?? join(QA_DIR, 'sfx-v2.wav'), out, report: arg('--report') ?? join(QA_TMP, 'mix-report-v2.json'),
      placements: join(QA_TMP, 'sfx-placements-v2.json'), sumTmp: join(QA_TMP, 'mix-sum-unlimited-v2.wav'),
      limitDb: -2.0, sfxLowpassHz: 18000 })
    : buildMix({ bed, sfx: arg('--sfx'), out, report: arg('--report') });
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
