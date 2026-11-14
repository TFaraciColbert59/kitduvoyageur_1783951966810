#!/usr/bin/env node
// Piste de clics provisoire, libre de droits, générée par ffmpeg :
//   film/assets/audio/click-60s.wav — 48 kHz, mono, 16 bits, exactement 60,000 s.
// Un tic sur chaque temps du montage (temps du morceau reportés en temps de film,
// tableau « Montage de 60 s » de MUSIQUE.md), un tic accentué sur chaque premier
// temps de mesure (indice % 4 == 3), un accent distinct aux cinq repères du film.
//
//   node tools/timeline/build-click.mjs [--list]

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname } from "node:path";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { FILM, MARKERS, filmBeats } from "./lib.mjs";

const beats = filmBeats();
const events = beats.map((b) => ({ t: b.film, kind: b.downbeat ? "down" : "beat", index: b.index }));
// Repères : remplacent le temps qui tombe dessus (à 10 ms près), sinon s'ajoutent.
for (const m of MARKERS) {
  const hit = events.find((e) => Math.abs(e.t - m) < 0.01);
  if (hit) hit.kind = "marker";
  else events.push({ t: m, kind: "marker", index: null });
}
events.sort((a, b) => a.t - b.t);

if (process.argv.includes("--list")) {
  for (const e of events) console.log(e.t.toFixed(3), e.kind, e.index ?? "");
}

// Trois sons : tic 1 kHz court, accent 1,6 kHz plus fort, repère = 440 Hz + 880 Hz long.
const SOUNDS = {
  beat: "sine=frequency=1000:sample_rate=48000:duration=0.030,volume=0.35,afade=t=out:st=0.010:d=0.020",
  down: "sine=frequency=1600:sample_rate=48000:duration=0.050,volume=0.70,afade=t=out:st=0.015:d=0.035",
  marker:
    "aevalsrc=0.45*sin(2*PI*440*t)+0.35*sin(2*PI*880*t):s=48000:d=0.220,afade=t=out:st=0.040:d=0.180",
};
const kinds = Object.keys(SOUNDS);
const byKind = Object.fromEntries(kinds.map((k) => [k, events.filter((e) => e.kind === k)]));

let graph = "";
const labels = [];
kinds.forEach((k, ki) => {
  const list = byKind[k];
  if (!list.length) return;
  graph += `${SOUNDS[k]},asplit=${list.length}${list.map((_, i) => `[${k}${i}]`).join("")};\n`;
  list.forEach((e, i) => {
    const ms = Math.round(e.t * 48000) / 48; // à l'échantillon près
    graph += `[${k}${i}]adelay=delays=${ms.toFixed(4)}:all=1[${k}d${i}];\n`;
    labels.push(`[${k}d${i}]`);
  });
});
graph += `${labels.join("")}amix=inputs=${labels.length}:normalize=0:dropout_transition=0,aformat=sample_rates=48000:channel_layouts=mono,apad=pad_dur=2,atrim=end_sample=2880000[out]`;

const outDir = resolve(FILM, "assets/audio");
mkdirSync(outDir, { recursive: true });
const graphFile = resolve(mkdtempSync(resolve(tmpdir(), "lkdv-click-")), "graph.txt");
writeFileSync(graphFile, graph);
const out = resolve(outDir, "click-60s.wav");
execFileSync(
  "ffmpeg",
  ["-hide_banner", "-loglevel", "error", "-y", "-filter_complex_script", graphFile, "-map", "[out]", "-c:a", "pcm_s16le", out],
  { stdio: "inherit" },
);
rmSync(dirname(graphFile), { recursive: true, force: true });
const probe = execFileSync("ffprobe", ["-v", "error", "-show_entries", "stream=sample_rate,channels:format=duration", "-of", "json", out]).toString();
const p = JSON.parse(probe);
console.log(
  JSON.stringify({
    file: "film/assets/audio/click-60s.wav",
    duration: p.format.duration,
    sampleRate: p.streams[0].sample_rate,
    channels: p.streams[0].channels,
    beats: byKind.beat.length,
    downbeats: byKind.down.length,
    markers: byKind.marker.length,
    total: events.length,
  }),
);
