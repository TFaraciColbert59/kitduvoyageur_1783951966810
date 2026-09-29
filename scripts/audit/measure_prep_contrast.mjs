#!/usr/bin/env node
/**
 * Mesure de contraste PAR PIXEL RÉEL de l'écran /prepare.
 *
 * Pourquoi un script séparé de `measure_contrast_v2.mjs` :
 *   1. `/prepare` peint sa photo sur un élément `aria-hidden` frère,
 *      `position: fixed`, `z-index: -1`, `background-attachment: fixed`
 *      (`.lkv-app-background`). Ce calque n'est jamais un ancêtre du texte :
 *      aucune méthode de composition d'arrière-plan DOM ne peut l'atteindre.
 *      Seul un échantillonnage des pixels peints mesure ce que l'œil voit.
 *   2. La campagne v2 force `colorScheme: 'dark'` + `lkdv_theme: 'dark'` et un
 *      viewport unique 390x844. `/prepare` est une page claire sur photo, et sa
 *      photo est recadrée en `cover` : le contraste dépend de la largeur. Il
 *      faut les 4 largeurs réelles, pas une seule.
 *   3. La campagne v2 invalide et réécrit `audit/contrast-measurements.json` et
 *      `audit/CONTRASTE.md` à chaque exécution. Y ajouter `/prepare` mixerait
 *      deux protocoles de mesure dans un seul artefact.
 *   4. `npm run audit:contrast` (`visual-contrast.mjs`, 42/42) est un audit de
 *      jetons CSS purs : il ne lit que `src/styles/tokens.css` et ignore par
 *      construction les jetons `--prep-*`. Le mesurer n'a pas de sens.
 *
 * La page est mesurée telle qu'elle est rendue : aucun fond de substitution,
 * aucun aplat, aucune valeur inventée. Un élément illisible est classé
 * "skipped" avec un motif, jamais comblé par une estimation.
 *
 * Garde-fou auto-vérifié : `--selftest` injecte deux sondes à contraste connu
 * (une violante, une conforme) et exige que le code de verdict les classe
 * exactement comme la calculatrice WCAG le prévoit. Un garde-fou incapable
 * d'échouer ne prouve rien — c'est le reproche exact fait à
 * `tests/visual/glass-contract.spec.ts`.
 *
 * Piège documenté par l'auto-vérification, et CORRIGÉ le 2026-09-29 : le fond
 * local ne peut pas être prélevé dans le seul voisinage du noyau du glyphe.
 * Les pixels de la rampe d'antialiasing s'y trouvent et leur ratio contre le
 * glyphe descend vers 1:1, ce qui transforme TOUT texte en échec.
 *
 * La correction va plus loin que le réglage d'un rayon. Classer « glyphe » par
 * ressemblance à la MOYENNE de la queue mettait le CŒUR du trait — le pixel
 * le plus éloigné de cette moyenne — dans l'échantillon de fond : l'audit
 * comparait le texte à lui-même et rendait 1,04:1 sur des pastilles parfaitement
 * lisibles. La séparation est donc refaite autour de la médiane de luminance de
 * la boîte et de la POLARITÉ DÉCLARÉE du texte, avec un invariant qui refuse
 * de conclure si le fond prélevé se retrouve du côté du glyphe.
 *
 * Règle d'occlusion : un texte recouvert par un élément collant (barre basse)
 * est peint avec les pixels de CE élément, pas avec les siens. Le mesurer
 * produirait un ratio qui ne décrit ni le texte ni son fond réel. Ces nœuds
 * sont donc comptés dans une section `occlusion` distincte et exclus des
 * verdicts ; quand un même texte apparaît aussi dégagé, seule l'observation
 * dégagée fonde le verdict, et c'est le pire cas dégagé qui est retenu.
 *
 * Usage :
 *   node scripts/audit/measure_prep_contrast.mjs [--url <url>] [--report-only]
 *   node scripts/audit/measure_prep_contrast.mjs --selftest
 * Codes de sortie : 0 = aucun échec, 1 = échecs de contraste, 2 = garde-fou rouge.
 *
 * Variables d'environnement :
 *   PW_BASE_URL                 URL racine de l'audit. `getAuditBaseUrl()` refuse
 *                              tout port autre que 3000 sans allowlist : pour
 *                              viser un serveur de dev, exporter les trois
 *                              variables ci-dessous ensemble.
 *   AUDIT_ALLOW_LOCAL_BASE_URL  ='1' autorise une base non-3000.
 *   AUDIT_ALLOWED_BASE_URLS     liste blanche, p. ex. 'http://localhost:4000'.
 *   PREP_AUDIT_URL              URL complète de la page mesurée.
 *   AUDIT_EMAIL                 compte utilisé par `resolveSession`.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from '@playwright/test';
import sharp from 'sharp';

import { auditVerificationStatus, getAuditBaseUrl } from './contrast_audit_core.mjs';
import {
  auditStorageStatePath,
  loadAuditStorageState,
  verifyCompteSession,
} from './create_test_session.mjs';
import { getAdventureCookie } from './measure_contrast_v2.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url)).replace(/[\\/]$/, '');
const DEFAULT_REPORT = path.join(ROOT, 'audit', 'prep-contrast-measurements.json');
const SHOTS_DIR = path.join(ROOT, 'audit', 'prep-contrast-shots');
const DEFAULT_URL_PATH = '/prepare?nouvelle=1';
/**
 * Port de dev du repo (cf. playwright.config.ts, meme convention que les autres
 * scripts d'audit). getAuditBaseUrl() ne connait que 3000 par defaut, donc sans
 * ce couplage le script echoue hors boite sur le port reel du projet.
 *
 * On n'auto-autorise QUE cette base par defaut. Toute base fournie par
 * l'environnement reste soumise a la liste blanche de
 * contrast_audit_core.mjs : ce raccourci ne contourne aucun garde-fou.
 */
const DEFAULT_LOCAL_BASE_URL = 'http://localhost:4000';

function resolveBaseUrl() {
  if (typeof process.env.PW_BASE_URL === 'string' && process.env.PW_BASE_URL.trim()) {
    return getAuditBaseUrl();
  }
  process.env.PW_BASE_URL = DEFAULT_LOCAL_BASE_URL;
  process.env.AUDIT_ALLOW_LOCAL_BASE_URL = '1';
  process.env.AUDIT_ALLOWED_BASE_URLS = [
    process.env.AUDIT_ALLOWED_BASE_URLS,
    DEFAULT_LOCAL_BASE_URL,
  ].filter(Boolean).join(',');
  return getAuditBaseUrl();
}

/** Largeurs réelles d'appareils, pas des valeurs de confort. */
const BREAKPOINTS = Object.freeze([
  { id: '375x812', width: 375, height: 812, device: 'iPhone SE / 13 mini' },
  { id: '393x852', width: 393, height: 852, device: 'iPhone 15/16 Pro — cible Sidestore' },
  { id: '768x1024', width: 768, height: 1024, device: 'iPad portrait' },
  { id: '1024x768', width: 1024, height: 768, device: 'iPad paysage' },
]);

/** Densité de capture : 2 pour que les glyphes de 13 px restent échantillonnables. */
const DSF = 2;
/** Seuil WCAG 2.2 : grand texte >= 24 px, ou >= 18,66 px en gras. */
const THRESHOLD = Object.freeze({ normal: 4.5, large: 3 });
/** Un texte doit s'écarter de la masse de sa boîte d'au moins cet écart de luminance. */
const MIN_GLYPH_SEPARATION = 0.05;
/**
 * Rayon de prelevement, en pixels de capture : anneau entre l'exclusion et
 * cette borne. Assez large pour etre dans le fond reel, assez etroit pour
 * rester « local » : sur une photo, 6 px de capture (3 px CSS) ne traversent
 * pas un degrade, mais un texte long echantillonne le ciel ET les arbres.
 */
const BACKGROUND_RADIUS = 6;
/** Nombre de tentatives par point de rupture avant de le declarer non mesure. */
const MEASURE_ATTEMPTS = 2;
/** Part des pixels extrêmes, en tête de distribution, retenue comme cœur de glyphe. */
const GLYPH_TAIL = 0.04;
const MIN_BACKGROUND_PIXELS = 4;
/**
 * Demi-largeur, en luminance relative, de la bande majoritaire considérée
 * comme fond. Au-delà, un pixel est déjà dans la queue du texte : c'est ce
 * qui empêche la rampe d'antialiasing d'être prélevée comme du fond.
 */
const BACKGROUND_LUMINANCE_BAND = 0.06;
/** En dessous, ce n'est pas un texte : un trait, un point, un filet. */
const MIN_GLYPH_PIXELS = 6;
/** Garde-fou de coût : au-delà, le noeud n'est pas une boîte de texte. */
const MAX_NODE_AREA_PX = 400000;
const MIN_NODE_SIDE_PX = 4;

/**
 * Sondes d'auto-vérification. Les couleurs sont fixées, mais le ratio
 * attendu est RECALCULÉ par la même formule WCAG que la mesure : aucune
 * valeur attendue n'est écrite à la main dans ce fichier.
 */
const SELFTEST_PROBES = Object.freeze([
  {
    id: 'violation-injectee',
    description: 'Texte #9AA09A sur plaque opaque #B0B4B0 — la photo est masquée par la plaque, le ratio est donc indépendant du fond réel.',
    plate: [176, 180, 176],
    text: [154, 160, 154],
    expectedVerdict: 'FAIL',
  },
  {
    id: 'controle-bande-dissolution',
    description: 'Sonde conforme (comme controle-conforme) mais forcee dans la bande de dissolution de .prep-body : elle doit etre REFUSEE, sinon la regle anti-vacuite ne prouve rien.',
    plate: [27, 33, 28],
    text: [255, 255, 255],
    expectedVerdict: 'FAIL',
    // `skipExpected` : ce verdict n est PAS un echec de contraste. La sonde
    // doit disparaitre de la liste des noeuds mesures avec le motif de
    // dissolution. Un harnais qui la mesurerait quand meme validerait ce
    // test sans rien prouver.
    expectSkipped: true,
  },
  {
    id: 'controle-conforme',
    description: 'Texte #FFFFFF sur plaque opaque #1B211C — doit passer très largement le seuil.',
    plate: [27, 33, 28],
    text: [255, 255, 255],
    expectedVerdict: 'PASS',
  },
]);

// ---------------------------------------------------------------------------
// Maths de couleur (identiques à scripts/audit/visual-contrast.mjs)
// ---------------------------------------------------------------------------

function channelLuminance(value) {
  const v = value / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(r, g, b) {
  return (
    0.2126 * channelLuminance(r) +
    0.7152 * channelLuminance(g) +
    0.0722 * channelLuminance(b)
  );
}

function contrastRatio(fg, bg) {
  const a = relativeLuminance(fg[0], fg[1], fg[2]);
  const b = relativeLuminance(bg[0], bg[1], bg[2]);
  const hi = Math.max(a, b);
  const lo = Math.min(a, b);
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * Couleur grise de luminance relative donnee.
 *
 * Le fond local etant memorise en LUMINANCE (c'est la seule grandeur qui
 * Defines le contraste WCAG), le rapport doit etre re-exprime dans l'espace
 * sRGB pour reutiliser `contrastRatio` sans une seconde formule. On inverse donc
 * la courbe relative, puis on reprojette sur les trois canaux.
 */
function srgbFromRelativeLuminance(luminance) {
  const clamped = Math.min(1, Math.max(0, luminance));
  const channel = clamped <= 0.0031308
    ? clamped * 12.92
    : 1.055 * Math.pow(clamped, 1 / 2.4) - 0.055;
  const value = Math.round(channel * 255);
  return [value, value, value];
}

function round2(value) {
  return Math.round(value * 100) / 100;
}

// ---------------------------------------------------------------------------
// Mesure par pixel
// ---------------------------------------------------------------------------

/** Dilatation Chebyshev séparable d'un masque, rayon `radius` en pixels. */
function dilate(mask, width, height, radius) {
  const horizontal = new Uint8Array(width * height);
  const output = new Uint8Array(width * height);
  for (let y = 0; y < height; y += 1) {
    const row = y * width;
    for (let x = 0; x < width; x += 1) {
      const from = Math.max(0, x - radius);
      const to = Math.min(width - 1, x + radius);
      let hit = 0;
      for (let k = from; k <= to; k += 1) {
        if (mask[row + k] === 1) { hit = 1; break; }
      }
      horizontal[row + x] = hit;
    }
  }
  for (let y = 0; y < height; y += 1) {
    const from = Math.max(0, y - radius);
    const to = Math.min(height - 1, y + radius);
    for (let x = 0; x < width; x += 1) {
      let hit = 0;
      for (let k = from; k <= to; k += 1) {
        if (horizontal[k * width + x] === 1) { hit = 1; break; }
      }
      output[y * width + x] = hit;
    }
  }
  return output;
}

/**
 * Mesure le contraste d'UNE boîte de texte contre le fond RÉELLEMENT PEINT
 * autour de ses glyphes.
 *
 * Principe : le fond utile n'est pas l'arrière-plan calculé de la boîte (le
 * calque photo n'est pas un ancêtre), ni la moyenne de la boîte (une ligne
 * qui traverse un ciel clair n'a pas un fond unique). C'est le fond local, à
 * quelques pixels du trait, dans la direction opposée au glyphe.
 *
 * @returns un verdict, ou un motif de skip explicite. Jamais de valeur estimée.
 */
function measureNode(pixels, imageWidth, node) {
  const x0 = Math.max(0, Math.round(node.left * DSF));
  const y0 = Math.max(0, Math.round(node.top * DSF));
  const x1 = Math.min(imageWidth, Math.round((node.left + node.width) * DSF));
  const y1 = Math.min(Math.floor(pixels.length / 3 / imageWidth), Math.round((node.top + node.height) * DSF));
  const boxWidth = x1 - x0;
  const boxHeight = y1 - y0;

  if (boxWidth < MIN_NODE_SIDE_PX || boxHeight < MIN_NODE_SIDE_PX) {
    return { skipped: 'boîte trop petite pour être échantillonnée' };
  }
  const total = boxWidth * boxHeight;
  if (total > MAX_NODE_AREA_PX) {
    return { skipped: 'boîte trop grande : ce noeud n’est pas une boîte de texte' };
  }

  const binCount = new Float64Array(256);
  const binR = new Float64Array(256);
  const binG = new Float64Array(256);
  const binB = new Float64Array(256);
  const rgb = new Uint8Array(total * 3);

  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      const source = (y * imageWidth + x) * 3;
      const index = (y - y0) * boxWidth + (x - x0);
      const r = pixels[source];
      const g = pixels[source + 1];
      const b = pixels[source + 2];
      rgb[index * 3] = r;
      rgb[index * 3 + 1] = g;
      rgb[index * 3 + 2] = b;
      const bin = Math.min(255, Math.max(0, Math.round(relativeLuminance(r, g, b) * 255)));
      binCount[bin] += 1;
      binR[bin] += r;
      binG[bin] += g;
      binB[bin] += b;
    }
  }

  // --- SEPARATION GLYPHE / FOND, ANCREE SUR LA POLARITE DECLAREE ---------
  //
  // REFONTE DU 2026-09-29, et pourquoi elle etait necessaire.
  //
  // L'ancienne methode marquait "glyphe" les pixels proches de la MOYENNE de
  // la queue de distribution, puis prelevait le fond dans un anneau de
  // `BACKGROUND_RADIUS` autour de ce glyphe. Les pixels COEUR du trait sont
  // les plus Eloignes de cette moyenne : un blanc pur (255,255,255) est a
  // 121 de distance Manhattan de la moyenne (223,219,202) d'un texte blanc
  // antialiasé. Ils sortaient donc du masque et tombaient dans l'anneau
  // de "fond".
  //
  // Consequence mesuree : l'audit comparait le texte a LUI-MEME et concluait
  // 1,04:1 sur une pastille parfaitement lisible. Le symptome est
  // reconnaissable sans ambiguite — un "fond" plus clair que le glyphe sur
  // un texte clair. C'est un faux positif de methode, pas un defaut d'ecran :
  // mesure de controle par difference de rendu (texte transparent contre
  // texte visible), le meme element vaut 16,2:1.
  //
  // La nouvelle methode n'essaie plus de deviner le glyphe par ressemblance :
  //   1. la MEDIANE de luminance de la boite est le fond majoritaire ;
  //   2. le glyphe est la queue OPPOSEE a cette mediane, du cote que donne
  //      la couleur DECLAREE (`node.lightText`, relue dans le DOM) ;
  //   3. le fond retenu reste LOCAL (mediane des non-glyphenes a moins de
  //      `BACKGROUND_RADIUS` du glyphe), donc on ne compare pas un texte a
  //      une couleur de fond eloignee de plusieurs centimètres ;
  //   4. l'INVARIANT de polarite refuse de conclure si le fond n'est pas du
  //      bon cote du glyphe. Une mesure qui s'auto-contredit devient un
  //      "skipped" trace, jamais un FAIL : mieux vaut une case non mesuree
  //      qu'un echec invente.
  const luminance = new Float64Array(total);
  for (let i = 0; i < total; i += 1) {
    luminance[i] = relativeLuminance(rgb[i * 3], rgb[i * 3 + 1], rgb[i * 3 + 2]);
  }
  const ordered = Array.from(luminance).sort((a, b) => a - b);
  const medianLuminance = ordered[Math.floor(total / 2)];

  // Bande de fond autour de la mediane. On l'elargit si la boite est trop
  // petite pour fournir assez de pixels de fond, plutot que d'exclure
  // l'element : un texte valide ne doit pas devenir invisible au rapport.
  let band = BACKGROUND_LUMINANCE_BAND;
  let backgroundSeedCount = 0;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    backgroundSeedCount = 0;
    for (let i = 0; i < total; i += 1) {
      if (Math.abs(luminance[i] - medianLuminance) <= band) backgroundSeedCount += 1;
    }
    if (backgroundSeedCount >= MIN_BACKGROUND_PIXELS) break;
    band *= 2;
  }
  if (backgroundSeedCount < MIN_BACKGROUND_PIXELS) {
    return { skipped: 'fond majoritaire indisponible dans cette boîte' };
  }

  const isGlyph = new Uint8Array(total);
  let glyphPixelCount = 0;
  for (let i = 0; i < total; i += 1) {
    const isTail = node.lightText
      ? luminance[i] > medianLuminance + band
      : luminance[i] < medianLuminance - band;
    if (isTail) { isGlyph[i] = 1; glyphPixelCount += 1; }
  }
  if (glyphPixelCount < MIN_GLYPH_PIXELS) {
    return { skipped: 'aucun glyphe distinguable du fond dans cette boîte' };
  }

  // Coeur de glyphe : la queue extreme du cote du texte, en RGB moyen.
  // On ne le prend plus dans toute la boite mais parmi les pixels reaffirimes
  // comme glyphe, donc le coeur du trait n'est plus preleve comme du fond.
  const glyphIndexes = [];
  for (let i = 0; i < total; i += 1) if (isGlyph[i] === 1) glyphIndexes.push(i);
  glyphIndexes.sort((a, b) => (node.lightText
    ? luminance[b] - luminance[a]
    : luminance[a] - luminance[b]));
  const coreCount = Math.max(2, Math.floor(glyphIndexes.length * GLYPH_TAIL));
  let sumR = 0;
  let sumG = 0;
  let sumB = 0;
  for (let k = 0; k < coreCount; k += 1) {
    const i = glyphIndexes[k];
    sumR += rgb[i * 3];
    sumG += rgb[i * 3 + 1];
    sumB += rgb[i * 3 + 2];
  }
  const glyph = [sumR / coreCount, sumG / coreCount, sumB / coreCount];

  // Fond LOCAL : mediane de luminance des non-glyphenes proches du glyphe.
  // Candidats au fond : les pixels de la BANDE majoritaire, a moins de
  // `BACKGROUND_RADIUS` du glyphe. Le filtre sur la bande est ce qui exclut
  // la rampe d'antialiasing : un pixel a mi-chemin entre le fond et le trait
  // est du cote du glyphe par construction, donc jamais candidat au fond.
  const nearGlyph = dilate(isGlyph, boxWidth, boxHeight, BACKGROUND_RADIUS);
  const localBackgrounds = [];
  for (let i = 0; i < total; i += 1) {
    if (isGlyph[i] === 1 || nearGlyph[i] === 0) continue;
    if (Math.abs(luminance[i] - medianLuminance) > band) continue;
    localBackgrounds.push(luminance[i]);
  }
  let backgroundLuminance;
  let backgroundSource;
  if (localBackgrounds.length >= MIN_BACKGROUND_PIXELS) {
    localBackgrounds.sort((a, b) => a - b);
    backgroundLuminance = localBackgrounds[Math.floor(localBackgrounds.length / 2)];
    backgroundSource = 'local';
  } else {
    // Boite trop petite pour un anneau : on prend la majorite de la boite.
    // C'est moins fin, mais toujours mesure, et l'invariant plus bas decide
    // si le resultat est exploitable.
    backgroundLuminance = medianLuminance;
    backgroundSource = 'boite';
  }

  const glyphLuminance = relativeLuminance(glyph[0], glyph[1], glyph[2]);
  if (Math.abs(glyphLuminance - backgroundLuminance) < MIN_GLYPH_SEPARATION) {
    return { skipped: 'aucun glyphe distinguable du fond dans cette boîte' };
  }

  // --- INVARIANT DE POLARITE --------------------------------------------
  // Un texte clair est NECESSAIREMENT sur un fond plus sombre, et l'inverse.
  // Si la mesure dit le contraire, elle s'est auto-contredite : elle est
  // declaree non fiable plutot que rendue comme un echec. C'est ce controle
  // qui rend l'artefact de 1,04:1 IMPOSSIBLE a re-apparaitre, meme si la
  // methode de separation retombait un jour.
  const polarityOk = node.lightText
    ? glyphLuminance > backgroundLuminance + MIN_GLYPH_SEPARATION
    : glyphLuminance < backgroundLuminance - MIN_GLYPH_SEPARATION;
  if (!polarityOk) {
    return {
      skipped: 'polarité non vérifiable : le fond prélevé est du côté du texte',
    };
  }

  // Le verdict retient le fond LOCAL LE MOINS FAVORABLE du voisinage, pas
  // la mediane : un fond qui degrade localement (reflet de verre, bord de
  // pastille) ne doit pas pouvoir etre arrondi vers le haut. On reste
  // aussi severe que l'ancienne version, donc la refonte ne peut pas
  // adoucir un verdict pour le faire passer.
  const candidates = backgroundSource === 'local' ? localBackgrounds : [backgroundLuminance];
  let worst = Number.POSITIVE_INFINITY;
  let best = 0;
  let worstBackground = null;
  for (let k = 0; k < candidates.length; k += 1) {
    const candidate = srgbFromRelativeLuminance(candidates[k]);
    const value = contrastRatio(glyph, candidate);
    if (value < worst) { worst = value; worstBackground = candidate; }
    if (value > best) best = value;
  }

  const large = node.fontSize >= 24 || (node.fontSize >= 18.66 && node.fontWeight >= 700);
  const threshold = large ? THRESHOLD.large : THRESHOLD.normal;
  return {
    glyph: glyph.map((v) => Math.round(v)),
    backgroundAtWorst: worstBackground,
    worst: round2(worst),
    best: round2(best),
    threshold,
    verdict: worst >= threshold ? 'PASS' : 'FAIL',
    backgroundPixels: candidates.length,
    backgroundSource,
    medianLuminance: round2(medianLuminance),
    polarity: node.lightText ? 'clair-sur-fond' : 'foncé-sur-fond',
  };
}

// ---------------------------------------------------------------------------
// Extraction des noeuds de texte — exécuté dans la page
// ---------------------------------------------------------------------------

const COLLECT_TEXT_NODES = () => {
  // Pas de exclusion blanket de BUTTON : un bouton dont le libelle est un noeud
  // texte direct doit etre mesure. La regle « noeud texte direct » suffit a
  // eviter de compter deux fois un libelle enveloppe dans un <span>.
  const SKIP_TAGS = new Set([
    'CANVAS', 'NOSCRIPT', 'PATH', 'SCRIPT', 'STYLE', 'SVG', 'TEXT', 'IMG',
    'BR', 'SUP', 'SELECT', 'OPTION', 'IFRAME', 'AUDIO', 'VIDEO', 'INPUT',
  ]);
  const parseColor = (value) => {
    const match = String(value).match(/rgba?\(([^)]+)\)/);
    if (!match) return null;
    const parts = match[1].split(/[,\s/]+/).filter(Boolean).map(Number);
    if (parts.length < 3 || parts.slice(0, 3).some((v) => !Number.isFinite(v))) return null;
    return [parts[0], parts[1], parts[2]];
  };
  // Inline : page.evaluate n'a pas acces au scope du module.
  const channelLuminance = (value) => {
    const v = value / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  const relativeLuminance = (r, g, b) => (
    0.2126 * channelLuminance(r) + 0.7152 * channelLuminance(g) + 0.0722 * channelLuminance(b)
  );
  const viewportHeight = window.innerHeight;
  const viewportWidth = window.innerWidth;
  // Cadre REELLEMENT PEINT : l'intersection de la boite avec le scrollport de
  // chacun de ses ancetres a debordement. `measureNode` rogne toujours sur le
  // rectangle de l'element ; si une partie de ce rectangle est rognee par un
  // conteneur, le crop mord sur ce qui est peint a la place (pied de page,
  // rail de jours, photo) et le contraste releve porte alors sur les pixels
  // d'un AUTRE element. Refuser de cadrer une boite partiellement rognee
  // vaut mieux que la mesurer de travers.
  const paintedFrame = (element) => {
    const frame = { left: 0, top: 0, right: viewportWidth, bottom: viewportHeight };
    for (let parent = element.parentElement; parent && parent !== document.documentElement; parent = parent.parentElement) {
      const style = getComputedStyle(parent);
      const clipsY = /^(auto|scroll|overlay|hidden)$/.test(style.overflowY);
      const clipsX = /^(auto|scroll|overlay|hidden)$/.test(style.overflowX);
      if (!clipsY && !clipsX) continue;
      const box = parent.getBoundingClientRect();
      if (clipsY) {
        frame.top = Math.max(frame.top, box.bottom < frame.top ? frame.top : box.top);
        frame.bottom = Math.min(frame.bottom, box.bottom);
      }
      if (clipsX) {
        frame.left = Math.max(frame.left, box.left);
        frame.right = Math.min(frame.right, box.right);
      }
    }
    return frame;
  };
  // Un conteneur defilable qui dissout son bas (`mask-image`) est un AUTRE
  // cas de non-mesurabilite, et le plus piegeux des deux : dans la bande de
  // fondu, texte ET panneau s estompent ENSEMBLE vers le fond (photo). Le
  // composite converge toujours vers la couleur du fond, quel que soit le
  // fond : aucun backdrop, aucune epaisseur, aucune opacite ne peut garantir
  // 4,5:1 la ou le masque avale deja la plaque. Un ratio releve dans la
  // bande ne decrit donc plus le contraste DU TEXTE, il decrit un
  // melange texte+fond que la maquette ne pretend pas garantir.
  // On reconnait UNIQUEMENT la forme qu impose le design : un fondu lineaire
  // vertical, opaque jusqu a `calc(100% - Npx)`, puis transparent a 100 %.
  // Tout autre masque (radial, degrade lateral, icone SVG) est ignore :
  // confondre un masque graphique avec une dissolution de scroll
  // reviendrait a effacer des echecs reels.
  const dissolveBandOf = (element) => {
    for (let parent = element.parentElement; parent && parent !== document.documentElement; parent = parent.parentElement) {
      const mask = getComputedStyle(parent).maskImage;
      if (!mask || mask === 'none') continue;
      // Chrome OMET la direction quand elle vaut `to bottom` : la valeur
      // calculee est `linear-gradient(rgb(0, 0, 0) calc(100% - 60px), ...)`,
      // SANS `to bottom`. Une garde qui exigerait la direction ecrirait donc
      // une regle morte — c est exactement ce qu elle a fait au premier essai,
      // et la sonde de controle l a signale. On accepte les deux serialisations.
      // On refuse en revanche toute autre direction (`to right`, `to top`,
      // `45deg`) : une dissolution LATERALE ne prouve rien du defilement.
      if (!/^linear-gradient\(/.test(mask)) continue;
      if (/^linear-gradient\(\s*(?!to bottom\b|rgb|#000|rgba)/.test(mask)) continue;
      if (/^linear-gradient\(\s*(?:to (?!bottom)\w+|\d)/.test(mask)) continue;
      // Chrome serialise `#000` en `rgb(0, 0, 0)` et `transparent` en
      // `rgba(0, 0, 0, 0)` : on lit la FORME, pas la couleur du fondu, qui
      // est noir par construction.
      // Forme DECISIVE : opaque jusqu a `calc(100% - Npx)`, puis
      // transparent a 100 %. C est elle qui definit la bande, et elle
      // seule : un degrade lateral, un masque SVG ou un fondu a paliers
      // ne produit pas cette signature et reste ignore.
      // Couleur noire du fondu : Chrome serialise `rgb(0, 0, 0)` ou
      // `rgba(0, 0, 0, 1)`, la feuille ecrit `#000`. On lit la FORME, pas
      // la couleur, qui est noire par construction.
      const NOIR = String.raw`rgba?\(\s*0\s*,\s*0\s*,\s*0(?:\s*,\s*[\d.]+)?\s*\)`;
      const TRANSPARENT = String.raw`(?:rgba?\(\s*0\s*,\s*0\s*,\s*0\s*,\s*0\s*\)|transparent)`;
      const SHAPE = new RegExp(
        String.raw`^linear-gradient\(\s*(?:to bottom\s*,\s*)?(?:#000\b|` + NOIR
          + String.raw`)\s*calc\(100%\s*-\s*([\d.]+)px\)\s*,\s*` + TRANSPARENT
          + String.raw`\s+100%\s*\)$`
      );
      const found = SHAPE.exec(mask);
      if (!found) continue;
      const height = Number.parseFloat(found[1]);
      if (!Number.isFinite(height) || height <= 0) continue;
      const box = parent.getBoundingClientRect();
      return {
        ancestor: `${parent.tagName.toLowerCase()}.${String(parent.className || '').replace(/\s+/g, ' ').trim().slice(0, 60)}`,
        height,
        top: box.bottom - height,
        bottom: box.bottom,
      };
    }
    return null;
  };
  const results = [];
  for (const element of document.querySelectorAll('body *')) {
    if (SKIP_TAGS.has(element.tagName)) continue;
    if (element.closest('[data-prep-audit-hidden]')) continue;
    if (typeof element.checkVisibility === 'function'
      && !element.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) continue;
    const hasOwnText = Array.from(element.childNodes)
      .some((node) => node.nodeType === 3 && node.textContent.trim().length > 0);
    if (!hasOwnText) continue;
    const style = getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden') continue;
    const rect = element.getBoundingClientRect();
    // On ne mesure que ce qui est ENTIÈREMENT dans la capture : sinon le
    // rectangle et les pixels ne décrivent pas la même zone. La règle vaut
    // aussi en horizontal : une pilule à moitié rognée par un carrousel a un
    // rectangle plus large que la capture, et `measureNode` bornerait alors
    // sa boîte au bord de l'image sans le dire. Plutôt qu'un `continue`
    // muet, on enregistre un motif de skip : la couverture reste traçable.
    if (rect.top < 0 || rect.bottom > viewportHeight || rect.left < 0 || rect.right > window.innerWidth) {
      results.push({
        text: (element.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80),
        classes: typeof element.className === 'string' ? element.className.replace(/\s+/g, ' ').trim().slice(0, 90) : '',
        tag: element.tagName.toLowerCase(),
        skippedInPage: 'rectangle hors cadre : rogné horizontalement ou verticalement',
        occluded: false,
        occludedBy: null,
        occlusionUnverifiable: false,
        probeId: null,
      });
      continue;
    }
    if (rect.width < 4 || rect.height < 4) continue;
    const frame = paintedFrame(element);
    const band = dissolveBandOf(element);
    // Intersection seulement : une boite qui EFFLEURE la bande n y est pas
    // entierement dissoute, et une boite a cheval garde une part de plaque
    // reellement peinte — la mesurer vaudrait mieux que de la rejeter.
    if (band && rect.bottom > band.top + 0.5 && rect.top < band.bottom - 0.5) {
      results.push({
        text: (element.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80),
        classes: typeof element.className === 'string' ? element.className.replace(/\s+/g, ' ').trim().slice(0, 90) : '',
        tag: element.tagName.toLowerCase(),
        skippedInPage: `boite a cheval sur la bande de dissolution du scroll (${band.ancestor}, ${band.height}px) : texte et panneau s estompent ensemble vers le fond, le ratio releve decrireait un composite et non le rendu du texte`,
        occluded: false,
        occludedBy: null,
        occlusionUnverifiable: false,
        probeId: element.closest('[data-prep-audit-probe]')
          ? element.closest('[data-prep-audit-probe]').getAttribute('data-prep-audit-probe')
          : null,
      });
      continue;
    }
    const fullyPainted = rect.top >= frame.top - 0.5 && rect.bottom <= frame.bottom + 0.5
      && rect.left >= frame.left - 0.5 && rect.right <= frame.right + 0.5;
    if (!fullyPainted) {
      results.push({
        text: (element.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80),
        classes: typeof element.className === 'string' ? element.className.replace(/\s+/g, ' ').trim().slice(0, 90) : '',
        tag: element.tagName.toLowerCase(),
        skippedInPage: 'boîte rognée par un conteneur à débordement : les pixels du crop ne seraient pas ceux du texte',
        occluded: false,
        occludedBy: null,
        occlusionUnverifiable: false,
        probeId: null,
      });
      continue;
    }
    const declared = parseColor(style.color);
    if (!declared) continue;
    // `elementsFromPoint` renvoie la pile de hit-test complete, du plus haut
    // au plus bas. Un seul element (`elementFromPoint`) ne permet pas de
    // distinguer « masque au-dessus » de « masque en dessous ».
    // Le test se fait sur une GRILLE 5 x 3, pas sur le seul centre. Un point
    // central laisse passer deux defauts de couverture, tous deux observes sur
    // `/prepare` : une barre collante qui ne recouvre que le HAUT de la boite
    // (`.prep-step__reason` fait 249x18, sa premiere moitie passe sous
    // `.prep-footer` au palier 682), et une boite rognee dont le centre tombe
    // encore dans le scrollport. Dans les deux cas le crop mord sur l'element
    // recouvrant et le contraste releve n'est plus celui du texte.
    // Un DESCENDANT de la cible n'est pas un recouvrant : sans cette exclusion
    // un `<span>` interne ferait passer une boite parfaitement degagee pour
    // masquee, ce qui serait une exclusion de trop.
    const GRID_COLUMNS = 5;
    const GRID_ROWS = 3;
    const occluderTally = new Map();
    let centreDepth = -1;
    for (let row = 0; row < GRID_ROWS; row += 1) {
      for (let column = 0; column < GRID_COLUMNS; column += 1) {
        const pointX = Math.min(viewportWidth - 1, Math.max(0, rect.left + (rect.width * (column + 0.5)) / GRID_COLUMNS));
        const pointY = Math.min(viewportHeight - 1, Math.max(0, rect.top + (rect.height * (row + 0.5)) / GRID_ROWS));
        const stack = document.elementsFromPoint(pointX, pointY);
        const depth = stack.indexOf(element);
        if (row === 1 && column === 2) centreDepth = depth;
        // depth === 0 : la cible EST au sommet, rien ne la masque.
        // depth === -1 : la cible est ABSENTE de la pile alors qu'elle est
        // visible a ces coordonnees. Elle est donc rognee ou couverte par un
        // element peint apres elle — un bandeau translucide en flux normal,
        // par exemple, qui la depasse sans etre son ancetre. Le `continue`
        // d avant traitait ces deux cas comme identiques : le crop mordait
        // alors sur les pixels du recouvrant et le contraste releve portait
        // sur un AUTRE element. Mesure au navigateur, 1024x768, palier 8 :
        // `.prep-stale` (60-156) couvre `.prep-programme__steptitle`
        // (91-115), depth vaut -1, et le rapport concluait 3,51:1 sur un texte
        // qui vaut 18,77:1 des lors qu il est cadre entierement.
        if (depth === 0) continue;
        if (depth === -1) {
          occluderTally.set('[absente de la pile : rognee ou couverte]', (occluderTally.get('[absente de la pile : rognee ou couverte]') ?? 0) + 1);
          continue;
        }
        const top = stack[0];
        if (top === element || (top && element.contains(top))) continue;
        const name = String((top && top.className) || (top && top.tagName) || '?')
          .replace(/\s+/g, ' ').trim().slice(0, 70);
        occluderTally.set(name, (occluderTally.get(name) ?? 0) + 1);
      }
    }
    const occluder = [...occluderTally.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    // Un element `pointer-events: none` est absent de la pile : le hit-test
    // ne peut alors ni confirmer ni infirmer qu'il est masque. Plutot que de
    // l'exclure (on masquerait un vrai echec) ou de l'accuser a tort, on le
    // garde dans les vericts et on signale l'incertitude.
    const unverifiable = centreDepth === -1 && getComputedStyle(element).pointerEvents === 'none';
    const occluded = occluder !== null || (centreDepth === -1 && !unverifiable);
    // Absent de la pile alors qu'il devrait s'y trouver : l'element est rogne
    // par un conteneur a debordement dont le scrollport ne couvre pas le
    // point (liste horizontale, corps defilant, ...). Nommer ce conteneur rend
    // le defaut actionnable au lieu de laisser « inconnu » dans le rapport.
    const centreX = Math.min(viewportWidth - 1, Math.max(0, rect.left + rect.width / 2));
    const centreY = Math.min(viewportHeight - 1, Math.max(0, rect.top + rect.height / 2));
    const clipper = (() => {
      if (centreDepth !== -1) return null;
      for (let parent = element.parentElement; parent && parent !== document.body; parent = parent.parentElement) {
        const style = getComputedStyle(parent);
        if (style.overflowX === 'visible' && style.overflowY === 'visible') continue;
        const box = parent.getBoundingClientRect();
        const covers = centreX >= box.left && centreX <= box.right && centreY >= box.top && centreY <= box.bottom;
        if (covers) continue;
        return `${parent.tagName.toLowerCase()}.${String(parent.className || '').replace(/\s+/g, ' ').trim().slice(0, 60)}`;
      }
      return null;
    })();
    const probe = element.closest('[data-prep-audit-probe]');
    results.push({
      occluded,
      occludedBy: occluder || clipper,
      occlusionKind: occluder ? 'element au-dessus' : (clipper ? 'rogne par un conteneur a debordement' : null),
      occlusionUnverifiable: unverifiable,
      text: (element.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80),
      classes: typeof element.className === 'string'
        ? element.className.replace(/\s+/g, ' ').trim().slice(0, 90)
        : '',
      tag: element.tagName.toLowerCase(),
      declaredColor: style.color,
      lightText: relativeLuminance(declared[0], declared[1], declared[2]) > 0.35,
      fontSize: Number.parseFloat(style.fontSize) || 0,
      fontWeight: Number.parseInt(style.fontWeight, 10) || 400,
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
      probeId: probe ? probe.getAttribute('data-prep-audit-probe') : null,
    });
  }
  for (const input of document.querySelectorAll('input[placeholder], textarea[placeholder]')) {
    if (input.closest('[data-prep-audit-hidden]')) continue;
    if (typeof input.checkVisibility === 'function'
      && !input.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) continue;
    const placeholderStyle = getComputedStyle(input, '::placeholder');
    const declared = parseColor(placeholderStyle.color);
    if (!declared) continue;
    const rect = input.getBoundingClientRect();
    if (rect.top < 0 || rect.bottom > viewportHeight) continue;
    if (rect.width < 4 || rect.height < 4) continue;
    results.push({
      text: `placeholder: ${input.placeholder}`.slice(0, 80),
      classes: typeof input.className === 'string' ? input.className.replace(/\s+/g, ' ').trim().slice(0, 90) : '',
      tag: 'placeholder',
      declaredColor: placeholderStyle.color,
      lightText: relativeLuminance(declared[0], declared[1], declared[2]) > 0.35,
      fontSize: Number.parseFloat(placeholderStyle.fontSize) || Number.parseFloat(getComputedStyle(input).fontSize) || 0,
      fontWeight: Number.parseInt(placeholderStyle.fontWeight, 10) || 400,
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
      occluded: false,
      occludedBy: null,
      occlusionUnverifiable: false,
      probeId: null,
    });
  }
  return results;
};

const HIDE_COOKIE_BANNER = () => {
  const normalize = (value) => (value || '').replace(/\s+/g, ' ').trim();
  // Le libellé « Tout accepter » vit DANS le bouton, pas dans le bandeau.
  // Ancrer la recherche sur le bandeau ne trouve donc jamais son propre texte :
  // on ancre sur le bouton, puis on remonte à son conteneur.
  const accept = Array.from(document.querySelectorAll('button, [role="button"]'))
    .find((button) => /^tout accepter$/i.test(normalize(button.textContent)));
  if (!accept) return { dismissed: false, reason: 'bouton « Tout accepter » introuvable' };
  const buttonWidth = accept.getBoundingClientRect().width;
  let host = accept;
  for (let depth = 0; depth < 8; depth += 1) {
    const parent = host.parentElement;
    if (!parent || parent === document.body || parent === document.documentElement) break;
    if (!/cookies/i.test(normalize(parent.textContent))) break;
    if (parent.getBoundingClientRect().width < buttonWidth * 1.15) break;
    host = parent;
  }
  host.setAttribute('data-prep-audit-hidden', 'cookie');
  host.style.setProperty('display', 'none', 'important');
  return {
    dismissed: true,
    scope: host === accept ? 'bouton' : 'bandeau',
    tag: host.tagName,
    classes: typeof host.className === 'string' ? host.className.replace(/\s+/g, ' ').slice(0, 80) : '',
  };
};

const COOKIE_BANNER_PRESENT = () => {
  const normalize = (value) => (value || '').replace(/\s+/g, ' ').trim();
  return Array.from(document.querySelectorAll('button, [role="button"]'))
    .some((button) => /^tout accepter$/i.test(normalize(button.textContent))
      && button.checkVisibility
      && button.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }));
};

const HAS_PHOTO_LAYER = () => {
  for (const element of document.querySelectorAll('body *')) {
    const backgroundImage = getComputedStyle(element).backgroundImage;
    if (backgroundImage && backgroundImage !== 'none' && backgroundImage.includes('url(')) return true;
  }
  return false;
};

/**
 * Auto-verification.
 *
 * `placement` decide si la sonde doit etre MESUREE ou si elle doit etre
 * REFUSEE par la regle de bande de dissolution :
 *
 *   - `mesure` (defaut) : bandeau fixe en haut du viewport. La sonde est
 *     mesuree normalement, et son ratio doit corroborer la calculatrice
 *     WCAG — c est la preuve que le harnais mesure correctement.
 *   - `bande-dissolution` : la sonde est placee dans un conteneur qui
 *     reproduit la forme EXACTE du fondu impose sur `.prep-body`
 *     (`linear-gradient(to bottom, #000 calc(100% - Npx), transparent
 *     100%)`), et son texte est cale dans les N derniers pixels. Les
 *     couleurs sont celles d une sonde CONFORME : sans la regle, elle
 *     passerait. Elle doit donc etre refusee — sinon le test valide une
 *     regle qui ne s applique a rien.
 *
 * On construit un conteneur dedie plutot que d accoler la sonde a un
 * scrollport reel : la regle cherche un ANCETRE masque, et la preuve
 * doit porter sur la regle elle-meme, pas sur la position d un
 * element qu on aurait a replacer a chaque palier de defilement.
 */
const INJECT_PROBE = ({ probeId, plate, text, placement, bandPx }) => {
  const host = document.createElement('div');
  host.setAttribute('data-prep-audit-probe', probeId);
  // PAS de `pointer-events: none` : `elementsFromPoint` ignore les sous-arbres
  // qui le portent, la sonde se verifierait recouverte par ce qu elle masque.
  if (placement === 'bande-dissolution') {
    const height = 200;
    host.style.cssText = 'position:fixed;left:0;top:40px;width:100%;height:'
      + height + 'px;z-index:2147483647;pointer-events:auto;'
      + '-webkit-mask-image:linear-gradient(to bottom, #000 calc(100% - '
      + bandPx + 'px), transparent 100%);'
      + 'mask-image:linear-gradient(to bottom, #000 calc(100% - '
      + bandPx + 'px), transparent 100%);';
    const box = document.createElement('div');
    // Le texte est cale DANS la bande : il doit etre lu, mais refuse.
    box.style.cssText = 'position:absolute;left:20px;bottom:8px;width:260px;'
      + 'display:block;margin:0;padding:12px 14px;'
      + 'font-family:system-ui,sans-serif;font-size:16px;font-weight:600;line-height:1.25;'
      + `color:rgb(${text.join(',')});background:rgb(${plate.join(',')});`;
    box.textContent = 'Sonde de contraste';
    host.appendChild(box);
    document.body.appendChild(host);
    return true;
  }
  host.style.cssText = 'position:fixed;left:0;top:0;width:100%;z-index:2147483647;';
  const box = document.createElement('div');
  box.style.cssText = 'display:inline-block;margin:0;padding:12px 14px;'
    + 'font-family:system-ui,sans-serif;font-size:16px;font-weight:600;line-height:1.25;'
    + `color:rgb(${text.join(',')});background:rgb(${plate.join(',')});`;
  box.textContent = 'Sonde de contraste';
  host.appendChild(box);
  document.body.appendChild(host);
  return true;
};

const REMOVE_PROBES = () => {
  for (const probe of document.querySelectorAll('[data-prep-audit-probe]')) probe.remove();
  return true;
};

/**
 * `/prepare` ne defile PAS la fenetre : `document.scrollHeight === innerHeight`.
 * Le contenu, lui, defile dans `div.prep-body` (`overflow-y: auto`). Un
 * `window.scrollTo` sans effet ne mesurerait donc que le premier ecran, et
 * le rapport afficherait une couverture largement fausse. On marque tous les
 * conteneurs reellement defilables pour les piloter ensemble avec la fenetre.
 */
const FIND_SCROLL_CONTAINERS = () => {
  for (const stale of document.querySelectorAll('[data-prep-audit-scroller]')) {
    stale.removeAttribute('data-prep-audit-scroller');
  }
  const found = [];
  for (const element of document.querySelectorAll('body *')) {
    const style = getComputedStyle(element);
    const scrollableY = /^(auto|scroll|overlay)$/.test(style.overflowY) && element.scrollHeight > element.clientHeight + 1;
    const scrollableX = /^(auto|scroll|overlay)$/.test(style.overflowX) && element.scrollWidth > element.clientWidth + 1;
    if (!scrollableY && !scrollableX) continue;
    element.setAttribute('data-prep-audit-scroller', String(found.length));
    found.push({
      index: found.length,
      selector: `${element.tagName.toLowerCase()}.${String(element.className || '').replace(/\s+/g, ' ').trim().slice(0, 60)}`,
      axisY: scrollableY,
      axisX: scrollableX,
      clientHeightY: scrollableY ? element.clientHeight : 0,
      scrollablePxY: scrollableY ? element.scrollHeight - element.clientHeight : 0,
      scrollablePxX: scrollableX ? element.scrollWidth - element.clientWidth : 0,
    });
  }
  return found;
};

/** Amene la fenetre ET tous les conteneurs internes au meme palier de defilement. */
const SCROLL_EVERYTHING = (value) => {
  window.scrollTo(0, value);
  for (const element of document.querySelectorAll('[data-prep-audit-scroller]')) {
    const index = Number(element.getAttribute('data-prep-audit-scroller'));
    if (Number.isNaN(index)) continue;
    if (getComputedStyle(element).overflowY !== 'hidden') {
      element.scrollTop = Math.min(value, Math.max(0, element.scrollHeight - element.clientHeight));
    }
    if (getComputedStyle(element).overflowX !== 'hidden') {
      element.scrollLeft = Math.min(value, Math.max(0, element.scrollWidth - element.clientWidth));
    }
  }
  return true;
};

const RESET_SCROLL = () => {
  window.scrollTo(0, 0);
  for (const element of document.querySelectorAll('[data-prep-audit-scroller]')) {
    element.scrollTop = 0;
    element.scrollLeft = 0;
  }
  return true;
};

const READ_PAGE_STATE = () => {
  const storage = (key) => {
    try { return window.localStorage.getItem(key); } catch { return null; }
  };
  const layer = document.querySelector('.lkv-app-background');
  const layerStyle = layer ? getComputedStyle(layer) : null;
  const urls = layerStyle
    ? (layerStyle.backgroundImage.match(/url\((["']?)([^"')]+)\1\)/g) || [])
    : [];
  return {
    theme: document.documentElement.dataset.theme
      || (document.documentElement.classList.contains('dark') ? 'dark' : 'light'),
    glassIntensity: storage('lkdv_glass_intensity'),
    cookieConsent: storage('lkdv_cookie_consent'),
    activeAdventure: storage('lkv_active_adventure') !== null,
    htmlBackground: getComputedStyle(document.documentElement).backgroundColor,
    photoLayer: layer ? {
      selector: '.lkv-app-background',
      position: layerStyle.position,
      zIndex: layerStyle.zIndex,
      backgroundAttachment: layerStyle.backgroundAttachment,
      backgroundSize: layerStyle.backgroundSize,
      photos: urls.map((entry) => entry.replace(/^url\(["']?/, '').replace(/["']?\)$/, '')),
    } : null,
  };
};

// ---------------------------------------------------------------------------
// Pilotage du navigateur
// ---------------------------------------------------------------------------

async function waitForPhotoLayer(page) {
  try {
    await page.waitForFunction(HAS_PHOTO_LAYER, null, { timeout: 20000, polling: 250 });
    return { mounted: true };
  } catch {
    return {
      mounted: false,
      note: 'Aucun calque de photo trouvé : la capture ne verrait qu’un aplat, la mesure serait sans valeur.',
    };
  }
}

/**
 * Un `page.evaluate` qui survit a un redemarrage de page.
 *
 * Charger `/prepare` declenche un aller-retour (chargement de donnees,
 * redirection client) qui detruit le contexte d execution. `page.evaluate`
 * leve alors `Execution context was destroyed` - une COURSE de chargement,
 * pas une panne. Sans filet, l auto-verification echoue sur un detail de
 * timing et les 98 mesures de la campagne partent avec elle.
 *
 * On rejoue jusqu a trois fois, en attendant la reprise a chaque fois. Au
 * dela, l erreur remonte telle quelle : une page reellement morte doit
 * continuer de se voir, elle ne doit pas etre masquee par une patience.
 */
async function safeEvaluate(page, fn, arg) {
  const DESTRUCTIBLE = /Execution context was destroyed|Target closed|Navigating frame was detached/i;
  for (let tentative = 0; tentative < 3; tentative += 1) {
    try {
      return await page.evaluate(fn, arg);
    } catch (err) {
      const motif = String(err && err.message ? err.message : err);
      if (!DESTRUCTIBLE.test(motif) || tentative === 2) throw err;
      await page.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(400);
    }
  }
  throw new Error('safeEvaluate : boucle epuisee sans lever ni valeur ni erreur utile');
}

async function dismissCookieBanner(page) {
  const result = { mechanism: 'localStorage (lkdv_cookie_consent)', dismissed: null, fallback: null, verifiedAbsent: null };
  if (await safeEvaluate(page, COOKIE_BANNER_PRESENT)) {
    result.fallback = await safeEvaluate(page, HIDE_COOKIE_BANNER);
    result.mechanism = 'masquage DOM (bouton « Tout accepter » → conteneur)';
  }
  result.dismissed = true;
  await page.waitForTimeout(150);
  result.verifiedAbsent = !(await safeEvaluate(page, COOKIE_BANNER_PRESENT));
  if (!result.verifiedAbsent) {
    result.note = 'Le bandeau cookies est toujours visible : il contamine la capture et les mesures du bas de l’écran.';
  }
  return result;
}

/**
 * Capture le viewport par paliers de défilement et mesure les noeuds de texte
 * entièrement visibles à chaque palier. Une capture pleine page ne conviendrait
 * pas : la barre basse est en `position: fixed` et y serait peinte ailleurs
 * que là où son rectangle l'annonce.
 */
async function measureBreakpoint(browser, { breakpoint, url, storageState, baseUrl, seed }) {
  const context = await browser.newContext({
    baseURL: baseUrl,
    viewport: { width: breakpoint.width, height: breakpoint.height },
    deviceScaleFactor: DSF,
    locale: 'fr-FR',
    colorScheme: 'light',
    reducedMotion: 'reduce',
    serviceWorkers: 'block',
    ...(storageState ? { storageState } : {}),
  });
  await context.addCookies([getAdventureCookie(baseUrl)]);
  await context.addInitScript(() => {
    try {
      window.localStorage.setItem('lkdv_cookie_consent', JSON.stringify({
        necessary: true, analytics: false, marketing: false, version: '1',
      }));
    } catch { /* stockage indisponible : le repli DOM prendra le relais */ }
  });
  // Un draft seme AVANT le premier chargement : sans lui, /prepare n affiche
  // que l etape 1 et la campagne ne peut pas voir les etapes 2 et 3. La cle
  // est celle du store, le contenu est un fichier - aucune donnee fabriquee ici.
  if (seed) {
    await context.addInitScript((payload) => {
      try { window.localStorage.setItem(payload.cle, payload.blob); }
      catch { /* stockage indisponible : la campagne le notera sans etape supplementaire */ }
    }, { cle: 'lkdv_adventure_prep_v2', blob: seed });
  }

  const page = await context.newPage();
  const runtimeErrors = [];
  page.on('pageerror', (error) => runtimeErrors.push(String(error.message).slice(0, 200)));

  const navigation = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  // Un serveur de dev recompile et peut recharger la page en cours de
  // parcours, ce qui detruit le contexte d'execution. On attend la fin du
  // rechargement eventuel avant de commencer a mesurer quoi que ce soit.
  await page.waitForLoadState('load', { timeout: 30000 }).catch(() => {});
  const photo = await waitForPhotoLayer(page);
  await page.waitForTimeout(900);
  const cookie = await dismissCookieBanner(page);

  const document_ = await safeEvaluate(page, () => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollHeight: document.documentElement.scrollHeight,
    innerHeight: window.innerHeight,
  }));
  const pageState = await safeEvaluate(page, READ_PAGE_STATE);

  await fs.promises.mkdir(SHOTS_DIR, { recursive: true });
  const referenceShot = path.join(SHOTS_DIR, `${breakpoint.id}.png`);
  await page.screenshot({ path: referenceShot, fullPage: true });

  // Le defilement a ete mesure sur TOUS les axes reellement defilables, pas
  // seulement sur la fenetre : `/prepare` garde `scrollHeight === innerHeight`
  // et fait defiler son contenu dans un conteneur interne. Uniquement la
  // fenetre, la campagne n'aurait couvert que le premier ecran tout en
  // annoncant une page entiere.
  const scrollContainers = await safeEvaluate(page, FIND_SCROLL_CONTAINERS);
  const windowScrollPx = Math.max(0, document_.scrollHeight - breakpoint.height);
  const containerScrollPx = scrollContainers.reduce(
    (max, container) => Math.max(max, container.scrollablePxY || 0),
    0,
  );
  const reachablePx = Math.max(windowScrollPx, containerScrollPx);
  // Le pas de defilement doit etre dimensionne sur la FENETRE REELLEMENT
  // PEINTE, pas sur la hauteur du viewport. Mesure sur `/prepare` (393x852,
  // graine etape 2) : `div.prep-body` est le seul scrollport, 252px de haut
  // pour 1600px de contenu, alors que le pas de l'ancien code valait 682px.
  // Un texte n'etait alors cadre sur toute sa hauteur que dans une fenetre de
  // (252 - hauteur du texte) px repartis sur 1157px de portee, et les seuls
  // paliers reellement captures etaient 0 / 682 / 1157 : la plupart des textes
  // n'etaient JAMAIS mesures pendant qu'ils etaient peints, et leur crop
  // mordait sur le pied de page ou sur le rail. Prendre le pas le plus
  // contraignant des scrollports reels, en gardant 40% de marge, GARANTIT
  // qu'un element tombe dans un cadre complet a au moins un palier. On mesure
  // donc plus d'elements, et on les mesure proprement.
  const frameWindows = scrollContainers
    .filter((container) => container.axisY && container.clientHeightY > 0)
    .map((container) => container.clientHeightY);
  const frameWindow = frameWindows.length ? Math.min(...frameWindows) : breakpoint.height;
  const step = Math.max(120, Math.min(Math.round(breakpoint.height * 0.8), Math.floor(frameWindow * 0.6)));
  const steps = Math.min(24, Math.max(1, Math.ceil(reachablePx / step) + 1));
  const collected = new Map();
  const visitedScrollY = new Set();

  for (let index = 0; index < steps; index += 1) {
    const scrollY = Math.min(index * step, reachablePx);
    // Deux paliers peuvent aboutir au meme offset reel (bord arrondi) :
    // on ne rejoue pas la meme capture, on ne perd pas de temps pour rien.
    if (visitedScrollY.has(scrollY)) continue;
    visitedScrollY.add(scrollY);
    await safeEvaluate(page, SCROLL_EVERYTHING, scrollY);
    await page.waitForTimeout(260);
    const nodes = await safeEvaluate(page, COLLECT_TEXT_NODES);
    if (nodes.length === 0) continue;
    const { data, info } = await sharp(await page.screenshot({ fullPage: false }))
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    for (const node of nodes) {
      const key = `${node.classes}|${node.tag}|${node.text}|${node.probeId ?? ''}`;
      const previous = collected.get(key);
      // Marqueur « hors cadre » : rien à échantillonner à CE palier. Deux
      // cas très différents, et les confondre faisait disparaître des
      // mesures valides :
      //   - le texte n'a jamais été cadré → il est ignoré, avec son motif ;
      //   - le texte a déjà été cadré et mesuré à un autre palier → on
      //     conserve cette mesure et on ne fait que compter le palier.
      // Sans cette distinction, un titre visible en haut de page disparaissait
      // du rapport dès qu'un palier plus bas le faisait sortir du cadre.
      if (node.skippedInPage) {
        const keepMeasured = Boolean(previous && previous.clean && previous.cleanMeasurement && previous.cleanMeasurement.verdict);
        collected.set(key, keepMeasured
          ? { ...previous, seenAt: previous.seenAt + 1, outOfFrameSteps: (previous.outOfFrameSteps ?? 0) + 1 }
          : {
            ...node,
            verdict: null,
            worst: null,
            best: null,
            threshold: null,
            glyph: null,
            skipped: node.skippedInPage,
            clean: true,
            occluded: false,
            occludedBy: null,
            cleanMeasurement: null,
            occludedMeasurement: null,
            seenAt: (previous?.seenAt ?? 0) + 1,
            occludedSteps: 0,
            outOfFrameSteps: (previous?.outOfFrameSteps ?? 0) + 1,
            cleanSteps: (previous?.cleanSteps ?? 0) + 1,
          });
        continue;
      }
      const measurement = measureNode(data, info.width, node);
      const candidate = { ...measurement, occluded: node.occluded, occludedBy: node.occludedBy, scrollY };

      // Un texte peut être capturé plusieurs fois (paliers de défilement).
      // Deux règles, dans cet ordre :
      //   1. une observation occluée ne peut PAS fonder un verdict de contraste,
      //      ses pixels appartiennent à l'élément qui recouvre ;
      //   2. parmi les observations dégagées, on garde le pire cas, jamais le
      //      meilleur — une page qui défile offre plusieurs fonds au même texte.
      const previousClean = previous && previous.clean ? previous.cleanMeasurement : null;
      const cleanMeasurement = node.occluded
        ? previousClean
        : (!previousClean
          || (candidate.worst ?? Number.POSITIVE_INFINITY) < (previousClean.worst ?? Number.POSITIVE_INFINITY)
          ? candidate
          : previousClean);
      const occludedMeasurement = node.occluded
        ? (previous?.occludedMeasurement ?? candidate)
        : (previous?.occludedMeasurement ?? null);
      const authoritative = cleanMeasurement ?? occludedMeasurement ?? candidate;

      collected.set(key, {
        ...node,
        ...authoritative,
        clean: Boolean(cleanMeasurement),
        cleanMeasurement,
        occludedMeasurement,
        occluded: !cleanMeasurement,
        occludedBy: occludedMeasurement ? occludedMeasurement.occludedBy : null,
        seenAt: (previous?.seenAt ?? 0) + 1,
        occludedSteps: (previous?.occludedSteps ?? 0) + (node.occluded ? 1 : 0),
        cleanSteps: (previous?.cleanSteps ?? 0) + (node.occluded ? 0 : 1),
      });
    }
  }

  await safeEvaluate(page, RESET_SCROLL);
  await context.close();
  return {
    breakpoint,
    navigation,
    document: document_,
    pageState,
    cookie,
    photo,
    runtimeErrors,
    referenceShot,
    scrollCoverage: {
      windowScrollablePx: windowScrollPx,
      innerContainerScrollablePx: containerScrollPx,
      reachablePx,
      steps,
      capturedScrollPositions: [...visitedScrollY],
      containers: scrollContainers,
    },
    nodes: [...collected.values()],
  };
}

/** Injecte les deux sondes et exige que le verdict suive la calculatrice WCAG. */
async function runSelfTest(browser, { breakpoint, url, storageState, baseUrl }) {
  const context = await browser.newContext({
    baseURL: baseUrl,
    viewport: { width: breakpoint.width, height: breakpoint.height },
    deviceScaleFactor: DSF,
    locale: 'fr-FR',
    colorScheme: 'light',
    reducedMotion: 'reduce',
    serviceWorkers: 'block',
    ...(storageState ? { storageState } : {}),
  });
  const page = await context.newPage();
  await context.addInitScript(() => {
    try {
      window.localStorage.setItem('lkdv_cookie_consent', JSON.stringify({
        necessary: true, analytics: false, marketing: false, version: '1',
      }));
    } catch { /* sans effet : le repli DOM est masque avant toute mesure */ }
  });
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await waitForPhotoLayer(page);
  await page.waitForTimeout(700);
  await dismissCookieBanner(page);
  await fs.promises.mkdir(SHOTS_DIR, { recursive: true });

  const probes = [];
  for (const probe of SELFTEST_PROBES) {
    const analytic = round2(contrastRatio(probe.text, probe.plate));
    await safeEvaluate(page, REMOVE_PROBES);
    await safeEvaluate(page, INJECT_PROBE, {
      probeId: probe.id,
      plate: probe.plate,
      text: probe.text,
      placement: probe.expectSkipped ? 'bande-dissolution' : 'haut-page',
      // La bande est passee en parametre : `page.evaluate` s'execute dans la
      // page, hors du scope du module.
      bandPx: 60,
    });
    await page.waitForTimeout(180);
    const nodes = await safeEvaluate(page, COLLECT_TEXT_NODES);
    const { data, info } = await sharp(await page.screenshot({ fullPage: false }))
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const node = nodes.find((entry) => entry.probeId === probe.id);
    if (probe.expectSkipped) {
      // Garde anti-vacuite. On ne demande pas « le verdict est-il FAIL » :
      // on demande « le noeud est-il absent des mesures ET porte-t-il le
      // motif de dissolution ». C est la regle entiere qu on valide, pas son
      // effet de bord sur une couleur.
      const checksSkip = [
        {
          name: 'sonde localisee dans la page',
          passed: Boolean(node),
          detail: node ? (node.skippedInPage ?? 'collectee sans motif de refus') : 'le noeud injecté n’a pas été collecté',
        },
        {
          name: 'regle de bande de dissolution active',
          passed: Boolean(node && typeof node.skippedInPage === 'string' && /dissolution/.test(node.skippedInPage)),
          detail: node?.skippedInPage ?? 'aucun motif : la regle ne s’est est pas declenchee sur une sonde.placee dans la bande',
        },
      ];
      await page.screenshot({ path: path.join(SHOTS_DIR, `selftest-${probe.id}.png`), fullPage: false });
      probes.push({
        id: probe.id,
        description: probe.description,
        analyticRatio: analytic,
        measuredWorst: null,
        measuredBest: null,
        threshold: null,
        measuredVerdict: null,
        expectedVerdict: 'REFUSE (bande de dissolution)',
        paintedGlyph: null,
        passed: checksSkip.every((check) => check.passed),
        checks: checksSkip,
        shot: path.join(SHOTS_DIR, `selftest-${probe.id}.png`),
      });
      continue;
    }
    const shot = path.join(SHOTS_DIR, `selftest-${probe.id}.png`);
    await page.screenshot({ path: shot, fullPage: false });

    const checks = [];
    if (!node) {
      checks.push({ name: 'sonde repérée dans la page', passed: false, detail: 'le noeud injecté n’a pas été collecté' });
      probes.push({ id: probe.id, description: probe.description, analyticRatio: analytic, passed: false, checks, shot });
      continue;
    }
    const measurement = measureNode(data, info.width, node);
    checks.push({ name: 'sonde repérée dans la page', passed: true, detail: node.classes || node.tag });
    // Une sonde recouverte par un élément collant mesurerait les pixels de
    // cet élément : l'auto-vérification n'aurait plus de valeur.
    checks.push({
      name: 'sonde peinte au premier plan',
      passed: node.occluded !== true,
      detail: node.occluded ? `recouverte par « ${node.occludedBy ?? 'élément inconnu'} »` : 'aucun élément au-dessus',
    });
    checks.push({
      name: 'couleur peinte lue exactement',
      passed: Math.abs((measurement.best ?? 0) - analytic) <= 0.1,
      detail: `meilleur ratio mesuré ${measurement.best ?? 'n/a'}:1, calcul WCAG sur les couleurs de la sonde ${analytic}:1`,
    });
    checks.push({
      name: 'verdict conforme à la calculatrice',
      passed: measurement.verdict === probe.expectedVerdict,
      detail: `verdict mesuré ${measurement.verdict ?? 'n/a'}, attendu ${probe.expectedVerdict} (pire ratio ${measurement.worst ?? 'n/a'}:1, seuil ${measurement.threshold ?? 'n/a'}:1)`,
    });
    probes.push({
      id: probe.id,
      description: probe.description,
      analyticRatio: analytic,
      measuredWorst: measurement.worst ?? null,
      measuredBest: measurement.best ?? null,
      threshold: measurement.threshold ?? null,
      measuredVerdict: measurement.verdict ?? null,
      expectedVerdict: probe.expectedVerdict,
      paintedGlyph: measurement.glyph ?? null,
      passed: checks.every((check) => check.passed),
      checks,
      shot,
    });
  }
  await safeEvaluate(page, REMOVE_PROBES);
  await context.close();
  return { ran: true, breakpoint: breakpoint.id, passed: probes.every((probe) => probe.passed), probes };
}

async function resolveSession(browser, baseUrl, requireAuth) {
  const notes = [];
  let storageState = null;
  let mode = 'anonymous';
  let verified = null;
  try {
    storageState = loadAuditStorageState(auditStorageStatePath(), baseUrl);
    mode = 'storage-state';
  } catch (error) {
    notes.push(`Aucun storageState d'audit exploitable : ${error.message}`);
  }
  if (storageState) {
    const context = await browser.newContext({ baseURL: baseUrl, storageState, locale: 'fr-FR' });
    const page = await context.newPage();
    try {
      await verifyCompteSession(page, baseUrl, { sessionMode: true, expectedEmail: process.env.AUDIT_EMAIL });
      verified = true;
      notes.push('verifyCompteSession : session authentifiée confirmée.');
    } catch (error) {
      verified = false;
      notes.push(`verifyCompteSession a échoué (storageState probablement expiré) : ${error.message}`);
    }
    await context.close();
  } else if (requireAuth) {
    throw new Error(`--require-auth demandé mais aucune session d'audit n'est disponible : ${notes.join(' | ')}`);
  }
  if (mode === 'anonymous') {
    notes.push('Mesure en session anonyme : /prepare reste accessible sans authentification, ce qui est un état réel de la page.');
  }
  return { mode, verified, notes, storageState };
}

function parseArgs(argv) {
  const options = { selfTest: false, reportOnly: false, requireAuth: false, url: null, out: DEFAULT_REPORT, seed: null };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--selftest') options.selfTest = true;
    else if (argument === '--report-only') options.reportOnly = true;
    else if (argument === '--require-auth') options.requireAuth = true;
    else if (argument === '--url') options.url = argv[++index] ?? null;
    else if (argument === '--seed') options.seed = argv[++index] ?? null;
    else if (argument === '--out') options.out = argv[++index] ?? DEFAULT_REPORT;
    else throw new Error(`Argument inconnu : ${argument}`);
  }
  return options;
}

function groupFailures(nodes) {
  const groups = new Map();
  for (const node of nodes) {
    if (node.verdict !== 'FAIL') continue;
    const key = node.classes || `(${node.tag})`;
    const group = groups.get(key);
    if (!group) {
      groups.set(key, {
        classes: key,
        occurrences: 0,
        worst: node.worst,
        best: node.best,
        threshold: node.threshold,
        fontSize: node.fontSize,
        glyph: node.glyph,
        backgroundAtWorst: node.backgroundAtWorst ?? null,
        samples: [node.text],
      });
    }
    const current = groups.get(key);
    current.occurrences += 1;
    if (node.worst < current.worst) {
      current.worst = node.worst;
      current.best = node.best;
      current.threshold = node.threshold;
      current.fontSize = node.fontSize;
      current.glyph = node.glyph;
      current.backgroundAtWorst = node.backgroundAtWorst ?? null;
    }
    if (current.samples.length < 3) current.samples.push(node.text);
  }
  return [...groups.values()].sort((a, b) => a.worst - b.worst);
}

// ---------------------------------------------------------------------------
// Point d'entrée
// ---------------------------------------------------------------------------

async function run() {
  const options = parseArgs(process.argv.slice(2));
  const baseUrl = resolveBaseUrl();
  const url = options.url ?? process.env.PREP_AUDIT_URL ?? `${baseUrl}${DEFAULT_URL_PATH}`;
  // Le semis est un ETAT DE MESURE, pas une donnee de produit : il vient d un
  // fichier, se trace dans le rapport, et n existe qu au moment de mesurer.
  const seed = options.seed ? fs.readFileSync(options.seed, 'utf8') : null;

  const browser = await chromium.launch({ headless: true });
  const report = {
    schemaVersion: 1,
    tool: 'scripts/audit/measure_prep_contrast.mjs',
    method: 'Contraste WCAG 2.2 mesuré sur les PIXELS PEINTS, fond local prélevé autour des glyphes. Aucun arrière-plan DOM n’est composé : le calque photo de /prepare est un élément frère `aria-hidden` en `position: fixed; z-index: -1`, hors de toute chaîne d’ancêtres.',
    measuredAt: new Date().toISOString(),
    target: { url, baseUrl },
    methodology: {
      deviceScaleFactor: DSF,
      capture: 'Viewport seul, par paliers de défilement de 80 % de la hauteur, sans défilement pendant la capture.',
      scrollStepPx: '80 % de la hauteur du viewport',
      thresholds: THRESHOLD,
      glyphTail: GLYPH_TAIL,
      separation: 'polarité déclarée + médiane de luminance + invariant de polarité',
      backgroundLuminanceBand: BACKGROUND_LUMINANCE_BAND,
      minGlyphPixels: MIN_GLYPH_PIXELS,
      backgroundRadiusPx: BACKGROUND_RADIUS,
      minGlyphSeparation: MIN_GLYPH_SEPARATION,
      thresholdsSource: 'WCAG 2.2 — même formule de luminance que scripts/audit/visual-contrast.mjs (seuil 0.04045).',
    },
    selfTest: { ran: false, passed: null, note: 'Non exécuté (--selftest non demandé) : le garde-fou n’est alors pas auto-vérifié.' },
    session: null,
    pageState: null,
    breakpoints: [],
    totals: { breakpoints: 0, measured: 0, pass: 0, fail: 0, skipped: 0, occluded: 0 },
    // `limitations` degrade le statut en PARTIAL / NOT VERIFIED : on y met
    // uniquement ce qui rend UN RESULTAT NON FIABLE. Les constats de methode
    // (la fenetre ne defile pas, le contenu oui…) vont dans `notes` : ils
    // decrivent ce que le script a fait, pas ce qu'il n'a pas pu faire.
    notes: [],
    limitations: [],
  };
  // Le semis est un etat de mesure, trace pour que le rapport se suffise :
  // on doit pouvoir relire CE draft sans le deviner.
  if (seed) {
    report.notes.push(`Draft seme depuis ${options.seed} (${seed.length} octets) dans lkdv_adventure_prep_v2 : la campagne mesure l etape affichee par ce draft, pas seulement l etape 1.`);
  }

  try {
    const session = await resolveSession(browser, baseUrl, options.requireAuth);
    report.session = { mode: session.mode, verified: session.verified, notes: session.notes };

    const selfTest = await runSelfTest(browser, {
      breakpoint: BREAKPOINTS[1],
      url,
      storageState: session.storageState,
      baseUrl,
    });
    report.selfTest = selfTest;
    if (!selfTest.passed) {
      report.limitations.push('L’auto-vérification a ÉCHOUÉ : les verdicts de ce rapport ne sont pas fiables tant qu’elle n’est pas verte.');
    }

    // En mode --selftest on ne mesure que le garde-fou : c'est le mode
    // utilise en CI pour valider l'outil lui-meme, sans campagne complete.
    for (const breakpoint of (options.selfTest ? [] : BREAKPOINTS)) {
      // Deux tentatives : un rechargement de serveur de dev en cours de route
      // detruit le contexte d'execution et ferait disparaitre un point de
      // rupture entier du rapport. En cas d'echec persistant, le point est
      // declare NON MESURE avec le motif — jamais comble par une estimation.
      let result = null;
      const attempts = [];
      for (let attempt = 1; attempt <= MEASURE_ATTEMPTS && !result; attempt += 1) {
        try {
          result = await measureBreakpoint(browser, {
            breakpoint,
            url,
            storageState: session.storageState,
            baseUrl,
            seed,
          });
          attempts.push({ attempt, ok: true });
        } catch (error) {
          const message = String(error && error.message ? error.message : error);
          attempts.push({ attempt, ok: false, error: message });
          if (attempt < MEASURE_ATTEMPTS) await new Promise((resolve) => setTimeout(resolve, 1500));
        }
      }
      if (!result) {
        const last = attempts[attempts.length - 1];
        report.breakpoints.push({
          id: breakpoint.id,
          width: breakpoint.width,
          height: breakpoint.height,
          device: breakpoint.device,
          measured: false,
          attempts,
          error: last ? last.error : 'aucune tentative',
        });
        report.limitations.push(`${breakpoint.id} : mesure impossible apres ${MEASURE_ATTEMPTS} tentative(s) — ${last ? last.error : 'aucune tentative'}`);
        continue;
      }

      const nodes = result.nodes;
      // Un nœud n'est mesuré que s'il existe au moins une observation
      // DÉGAGÉE. Les autres sont des occlusions : leur ratio décrit l'élément
      // recouvrant, pas le texte, et n'est pas un verdict de contraste.
      const cleanNodes = nodes.filter((node) => node.clean);
      const occludedNodes = nodes.filter((node) => !node.clean);
      const measuredNodes = cleanNodes.filter((node) => node.verdict);
      const skippedNodes = cleanNodes.filter((node) => !node.verdict);
      const passed = measuredNodes.filter((node) => node.verdict === 'PASS');
      const failed = measuredNodes.filter((node) => node.verdict === 'FAIL');
      const skippedByReason = {};
      for (const node of skippedNodes) {
        const reason = node.skipped || 'raison inconnue';
        skippedByReason[reason] = (skippedByReason[reason] || 0) + 1;
      }

      if (result.photo.mounted === false) {
        report.limitations.push(`${breakpoint.id} : ${result.photo.note}`);
      }
      if (result.cookie.verifiedAbsent === false) {
        report.limitations.push(`${breakpoint.id} : ${result.cookie.note}`);
      }
      if (result.scrollCoverage.innerContainerScrollablePx > 0) {
        report.notes.push(`${breakpoint.id} : la fenetre ne defile pas (${result.document.scrollHeight}px pour ${result.document.innerHeight}px de viewport) ; le contenu defile dans ${result.scrollCoverage.containers.length} conteneur(s) interne(s), pilotes explicitement — un simple window.scrollTo n'aurait couvert que le premier ecran.`);
      }
      if (result.document.scrollWidth > result.document.clientWidth + 1) {
        report.limitations.push(`${breakpoint.id} : débordement horizontal (${result.document.scrollWidth}px dans ${result.document.clientWidth}px).`);
      }
      const unverifiable = measuredNodes.filter((node) => node.occlusionUnverifiable);
      if (unverifiable.length > 0) {
        report.limitations.push(`${breakpoint.id} : ${unverifiable.length} texte(s) en pointer-events none — conserves dans les verdicts, mais leur recouvrement ne peut etre ni confirme ni infirme par hit-test.`);
      }
      if (occludedNodes.length > 0) {
        const occluders = [...new Set(occludedNodes.map((node) => node.occludedBy ?? 'inconnu'))];
        report.limitations.push(`${breakpoint.id} : ${occludedNodes.length} texte(s) recouverts par ${occluders.join(', ')} — exclus des verdicts de contraste, leur ratio porterait sur les pixels de l'élément recouvrant.`);
      }
      if (!report.pageState) report.pageState = result.pageState;

      report.breakpoints.push({
        id: breakpoint.id,
        width: breakpoint.width,
        height: breakpoint.height,
        device: breakpoint.device,
        measured: true,
        attempts,
        httpStatus: result.navigation ? result.navigation.status() : null,
        document: result.document,
        scrollCoverage: result.scrollCoverage,
        horizontalOverflow: result.document.scrollWidth > result.document.clientWidth + 1,
        photoLayer: result.photo,
        cookieBanner: result.cookie,
        referenceShot: path.relative(ROOT, result.referenceShot).replace(/\\/g, '/'),
        counts: {
          measured: measuredNodes.length,
          pass: passed.length,
          fail: failed.length,
          skipped: skippedNodes.length,
          occluded: occludedNodes.length,
        },
        occlusion: occludedNodes
          .map((node) => ({
            classes: node.classes,
            tag: node.tag,
            text: node.text,
            occludedBy: node.occludedBy,
            seenAt: node.seenAt,
            occludedSteps: node.occludedSteps,
            // Valeur informative : mesurée sur les pixels de l'élément qui
            // recouvre, donc elle ne dit RIEN du contraste du texte.
            ratioUnderOccluder: node.worst ?? null,
          }))
          .sort((a, b) => a.classes.localeCompare(b.classes)),
        occlusionUnverifiable: measuredNodes.filter((node) => node.occlusionUnverifiable).length,
        // Un simple compte de motifs ne dit pas QUEL texte a été ignoré :
        // la couverture doit être auditablable element par element.
        skipped: skippedNodes
          .map((node) => ({
            classes: node.classes,
            tag: node.tag,
            text: node.text,
            reason: node.skipped ?? 'raison inconnue',
          }))
          .sort((a, b) => a.classes.localeCompare(b.classes)),
        skippedByReason,
        runtimeErrors: result.runtimeErrors,
        failures: groupFailures(nodes),
        elements: measuredNodes
          .map((node) => ({
            classes: node.classes,
            tag: node.tag,
            text: node.text,
            fontSize: node.fontSize,
            fontWeight: node.fontWeight,
            declaredColor: node.declaredColor,
            glyph: node.glyph,
            worst: node.worst,
            best: node.best,
            // Le fond REELLEMENT preleve au pixel le moins favorable. Sans lui,
            // un rapport ne dit pas POURQUOI un echec echoue : on ne voit que le
            // ratio, et le diagnostic revient a supputer. Ces trois champs sont
            // deja calcules par measureNode, ils etaient simplement abandonnes au
            // moment de la serialisation.
            backgroundAtWorst: node.backgroundAtWorst ?? null,
            backgroundPixels: node.backgroundPixels ?? null,
            backgroundSource: node.backgroundSource ?? null,
            threshold: node.threshold,
            verdict: node.verdict,
            // `pointer-events: none` : le hit-test ne peut confirmer ni infirmer
            // le recouvrement. La mesure est Gardner malgre cette incertitude,
            // pour ne pas dissimuler un echec reel.
            occlusionUnverifiable: node.occlusionUnverifiable === true,
            seenAt: node.seenAt,
          }))
          .sort((a, b) => a.worst - b.worst),
      });

      report.totals.breakpoints += 1;
      report.totals.measured += measuredNodes.length;
      report.totals.pass += passed.length;
      report.totals.fail += failed.length;
      report.totals.skipped += skippedNodes.length;
      report.totals.occluded += occludedNodes.length;
    }

    report.verificationStatus = auditVerificationStatus({
      liveVerified: report.selfTest.passed === true,
      coverageComplete: options.selfTest || report.totals.breakpoints === BREAKPOINTS.length,
      errors: report.limitations,
    });

    await fs.promises.mkdir(path.dirname(options.out), { recursive: true });
    await fs.promises.writeFile(options.out, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  } finally {
    await browser.close();
  }

  const selfTestLine = report.selfTest.ran
    ? `auto-vérification ${report.selfTest.passed ? 'VERTE' : 'ROUGE'}`
    : 'auto-vérification NON EXÉCUTÉE';
  console.log(`Rapport : ${path.relative(ROOT, options.out)}`);
  console.log(options.selfTest
    ? `Mode --selftest : ${selfTestLine}, campagne de mesure non executee.`
    : `${report.target.url} — ${report.totals.breakpoints}/${BREAKPOINTS.length} points de rupture, ${selfTestLine}`);
  console.log(`Session : ${report.session ? report.session.mode : 'inconnue'}${report.session && report.session.verified === false ? ' (périmée)' : ''}`);
  for (const entry of report.breakpoints) {
    if (!entry.measured) { console.log(`  ${entry.id.padEnd(9)} NON MESURÉ — ${entry.error}`); continue; }
    console.log(`  ${entry.id.padEnd(9)} ${String(entry.counts.fail).padStart(3)} échec(s) / ${String(entry.counts.measured).padStart(3)} mesuré(s) / ${String(entry.counts.skipped).padStart(3)} ignoré(s) / ${String(entry.counts.occluded).padStart(3)} occlus${entry.horizontalOverflow ? '  [débordement horizontal]' : ''}${entry.cookieBanner.verifiedAbsent === false ? '  [bandeau cookies visible]' : ''}`);
  }
  if (report.notes.length) {
    console.log('Notes de methode :');
    for (const note of report.notes) console.log(`  - ${note}`);
  }
  if (report.limitations.length) {
    console.log('Limites :');
    for (const limitation of report.limitations) console.log(`  - ${limitation}`);
  }

  if (options.selfTest) {
    for (const probe of report.selfTest.probes) {
      console.log(`  ${probe.id.padEnd(20)} attendu ${probe.expectedVerdict} / obtenu ${probe.measuredVerdict ?? 'n/a'} | pire ${probe.measuredWorst ?? 'n/a'}:1 seuil ${probe.threshold ?? 'n/a'}:1 | calcul WCAG ${probe.analyticRatio}:1 -> ${probe.passed ? 'OK' : 'ECHEC'}`);
      for (const check of probe.checks) {
        if (!check.passed) console.log(`      VERIF KO : ${check.name} — ${check.detail}`);
      }
    }
    return report.selfTest.passed ? 0 : 2;
  }
  if (report.selfTest.ran && !report.selfTest.passed) return 2;
  if (options.reportOnly) return 0;
  return report.totals.fail > 0 ? 1 : 0;
}

run()
  .then((code) => { process.exitCode = code; })
  .catch((error) => {
    console.error(error && error.stack ? error.stack : String(error));
    process.exitCode = 2;
  });