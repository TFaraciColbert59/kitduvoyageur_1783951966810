#!/usr/bin/env node
// Fabrique les images de test de l'outil de réception (synthétiques, petites, déterministes).
//   node tools/reception/make-fixtures.mjs
// fixtures/propre/  : chaque image doit passer (mesure des faux positifs).
// fixtures/defauts/ : chaque image porte UN défaut connu (liste dans fixtures/attendu.json).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, 'fixtures');
const W = 1920, H = 1080;

const svg = (body, w = W, h = H) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`;
const sky = (top, bottom, w = W, h = H) => `<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${top}"/><stop offset="1" stop-color="${bottom}"/></linearGradient></defs><rect width="${w}" height="${h}" fill="url(#sky)"/>`;
const mountains = (fill, dx = 0) => `<polygon transform="translate(${dx} 0)" fill="${fill}" points="-200,820 180,430 360,600 620,260 860,560 1040,380 1300,640 1520,300 1760,560 2120,420 2120,1080 -200,1080"/>`;
const tents = (dx = 0, glow = false) => `<g transform="translate(${dx} 0)"><path d="M700,900 Q800,760 900,900 Z" fill="${glow ? '#C9A05A' : '#7E9A78'}"/><path d="M1020,900 Q1120,770 1220,900 Z" fill="${glow ? '#E8C890' : '#E4DCC8'}"/><circle cx="960" cy="905" r="${glow ? 14 : 8}" fill="#E07A2A"/></g>`;

// Téléphone : corps noir arrondi, écran inset. opts.screen : couleur ou id de dégradé ; opts.blur
function phone({ cx, cy, w, h, rot = 0, screen = '#00FF00', blur = 0, glow = false, thumb = true }) {
  const sw = w - 24, sh = h - 24;
  const defs = [
    blur ? `<filter id="bl" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="${blur}"/></filter>` : '',
    glow ? '<filter id="gl" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="40"/></filter>' : '',
  ].join('');
  return `<defs>${defs}</defs>
  ${glow ? `<rect x="${cx - w / 2 - 60}" y="${cy - h / 2 - 60}" width="${w + 120}" height="${h + 120}" rx="80" fill="#00FF00" opacity="0.55" filter="url(#gl)" transform="rotate(${rot} ${cx} ${cy})"/>` : ''}
  <g transform="rotate(${rot} ${cx} ${cy})" ${blur ? 'filter="url(#bl)"' : ''}>
    <rect x="${cx - w / 2}" y="${cy - h / 2}" width="${w}" height="${h}" rx="40" fill="#0E0F10"/>
    <rect x="${cx - sw / 2}" y="${cy - sh / 2}" width="${sw}" height="${sh}" rx="30" fill="${screen}"/>
    ${thumb ? `<ellipse cx="${cx + 20}" cy="${cy + h / 2 - 10}" rx="55" ry="75" fill="#D9A989"/>` : ''}
  </g>`;
}
const hands = (cx, cy) => `<ellipse cx="${cx - 230}" cy="${cy + 160}" rx="190" ry="120" fill="#D8A888"/><ellipse cx="${cx + 230}" cy="${cy + 160}" rx="190" ry="120" fill="#D4A484"/>`;
const room = sky('#3A4A63', '#B88A5C');

// Fiche : fond gris neutre, quatre silhouettes vêtues de la couleur de référence
function fiche(colours) {
  let b = '<rect width="1920" height="1080" fill="#8C8C8C"/>';
  for (let i = 0; i < 4; i++) {
    const x = 300 + i * 400;
    b += `<circle cx="${x}" cy="230" r="70" fill="#C89A7A"/><rect x="${x - 110}" y="320" width="220" height="330" rx="40" fill="${colours[0]}"/>`;
    b += `<rect x="${x - 90}" y="650" width="180" height="330" fill="#6E6A66"/>`;
    if (colours[1]) b += `<rect x="${x - 70}" y="360" width="140" height="200" rx="20" fill="${colours[1]}"/>`;
  }
  return svg(b);
}
// Personnages en pied dans un paysage : [veste, sac?]
function group(people, bg = sky('#7D8FB8', '#E8C4B0')) {
  let b = bg + mountains('#9C8F94');
  people.forEach(([coat, bag], i) => {
    const x = 520 + i * 300;
    b += `<circle cx="${x}" cy="520" r="45" fill="#C89A7A"/><rect x="${x - 70}" y="575" width="140" height="210" rx="30" fill="${coat}"/><rect x="${x - 55}" y="785" width="110" height="200" fill="#5E5A57"/>`;
    if (bag) b += `<rect x="${x + 50}" y="580" width="70" height="170" rx="18" fill="${bag}"/>`;
  });
  return svg(b);
}
const lake = (water) => svg(sky('#6FA7D9', '#CFE3F0') + '<polygon fill="#D9CFCB" points="0,560 300,330 520,470 900,120 960,90 1020,140 1380,460 1640,320 1920,520 1920,600 0,600"/>' + `<rect y="600" width="1920" height="480" fill="${water}"/><rect y="600" width="1920" height="40" fill="#E9E4DA" opacity="0.5"/>`);

const LEA = '#1A4530', OLIVE = '#879838', SABLE = '#C6B089', SAUGE = '#A6BE9E', ENCRE = '#1F2C47';

const cases = {
  propre: {
    'img01.png': svg(sky('#03100B', '#0B2E46') + '<circle cx="1700" cy="1500" r="1100" fill="#1F4B7A"/>'),
    'img07.png': svg(room + hands(960, 560) + phone({ cx: 960, cy: 540, w: 300, h: 560, rot: 5 })),
    'img40.png': svg(room + hands(960, 560) + phone({ cx: 960, cy: 520, w: 240, h: 440, rot: -4, screen: '#FFFFFF' })),
    'img43.png': svg(room + '<rect x="300" y="560" width="1320" height="700" rx="50" fill="#00FF00"/><ellipse cx="900" cy="560" rx="110" ry="160" fill="#D9A989"/>'),
    'F1-lea.png': fiche([LEA, OLIVE]),
    'F2-sami.png': fiche([SABLE]),
    'F3-ines.png': fiche([SAUGE]),
    'F4-tom.png': fiche([ENCRE]),
    'img16.png': group([[LEA, OLIVE], [SABLE], [SAUGE], [ENCRE]]),
    'img35a.png': svg(sky('#1D2F6B', '#E39A7A') + mountains('#4B3A60') + tents()),
    'img35b.png': svg(sky('#050B1E', '#14204A') + mountains('#0E1530') + tents(0, true)),
    'img09.png': lake('#3FC1BE'),
    'img22.png': svg(sky('#6FA7D9', '#CFE3F0') + '<polygon fill="#D9CFCB" points="0,560 300,330 520,470 900,120 960,90 1020,140 1380,460 1640,320 1920,520 1920,600 0,600"/><rect y="600" width="1920" height="480" fill="#3FC1BE"/>' + `<rect x="1350" y="380" width="570" height="700" rx="60" fill="${LEA}"/><rect x="1450" y="420" width="90" height="660" fill="${OLIVE}"/>` + phone({ cx: 960, cy: 540, w: 420, h: 230, rot: 0, thumb: false })),
  },
  defauts: {
    'img02.png': [svg(sky('#0A1A33', '#9FB6D0'), 1536, 1024), 1536, 1024],
    'img03.png': [svg(sky('#0A1A33', '#9FB6D0'), 1024, 576), 1024, 576],
    'img07.png': svg(room + hands(1700, 560) + phone({ cx: 1800, cy: 540, w: 300, h: 560, rot: 5 })),
    'img18.png': svg(room + hands(960, 560) + phone({ cx: 960, cy: 540, w: 300, h: 560, rot: 5, blur: 9 })),
    'img27.png': svg(room + hands(960, 560) + phone({ cx: 960, cy: 540, w: 300, h: 560, rot: 5, glow: true })),
    'img37.png': svg('<defs><linearGradient id="gg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#00FF00"/><stop offset="1" stop-color="#5AAF5A"/></linearGradient></defs>' + room + hands(960, 560) + phone({ cx: 960, cy: 540, w: 300, h: 560, rot: 5, screen: 'url(#gg)' })),
    'img38.png': svg(room + hands(960, 560) + phone({ cx: 960, cy: 540, w: 300, h: 560, rot: 5, screen: '#101418' })),
    'img05.png': svg(sky('#1E3550', '#6A88A6') + mountains('#2B3B4E') + '<text x="1180" y="930" font-family="DejaVu Sans" font-weight="bold" font-size="64" fill="#F2F2F2">SORAPIS 2026</text>'),
    'IMG9.PNG': lake('#3FC1BE'),
    'img10.jpg': [svg(room), W, H, 'jpeg'],
    'img41.png': [svg(room + hands(960, 560) + phone({ cx: 960, cy: 540, w: 300, h: 560, rot: 3 })), W, H, 'jpeg'],
    'Copie de img12 (1).png': svg(sky('#DCD6CC', '#F4F1EA')),
    'photo-lac.png': lake('#3FC1BE'),
    'img35.png': svg(sky('#1D2F6B', '#E39A7A')),
    'img35a.png': svg(sky('#1D2F6B', '#E39A7A') + mountains('#4B3A60') + tents()),
    'img35b.png': svg(sky('#050B1E', '#14204A') + mountains('#0E1530', 80) + tents(80, true)),
    'F1-lea.png': fiche([LEA, OLIVE]),
    'img16.png': group([['#8A2A2A', OLIVE]]),
    'img13.png': group([['#1F5A5A', OLIVE]]),
    'img22.png': svg(sky('#6FA7D9', '#CFE3F0') + '<rect y="600" width="1920" height="480" fill="#7A5A3A"/>' + `<rect x="1350" y="380" width="570" height="700" rx="60" fill="${LEA}"/><rect x="1450" y="420" width="90" height="660" fill="${OLIVE}"/>` + phone({ cx: 960, cy: 540, w: 420, h: 230, rot: 0, thumb: false })),
  },
};

// Défauts attendus (codes de check-footage.mjs) et images qui doivent rester propres
export const EXPECTED = {
  'img02': ['ratio'],
  'img03': ['resolution'],
  'img07': ['screen-corner-out'],
  // Les seconds codes de img18 et img37 sont la conséquence mesurée du même défaut
  // (un bord flou étale le dégradé dans l'écran ; un dégradé est aussi un vert impur).
  'img18': ['screen-blur', 'screen-uneven'],
  'img27': ['screen-spill'],
  'img37': ['screen-uneven', 'screen-impure'],
  'img38': ['screen-missing'],
  'img05': ['text'],
  'img09': ['name'], // IMG9.PNG
  'img10': ['name'], // .jpg (vrai JPEG : conversion proposée)
  'img41': ['format-mismatch'], // JPEG enregistré en .png
  'img12': ['name'], // « Copie de img12 (1).png »
  'img35b': ['pair35'],
  'img16': ['char-colour-absent'],
  'img13': ['char-colour-shift'],
  'img22': ['lake'],
};

fs.rmSync(ROOT, { recursive: true, force: true });
let total = 0;
for (const [lot, files] of Object.entries(cases)) {
  const dir = path.join(ROOT, lot);
  fs.mkdirSync(dir, { recursive: true });
  for (const [name, spec] of Object.entries(files)) {
    const [s, w, h, fmt] = Array.isArray(spec) ? spec : [spec, W, H, 'png'];
    let p = sharp(Buffer.from(s)).resize(w, h, { fit: 'fill' }).removeAlpha();
    p = fmt === 'jpeg' ? p.jpeg({ quality: 85 }) : p.png({ compressionLevel: 9 });
    const out = path.join(dir, name);
    await p.toFile(out);
    total += fs.statSync(out).size;
  }
}
fs.writeFileSync(path.join(ROOT, 'attendu.json'), JSON.stringify({ defauts: EXPECTED, unexpected: ['photo-lac.png', 'img35.png'] }, null, 2) + '\n');
console.log(`fixtures : ${Object.values(cases).reduce((n, f) => n + Object.keys(f).length, 0)} fichiers, ${Math.round(total / 1024)} Ko`);
