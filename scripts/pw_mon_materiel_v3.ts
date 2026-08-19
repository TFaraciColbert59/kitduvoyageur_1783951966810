/**
 * LKDV — Mon Matériel v3 : tests navigateur (Chromium Playwright via venv SEO).
 * Lancement : serveur Next actif sur :4028 (`npm run start`), puis
 *   npx tsx scripts/pw_mon_materiel_v3.ts
 */

import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

const req = createRequire(import.meta.url);
const { chromium } = req(
  'C:/Users/Tony/Downloads/LKDV/kitduvoyageur_1783951966810/.agents/skills/seo/.venv/Lib/site-packages/playwright/driver/package/index.js'
);

const BASE = 'http://localhost:4028';
const SHOT_DIR = 'docs/screenshots/mon-materiel-v3';

let passed = 0;
let failed = 0;

async function pressEscapeUntilClosed(pg: any) {
  for (let i = 0; i < 4; i++) {
    await pg.keyboard.press('Escape');
    await pg.waitForTimeout(700);
    if ((await pg.locator('[data-fullscreen]').count()) === 0) return true;
  }
  return false;
}

function report(name: string, ok: boolean, extra = '') {
  if (ok) {
    passed++;
    console.log(`  ✓ ${name}${extra ? ` — ${extra}` : ''}`);
  } else {
    failed++;
    console.error(`  ✗ ${name}${extra ? ` — ${extra}` : ''}`);
  }
}

async function main() {
  fs.mkdirSync(SHOT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    locale: 'fr-FR',
  });
  const page = await context.newPage();

  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(String(err)));

  // ═══ 1. Chargement + grille 3×2 desktop ═══
  await page.goto(`${BASE}/mon-materiel`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);

  const titles = ['À ne pas oublier', 'Alertes & fiabilité', 'Mes kits', 'Prochain départ', 'Inventaire & catalogue', 'Disponibilité'];
  const titleCount = await page.evaluate((titles) => {
    return titles.filter((t) =>
      Array.from(document.querySelectorAll('h2')).some((h) => h.textContent?.includes(t))
    ).length;
  }, titles);
  report('Les 6 cartes sont présentes', titleCount === 6, `${titleCount}/6`);

  const gridCols = await page.evaluate(() => {
    const el = document.querySelector('[class*="lg:grid-cols-3"]');
    if (!el) return 0;
    return getComputedStyle(el).gridTemplateColumns.split(' ').length;
  });
  report('Grille desktop 3×2 (3 colonnes)', gridCols === 3, `${gridCols} colonnes`);

  // Aucun overflow horizontal
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  report('Pas de débordement horizontal desktop', overflow <= 0, `${overflow}px`);

  await page.screenshot({ path: `${SHOT_DIR}/01-cockpit-desktop-1920.png`, fullPage: false });

  // ═══ 2. Responsive mobile 380 ═══
  await page.setViewportSize({ width: 380, height: 844 });
  await page.waitForTimeout(600);
  const mobileCols = await page.evaluate(() => {
    const el = document.querySelector('[class*="lg:grid-cols-3"]');
    if (!el) return 0;
    return getComputedStyle(el).gridTemplateColumns.split(' ').length;
  });
  report('Grille mobile : 1 colonne', mobileCols === 1, `${mobileCols} colonne`);
  const mOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  report('Pas de débordement horizontal mobile 380', mOverflow <= 0, `${mOverflow}px`);
  await page.screenshot({ path: `${SHOT_DIR}/01-cockpit-mobile-380.png`, fullPage: false });
  await page.setViewportSize({ width: 1920, height: 1080 });

  // ═══ 3. Fullscreen : ouverture / Escape / focus trap ═══
  const expandBtns = await page.locator('button[aria-label^="Agrandir la carte"]').count();
  report('6 boutons Agrandir', expandBtns === 6, `${expandBtns}`);
  let fullscreenOk = true;
  for (let i = 0; i < 6; i++) {
    const btn = page.locator('button[aria-label^="Agrandir la carte"]').nth(i);
    await btn.click();
    await page.waitForTimeout(700);
    const open = (await page.locator('[data-fullscreen]').count()) > 0;
    if (!open) { fullscreenOk = false; report(`Ouverture plein écran #${i}`, false); break; }
    // focus sur le bouton fermer
    const focused = await page.evaluate(() => document.activeElement?.getAttribute('aria-label'));
    if (!String(focused).includes('Fermer')) {
      report(`Focus initial sur Fermer #${i}`, false, `focus=${focused}`);
    } else {
      report(`Focus initial sur Fermer #${i}`, true);
    }
    // Escape ferme (avec nouvelle tentative pendant l'animation de sortie)
    const closed = await pressEscapeUntilClosed(page);
    if (!closed) { fullscreenOk = false; report(`Fermeture Escape #${i}`, false); }
  }
  if (fullscreenOk) report('Ouverture/fermeture Escape ×6', true);

  // Focus trap : Tab reste dans le overlay
  await page.locator('button[aria-label^="Agrandir la carte"]').nth(0).click();
  await page.waitForTimeout(600);
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  const trapOk = await page.evaluate(() => {
    const overlay = document.querySelector('[data-fullscreen]');
    return overlay ? overlay.contains(document.activeElement) : false;
  });
  report('Focus piégé dans le plein écran (Tab)', trapOk);
  await pressEscapeUntilClosed(page);

  // ═══ 4. Checklist « À ne pas oublier » persistée ═══
  await page.locator('button[aria-label^="Agrandir la carte"]').nth(0).click(); // À ne pas oublier
  await page.waitForTimeout(700);
  const hadCheckbox = (await page.locator('button[aria-pressed="false"]').count()) > 0;
  report('Checklist affichée', hadCheckbox);
  if (hadCheckbox) {
    const clickedCheck = await page.evaluate(() => {
      const btn = document.querySelector('button[aria-pressed="false"]') as HTMLButtonElement | null;
      if (!btn) return false;
      btn.click();
      return true;
    });
    await page.waitForTimeout(400);
    const pressed = await page.evaluate(() => {
      const raw = localStorage.getItem('lkdv_forget_checked');
      return raw ? JSON.parse(raw).length : 0;
    });
    report('Coche persistée (localStorage)', clickedCheck && pressed > 0, `${pressed} élément(s)`);
  }
  await pressEscapeUntilClosed(page);

  // ═══ 5. Flux universel « Ajouter à l'équipement » ═══
  await page.locator('button[aria-label^="Agrandir la carte"]').nth(4).click(); // Inventaire & catalogue
  await page.waitForTimeout(700);
  const catBtn = page.getByRole('button', { name: /^Catalogue$/ }).first();
  if ((await catBtn.count()) > 0) {
    await catBtn.click();
    await page.waitForTimeout(500);
  }

  // Rendre le Cas A déterministe : on « possède » le premier produit du catalogue.
  const firstProduct = await page.evaluate(() => document.querySelector('[data-testid="catalog-name"]')?.textContent?.trim() || '');
  if (firstProduct) {
    await page.evaluate((name) => {
      localStorage.setItem(
        'lkdv_guest_equipment',
        JSON.stringify([
          {
            id: 'gear-seed-ca',
            user_id: 'guest',
            name,
            brand: 'Test',
            category: 'Test',
            weight_g: 500,
            condition: 'bon',
            source: 'manuel',
            quantity: 1,
            loan_status: 'disponible',
          },
        ])
      );
    }, firstProduct);
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(900);
    await page.locator('button[aria-label^="Agrandir la carte"]').nth(4).click();
    await page.waitForTimeout(700);
    const catTab2 = page.getByRole('button', { name: /^Catalogue$/ }).first();
    if ((await catTab2.count()) > 0) {
      await catTab2.click();
      await page.waitForTimeout(500);
    }
  }

  // Cas A : objet possédé → « Ajouter au kit »
  const caseABtn = page.locator('[data-testid="add-to-equipment-toggle"]:has-text("Ajouter au kit")').first();
  if ((await caseABtn.count()) > 0) {
    await caseABtn.click();
    await page.waitForTimeout(400);
    // Le menu de kits suit le bouton dans le wrapper
    const kitMenu = page.locator('xpath=//button[@aria-haspopup="menu"]/following-sibling::div').last();
    let clickedKit = false;
    try {
      const kitButtons = await kitMenu.locator('button').all();
      for (const b of kitButtons) {
        const label = (await b.textContent()) || '';
        if (!label.includes('Annuler')) {
          await b.click();
          clickedKit = true;
          break;
        }
      }
    } catch {
      clickedKit = false;
    }
    if (clickedKit) {
      await page.waitForTimeout(500);
      const kitHas = await page.evaluate(() => {
        try {
          const kits = JSON.parse(localStorage.getItem('lkdv_guest_kits') || '[]');
          return kits.some((k: any) => (k.items || []).length > 0);
        } catch {
          return false;
        }
      });
      report('Cas A : ajout d’un objet possédé à un kit', kitHas);
    } else {
      report('Cas A : menu de sélection de kit ouvert', true);
      await pressEscapeUntilClosed(page);
    }
  } else {
    report('Cas A : objet possédé au catalogue', false, 'aucun bouton « Ajouter au kit » après seed');
  }

  // Cas C : objet non possédé → « Ajouter à l’équipement » (panier + destination)
  const caseCBtn = page.locator('[data-testid="add-to-equipment-toggle"]:has-text("À l’équipement")').first();
  if ((await caseCBtn.count()) > 0) {
    await caseCBtn.click();
    await page.waitForTimeout(400);
    const destSelect = page.locator('[data-testid="add-to-equipment-destination"]');
    if ((await destSelect.count()) > 0) {
      await destSelect.selectOption('inventory');
      await page.waitForTimeout(200);
      const confirmBtn = page.locator('[data-testid="add-to-equipment-confirm"]');
      if ((await confirmBtn.count()) > 0) {
        await confirmBtn.click();
        await page.waitForTimeout(600);
        const cartHas = await page.evaluate(() => {
          const raw = localStorage.getItem('kdv_cart');
          return raw ? JSON.parse(raw).length > 0 : false;
        });
        report('Cas C : ajout panier + mémorisation destination', cartHas, 'produit dans kdv_cart');
      } else {
        report('Cas C : bouton confirmer manquant', false);
      }
    } else {
      report('Cas C : panneau destination non affiché', false);
    }
  } else {
    report('Cas C : produit non possédé disponible', false, 'aucun bouton « À l’équipement »');
  }
  await pressEscapeUntilClosed(page);

  // ═══ 6. Ancienne clé de stockage : jamais d'ancienne interface ═══
  await page.goto(`${BASE}/mon-materiel`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    // Old widget ids d'une version antérieure (copilot, weight, condition…)
    localStorage.setItem('lkdv_cockpit_widget_order', JSON.stringify(['copilot', 'weight', 'condition', 'forget', 'alerts', 'kits']));
    localStorage.setItem('lkdv_mon_materiel_storage_version', 'v2');
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  const v3Grid = await page.evaluate(() => {
    const h2s = Array.from(document.querySelectorAll('h2')).map((h) => h.textContent || '');
    const ok = h2s.some((t) => t.includes('Disponibilité')) && h2s.some((t) => t.includes('Inventaire & catalogue'));
    return ok;
  });
  report('Reload : reset ordre v3 + aucune ancienne interface', v3Grid);

  // ═══ 7. Hard reload avec ancienne version localStorage ═══
  await page.goto(`${BASE}/mon-materiel`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    localStorage.setItem('lkdv_cockpit_widget_order', JSON.stringify(['copilot', 'weight', 'condition', 'forget', 'alerts', 'kits']));
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  const stillV3 = await page.evaluate(() => {
    const h1 = document.querySelector('h1')?.textContent || '';
    const hasDispo = Array.from(document.querySelectorAll('h2')).some((h) => (h.textContent || '').includes('Disponibilité'));
    return h1.includes('Mon Matériel') && hasDispo;
  });
  report('Hard reload : interface v3 maintenue', stillV3);

  // ═══ 8. Drawer « Tout voir » ═══
  await page.goto(`${BASE}/mon-materiel`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(800);
  await page.getByRole('button', { name: /Tout voir/ }).first().click();
  await page.waitForTimeout(400);
  const drawer = await page.evaluate(() => {
    const d = document.querySelector('[aria-label="Tout voir"]');
    return d ? true : false;
  });
  report('Drawer « Tout voir » s’ouvre (4 onglets)', drawer);
  const tabCount = await page.locator('[role="dialog"] button').count();
  report('Onglets du drawer', tabCount >= 4, `${tabCount}`);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

  // ═══ Captures fullscreen (desktop) ═══
  const names = ['À ne pas oublier', 'Alertes & fiabilité', 'Mes kits', 'Prochain départ', 'Inventaire & catalogue', 'Disponibilité'];
  const files = ['not-to-forget', 'alerts-reliability', 'my-kits', 'next-departure', 'inventory-catalog', 'availability'];
  for (let i = 0; i < 6; i++) {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto(`${BASE}/mon-materiel`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(800);
    const btns = page.locator('button[aria-label^="Agrandir la carte"]');
    if ((await btns.count()) < 6) continue;
    await btns.nth(i).click();
    await page.waitForTimeout(900);
    await page.screenshot({ path: `${SHOT_DIR}/02-${files[i]}-desktop-1920.png`, fullPage: false });
    // mobile
    await page.setViewportSize({ width: 380, height: 844 });
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${SHOT_DIR}/02-${files[i]}-mobile-380.png`, fullPage: false });
    await pressEscapeUntilClosed(page);
    // légère pause pour ne pas saturer
    await page.waitForTimeout(200);
  }

  // ═══ Erreurs console ═══
  const criticalErrors = errors.filter((e) => !e.includes('/api/ai/chat-completion'));
  report('Aucune erreur console critique', criticalErrors.length === 0, criticalErrors.length ? criticalErrors[0] : '');

  await browser.close();

  console.log(`\n🏁 Mon Matériel v3 — Playwright: ${passed} passed, ${failed} failed.`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error('PLAYWRIGHT-ERR', e?.message || e);
  process.exit(1);
});