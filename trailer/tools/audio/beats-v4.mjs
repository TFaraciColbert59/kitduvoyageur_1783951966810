#!/usr/bin/env node
// Grille du montage v4 → qa/mix-v4.beats.json (même format que la v3, à 24 i/s) : chaque temps et chaque début de
// mesure du film, les 9 sections du film (émotions), les segments du morceau, les raccords et les moments clés.
// La mesure 1 du film commence à l'image 0 ; temps k = k × V3.beat. L'intro (sections cosmos) est jouée librement
// dans le morceau : ses attaques réelles sont listées dans `intro.attaques` (mesurées par audit-v3.py --v4).
// Usage : node tools/audio/beats-v4.mjs [--out qa/mix-v4.beats.json]
import { writeFileSync } from 'node:fs';
import { BEATS_V4, V3, V4, filmBar, habillageV4Cues, joinsV4, montageV4Segments } from './lib.mjs';

const r6 = (v) => Math.round(v * 1e6) / 1e6;
const frameOf = (t) => { const frame = Math.round(t * V3.fps); return { frame, errMs: Math.round((frame / V3.fps - t) * 1e5) / 100 }; };

export const SECTIONS_V4 = [
  { id: 'cosmos', bars: [1, 3], image: 'Nébuleuse, création du système solaire (Soleil vers 1,3 s), la Terre, plongée jusqu\'à la fenêtre', emotion: 'Émerveillement, vertige' },
  { id: 'declic', bars: [4, 7], image: 'Léa à sa fenêtre, le carnet, son œil, le lac qui devient réel', emotion: 'Intimité, manque, puis l\'étincelle' },
  { id: 'decision', bars: [8, 11], image: 'Elle se lève, prépare le voyage, les amis disent oui, commande, colis, sac', emotion: 'L\'excitation qui monte' },
  { id: 'depart', bars: [12, 14], image: 'Clac de la boucle, escalier, train, retrouvailles, premiers pas', emotion: 'L\'élan, on retient son souffle' },
  { id: 'montagne', bars: [15, 19], image: 'Crête de Seceda, Tre Cime, la main tendue, lac de Sorapis', emotion: 'Le souffle coupé, la joie' },
  { id: 'coureur-cycliste', bars: [20, 26], image: 'Le coureur (balcon, impact, descente, torrent), la cycliste (lac doré, épingle, col)', emotion: 'Adrénaline, puis liberté' },
  { id: 'bivouac', bars: [27, 30], image: 'La nuit, le feu, elle publie, le bivouac sous la Voie lactée', emotion: 'Chaleur, apaisement, tendresse' },
  { id: 'final', bars: [31, 33], image: 'Bus de nuit, l\'inconnu, remontée jusqu\'en orbite, les tracés', emotion: 'L\'espoir, le cycle recommence' },
  { id: 'logo', bars: [34, 34], image: 'Le logo', emotion: 'La signature' },
].map((s) => ({ ...s, t: [r6(filmBar(s.bars[0])), r6(s.id === 'logo' ? 60 : filmBar(s.bars[1] + 1))] }))
  .map((s) => ({ ...s, frames: s.t.map((t) => Math.round(t * V3.fps)) }));

export function buildBeatsV4() {
  const T = V3.beat;
  const segs = montageV4Segments();
  const joins = joinsV4();
  const segAt = (t) => segs.find((s) => t >= s.film[0] - 1e-6 && t < s.film[1] - 1e-6);
  const secAt = (t) => SECTIONS_V4.find((s) => t >= s.t[0] - 1e-6 && t < s.t[1] - 1e-6)?.id ?? 'logo';
  const songBarBeat = (song) => {
    const q = Math.round((song - V3.m40) / T);
    return { bar: Math.floor(q / 4) + 40, beat: ((q % 4) + 4) % 4 + 1, offGridMs: Math.round((song - (V3.m40 + q * T)) * 1e4) / 10 };
  };
  const keyMoments = [
    { id: 'soleil', label: 'Allumage du Soleil : attaque de la 2e phrase de l\'intro (morceau 3,900 s) + impact-soleil', t: V4.sun },
    { id: 'drop1', label: 'Drop 1 du morceau (m40), crête de Seceda', t: filmBar(15) },
    { id: 'drop2', label: 'Drop 2 du morceau, 7 dernières mesures (m81), entrée du coureur', t: filmBar(20) },
    { id: 'nuit', label: 'Outro du morceau (m88) : le drop s\'arrête, la nuit tombe', t: filmBar(27) },
    { id: 'reprise', label: 'Reprise (m69), bus de nuit ; roulement dans m71 (mesure 33 du film, temps 3)', t: filmBar(31) },
    { id: 'roulement', label: 'Roulement de m71 (temps 3), vers l\'impact', t: filmBar(33, 3) },
    { id: 'impact', label: 'Coup final : m72 temps 1 + impact-logo', t: V4.hit },
  ].map((k) => ({ ...k, t: r6(k.t), ...frameOf(k.t) }));
  const beats = [];
  for (let k = 0; k * T < 60 - 1e-9; k++) {
    const t = k * T;
    const s = segAt(t);
    const song = s ? t + s.off : null;
    const bb = song != null ? songBarBeat(song) : null;
    const join = joins.find((j) => Math.abs(j.t - t) < 1e-4);
    beats.push({ i: k, t: r6(t), ...frameOf(t), filmBar: Math.floor(k / 4) + 1, filmBeat: (k % 4) + 1, downbeat: k % 4 === 0,
      section: secAt(t), segment: s?.id ?? null, song: song != null ? r6(song) : null,
      songBar: bb?.bar ?? null, songBeat: bb?.beat ?? null, songOffGridMs: bb && Math.abs(bb.offGridMs) > 5 ? bb.offGridMs : 0,
      join: join ? `${join.from}→${join.to}` : null, key: keyMoments.filter((m) => Math.abs(m.t - t) < 1e-4).map((m) => m.id) });
  }
  const bars = beats.filter((b) => b.downbeat).map((b) => ({ bar: b.filmBar, t: b.t, frame: b.frame, errMs: b.errMs, section: b.section,
    songBar: b.songBar, songOffGridMs: b.songOffGridMs, join: b.join, key: b.key }));
  return {
    version: 'v4', file: 'qa/mix-v4.wav', stems: ['qa/mix-v4-musique.wav', 'qa/mix-v4-habillage.wav'],
    fps: V3.fps, bpm: r6(60 / T), beatSec: T, barSec: r6(4 * T), framesPerBeat: r6(T * V3.fps),
    note: 'Grille mesurée sur storm-ii.mp3. t en s du film ; frame = image entière la plus proche à 24 i/s ; errMs = frame/24 − t en ms. filmBar = mesure du film (1 = image 0). song = temps du morceau joué à cet instant ; songOffGridMs ≠ 0 : le segment (intro) n\'est pas calé sur la grille du morceau (jeu libre), voir intro.attaques.',
    sections: SECTIONS_V4,
    segments: segs.map((s) => ({ id: s.id, section: s.section, label: s.label, songBars: s.bars, join: s.join,
      film: s.film.map(r6), song: s.film.map((t) => r6(t + s.off)), frames: s.film.map((t) => Math.round(t * V3.fps)) })),
    joins: joins.map((j) => ({ ...j, t: r6(j.t), songOut: r6(j.songOut), songIn: r6(j.songIn), ...frameOf(j.t) })),
    habillage: habillageV4Cues().map((c) => ({ ...c, at: r6(c.at), ...frameOf(c.at) })),
    keyMoments, bars, beats,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const i = process.argv.indexOf('--out');
  const out = i > 0 ? process.argv[i + 1] : BEATS_V4;
  const j = buildBeatsV4();
  writeFileSync(out, JSON.stringify(j, null, 1) + '\n');
  console.log(`✓ ${out} : ${j.beats.length} temps, ${j.bars.length} mesures, ${j.sections.length} sections, ${j.joins.length} raccords, ${j.keyMoments.length} moments clés`);
}
