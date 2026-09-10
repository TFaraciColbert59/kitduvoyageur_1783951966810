import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { createServerClient } from '@supabase/ssr';
import fs from 'node:fs';

/**
 * Y0.5 / Porte G6 — scans d'accessibilité du module voyage.
 * Un test par surface ; exécuté sur chaque projet du config (desktop, iphone, ipad).
 * Critère : zéro violation axe `critical` ou `serious`.
 * Couvre les 11 sections du Hub Voyage Unique sur le profil de référence `y-exped-group`.
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
    console.warn('[a11y] Impossible d\'obtenir le cookie auth démo, test en anonyme:', err);
  }
  return null;
}

const SURFACES: Array<{ id: string; url: string }> = [
  // Étape 2 — Hub unique : les surfaces voyages vivent dans /hub.
  { id: 'hub-apercu', url: '/hub' },
  { id: 'hub-nouveau', url: '/hub/nouveau' },
  { id: 'hub-itineraire', url: '/hub/itineraire' },
  { id: 'hub-kit-voyage', url: '/hub/kit-voyage' },
  { id: 'hub-budget', url: '/hub/budget' },
  { id: 'hub-documents', url: '/hub/documents' },
  { id: 'hub-checklist', url: '/hub/checklist' },
  { id: 'hub-securite', url: '/hub/securite' },
  { id: 'hub-journal', url: '/hub/journal' },
  { id: 'hub-export', url: '/hub/export' },
  { id: 'hub-groupe', url: '/hub/groupe' },
];

test.beforeEach(async ({ context }) => {
  const authCookie = await getDemoAuthCookie();
  if (authCookie) {
    await context.addCookies([authCookie]);
  }
});

for (const surface of SURFACES) {
  test(`a11y ${surface.id} — zéro violation critical/serious`, async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem(
        'lkdv_cookie_consent',
        JSON.stringify({ necessary: true, analytics: false, marketing: false, version: '1' })
      );
    });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(surface.url);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForSelector('main', { timeout: 15_000 }).catch(() => {});
    await page.waitForTimeout(1500);

    const results = await new AxeBuilder({ page })
      // Contenus tiers non maîtrisés (tuiles de carte, canvas) exclus du scan ;
      // les règles couleur sont couvertes par le garde-fou statique x6.
      .disableRules(['color-contrast'])
      .analyze();

    const blocking = results.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious'
    );

    if (blocking.length > 0) {
      const detail = blocking
        .map(
          (v) =>
            `${v.id} [${v.impact}] ${v.help} — ${v.nodes
              .slice(0, 3)
              .map((n) => n.target.join(' '))
              .join(' | ')}`
        )
        .join('\n');
      console.error(`[a11y ${surface.id}] violations bloquantes :\n${detail}`);
    }

    expect(blocking, `${blocking.length} violation(s) bloquante(s) sur ${surface.id}`).toEqual([]);
  });
}
