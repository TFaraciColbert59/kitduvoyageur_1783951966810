#!/usr/bin/env node
// Banc d'essai de la LUT dans le vrai moteur de HyperFrames (projet trailer/grade-lab).
//   node tools/grade/lab.mjs
// 1. copie les images d'essai dans grade-lab/assets/samples/ (ignoré par git) ;
// 2. écrit grade-lab/index.html : une image par seconde, plein cadre (object-fit: contain) ;
// 3. pour chaque variante (neutre, 60 %, 100 %, 130 %), applique la grille par `hyperframes media-treatment`
//    et capture chaque image par `hyperframes snapshot` dans grade-lab/samples/renders/<variante>/.
// Les mesures (measure.mjs) comparent ensuite les captures neutres et étalonnées : même moteur des deux côtés.
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, writeFileSync, readdirSync, existsSync, rmSync, renameSync } from 'node:fs';
import { resolve, dirname, basename, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const TRAILER = resolve(HERE, '../..');
const LAB = resolve(TRAILER, 'grade-lab');

export const SAMPLES = [
  ['astronaut', 'grade-lab/samples/dl/astronaut.png', 'visage, lumière studio (NASA, domaine public)'],
  ['coffee', 'grade-lab/samples/dl/coffee.png', 'intérieur ambré, bois (CC0)'],
  ['rocket', 'grade-lab/samples/dl/rocket.jpg', 'heure bleue + lampes au sodium (domaine public)'],
  ['hubble', 'grade-lab/samples/dl/hubble_deep_field.jpg', 'ciel profond, étoiles (NASA, domaine public)'],
  ['chelsea', 'grade-lab/samples/dl/chelsea.png', 'pelage chaud, intérieur (CC0)'],
  ['sac-planche', 'assets/ref/sac-lkdv-one-45.png', 'rendu 3D du LKDV ONE 45, vert olive'],
  ['sac-40', 'assets/ref/lkdv-one-45-40.png', 'rendu 3D du LKDV ONE 45, 3/4'],
  ['nuancier', 'grade-lab/samples/mires/nuancier.png', 'mire : gris + couleurs clés'],
  ['aube-rose', 'grade-lab/samples/mires/aube-rose.png', 'mire : aube rose'],
  ['midi-lac', 'grade-lab/samples/mires/midi-lac-turquoise.png', 'mire : midi, lac turquoise'],
  ['heure-doree', 'grade-lab/samples/mires/heure-doree.png', 'mire : heure dorée'],
  ['feu-nuit', 'grade-lab/samples/mires/feu-de-nuit.png', 'mire : feu de camp de nuit'],
  ['voie-lactee', 'grade-lab/samples/mires/voie-lactee.png', 'mire : Voie lactée'],
  ['interieur', 'grade-lab/samples/mires/interieur-ambre.png', 'mire : intérieur ambré'],
];

export const VARIANTS = {
  neutre: null,
  '60': { lut: { src: 'assets/luts/lkdv-trailer.cube', intensity: 0.6 } },
  '100': { lut: { src: 'assets/luts/lkdv-trailer.cube', intensity: 1 } },
  '130': { lut: { src: 'assets/luts/lkdv-trailer-130.cube', intensity: 1 } },
};

function writeIndex() {
  const dst = resolve(LAB, 'assets/samples');
  mkdirSync(dst, { recursive: true });
  const imgs = SAMPLES.map(([id, src], i) => {
    const ext = extname(src);
    copyFileSync(resolve(TRAILER, src), resolve(dst, id + ext));
    return `      <img id="s-${id}" class="clip plate" src="assets/samples/${id}${ext}" alt="" data-start="${i}" data-duration="1" data-track-index="0" />`;
  });
  const html = `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=1920, height=1080" />
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.15.0/dist/gsap.min.js"></script>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body { width: 1920px; height: 1080px; overflow: hidden; background: #000; }
      #root { position: relative; width: 100%; height: 100%; }
      .plate { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain; }
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-duration="${SAMPLES.length}" data-width="1920" data-height="1080">
${imgs.join('\n')}
    </div>
    <script>
      const tl = gsap.timeline({ paused: true });
      window.__timelines["main"] = tl;
    </script>
  </body>
</html>
`;
  writeFileSync(resolve(LAB, 'index.html'), html);
}

const hf = (args) => execFileSync('npx', ['hyperframes', ...args], { cwd: LAB, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

function run() {
  writeIndex();
  const only = process.argv.slice(2);
  for (const [name, grading] of Object.entries(VARIANTS)) {
    if (only.length && !only.includes(name)) continue;
    hf(['media-treatment', '--selector', '.plate', '--clear', '--json']);
    if (grading) hf(['media-treatment', '--selector', '.plate', '--grading', JSON.stringify(grading), '--apply', '--json']);
    const out = resolve(LAB, 'samples/renders', name);
    if (existsSync(out)) rmSync(out, { recursive: true });
    const at = SAMPLES.map((_, i) => (i + 0.5).toString()).join(',');
    hf(['snapshot', '.', '--at', at, '--no-end', '--output', out, '--timeout', '90000']);
    // renomme les captures avec l'identifiant de l'image
    const files = readdirSync(out).filter((f) => f.endsWith('.png')).sort((a, b) => parseFloat(a.replace(/[^\d.]/g, '')) - parseFloat(b.replace(/[^\d.]/g, '')));
    files.forEach((f, i) => SAMPLES[i] && renameSync(resolve(out, f), resolve(out, SAMPLES[i][0] + '.png')));
    console.log(`${name}: ${files.length} captures -> ${out}`);
  }
  // l'index du laboratoire reste sur la variante 100 % (preuve de l'application par media-treatment)
  hf(['media-treatment', '--selector', '.plate', '--clear', '--json']);
  hf(['media-treatment', '--selector', '.plate', '--grading', JSON.stringify(VARIANTS['100']), '--apply', '--json']);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) run();
