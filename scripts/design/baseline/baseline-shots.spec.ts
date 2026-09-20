import { test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Captures de référence « avant » (Phase 2 readiness).
 *
 * - viewport (above the fold) pour toutes les routes de la matrice ;
 * - fullPage pour les écrans longs clés (home, matériel) sur 2 gabarits ;
 * - manifest.json par gabarit : URL finale (redirects auth inclus), titre,
 *   erreurs console — sert aussi de smoke test.
 *
 * Les captures sont volontairement en JPEG qualité 72, DPR 1 : assez fidèles
 * pour la revue visuelle, assez légères pour être versionnées.
 */

const ROUTES: Array<{ slug: string; route: string }> = [
  { slug: 'home', route: '/' },
  { slug: 'materiel', route: '/materiel' },
  { slug: 'kits', route: '/kits' },
  { slug: 'carte-interactive', route: '/carte-interactive' },
  { slug: 'communaute', route: '/communaute' },
  { slug: 'carnets', route: '/carnets' },
  { slug: 'voyages', route: '/voyages' },
  { slug: 'boutique', route: '/boutique' },
  { slug: 'compte', route: '/compte' },
  { slug: 'hub', route: '/hub' },
  { slug: 'panier', route: '/panier' },
  { slug: 'connexion', route: '/connexion' },
];

const FULL_PAGE_ROUTES = new Set(['/', '/materiel']);

const OUT_ROOT = path.join(process.cwd(), 'docs', 'design-system', 'baseline-screenshots');

interface Shot {
  slug: string;
  route: string;
  finalUrl: string;
  title: string;
  consoleErrors: string[];
  screenshot: string;
  fullPage?: boolean;
}

test('capture la matrice de référence', async ({ page }, testInfo) => {
  const project = testInfo.project.name;
  const dir = path.join(OUT_ROOT, project);
  fs.mkdirSync(dir, { recursive: true });

  const shots: Shot[] = [];

  for (const { slug, route } of ROUTES) {
    const consoleErrors: string[] = [];
    const onConsole = (msg: { type: () => string; text: () => string }) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text().slice(0, 300));
    };
    const onPageError = (err: Error) => consoleErrors.push(`pageerror: ${err.message.slice(0, 300)}`);
    page.on('console', onConsole);
    page.on('pageerror', onPageError);

    let finalUrl = '';
    let title = '';
    const file = path.join(dir, `${slug}.jpg`);

    try {
      await page.goto(route, { waitUntil: 'domcontentloaded', timeout: 45_000 });
      await page.waitForTimeout(1500);
      finalUrl = page.url();
      title = await page.title();
      await page.screenshot({
        path: file,
        type: 'jpeg',
        quality: 72,
        animations: 'disabled',
      });
      shots.push({ slug, route, finalUrl, title, consoleErrors, screenshot: path.relative(process.cwd(), file).split(path.sep).join('/') });

      if (FULL_PAGE_ROUTES.has(route)) {
        const fullFile = path.join(dir, `${slug}-full.jpg`);
        await page.screenshot({
          path: fullFile,
          type: 'jpeg',
          quality: 72,
          fullPage: true,
          animations: 'disabled',
        });
        shots.push({
          slug: `${slug}-full`,
          route,
          finalUrl,
          title,
          consoleErrors,
          screenshot: path.relative(process.cwd(), fullFile).split(path.sep).join('/'),
          fullPage: true,
        });
      }
    } catch (error) {
      shots.push({
        slug,
        route,
        finalUrl,
        title,
        consoleErrors: [...consoleErrors, `capture: ${(error as Error).message.slice(0, 300)}`],
        screenshot: '',
      });
    } finally {
      page.off('console', onConsole);
      page.off('pageerror', onPageError);
    }
  }

  fs.writeFileSync(
    path.join(dir, 'manifest.json'),
    JSON.stringify({ project, capturedAt: new Date().toISOString(), shots }, null, 2)
  );

  // Les erreurs console sont consignées dans le manifest, pas assertées :
  // certaines pages dépendent de données/auth et sont capturées en l'état.
});
