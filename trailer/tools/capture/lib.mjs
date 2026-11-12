// Capture d'écrans réels de l'app LKDV pour le trailer.
// Viewport 430×932 à deviceScaleFactor 3 = 1290×2796, thème clair, iPhone.
// Le jeton d'aperçu se lit dans VERCEL_SHARE ; il n'est jamais écrit sur disque
// ni dans un journal (masquage de toute URL journalisée).
import { createRequire } from 'node:module';
// Playwright est préinstallé hors du projet (jamais `playwright install`).
const require = createRequire(import.meta.url);
function loadPlaywright() {
  for (const id of ['playwright', '/opt/node-tools/node_modules/playwright']) {
    try { return require(id); } catch {}
  }
  throw new Error('Playwright introuvable');
}
export const { chromium } = loadPlaywright();

export const BASE = (process.env.LKDV_BASE_URL || 'https://kitduvoyageur-1783951966810-4iswur70z.vercel.app').replace(/\/+$/, '');
export const W = 430, H = 932, DPR = 3;

export function mask(s) {
  const t = process.env.VERCEL_SHARE;
  return t ? String(s).split(t).join('***') : String(s);
}

// Dolomites : Lago di Sorapis (position d'appareil simulée, entrée autorisée).
export const SORAPIS = { latitude: 46.5196, longitude: 12.2228, accuracy: 8 };

export async function openContext({ geolocation = SORAPIS, timezone = 'Europe/Rome' } = {}) {
  const token = process.env.VERCEL_SHARE;
  if (!token) throw new Error('VERCEL_SHARE manquant (variable d’environnement).');
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await browser.newContext({
    viewport: { width: W, height: H },
    deviceScaleFactor: DPR,
    isMobile: true,
    hasTouch: true,
    colorScheme: 'light',
    locale: 'fr-FR',
    timezoneId: timezone,
    geolocation,
    permissions: ['geolocation'],
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
  });
  // Passe la protection Vercel une fois : le cookie de partage est posé sur l'hôte.
  const p = await ctx.newPage();
  const r = await p.goto(`${BASE}/manifeste?_vercel_share=${token}`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  const body = await p.content();
  if (/Deployment is building|Log in to Vercel|vercel\.com\/login/i.test(body)) throw new Error('Aperçu non servi (page Vercel).');
  console.log('aperçu', r?.status());
  await p.close();
  return { browser, ctx };
}

export async function assertServed(page) {
  const html = await page.content();
  if (/Deployment is building|Log in to Vercel/i.test(html)) throw new Error('Page Vercel au lieu de l’app : ' + mask(page.url()));
}

export async function settle(page, ms = 2500) {
  try { await page.waitForLoadState('networkidle', { timeout: 30000 }); } catch {}
  await page.waitForTimeout(ms);
}
