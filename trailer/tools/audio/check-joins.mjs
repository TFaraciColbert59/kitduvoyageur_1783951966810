#!/usr/bin/env node
// Contrôle des raccords du montage PAR LA MESURE (on mesure, on n'entend pas).
// Pour chacun des 5 raccords (5,41 · 33,48 · 47,47 · 51,00 · 58,00 s) : 0,5 s avant / 0,5 s après
//   - RMS (dBFS) et LUFS momentané (400 ms) de chaque côté, LUFS court terme (3 s) qui finit / commence au raccord
//   - centroïde spectral, énergie par bandes (grave < 250 Hz, médium 250–4000 Hz, aigu > 4 kHz)
//   - profil de hauteurs (chroma, 12 classes) et distance cosinus avant/après
//   - discontinuité de forme d'onde au point de collage (creux des micro-fondus, saut d'échantillon)
//   - attaques détectées par `npx hyperframes audio` à ±60 ms du raccord, et sections trouvées
// Classement heuristique « discret / à surveiller / risque de s'entendre » (seuils écrits plus bas).
// Usage : node tools/audio/check-joins.mjs [--input storm-ii-montage-60s.wav] [--label REEL|SUBSTITUT] [--json out.json]
import { writeFileSync } from 'node:fs';
import { JOINS, MONTAGE, SR, TRAILER, cosineDistance, ffmpegVersion, fmt, loudness, readMono, requireFile, rmsDb, run, spectralFeatures } from './lib.mjs';

const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : undefined; };

// Montées voulues : au drop 1 et à l'impact final le niveau DOIT monter ; seule une baisse y compte.
const INTENDED_RISE = new Set([5.41, 58.0]);

export function hyperframesAudio(file) {
  const r = run('npx', ['hyperframes', 'audio', file, '--json', '--only', 'onsets,sections,loudness'], { allowFail: true });
  try { return JSON.parse(r.stdout).items[0]; } catch { return null; }
}

function discontinuity(x, i0) {
  const w = Math.round(SR * 0.005);
  const seg = (a, b) => x.subarray(Math.max(0, a), Math.min(x.length, b));
  const center = rmsDb(seg(i0 - w, i0 + w));
  const around = (rmsDb(seg(i0 - 5 * w, i0 - 2 * w)) + rmsDb(seg(i0 + 2 * w, i0 + 5 * w))) / 2;
  const diffs = (a, b) => { const s = seg(a, b), d = []; for (let i = 1; i < s.length; i++) d.push(Math.abs(s[i] - s[i - 1])); return d; };
  const at = Math.max(...diffs(i0 - 48, i0 + 48));
  const ref = diffs(i0 - 4800, i0 - 480).concat(diffs(i0 + 480, i0 + 4800)).sort((a, b) => a - b);
  const p99 = ref[Math.floor(ref.length * 0.99)] || 1e-9;
  return { dipDb: center - around, jumpRatio: at / p99 };
}

export function checkJoins(file) {
  const x = readMono(file);
  const log = loudness(file, { log: true });
  const M = (t) => { let best = null; for (const f of log.frames) if (!best || Math.abs(f.t - t) < Math.abs(best.t - t)) best = f; return best; };
  const hf = hyperframesAudio(file);
  const onsets = hf?.onsets?.events ?? [];
  const rows = JOINS.map((j) => {
    const i0 = Math.round(j.t * SR), w = Math.round(0.5 * SR), guard = Math.round(0.006 * SR);
    const before = x.subarray(i0 - w, i0 - guard), after = x.subarray(i0 + guard, i0 + w);
    const fb = spectralFeatures(before), fa = spectralFeatures(after);
    const rms = { before: rmsDb(before), after: rmsDb(after) };
    const lufsM = { before: M(j.t).M, after: M(j.t + 0.4).M };
    const lufsS = { endingAtJoin: M(j.t).S, startingAtJoin: M(Math.min(59.9, j.t + 3)).S };
    const bandDelta = Object.fromEntries(Object.keys(fb.bandsDb).map((k) => [k, fa.bandsDb[k] - fb.bandsDb[k]]));
    const chromaDist = cosineDistance(fb.chroma, fa.chroma);
    const centroidOct = Math.log2(fa.centroidHz / fb.centroidHz);
    const disc = discontinuity(x, i0);
    const near = onsets.filter((o) => Math.abs(o.t - j.t) <= 0.06);
    // Seuils (heuristiques, à confirmer à l'oreille) :
    const reasons = [];
    let score = 0;
    const levelDelta = rms.after - rms.before;
    const countedLevel = INTENDED_RISE.has(j.t) ? Math.min(0, levelDelta) : levelDelta;
    if (Math.abs(countedLevel) > 6) { score += 2; reasons.push(`niveau ${fmt(levelDelta, 1)} dB`); }
    else if (Math.abs(countedLevel) > 3) { score += 1; reasons.push(`niveau ${fmt(levelDelta, 1)} dB`); }
    if (chromaDist > 0.35) { score += 2; reasons.push(`hauteurs ${fmt(chromaDist, 2)}`); }
    else if (chromaDist > 0.15) { score += 1; reasons.push(`hauteurs ${fmt(chromaDist, 2)}`); }
    if (Math.abs(centroidOct) > 1) { score += 2; reasons.push(`timbre ${fmt(centroidOct, 2)} oct.`); }
    else if (Math.abs(centroidOct) > 0.5) { score += 1; reasons.push(`timbre ${fmt(centroidOct, 2)} oct.`); }
    const worstBand = Math.max(...Object.values(bandDelta).map(Math.abs));
    if (worstBand > 8) { score += 2; reasons.push(`bande ${fmt(worstBand, 1)} dB`); }
    else if (worstBand > 4) { score += 1; reasons.push(`bande ${fmt(worstBand, 1)} dB`); }
    if (disc.jumpRatio > 3) { score += 2; reasons.push(`saut d'échantillon ×${fmt(disc.jumpRatio, 1)}`); }
    if (disc.dipDb < -12) { score += 1; reasons.push(`creux ${fmt(disc.dipDb, 1)} dB sur 10 ms`); }
    const verdict = score <= 1 ? 'discret' : score <= 3 ? 'à surveiller' : 'risque de s\'entendre';
    return { ...j, rms, lufsM, lufsS, centroidHz: { before: fb.centroidHz, after: fa.centroidHz }, centroidOct,
      bandsDb: { before: fb.bandsDb, after: fa.bandsDb }, bandDelta, chromaDist, discontinuity: disc,
      onsetsNear: near, score, verdict, reasons };
  });
  return { file, ffmpeg: ffmpegVersion(), integrated: log.integrated, truePeak: log.truePeak,
    sections: hf?.sections?.spans ?? null, hyperframesWarnings: hf?.warnings ?? [], rows };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const file = arg('--input') ?? MONTAGE;
  const label = arg('--label') ?? 'REEL';
  requireFile(file, 'Montage');
  const r = checkJoins(file);
  r.label = label;
  if (arg('--json')) writeFileSync(arg('--json'), JSON.stringify(r, null, 2));
  console.log(`Raccords — ${label} — ${file.replace(TRAILER + '/', '')} · ${r.ffmpeg} · ${r.integrated} LUFS intégrés · ${r.truePeak} dBTP`);
  console.log('| Raccord | RMS av./ap. (dBFS) | LUFS M av./ap. | LUFS S fin/début | Centroïde av./ap. (Hz) | Δ grave/médium/aigu (dB) | Dist. chroma | Creux / saut | Attaque ±60 ms | Verdict |');
  console.log('|---|---|---|---|---|---|---|---|---|---|');
  for (const j of r.rows) {
    console.log(`| ${fmt(j.t, 2)} s (${j.name}${j.priority ? ', prioritaire' : ''}) | ${fmt(j.rms.before, 1)} / ${fmt(j.rms.after, 1)} | ${fmt(j.lufsM.before, 1)} / ${fmt(j.lufsM.after, 1)} | ${fmt(j.lufsS.endingAtJoin, 1)} / ${fmt(j.lufsS.startingAtJoin, 1)} | ${Math.round(j.centroidHz.before)} / ${Math.round(j.centroidHz.after)} | ${fmt(j.bandDelta.grave, 1)} / ${fmt(j.bandDelta.medium, 1)} / ${fmt(j.bandDelta.aigu, 1)} | ${fmt(j.chromaDist, 2)} | ${fmt(j.discontinuity.dipDb, 1)} dB / ×${fmt(j.discontinuity.jumpRatio, 1)} | ${j.onsetsNear.map((o) => `${fmt(o.t, 3)} (${fmt(o.strength, 2)})`).join(', ') || '—'} | **${j.verdict}** (${j.score}${j.reasons.length ? ' : ' + j.reasons.join(', ') : ''}) |`);
  }
  console.log(`Sections (hyperframes audio) : ${(r.sections ?? []).map((s) => `${s.label} ${fmt(s.start, 3)}–${fmt(s.end, 3)}`).join(' · ') || '—'}`);
}
