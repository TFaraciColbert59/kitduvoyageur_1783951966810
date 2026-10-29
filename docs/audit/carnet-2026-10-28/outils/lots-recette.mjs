// Recette navigateur des lots B-F : focus, cibles, mouvement, transparence.
import { chromium } from 'playwright';

const BASE = process.env.CKP_BASE || 'http://localhost:4233';
const CARNET = '/carnets/9ba890ca-e071-5ab8-8624-6bd8a471a6c1';
const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 430, height: 932 },
  locale: 'fr-FR',
  timezoneId: 'Europe/Paris',
});
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e).slice(0, 160)));
const cdp = await ctx.newCDPSession(page);
const emulate = (features) => cdp.send('Emulation.setEmulatedMedia', { features });

await page.goto(BASE + CARNET, { waitUntil: 'commit', timeout: 180000 });
await page.waitForSelector('.ckp-mapzone', { timeout: 120000 });
await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
for (let i = 0; i < 12; i += 1) {
  const accept = page.getByRole('button', { name: 'Tout accepter' });
  if (await accept.count()) {
    await accept.first().click().catch(() => {});
    break;
  }
  await page.waitForTimeout(400);
}
await page.waitForTimeout(1200);

const trigger = page.locator('.ckp-stat[data-stat="distance"]');
await trigger.focus();
await trigger.click();
await page.waitForSelector('.ckp-card--drawer');
await page.waitForTimeout(800);

const locked = await page.evaluate(() => document.documentElement.getAttribute('data-ckp-sheet'));

/* Anneau de focus atteint au clavier (Tab), pas au clic. */
const ring = await page.evaluate(() => {
  const read = () => {
    const n = document.activeElement;
    if (!n) return null;
    const s = getComputedStyle(n);
    return {
      cls: typeof n.className === 'string' ? n.className.slice(0, 40) : n.tagName,
      outline: `${s.outlineWidth} ${s.outlineStyle} ${s.outlineColor}`,
      offset: s.outlineOffset,
    };
  };
  document.querySelector('.ckp-card--drawer')?.focus();
  return read();
});
await page.keyboard.press('Tab');
const ringTab = await page.evaluate(() => {
  const n = document.activeElement;
  if (!n) return null;
  const s = getComputedStyle(n);
  return { tag: n.tagName, cls: typeof n.className === 'string' ? n.className.slice(0, 40) : '', outline: `${s.outlineWidth} ${s.outlineStyle} ${s.outlineColor}`, offset: s.outlineOffset, shadow: s.boxShadow };
});

/* Cibles tactiles : hauteur de la zone réellement atteignable. */
const targets = await page.evaluate(() => {
  const box = (sel) => {
    const n = document.querySelector(sel);
    if (!n) return null;
    const r = n.getBoundingClientRect();
    const after = getComputedStyle(n, '::after');
    const top = parseFloat(after.top || '0');
    const bottom = parseFloat(after.bottom || '0');
    return { h: Math.round(r.height), withAfter: Math.round(r.height - top - bottom) };
  };
  return { segment: box('.ckp-capsule .ckp-tabs button'), close: box('.ckp-drawer-close'), grabber: box('.ckp-grabber') };
});

/* Transparence réduite et mouvement réduit, émulés par CDP. */
await emulate([{ name: 'prefers-reduced-transparency', value: 'reduce' }]);
await page.waitForTimeout(200);
const transparency = await page.evaluate(() => {
  const s = getComputedStyle(document.querySelector('.ckp-card--drawer'));
  const capsule = getComputedStyle(document.querySelector('.ckp-drawer-foot .ckp-capsule'));
  return { sheetBg: s.backgroundColor, sheetImage: s.backgroundImage, sheetBlur: s.backdropFilter, capsuleBlur: capsule.backdropFilter, capsuleBg: capsule.backgroundColor };
});
await emulate([
  { name: 'prefers-reduced-motion', value: 'reduce' },
  { name: 'prefers-reduced-transparency', value: 'no-preference' },
]);
await page.waitForTimeout(200);
const motion = await page.evaluate(() => {
  const s = getComputedStyle(document.querySelector('.ckp-card--drawer'));
  const chevron = document.querySelector('.ckp-collapsible');
  return { animation: s.animationName, duration: s.animationDuration, chevron: Boolean(chevron) };
});
await emulate([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);

/* Fermeture : Échap → sortie 160 ms puis focus rendu au déclencheur. */
await page.keyboard.press('Escape');
const closing = await page.evaluate(() => {
  const sheet = document.querySelector('.ckp-card--drawer');
  if (!sheet) return null;
  const s = getComputedStyle(sheet);
  return { closing: sheet.getAttribute('data-closing'), hidden: sheet.getAttribute('aria-hidden'), animation: s.animationName, duration: s.animationDuration };
});
await page.waitForTimeout(320);
const afterClose = await page.evaluate(() => ({
  drawer: Boolean(document.querySelector('.ckp-card--drawer')),
  lock: document.documentElement.getAttribute('data-ckp-sheet'),
  focus: document.activeElement?.getAttribute?.('data-stat') || document.activeElement?.className?.slice?.(0, 40) || document.activeElement?.tagName,
}));

/* Squelette : nombre d'itérations du shimmer (aucune boucle). */
await page.emulateMedia({ reducedMotion: 'no-preference' }).catch(() => {});
const shimmer = await page.evaluate(() => {
  const probe = document.createElement('span');
  probe.className = 'ckp-load-bar';
  document.querySelector('.ckp-screen')?.appendChild(probe);
  const s = getComputedStyle(probe, '::after');
  const out = { name: s.animationName, duration: s.animationDuration, count: s.animationIterationCount };
  probe.remove();
  return out;
});

console.log(JSON.stringify({ locked, ring, ringTab, targets, transparency, motion, closing, afterClose, shimmer, errors }, null, 1));
await browser.close();
