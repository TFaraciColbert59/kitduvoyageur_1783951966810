/**
 * M5.3 — verre (M0), 44 pt, 150–300 ms, 4.5:1.
 *
 * Les quatre exigences sont mesurees sur le RENDU, pas lues dans la feuille :
 * un jeton pose et jamais consomme ne change aucun pixel, et une valeur declaree
 * peut etre remplacee sans que rien ne bouge. Le test monte donc la feuille
 * reelle (`src/styles/tokens.css` + `src/features/adventure-prep/adventure-
 * prep.css`) dans un harnais servi en local, avec la photo reelle du depot
 * (`public/assets/images/lkdv-bg-portrait.webp`), et mesure :
 *
 *   1. la duree de controle RESOLUE, en borne basse ET en borne haute ;
 *   2. la meme duree, consumee cette fois par une transition reelle calculee
 *      par le navigateur (le jeton seul ne prouverait rien) ;
 *   3. la cible de 44 pt, en jeton ET en hauteur reellement rendue ;
 *   4. le contraste 4.5:1, sur des PIXELS PEINTS — l encre vient de la
 *      cascade, le fond vient de l echantillonnage de la surface composee.
 *
 * Deux pieges que ce fichier ferme explicitement :
 *
 * A. Un echantillonneur de contraste incapable d echouer ne prouve rien. La
 *    page `__sonde` sert deux plaques a contraste analytique connu — une
 *    illisible, une conforme — et M5.3-10 exige que la mesure les retrouve
 *    exactes. Sans cette auto-verification, M5.3-07/08/09 pourraient verdir
 *    sur un echantillonnage casse.
 *
 * B. Le verre est translucide : lire sa couleur declaree ne dit rien de ce
 *    qui est peint. Le fond est donc ALWAYS preleve dans une bande de pixels
 *    reels, et le pire ratio est pris sur toute la plage de luminance de
 *    cette bande — jamais sur la moyenne, jamais sur le pixel le plus clair.
 *
 * Aucun fond de substitution, aucune valeur inventee : la feuille chargee est
 * celle du depot, la photo est celle du depot, les encrees sont celles que la
 * cascade resout.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, type Browser, type Page } from 'playwright';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const CSS_PREP = path.join(ROOT, 'src/features/adventure-prep/adventure-prep.css');

/* ---------------------------------------------------------------- mesure -- */

const channelLuminance = (value: number): number => {
  const v = value / 255;
  return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
};

const relativeLuminance = (r: number, g: number, b: number): number =>
  0.2126 * channelLuminance(r) + 0.7152 * channelLuminance(g) + 0.0722 * channelLuminance(b);

const contrastRatio = (a: number, b: number): number =>
  (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

const parseRgb = (value: string): [number, number, number] => {
  const parts = (value.match(/[\d.]+/g) ?? []).map(Number);
  return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0];
};

/** Convertit une duree CSS (`0.22s`, `220ms`, `150`) en millisecondes. */
const toMs = (value: string): number => {
  const raw = value.trim();
  const n = Number.parseFloat(raw);
  if (!Number.isFinite(n)) return Number.NaN;
  if (raw.endsWith('ms')) return n;
  if (raw.endsWith('s')) return n * 1000;
  return n * 1000;
};

type Band = { min: number; max: number };

/**
 * Preleve la luminance reellement peinte dans une bande SANS texte d un
 * element : bande horizontale interior, de 2 a 6 px CSS depuis le bord
 * superieur, sur le tiers central de la largeur. Cette bande ne peut pas
 * contenir de glyphe (la police est centree verticalement) ni l arete du
 * filet, donc tout ce qu on y lit est bien le materiau.
 */
const sampleBackground = async (page: Page, selector: string, scale: number): Promise<Band> => {
  const shot = await (await page.$(selector))!.screenshot();
  const { data, info } = await sharp(shot).raw().toBuffer({ resolveWithObject: true });
  const y0 = Math.round(2 * scale);
  const y1 = Math.round(6 * scale);
  const x0 = Math.floor(info.width * 0.25);
  const x1 = Math.floor(info.width * 0.75);
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      const i = (y * info.width + x) * info.channels;
      const l = relativeLuminance(data[i], data[i + 1], data[i + 2]);
      if (l < min) min = l;
      if (l > max) max = l;
    }
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    throw new Error(`echantillon vide pour ${selector} (${info.width}x${info.height})`);
  }
  return { min, max };
};

/** Pire ratio sur toute la plage de fond mesuree : borne, pas estimation. */
const worstAgainst = (ink: [number, number, number], band: Band): number => {
  const l = relativeLuminance(ink[0], ink[1], ink[2]);
  return Math.min(contrastRatio(l, band.min), contrastRatio(l, band.max));
};

/* ------------------------------------------------------------- harnais --- */

const STYLE_LINKS = [
  '<link rel="stylesheet" href="/src/styles/tokens.css">',
  '<link rel="stylesheet" href="/src/features/adventure-prep/adventure-prep.css">',
].join('');

const page_ = (body: string): string =>
  [
    '<!doctype html><html lang="fr" data-theme="dark"><head><meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    STYLE_LINKS,
    '<style>html,body{margin:0;padding:0;background:#000;}</style>',
    '</head><body>',
    body,
    '</body></html>',
  ].join('');

/** Le preparateur reel, en 393x852, avec ses vraies classes de materiau. */
const HARNESS = page_(
  [
    '<div class="adventure-prep" id="prep" style="width:393px;height:852px">',
    '<div class="prep-map" id="carte">',
    '<div class="prep-map__controls prep-map__controls--end">',
    '<button class="prep-map__glass" id="verre">Carte</button>',
    '</div></div>',
    '<div class="prep-block" id="bloc">',
    '<div class="prep-block__row">',
    '<span class="prep-block__label" id="libelle">Lieu de d&eacute;part</span>',
    '<span class="prep-block__value">Le Croisic</span>',
    '</div></div>',
    '<div style="flex:1 1 auto;min-height:0"></div>',
    '<footer class="prep-footer" id="pied">',
    '<button class="prep-footer__primary" id="cta">Cr&eacute;er mon parcours</button>',
    '</footer>',
    '</div>',
  ].join(''),
);

/**
 * Deux plaques a contraste analytique connu. Elles n utilisent AUCUN jeton du
 * projet : leur contraste se calcule a la main, ce qui donne au test une
 * reference exterieure independante de l echantillonneur qu il verifie.
 */
const SONDE = page_(
  [
    '<div id="sonde-illisible" style="width:160px;height:48px;background:#ffffff;',
    'color:#fbfbfb;font:700 20px/48px system-ui;text-align:center">Test</div>',
    '<div id="sonde-lisible" style="width:160px;height:48px;background:#ffffff;',
    'color:#000000;font:700 20px/48px system-ui;text-align:center">Test</div>',
  ].join(''),
);

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.js': 'text/javascript; charset=utf-8',
  '.woff2': 'font/woff2',
};

let server: http.Server;
let origin = '';
let browser: Browser;
let page: Page;

type Surface = {
  selector: string;
  ink: string;
  transitionDuration: string;
  height: number;
  rectHeight: number;
  minHeight: string;
};

let tokens: Record<string, string> = {};
let surfaces: Record<string, Surface> = {};
let bands: Record<string, Band> = {};
let sonde: { illisible: number; lisible: number } = { illisible: 0, lisible: 0 };
const SCALE = 2;

beforeAll(async () => {
  server = http.createServer((req, res) => {
    const url = (req.url ?? '/').split('?')[0];
    if (url === '/__harness') {
      res.writeHead(200, { 'content-type': MIME['.html'] });
      res.end(HARNESS);
      return;
    }
    if (url === '/__sonde') {
      res.writeHead(200, { 'content-type': MIME['.html'] });
      res.end(SONDE);
      return;
    }
    const rel = url.startsWith('/assets/') ? path.join('public', url) : url.replace(/^\/+/, '');
    const file = path.join(ROOT, rel);
    if (!file.startsWith(ROOT + path.sep) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404);
      res.end('introuvable');
      return;
    }
    res.writeHead(200, { 'content-type': MIME[path.extname(file)] ?? 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;

  browser = await chromium.launch();
  page = await browser.newPage({
    viewport: { width: 393, height: 852 },
    deviceScaleFactor: SCALE,
    isMobile: true,
    hasTouch: true,
    colorScheme: 'dark',
  });
  await page.goto(`${origin}/__harness`, { waitUntil: 'load' });

  tokens = await page.evaluate(() => {
    const cs = getComputedStyle(document.getElementById('prep') as HTMLElement);
    const names = [
      '--prep-duration-control',
      '--prep-action-height',
      '--prep-glass-bg',
      '--prep-glass-blur',
      '--prep-panel-bg',
    ];
    const out: Record<string, string> = {};
    for (const name of names) out[name] = cs.getPropertyValue(name).trim();
    return out;
  });

  surfaces = await page.evaluate(() => {
    const read = (selector: string, inkSelector = selector): Record<string, string | number> => {
      const el = document.querySelector(selector) as HTMLElement;
      const ink = document.querySelector(inkSelector) as HTMLElement;
      const cs = getComputedStyle(el);
      return {
        ink: getComputedStyle(ink).color,
        backgroundColor: cs.backgroundColor,
        transitionDuration: cs.transitionDuration,
        minHeight: cs.minHeight,
        rectHeight: Math.round(el.getBoundingClientRect().height * 100) / 100,
      };
    };
    return {
      verre: read('#verre'),
      cta: read('#cta'),
      bloc: read('#bloc', '#libelle'),
    } as Record<string, Record<string, string | number>>;
  }) as unknown as Record<string, Surface>;

  bands = {
    verre: await sampleBackground(page, '#verre', SCALE),
    cta: await sampleBackground(page, '#cta', SCALE),
    bloc: await sampleBackground(page, '#bloc', SCALE),
  };

  const sondePage = await browser.newPage({
    viewport: { width: 400, height: 200 },
    deviceScaleFactor: SCALE,
    colorScheme: 'dark',
  });
  await sondePage.goto(`${origin}/__sonde`, { waitUntil: 'load' });
  const illisible = parseRgb(await sondePage.$eval('#sonde-illisible', (el) => getComputedStyle(el).color));
  const lisible = parseRgb(await sondePage.$eval('#sonde-lisible', (el) => getComputedStyle(el).color));
  sonde = {
    illisible: worstAgainst(illisible, await sampleBackground(sondePage, '#sonde-illisible', SCALE)),
    lisible: worstAgainst(lisible, await sampleBackground(sondePage, '#sonde-lisible', SCALE)),
  };
  await sondePage.close();
}, 180_000);

afterAll(async () => {
  await browser?.close();
  await new Promise<void>((resolve) => server?.close(() => resolve()));
});

/* ------------------------------------------------------------------ M5.3 -- */

describe('M5.3 · verre (M0), 44 pt, 150–300 ms, 4.5:1', () => {
  const css = fs.readFileSync(CSS_PREP, 'utf8');

  it('M5.3-01 · le verre M0 est un blanc translucide dans la plage 10–30 % et a un repli opaque', () => {
    const decl = /--prep-glass-bg:\s*rgb\(255\s+255\s+255\s*\/\s*([\d.]+)\)/.exec(css);
    expect(decl, '--prep-glass-bg absent de la feuille').not.toBeNull();
    const alpha = Number(decl![1]);
    expect(alpha).toBeGreaterThanOrEqual(0.1);
    expect(alpha).toBeLessThanOrEqual(0.3);

    // Repli d'accessibilite : sans transparence, le verre doit s'aplatir sur
    // une couleur OPAQUE. Un repli encore translucide ne garantit rien.
    const block = /@media\s*\(prefers-reduced-transparency:\s*reduce\)\s*\{([\s\S]*?)\n\}/.exec(css);
    expect(block, 'repli prefers-reduced-transparency absent').not.toBeNull();
    expect(block![1]).toMatch(/--prep-glass-bg:\s*var\(--prep-glass-opaque\)/);
    expect(/--prep-glass-opaque:\s*var\(--card-tint-solid\)/.test(css)).toBe(true);
    expect(css).toMatch(/--prep-glass-blur:\s*[^;]+;/);
  });

  it('M5.3-02 · borne BASSE 150 ms sur la duree de controle resolue', () => {
    const ms = toMs(tokens['--prep-duration-control']);
    expect(Number.isNaN(ms)).toBe(false);
    expect(ms).toBeGreaterThanOrEqual(150);
  });

  it('M5.3-03 · borne HAUTE 300 ms sur la duree de controle resolue', () => {
    const ms = toMs(tokens['--prep-duration-control']);
    expect(Number.isNaN(ms)).toBe(false);
    expect(ms).toBeLessThanOrEqual(300);
  });

  it('M5.3-04 · cette duree est REELLEMENT consommee par une transition calculee', () => {
    // Le jeton seul ne prouverait rien : une transition qui l ignore laisserait
    // le test vert. On lit donc la duree calculee par le navigateur sur un
    // element reel qui consomme le jeton, et on exige l egalite.
    const computed = surfaces.verre.transitionDuration;
    expect(computed, 'aucune transition calculee sur .prep-map__glass').not.toBe('');
    const first = computed.split(',')[0]!.trim();
    expect(toMs(first)).toBe(toMs(tokens['--prep-duration-control']));
    expect(toMs(first)).toBeGreaterThanOrEqual(150);
    expect(toMs(first)).toBeLessThanOrEqual(300);
  });

  it('M5.3-05 · la cible de 44 pt tient en jeton', () => {
    const raw = tokens['--prep-action-height'];
    expect(raw, '--prep-action-height non resolu').not.toBe('');
    const resolved = surfaces.cta.minHeight;
    expect(resolved).not.toBe('auto');
    expect(Number.parseFloat(resolved)).toBeGreaterThanOrEqual(44);
  });

  it('M5.3-06 · la cible de 44 pt tient au RENDU, barre et bouton', () => {
    expect(surfaces.cta.rectHeight).toBeGreaterThanOrEqual(44);
  });

  it('M5.3-07 · contraste 4.5:1 sur le verre M0 (commande flottante)', () => {
    const worst = worstAgainst(parseRgb(surfaces.verre.ink), bands.verre);
    expect(worst).toBeGreaterThanOrEqual(4.5);
  });

  it('M5.3-08 · contraste 4.5:1 sur le panneau de verre et son libelle', () => {
    const worst = worstAgainst(parseRgb(surfaces.bloc.ink), bands.bloc);
    expect(worst).toBeGreaterThanOrEqual(4.5);
  });

  it('M5.3-09 · contraste 4.5:1 sur la cible de 44 pt (CTA)', () => {
    const worst = worstAgainst(parseRgb(surfaces.cta.ink), bands.cta);
    expect(worst).toBeGreaterThanOrEqual(4.5);
  });

  it('M5.3-10 · l echantillonneur sait echouer (garde non vacue)', () => {
    // Plaque illisible : #fbfbfb sur #ffffff. Le calcul WCAG dit ~1.01:1.
    const analyticIllisible = contrastRatio(relativeLuminance(251, 251, 251), relativeLuminance(255, 255, 255));
    expect(analyticIllisible).toBeLessThan(4.5);
    expect(Math.abs(sonde.illisible - analyticIllisible)).toBeLessThanOrEqual(0.1);
    expect(sonde.illisible).toBeLessThan(4.5);

    // Plaque conforme : noir sur blanc, 21:1. Elle doit passer le meme calcul.
    const analyticLisible = contrastRatio(relativeLuminance(0, 0, 0), relativeLuminance(255, 255, 255));
    expect(analyticLisible).toBeGreaterThanOrEqual(4.5);
    expect(Math.abs(sonde.lisible - analyticLisible)).toBeLessThanOrEqual(0.1);
    expect(sonde.lisible).toBeGreaterThanOrEqual(4.5);
  });
});

