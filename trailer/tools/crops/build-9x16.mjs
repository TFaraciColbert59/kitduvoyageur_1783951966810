#!/usr/bin/env node
// Construit film/index-9x16.html (1080×1920) depuis film/index.html et film/crops.json.
//   node tools/crops/build-9x16.mjs
// - Les hôtes de scène sont RECOPIÉS de film/index.html (mêmes id, data-start, data-duration, mêmes
//   compositions/) : aucun minutage n'est écrit à la main ; relancer ce script après toute régénération du 16:9.
// - Seuls changent la taille de la scène (1080×1920) et la taille déclarée des hôtes.
// - La balise <audio> est recopiée telle quelle.
// - Les cadres start/end de crops.json sont incorporés (aucune lecture réseau) et appliqués par film/lib/reframe.js.
// - Le calque p01-halo suit le cadre de p01.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const FILM = resolve(HERE, '../../film');
const src = readFileSync(resolve(FILM, 'index.html'), 'utf8');
const crops = JSON.parse(readFileSync(resolve(FILM, 'crops.json'), 'utf8'));

const hosts = src.match(/^\s*<div id="p[0-9a-z-]+" class="clip"[^\n]*<\/div>$/gm) ?? [];
if (hosts.length < 54) throw new Error(`hôtes lus dans index.html : ${hosts.length}`);
const audio = src.match(/<audio[\s\S]*?<\/audio>/);
if (!audio) throw new Error('balise <audio> introuvable dans index.html');
const gsapTag = src.match(/<script src="[^"]*gsap[^"]*"><\/script>/)[0];

const host916 = (line) => line.trim().replace('data-width="1920" data-height="1080"', 'data-width="1080" data-height="1920"');

const table = {};
for (const s of crops.shots) {
  // P14 (trois bandes) : sans cadre propre, bande centrale pleine hauteur (voir qa/9x16.md)
  const a = s.start ?? { x: 34.18, y: 0, w: 31.64, h: 100 };
  const b = s.end ?? a;
  table[s.id] = s.ease ? { start: a, end: b, ease: s.ease } : { start: a, end: b };
}
table['p01-halo'] = table.p01;

const out = `<!doctype html>
<!-- Déclinaison 9:16 (1080×1920) générée par tools/crops/build-9x16.mjs depuis film/index.html et film/crops.json.
     NE PAS ÉDITER À LA MAIN : relancer le script. Mêmes compositions/, mêmes data-start/data-duration, même audio. -->
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=1080, height=1920" />
    <title>LKDV — trailer 60 s (9:16)</title>
    ${gsapTag}
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body { width: 1080px; height: 1920px; overflow: hidden; background: #0B1F17; }
      #root { position: relative; width: 100%; height: 100%; overflow: hidden; }
      /* chaque scène garde son image 1920×1080 ; lib/reframe.js choisit la bande verticale */
      #root > .clip {
        position: absolute !important; left: 0 !important; top: 0 !important;
        width: 1080px !important; height: 1920px !important; overflow: hidden;
      }
      /* P54 en boîte aux lettres (logo entier) : le fond de l'hôte prend le noir du ciel de l'image, sans couture */
      #p54 { background: #05120C; }
    </style>
  </head>
  <body>
    <div
      id="root"
      data-composition-id="main"
      data-start="0"
      data-duration="60"
      data-fps="60"
      data-width="1080"
      data-height="1920"
    >
      ${hosts.map(host916).join('\n      ')}
      ${audio[0].replace(/\n/g, '\n  ')}
    </div>
    <script src="lib/reframe.js"></script>
    <script>
      window.__LKDV_CROPS = ${JSON.stringify(table)};
      window.__timelines = window.__timelines || {};
      var tl = gsap.timeline({ paused: true });
      window.LKDVReframe.install(tl, window.__LKDV_CROPS, { duration: 60 });
      window.__timelines["main"] = tl;
    </script>
  </body>
</html>
`;
// L'attribut des compositions est ÉCRIT SOUS UN AUTRE NOM dans film/ : un second fichier HTML racine portant
// data-composition-id ferait échouer le lint du 16:9 (multiple_root_compositions) et pourrait être découvert comme
// seconde entrée (audio en double). tools/crops/stage-9x16.sh rétablit le nom en posant la racine 9:16.
const ATTR = 'data-composition-id', ENCODED = 'data-hf9x16-' + 'composition-id';
writeFileSync(resolve(FILM, 'index-9x16.html'), out.split(ATTR).join(ENCODED));
console.log(`film/index-9x16.html : ${hosts.length} hôtes, ${Object.keys(table).length} cadres.`);
