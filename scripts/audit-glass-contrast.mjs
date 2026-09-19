/* Audit temporaire : contraste réel du texte à travers les couches verre. */
import { chromium } from 'playwright';

const BASE = 'http://localhost:4000';
const DEFAULT_ROUTES = [
  '/compte',
  '/hub',
  '/hub/inventaire',
  '/hub/alertes',
  '/hub/kit',
  '/hub/groupe',
  '/communaute',
  '/clubs',
  '/carnets',
  '/voyages',
  '/materiel',
  '/explorer',
  '/sorties',
  '/entraide',
  '/produits',
  '/abonnements',
];
const ROUTES = process.argv.slice(2).length > 0 ? process.argv.slice(2) : DEFAULT_ROUTES;
const VIEWPORTS = [
  { name: 'mobile', width: 430, height: 932 },
  { name: 'desktop', width: 1440, height: 900 },
];

const AUDIT = () => {
  const lum = (rgb) => {
    const f = (v) => {
      v /= 255;
      return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * f(rgb[0]) + 0.7152 * f(rgb[1]) + 0.0722 * f(rgb[2]);
  };
  const parse = (c) => {
    const m = c && c.match(/[\d.]+/g);
    return m ? [+m[0], +m[1], +m[2], m[3] !== undefined ? +m[3] : 1] : null;
  };
  const contrast = (a, b) => {
    const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x);
    return (l1 + 0.05) / (l2 + 0.05);
  };
  const effectiveBackground = (el) => {
    const layers = [];
    let node = el;
    let overImage = false;
    let imageOwner = null;
    while (node && node !== document.documentElement) {
      const st = getComputedStyle(node);
      if (st.backgroundImage && st.backgroundImage !== 'none') {
        overImage = true;
        imageOwner = node.className && typeof node.className === 'string' ? node.className.slice(0, 60) : node.tagName;
      }
      const c = parse(st.backgroundColor);
      if (c && c[3] > 0) layers.push(c);
      if (c && c[3] >= 0.999) break;
      node = node.parentElement;
    }
    let acc = [28, 59, 42];
    for (let i = layers.length - 1; i >= 0; i--) {
      const top = layers[i];
      const a = top[3];
      acc = acc.map((v, j) => top[j] * a + v * (1 - a));
    }
    return { bg: acc, overImage, imageOwner };
  };
  const results = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const seen = new Set();
  while (walker.nextNode()) {
    const text = walker.currentNode.textContent.trim();
    if (!text || text.length < 2) continue;
    const el = walker.currentNode.parentElement;
    if (!el || seen.has(el)) continue;
    seen.add(el);
    const st = getComputedStyle(el);
    if (st.visibility === 'hidden' || st.display === 'none' || st.opacity === '0') continue;
    const rect = el.getBoundingClientRect();
    if (rect.width < 4 || rect.height < 4) continue;
    if (el.closest('[aria-hidden="true"]')) continue;
    const color = parse(st.color);
    if (!color || color[3] === 0) continue;
    const { bg, overImage, imageOwner } = effectiveBackground(el);
    const fg = color.slice(0, 3);
    const c = contrast(fg, bg);
    const px = parseFloat(st.fontSize);
    const weight = parseInt(st.fontWeight, 10) || 400;
    const large = px >= 24 || (px >= 18.66 && weight >= 700);
    const min = large ? 3 : 4.5;
    if (c < min) {
      results.push({
        text: text.slice(0, 40),
        c: Math.round(c * 100) / 100,
        fg: st.color,
        bg: bg.map((v) => Math.round(v)),
        px,
        weight,
        overImage,
        imageOwner,
        el: el.tagName.toLowerCase() + (typeof el.className === 'string' && el.className ? '.' + el.className.split(/\s+/).slice(0, 3).join('.') : ''),
      });
    }
  }
  return results.slice(0, 60);
};

const browser = await chromium.launch();
let grandTotal = 0;
for (const vp of VIEWPORTS) {
  const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
  for (const route of ROUTES) {
    try {
      await page.goto(BASE + route, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await page.waitForTimeout(2500);
      const findings = await page.evaluate(AUDIT);
      const real = findings.filter((f) => !f.overImage);
      const overImage = findings.filter((f) => f.overImage);
      grandTotal += real.length;
      console.log(`\n=== ${vp.name} ${route} — ${real.length} lisibilité + ${overImage.length} via image ===`);
      for (const f of real) {
        console.log(`  [${f.c}] ${f.px}px/${f.weight} ${f.fg} sur rgb(${f.bg.join(',')}) — "${f.text}" <${f.el}>`);
      }
      for (const f of overImage) {
        console.log(`  (image) [${f.c}] "${f.text}" <${f.el}> bg-image: ${f.imageOwner}`);
      }
    } catch (error) {
      console.log(`\n=== ${vp.name} ${route} — ERREUR ${String(error).slice(0, 120)} ===`);
    }
  }
  await page.close();
}
await browser.close();
console.log(`\nTOTAL lisibilité: ${grandTotal}`);
