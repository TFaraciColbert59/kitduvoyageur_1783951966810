// Outils communs du squelette de timeline (lecture de shots.json, temps du montage musical).
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const TRAILER = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
export const FILM = resolve(TRAILER, "film");
export const FPS = 60;
export const TOTAL_FRAMES = 3600;

// `--file <chemin>` (ou SHOTS_FILE) remplace film/shots.json, pour les essais du validateur.
export function loadShots() {
  const i = process.argv.indexOf("--file");
  const p = i > 0 ? resolve(process.argv[i + 1]) : process.env.SHOTS_FILE || resolve(FILM, "shots.json");
  return JSON.parse(readFileSync(p, "utf8"));
}

// Tableau « Montage de 60 s » de MUSIQUE.md : [film début, film fin, morceau début, morceau fin] (s).
export const MONTAGE = [
  [0.0, 5.41, 66.085, 71.495],
  [5.41, 33.48, 71.495, 99.565],
  [33.48, 47.47, 141.565, 155.555],
  [47.47, 51.0, 155.555, 159.085],
  [51.0, 58.0, 120.545, 127.545],
  [58.0, 60.0, 127.545, 129.545],
];

// Repères du film (CONVENTIONS.md) en secondes.
export const MARKERS = [5.41, 33.48, 47.47, 51.0, 58.0];

// ---------------------------------------------------------------------------
// Scènes générées : marqueur d'origine et zone d'images.
//
// Première ligne d'un fichier généré :
//   <!-- hf-skeleton generated id=p06 sha256=<16 hex> — ... -->
// L'empreinte porte sur le fichier SANS cette ligne et avec la zone d'images vidée,
// pour que sync-footage puisse basculer carte ↔ image sans « salir » la scène.
// Toute autre retouche change l'empreinte : build-skeleton refuse alors d'écraser.
// ---------------------------------------------------------------------------
import { createHash } from "node:crypto";

export const FOOTAGE_BEGIN = "<!-- hf-footage:begin (zone réécrite par tools/timeline/sync-footage.mjs) -->";
export const FOOTAGE_END = "<!-- hf-footage:end -->";
const DOCTYPE = "<!doctype html>\n";
// Le marqueur suit le doctype quand il y en a un (index.html doit commencer par <!doctype html>).
const MARK_RE = /^(<!doctype html>\n)?<!-- hf-skeleton generated id=(\S+) sha256=([0-9a-f]{16})[^\n]*-->\n/;

export function footageRegionBounds(html) {
  const a = html.indexOf(FOOTAGE_BEGIN);
  const b = html.indexOf(FOOTAGE_END);
  if (a < 0 || b < 0 || b < a) return null;
  return { start: a + FOOTAGE_BEGIN.length, end: b };
}

export function replaceFootageRegion(html, inner) {
  const r = footageRegionBounds(html);
  if (!r) throw new Error("zone hf-footage absente");
  return html.slice(0, r.start) + inner + html.slice(r.end);
}

export function readFootageRegion(html) {
  const r = footageRegionBounds(html);
  return r ? html.slice(r.start, r.end) : null;
}

function bodyForHash(html) {
  let body = html.replace(MARK_RE, (_, d) => d || "");
  if (footageRegionBounds(body)) body = replaceFootageRegion(body, "");
  return body;
}

export function hashOf(html) {
  return createHash("sha256").update(bodyForHash(html)).digest("hex").slice(0, 16);
}

export function stampGenerated(id, html, note) {
  const mark = `<!-- hf-skeleton generated id=${id} sha256=${hashOf(html)} — ${note} -->\n`;
  return html.startsWith(DOCTYPE) ? DOCTYPE + mark + html.slice(DOCTYPE.length) : mark + html;
}

/** "absent" | "generated" (intact) | "edited" (marqueur présent, contenu retouché) | "foreign" (pas de marqueur). */
export function generatedState(html) {
  const m = MARK_RE.exec(html);
  if (!m) return "foreign";
  return m[3] === hashOf(html) ? "generated" : "edited";
}

export const FOOTAGE_EXTS = [".png", ".jpg", ".jpeg", ".webp"];

/** Nom du fichier de `src` présent dans `dir` (png de préférence), sinon null. */
export function footageFile(dir, src) {
  for (const ext of FOOTAGE_EXTS) if (existsSync(resolve(dir, src + ext))) return src + ext;
  return null;
}

/**
 * Zone d'images d'un plan : un calque par source présente, dans l'ordre de la trame.
 * `fileOf(src)` renvoie le nom du fichier dans film/assets/footage/, ou null s'il manque.
 */
export function renderFootageRegion(shot, fileOf, indent = "      ") {
  const n = shot.sources.length;
  const parts = [];
  shot.sources.forEach((src, k) => {
    const file = fileOf(src);
    if (!file) return;
    const id = `${shot.id}-shot-${k + 1}`;
    parts.push(
      `${indent}<div id="${id}" class="${shot.id}-shot" data-src="${src}" data-seq="${k}" data-seq-count="${n}">\n` +
        `${indent}  <div id="${id}-inner" class="${shot.id}-shot-inner">\n` +
        `${indent}    <img id="${id}-img" class="${shot.id}-shot-img" src="assets/footage/${file}" alt="" />\n` +
        `${indent}  </div>\n` +
        `${indent}</div>`,
    );
  });
  return parts.length ? `\n${parts.join("\n")}\n${indent.slice(2)}` : "";
}

const EPS = 1e-6;

/**
 * Temps du montage : chaque temps du morceau tombant dans un segment [début, fin[
 * est reporté en temps de film. Renvoie [{ film, song, index, downbeat, segment }].
 */
export function filmBeats() {
  const beats = JSON.parse(readFileSync(resolve(TRAILER, "assets/audio/storm-ii.beats.json"), "utf8")).beatTimes;
  const out = [];
  MONTAGE.forEach(([f0, f1, s0, s1], segment) => {
    beats.forEach((b, index) => {
      if (b >= s0 - EPS && b < s1 - EPS) {
        const film = +(f0 + (b - s0)).toFixed(6);
        if (film < f1 - EPS) out.push({ film, song: b, index, downbeat: index % 4 === 3, segment: segment + 1 });
      }
    });
  });
  return out.sort((a, b) => a.film - b.film);
}
