#!/usr/bin/env node
// Extrait le tableau « Découpage seconde par seconde » de trailer/TRAME-60s.md
// et écrit trailer/film/shots.json (source unique du minutage).
// Recopie fidèle : aucun texte corrigé, aucune image arrondie.
// Refuse d'écraser un shots.json existant sans --force.
//
//   node tools/timeline/trame-to-shots.mjs [--force] [--stdout]

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const trailer = resolve(here, "../..");
const tramePath = resolve(trailer, "TRAME-60s.md");
const outPath = resolve(trailer, "film/shots.json");
const force = process.argv.includes("--force");
const toStdout = process.argv.includes("--stdout");

const md = readFileSync(tramePath, "utf8");
const lines = md.split("\n");
const start = lines.findIndex((l) => l.startsWith("| Plan | Temps"));
if (start < 0) throw new Error("Tableau du découpage introuvable dans TRAME-60s.md");

const cells = (l) => l.split("|").slice(1, -1).map((c) => c.trim());
const shots = [];
let act = null;
for (let i = start + 2; i < lines.length; i++) {
  const l = lines[i];
  if (!l.startsWith("|")) break;
  const c = cells(l);
  const m = /^\*\*ACTE (\d+) — (.+)\*\*$/.exec(c[0]);
  if (m) {
    act = { number: Number(m[1]), name: m[2] };
    continue;
  }
  const [plan, temps, images, source, cadre, action, raccord] = c;
  const pm = /^P(\d{2})$/.exec(plan);
  if (!pm) throw new Error(`Ligne inattendue : ${l}`);
  const fm = /^(\d+)–(\d+)$/.exec(images);
  if (!fm) throw new Error(`Images illisibles pour ${plan} : ${images}`);

  // Source : « img07 + E1 », « img35a→35b », « img05→04→03 », « img39 + code », « code ».
  const parts = source.split("+").map((s) => s.trim());
  const sources = [];
  let screen = null;
  let code = false;
  for (const p of parts) {
    if (p === "code") code = true;
    else if (/^E\d+$/.test(p)) screen = p;
    else if (p.startsWith("img")) {
      const chain = p.split("→").map((s) => s.trim());
      for (const [k, s] of chain.entries()) sources.push(k === 0 ? s : `img${s}`);
    } else throw new Error(`Source illisible pour ${plan} : ${source}`);
  }
  for (const s of sources) if (!/^img\d{2}[ab]?$/.test(s)) throw new Error(`Nom d'image inattendu ${s} (${plan})`);

  shots.push({
    id: `p${pm[1]}`,
    act: { ...act },
    startFrame: Number(fm[1]),
    endFrame: Number(fm[2]),
    sources,
    screen,
    code,
    star: action.includes("★"),
    sourceLabel: source,
    timeLabel: temps,
    cadre,
    action,
    raccord,
  });
}

const doc = {
  $comment:
    "Source unique du minutage du trailer. Extrait de TRAME-60s.md (v4.1) par tools/timeline/trame-to-shots.mjs. Les images (60 i/s) font foi ; startFrame inclus, endFrame exclu.",
  fps: 60,
  width: 1920,
  height: 1080,
  totalFrames: 3600,
  shots,
};
const json = JSON.stringify(doc, null, 2) + "\n";
if (toStdout) {
  process.stdout.write(json);
} else {
  if (existsSync(outPath) && !force) {
    console.error(`✗ ${outPath} existe déjà ; relancer avec --force pour l'écraser.`);
    process.exit(1);
  }
  writeFileSync(outPath, json);
  console.log(`✓ ${shots.length} plans écrits dans film/shots.json`);
}
