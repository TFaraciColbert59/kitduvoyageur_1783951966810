#!/usr/bin/env node
// Tableau coupe/temps : pour chaque plan de la trame, écart (en images) entre son image de départ
// et le temps du montage musical le plus proche. Ne dépend pas du MP3 (temps lus dans storm-ii.beats.json,
// convertis en temps du film par le tableau « Montage de 60 s » de MUSIQUE.md). Ne déplace aucune coupe.
// Usage : node tools/audio/cut-beat-table.mjs [--json qa/tmp/cut-beat.json]
import { writeFileSync } from 'node:fs';
import { FPS, loadBeats, loadShots, fmt } from './lib.mjs';

const { bpm, beats } = loadBeats();
const shots = loadShots();
if (shots.length !== 54) {
  console.error(`✗ ${shots.length} plans lus dans TRAME-60s.md au lieu de 54`);
  process.exit(1);
}
const framesPerBeat = (60 / bpm) * FPS;
const rows = shots.map((s) => {
  const t = s.start / FPS;
  let best = beats[0];
  for (const b of beats) if (Math.abs(b.film - t) < Math.abs(best.film - t)) best = b;
  const delta = (s.start - best.film * FPS); // > 0 : la coupe tombe après le temps
  return {
    plan: s.id,
    frame: s.start,
    filmSec: t,
    beatFilm: best.film,
    beatFrame: best.film * FPS,
    beatIndex: best.index,
    downbeat: best.downbeat,
    deltaFrames: delta,
    flag: Math.abs(delta) > 1,
  };
});

const out = process.argv.indexOf('--json');
if (out > 0) writeFileSync(process.argv[out + 1], JSON.stringify({ bpm, framesPerBeat, beatsInFilm: beats.length, rows }, null, 2));

console.log(`Temps du montage dans le film : ${beats.length} · ${fmt(framesPerBeat, 1)} images par temps (${bpm} BPM)`);
console.log('| Plan | Image | Temps du film (s) | Temps le plus proche (s) | Indice | 1er temps | Écart (images) |');
console.log('|---|---|---|---|---|---|---|');
for (const r of rows) {
  console.log(`| ${r.plan} | ${r.frame} | ${fmt(r.filmSec, 3)} | ${fmt(r.beatFilm, 3)} | ${r.beatIndex} | ${r.downbeat ? 'oui' : ''} | ${r.deltaFrames >= 0 ? '+' : ''}${fmt(r.deltaFrames, 2)}${r.flag ? ' **> 1**' : ''} |`);
}
const flagged = rows.filter((r) => r.flag);
const abs = rows.map((r) => Math.abs(r.deltaFrames));
console.log(`\nÉcart absolu moyen ${fmt(abs.reduce((a, b) => a + b, 0) / abs.length, 2)} image, maximum ${fmt(Math.max(...abs), 2)} ; ${flagged.length} coupe(s) à plus d'une image : ${flagged.map((r) => `${r.plan} (${fmt(r.deltaFrames, 2)})`).join(', ') || 'aucune'}.`);
