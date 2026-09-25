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

const TEST_AUDIT_EMAIL = process.env.AUDIT_EMAIL || 'audit@example.invalid';
const TEST_AUDIT_PASSWORD = process.env.AUDIT_PASSWORD || 'audit-password.invalid';

let cachedAuthCookie: { name: string; value: string; domain: string; path: string } | null = null;

/**
 * Cookie d'aventure active — même protocole que tests/a11y/e2e/hub-a11y.spec.ts.
 * Sans cookie, /hub retombe sur la nature possession (H-AUTO-15) : les captures
 * de sections (budget, itineraire…) tombent en 404. Chaque test verrouille son
 * profil y-* seedé (horloge ancrée 01/06/2026) pour une baseline déterministe.
 */
function adventureCookie(data: unknown): { name: string; value: string; domain: string; path: string } {
  return {
    name: 'lkv_active_adventure',
    value: Buffer.from(JSON.stringify(data), 'utf-8').toString('base64url'),
    domain: 'localhost',
    path: '/',
  };
}

const SORTIE = (slug: string) =>
  adventureCookie({ nature: 'sortie', id: slug, slug, title: slug });

const Y_DAY_SOLO = SORTIE('y-day-solo');
const Y_LONG_GROUP = SORTIE('y-long-group');
const Y_EXPED_SOLO = SORTIE('y-exped-solo');

async function getDemoAuthCookie(): Promise<{ name: string; value: string; domain: string; path: string } | null> {
  if (cachedAuthCookie) return cachedAuthCookie;
  // CI hermétique (Supabase placeholder, pas de .env) : sortie immédiate.
  // Sans ce garde-fou, chaque test tentait ENOENT puis une auth réseau en
  // échec (~50 tests x retries), allongeant le job de plus de 10 minutes.
  if (process.env.NEXT_PUBLIC_CI === 'true') return null;
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
      email: TEST_AUDIT_EMAIL,
      password: TEST_AUDIT_PASSWORD,
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
    await page.context().addCookies([Y_DAY_SOLO]);
    await prepareVisualPage(page, '/hub');
    const main = page.locator('main').first();
    await expect(main).toBeVisible();
    await expectVisualSnapshot(page, 'y-day-solo-overview.png');
  });

  test('y-day-solo — Itineraire simplifie', async ({ page }) => {
    await page.context().addCookies([Y_DAY_SOLO]);
    await prepareVisualPage(page, '/hub/itineraire');
    const content = page.locator('main').first();
    await expect(content).toBeVisible();
    await expectVisualSnapshot(page, 'y-day-solo-itineraire.png');
  });

  test('y-long-group — Cockpit itinerance groupe avec equipage et budget', async ({ page }) => {
    await page.context().addCookies([Y_LONG_GROUP]);
    await prepareVisualPage(page, '/hub');
    const main = page.locator('main').first();
    await expect(main).toBeVisible();
    await expectVisualSnapshot(page, 'y-long-group-overview.png');
  });

  test('y-long-group — Synthese budget & balances', async ({ page }) => {
    await page.context().addCookies([Y_LONG_GROUP]);
    await prepareVisualPage(page, '/hub/budget');
    const main = page.locator('main').first();
    await expect(main).toBeVisible();
    await expectVisualSnapshot(page, 'y-long-group-budget.png');
  });

  test('y-long-group — Groupe & roles (participants)', async ({ page }) => {
    await page.context().addCookies([Y_LONG_GROUP]);
    await prepareVisualPage(page, '/hub/groupe');
    const main = page.locator('main').first();
    await expect(main).toBeVisible();
    await expectVisualSnapshot(page, 'y-long-group-groupe.png');
  });

  test('y-exped-solo — Expedition solo & checkpoints de securite', async ({ page }) => {
    await page.context().addCookies([Y_EXPED_SOLO]);
    await prepareVisualPage(page, '/hub');
    const main = page.locator('main').first();
    await expect(main).toBeVisible();
    await expectVisualSnapshot(page, 'y-exped-solo-overview.png');
  });

  test('y-exped-solo — Securite & points de passage', async ({ page }) => {
    await page.context().addCookies([Y_EXPED_SOLO]);
    await prepareVisualPage(page, '/hub/securite');
    const main = page.locator('main').first();
    await expect(main).toBeVisible();
    await expectVisualSnapshot(page, 'y-exped-solo-securite.png');
  });

  test('y-exped-solo — Journal de bord & notes', async ({ page }) => {
    await page.context().addCookies([Y_EXPED_SOLO]);
    await prepareVisualPage(page, '/hub/journal');
    const main = page.locator('main').first();
    await expect(main).toBeVisible();
    await expectVisualSnapshot(page, 'y-exped-solo-journal.png');
  });

  // ——— Surfaces hub reprises des specs fdgb supprimées (slug de démo fragile,
  // baselines X-era « bugs compris ») : couverture rétablie sur slugs seedés. ———

  test('y-long-group — Section kit & sac a dos', async ({ page }) => {
    await page.context().addCookies([Y_LONG_GROUP]);
    await prepareVisualPage(page, '/hub/kit-voyage');
    const main = page.locator('main').first();
    await expect(main).toBeVisible();
    await expectVisualSnapshot(page, 'y-long-group-kit.png');
  });

  test('y-long-group — Feuille de route export', async ({ page }) => {
    await page.context().addCookies([Y_LONG_GROUP]);
    await prepareVisualPage(page, '/hub/export');
    const main = page.locator('main').first();
    await expect(main).toBeVisible();
    await expectVisualSnapshot(page, 'y-long-group-export.png');
  });

  test('y-long-group — Checklist de depart', async ({ page }) => {
    await page.context().addCookies([Y_LONG_GROUP]);
    await prepareVisualPage(page, '/hub/checklist');
    const main = page.locator('main').first();
    await expect(main).toBeVisible();
    await expectVisualSnapshot(page, 'y-long-group-checklist.png');
  });

  test('y-long-group — Documents de voyage', async ({ page }) => {
    await page.context().addCookies([Y_LONG_GROUP]);
    await prepareVisualPage(page, '/hub/documents');
    const main = page.locator('main').first();
    await expect(main).toBeVisible();
    await expectVisualSnapshot(page, 'y-long-group-documents.png');
  });

  test('liste /voyages — catalogue cockpit et filtres profil', async ({ page }) => {
    await page.context().addCookies([Y_LONG_GROUP]);
    await prepareVisualPage(page, '/hub');
    const main = page.locator('main').first();
    await expect(main).toBeVisible();
    await expectVisualSnapshot(page, 'voyages-liste.png');
  });

  test('wizard /voyages/nouveau — creation guidee', async ({ page }) => {
    await page.context().addCookies([Y_LONG_GROUP]);
    await prepareVisualPage(page, '/hub/nouveau');
    const main = page.locator('main').first();
    await expect(main).toBeVisible();
    await expectVisualSnapshot(page, 'voyages-nouveau.png');
  });
});

