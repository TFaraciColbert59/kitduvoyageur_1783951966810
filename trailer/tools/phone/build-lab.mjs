// Construit la démonstration phone-lab : une scène par plaque d'essai, capture réelle de l'app
// derrière la plaque percée, poussée + léger roulis sur 1,5 s.
// Usage : node tools/phone/build-lab.mjs <dossier des plaques détectées (…/out)>
import fs from 'node:fs';
import path from 'node:path';

const here = path.dirname(new URL(import.meta.url).pathname);
const lab = path.resolve(here, '../../phone-lab');
const screensSrc = path.resolve(here, '../../assets/screens');
const outDir = process.argv[2];
const DUR = 1.5;

// plaque -> écrans (états successifs, fondu entre from et to en secondes locales)
const SCENES = [
  { id: 'front', screens: ['E05a-kit-studio-contenu', 'E06-kit-studio-commander'], states: [{ i: 1, from: 0.55, to: 0.95 }] },
  { id: 'flat', screens: ['E02b-compas-ou-saisi', 'E02c-compas-preparation'], states: [{ i: 1, from: 0.6, to: 0.9 }] },
  { id: 'macro', screens: ['E06-kit-studio-commander'], states: [], focusY: 0.42 },
  { id: 'strap', screens: ['E03-compas-nous'], states: [] },
  { id: 'front-white', screens: ['E05b-kit-studio-bilan'], states: [] },
  // vraies images de Tony (détection dans qa/tmp/phone, dossier ignoré par git)
  { id: 'img40', dir: 'qa/tmp/phone', screens: ['E02a-compas-ou-vide', 'E02b-compas-ou-saisi'], states: [{ i: 1, from: 0.3, to: 0.7 }] },
  { id: 'img43', dir: 'qa/tmp/phone', screens: ['E06-kit-studio-commander'], states: [], focusY: 0.6 },
];

fs.mkdirSync(path.join(lab, 'assets/plates'), { recursive: true });
fs.mkdirSync(path.join(lab, 'assets/screens'), { recursive: true });
fs.mkdirSync(path.join(lab, 'compositions'), { recursive: true });

const hosts = [];
SCENES.forEach((s, n) => {
  const sid = 'pl-' + s.id;
  const dir = s.dir ? path.resolve(here, '../..', s.dir) : outDir;
  const data = JSON.parse(fs.readFileSync(path.join(dir, s.id + '.screen.json'), 'utf8'));
  fs.copyFileSync(path.join(dir, s.id + '.keyed.png'), path.join(lab, 'assets/plates', s.id + '.keyed.png'));
  for (const e of s.screens) fs.copyFileSync(path.join(screensSrc, e + '.png'), path.join(lab, 'assets/screens', e + '.png'));
  const phone = {
    corners: data.corners,
    radius: data.cornerRadiusPx || 0,
    blur: data.focusBlurSigmaPx || 0,
    ambient: data.ambient,
  };
  const c = data.corners;
  // centre de la poussée : centre de l'écran visible (ou repère donné)
  const cx = c.reduce((a, p) => a + p[0], 0) / 4;
  let cy = c.reduce((a, p) => a + p[1], 0) / 4;
  if (s.focusY) cy = 1080 * s.focusY;
  const layers = s.screens
    .map((e, i) => `        <img id="${sid}-s${i}" class="ph-layer" src="assets/screens/${e}.png" alt="" style="opacity:${i === 0 ? 1 : 0}" />`)
    .join('\n');
  const states = s.states.map((st) => ({ sel: `#${sid}-s${st.i}`, from: st.from, to: st.to }));
  const html = `<template>
  <link rel="stylesheet" href="lib/phone/phone.css" />
  <style>
    #root { position: absolute; inset: 0; overflow: hidden; background: #0B1F17; }
  </style>
  <div id="root" data-composition-id="${sid}" data-width="1920" data-height="1080" data-layout-allow-overflow>
    <div id="${sid}-cam" class="ph-cam">
      <div id="${sid}-screen" class="ph-screen" data-phone='${JSON.stringify(phone)}'>
${layers}
        <div class="ph-tint"></div>
        <div class="ph-glare"></div>
      </div>
      <img id="${sid}-plate" class="ph-plate" src="assets/plates/${s.id}.keyed.png" alt="" />
    </div>
  </div>
  <script src="lib/phone/phone.js"></script>
  <script>
    (function () {
      var D = ${DUR}, CX = ${cx.toFixed(1)}, CY = ${cy.toFixed(1)};
      var cam = document.getElementById('${sid}-cam');
      var scr = document.getElementById('${sid}-screen');
      var timing = { states: ${JSON.stringify(states)} };
      function ease(p) { return p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2; }
      function pose(t) {
        var p = ease(Math.max(0, Math.min(1, t / D)));
        return { s: 1 + 0.07 * p, r: -1.4 * p, x: -26 * p, y: -10 * p };
      }
      function apply(t) {
        var a = pose(t), b = pose(Math.max(0, t - 1 / 60));
        cam.style.transformOrigin = CX + 'px ' + CY + 'px';
        cam.style.transform = 'translate(' + a.x.toFixed(2) + 'px,' + a.y.toFixed(2) + 'px) rotate(' + a.r.toFixed(3) + 'deg) scale(' + a.s.toFixed(4) + ')';
        var speed = Math.hypot(a.x - b.x, a.y - b.y, (a.s - b.s) * 900, (a.r - b.r) * 15) * 60;
        window.LKDVPhone.render(scr, t, { x: a.x, y: a.y, speed: speed }, timing);
      }
      var st = { t: 0 };
      var tl = gsap.timeline({ paused: true });
      tl.fromTo(st, { t: 0 }, { t: D, duration: D, ease: 'none', onUpdate: function () { apply(st.t); } }, 0);
      apply(0);
      window.__timelines = window.__timelines || {};
      window.__timelines['${sid}'] = tl;
    })();
  </script>
</template>
`;
  fs.writeFileSync(path.join(lab, 'compositions', sid + '.html'), html);
  hosts.push(`      <div id="${sid}" data-composition-id="${sid}" data-composition-src="compositions/${sid}.html" data-start="${(n * DUR).toFixed(2)}" data-duration="${DUR}" data-track-index="1" data-track-kind="graphics" data-width="1920" data-height="1080"></div>`);
});

const total = (SCENES.length * DUR).toFixed(2);
const index = `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=1920, height=1080" />
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.15.0/dist/gsap.min.js"></script>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body { width: 1920px; height: 1080px; overflow: hidden; background: #0B1F17; }
      #root { position: relative; width: 100%; height: 100%; }
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-duration="${total}" data-width="1920" data-height="1080">
${hosts.join('\n')}
    </div>
    <script>
      window.__timelines = window.__timelines || {};
      window.__timelines["main"] = gsap.timeline({ paused: true });
    </script>
  </body>
</html>
`;
fs.writeFileSync(path.join(lab, 'index.html'), index);
console.log('phone-lab :', SCENES.length, 'scènes,', total, 's');
