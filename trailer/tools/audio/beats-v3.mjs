#!/usr/bin/env node
// Grille du montage v3 → qa/mix-v3.beats.json (chaque temps et chaque début de mesure, en s et en images à 24 i/s).
// La grille est continue sur tout le film : tous les raccords tombent sur un temps du morceau, avec un décalage
// d'un nombre entier de mesures, donc temps k = V3.hit + k × V3.beat. Les instants MESURÉS (attaques, seuils
// de niveau) sont ajoutés ensuite par tools/audio/audit-v3.py (champ `mesures`).
// Usage : node tools/audio/beats-v3.mjs [--out qa/mix-v3.beats.json]
import { writeFileSync } from 'node:fs';
import { BEATS_V3, V3, joinsV3, montageV3Segments, v3Bar } from './lib.mjs';

const r6 = (v) => Math.round(v * 1e6) / 1e6;
const frameOf = (t) => {
  const frame = Math.round(t * V3.fps);
  return { frame, errMs: Math.round((frame / V3.fps - t) * 1e5) / 100 };
};

export function buildBeatsV3() {
  const T = V3.beat;
  const segs = montageV3Segments();
  const joins = joinsV3();
  const segAt = (t) => segs.find((s) => t >= s.film[0] - 1e-6 && t < s.film[1] - 1e-6);
  const songBarBeat = (song) => {
    const q = Math.round((song - V3.m40) / T);
    return { bar: Math.floor(q / 4) + 40, beat: ((q % 4) + 4) % 4 + 1 };
  };
  const keyMoments = [
    { id: 'entree', label: 'Le morceau commence (0 du MP3), fondu d\'entrée cubique de 2 s', t: segs[0].film[0] },
    { id: 'premier-temps-fort', label: 'Premier temps fort : m0 temps 1 du morceau (nouvelle note de la première phrase), utilisable pour l\'allumage du Soleil', t: segs[0].film[0] + v3Bar(0) },
    { id: 'montee', label: 'Montée : m38–m39 (riser vers le drop 1)', t: segs[1].film[0] },
    { id: 'drop1', label: 'Premier grand moment : drop 1 du morceau (m40)', t: segs[1].film[0] + 8 * T },
    { id: 'respiration', label: 'Respiration : pont m56 (le grave et la batterie s\'arrêtent)', t: segs[2].film[0] },
    { id: 'reprise', label: 'Reprise : m68, le grave revient', t: segs[3].film[0] },
    { id: 'roulement-1', label: 'Respiration + roulement m71 (avant le drop 2)', t: segs[3].film[0] + 12 * T },
    { id: 'drop2', label: 'Drop principal : drop 2 du morceau (m72)', t: segs[3].film[0] + 16 * T },
    { id: 'roulement-2', label: 'Respiration + roulement m71 (avant l\'impact)', t: segs[4].film[0] },
    { id: 'impact', label: 'Coup final : m72 temps 1 (logo)', t: V3.hit },
    { id: 'queue', label: 'Queue : nappe de l\'outro, décroissance exponentielle', t: segs[5].film[0] },
  ].map((k) => ({ ...k, t: r6(k.t), ...frameOf(k.t) }));
  const keyAt = (t) => keyMoments.filter((k) => Math.abs(k.t - t) < 1e-4).map((k) => k.id);

  const beats = [];
  for (let k = Math.ceil(-V3.hit / T - 1e-9); V3.hit + k * T < 60 - 1e-9; k++) {
    const t = V3.hit + k * T;
    if (t < 0) continue;
    const s = segAt(t);
    const song = s ? s.song[0] + (t - s.film[0]) : null;
    const bb = song != null ? songBarBeat(song) : null;
    const downbeat = (((k % 4) + 4) % 4) === 0;
    const join = joins.find((j) => Math.abs(j.t - t) < 1e-4);
    beats.push({
      i: beats.length, t: r6(t), ...frameOf(t),
      section: s ? s.section : 'silence', segment: s ? s.id : null,
      song: song != null ? r6(song) : null, songBar: bb ? bb.bar : null, songBeat: bb ? bb.beat : null,
      downbeat, join: join ? `${join.from}→${join.to}` : null, key: keyAt(t),
    });
  }
  let n = 0;
  const bars = beats.filter((b) => b.downbeat).map((b) => ({ bar: ++n, t: b.t, frame: b.frame, errMs: b.errMs, section: b.section, songBar: b.songBar, join: b.join, key: b.key }));
  return {
    version: 'v3',
    file: 'qa/mix-v3.wav',
    fps: V3.fps,
    bpm: r6(60 / T),
    beatSec: T,
    barSec: r6(4 * T),
    framesPerBeat: r6(T * V3.fps),
    note: 'Grille mesurée sur storm-ii.mp3 (pas celle de storm-ii.beats.json). t en s du film ; frame = image entière la plus proche à 24 i/s ; errMs = frame/24 − t en ms. downbeat = premier temps de mesure. join = raccord du montage posé sur ce temps. song = temps du morceau joué à cet instant (null pendant le silence).',
    segments: segs.map((s) => ({ id: s.id, section: s.section, label: s.label, songBars: s.bars,
      film: s.film.map(r6), song: s.song.map(r6), frames: s.film.map((t) => Math.round(t * V3.fps)) })),
    joins: joins.map((j) => ({ ...j, t: r6(j.t), songOut: r6(j.songOut), songIn: r6(j.songIn), frame24: undefined, ...frameOf(j.t) })),
    keyMoments,
    bars,
    beats,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const i = process.argv.indexOf('--out');
  const out = i > 0 ? process.argv[i + 1] : BEATS_V3;
  const j = buildBeatsV3();
  writeFileSync(out, JSON.stringify(j, null, 1) + '\n');
  console.log(`✓ ${out} : ${j.beats.length} temps, ${j.bars.length} mesures, ${j.joins.length} raccords, ${j.keyMoments.length} moments clés · ${j.bpm} BPM · ${j.framesPerBeat} images par temps`);
}
