#!/usr/bin/env node
// Génère le squelette HyperFrames du trailer à partir de film/shots.json :
//   film/index.html            racine « main », 60 s, 54 hôtes p01…p54, piste de clics
//   film/compositions/pNN.html une carte provisoire par plan + un emplacement d'image
//
// Un fichier n'est réécrit que s'il est absent ou encore dans son état généré
// (marqueur « hf-skeleton generated » + empreinte intacte). Une scène retouchée à la
// main, ou sans marqueur (scène d'un autre agent), est laissée telle quelle, sauf --force.
//
//   node tools/timeline/build-skeleton.mjs [--force] [--only p06,p07] [--dry-run]
//
// La zone d'images de chaque scène reflète film/assets/footage/ (voir sync-footage.mjs).

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  FILM,
  FPS,
  TOTAL_FRAMES,
  loadShots,
  stampGenerated,
  generatedState,
  renderFootageRegion,
  footageFile,
  FOOTAGE_BEGIN,
  FOOTAGE_END,
} from "./lib.mjs";

const args = process.argv.slice(2);
const force = args.includes("--force");
const dryRun = args.includes("--dry-run");
const onlyIdx = args.indexOf("--only");
const only = onlyIdx >= 0 ? new Set(args[onlyIdx + 1].split(",")) : null;

// Teintes des actes : palette LKDV + dominantes réelles, toutes sombres pour un texte Stone lisible.
export const ACT_COLORS = {
  1: { bg: "#14233F", name: "bleu nuit (espace)" },
  2: { bg: "#2E4A63", name: "ardoise bleue (nuages, heure bleue)" },
  3: { bg: "#1D5E5E", name: "turquoise profond (le lac)" },
  4: { bg: "#17402C", name: "Forest" },
  5: { bg: "#4A6B45", name: "Sage foncé" },
  6: { bg: "#7A5A1E", name: "ambre (lever de soleil)" },
  7: { bg: "#4B4A44", name: "pierre (Tofana)" },
  8: { bg: "#646A1E", name: "or olive (mélèzes)" },
  9: { bg: "#8A3E1A", name: "orange brûlé (le feu)" },
  10: { bg: "#0B1F17", name: "encre" },
};
const STONE = "#FAF8F5";
const INK = "#0B1F17";

const sec = (frames) => String(frames / FPS); // représentation JS complète : tombe sur l'image exacte
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const plain = (s) => s.replace(/\*\*/g, "");
const frDec = (x, d = 2) => x.toFixed(d).replace(".", ",");

const footageDir = resolve(FILM, "assets/footage");
const fileOf = (src) => footageFile(footageDir, src);

function sceneHtml(shot) {
  const id = shot.id;
  const frames = shot.endFrame - shot.startFrame;
  const color = ACT_COLORS[shot.act.number];
  const P = id.toUpperCase();
  const source = shot.sources.length || shot.code ? shot.sourceLabel : "—";
  const actLabel = `Acte ${shot.act.number} · ${shot.act.name}`;
  const region = renderFootageRegion(shot, fileOf);
  return `<template>
  <style>
    #root {
      position: absolute;
      inset: 0;
      overflow: hidden;
      background: ${color.bg};
      font-family: "Inter", sans-serif;
      color: ${STONE};
    }
    .${id}-card {
      position: absolute;
      inset: 0;
      padding: 96px 120px 120px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }
    .${id}-top {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      font-family: "JetBrains Mono", monospace;
      font-size: 34px;
      letter-spacing: 0.14em;
      text-transform: uppercase;
    }
    .${id}-mid {
      display: flex;
      align-items: flex-end;
      gap: 72px;
    }
    .${id}-num {
      font-weight: 900;
      font-size: 360px;
      line-height: 0.8;
      letter-spacing: -0.04em;
    }
    .${id}-meta {
      display: flex;
      flex-direction: column;
      gap: 18px;
      padding-bottom: 8px;
    }
    .${id}-source {
      font-family: "JetBrains Mono", monospace;
      font-weight: 700;
      font-size: 64px;
    }
    .${id}-frames {
      font-family: "JetBrains Mono", monospace;
      font-size: 36px;
    }
    .${id}-star {
      font-weight: 700;
      font-size: 40px;
      letter-spacing: 0.1em;
      text-transform: uppercase;
    }
    .${id}-intent {
      max-width: 1600px;
      font-size: 52px;
      line-height: 1.2;
      font-weight: 400;
    }
    .${id}-track {
      position: absolute;
      left: 0;
      right: 0;
      bottom: 0;
      height: 12px;
      background: rgba(250, 248, 245, 0.18);
    }
    .${id}-bar {
      position: absolute;
      inset: 0;
      background: ${STONE};
      transform-origin: 0 50%;
    }
    .${id}-frame {
      position: absolute;
      inset: 0;
      overflow: hidden;
    }
    .${id}-shot,
    .${id}-shot-inner {
      position: absolute;
      inset: 0;
    }
    .${id}-shot {
      opacity: 0;
    }
    .${id}-shot-img {
      position: absolute;
      left: 0;
      top: 0;
      width: 1920px;
      height: 1080px;
      /* Remplit le 16:9 sans déformer, quel que soit le rapport de l'image : recadrage au centre. */
      object-fit: cover;
      object-position: 50% 50%;
    }
  </style>
  <div id="root" data-composition-id="${id}" data-width="1920" data-height="1080" data-duration="${sec(frames)}">
    <!-- Carte provisoire : outil de travail, disparaît quand l'image du plan est là. -->
    <div id="${id}-card" class="${id}-card" data-shot="${id}" data-act="${shot.act.number}">
      <div id="${id}-top" class="${id}-top">
        <span id="${id}-act">${esc(actLabel)}</span>
        <span id="${id}-range">${shot.startFrame}–${shot.endFrame}</span>
      </div>
      <div id="${id}-mid" class="${id}-mid">
        <div id="${id}-num" class="${id}-num">${P}</div>
        <div id="${id}-meta" class="${id}-meta">
          <div id="${id}-source" class="${id}-source">${esc(source)}</div>
          <div id="${id}-frames" class="${id}-frames">${frames} images · ${frDec(frames / FPS)} s</div>${
            shot.star ? `\n          <div id="${id}-star" class="${id}-star">★ plan d'échelle</div>` : ""
          }
        </div>
      </div>
      <div id="${id}-intent" class="${id}-intent">${esc(plain(shot.action))}</div>
      <div id="${id}-track" class="${id}-track"><div id="${id}-bar" class="${id}-bar"></div></div>
    </div>
    <!-- Emplacement d'image plein cadre : ${shot.sources.length ? shot.sources.map((s) => `assets/footage/${s}.png`).join(", ") : "aucune image (plan en code)"}.
         Chaque calque : .${id}-shot (opacité, séquence) > .${id}-shot-inner (libre pour le mouvement) > img. -->
    <div id="${id}-frame" class="${id}-frame" data-layout-allow-overflow>
      ${FOOTAGE_BEGIN}${region}${FOOTAGE_END}
    </div>
  </div>
  <script>
    (function () {
      var D = ${frames} / ${FPS};
      var tl = gsap.timeline({ paused: true });
      // Barre de progression : se remplit sur la durée du plan.
      tl.fromTo("#${id}-bar", { scaleX: 0 }, { scaleX: 1, duration: D, ease: "none" }, 0);
      // Images présentes : chaque source occupe sa part égale du plan (ordre de la trame) ;
      // la carte reste visible là où l'image manque.
      var shots = Array.prototype.slice.call(document.querySelectorAll(".${id}-shot"));
      if (shots.length) {
        var n = Number(shots[0].getAttribute("data-seq-count"));
        var bySeq = {};
        shots.forEach(function (el) { bySeq[el.getAttribute("data-seq")] = el; });
        for (var k = 0; k < n; k++) {
          var t = (k * D) / n;
          var el = bySeq[String(k)];
          shots.forEach(function (other) {
            tl.set(other, { opacity: other === el ? 1 : 0 }, t);
          });
          tl.set("#${id}-card", { opacity: el ? 0 : 1 }, t);
        }
      }
      window.__timelines["${id}"] = tl;
    })();
  </script>
</template>
`;
}

function indexHtml(shots) {
  const hosts = shots
    .map((s) => {
      const f = s.endFrame - s.startFrame;
      return `      <div id="${s.id}" class="clip" data-composition-id="${s.id}" data-composition-src="compositions/${s.id}.html" data-start="${sec(s.startFrame)}" data-duration="${sec(f)}" data-frames="${s.startFrame}-${s.endFrame}" data-track-index="1" data-track-kind="graphics" data-width="1920" data-height="1080"></div>`;
    })
    .join("\n");
  return `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=1920, height=1080" />
    <title>LKDV — trailer 60 s (squelette P1)</title>
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.15.0/dist/gsap.min.js"></script>
    <style>
      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }
      html,
      body {
        width: 1920px;
        height: 1080px;
        overflow: hidden;
        background: ${INK};
      }
      #root {
        position: relative;
        width: 100%;
        height: 100%;
      }
    </style>
  </head>
  <body>
    <!-- Minutage : film/shots.json (source unique). Hôtes générés par tools/timeline/build-skeleton.mjs. -->
    <div
      id="root"
      data-composition-id="main"
      data-start="0"
      data-duration="${sec(TOTAL_FRAMES)}"
      data-fps="${FPS}"
      data-width="1920"
      data-height="1080"
    >
${hosts}
      <!-- Piste provisoire : clics sur les temps du montage. À remplacer par assets/audio/storm-ii-montage-60s.wav. -->
      <audio
        id="music"
        data-timeline-role="music"
        src="assets/audio/click-60s.wav"
        data-start="0"
        data-duration="${sec(TOTAL_FRAMES)}"
        data-track-index="2"
        data-volume="1"
      ></audio>
    </div>
    <script>
      window.__timelines = window.__timelines || {};
      window.__timelines["main"] = gsap.timeline({ paused: true });
    </script>
  </body>
</html>
`;
}

function writeGuarded(path, id, html, note) {
  const state = existsSync(path) ? generatedState(readFileSync(path, "utf8")) : "absent";
  if ((state === "edited" || state === "foreign") && !force) {
    console.log(`  · ${id} : laissé tel quel (${state === "edited" ? "retouché à la main" : "pas de marqueur de génération"} ; --force pour écraser)`);
    return "kept";
  }
  const out = stampGenerated(id, html, note);
  if (state !== "absent" && readFileSync(path, "utf8") === out) return "same";
  if (!dryRun) writeFileSync(path, out);
  return state === "absent" ? "created" : "rewritten";
}

const { shots } = loadShots();
mkdirSync(resolve(FILM, "compositions"), { recursive: true });
const counts = {};
const bump = (k) => (counts[k] = (counts[k] || 0) + 1);
for (const shot of shots) {
  if (only && !only.has(shot.id)) continue;
  bump(writeGuarded(resolve(FILM, `compositions/${shot.id}.html`), shot.id, sceneHtml(shot), "carte provisoire générée par tools/timeline/build-skeleton.mjs depuis film/shots.json ; toute retouche hors de la zone hf-footage la soustrait au générateur"));
}
if (!only) bump(writeGuarded(resolve(FILM, "index.html"), "main", indexHtml(shots), "racine générée par tools/timeline/build-skeleton.mjs depuis film/shots.json ; toute retouche la soustrait au générateur"));
console.log(`${dryRun ? "(à blanc) " : ""}${JSON.stringify(counts)}`);
