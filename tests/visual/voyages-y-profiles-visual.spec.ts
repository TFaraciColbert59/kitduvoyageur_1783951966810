import { test, expect } from '@playwright/test';
import { prepareVisualPage, expectVisualSnapshot } from './_helpers/prepareVisualPage';
import { createServerClient } from '@supabase/ssr';
import fs from 'node:fs';

/**
 * Y4 / Y0.5 — Specs visuels des 3 profils representatifs de la matrice (5.3) :
 *   - y-day-solo   (Rando journee solo)
 *   - y-long-group (TMB itinerance groupe)
 *   - y-exped-solo (Annapurna expedition solo)
 */

let cachedAuthCookie: { name: string; value: string; domain: string; path: string } | null = null;

async function getDemoAuthCookie(): Promise<{ name: string; value: string; domain: string; path: string } | null> {
  if (cachedAuthCookie) return cachedAuthCookie;
  try {
    let url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    let anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anonKey) {
      const envPath = fs.existsSync('.env.local') ? '.env.local' : '.env';
      const raw = fs.readFileSync(envPath, 'utf8');
      url = url || raw.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)?.[1]?.trim();
      anonKey = anonKey || raw.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)?.[1]?.trim();
    }
    if (!url || !anonKey) return null;

    let savedCookies: Array<{ name: string; value: string }> = [];
    const sb = createServerClient(url, anonKey, {
      cookies: {
        getAll: () => savedCookies,
        setAll: (cs: Array<{ name: string; value: string }>) => { savedCookies = cs; },
      },
    });
    await sb.auth.signInWithPassword({
      email: 'y-demo@lekitduvoyageur.fr',
      password: 'Ydemo!2026',
    });
    if (savedCookies.length > 0) {
      cachedAuthCookie = {
        name: savedCookies[0].name,
        value: savedCookies[0].value,
        domain: 'localhost',
        path: '/',
      };
      return cachedAuthCookie;
    }
  } catch (err) {
    console.warn('[visual-y] Auth demo non disponible:', err);
  }
  return null;
}

test.beforeEach(async ({ context }) => {
  const authCookie = await getDemoAuthCookie();
  if (authCookie) {
    await context.addCookies([authCookie]);
  }
});

test.describe('Profils Y — Decoupage & fidelite visuelle du Hub', () => {
  test('y-day-solo — Cockpit journee solo', async ({ page }) => {
    await prepareVisualPage(page, '/voyages/y-day-solo');
    const main = page.locator('main').first();
    await expect(main).toBeVisible();
    await expectVisualSnapshot(page, 'y-day-solo-overview.png');
  });

  test('y-day-solo — Itineraire simplifie', async ({ page }) => {
    await prepareVisualPage(page, '/voyages/y-day-solo/itineraire');
    const content = page.locator('main').first();
    await expect(content).toBeVisible();
    await expectVisualSnapshot(page, 'y-day-solo-itineraire.png');
  });

  test('y-long-group — Cockpit itinerance groupe avec equipage et budget', async ({ page }) => {
    await prepareVisualPage(page, '/voyages/y-long-group');
    const main = page.locator('main').first();
    await expect(main).toBeVisible();
    await expectVisualSnapshot(page, 'y-long-group-overview.png');
  });

  test('y-long-group — Synthese budget & balances', async ({ page }) => {
    await prepareVisualPage(page, '/voyages/y-long-group/budget');
    const main = page.locator('main').first();
    await expect(main).toBeVisible();
    await expectVisualSnapshot(page, 'y-long-group-budget.png');
  });

  test('y-long-group — Equipage & roles', async ({ page }) => {
    await prepareVisualPage(page, '/voyages/y-long-group/equipage');
    const main = page.locator('main').first();
    await expect(main).toBeVisible();
    await expectVisualSnapshot(page, 'y-long-group-equipage.png');
  });

  test('y-exped-solo — Expedition solo & checkpoints de securite', async ({ page }) => {
    await prepareVisualPage(page, '/voyages/y-exped-solo');
    const main = page.locator('main').first();
    await expect(main).toBeVisible();
    await expectVisualSnapshot(page, 'y-exped-solo-overview.png');
  });

  test('y-exped-solo — Securite & points de passage', async ({ page }) => {
    await prepareVisualPage(page, '/voyages/y-exped-solo/securite');
    const main = page.locator('main').first();
    await expect(main).toBeVisible();
    await expectVisualSnapshot(page, 'y-exped-solo-securite.png');
  });

  test('y-exped-solo — Journal de bord & notes', async ({ page }) => {
    await prepareVisualPage(page, '/voyages/y-exped-solo/journal');
    const main = page.locator('main').first();
    await expect(main).toBeVisible();
    await expectVisualSnapshot(page, 'y-exped-solo-journal.png');
  });

  // ——— Surfaces hub reprises des specs fdgb supprimées (slug de démo fragile,
  // baselines X-era « bugs compris ») : couverture rétablie sur slugs seedés. ———

  test('y-long-group — Section kit & sac a dos', async ({ page }) => {
    await prepareVisualPage(page, '/voyages/y-long-group/kit');
    const main = page.locator('main').first();
    await expect(main).toBeVisible();
    await expectVisualSnapshot(page, 'y-long-group-kit.png');
  });

  test('y-long-group — Feuille de route export', async ({ page }) => {
    await prepareVisualPage(page, '/voyages/y-long-group/export');
    const main = page.locator('main').first();
    await expect(main).toBeVisible();
    await expectVisualSnapshot(page, 'y-long-group-export.png');
  });

  test('y-long-group — Checklist de depart', async ({ page }) => {
    await prepareVisualPage(page, '/voyages/y-long-group/checklist');
    const main = page.locator('main').first();
    await expect(main).toBeVisible();
    await expectVisualSnapshot(page, 'y-long-group-checklist.png');
  });

  test('y-long-group — Documents de voyage', async ({ page }) => {
    await prepareVisualPage(page, '/voyages/y-long-group/documents');
    const main = page.locator('main').first();
    await expect(main).toBeVisible();
    await expectVisualSnapshot(page, 'y-long-group-documents.png');
  });

  test('liste /voyages — catalogue cockpit et filtres profil', async ({ page }) => {
    await prepareVisualPage(page, '/voyages');
    const main = page.locator('main').first();
    await expect(main).toBeVisible();
    await expectVisualSnapshot(page, 'voyages-liste.png');
  });

  test('wizard /voyages/nouveau — creation guidee', async ({ page }) => {
    await prepareVisualPage(page, '/voyages/nouveau');
    const main = page.locator('main').first();
    await expect(main).toBeVisible();
    await expectVisualSnapshot(page, 'voyages-nouveau.png');
  });
});
