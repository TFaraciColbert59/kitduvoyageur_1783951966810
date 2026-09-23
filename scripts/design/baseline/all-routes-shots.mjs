/* Capture de TOUTES les routes statiques de l'app (viewport téléphone 393x852).
 * Usage : node scripts/design/baseline/all-routes-shots.mjs
 * Sortie : docs/qa/all-routes/*.jpg + manifest.json
 * Serveur dev attendu sur http://localhost:4028
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const BASE = 'http://localhost:4028';
const OUT_DIR = path.join(process.cwd(), 'docs/qa/all-routes');
fs.mkdirSync(OUT_DIR, { recursive: true });

const STATIC_ROUTES = [
  '/', '/abonnements', '/admin', '/admin/produits', '/ai-configurator',
  '/ambassadeurs', '/avis', '/blog', '/boutique', '/carbone', '/carnets',
  '/carnets/nouveau', '/carte-interactive', '/cgu', '/cgv', '/checkout',
  '/clubs', '/clubs/nouveau', '/communaute', '/communaute/publier',
  '/communaute-pro', '/compte', '/compte/modifier', '/connexion', '/contact',
  '/cookies', '/copilote', '/createurs', '/entraide', '/evenements',
  '/experts', '/explorer', '/faq', '/feed', '/fidelite', '/guides',
  '/hors-ligne', '/hub', '/hub/nouveau', '/inscription', '/kits',
  '/lieux', '/location', '/manifeste', '/materiel', '/mentions-legales',
  '/messagerie', '/nouveau-groupe', '/occasion', '/outils', '/panier',
  '/politique-confidentialite', '/preparer-randonnee',
  '/preparer-sentier/apercu', '/pro', '/profil', '/progression',
  '/publier', '/randonnee-active', '/rapport-expedition', '/recompenses',
];

// Dynamiques : [route pattern, page listing, regex du lien]
const DYNAMIC = [
  ['/carnets/[id]', '/carnets', /^\/carnets\/[^/]+$/],
  ['/clubs/[id]', '/clubs', /^\/clubs\/[^/]+$/],
  ['/compte/[userId]', '/communaute', /^\/compte\/[^/]+$/],
  ['/guides/[slug]', '/guides', /^\/guides\/[^/]+$/],
  ['/hub/[section]', '/hub', /^\/hub\/[^/]+$/],
  ['/kits/[slug]', '/kits', /^\/kits\/[^/]+$/],
  ['/lieux/[slug]', '/lieux', /^\/lieux\/[^/]+$/],
  ['/outils/[slug]', '/outils', /^\/outils\/[^/]+$/],
  ['/pays/[code]', '/lieux', /^\/pays\/[^/]+$/],
  ['/preparer-sentier/[id]', '/preparer-randonnee', /^\/preparer-sentier\/[^/]+$/],
  ['/produit/[slug]', '/boutique', /^\/produit\/[^/]+$/],
  ['/profil/[id]', '/createurs', /^\/profil\/[^/]+$/],
  ['/rejoindre/[slug]', '/clubs', /^\/rejoindre\/[^/]+$/],
  ['/voyages/[slug]', '/hub', /^\/voyages\/[^/]+$/],
];
// NOTE : /k/[token] (tokens de partage opaques) volontairement exclu.

const slug = (r) => (r === '/' ? 'home' : r.replace(/^\//, '').replace(/\//g, '-'));

async function resolveDynamic(browser, manifest) {
  const ctx = await browser.newContext();
  await ctx.addInitScript(() => {
    localStorage.setItem(
      'lkdv_cookie_consent',
      JSON.stringify({ necessary: true, analytics: false, marketing: false, version: '1' }),
    );
  });
  const page = await ctx.newPage();
  const resolved = [];
  for (const [pattern, listing, re] of DYNAMIC) {
    try {
      await page.goto(BASE + listing, { waitUntil: 'domcontentloaded', timeout: 45_000 });
      await page.waitForTimeout(2000);
      const hrefs = await page.$$eval('a[href]', (as) => as.map((a) => a.getAttribute('href')));
      const hit = hrefs.find((h) => h && re.test(h.split('?')[0]) && !h.includes('nouveau'));
      if (hit) resolved.push({ pattern, url: hit.split('?')[0] });
      else manifest.push({ route: pattern, status: 'skipped', reason: `aucun lien trouvé depuis ${listing}` });
    } catch (e) {
      manifest.push({ route: pattern, status: 'skipped', reason: String(e).slice(0, 200) });
    }
  }
  // voyages/[slug]/[section] dérivé du slug voyages si résolu
  const v = resolved.find((r) => r.pattern === '/voyages/[slug]');
  if (v) {
    try {
      await page.goto(BASE + v.url, { waitUntil: 'domcontentloaded', timeout: 45_000 });
      await page.waitForTimeout(2000);
      const hrefs = await page.$$eval('a[href]', (as) => as.map((a) => a.getAttribute('href')));
      const esc = v.url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const re = new RegExp(`^${esc}/[^/]+$`);
      const hit = hrefs.find((h) => h && re.test(h.split('?')[0]));
      if (hit) resolved.push({ pattern: '/voyages/[slug]/[section]', url: hit.split('?')[0] });
      else manifest.push({ route: '/voyages/[slug]/[section]', status: 'skipped', reason: 'aucune section liée' });
    } catch (e) {
      manifest.push({ route: '/voyages/[slug]/[section]', status: 'skipped', reason: String(e).slice(0, 200) });
    }
  }
  await ctx.close();
  return resolved;
}

async function shoot(browser, route, manifest) {
  const ctx = await browser.newContext({
    viewport: { width: 393, height: 852 },
    isMobile: true,
    hasTouch: true,
    reducedMotion: 'reduce',
  });
  await ctx.addInitScript(() => {
    localStorage.setItem(
      'lkdv_cookie_consent',
      JSON.stringify({ necessary: true, analytics: false, marketing: false, version: '1' }),
    );
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message.slice(0, 200)}`));
  const entry = { route, viewport: '393x852' };
  try {
    const resp = await page.goto(BASE + route, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    entry.http = resp ? resp.status() : null;
    await page.waitForTimeout(3000);
    const banner = page.getByRole('region', { name: 'Gestion des cookies' });
    if (await banner.isVisible().catch(() => false)) {
      await page.getByRole('button', { name: 'Refuser' }).first().click().catch(() => {});
      await page.waitForTimeout(600);
    }
    entry.cookieBannerVisible = await banner.isVisible().catch(() => null);
    entry.finalUrl = page.url().replace(BASE, '');
    entry.title = await page.title();
    const file = path.join(OUT_DIR, `${slug(route)}.jpg`);
    await page.screenshot({ path: file, type: 'jpeg', quality: 70, animations: 'disabled' });
    entry.file = path.relative(process.cwd(), file).split(path.sep).join('/');
    entry.status = 'ok';
  } catch (e) {
    entry.status = 'failed';
    entry.reason = String(e).slice(0, 300);
  }
  entry.consoleErrors = errors.length;
  manifest.push(entry);
  await ctx.close();
}

const browser = await chromium.launch();
const manifest = [];
console.log('Résolution des routes dynamiques…');
const dyn = await resolveDynamic(browser, manifest);
console.log(`${dyn.length} dynamiques résolues, ${STATIC_ROUTES.length} statiques.`);
const all = [...STATIC_ROUTES, ...dyn.map((d) => d.url)];
let i = 0;
for (const r of all) {
  i += 1;
  process.stdout.write(`[${i}/${all.length}] ${r} … `);
  await shoot(browser, r, manifest);
  console.log(manifest[manifest.length - 1].status);
}
await browser.close();
fs.writeFileSync(path.join(OUT_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2));
const ok = manifest.filter((m) => m.status === 'ok').length;
console.log(`\nTerminé : ${ok}/${manifest.length} OK → ${OUT_DIR}`);
