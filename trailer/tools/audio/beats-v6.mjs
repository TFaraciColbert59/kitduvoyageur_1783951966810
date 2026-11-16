#!/usr/bin/env node
// Grille des montages v6 → qa/mix-v6x.beats.json (même format que la v4, 24 i/s) : temps, mesures, sections v6
// (frontières RÉELLES de la variante), segments du morceau, raccords, moments clés, preuve de non-répétition
// (intervalles du morceau réellement lus, fondus compris, triés, sans recouvrement). Les attaques de l'intro et les
// mesures sont ajoutées par tools/audio/audit-v3.py --v6x.
// Usage : node tools/audio/beats-v6.mjs A|B|C
import { writeFileSync } from 'node:fs';
import { V3, V6, V6_TAIL, filmBar, joinsV6, v6Paths, v6Segments } from './lib.mjs';

const r6 = (v) => Math.round(v * 1e6) / 1e6;
const frameOf = (t) => { const frame = Math.round(t * V3.fps); return { frame, errMs: Math.round((frame / V3.fps - t) * 1e5) / 100 }; };
const INFO = {
  cosmos: ['Nébuleuse, création, Terre, plongée jusqu\'à la fenêtre', 'Émerveillement, vertige'],
  declic: ['Léa, la photo du lac, on plonge dans l\'écran, le lac', 'Intimité, puis on est emporté'],
  decision: ['Elle se lève, prépare, chaque ami dit oui, le colis, le sac s\'assemble', 'L\'excitation qui monte'],
  depart: ['La boucle, l\'escalier, le train, les retrouvailles, les premiers pas', 'L\'élan'],
  montagne: ['Seceda, la main tendue, Tre Cime, Sorapis', 'Le souffle coupé : ample, épique'],
  'coureur-cycliste': ['Le coureur puis la cycliste', 'Adrénaline, liberté'],
  bivouac: ['Le bivouac, le feu, elle publie, la Voie lactée', 'Chaleur, tendresse'],
  final: ['Noah, la remontée, les tracés', 'L\'espoir'],
  logo: ['Le logo', 'La signature'],
};

export function buildBeatsV6(k) {
  const T = V3.beat;
  const segs = v6Segments(k);
  const joins = joinsV6(k);
  const sections = Object.entries(V6[k].sections).map(([id, [a, b]]) => {
    const t = [r6(filmBar(a)), r6(id === 'logo' ? 60 : filmBar(b + 1))];
    return { id, bars: [a, b], t, frames: t.map((x) => Math.round(x * V3.fps)), image: INFO[id][0], emotion: INFO[id][1] };
  });
  const segAt = (t) => segs.find((s) => t >= s.film[0] - 1e-6 && t < s.film[1] - 1e-6);
  const secAt = (t) => sections.find((s) => t >= s.t[0] - 1e-6 && t < s.t[1] - 1e-6)?.id ?? 'logo';
  const songBarBeat = (song) => {
    const q = Math.round((song - V3.m40) / T);
    return { bar: Math.floor(q / 4) + 40, beat: ((q % 4) + 4) % 4 + 1, offGridMs: Math.round((song - (V3.m40 + q * T)) * 1e4) / 10 };
  };
  const sec = (id) => sections.find((s) => s.id === id);
  const energy = { A: filmBar(17), B: filmBar(22), C: filmBar(21) }[k];
  const keyMoments = [
    { id: 'lac', label: 'Le lac (mesure 7 du film)', t: filmBar(7) },
    { id: 'grand-moment', label: 'Le panorama des Dolomites commence (Seceda)', t: sec('montagne').t[0] },
    { id: 'energie', label: 'L\'énergie pleine et percussive arrive', t: energy },
    { id: 'nuit', label: 'Le bivouac (la nuit)', t: sec('bivouac').t[0] },
    { id: 'final', label: 'Le final (l\'espoir)', t: sec('final').t[0] },
    { id: 'impact', label: 'Le coup du logo', t: filmBar(34) },
  ].map((m) => ({ ...m, t: r6(m.t), ...frameOf(m.t) }));
  const beats = [];
  for (let i = 0; i * T < 60 - 1e-9; i++) {
    const t = i * T;
    const s = segAt(t);
    const song = s ? t + s.off : null;
    const bb = song != null ? songBarBeat(song) : null;
    const join = joins.find((j) => Math.abs(j.t - t) < 1e-4);
    beats.push({ i, t: r6(t), ...frameOf(t), filmBar: Math.floor(i / 4) + 1, filmBeat: (i % 4) + 1, downbeat: i % 4 === 0,
      section: secAt(t), segment: s?.id ?? null, song: song != null ? r6(song) : null, songBar: bb?.bar ?? null, songBeat: bb?.beat ?? null,
      songOffGridMs: bb && Math.abs(bb.offGridMs) > 5 ? bb.offGridMs : 0, join: join ? `${join.from}→${join.to}` : null,
      key: keyMoments.filter((m) => Math.abs(m.t - t) < 1e-4).map((m) => m.id) });
  }
  const bars = beats.filter((b) => b.downbeat).map((b) => ({ bar: b.filmBar, t: b.t, frame: b.frame, errMs: b.errMs, section: b.section,
    songBar: b.songBar, songOffGridMs: b.songOffGridMs, join: b.join, key: b.key }));
  // intervalles du morceau réellement lus (avec les fondus)
  const read = segs.map((s, i) => {
    const pre = s.join === 'start' ? 0 : V3.guard + (s.join === 'long' ? s.xf : V3.xf);
    const end = i + 1 < segs.length ? s.film[1] - V3.guard : Math.min(60, filmBar(34) + V6_TAIL.after + V6_TAIL.decay);
    return { segment: s.id, song: [r6(s.film[0] - pre + s.off), r6(end + s.off)] };
  }).sort((a, b) => a.song[0] - b.song[0]);
  const overlaps = [];
  for (let i = 1; i < read.length; i++) if (read[i].song[0] < read[i - 1].song[1]) overlaps.push(`${read[i - 1].segment} / ${read[i].segment}`);
  return {
    version: `v6${k.toLowerCase()}`, variante: k, nom: V6[k].name, idee: V6[k].idee, file: `qa/mix-v6${k.toLowerCase()}.wav`, ecoute: `livraison/LKDV-musique-v6-${k}.m4a`,
    fps: V3.fps, bpm: r6(60 / T), beatSec: T, barSec: r6(4 * T), framesPerBeat: r6(T * V3.fps),
    note: 'Grille mesurée sur storm-ii.mp3. t en s du film ; frame = image entière la plus proche à 24 i/s ; errMs = frame/24 − t en ms. filmBar = mesure du film (1 = image 0). song = temps du morceau joué ; songOffGridMs ≠ 0 : segment hors grille (intro libre).',
    sections,
    segments: segs.map((s) => ({ id: s.id, label: s.label, join: s.join, xf: s.xf ?? null, film: s.film.map(r6), song: s.film.map((t) => r6(t + s.off)), frames: s.film.map((t) => Math.round(t * V3.fps)) })),
    joins: joins.map((j) => ({ ...j, t: r6(j.t), songOut: r6(j.songOut), songIn: r6(j.songIn), ...frameOf(j.t) })),
    nonRepetition: { intervallesLus: read, recouvrements: overlaps, ok: overlaps.length === 0 },
    keyMoments, bars, beats,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const k = (process.argv[2] || '').toUpperCase();
  const j = buildBeatsV6(k);
  const out = v6Paths(k).beats;
  writeFileSync(out, JSON.stringify(j, null, 1) + '\n');
  console.log(`✓ ${out} : ${j.beats.length} temps, ${j.bars.length} mesures, ${j.joins.length} raccords · non-répétition ${j.nonRepetition.ok ? 'OK' : 'ÉCHEC ' + j.nonRepetition.recouvrements.join(', ')}`);
  if (!j.nonRepetition.ok) process.exit(1);
}
