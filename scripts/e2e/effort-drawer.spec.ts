import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * LOT P4 — Tests E2E Playwright + axe-core + navigation clavier + état vide « — »
 * + viewports mobile 360px et 390px pour l'interface « Empreinte & Effort ».
 */

const MOBILE_VIEWPORTS = [
  { label: 'Android Compact 360px', width: 360, height: 800 },
  { label: 'iPhone 390px', width: 390, height: 844 },
] as const;

const FORBIDDEN_WORDS = [
  /\btier\b/i,
  /\brank\b/i,
  /\bgrade\b/i,
  /\bleaderboard\b/i,
  /\bpalier\b/i,
  /\bclassement\b/i,
  /\brang\b/i,
  /\bpercentile\b/i,
];

const MOCK_BOOTSTRAP_READY = {
  authenticated: true,
  profile: { name: 'Camille', handle: 'camille_rando', trustScore: 91 },
  stats: { outings: 14, km: 218.5, dplus: 11400 },
  badges: [],
  gearItems: [{ id: 'g1', name: 'Bâtons carbone' }],
  kits: [{ id: 'k1', name: 'Kit Alpin 3 saisons' }],
  followers: [{ id: 'f1' }, { id: 'f2' }],
  species: [{ id: 's1' }],
  trust: { verified: true, active: 1, onTimeRate: 100, rating: 4.9 },
  effortState: 'ready',
  effortDiagnosticId: 'DIAG-E2E-P4-001',
  effortCachedAt: '2026-11-20T09:30:00.000Z',
  lastOutingEffort: {
    title: 'Traversée du Pic de Bure',
    dateLabel: '18 nov. 2026',
    scoreVersion: 'effort-score-v1',
    snapshotHash: 'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90',
    iea: 64,
    erp: 58,
    eFlatKm: 27.4,
    rawDose: 142.8,
    interval: { p10: 59, p50: 64, p90: 70 },
    technicite: 4,
    risque: {
      level: 'moderate',
      score: 48,
      dimensions: {
        exposure: 3,
        isolation: 3,
        weatherHazard: 2,
        terrainHazard: 3,
        turnaroundMarginS: 4500,
      },
      factors: ['Vigilance refroidissement : pause coupe-vent conseillée sur la crête sommitale'],
    },
    dataLevel: 'complet',
    actionPhrase:
      'Prévois 1,8 L d’eau, les bâtons pour la descente du pierrier et un coupe-vent accessible au col.',
    shapley: {
      baseDistance: 22.0,
      ascent: 16.4,
      descent: 4.1,
      packLoad: 7.2,
      surfaceAndSnow: 6.5,
      thermalAndWind: 3.8,
      altitude: 2.4,
      fatigue: 1.6,
      total: 42.0,
    },
    multipliers: {
      load: 1.21,
      terrainEta: 1.35,
      thermal: 1.06,
      altitude: 1.09,
      fatigue: 1.05,
      descentEccentric: 1.12,
    },
    elevationSegments: [
      {
        segmentId: 1,
        label: 'Tronçon 1 · Approche forestière',
        distanceKm: 4.2,
        altitudeM: 1450,
        slopePct: 8.5,
        surface: 'dirt',
        intensityTone: 'good',
        intensityLabel: 'Modéré',
      },
      {
        segmentId: 2,
        label: 'Tronçon 2 · Combe de Bure',
        distanceKm: 3.8,
        altitudeM: 2150,
        slopePct: 18.4,
        surface: 'scree',
        intensityTone: 'warn',
        intensityLabel: 'Soutenu',
      },
      {
        segmentId: 3,
        label: 'Tronçon 3 · Plateau sommital venté',
        distanceKm: 2.5,
        altitudeM: 2709,
        slopePct: 11.2,
        surface: 'rock',
        intensityTone: 'bad',
        intensityLabel: 'Exigeant',
      },
    ],
    evidence: [
      {
        value: 2709,
        unit: 'm',
        source: 'IGN Géoplateforme RGE ALTI',
        kind: 'measured',
        quality: 0.98,
        capturedAt: '2026-11-18T14:20:00.000Z',
        licenceSnapshot: 'Licence Ouverte Etalab 2.0',
        modelVersion: 'effort-score-v1',
      },
    ],
  },
  nextPlannedOutingEffort: {
    title: 'Boucle des Lacs de Crupillouse',
    departureLabel: 'Sam. 22 nov. · 07:30',
    iea: 52,
    erp: 49,
    eFlatKm: 21.0,
    interval: { p10: 46, p50: 52, p90: 58 },
    technicite: 3,
    dataLevel: 'cardio',
    actionPhrase: 'Départ conseillé avant 07:30 pour conserver 1 h 25 de marge avant le crépuscule.',
  },
  effortGroupSummary: {
    mode: 'regroupement',
    memberCount: 4,
    groupPaceKmH: 3.6,
    collectiveIea: 55,
    collectiveTechnicite: 3,
    actionPhrase: 'Organiser deux pauses coupe-vent de 4 min aux cols et répartir 2,0 kg d’eau commune.',
    twilightMarginMin: 85,
    regroupWaitMin: 11,
    coolingAlertRegroupement:
      'Vigilance refroidissement d’attente : attente estimée 11 min aux points de regroupement — veste coupe-vent dès l’arrêt conseillée.',
    coolingAlertCompact:
      'Mode Compact : allure calée sur le collectif, attente réduite à 2 min — maintien thermique régulier.',
    pauseEveryMinutes: 50,
    redistributionTransfers: 2,
    redistributionWeightKg: 2.0,
    cohesionLabel: 'Écart modéré',
    heatmapRows: [
      {
        memberLabel: 'Membre A',
        cells: [
          { segmentId: 1, segmentLabel: 'Tronçon 1', tone: 'good', textLabel: 'Confort · Allure fluide' },
          { segmentId: 2, segmentLabel: 'Tronçon 2', tone: 'warn', textLabel: 'Soutenu · Attente 4 min' },
        ],
      },
      {
        memberLabel: 'Membre B',
        cells: [
          { segmentId: 1, segmentLabel: 'Tronçon 1', tone: 'good', textLabel: 'Confort · Allure fluide' },
          { segmentId: 2, segmentLabel: 'Tronçon 2', tone: 'bad', textLabel: 'Vigilance · Pause col conseillée' },
        ],
      },
    ],
  },
  effortFatigueSummary: {
    status: 'available',
    formLabel: 'Charge productive',
    fitnessCtl: 44,
    fatigueAtl: 51,
    formTsb: -7,
    weeklyLoad: 320,
    activeDaysCount: 16,
    descriptiveGuidance:
      'Ta charge des 7 derniers jours est légèrement supérieure à ton habitude sur 6 semaines : privilégie une allure régulière dès le départ.',
    progressionHref: '/hub?panel=points',
  },
  effortPrivacySummary: {
    dataLevel: 'complet',
    evidence: [
      {
        value: 2709,
        unit: 'm',
        source: 'IGN Géoplateforme RGE ALTI',
        kind: 'measured',
        quality: 0.98,
        capturedAt: '2026-11-18T14:20:00.000Z',
        licenceSnapshot: 'Licence Ouverte Etalab 2.0',
        modelVersion: 'effort-score-v1',
      },
    ],
    consents: [
      {
        purpose: 'personal_scoring',
        title: 'Calcul personnel d’effort (IEA & ERP)',
        description: 'Calcul bioénergétique personnel',
        granted: true,
      },
      {
        purpose: 'wearable_sync',
        title: 'Synchronisation capteurs & montres (Cardio)',
        description: 'Fusion fréquence cardiaque',
        granted: true,
      },
      {
        purpose: 'group_simulation',
        title: 'Simulation collective de sortie de groupe',
        description: 'Allure collective sans biométrie',
        granted: false,
      },
      {
        purpose: 'anonymized_calibration',
        title: 'Calibration anonymisée des sentiers',
        description: 'Contribution agrégée k-anonyme',
        granted: false,
      },
    ],
  },
  effortExpertSummary: {
    scoreVersion: 'effort-score-v1',
    snapshotHash: 'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90',
    iea: 64,
    erp: 58,
    eFlatKm: 27.4,
    rawDose: 142.8,
    multipliers: {
      load: 1.21,
      terrainEta: 1.35,
      thermal: 1.06,
      altitude: 1.09,
      fatigue: 1.05,
      descentEccentric: 1.12,
    },
    ablations: [
      { id: 'no-pack', label: 'Sans charge sac', iea: 56.8, deltaPts: -7.2 },
    ],
    rawSegments: [
      {
        segmentId: 1,
        distanceM: 4200,
        altitudeM: 1450,
        slopePct: 8.5,
        surface: 'dirt',
        eta: 1.1,
        powerW: 410,
        doseDeff: 48.2,
      },
    ],
  },
};

const MOCK_BOOTSTRAP_EMPTY = {
  authenticated: true,
  profile: { name: 'Camille', handle: 'camille_rando' },
  stats: { outings: 0, km: 0, dplus: 0 },
  sealUnavailable: true,
  lastOutingEffort: null,
  nextPlannedOutingEffort: null,
};

async function assertZeroAxeViolations(page: Page) {
  // Attend la fin déterministe des animations d'entrée CSS (.lkdv-overlay-sheet opacity 0.65 -> 1)
  // pour éviter tout calcul de contraste axe-core pendant la transition d'opacité.
  await page.evaluate(async () => {
    const roots = Array.from(document.querySelectorAll('.lkdv-compte-overlay, .lkdv-overlay-sheet'));
    const animations = roots.flatMap((el) =>
      typeof el.getAnimations === 'function' ? el.getAnimations({ subtree: true }) : []
    );
    await Promise.all(animations.map((anim) => anim.finished.catch(() => undefined)));
  });
  await page.waitForFunction(() => {
    const sheets = Array.from(document.querySelectorAll<HTMLElement>('.lkdv-overlay-sheet'));
    return sheets.length > 0 && sheets.every((el) => Number(getComputedStyle(el).opacity) >= 0.99);
  });

  const results = await new AxeBuilder({ page })
    .include('.lkdv-compte-overlay')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  const blocking = results.violations.filter(
    (v) => v.impact === 'critical' || v.impact === 'serious'
  );
  expect(
    blocking,
    `Violations axe-core détectées : ${JSON.stringify(blocking.map((v) => ({ id: v.id, nodes: v.nodes.length })))}`
  ).toEqual([]);
}

async function openSealOnCompte(page: Page, payload: unknown) {
  await page.route('**/api/compte/bootstrap*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(payload),
    });
  });

  await page.goto('/compte', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(
    () => typeof (window as unknown as { __lkdvOpenSeal?: unknown }).__lkdvOpenSeal === 'function',
    undefined,
    { timeout: 15_000 }
  );
  const sealDialog = page.getByRole('dialog', { name: 'Empreinte & Effort' });
  await expect(async () => {
    await page.evaluate(() => {
      (window as unknown as { __lkdvOpenSeal?: () => void }).__lkdvOpenSeal?.();
    });
    await expect(sealDialog).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 15_000, intervals: [300, 600, 1000] });
  await expect(page.getByRole('heading', { name: 'Empreinte & Effort' })).toBeVisible();
}

for (const vp of MOBILE_VIEWPORTS) {
  test.describe(`Empreinte & Effort — ${vp.label} (${vp.width}×${vp.height})`, { tag: '@local-web' }, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test.beforeEach(async ({ context, baseURL }) => {
      const origin = baseURL || 'http://localhost:4028';
      await context.addCookies([
        {
          name: 'sb-local-auth-token',
          value: 'e2e-effort-drawer-session',
          url: origin,
        },
      ]);
      await context.addInitScript(() => {
        window.localStorage.setItem(
          'lkdv_cookie_consent',
          JSON.stringify({ necessary: true, analytics: false, marketing: false, version: '1' })
        );
      });
    });

    test(`Niveau 0, Niveau 1 et Niveau 2 : axe-core, navigation clavier, vocabulaire et absence de débordement sur ${vp.width}px`, async ({
      page,
    }) => {
      await openSealOnCompte(page, MOCK_BOOTSTRAP_READY);

      // Audit axe-core Niveau 0
      await assertZeroAxeViolations(page);

      // Vérification d'absence de débordement horizontal sur 360px / 390px
      const sealDialog = page.getByRole('dialog', { name: 'Empreinte & Effort' });
      const dialogBox = await sealDialog.boundingBox();
      expect(dialogBox).not.toBeNull();
      expect(dialogBox!.width).toBeLessThanOrEqual(vp.width);
      const horizontalOverflow = await sealDialog.evaluate((el) => {
        const body = el.querySelector<HTMLElement>('.lkdv-overlay-body') ?? el;
        return body.scrollWidth - body.clientWidth;
      });
      expect(horizontalOverflow).toBeLessThanOrEqual(1);

      // Navigation clavier Tab / Shift+Tab : le focus reste piégé dans le dialogue
      await page.keyboard.press('Tab');
      const focusInsideAfterTab = await page.evaluate(() =>
        Boolean(document.activeElement?.closest('.lkdv-compte-overlay'))
      );
      expect(focusInsideAfterTab).toBe(true);
      await page.keyboard.press('Shift+Tab');
      const focusInsideAfterShiftTab = await page.evaluate(() =>
        Boolean(document.activeElement?.closest('.lkdv-compte-overlay'))
      );
      expect(focusInsideAfterShiftTab).toBe(true);

      // Vérification du vocabulaire et séparation Technicité / Risque
      await expect(page.getByTestId('effort-last-data-level')).toHaveText(
        'Niveau de données : Complet'
      );
      await expect(
        page.getByRole('region', { name: /Technicité du parcours/i })
      ).toContainText('4 / 5');
      await expect(
        page.getByRole('region', { name: /Vigilance terrain/i })
      ).toContainText('Vigilance refroidissement');

      const level0Text = (await page.locator('.lkdv-compte-overlay').textContent()) ?? '';
      for (const forbidden of FORBIDDEN_WORDS) {
        expect(level0Text).not.toMatch(forbidden);
      }

      // Ouverture Niveau 1 — Pourquoi ce score ? + audit axe-core + Escape clavier
      await page.getByTestId('open-subdrawer-effort-why').click();
      await expect(page.getByRole('heading', { name: 'Pourquoi ce score ?' })).toBeVisible();
      await expect(page.getByTestId('elevation-accessibility-layer')).toHaveAttribute(
        'data-accessibility-layer',
        'true'
      );
      await expect(page.getByTestId('elevation-textual-equivalent')).toBeVisible();
      await assertZeroAxeViolations(page);
      await page.keyboard.press('Escape');
      await expect(page.getByRole('heading', { name: 'Empreinte & Effort' })).toBeVisible();

      // Ouverture Niveau 1 — Sortie de groupe + heatmap WCAG 1.4.11 + audit axe-core
      await page.getByTestId('open-subdrawer-effort-group').click();
      await expect(page.getByRole('heading', { name: 'Sortie de groupe' })).toBeVisible();
      const cells = page.getByTestId('group-heatmap-cell');
      expect(await cells.count()).toBeGreaterThan(0);
      await assertZeroAxeViolations(page);
      await page.keyboard.press('Escape');
      await expect(page.getByRole('heading', { name: 'Empreinte & Effort' })).toBeVisible();

      // Ouverture Niveau 1 — Forme & fatigue + audit axe-core + Escape clavier
      await page.getByTestId('open-subdrawer-effort-fatigue').click();
      await expect(page.getByRole('heading', { name: 'Forme & fatigue' })).toBeVisible();
      await assertZeroAxeViolations(page);
      await page.keyboard.press('Escape');
      await expect(page.getByRole('heading', { name: 'Empreinte & Effort' })).toBeVisible();

      // Ouverture Niveau 1 — Données, confiance & vie privée + confirmation révocation + audit axe-core
      await page.getByTestId('open-subdrawer-effort-privacy').click();
      await expect(
        page.getByRole('heading', { name: 'Données, confiance & vie privée' })
      ).toBeVisible();
      await assertZeroAxeViolations(page);
      await page.keyboard.press('Escape');
      await expect(page.getByRole('heading', { name: 'Empreinte & Effort' })).toBeVisible();

      // Ouverture Niveau 2 — Mode expert + <figure role="group"> + <figcaption> + audit axe-core
      await page.getByTestId('open-subdrawer-effort-expert').click();
      await expect(page.getByRole('heading', { name: 'Mode expert' })).toBeVisible();
      await expect(page.getByTestId('expert-raw-figure')).toHaveAttribute('role', 'group');
      await assertZeroAxeViolations(page);

      // Test du dépilement Android backButton (lkdv:backButton) : ferme Mode expert vers Niveau 0
      await page.evaluate(() => {
        window.dispatchEvent(new CustomEvent('lkdv:backButton', { cancelable: true }));
      });
      await expect(page.getByRole('heading', { name: 'Empreinte & Effort' })).toBeVisible();
    });

    test(`État vide / indisponible sur ${vp.width}px : affiche « — » et « non évalué » sans aucun zéro trompeur`, async ({
      page,
    }) => {
      await openSealOnCompte(page, MOCK_BOOTSTRAP_EMPTY);

      await expect(page.getByTestId('effort-last-iea')).toHaveText('— (non évalué)');
      await expect(page.getByTestId('effort-last-interval')).toHaveText('—');
      await expect(page.getByTestId('effort-last-erp')).toHaveText('— (non évalué)');
      await expect(page.getByTestId('effort-last-eflat')).toHaveText('—');
      await expect(page.getByTestId('effort-last-data-level')).toHaveText(
        'Niveau de données : non évalué'
      );

      await assertZeroAxeViolations(page);
    });
  });
}
