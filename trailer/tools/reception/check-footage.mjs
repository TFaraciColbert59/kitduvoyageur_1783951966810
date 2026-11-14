#!/usr/bin/env node
// Contrôle de réception des images du trailer LKDV.
//
//   node tools/reception/check-footage.mjs [dossier] [--out fichier.md] [--json] [--no-ocr] [--prompts fichier.md]
//
// Dossier par défaut : trailer/assets/footage/. Rapport par défaut : trailer/qa/RECEPTION.md.
// L'outil LIT les images ; il ne modifie, ne renomme et ne supprime jamais rien dans le dossier.
//
// Codes de sortie : 0 = tout est reçu et sans défaut bloquant ;
//                   1 = au moins un défaut bloquant sur une image reçue ;
//                   2 = aucun défaut bloquant, mais des images ou fiches obligatoires manquent ;
//                   3 = erreur d'exécution (dossier illisible, fichier des prompts introuvable…).
//
// La liste des images, des plans de téléphone, des personnages par image et les phrases de
// correction sont lues dans trailer/PROMPTS-CHATGPT.md à chaque exécution (source unique).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import sharp from 'sharp';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TRAILER = path.resolve(HERE, '..', '..');
export const DEFAULTS = {
  dir: path.join(TRAILER, 'assets', 'footage'),
  out: path.join(TRAILER, 'qa', 'RECEPTION.md'),
  prompts: path.join(TRAILER, 'PROMPTS-CHATGPT.md'),
};

// ---------------------------------------------------------------------------
// Seuils (tous écrits dans le rapport)
// ---------------------------------------------------------------------------
export const T = {
  ratio: 16 / 9,
  ratioTol: 0.01, // ±1 % sur largeur/hauteur
  minLongSide: 1536, // bible : « 1536×1024 minimum » → côté long ≥ 1536 px
  hd: [1920, 1080],
  uhd: [3840, 2160],
  heavyBytes: 40 * 1024 * 1024,
  // écran vert
  greenMinG: 140,
  greenMaxRB: 110,
  greenMinExcess: 80, // g − max(r, b)
  screenMinArea: 0.003, // part de l'image
  whiteMin: 225,
  whiteMaxSpread: 14,
  whiteMinArea: 0.01,
  purityMaxDist: 60, // distance RVB de la moyenne de l'écran à (0,255,0)
  uniformMaxStd: 10, // écart-type max d'un canal à l'intérieur de l'écran
  holesMax: 0.003, // part de l'écran occupée par des trous (icône, reflet)
  fillMin: 0.8, // aire de l'écran / aire du quadrilatère de ses coins
  cornerMaskMin: 0.75, // part des points testés près d'un coin qui doivent être verts
  blurMaxFrac: 0.004, // largeur 10–90 % du bord, en part de la largeur de l'image
  blurMinPx: 4,
  spillChroma: 0.45, // g / (r+g+b)
  spillExcess: 25, // g − max(r, b)
  spillRingMin: 0.08,
  spillRingVsFar: 3,
  // OCR
  ocrMinConf: 70,
  // personnages
  deStrict: 12,
  deLoose: 25,
  ficheBgMin: 15,
  ficheNominalMax: 30,
  // paires
  pairShiftMaxPct: 1.0, // décalage max entre img35a et img35b, en % de la largeur
  pairNccMin: 0.3,
  lakeBhattMin: 0.5,
};

// Couleurs NOMINALES : servent seulement à retrouver la pièce de vêtement dans la fiche.
// La référence mesurée est ensuite celle de la fiche. Léa : valeurs données par les prompts ;
// les autres sont des estimations des mots du prompt (« beige sable », « bleu encre »…).
export const NOMINALS = {
  F1: [
    { key: 'veste', label: 'veste vert forêt', hex: '#17402C', variant: 'couleur de veste' },
    { key: 'sac', label: 'sac LKDV ONE vert olive', hex: '#8A9A3A', variant: 'sac', bagOnly: true },
  ],
  F2: [{ key: 'veste', label: 'veste beige sable', hex: '#C8B48A', variant: 'couleur de veste' }],
  F3: [{ key: 'veste', label: 'veste vert sauge clair', hex: '#A9C0A0', variant: 'couleur de veste', notAtNight: 'doudoune crème la nuit' }],
  F4: [{ key: 'veste', label: 'veste bleu encre', hex: '#1E2B45', variant: 'couleur de veste' }],
  F5: [{ key: 'tshirt', label: 't-shirt ivoire', hex: '#EDE6D6', variant: 'couleur du t-shirt' }],
  F6: [{ key: 'maillot', label: 'maillot bordeaux', hex: '#5E1E2A', variant: 'couleur du maillot' }],
  F7: [{ key: 'jean', label: 'veste en jean délavée', hex: '#6F8CB0', variant: 'couleur de veste' }],
};

// ---------------------------------------------------------------------------
// Lecture des prompts
// ---------------------------------------------------------------------------
const asciiLower = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

function expandImgRanges(text) {
  const out = new Set();
  for (const m of text.matchAll(/img(\d+)([ab]?)(?:\s*à\s*img(\d+))?/g)) {
    if (m[3]) {
      for (let n = Number(m[1]); n <= Number(m[3]); n++) out.add(`img${String(n).padStart(2, '0')}`);
    } else out.add(`img${m[1]}${m[2]}`);
  }
  return out;
}

function expandFiches(text) {
  const out = new Set();
  for (const m of text.matchAll(/F(\d)(?:\s*à\s*F(\d))?/g)) {
    const a = Number(m[1]);
    const b = m[2] ? Number(m[2]) : a;
    for (let n = a; n <= b; n++) out.add(`F${n}`);
  }
  return [...out];
}

export function parsePrompts(md) {
  const lines = md.split(/\r?\n/);
  const images = [];
  const fiches = [];
  for (let i = 0; i < lines.length; i++) {
    const h = lines[i].match(/^#### (img\d+[ab]?) — (.+)$/);
    if (h) {
      const [title, joindre = ''] = h[2].split(' · joindre ');
      let body = '';
      let j = i + 1;
      while (j < lines.length && !lines[j].startsWith('```')) j++;
      for (j = j + 1; j < lines.length && !lines[j].startsWith('```'); j++) body += lines[j] + '\n';
      const plans = [...title.matchAll(/P\d\d/g)].map((m) => m[0]);
      images.push({
        id: h[1],
        title: title.trim(),
        plans,
        optional: /plan de réserve/i.test(title),
        phone: body.includes('#00FF00'),
        twoCorners: /au moins deux coins/i.test(body),
        characters: expandFiches(joindre.replace(/img\d+[ab]?/g, '')),
        silhouettes: /quatre silhouettes/i.test(body),
        joindre: joindre.trim(),
      });
      continue;
    }
    const f = lines[i].match(/^### (F\d) — (\S+)/);
    if (f) fiches.push({ id: f[1], name: f[2] });
  }
  // Noms de fichiers des fiches : le mode d'emploi donne « F1-lea.png… » ; les suivants suivent la
  // même règle (prénom en minuscules, sans accent).
  for (const f of fiches) f.file = `${f.id}-${asciiLower(f.name)}.png`;
  // F1 a une seconde fiche (« Même fiche pour Léa, en TENUE DE VILLE ») sans nom de fichier
  // dans les prompts : nom proposé, facultative.
  if (fiches.some((f) => f.id === 'F1') && /TENUE DE VILLE cette fois/.test(md)) {
    fiches.splice(1, 0, { id: 'F1v', name: 'Léa, tenue de ville', file: 'F1-lea-ville.png', optional: true });
  }

  const villeSet = new Set();
  const nightSet = new Set();
  let bagSet = new Set();
  for (const l of lines) {
    if (/^- Jour 0/.test(l)) for (const id of expandImgRanges(l)) villeSet.add(id);
    if (/^- Jour 1, crépuscule puis nuit/.test(l)) for (const id of expandImgRanges(l)) nightSet.add(id);
    if (/^\| Toute image où Léa porte son sac/.test(l)) bagSet = expandImgRanges(l.split('|')[1]);
  }

  const phrases = {};
  const pi = lines.findIndex((l) => /^## Phrases de correction/.test(l));
  if (pi >= 0) {
    for (let i = pi + 1; i < lines.length && !lines[i].startsWith('## '); i++) {
      const m = lines[i].match(/^- (.+?) : « (.+) »\s*$/);
      if (m) phrases[m[1]] = m[2];
    }
  }
  for (const k of ['Personnage qui dérive', 'Texte ou logo', 'Écran', 'Cadrage']) {
    if (!phrases[k]) throw new Error(`Phrase de correction « ${k} » introuvable dans les prompts.`);
  }
  for (const im of images) {
    im.ville = villeSet.has(im.id);
    im.night = nightSet.has(im.id);
    im.bag = bagSet.has(im.id);
  }
  return { images, fiches, phrases };
}

// ---------------------------------------------------------------------------
// Noms de fichiers
// ---------------------------------------------------------------------------
const IMAGE_EXT = /\.(png|jpe?g|webp|tiff?|heic|avif|gif|bmp)$/i;
const IGNORED = /^(\.|thumbs\.db$|desktop\.ini$)/i;

// Prénoms des fiches, pour reconnaître « lea.png », « fiche-sami.png »…
const FICHE_NAMES = { lea: 1, sami: 2, ines: 3, tom: 4, malik: 5, clara: 6, noah: 7 };

export function nameKey(file) {
  const base = asciiLower(file.replace(/\.[^.]+$/, '')).trim();
  // Nom de téléchargement par défaut de ChatGPT (« ChatGPT Image 11 nov. 2026, 14_03_22 ») :
  // le nombre est une date, pas un numéro d'image.
  if (/chatgpt|dall.?e|^image\s+\d{1,2}\s+\p{L}/u.test(base)) return null;
  // imgNN, img_NN, IMG NN, image-NN, img35-a, « Copie de img07 », « img07 (1) », « img07_v2 »…
  let m = base.match(/(?:^|[^a-z])(?:img|image|im)[\s_.-]*0*(\d{1,3})(?:[\s_.-]*([ab]))?(?![a-z0-9])/)
    ?? base.match(/(?:^|[^a-z])(?:img|image|im)[\s_.-]*0*(\d{1,3})(?!\d)/);
  if (m) return `img${Number(m[1])}${m[2] ?? ''}`;
  const ville = /ville/.test(base);
  m = base.match(/(?:^|[^a-z0-9])f[\s_.-]*([1-7])(?!\d)/);
  if (m) return `f${m[1]}${m[1] === '1' && ville ? 'v' : ''}`;
  for (const [n, k] of Object.entries(FICHE_NAMES)) {
    if (new RegExp(`(?:^|[^a-z])${n}(?![a-z])`).test(base)) return `f${k}${k === 1 && ville ? 'v' : ''}`;
  }
  return null;
}

function expectedKey(id) {
  if (id === 'F1v') return 'f1v';
  if (id.startsWith('F')) return `f${id.slice(1)}`;
  const m = id.match(/^img(\d+)([ab]?)$/);
  return `img${Number(m[1])}${m[2]}`;
}

// Commande PowerShell exacte (Tony travaille sous Windows). Un changement de casse seule passe par
// un nom temporaire : Windows PowerShell 5.1 refuse « Rename-Item a.png A.png ».
export function renameCommand(dirRel, from, to) {
  const q = (s) => `"${s.replace(/"/g, '`"')}"`;
  if (from.toLowerCase() === to.toLowerCase()) {
    const tmp = `_tmp_${to}`;
    return `Rename-Item -LiteralPath ${q(`${dirRel}/${from}`)} -NewName ${q(tmp)}; Rename-Item -LiteralPath ${q(`${dirRel}/${tmp}`)} -NewName ${q(to)}`;
  }
  return `Rename-Item -LiteralPath ${q(`${dirRel}/${from}`)} -NewName ${q(to)}`;
}

function nearMissReasons(file, expected) {
  const r = [];
  const ext = path.extname(file);
  if (ext.toLowerCase() !== '.png') r.push(`extension ${ext || '(aucune)'} au lieu de .png`);
  else if (ext !== '.png') r.push('extension en majuscules');
  const base = file.slice(0, file.length - ext.length);
  const expBase = expected.replace(/\.png$/, '');
  if (base !== expBase && base.toLowerCase() === expBase.toLowerCase()) r.push('majuscules');
  else if (base !== expBase && asciiLower(base) === asciiLower(expBase)) r.push('accent');
  else if (asciiLower(base) !== asciiLower(expBase)) {
    if (/^img\d[ab]?$/i.test(base)) r.push('zéro manquant');
    else r.push(`nom « ${base} » au lieu de « ${expBase} »`);
  }
  return r.length ? r : ['nom différent'];
}

export function matchFiles(files, expected) {
  // expected : [{ id, file }]
  const byKey = new Map(expected.map((e) => [expectedKey(e.id), e]));
  const assigned = new Map(); // id → { file, exact, reasons }
  const unexpected = [];
  const duplicates = [];
  const candidates = new Map();
  for (const f of files) {
    if (IGNORED.test(f)) continue;
    const exact = expected.find((e) => e.file === f);
    if (exact) {
      (candidates.get(exact.id) ?? candidates.set(exact.id, []).get(exact.id)).unshift({ file: f, exact: true });
      continue;
    }
    const k = nameKey(f);
    const e = k && byKey.get(k);
    if (e && IMAGE_EXT.test(f)) {
      (candidates.get(e.id) ?? candidates.set(e.id, []).get(e.id)).push({ file: f, exact: false, reasons: nearMissReasons(f, e.file) });
    } else unexpected.push(f);
  }
  // Choix du candidat : le nom exact, sinon un .png, sinon le nom le plus court.
  const rank = (c) => (c.exact ? 0 : 1e6) + (/\.png$/i.test(c.file) ? 0 : 1e5) + c.file.length;
  for (const [id, list] of candidates) {
    list.sort((a, b) => (a.exact ? -1 : 0) - (b.exact ? -1 : 0) || rank(a) - rank(b));
    assigned.set(id, list[0]);
    for (const extra of list.slice(1)) duplicates.push({ id, file: extra.file, kept: list[0].file });
  }
  // Indices pour les noms non reconnus
  const hints = {};
  for (const f of unexpected) {
    const k = nameKey(f);
    if (k === 'img35') hints[f] = 'img35 n\'existe pas seule : img35a (crépuscule) ou img35b (Voie lactée) ?';
    else if (k === 'img21') hints[f] = 'img21 : plan de réserve';
    else if (k?.startsWith('img')) hints[f] = `aucune image « ${k} » dans les prompts`;
    else if (!IMAGE_EXT.test(f)) hints[f] = 'pas une image';
    else hints[f] = 'nom sans numéro d\'image ni de fiche : à identifier à l\'œil';
  }
  return { assigned, unexpected, duplicates, hints };
}

// ---------------------------------------------------------------------------
// Couleur
// ---------------------------------------------------------------------------
const LIN = new Float32Array(256);
for (let i = 0; i < 256; i++) {
  const c = i / 255;
  LIN[i] = c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}
const fLab = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
export function rgbToLab(r, g, b) {
  const R = LIN[r], G = LIN[g], B = LIN[b];
  const x = (0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.95047;
  const y = 0.2126 * R + 0.7152 * G + 0.0722 * B;
  const z = (0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.08883;
  const fx = fLab(x), fy = fLab(y), fz = fLab(z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}
export const hexToRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const dE = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const labToHex = (lab) => {
  // inverse approximative, pour l'affichage seulement
  const fy = (lab[0] + 16) / 116, fx = fy + lab[1] / 500, fz = fy - lab[2] / 200;
  const inv = (t) => (t ** 3 > 0.008856 ? t ** 3 : (t - 16 / 116) / 7.787);
  const X = inv(fx) * 0.95047, Y = inv(fy), Z = inv(fz) * 1.08883;
  const lin = [3.2406 * X - 1.5372 * Y - 0.4986 * Z, -0.9689 * X + 1.8758 * Y + 0.0415 * Z, 0.0557 * X - 0.204 * Y + 1.057 * Z];
  return '#' + lin.map((c) => {
    const s = c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
    return Math.round(Math.min(1, Math.max(0, s)) * 255).toString(16).padStart(2, '0');
  }).join('').toUpperCase();
};

function labImage(img) {
  const { data, n } = img;
  const lab = new Float32Array(n * 3);
  const cache = new Map();
  for (let i = 0; i < n; i++) {
    const r = data[i * 3], g = data[i * 3 + 1], b = data[i * 3 + 2];
    const key = (r << 16) | (g << 8) | b;
    let v = cache.get(key);
    if (!v) { v = rgbToLab(r, g, b); if (cache.size < 300000) cache.set(key, v); }
    lab[i * 3] = v[0]; lab[i * 3 + 1] = v[1]; lab[i * 3 + 2] = v[2];
  }
  return lab;
}

const median = (arr) => {
  if (!arr.length) return NaN;
  const s = Float64Array.from(arr).sort();
  return s[s.length >> 1];
};

// ---------------------------------------------------------------------------
// Chargement
// ---------------------------------------------------------------------------
async function loadImage(file) {
  const meta = await sharp(file).metadata();
  const { data, info } = await sharp(file).flatten({ background: '#808080' }).toColourspace('srgb').raw({ depth: 'uchar' }).toBuffer({ resolveWithObject: true });
  let rgb = data;
  if (info.channels !== 3) {
    rgb = Buffer.alloc(info.width * info.height * 3);
    for (let i = 0, j = 0; i < info.width * info.height; i++, j += info.channels) {
      rgb[i * 3] = data[j];
      rgb[i * 3 + 1] = data[j + (info.channels > 2 ? 1 : 0)];
      rgb[i * 3 + 2] = data[j + (info.channels > 2 ? 2 : 0)];
    }
  }
  let transparent = false;
  if (meta.hasAlpha) {
    const st = await sharp(file).stats();
    transparent = st.channels[st.channels.length - 1].min < 255;
  }
  return { meta, transparent, img: { data: rgb, w: info.width, h: info.height, n: info.width * info.height } };
}

function iccDescription(icc) {
  if (!icc) return null;
  try {
    const count = icc.readUInt32BE(128);
    for (let i = 0; i < count; i++) {
      const o = 132 + i * 12;
      if (icc.toString('ascii', o, o + 4) !== 'desc') continue;
      const off = icc.readUInt32BE(o + 4), len = icc.readUInt32BE(o + 8);
      const type = icc.toString('ascii', off, off + 4);
      if (type === 'desc') return icc.toString('ascii', off + 12, off + 12 + icc.readUInt32BE(off + 8)).replace(/\0/g, '').trim();
      if (type === 'mluc') {
        const sLen = icc.readUInt32BE(off + 20), sOff = icc.readUInt32BE(off + 24);
        const b = icc.subarray(off + sOff, off + sOff + sLen);
        let s = '';
        for (let k = 0; k + 1 < b.length; k += 2) s += String.fromCharCode(b.readUInt16BE(k));
        return s.replace(/\0/g, '').trim();
      }
      return icc.toString('ascii', off, off + len).replace(/[^\x20-\x7e]/g, '').trim();
    }
  } catch { /* profil illisible */ }
  return 'profil illisible';
}

// ---------------------------------------------------------------------------
// Écran vert
// ---------------------------------------------------------------------------
function largestComponent(mask, w, h) {
  const labels = new Int32Array(w * h);
  const stack = new Int32Array(w * h);
  let best = null;
  let cur = 0;
  for (let s = 0; s < w * h; s++) {
    if (!mask[s] || labels[s]) continue;
    cur++;
    let sp = 0;
    stack[sp++] = s;
    labels[s] = cur;
    const px = [];
    while (sp) {
      const p = stack[--sp];
      px.push(p);
      const x = p % w, y = (p / w) | 0;
      if (x > 0 && mask[p - 1] && !labels[p - 1]) { labels[p - 1] = cur; stack[sp++] = p - 1; }
      if (x < w - 1 && mask[p + 1] && !labels[p + 1]) { labels[p + 1] = cur; stack[sp++] = p + 1; }
      if (y > 0 && mask[p - w] && !labels[p - w]) { labels[p - w] = cur; stack[sp++] = p - w; }
      if (y < h - 1 && mask[p + w] && !labels[p + w]) { labels[p + w] = cur; stack[sp++] = p + w; }
    }
    if (!best || px.length > best.length) best = px;
  }
  return best ?? [];
}

const polyArea = (q) => Math.abs(q.reduce((s, p, i) => { const n = q[(i + 1) % q.length]; return s + p[0] * n[1] - n[0] * p[1]; }, 0)) / 2;

function segDist(px, py, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const t = Math.max(0, Math.min(1, ((px - a[0]) * dx + (py - a[1]) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(px - a[0] - t * dx, py - a[1] - t * dy);
}
function inQuad(px, py, q) {
  let sign = 0;
  for (let i = 0; i < 4; i++) {
    const a = q[i], b = q[(i + 1) % 4];
    const c = (b[0] - a[0]) * (py - a[1]) - (b[1] - a[1]) * (px - a[0]);
    if (c !== 0) { if (sign === 0) sign = Math.sign(c); else if (Math.sign(c) !== sign) return false; }
  }
  return true;
}

export function analyseScreen(img, { twoCorners = false } = {}) {
  const { data, w, h, n } = img;
  const res = { kind: null, issues: [], notes: [], measures: {} };
  const scoreG = (i) => { const r = data[i * 3], g = data[i * 3 + 1], b = data[i * 3 + 2]; return Math.max(0, g - Math.max(r, b)); };
  const scoreW = (i) => Math.min(data[i * 3], data[i * 3 + 1], data[i * 3 + 2]);

  let mask = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const r = data[i * 3], g = data[i * 3 + 1], b = data[i * 3 + 2];
    if (g >= T.greenMinG && r <= T.greenMaxRB && b <= T.greenMaxRB && g - Math.max(r, b) >= T.greenMinExcess) mask[i] = 1;
  }
  let comp = largestComponent(mask, w, h);
  let score = scoreG;
  if (comp.length >= T.screenMinArea * n) res.kind = 'vert';
  else {
    mask = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
      const r = data[i * 3], g = data[i * 3 + 1], b = data[i * 3 + 2];
      if (Math.min(r, g, b) >= T.whiteMin && Math.max(r, g, b) - Math.min(r, g, b) <= T.whiteMaxSpread) mask[i] = 1;
    }
    comp = largestComponent(mask, w, h);
    score = scoreW;
    if (comp.length >= T.whiteMinArea * n) res.kind = 'blanc';
  }
  if (!res.kind) {
    res.issues.push({ code: 'screen-missing', blocking: true, text: 'écran vert #00FF00 introuvable (ni écran blanc uni de repli)' });
    return res;
  }
  // garder seulement la composante retenue dans le masque
  const m2 = new Uint8Array(n);
  for (const p of comp) m2[p] = 1;
  mask = m2;
  res.mask = mask;

  // coins extrêmes
  let tl = [0, 0, Infinity], br = [0, 0, -Infinity], tr = [0, 0, -Infinity], bl = [0, 0, Infinity];
  let x0 = w, x1 = 0, y0 = h, y1 = 0, onBorder = 0;
  for (const p of comp) {
    const x = p % w, y = (p / w) | 0;
    if (x + y < tl[2]) tl = [x, y, x + y];
    if (x + y > br[2]) br = [x, y, x + y];
    if (x - y > tr[2]) tr = [x, y, x - y];
    if (x - y < bl[2]) bl = [x, y, x - y];
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    if (x === 0 || y === 0 || x === w - 1 || y === h - 1) onBorder++;
  }
  const quad = [tl, tr, br, bl].map((c) => [c[0], c[1]]);
  const names = ['haut gauche', 'haut droit', 'bas droit', 'bas gauche'];
  const cx = quad.reduce((s, p) => s + p[0], 0) / 4, cy = quad.reduce((s, p) => s + p[1], 0) / 4;
  const qArea = polyArea(quad);
  res.bbox = [x0, y0, x1, y1];
  res.quad = quad;
  res.measures.areaPct = +(100 * comp.length / n).toFixed(2);
  res.measures.fill = +(comp.length / (qArea || 1)).toFixed(3);

  // couleur moyenne et uniformité (intérieur érodé)
  const k = Math.max(3, Math.round(0.01 * Math.min(x1 - x0, y1 - y0)));
  let sum = [0, 0, 0], sq = [0, 0, 0], cnt = 0;
  for (const p of comp) {
    const x = p % w, y = (p / w) | 0;
    if (x - k < 0 || x + k >= w || y - k < 0 || y + k >= h) continue;
    if (!mask[p - k] || !mask[p + k] || !mask[p - k * w] || !mask[p + k * w]) continue;
    for (let c = 0; c < 3; c++) { const v = data[p * 3 + c]; sum[c] += v; sq[c] += v * v; }
    cnt++;
  }
  const mean = sum.map((s) => s / (cnt || 1));
  const std = sq.map((s, c) => Math.sqrt(Math.max(0, s / (cnt || 1) - mean[c] ** 2)));
  res.measures.mean = mean.map((v) => Math.round(v));
  res.measures.std = +Math.max(...std).toFixed(1);
  if (res.kind === 'vert') {
    const dist = Math.hypot(mean[0], 255 - mean[1], mean[2]);
    res.measures.purityDist = Math.round(dist);
    if (dist > T.purityMaxDist) res.issues.push({ code: 'screen-impure', blocking: true, text: `vert impur : moyenne RVB (${res.measures.mean.join(', ')}), écart ${Math.round(dist)} à #00FF00 (max ${T.purityMaxDist})` });
  } else {
    res.notes.push('écran blanc uni (repli accepté par le mode d\'emploi)');
  }
  if (Math.max(...std) > T.uniformMaxStd) res.issues.push({ code: 'screen-uneven', blocking: true, text: `écran non uniforme (dégradé ou reflet) : écart-type ${Math.max(...std).toFixed(1)} (max ${T.uniformMaxStd})` });

  // trous dans l'écran (icône, reflet, contenu)
  {
    const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
    const seen = new Uint8Array(bw * bh);
    const st = [];
    const push = (x, y) => { const li = (y - y0) * bw + (x - x0); if (!seen[li] && !mask[y * w + x]) { seen[li] = 1; st.push(li); } };
    for (let x = x0; x <= x1; x++) { push(x, y0); push(x, y1); }
    for (let y = y0; y <= y1; y++) { push(x0, y); push(x1, y); }
    while (st.length) {
      const li = st.pop();
      const x = x0 + (li % bw), y = y0 + ((li / bw) | 0);
      if (x > x0) push(x - 1, y); if (x < x1) push(x + 1, y); if (y > y0) push(x, y - 1); if (y < y1) push(x, y + 1);
    }
    let holes = 0;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (!mask[y * w + x] && !seen[(y - y0) * bw + (x - x0)]) holes++;
    res.measures.holesPct = +(100 * holes / comp.length).toFixed(2);
    if (holes / comp.length > T.holesMax) res.issues.push({ code: 'screen-content', blocking: true, text: `motif dans l'écran (icône, reflet ou contenu) : ${res.measures.holesPct} % de sa surface` });
  }
  if (comp.length / (qArea || 1) < T.fillMin) res.issues.push({ code: 'screen-partial', blocking: false, text: `écran incomplet : ${Math.round(100 * comp.length / qArea)} % du quadrilatère de ses coins est vert (doigt, reflet ou objet qui le couvre)` });

  // coins : dans le cadre, non masqués, nets
  const L = Math.max(12, Math.round(0.012 * w));
  const blurMax = Math.max(T.blurMinPx, T.blurMaxFrac * w);
  const sample = (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    if (xi < 0 || yi < 0 || xi >= w - 1 || yi >= h - 1) return NaN;
    const fx = x - xi, fy = y - yi, p = yi * w + xi;
    return (score(p) * (1 - fx) + score(p + 1) * fx) * (1 - fy) + (score(p + w) * (1 - fx) + score(p + w + 1) * fx) * fy;
  };
  const corners = [];
  for (let c = 0; c < 4; c++) {
    const C = quad[c];
    const info = { name: names[c], at: C, inFrame: true, masked: false, edgeWidth: null };
    if (C[0] <= 1 || C[1] <= 1 || C[0] >= w - 2 || C[1] >= h - 2) info.inFrame = false;
    if (info.inFrame) {
      let ok = 0, tot = 0;
      const widths = [];
      for (const adj of [quad[(c + 1) % 4], quad[(c + 3) % 4]]) {
        const ex = adj[0] - C[0], ey = adj[1] - C[1];
        const len = Math.hypot(ex, ey) || 1;
        // normale sortante
        let nx = -ey / len, ny = ex / len;
        const mx = C[0] + ex * 0.5, my = C[1] + ey * 0.5;
        if ((mx + nx - cx) ** 2 + (my + ny - cy) ** 2 < (mx - cx) ** 2 + (my - cy) ** 2) { nx = -nx; ny = -ny; }
        const inset = Math.max(3, 0.015 * len);
        for (let f = 0.03; f <= 0.121; f += 0.01) {
          const px = Math.round(C[0] + ex * f - nx * inset), py = Math.round(C[1] + ey * f - ny * inset);
          tot++;
          if (px >= 0 && py >= 0 && px < w && py < h && mask[py * w + px]) ok++;
        }
        for (let f = 0.1; f <= 0.301; f += 0.04) {
          // point de bord : on part de l'intérieur et on avance jusqu'à la sortie du masque
          let bx = C[0] + ex * f - nx * inset, by = C[1] + ey * f - ny * inset;
          let t = 0;
          while (t < 3 * L) { const xx = Math.round(bx + nx * t), yy = Math.round(by + ny * t); if (xx < 0 || yy < 0 || xx >= w || yy >= h || !mask[yy * w + xx]) break; t++; }
          bx += nx * t; by += ny * t;
          const prof = [];
          for (let s = -L; s <= L; s += 0.5) prof.push(sample(bx + nx * s, by + ny * s));
          if (prof.some(Number.isNaN)) continue;
          const q = Math.round(prof.length * 0.2);
          const inside = prof.slice(0, q).reduce((a, b) => a + b, 0) / q;
          const outside = prof.slice(-q).reduce((a, b) => a + b, 0) / q;
          if (inside - outside < 40) continue;
          const norm = prof.map((v) => (v - outside) / (inside - outside));
          let a = -1, b = -1;
          for (let s = 0; s < norm.length; s++) { if (a < 0 && norm[s] < 0.9) a = s; if (a >= 0 && norm[s] < 0.1) { b = s; break; } }
          if (a >= 0 && b >= 0) widths.push((b - a) * 0.5);
        }
      }
      info.maskRatio = +(ok / tot).toFixed(2);
      if (ok / tot < T.cornerMaskMin) info.masked = true;
      info.edgeWidth = widths.length ? +median(widths).toFixed(1) : null;
    }
    corners.push(info);
  }
  res.corners = corners;
  res.measures.edgeMaxPx = +blurMax.toFixed(1);
  const visible = corners.filter((c) => c.inFrame && !c.masked);
  const sharp = visible.filter((c) => c.edgeWidth != null && c.edgeWidth <= blurMax);
  const need = twoCorners ? 2 : 4;
  const out = corners.filter((c) => !c.inFrame);
  const masked = corners.filter((c) => c.inFrame && c.masked);
  const blurry = visible.filter((c) => c.edgeWidth == null || c.edgeWidth > blurMax);
  if (visible.length < need) {
    if (out.length) res.issues.push({ code: 'screen-corner-out', blocking: true, text: `coin(s) hors cadre : ${out.map((c) => c.name).join(', ')}${twoCorners ? ' (deux coins suffisent ici, ' + visible.length + ' visible(s))' : ''}` });
    if (masked.length) res.issues.push({ code: 'screen-corner-masked', blocking: true, text: `coin(s) masqué(s) : ${masked.map((c) => `${c.name} (${Math.round(100 * c.maskRatio)} % vert)`).join(', ')}` });
  } else if (twoCorners && (out.length || masked.length)) {
    res.notes.push(`${visible.length} coins visibles sur 4 (deux suffisent pour img43)`);
  }
  if (sharp.length < need && blurry.length) {
    res.issues.push({ code: 'screen-blur', blocking: true, text: `bord(s) d'écran flou(s) : ${blurry.map((c) => `${c.name} ${c.edgeWidth ?? '?'} px`).join(', ')} (transition 10–90 % ; max ${blurMax.toFixed(1)} px)` });
  }
  if (onBorder && !out.length) res.notes.push('l\'écran touche le bord du cadre');

  // débordement vert (lueur sur la peau)
  if (res.kind === 'vert') {
    const ringIn = 1.5 * L, ringOut = 6 * L, far = 10 * L;
    const ex0 = Math.max(0, Math.floor(x0 - far)), ex1 = Math.min(w - 1, Math.ceil(x1 + far));
    const ey0 = Math.max(0, Math.floor(y0 - far)), ey1 = Math.min(h - 1, Math.ceil(y1 + far));
    let ring = 0, ringS = 0, farN = 0, farS = 0;
    const isSpill = (i) => {
      const r = data[i * 3], g = data[i * 3 + 1], b = data[i * 3 + 2];
      return g / (r + g + b + 1) >= T.spillChroma && g - Math.max(r, b) >= T.spillExcess;
    };
    for (let y = 0; y < h; y += 2) {
      for (let x = 0; x < w; x += 2) {
        const i = y * w + x;
        if (mask[i]) continue;
        const inBox = x >= ex0 && x <= ex1 && y >= ey0 && y <= ey1;
        if (!inBox) { farN++; if (isSpill(i)) farS++; continue; }
        if (inQuad(x, y, quad)) continue;
        let d = Infinity;
        for (let e = 0; e < 4; e++) d = Math.min(d, segDist(x, y, quad[e], quad[(e + 1) % 4]));
        if (d >= ringIn && d <= ringOut) { ring++; if (isSpill(i)) ringS++; }
      }
    }
    const fr = ring ? ringS / ring : 0, ff = farN ? farS / farN : 0;
    res.measures.spillRingPct = +(100 * fr).toFixed(1);
    res.measures.spillFarPct = +(100 * ff).toFixed(1);
    if (fr >= T.spillRingMin && fr >= T.spillRingVsFar * ff + 0.02) {
      res.issues.push({ code: 'screen-spill', blocking: false, text: `lueur verte autour de l'écran : ${res.measures.spillRingPct} % des pixels proches teintés vert chroma (${res.measures.spillFarPct} % ailleurs) — à vérifier à l'œil` });
    }
  }
  return res;
}

// ---------------------------------------------------------------------------
// OCR
// ---------------------------------------------------------------------------
export async function createOcr() {
  try {
    const require = createRequire(import.meta.url);
    const { createWorker, PSM } = await import('tesseract.js');
    const langDir = path.join(path.dirname(require.resolve('@tesseract.js-data/eng/package.json')), '4.0.0');
    if (!fs.existsSync(path.join(langDir, 'eng.traineddata.gz'))) throw new Error(`données de langue absentes (${langDir})`);
    const worker = await createWorker('eng', 1, { langPath: langDir, cacheMethod: 'none', gzip: true });
    await worker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT, user_defined_dpi: '300' });
    const ver = require('tesseract.js/package.json').version;
    return {
      engine: `tesseract.js ${ver} (anglais, données locales, sans réseau)`,
      async read(png) {
        const r = await worker.recognize(png, {}, { blocks: true });
        const words = [];
        for (const b of r.data.blocks ?? []) for (const p of b.paragraphs) for (const l of p.lines) for (const wd of l.words) words.push(wd);
        return words;
      },
      terminate: () => worker.terminate(),
    };
  } catch (e) {
    return { engine: null, error: String(e.message ?? e) };
  }
}

export function suspiciousWords(words) {
  return words
    .map((wd) => ({ text: wd.text.trim(), conf: Math.round(wd.confidence), alnum: wd.text.replace(/[^\p{L}\p{N}]/gu, '') }))
    .filter((wd) => wd.conf >= T.ocrMinConf && (/\p{N}{2,}/u.test(wd.alnum) || (wd.alnum.length >= 3 && /\p{L}/u.test(wd.alnum))));
}

async function ocrImage(ocr, img, screen) {
  const { data, w, h } = img;
  let buf = data;
  if (screen?.bbox) {
    buf = Buffer.from(data);
    const pad = Math.round(0.02 * w);
    const [x0, y0, x1, y1] = screen.bbox;
    for (let y = Math.max(0, y0 - pad); y <= Math.min(h - 1, y1 + pad); y++) for (let x = Math.max(0, x0 - pad); x <= Math.min(w - 1, x1 + pad); x++) {
      const i = (y * w + x) * 3; buf[i] = buf[i + 1] = buf[i + 2] = 128;
    }
  }
  let pipe = sharp(buf, { raw: { width: w, height: h, channels: 3 } });
  if (w > 3000) pipe = pipe.resize({ width: 3000 });
  return suspiciousWords(await ocr.read(await pipe.png().toBuffer()));
}

// ---------------------------------------------------------------------------
// Personnages
// ---------------------------------------------------------------------------
export function ficheReferences(ficheId, img) {
  const lab = labImage(img);
  const { w, h, n } = img;
  const border = [];
  const bw = Math.max(2, Math.round(0.02 * Math.min(w, h)));
  for (let y = 0; y < h; y += 2) for (let x = 0; x < w; x += 2) {
    if (x < bw || y < bw || x >= w - bw || y >= h - bw) border.push(y * w + x);
  }
  const bg = [0, 1, 2].map((c) => median(border.map((p) => lab[p * 3 + c])));
  const refs = [];
  for (const nom of NOMINALS[ficheId] ?? []) {
    const target = rgbToLab(...hexToRgb(nom.hex));
    const L = [], A = [], B = [];
    for (let i = 0; i < n; i++) {
      const p = [lab[i * 3], lab[i * 3 + 1], lab[i * 3 + 2]];
      const dBg = dE(p, bg), dN = dE(p, target);
      if (dBg > T.ficheBgMin && dN < T.ficheNominalMax && dN < dBg) { L.push(p[0]); A.push(p[1]); B.push(p[2]); }
    }
    if (L.length < 0.001 * n) refs.push({ ...nom, found: false, count: L.length });
    else {
      const ref = [median(L), median(A), median(B)];
      refs.push({ ...nom, found: true, lab: ref, hexMeasured: labToHex(ref), count: L.length });
    }
  }
  return { bg, refs };
}

function checkColours(img, refsByFiche, chars, opts, screenMask) {
  const lab = labImage(img);
  const { n } = img;
  const minPix = Math.max(25, Math.round(n * 1e-5));
  const results = [];
  for (const fid of chars) {
    const fiche = refsByFiche[fid];
    for (const nom of NOMINALS[fid] ?? []) {
      const base = { fiche: fid, label: nom.label, variant: nom.variant };
      if (fid === 'F1' && nom.key === 'veste' && opts.ville) { results.push({ ...base, status: 'skip', why: 'tenue de ville' }); continue; }
      if (nom.bagOnly && !opts.bag) continue;
      if (opts.silhouettes) { results.push({ ...base, status: 'skip', why: 'silhouettes' }); continue; }
      if (opts.night && nom.notAtNight) { results.push({ ...base, status: 'skip', why: nom.notAtNight }); continue; }
      if (!fiche) { results.push({ ...base, status: 'skip', why: `fiche ${fid} absente` }); continue; }
      const ref = fiche.refs.find((r) => r.key === nom.key);
      if (!ref?.found) { results.push({ ...base, status: 'skip', why: `couleur introuvable dans la fiche ${fid}` }); continue; }
      let strict = 0, loose = 0;
      const L = [], A = [], B = [];
      for (let i = 0; i < n; i++) {
        if (screenMask?.[i]) continue;
        const d = Math.hypot(lab[i * 3] - ref.lab[0], lab[i * 3 + 1] - ref.lab[1], lab[i * 3 + 2] - ref.lab[2]);
        if (d < T.deStrict) strict++;
        if (d < T.deLoose) { loose++; if (L.length < 200000) { L.push(lab[i * 3]); A.push(lab[i * 3 + 1]); B.push(lab[i * 3 + 2]); } }
      }
      const r = { ...base, ref: ref.hexMeasured, strict, loose, minPix };
      if (strict >= minPix) r.status = 'ok';
      else if (loose >= minPix) {
        const near = [median(L), median(A), median(B)];
        r.status = 'shift';
        r.found = labToHex(near);
        r.dE = Math.round(dE(near, ref.lab));
      } else r.status = 'absent';
      results.push(r);
    }
  }
  return results;
}

// ---------------------------------------------------------------------------
// Paires
// ---------------------------------------------------------------------------
async function gradSmall(file, W = 320, H = 180) {
  const { data } = await sharp(file).flatten({ background: '#808080' }).resize(W, H, { fit: 'fill' }).greyscale().raw().toBuffer({ resolveWithObject: true });
  const g = new Float32Array(W * H);
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    const p = (dx, dy) => data[(y + dy) * W + x + dx];
    const gx = p(1, -1) + 2 * p(1, 0) + p(1, 1) - p(-1, -1) - 2 * p(-1, 0) - p(-1, 1);
    const gy = p(-1, 1) + 2 * p(0, 1) + p(1, 1) - p(-1, -1) - 2 * p(0, -1) - p(1, -1);
    g[y * W + x] = Math.hypot(gx, gy);
  }
  return { g, W, H };
}

export async function comparePair35(fileA, fileB) {
  const a = await gradSmall(fileA), b = await gradSmall(fileB);
  const { W, H } = a;
  const R = 24, yStart = Math.round(H * 0.22);
  const ncc = (dx, dy) => {
    let sa = 0, sb = 0, saa = 0, sbb = 0, sab = 0, k = 0;
    for (let y = Math.max(yStart, 1 - dy + 1); y < Math.min(H - 1, H - 1 - dy); y++) {
      for (let x = Math.max(1, 1 - dx); x < Math.min(W - 1, W - 1 - dx); x++) {
        const va = a.g[y * W + x], vb = b.g[(y + dy) * W + x + dx];
        sa += va; sb += vb; saa += va * va; sbb += vb * vb; sab += va * vb; k++;
      }
    }
    const cov = sab / k - (sa / k) * (sb / k);
    const den = Math.sqrt((saa / k - (sa / k) ** 2) * (sbb / k - (sb / k) ** 2));
    return den > 0 ? cov / den : 0;
  };
  let best = { dx: 0, dy: 0, v: -2 };
  for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
    const v = ncc(dx, dy);
    if (v > best.v) best = { dx, dy, v };
  }
  const zero = ncc(0, 0);
  return { dxPct: +(100 * best.dx / W).toFixed(2), dyPct: +(100 * best.dy / H).toFixed(2), shiftPct: +(100 * Math.hypot(best.dx / W, best.dy / W)).toFixed(2), ncc0: +zero.toFixed(3), nccBest: +best.v.toFixed(3) };
}

async function hueHist(file) {
  const W = 480, H = 270;
  const { data } = await sharp(file).flatten({ background: '#808080' }).resize(W, H, { fit: 'fill' }).toColourspace('srgb').raw().toBuffer({ resolveWithObject: true });
  const bins = new Float64Array(18 * 4);
  let tot = 0, turq = 0;
  for (let i = 0; i < W * H; i++) {
    const r = data[i * 3] / 255, g = data[i * 3 + 1] / 255, b = data[i * 3 + 2] / 255;
    if (data[i * 3 + 1] >= T.greenMinG && data[i * 3] <= T.greenMaxRB && data[i * 3 + 2] <= T.greenMaxRB && data[i * 3 + 1] - Math.max(data[i * 3], data[i * 3 + 2]) >= T.greenMinExcess) continue;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
    const s = mx ? d / mx : 0;
    let hue = 0;
    if (d) hue = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    hue = (hue * 60 + 360) % 360;
    bins[Math.min(17, Math.floor(hue / 20)) * 4 + Math.min(3, Math.floor(s * 4))]++;
    tot++;
    if (hue >= 160 && hue <= 200 && s >= 0.25 && mx >= 0.3) turq++;
  }
  for (let i = 0; i < bins.length; i++) bins[i] /= tot || 1;
  return { bins, turq: turq / (tot || 1) };
}

export async function compareLake(file09, file22) {
  const a = await hueHist(file09), b = await hueHist(file22);
  let bc = 0;
  for (let i = 0; i < a.bins.length; i++) bc += Math.sqrt(a.bins[i] * b.bins[i]);
  return { bhatt: +bc.toFixed(3), turq09Pct: +(100 * a.turq).toFixed(1), turq22Pct: +(100 * b.turq).toFixed(1) };
}

// ---------------------------------------------------------------------------
// Analyse d'un fichier
// ---------------------------------------------------------------------------
const fmtBytes = (b) => (b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1).replace('.', ',')} Mo` : `${Math.round(b / 1024)} Ko`);

function formatChecks(meta, transparent, size, file) {
  const issues = [], notes = [];
  const w = meta.width, h = meta.height;
  const r = w / h;
  if (Math.abs(r / T.ratio - 1) > T.ratioTol) {
    const hint = Math.abs(r - 1.5) < 0.01 ? ' (3:2, format natif 1536×1024 de ChatGPT)' : '';
    issues.push({ code: 'ratio', blocking: true, text: `rapport ${r.toFixed(3)} au lieu de 1,778 (16:9 ±${T.ratioTol * 100} %)${hint}` });
  }
  if (Math.max(w, h) < T.minLongSide) issues.push({ code: 'resolution', blocking: true, text: `résolution ${w}×${h} sous le minimum de la bible (côté long ≥ ${T.minLongSide} px)` });
  const fHd = Math.max(T.hd[0] / w, T.hd[1] / h);
  const fUhd = Math.max(T.uhd[0] / w, T.uhd[1] / h);
  if (fHd > 1) notes.push(`à agrandir ×${fHd.toFixed(2).replace('.', ',')} pour le 1920×1080`);
  if (fUhd > 1) notes.push(`×${fUhd.toFixed(2).replace('.', ',')} pour la 4K`);
  const ext = path.extname(file).toLowerCase().replace('.', '');
  const fmt = meta.format === 'jpeg' ? 'jpg' : meta.format;
  if (fmt && ext && fmt !== ext && !(fmt === 'jpg' && ext === 'jpeg') && !(fmt === 'tiff' && ext === 'tif')) {
    issues.push({ code: 'format-mismatch', blocking: false, text: `fichier ${meta.format.toUpperCase()} enregistré avec l'extension .${ext}`, action: 'retélécharger l\'image en PNG depuis ChatGPT, ou la convertir en vrai PNG sous le même nom (action locale)' });
  }
  if (meta.space === 'cmyk') issues.push({ code: 'colour-mode', blocking: true, text: 'mode CMJN (CMYK) : le film est en RVB sRGB' });
  else if (meta.space === 'b-w' || meta.space === 'grey16' || meta.channels < 3) issues.push({ code: 'colour-mode', blocking: true, text: 'image en niveaux de gris : le film est en couleurs RVB' });
  const desc = meta.hasProfile ? iccDescription(meta.icc) : null;
  if (desc && !/srgb|iec\s*61966/i.test(desc)) issues.push({ code: 'icc', blocking: false, text: `profil couleur « ${desc} » (pas sRGB) : à convertir en sRGB avant l'étalonnage` });
  if (transparent) issues.push({ code: 'alpha', blocking: false, text: 'pixels transparents (aplatis sur gris 50 % pour le contrôle)' });
  if (meta.depth === 'ushort') notes.push('16 bits par canal');
  if (size > T.heavyBytes) issues.push({ code: 'heavy', blocking: false, text: `fichier très lourd (${fmtBytes(size)})` });
  const colour = `${meta.space === 'srgb' ? 'RVB' : meta.space}${meta.hasAlpha ? '+alpha' : ''}, ${desc ? `profil « ${desc} »` : 'sans profil (sRGB supposé)'}`;
  return { issues, notes, summary: `${w}×${h}, ${fmtBytes(size)}, ${colour}` };
}

// ---------------------------------------------------------------------------
// Phrases de correction
// ---------------------------------------------------------------------------
const ADDED = {
  ratio: 'Génère la même image en paysage 16:9 exact, sans bande, cadre ni marge. Ne change rien d\'autre.',
  resolution: 'Génère la même image à la plus grande résolution possible, au moins 1536 pixels de large en 16:9. Ne change rien d\'autre.',
  colour: 'Enregistre l\'image en couleurs RVB sRGB, sans transparence. Ne change rien d\'autre.',
  pair35: 'Reprends EXACTEMENT le même cadre que img35a (jointe) : même position des tentes, des silhouettes, du feu et de la ligne des sommets, pixel pour pixel autant que possible. Ne change que la lumière et le ciel.',
  lake: 'Derrière le téléphone, le paysage doit être EXACTEMENT celui de img09 (jointe) : même lac turquoise laiteux, même amphithéâtre de falaises, même pic en aiguille centré. Ne change rien d\'autre.',
  screen43: 'L\'écran du téléphone doit être un vert chroma uni pur #00FF00, mat, sans reflet ni icône, avec au moins deux coins de l\'écran visibles et nets, sans lueur verte sur la peau.',
};

function phrasesFor(issue, ctx, P) {
  const v = (s) => ({ text: s, source: 'prompts' });
  const a = (s) => ({ text: s, source: 'ajoutée' });
  const screen = ctx.twoCorners ? { text: ADDED.screen43, source: 'adaptée (img43 : deux coins)' } : v(P['Écran']);
  switch (issue.code) {
    case 'ratio': return [a(ADDED.ratio)];
    case 'resolution': return [a(ADDED.resolution)];
    case 'colour-mode': case 'icc': case 'alpha': return [a(ADDED.colour)];
    case 'screen-corner-out': return [screen, v(P['Cadrage'])];
    case 'screen-missing': case 'screen-impure': case 'screen-uneven': case 'screen-content': case 'screen-partial':
    case 'screen-corner-masked': case 'screen-blur': case 'screen-spill': return [screen];
    case 'text': return [v(P['Texte ou logo'])];
    case 'char-colour-absent': case 'char-colour-shift':
      return [v(P['Personnage qui dérive'].replace('[visage / cheveux / couleur de veste / sac]', issue.variant))];
    case 'pair35': return [a(ADDED.pair35)];
    case 'lake': return [a(ADDED.lake)];
    default: return [];
  }
}

// ---------------------------------------------------------------------------
// Programme principal
// ---------------------------------------------------------------------------
export async function analyseFolder(dir, { promptsFile = DEFAULTS.prompts, ocr: useOcr = true } = {}) {
  const parsed = parsePrompts(fs.readFileSync(promptsFile, 'utf8'));
  const { images, fiches, phrases } = parsed;
  const dirExists = fs.existsSync(dir) && fs.statSync(dir).isDirectory();
  const files = dirExists ? fs.readdirSync(dir).filter((f) => fs.statSync(path.join(dir, f)).isFile()) : [];
  const expected = [
    ...images.map((im) => ({ id: im.id, file: `${im.id}.png` })),
    ...fiches.map((f) => ({ id: f.id, file: f.file })),
  ];
  const { assigned, unexpected, duplicates, hints } = matchFiles(files, expected);

  let ocr = null;
  const anyPresent = assigned.size > 0;
  if (useOcr && anyPresent) ocr = await createOcr();
  const ocrStatus = !useOcr ? { engine: null, error: 'désactivé (--no-ocr)' } : ocr ?? { engine: 'non lancé (aucune image reçue)' };

  const entries = {};
  const loaded = {};
  // fiches d'abord (références de couleur)
  const refsByFiche = {};
  const order = [...fiches.map((f) => ({ kind: 'fiche', ...f, expectedFile: f.file })), ...images.map((im) => ({ kind: 'image', ...im, expectedFile: `${im.id}.png` }))];
  for (const item of order) {
    const a = assigned.get(item.id);
    const e = { id: item.id, kind: item.kind, expectedFile: item.expectedFile, optional: !!item.optional, phone: !!item.phone, plans: item.plans ?? [], title: item.title ?? item.name, present: !!a, issues: [], notes: [] };
    entries[item.id] = e;
    if (!a) continue;
    e.file = a.file;
    const full = path.join(dir, a.file);
    if (!a.exact) {
      const isPng = /\.png$/i.test(a.file);
      const action = isPng
        ? `renommer (action locale, rien à envoyer à ChatGPT) : \`${renameCommand(rel(dir), a.file, item.expectedFile)}\``
        : `convertir en PNG sous le nom « ${item.expectedFile} » (un simple renommage ne change pas le format), ou retélécharger l'image en PNG depuis ChatGPT`;
      e.issues.push({ code: 'name', blocking: true, from: a.file, to: item.expectedFile, rename: isPng ? renameCommand(rel(dir), a.file, item.expectedFile) : null, text: `déposée sous le nom « ${a.file} » (${a.reasons.join(', ')})`, action });
    }
    let L;
    try {
      L = await loadImage(full);
    } catch (err) {
      e.issues.push({ code: 'unreadable', blocking: true, text: `fichier illisible comme image (${err.message})` });
      continue;
    }
    const size = fs.statSync(full).size;
    const f = formatChecks(L.meta, L.transparent, size, a.file);
    e.summary = f.summary;
    e.issues.push(...f.issues);
    e.notes.push(...f.notes);
    loaded[item.id] = full;

    let screen = null;
    if (item.kind === 'image' && item.phone) {
      screen = analyseScreen(L.img, { twoCorners: item.twoCorners });
      e.screen = { kind: screen.kind, measures: screen.measures, corners: screen.corners?.map(({ name, inFrame, masked, edgeWidth, maskRatio }) => ({ name, inFrame, masked, edgeWidth, maskRatio })) };
      e.issues.push(...screen.issues);
      e.notes.push(...screen.notes);
    }
    if (ocr?.engine) {
      const words = await ocrImage(ocr, L.img, screen);
      e.ocrWords = words;
      if (words.length) e.issues.push({ code: 'text', blocking: true, text: `texte détecté : ${words.slice(0, 6).map((wd) => `« ${wd.text} » (${wd.conf} %)`).join(', ')}${words.length > 6 ? '…' : ''}` });
    }
    if (item.kind === 'fiche') {
      refsByFiche[item.id] = ficheReferences(item.id, L.img);
      e.references = refsByFiche[item.id].refs.map((r) => ({ label: r.label, found: r.found, measured: r.hexMeasured ?? null }));
      for (const r of refsByFiche[item.id].refs) if (!r.found) e.issues.push({ code: 'fiche-colour', blocking: false, text: `${r.label} introuvable dans la fiche (le contrôle de couleur de ce personnage est sauté)` });
    } else if (item.characters?.length) {
      const res = checkColours(L.img, refsByFiche, item.characters, { ville: item.ville, bag: item.bag, night: item.night, silhouettes: item.silhouettes }, screen?.mask);
      e.colours = res;
      for (const r of res) {
        const who = `${r.label} (${r.fiche})`;
        if (r.status === 'absent') e.issues.push({ code: 'char-colour-absent', blocking: false, variant: `${r.variant} — ${r.label}, fiche ${r.fiche}`, text: `ALERTE à vérifier à l'œil : ${who} absente de l'image (référence ${r.ref} mesurée sur la fiche, aucun pixel à ΔE < ${T.deLoose})` });
        if (r.status === 'shift') e.issues.push({ code: 'char-colour-shift', blocking: false, variant: `${r.variant} — ${r.label}, fiche ${r.fiche}`, text: `ALERTE à vérifier à l'œil : ${who} décalée (référence ${r.ref}, teinte la plus proche ${r.found}, ΔE ≈ ${r.dE})` });
      }
      const skipped = res.filter((r) => r.status === 'skip');
      if (skipped.length) e.notes.push(`couleurs non évaluées : ${skipped.map((r) => `${r.label} (${r.why})`).join(', ')}`);
    }
  }
  if (ocr?.terminate) await ocr.terminate();

  // paires
  const pairs = [];
  if (loaded.img35a && loaded.img35b) {
    const m = await comparePair35(loaded.img35a, loaded.img35b);
    const p = { id: 'img35a/img35b', measures: m, issues: [] };
    if (m.shiftPct > T.pairShiftMaxPct) p.issues.push({ code: 'pair35', blocking: true, text: `cadres décalés de ${m.shiftPct} % de la largeur (dx ${m.dxPct} %, dy ${m.dyPct} %, max ${T.pairShiftMaxPct} %)` });
    else if (m.nccBest < T.pairNccMin) p.issues.push({ code: 'pair35', blocking: false, text: `structures peu ressemblantes (corrélation des contours ${m.nccBest}, min ${T.pairNccMin}) — à vérifier à l'œil` });
    pairs.push(p);
    entries.img35b.issues.push(...p.issues);
  } else pairs.push({ id: 'img35a/img35b', skipped: 'les deux images ne sont pas encore reçues' });
  if (loaded.img09 && loaded.img22) {
    const m = await compareLake(loaded.img09, loaded.img22);
    const p = { id: 'img09/img22', measures: m, issues: [] };
    if (m.bhatt < T.lakeBhattMin || (m.turq09Pct > 5 && m.turq22Pct < 0.25 * m.turq09Pct)) {
      p.issues.push({ code: 'lake', blocking: false, text: `ALERTE à vérifier à l'œil : le lac ne ressemble pas à img09 (similarité des teintes ${m.bhatt}, min ${T.lakeBhattMin} ; turquoise ${m.turq22Pct} % contre ${m.turq09Pct} %)` });
    }
    pairs.push(p);
    entries.img22.issues.push(...p.issues);
  } else pairs.push({ id: 'img09/img22', skipped: 'les deux images ne sont pas encore reçues' });

  for (const e of Object.values(entries)) {
    const ctx = { twoCorners: images.find((im) => im.id === e.id)?.twoCorners };
    for (const is of e.issues) is.phrases = phrasesFor(is, ctx, phrases);
  }

  const list = Object.values(entries);
  const imgs = list.filter((e) => e.kind === 'image');
  const fch = list.filter((e) => e.kind === 'fiche');
  const summary = {
    promptsImages: images.length,
    requiredImages: imgs.filter((e) => !e.optional).length,
    optionalImages: imgs.filter((e) => e.optional).map((e) => e.id),
    receivedImages: imgs.filter((e) => e.present).length,
    fiches: fch.filter((e) => !e.optional).length,
    receivedFiches: fch.filter((e) => e.present && !e.optional).length,
    renames: list.flatMap((e) => e.issues.filter((i) => i.code === 'name').map((i) => ({ id: e.id, from: i.from, to: i.to, command: i.rename }))),
    hints,
    missingRequired: list.filter((e) => !e.present && !e.optional).map((e) => e.id),
    missingOptional: list.filter((e) => !e.present && e.optional).map((e) => e.id),
    blocking: list.filter((e) => e.issues.some((i) => i.blocking)).map((e) => e.id),
    alerts: list.filter((e) => e.issues.some((i) => !i.blocking)).map((e) => e.id),
    unexpected,
    duplicates,
    dirExists,
    ocr: ocrStatus.engine ?? `non testable : ${ocrStatus.error}`,
  };
  summary.exitCode = summary.blocking.length ? 1 : summary.missingRequired.length ? 2 : 0;
  return { generatedAt: new Date().toISOString(), dir, summary, entries: list, pairs, thresholds: T, nominals: NOMINALS };
}

// ---------------------------------------------------------------------------
// Rapport Markdown
// ---------------------------------------------------------------------------
function rel(p) {
  const r = path.relative(TRAILER, p);
  return r.startsWith('..') ? p : r.split(path.sep).join('/');
}

function lineFor(e) {
  const tag = [e.plans.join(', '), e.phone ? 'téléphone' : '', e.optional ? 'facultative' : ''].filter(Boolean).join(' · ');
  const head = `- **${e.kind === 'fiche' ? e.expectedFile : e.id}**${tag ? ` (${tag})` : ''}`;
  if (!e.present) return `${head} — manquante${e.optional ? (e.kind === 'fiche' ? ' (seconde fiche de Léa, tenue de ville ; nom proposé, absent des prompts)' : ' (plan de réserve facultatif)') : ''}`;
  const sum = e.summary ? ` [${e.summary}]` : '';
  const notes = e.notes.length ? ` — notes : ${e.notes.join(' ; ')}` : '';
  if (!e.issues.length) return `${head} — OK${sum}${notes}`;
  const parts = e.issues.map((is) => {
    const kind = is.blocking ? 'DÉFAUT' : 'alerte';
    const ph = is.action ? ` → ${is.action}` : is.phrases.length ? ` → ${is.phrases.map((p) => `« ${p.text} »${p.source === 'prompts' ? '' : ` (phrase ${p.source})`}`).join(' + ')}` : '';
    return `${kind} : ${is.text}${ph}`;
  });
  return `${head} — ${parts.join(' ; ')}${sum}${notes}`;
}

export function renderMarkdown(r) {
  const s = r.summary;
  const d = new Date(r.generatedAt);
  const pad = (x) => String(x).padStart(2, '0');
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const out = [];
  out.push('# Réception des images — trailer LKDV', '');
  out.push(`Généré par \`node tools/reception/check-footage.mjs\` le ${date} (heure locale), dossier \`${rel(r.dir)}\`${s.dirExists ? '' : ' (dossier absent)'}. Ce fichier est réécrit à chaque passage ; l'outil ne modifie jamais les images.`, '');
  out.push(`- Images du film : **${s.receivedImages} reçues / ${s.requiredImages} obligatoires** (+ ${s.optionalImages.join(', ')}, plan de réserve facultatif ; ${s.promptsImages} prompts au total).`);
  out.push(`- Fiches personnages : **${s.receivedFiches} / ${s.fiches}**.`);
  const fileOf = (id) => r.entries.find((e) => e.id === id)?.expectedFile ?? id;
  out.push(`- Manquantes obligatoires (${s.missingRequired.length}) : ${s.missingRequired.length ? s.missingRequired.map(fileOf).join(', ') : 'aucune'}.`);
  out.push(`- Défauts bloquants : ${s.blocking.length ? s.blocking.join(', ') : 'aucun'} · alertes à vérifier à l'œil : ${s.alerts.length ? s.alerts.join(', ') : 'aucune'}.`);
  out.push(`- Noms presque justes (reconnus, à renommer) : ${s.renames.length ? s.renames.map((x) => `« ${x.from} » → « ${x.to} »`).join(', ') : 'aucun'}.`);
  out.push(`- Fichiers inattendus (non reconnus, non contrôlés) : ${s.unexpected.length ? s.unexpected.map((f) => `« ${f} » (${s.hints[f]})`).join(', ') : 'aucun'}.`);
  if (s.duplicates.length) out.push(`- Doublons (un seul fichier est contrôlé par image) : ${s.duplicates.map((x) => `« ${x.file} » ignoré, « ${x.kept} » contrôlé pour ${x.id}`).join(', ')}.`);
  out.push(`- OCR : ${s.ocr}.`);
  out.push(`- Code de sortie : ${s.exitCode} (0 = complet et sans défaut bloquant, 1 = défaut bloquant, 2 = il manque des images obligatoires).`, '');
  out.push('Décompte : la trame numérote img01 à img49 (49 numéros). img35 n\'existe pas seule : elle est remplacée par la paire img35a/img35b, et img09b s\'ajoute à img09. Cela donne 49 − 1 + 3 = **51 prompts**, dont img21 (« Inès pointe l\'horizon »), plan de réserve sans plan dans la trame : **50 images obligatoires + 1 facultative**.', '');
  out.push('Lecture d\'une ligne : « DÉFAUT » bloque la réception ; « alerte » est à vérifier à l\'œil. Après la flèche, la phrase à renvoyer à ChatGPT, reprise mot pour mot de `PROMPTS-CHATGPT.md` (« phrase ajoutée » ou « adaptée » quand les prompts n\'en prévoient pas).', '');
  out.push('## Images du film', '');
  for (const e of r.entries.filter((x) => x.kind === 'image')) out.push(lineFor(e));
  out.push('', '## Fiches personnages', '');
  for (const e of r.entries.filter((x) => x.kind === 'fiche')) {
    let l = lineFor(e);
    if (e.references) l += ` — références mesurées : ${e.references.map((x) => `${x.label} ${x.found ? x.measured : 'introuvable'}`).join(', ')}`;
    out.push(l);
  }
  if (s.renames.length) {
    out.push('', '## Renommages proposés', '');
    out.push('L\'outil ne renomme rien. Commandes PowerShell à lancer depuis `trailer/`, après avoir vérifié chaque correspondance à l\'œil :', '');
    out.push('```powershell');
    for (const x of s.renames) out.push(x.command ?? `# « ${x.from} » n'est pas un PNG : convertir en « ${x.to} » (pas un simple renommage)`);
    out.push('```');
  }
  out.push('', '## Paires', '');
  for (const p of r.pairs) {
    if (p.skipped) { out.push(`- **${p.id}** — non mesurée : ${p.skipped}.`); continue; }
    const m = Object.entries(p.measures).map(([k, v]) => `${k} ${v}`).join(', ');
    out.push(`- **${p.id}** — ${p.issues.length ? p.issues.map((i) => `${i.blocking ? 'DÉFAUT' : 'alerte'} : ${i.text}`).join(' ; ') : 'OK'} (${m})`);
  }
  out.push('', '## Méthode et seuils', '');
  out.push(`- Format : 16:9 à ±${T.ratioTol * 100} % ; côté long ≥ ${T.minLongSide} px (bible : « 1536×1024 minimum ») ; note d'agrandissement sous 1920×1080 et sous 3840×2160 ; RVB requis, profil non sRGB et transparence signalés.`);
  out.push(`- Écran (plans dont le prompt demande #00FF00) : plus grande zone avec g ≥ ${T.greenMinG}, r et b ≤ ${T.greenMaxRB}, g − max(r, b) ≥ ${T.greenMinExcess} (au moins ${T.screenMinArea * 100} % de l'image), sinon écran blanc uni de repli. Pureté : moyenne à moins de ${T.purityMaxDist} de (0, 255, 0) ; uniformité : écart-type ≤ ${T.uniformMaxStd}. Coins : les quatre points extrêmes de la zone, hors cadre s'ils touchent le bord, masqués si moins de ${T.cornerMaskMin * 100} % des points voisins sont verts ; netteté : largeur de transition 10–90 % du bord ≤ ${T.blurMaxFrac * 100} % de la largeur de l'image. img43 : deux coins suffisent (son prompt). Lueur : part de pixels teintés vert chroma dans un anneau autour de l'écran comparée au reste de l'image.`);
  out.push(`- Texte : OCR en texte épars sur toute l'image, zone de l'écran masquée ; mot retenu si confiance ≥ ${T.ocrMinConf} % et au moins 3 lettres ou 2 chiffres. Un filigrane très pâle peut échapper au moteur.`);
  out.push(`- Personnages : la couleur de référence est mesurée sur la fiche (pixels proches de la couleur nommée dans le prompt et éloignés du fond gris). Dans l'image, « absente » = aucun groupe de pixels à ΔE < ${T.deLoose} ; « décalée » = rien à ΔE < ${T.deStrict} mais une teinte voisine. C'est une alerte : une forêt ou une ombre peuvent contenir la bonne couleur sans le personnage, l'œil tranche.`);
  out.push(`- Paires : img35a/img35b, corrélation des contours (320×180, bas de l'image) et recherche du décalage (max ${T.pairShiftMaxPct} % de la largeur) ; img09/img22, ressemblance des histogrammes teinte–saturation et part de turquoise (alerte seulement : img22 est un plan par-dessus l'épaule).`);
  out.push('');
  return out.join('\n');
}

async function main(argv) {
  const args = argv.slice(2);
  const opt = { dir: DEFAULTS.dir, out: DEFAULTS.out, prompts: DEFAULTS.prompts, json: false, ocr: true };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--json') opt.json = true;
    else if (a === '--no-ocr') opt.ocr = false;
    else if (a === '--out') opt.out = path.resolve(args[++i]);
    else if (a === '--prompts') opt.prompts = path.resolve(args[++i]);
    else if (a === '--help' || a === '-h') { console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1, 14).join('\n').replace(/^\/\/ ?/gm, '')); return 0; }
    else if (a.startsWith('--')) throw new Error(`option inconnue ${a}`);
    else opt.dir = path.resolve(a);
  }
  const r = await analyseFolder(opt.dir, { promptsFile: opt.prompts, ocr: opt.ocr });
  fs.mkdirSync(path.dirname(opt.out), { recursive: true });
  fs.writeFileSync(opt.out, renderMarkdown(r));
  if (opt.json) process.stdout.write(JSON.stringify(r, (k, v) => (k === 'mask' ? undefined : v), 2) + '\n');
  else {
    const s = r.summary;
    console.log(`${s.receivedImages}/${s.requiredImages} images obligatoires, ${s.receivedFiches}/${s.fiches} fiches ; ${s.missingRequired.length} manquantes ; défauts bloquants : ${s.blocking.length} ; alertes : ${s.alerts.length}`);
    console.log(`Rapport : ${opt.out}`);
  }
  return r.summary.exitCode;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main(process.argv).then((c) => { process.exitCode = c; }, (e) => { console.error(`Erreur : ${e.message}`); process.exitCode = 3; });
}
