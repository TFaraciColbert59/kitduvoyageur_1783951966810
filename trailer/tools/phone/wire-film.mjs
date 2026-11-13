#!/usr/bin/env node
// Branche l'incrustation téléphone dans les plans du film (film/compositions/pNN.html).
// Ajout seulement : images cachées (plaque recadrée + captures), lib/phone/phone.js, et la source du canvas
// remplacée par l'image incrustée (même caméra, même flou de mouvement ; durée et mouvement inchangés).
// Usage : node tools/phone/wire-film.mjs [pNN ...]   (sans argument : tous les plans de PLANS)
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../film');

// states : [capture, from, to] en images du plan (fondu de l'état sur [from, to]) ; le premier est plein dès 0.
export const PLANS = {
  // P09 : base incrustée (E01b) sous la photo du lac que le plan ouvre déjà (masque, pupille, raccord P10 inchangés)
  p09: { src: 'img07', states: [['E01b-carnet-jour1-photo']], direct: 'bx.drawImage(img, 0, 0, W, H);', loadLine: 'img.addEventListener("load", function () { mask = null; clock.redraw(); });' },
  p07: { src: 'img07', states: [['E01a-carnet-sorapis'], ['E01b-carnet-jour1-photo', 46, 56]], direct: 'bx.drawImage(img, 0, 0, W, H);' },
  p12: { src: 'img40', states: [['E02a-compas-ou-vide'], ['E02b-compas-ou-saisi', 10, 15], ['E02c-compas-preparation', 23, 28], ['E02d-compas-prepare', 35, 40]] },
  p13: { src: 'img41', states: [['E03-compas-nous']] },
  p15: { src: 'img41', states: [['E04-compas-cortina-carte']] },
  p16: { src: 'img42', states: [['E05a-kit-studio-contenu'], ['E05b-kit-studio-bilan', 50, 62]] },
  p17: { src: 'img43', states: [['E06-kit-studio-commander']] },
  p25: { src: 'img18', states: [['E07-explorer-depart']] },
  p29: { src: 'img46', states: [['E08-explorer-trace-6k4']] },
  p31: { src: 'img22', states: [['E09-carnet-moment-photo']] },
  p36: { src: 'img27', states: [['E10-explorer-en-course']] },
  p48: { src: 'img37', states: [['E11x-carnet-verdicts-vide']], level: 0.8, tint: 0.35 },
  p49: { src: 'img37', states: [['E12-carnet-partage-public']], level: 0.8, tint: 0.35 },
  p51: { src: 'img38', states: [['E13-communaute-carnets-semaine']], level: 0.8, tint: 0.35 },
};

function must(s, needle, id) {
  const n = s.split(needle).length - 1;
  if (n !== 1) throw new Error(`${id}: « ${needle} » trouvé ${n} fois`);
}

export function wire(id, cfg) {
  const file = path.join(ROOT, 'compositions', id + '.html');
  let s = fs.readFileSync(file, 'utf8');
  if (s.includes('lib/phone/phone.js')) { console.log(id, 'déjà branché'); return; }
  const meta = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/phone', cfg.src + '.json'), 'utf8'));
  const m = { box: meta.box, corners: meta.corners, radius: meta.radius, blur: meta.blur, ambient: meta.ambient };
  const imgs = [`        <img id="${id}-ph-plate" src="assets/phone/${cfg.src}.plate.png" alt="" />`]
    .concat(cfg.states.map((st, i) => `        <img id="${id}-ph-s${i}" src="assets/phone/screens/${st[0]}.png" alt="" />`));

  const canvasTag = `<canvas id="${id}-canvas"`;
  must(s, canvasTag, id);
  const canvasLine = s.slice(s.indexOf(canvasTag), s.indexOf('</canvas>', s.indexOf(canvasTag)) + '</canvas>'.length);
  s = s.replace(canvasLine, canvasLine + `\n    <!-- ui-builder : sources de l'incrustation (plaque percée + captures réelles), lues par le canvas -->\n    <div id="${id}-ph-src" class="${id}-ph-src" aria-hidden="true">\n${imgs.join('\n')}\n    </div>`);

  must(s, '  </style>', id);
  s = s.replace('  </style>', `    .${id}-ph-src { position: absolute; left: 0; top: 0; width: 2px; height: 2px; overflow: hidden; opacity: 0; pointer-events: none; }\n    .${id}-ph-src img { position: absolute; left: 0; top: 0; width: 2px; height: 2px; }\n  </style>`);

  must(s, '<script src="lib/fx/core.js"></script>', id);
  s = s.replace('<script src="lib/fx/core.js"></script>', '<script src="lib/fx/core.js"></script>\n  <script src="lib/phone/phone.js"></script>');

  const imgDecl = `var img = document.getElementById("${id}-shot-1-img");`;
  must(s, imgDecl, id);
  const states = cfg.states.map((st, i) => `{ img: document.getElementById("${id}-ph-s${i}")${st.length > 1 ? `, from: ${st[1]}, to: ${st[2]}` : ''} }`);
  const opts = [
    `base: img`,
    `plate: document.getElementById("${id}-ph-plate")`,
    `meta: ${JSON.stringify(m)}`,
    `states: [${states.join(', ')}]`,
    `cam: function (f) { return camAt(f); }`,
  ];
  if (cfg.level != null) opts.push(`level: ${cfg.level}`);
  if (cfg.tint != null) opts.push(`tint: ${cfg.tint}`);
  s = s.replace(imgDecl, imgDecl + `\n      // ui-builder : écran incrusté dans l'image source (suit la caméra du plan au pixel, flou de mouvement compris)\n      var PH = window.LKDVPhone.compositor({ ${opts.join(', ')} });\n      var SRC = img;`);

  if (cfg.direct) {
    // plan sans prise de vue multi-échantillons (P07) : la source incrustée remplace l'image dans le tampon
    must(s, cfg.direct, id);
    s = s.replace(cfg.direct, cfg.direct.replace('drawImage(img,', 'drawImage(PH.frame(f),'));
  } else {
  must(s, 'c2.drawImage(img, 0, 0, W, H);', id);
  s = s.replace('c2.drawImage(img, 0, 0, W, H);', 'c2.drawImage(SRC, 0, 0, W, H);');

  // la source incrustée est recalculée une fois par image, avant la prise de vue
  const clockAt = s.indexOf('FX.bindClock(');
  const shootCall = s.indexOf('shoot(camAt, f', clockAt);
  if (clockAt < 0 || shootCall < 0 || s.indexOf('shoot(camAt, f', shootCall + 1) >= 0) throw new Error(id + ': appel shoot introuvable ou multiple');
  const lineStart = s.lastIndexOf('\n', shootCall) + 1;
  const indent = s.slice(lineStart, shootCall);
  s = s.slice(0, lineStart) + indent + 'SRC = PH.frame(f);\n' + s.slice(lineStart);
  }

  const loadLine = cfg.loadLine || 'img.addEventListener("load", function () { clock.redraw(); });';
  must(s, loadLine, id);
  s = s.replace(loadLine, loadLine + `\n      Array.prototype.forEach.call(document.querySelectorAll("#${id}-ph-src img"), function (n) { n.addEventListener("load", function () { clock.redraw(); }); });`);

  fs.writeFileSync(file, s);
  console.log(id, 'branché', cfg.src, cfg.states.map((x) => x[0]).join(' → '));
}

const ids = process.argv.slice(2);
for (const id of ids.length ? ids : Object.keys(PLANS)) wire(id, PLANS[id]);
