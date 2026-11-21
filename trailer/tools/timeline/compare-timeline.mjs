#!/usr/bin/env node
// Compare `npx hyperframes timeline --json` (absStart/absEnd) à film/shots.json, à l'image près.
// Sort en erreur si un plan manque, est en trop, ou si un bord s'écarte d'une image ou plus.
//
//   node tools/timeline/compare-timeline.mjs [--table]

import { execFileSync } from "node:child_process";
import { FILM, FPS, loadShots } from "./lib.mjs";

const raw = execFileSync("npx", ["hyperframes", "timeline", "--json"], { cwd: FILM, stdio: ["ignore", "pipe", "ignore"] }).toString();
const tl = JSON.parse(raw).timeline;
const rows = tl.tracks.flatMap((t) => t.rows).filter((r) => /^p\d{2}$/.test(r.id ?? ""));
const byId = new Map(rows.map((r) => [r.id, r]));
const { shots } = loadShots();
const errors = [];
const table = shots.map((s) => {
  const r = byId.get(s.id);
  if (!r) {
    errors.push(`${s.id} absent de la timeline`);
    return { id: s.id, missing: true };
  }
  const startF = r.absStart * FPS;
  const endF = r.absEnd * FPS;
  const dStart = Math.round(startF) - s.startFrame;
  const dEnd = Math.round(endF) - s.endFrame;
  // absStart/absEnd sont arrondis au millième par le CLI : on vérifie aussi start/end exacts.
  const exactStart = r.start * FPS - s.startFrame;
  const exactEnd = r.end * FPS - s.endFrame;
  if (dStart !== 0 || dEnd !== 0 || Math.abs(exactStart) > 1e-6 || Math.abs(exactEnd) > 1e-6)
    errors.push(`${s.id} : début ${dStart} i, fin ${dEnd} i (exact ${exactStart.toExponential(1)} / ${exactEnd.toExponential(1)})`);
  return { id: s.id, absStart: r.absStart, absEnd: r.absEnd, startFrame: s.startFrame, endFrame: s.endFrame, dStart, dEnd };
});
const extra = rows.filter((r) => !shots.some((s) => s.id === r.id)).map((r) => r.id);
if (extra.length) errors.push(`plans en trop : ${extra.join(", ")}`);
if (Math.abs(tl.duration - 60) > 1e-9) errors.push(`durée de la timeline ${tl.duration} s`);

if (process.argv.includes("--table"))
  for (const t of table) console.log(`${t.id}  ${t.absStart}–${t.absEnd} s  ${t.startFrame}–${t.endFrame}  écart ${t.dStart}/${t.dEnd}`);
console.log(JSON.stringify({ rows: rows.length, shots: shots.length, duration: tl.duration, mismatches: errors.length, maxAbsFrameOffset: Math.max(...table.map((t) => Math.max(Math.abs(t.dStart ?? 99), Math.abs(t.dEnd ?? 99)))) }));
if (errors.length) {
  for (const e of errors) console.error(`✗ ${e}`);
  process.exit(1);
}
console.error("✓ timeline = shots.json à l'image près");
