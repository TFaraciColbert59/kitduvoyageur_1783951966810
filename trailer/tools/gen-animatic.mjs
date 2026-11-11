// Génère BEATMAP.md, compositions/animatic.html et les boîtes grises des scènes absentes.
// Usage : node tools/gen-animatic.mjs [--force-placeholders]
import { writeFileSync, existsSync, mkdirSync } from "node:fs";
import { SCENES, SECONDS, MARKS, SEAMS, EXTRA_PLATES, MOTION_NOTE, FPS, DURATION, BPM } from "./beatmap.mjs";

const force = process.argv.includes("--force-placeholders");
const tc = (t) => { const r = Math.round(t * 1000) / 1000, f = Math.round((r % 1) * 1000); return `0:${String(Math.floor(r)).padStart(2, "0")}${f ? "," + String(f).padStart(3, "0").replace(/0+$/, "") : ""}`; };
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const acts = { 1: "Ouverture", 2: "Descente", 3: "Le groupe", 4: "Confiance et terrain", 5: "Le relais", 6: "Retour et envol", 7: "Signature" };

// ── BEATMAP.md
let md = `# BEATMAP — LKDV Trailer 60 s\n\nGénéré par \`node tools/gen-animatic.mjs\` depuis \`tools/beatmap.mjs\` (source unique). Ne pas éditer à la main.\n\n`;
md += `- ${BPM} BPM · temps = 0,5 s (30 images) · croche = 0,25 s (15 images) · double-croche = 0,125 s (7,5 images : arrondir \`Math.round(i * 7.5)\` depuis l'index, jamais par cumul) · mesure = 2 s\n- ${DURATION} s · ${FPS} i/s · ${DURATION * FPS} images · image n = n / ${FPS} s\n- Chocs : 0:06, 0:12, 0:46 · silences d'un demi-temps : 0:11,5, 0:37,0, 0:45,5 · respirations sans interface : 0:12,0–0:12,5, 0:32,5–0:33,0, 0:50\n\n`;
md += `## Hôtes de la composition racine\n\n| id | fichier | début | fin | z | agent | rôle |\n| --- | --- | --- | --- | --- | --- | --- |\n`;
for (const s of SCENES) md += `| \`${s.id}\` | \`compositions/${s.id}.html\` | ${s.start} | ${s.start + s.dur} | ${s.z} | ${s.owner} | ${s.role} |\n`;
md += `\nL'hôte \`animatic\` n'est pas dans \`index.html\` : il vit dans \`animatic/index.html\` (même projet, liens vers \`assets/\` et \`compositions/\`).\n`;
md += `\nLe temps local d'une scène = temps du film − début de son hôte.\n\n## Marqueurs\n\n| Temps | Image | Nature | Note |\n| --- | --- | --- | --- |\n`;
for (const m of MARKS) md += `| ${tc(m.t)} | ${Math.round(m.t * FPS)} | ${m.kind} | ${m.note} |\n`;
md += `\n## Seconde par seconde\n\n| T | Acte | Idée unique | Cosmos (WebGL) | Plan au sol | Interface (sans phrases) | Son |\n| --- | --- | --- | --- | --- | --- | --- |\n`;
for (const s of SECONDS) md += `| ${tc(s.t)} | ${s.act} | **${s.idea}** | ${s.cosmos || "—"} | ${s.plate || "—"} | ${s.ui || "—"} | ${s.son || "—"} |\n`;
md += `\n## Raccords entre fichiers\n\n| Temps | De | Vers | État exact au raccord |\n| --- | --- | --- | --- |\n`;
for (const s of SEAMS) md += `| ${s.t} | ${s.a} | ${s.b} | ${s.rule} |\n`;
md += `\n## Plans au sol ajoutés au jeu v3\n\n| Fichier | Emploi | Contenu |\n| --- | --- | --- |\n`;
for (const p of EXTRA_PLATES) md += `| \`${p.id}\` | ${p.use} | ${p.note} |\n`;
md += `\n## Mouvement des plans au sol\n\n${MOTION_NOTE}\n\n## Éléments d'interface qui durent plus de 1,5 s (prévus par le storyboard)\n\nLe réticule et l'altimètre (6,0–11,5 : instrument de caméra, seul élément inventé), la pile de pictos (7,0–11,0 : un picto de plus par seconde), la grille des 38 objets (18,0–21,75 : change d'état à chaque temps), le suivi de Tom (36,0–39,0 : pause, lecture, distance qui monte). Chacun doit changer visiblement au moins une fois par temps ; aucun autre élément ne reste plus de 1,5 s.\n`;
writeFileSync("BEATMAP.md", md);

// ── animatic.html : une étiquette par seconde + témoin de temps + bannière des marqueurs
mkdirSync("compositions", { recursive: true });
let cards = "";
for (const s of SECONDS) {
  cards += `    <div id="an-s${s.t}" class="clip an-card" data-start="${s.t}" data-duration="1" data-track-index="${s.t % 2}">
      <span class="an-tc">${tc(s.t)}</span><span class="an-act">ACTE ${s.act} · ${esc(acts[s.act])}</span>
      <span class="an-idea">${esc(s.idea)}</span>
      <span class="an-ui">${esc(s.ui || "—")}</span>
    </div>\n`;
}
let marks = "";
MARKS.forEach((m, i) => {
  const d = Math.min(0.5, DURATION - m.t);
  marks += `    <div id="an-m${i}" class="clip an-mark an-${m.kind.replace(/[^a-z]/gi, "")}" data-start="${m.t}" data-duration="${d}" data-track-index="2">${esc(m.kind.toUpperCase())}</div>\n`;
});
const animatic = `<template>
  <style>
    #root { position: absolute; inset: 0; font-family: "IBM Plex Mono", monospace; pointer-events: none; }
    .an-card { position: absolute; left: 40px; right: 40px; bottom: 28px; height: 92px; padding: 10px 18px; border-radius: 12px;
      background: rgb(20 25 22 / 0.72); color: #fff; display: grid; grid-template-columns: 120px 1fr; grid-template-rows: 22px 26px 22px; column-gap: 18px; align-items: center; }
    .an-tc { grid-row: 1 / 4; font-size: 44px; font-weight: 600; font-variant-numeric: tabular-nums; }
    .an-act { font-size: 14px; letter-spacing: 0.14em; opacity: 0.7; }
    .an-idea { font-size: 22px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .an-ui { font-size: 14px; opacity: 0.8; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .an-mark { position: absolute; right: 40px; top: 28px; padding: 8px 16px; border-radius: 999px; background: #C89A3B; color: #141916; font-size: 20px; font-weight: 600; letter-spacing: 0.1em; }
    .an-choc { background: #A8443A; color: #fff; } .an-silence { background: #fff; color: #141916; } .an-logo { background: #5B7F55; color: #fff; }
    #an-beat { position: absolute; left: 40px; top: 28px; width: 28px; height: 28px; border-radius: 50%; background: #fff; }
  </style>
  <div id="root" data-composition-id="animatic" data-width="1920" data-height="1080" data-layout-ignore>
    <div id="an-beatwrap" class="clip" data-start="0" data-duration="${DURATION}" data-track-index="3"><div id="an-beat"></div></div>
${cards}${marks}  </div>
  <script>
    (function () {
      const tl = gsap.timeline({ paused: true });
      for (let b = 0; b < ${DURATION * 2}; b++) {
        tl.fromTo("#an-beat", { opacity: 1, scale: b % 4 === 0 ? 1.7 : 1.2 }, { opacity: 0.2, scale: 1, duration: 0.22, ease: "power2.out" }, b * 0.5);
      }
      window.__timelines["animatic"] = tl;
    })();
  </script>
</template>
`;
writeFileSync("compositions/animatic.html", animatic);

// ── boîtes grises des scènes sans fichier
for (const s of SCENES) {
  if (s.id === "animatic") continue;
  const f = `compositions/${s.id}.html`;
  if (existsSync(f) && !force) continue;
  const ground = s.id.startsWith("gnd-");
  const bg = ground ? "rgb(122 122 118)" : s.id === "cosmos" ? "transparent" : "transparent";
  const html = `<template>
  <!-- BOÎTE GRISE (P1) — à remplacer par ${s.owner}. Hôte : ${s.start} s → ${s.start + s.dur} s, z ${s.z}. ${s.role} -->
  <style>
    #root { position: absolute; inset: 0; }
    #${s.id}-box { position: absolute; inset: 0; background: ${bg}; }
    #${s.id}-tag { position: absolute; ${ground ? "left: 40px; top: 80px" : s.id === "cosmos" ? "left: 40px; top: 130px" : "right: 40px; top: 80px"}; padding: 6px 12px; border-radius: 8px; background: rgb(20 25 22 / 0.6); color: #fff; font: 600 16px "IBM Plex Mono", monospace; letter-spacing: 0.08em; }
  </style>
  <div id="root" data-composition-id="${s.id}" data-width="1920" data-height="1080" data-layout-ignore>
    <div id="${s.id}-box"></div>
    <div id="${s.id}-tag">${s.id.toUpperCase()} · PLACEHOLDER</div>
  </div>
  <script>
    (function () {
      const tl = gsap.timeline({ paused: true });
      tl.fromTo("#${s.id}-tag", { opacity: 0.4 }, { opacity: 1, duration: ${s.dur}, ease: "none" }, 0);
      window.__timelines["${s.id}"] = tl;
    })();
  </script>
</template>
`;
  writeFileSync(f, html);
  console.log("placeholder", f);
}
console.log("BEATMAP.md, compositions/animatic.html écrits");
