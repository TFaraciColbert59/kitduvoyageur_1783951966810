#!/usr/bin/env node
// Remplace les cartes provisoires par les images de Tony, sans toucher au minutage.
//
// Pour chaque image attendue par film/shots.json (img01 … img49, img09b, img35a, img35b) :
//   - présente dans trailer/assets/footage/ (source de Tony, jamais modifiée) :
//     copiée dans film/assets/footage/ (recopiée si elle a changé), et la ou les scènes
//     qui l'utilisent basculent de la carte vers l'image ;
//   - absente : sa copie dans film/assets/footage/ est retirée et la scène rebascule
//     vers la carte (aucune référence à un fichier absent).
// Seule la zone « hf-footage » des scènes est réécrite ; une scène sans cette zone
// (scène écrite par un autre agent, p. ex. p52–p54 de cosmos-vfx) est signalée et laissée.
// Idempotent. Formats acceptés : .png (préféré), .jpg, .jpeg, .webp. L'image remplit le
// cadre 16:9 sans déformation (object-fit: cover, recadrage au centre) quel que soit son rapport.
//
//   node tools/timeline/sync-footage.mjs [--dry-run] [--json]

import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { TRAILER, FILM, FOOTAGE_EXTS, footageFile, loadShots, readFootageRegion, renderFootageRegion, replaceFootageRegion } from "./lib.mjs";

const dryRun = process.argv.includes("--dry-run");
const asJson = process.argv.includes("--json");
const SRC_DIR = resolve(TRAILER, "assets/footage");
const DST_DIR = resolve(FILM, "assets/footage");

const sha = (p) => createHash("sha256").update(readFileSync(p)).digest("hex");
const dims = (p) => {
  try {
    const o = execFileSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0", p]).toString().trim();
    const [w, h] = o.split(",").map(Number);
    return { width: w, height: h };
  } catch {
    return null;
  }
};

const { shots } = loadShots();
const expected = [...new Set(shots.flatMap((s) => s.sources))].sort();
const report = { copied: [], unchanged: [], removed: [], missing: [], notes: [], scenes: { toImage: [], toCard: [], partial: [], same: [], skipped: [] } };

if (!dryRun) mkdirSync(DST_DIR, { recursive: true });

// 1. Copies.
for (const src of expected) {
  const from = existsSync(SRC_DIR) ? footageFile(SRC_DIR, src) : null;
  // Copies obsolètes (autre extension, ou source disparue).
  for (const ext of FOOTAGE_EXTS) {
    const name = src + ext;
    const p = resolve(DST_DIR, name);
    if (existsSync(p) && name !== from) {
      if (!dryRun) rmSync(p);
      report.removed.push(name);
    }
  }
  if (!from) {
    report.missing.push(src);
    continue;
  }
  const a = resolve(SRC_DIR, from);
  const b = resolve(DST_DIR, from);
  if (existsSync(b) && statSync(a).size === statSync(b).size && sha(a) === sha(b)) report.unchanged.push(from);
  else {
    if (!dryRun) copyFileSync(a, b);
    report.copied.push(from);
  }
  const d = dims(a);
  if (!d) report.notes.push(`${from} : dimensions illisibles (ffprobe)`);
  else if (Math.abs(d.width / d.height - 16 / 9) > 0.01)
    report.notes.push(`${from} : ${d.width}×${d.height}, rapport ${(d.width / d.height).toFixed(3)} ≠ 16:9, recadrée au centre`);
}
// Fichiers inattendus dans la source : signalés, jamais touchés.
if (existsSync(SRC_DIR))
  for (const f of readdirSync(SRC_DIR)) {
    const base = f.replace(/\.[^.]+$/, "");
    if (!expected.includes(base)) report.notes.push(`assets/footage/${f} : non attendu par shots.json, ignoré`);
  }

// 2. Scènes.
const fileOf = (src) => (dryRun ? (existsSync(SRC_DIR) ? footageFile(SRC_DIR, src) : null) : footageFile(DST_DIR, src));
for (const shot of shots) {
  if (!shot.sources.length) continue;
  const path = resolve(FILM, `compositions/${shot.id}.html`);
  if (!existsSync(path)) {
    report.scenes.skipped.push(`${shot.id} (fichier absent)`);
    continue;
  }
  const html = readFileSync(path, "utf8");
  const current = readFootageRegion(html);
  if (current === null) {
    report.scenes.skipped.push(`${shot.id} (pas de zone hf-footage)`);
    continue;
  }
  const next = renderFootageRegion(shot, fileOf);
  const present = shot.sources.filter((s) => fileOf(s)).length;
  if (current === next) {
    report.scenes.same.push(shot.id);
    continue;
  }
  if (!dryRun) writeFileSync(path, replaceFootageRegion(html, next));
  if (present === 0) report.scenes.toCard.push(shot.id);
  else if (present < shot.sources.length) report.scenes.partial.push(`${shot.id} (${present}/${shot.sources.length})`);
  else report.scenes.toImage.push(shot.id);
}

const imageScenes = shots.filter((s) => s.sources.length && s.sources.every((x) => fileOf(x))).map((s) => s.id);
if (asJson) console.log(JSON.stringify({ dryRun, ...report, scenesOnImage: imageScenes }, null, 2));
else {
  console.log(`${dryRun ? "(à blanc) " : ""}images : ${report.copied.length} copiées, ${report.unchanged.length} inchangées, ${report.removed.length} retirées, ${report.missing.length}/${expected.length} manquantes`);
  console.log(`scènes : → image ${report.scenes.toImage.join(" ") || "—"} · → carte ${report.scenes.toCard.join(" ") || "—"} · partielles ${report.scenes.partial.join(" ") || "—"} · inchangées ${report.scenes.same.length} · ignorées ${report.scenes.skipped.join(" ") || "—"}`);
  console.log(`plans sur image : ${imageScenes.length ? imageScenes.join(" ") : "aucun"}`);
  for (const n of report.notes) console.log(`  · ${n}`);
}
