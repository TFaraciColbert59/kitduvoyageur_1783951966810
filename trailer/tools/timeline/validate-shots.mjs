#!/usr/bin/env node
// Contrôle de film/shots.json : 54 plans contigus de 0 à 3600, aucun au-delà de 120 images.
// Calcule aussi, pour chaque coupe, l'écart en images au temps de musique le plus proche
// (temps du morceau reportés en temps de film par le tableau « Montage de 60 s » de MUSIQUE.md).
// Ne déplace aucune coupe.
//
//   node tools/timeline/validate-shots.mjs [--json] [--markdown]

import { loadShots, filmBeats, FPS, TOTAL_FRAMES } from "./lib.mjs";

const asJson = process.argv.includes("--json");
const asMd = process.argv.includes("--markdown");
const { shots } = loadShots();
const errors = [];

if (shots.length !== 54) errors.push(`${shots.length} plans au lieu de 54`);
if (shots[0]?.startFrame !== 0) errors.push(`le premier plan commence à ${shots[0]?.startFrame}, pas à 0`);
if (shots.at(-1)?.endFrame !== TOTAL_FRAMES) errors.push(`le dernier plan finit à ${shots.at(-1)?.endFrame}, pas à ${TOTAL_FRAMES}`);
shots.forEach((s, i) => {
  const expectedId = `p${String(i + 1).padStart(2, "0")}`;
  if (s.id !== expectedId) errors.push(`plan n° ${i + 1} nommé ${s.id} au lieu de ${expectedId}`);
  if (!Number.isInteger(s.startFrame) || !Number.isInteger(s.endFrame)) errors.push(`${s.id} : images non entières`);
  const len = s.endFrame - s.startFrame;
  if (len <= 0) errors.push(`${s.id} : durée ${len} images`);
  if (len > 120) errors.push(`${s.id} : ${len} images (> 120)`);
  if (i > 0 && shots[i - 1].endFrame !== s.startFrame)
    errors.push(`${shots[i - 1].id} finit à ${shots[i - 1].endFrame} mais ${s.id} commence à ${s.startFrame}`);
});

const beats = filmBeats();
const cuts = shots.slice(1).map((s, i) => {
  const t = s.startFrame / FPS;
  let best = beats[0];
  for (const b of beats) if (Math.abs(b.film - t) < Math.abs(best.film - t)) best = b;
  const offsetFrames = +((t - best.film) * FPS).toFixed(2);
  return {
    cut: `${shots[i].id}→${s.id}`,
    frame: s.startFrame,
    filmTime: +t.toFixed(4),
    beatFilm: best.film,
    beatSong: best.song,
    beatIndex: best.index,
    downbeat: best.downbeat,
    offsetFrames,
  };
});

const abs = cuts.map((c) => Math.abs(c.offsetFrames));
const summary = {
  ok: errors.length === 0,
  shots: shots.length,
  totalFrames: shots.at(-1)?.endFrame,
  longest: Math.max(...shots.map((s) => s.endFrame - s.startFrame)),
  shortest: Math.min(...shots.map((s) => s.endFrame - s.startFrame)),
  beatsInMontage: beats.length,
  cuts: cuts.length,
  maxAbsOffsetFrames: Math.max(...abs),
  meanAbsOffsetFrames: +(abs.reduce((a, b) => a + b, 0) / abs.length).toFixed(3),
  cutsWithin1Frame: abs.filter((a) => a <= 1).length,
  errors,
};

if (asJson) {
  console.log(JSON.stringify({ ...summary, table: cuts }, null, 2));
} else if (asMd) {
  console.log("| Coupe | Image | Film (s) | Temps le plus proche, film (s) | Morceau (s) | Indice | 1er temps | Écart (images) |");
  console.log("|---|---|---|---|---|---|---|---|");
  for (const c of cuts)
    console.log(
      `| ${c.cut} | ${c.frame} | ${c.filmTime.toFixed(4)} | ${c.beatFilm.toFixed(3)} | ${c.beatSong.toFixed(3)} | ${c.beatIndex} | ${c.downbeat ? "oui" : ""} | ${c.offsetFrames >= 0 ? "+" : ""}${c.offsetFrames.toFixed(2)} |`,
    );
} else {
  for (const c of cuts)
    console.log(`${c.cut.padEnd(9)} image ${String(c.frame).padStart(4)}  temps ${c.beatFilm.toFixed(3)} s  écart ${c.offsetFrames >= 0 ? "+" : ""}${c.offsetFrames.toFixed(2)} i${c.downbeat ? "  (1er temps)" : ""}`);
  const { errors: _e, ...rest } = summary;
  console.log(JSON.stringify(rest));
}
if (errors.length) {
  for (const e of errors) console.error(`✗ ${e}`);
  process.exit(1);
}
if (!asJson && !asMd) console.error("✓ shots.json valide");
