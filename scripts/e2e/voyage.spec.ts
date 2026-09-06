import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

test.describe('Module Voyage E2E Suite — Parcours Utilisateur & Ergonomie (C1-C8)', () => {
  const screenshotsDir = path.join(process.cwd(), 'tests', 'visual', 'snapshots');

  test.beforeAll(() => {
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir, { recursive: true });
    }
  });

  test.beforeEach(async ({ context }) => {
    await context.addInitScript(() => {
      window.localStorage.setItem(
        'lkdv_cookie_consent',
        JSON.stringify({ necessary: true, analytics: true, marketing: true, version: '1' })
      );
    });
  });

  test('TEST-E2E-VOYAGE-01: API /api/voyages répond en JSON 200 avec structure canonique', async ({ request }) => {
    const res = await request.get('/api/voyages');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('trips');
    expect(Array.isArray(body.trips)).toBe(true);
    expect(body).toHaveProperty('total');
    expect(typeof body.total).toBe('number');
  });

  test('TEST-E2E-VOYAGE-02: Page /voyages charge le Cockpit, filtres et modal Nouveau Voyage', async ({ page }) => {
    await page.goto('/voyages', { waitUntil: 'domcontentloaded' });
    
    // Le titre et la structure principale doivent être présents
    await expect(page).toHaveTitle(/Voyages|Le Kit du Voyageur/i);
    const heading = page.locator('h1').first();
    await expect(heading).toBeVisible();

    // Bouton Nouveau voyage ouvrant la modale de création
    const createBtn = page.locator('button:has-text("Nouveau voyage")').first();
    await expect(createBtn).toBeVisible();

    // Clic pour ouvrir la modale
    await createBtn.click();
    const modalTitle = page.locator('text=Créer un voyage').or(page.locator('text=Nouveau')).first();
    await expect(modalTitle).toBeVisible();
  });

  test('TEST-E2E-VOYAGE-03: Wizard /voyages/nouveau charge l\'étape 1 et les contrôles tactiles', async ({ page }) => {
    await page.goto('/voyages/nouveau', { waitUntil: 'networkidle' });
    
    // Vérification du wizard
    const wizardContainer = page.locator('main').first();
    await expect(wizardContainer).toBeVisible();

    // Présence des étapes ou indicateur de progression
    const progressIndicator = page.locator('text=Étape').or(page.locator('text=Destination')).first();
    await expect(progressIndicator).toBeVisible();

    // Vérification de la cible tactile du bouton de navigation (>= 44px)
    const nextButton = page.locator('button:has-text("Suivant"), button:has-text("Continuer"), button:has-text("Étape suivante")').first();
    if (await nextButton.isVisible()) {
      const box = await nextButton.boundingBox();
      if (box) {
        expect(box.height).toBeGreaterThanOrEqual(40); // Standard mobile LKDV
      }
    }
  });

  test('TEST-E2E-VOYAGE-04: Explorateur /lieux charge le catalogue de topos et la recherche', async ({ page }) => {
    await page.goto('/lieux', { waitUntil: 'domcontentloaded' });

    // Titre ou en-tête des lieux
    const heading = page.locator('h1, h2').first();
    await expect(heading).toBeVisible();

    // Vérifie la présence de la barre de recherche ou de filtres
    const searchInput = page.locator('input[type="text"], input[placeholder*="recherch" i]').first();
    if (await searchInput.isVisible()) {
      await expect(searchInput).toBeEnabled();
    }
  });

  test('TEST-E2E-VOYAGE-05: Redirection sécurisée /go/[slug] sur partenaire inconnu', async ({ request }) => {
    const res = await request.get('/go/partenaire-inexistant-test', { maxRedirects: 0 });
    // Soit 404, soit 307 vers la page de fallback
    expect([404, 307, 308, 302]).toContain(res.status());
  });

  test('TEST-E2E-VOYAGE-06: Responsive Mobile iOS & Snapshot Visuel (390x844 — iPhone 14 Pro)', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/voyages', { waitUntil: 'networkidle' });

    // Vérifie que le conteneur mobile ne déborde pas en largeur
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    expect(bodyWidth).toBeLessThanOrEqual(390);

    // Vérifie l'accessibilité du bouton nouveau voyage en affichage mobile
    const createBtn = page.locator('button:has-text("Nouveau voyage")').first();
    await expect(createBtn).toBeVisible();
    const btnBox = await createBtn.boundingBox();
    if (btnBox) {
      expect(btnBox.height).toBeGreaterThanOrEqual(40);
    }

    // Capture snapshot visuel mobile 390px
    const snapshotMobilePath = path.join(screenshotsDir, 'voyage-cockpit-390px.png');
    await page.screenshot({ path: snapshotMobilePath, fullPage: false });
    expect(fs.existsSync(snapshotMobilePath)).toBe(true);
  });

  test('TEST-E2E-VOYAGE-07: Desktop Navigation & Snapshot Visuel (1440x900)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/voyages', { waitUntil: 'networkidle' });

    const mainElement = page.locator('main').first();
    await expect(mainElement).toBeVisible();

    // Capture snapshot visuel desktop 1440px
    const snapshotDesktopPath = path.join(screenshotsDir, 'voyage-cockpit-1440px.png');
    await page.screenshot({ path: snapshotDesktopPath, fullPage: false });
    expect(fs.existsSync(snapshotDesktopPath)).toBe(true);
  });

  test('TEST-E2E-VOYAGE-08: Architecture temporelle des 3 phases (Préparer / Vivre / Raconter)', async ({ page }) => {
    // 1. Navigation vers le voyage existant
    await page.goto('/voyages/fdgb-3c3a92', { waitUntil: 'domcontentloaded' });

    // Contrôleur de phase présent
    const phaseController = page.locator('div[role="tablist"]');
    await expect(phaseController).toBeVisible();

    // Les 3 onglets temporels doivent être présents
    const prepareTab = page.locator('button[role="tab"]:has-text("Préparer")');
    const liveTab = page.locator('button[role="tab"]:has-text("Vivre")');
    const recountTab = page.locator('button[role="tab"]:has-text("Raconter")');

    await expect(prepareTab).toBeVisible();
    await expect(liveTab).toBeVisible();
    await expect(recountTab).toBeVisible();

    // Par défaut, le voyage futur est en phase Préparer
    await expect(prepareTab).toHaveAttribute('aria-selected', 'true');

    // 2. Bascule manuelle vers le mode Vivre
    await liveTab.click();
    await expect(page.locator('text=Cockpit Terrain · Mode Vivre')).toBeVisible();
    await expect(page.locator('text=Secours & Urgences')).toBeVisible();
    expect(page.url()).toContain('phase=live');

    // 3. Bascule manuelle vers la phase Raconter
    await recountTab.click();
    await expect(page.locator('text=Récits, Bilan & Partage de l’Aventure')).toBeVisible();
    expect(page.url()).toContain('phase=recount');

    // 4. Accès direct avec ?phase=live
    await page.goto('/voyages/fdgb-3c3a92?phase=live', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('text=Cockpit Terrain · Mode Vivre')).toBeVisible();
    await expect(liveTab).toHaveAttribute('aria-selected', 'true');
  });

});

