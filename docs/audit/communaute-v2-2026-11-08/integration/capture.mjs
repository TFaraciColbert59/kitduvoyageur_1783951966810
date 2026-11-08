/**
 * Recette d'intégration visuelle — Communauté v2 (`NEXT_PUBLIC_COMMUNAUTE_V2=true`).
 *
 * Prérequis :
 *   NEXT_PUBLIC_COMMUNAUTE_V2=true \
 *   NEXT_PUBLIC_SUPABASE_URL=https://fixture.supabase.co \
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY=fixture-anon-key \
 *   npm run build
 *   npm run start        # http://127.0.0.1:4028
 *
 * Puis :
 *   node docs/audit/communaute-v2-2026-11-08/integration/capture.mjs
 *   node .../capture.mjs --only explorer --tag run2
 *
 * Tout le réseau est simulé (`network.mjs`) : aucune requête réelle, aucune
 * donnée de production. Les captures 390×844 sont écrites dans `captures/`.
 * Les erreurs console/JS sont réunies dans `console-report.json` et les
 * scénarios en échec dans `_failures.json` (le script continue).
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { installFixtures, sessionCookieFor } from './network.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const CAPTURES = join(HERE, 'captures');

const args = process.argv.slice(2);
const argValue = (name, fallback) => {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};
const BASE_URL = argValue('--base', process.env.CV2_BASE_URL ?? 'http://127.0.0.1:4028');
const ONLY = argValue('--only', null);
const TAG = argValue('--tag', '');
const VIEWPORT = { width: 390, height: 844 };

mkdirSync(CAPTURES, { recursive: true });

const consoleEntries = [];
const failedResponses = [];
const failures = [];

function slug(name) {
  return `${name}${TAG ? `-${TAG}` : ''}`;
}

async function shot(page, name) {
  const path = join(CAPTURES, `${slug(name)}.png`);
  await page.screenshot({ path, animations: 'disabled' });
  console.log(`  📸 ${slug(name)}.png`);
  return path;
}

async function settle(page, ms = 500) {
  await page.waitForTimeout(ms);
}

/** Attend le premier locator visible parmi plusieurs (retourne null si aucun). */
async function firstVisible(page, candidates, timeout = 8000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    for (const candidate of candidates) {
      const locator = typeof candidate === 'string' ? page.locator(candidate) : candidate;
      try {
        const count = await locator.count();
        for (let index = 0; index < Math.min(count, 4); index += 1) {
          const item = locator.nth(index);
          if (await item.isVisible()) return item;
        }
      } catch {
        /* locator instable, on réessaie */
      }
    }
    await page.waitForTimeout(150);
  }
  return null;
}

async function clickAny(page, candidates, label) {
  const target = await firstVisible(page, candidates, 6000);
  if (!target) throw new Error(`introuvable: ${label}`);
  await target.click({ timeout: 4000 });
  return target;
}

async function newPage(browser, mode, initScript) {
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 1,
    locale: 'fr-FR',
    timezoneId: 'Europe/Paris',
    serviceWorkers: 'block',
    reducedMotion: 'no-preference',
    colorScheme: 'light',
  });
  await context.addCookies([sessionCookieFor(BASE_URL)]);
  if (initScript) await context.addInitScript(initScript);
  const page = await context.newPage();
  page.on('response', (response) => {
    if (response.status() >= 400) {
      failedResponses.push({
        scenario: page.__scenario ?? 'init',
        status: response.status(),
        url: response.url().slice(0, 200),
      });
    }
  });
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') {
      consoleEntries.push({ scenario: page.__scenario ?? 'init', type: message.type(), text: message.text() });
    }
  });
  page.on('pageerror', (error) => {
    consoleEntries.push({ scenario: page.__scenario ?? 'init', type: 'pageerror', text: String(error) });
  });
  await installFixtures(page, { mode });
  return { context, page };
}

async function gotoCommunaute(page) {
  await page.goto(`${BASE_URL}/communaute`, { waitUntil: 'domcontentloaded', timeout: 45000 });
  // Le fil v1 et la barre haute doivent être là pour ouvrir les tiroirs.
  await firstVisible(
    page,
    ['button[aria-label="Explorer et rechercher"]', 'button[aria-label*="Explorer"]', 'text=Explorer'],
    15000,
  );
  await settle(page, 900);
}

async function openExplorer(page) {
  await clickAny(
    page,
    [
      'button[aria-label="Explorer et rechercher"]',
      'button:has-text("Explorer")',
      'text=Explorer',
    ],
    'bouton Explorer',
  );
  const sheet = await firstVisible(
    page,
    ['[data-testid="cv2-sheet"]', '[data-testid="communaute-v2-explore"]', '.lkdv-cv2-sheet'],
    10000,
  );
  if (!sheet) throw new Error('tiroir Explorer non monté');
  await firstVisible(page, ['[data-testid="cv2-capsule"]', '.lkdv-cv2-capsule'], 6000);
  await settle(page, 900);
}

async function openCreate(page) {
  await clickAny(
    page,
    [
      'button[aria-label="Créer dans l’application"]',
      'button[aria-label*="Créer"]',
      'button:has-text("+")',
    ],
    'bouton Créer',
  );
  const sheet = await firstVisible(
    page,
    ['[data-testid="cv2-sheet"]', '[data-testid="communaute-v2-create"]', '.lkdv-cv2-sheet'],
    10000,
  );
  if (!sheet) throw new Error('tiroir Création non monté');
  await firstVisible(page, ['[data-testid="cv2-capsule"]', '.lkdv-cv2-capsule'], 6000);
  await settle(page, 900);
}

async function selectCapsuleTab(page, label, index) {
  const tab = await firstVisible(
    page,
    [
      `[data-testid="cv2-capsule"] [role="tab"][aria-label="${label}"]`,
      `[data-testid="cv2-capsule"] [role="tab"]:has-text("${label}")`,
      `[role="tab"][aria-label="${label}"]`,
      `[role="tab"]:has-text("${label}")`,
    ],
    5000,
  );
  if (!tab) throw new Error(`onglet capsule introuvable: ${label}`);
  if (index == null) {
    await tab.click();
  } else {
    const tabs = page.locator('[data-testid="cv2-capsule"] [role="tab"], .lkdv-cv2-capsule [role="tab"]');
    const count = await tabs.count();
    if (index < count) await tabs.nth(index).click();
    else await tab.click();
  }
  await settle(page, 800);
}

async function tryStep(page, label) {
  const button = await firstVisible(
    page,
    [
      `button:has-text("${label}")`,
      `[role="button"]:has-text("${label}")`,
      `.lkdv-cv2-footer button:has-text("${label}")`,
    ],
    3000,
  );
  if (!button) return false;
  await button.click();
  await settle(page, 500);
  return true;
}

async function scenario(browser, definition) {
  if (ONLY && !definition.id.startsWith(ONLY)) return;
  console.log(`\n▶ ${definition.id} (mode ${definition.mode ?? 'normal'})`);
  const { context, page } = await newPage(browser, definition.mode ?? 'normal', definition.init);
  page.__scenario = definition.id;
  try {
    await gotoCommunaute(page);
    if (definition.open === 'create') await openCreate(page);
    else await openExplorer(page);
    if (definition.prepare) await definition.prepare(page);
    await settle(page, definition.settleMs ?? 600);
    await shot(page, definition.id);
  } catch (error) {
    failures.push({ id: definition.id, error: String(error) });
    console.error(`  ✗ ${definition.id}: ${error}`);
    try {
      await shot(page, `${definition.id}-ECHEC`);
      const dump = join(CAPTURES, `${slug(definition.id)}-ECHEC.html`);
      writeFileSync(dump, await page.content(), 'utf8');
    } catch {
      /* page déjà fermée */
    }
  } finally {
    await context.close();
  }
}

async function pressLong(page, locator, ms = 620) {
  const box = await locator.boundingBox();
  if (!box) throw new Error('pas de boîte pour l’appui long');
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.waitForTimeout(ms);
  await page.mouse.up();
  await settle(page, 700);
}

const SCENARIOS = [
  // ── Explorer ───────────────────────────────────────────────────────────
  { id: 'explorer-carnets', open: 'explorer' },
  {
    id: 'explorer-carnets-tri',
    open: 'explorer',
    prepare: async (page) => {
      const button = await firstVisible(page, ['[data-testid="cv2-sort-button"]', 'button[aria-label="Trier"]'], 6000);
      if (!button) throw new Error('bouton de tri introuvable');
      await button.click();
      await firstVisible(page, ['[data-testid="cv2-sort-menu"]', '[role="menu"]'], 4000);
    },
  },
  {
    id: 'explorer-clubs',
    open: 'explorer',
    prepare: (page) => selectCapsuleTab(page, 'Clubs'),
  },
  {
    id: 'explorer-sorties',
    open: 'explorer',
    prepare: (page) => selectCapsuleTab(page, 'Sorties'),
  },
  {
    id: 'explorer-recherche',
    open: 'explorer',
    prepare: (page) => selectCapsuleTab(page, 'Recherche'),
  },
  {
    id: 'explorer-detail',
    open: 'explorer',
    prepare: async (page) => {
      await selectCapsuleTab(page, 'Clubs');
      const tile = await firstVisible(
        page,
        ['[data-testid="cv2-tile-club"]', '.lkdv-cv2-tile', '.lkdv-cv2-card'],
        6000,
      );
      if (!tile) throw new Error('aucune tuile club à ouvrir');
      await tile.click();
      await firstVisible(page, ['[data-testid="cv2-detail"]', '.lkdv-cv2-detail'], 5000);
      await settle(page, 700);
    },
  },
  {
    id: 'explorer-peek',
    open: 'explorer',
    prepare: async (page) => {
      await selectCapsuleTab(page, 'Clubs');
      const tile = await firstVisible(
        page,
        ['[data-testid="cv2-tile-club"]', '.lkdv-cv2-tile', '[data-testid="cv2-tile-carnet"]'],
        6000,
      );
      if (!tile) throw new Error('aucune tuile pour le peek');
      await pressLong(page, tile);
    },
  },
  { id: 'explorer-etat-vide', open: 'explorer', mode: 'empty' },
  { id: 'explorer-etat-erreur', open: 'explorer', mode: 'error' },
  {
    id: 'explorer-etat-chargement',
    open: 'explorer',
    mode: 'skeleton',
    settleMs: 200,
    prepare: async (page) => {
      // Ouvre le tiroir puis capture immédiatement le squelette (RPC en attente).
      await page.waitForTimeout(150);
    },
  },
  {
    id: 'explorer-ile',
    open: 'explorer',
    prepare: async (page) => {
      await selectCapsuleTab(page, 'Clubs');
      const join = await firstVisible(
        page,
        [
          '[data-testid="cv2-club-join"]',
          'button:has-text("Rejoindre")',
          'button[aria-label*="Rejoindre"]',
        ],
        4000,
      );
      if (!join) throw new Error('aucun bouton Rejoindre');
      await join.click();
      await firstVisible(page, ['[data-testid="cv2-island"]', '.lkdv-island-pill'], 4000);
    },
  },

  // ── Création ───────────────────────────────────────────────────────────
  { id: 'creation-publication', open: 'create' },
  {
    id: 'creation-story',
    open: 'create',
    prepare: (page) => selectCapsuleTab(page, 'Story'),
  },
  {
    id: 'creation-carnet',
    open: 'create',
    prepare: (page) => selectCapsuleTab(page, 'Carnet'),
  },
  {
    id: 'creation-sortie',
    open: 'create',
    prepare: (page) => selectCapsuleTab(page, 'Sortie'),
  },
  {
    id: 'creation-kit',
    open: 'create',
    prepare: (page) => selectCapsuleTab(page, 'Kit'),
  },
  {
    id: 'creation-club',
    open: 'create',
    prepare: (page) => selectCapsuleTab(page, 'Club'),
  },
  {
    id: 'creation-erreur',
    open: 'create',
    prepare: async (page) => {
      await tryStep(page, 'Suivant');
      await settle(page, 700);
    },
  },
  {
    id: 'creation-brouillon',
    open: 'create',
    // Seed AVANT montage : le moteur restaure le brouillon à l'ouverture.
    init: () => {
      const record = {
        version: 1,
        kind: 'post',
        updatedAt: Date.now(),
        values: {
          format: 'photo',
          audience: 'public',
          clubId: '',
          media: [],
          title: 'Traversée du Vercors',
          content: 'Brouillon de recette restauré après fermeture.',
          location: '',
          locationLat: null,
          locationLng: null,
          tags: [],
          mentions: [],
          clientRequestId: '00000000-0000-4000-8000-00000000draft',
        },
      };
      try {
        window.localStorage.setItem('lkdv.cv2-draft:post:v1', JSON.stringify(record));
      } catch {
        /* stockage indisponible */
      }
    },
    prepare: async (page) => {
      await firstVisible(
        page,
        ['.lkdv-cv2-draft', 'text=Brouillon restauré', 'text=Brouillon'],
        5000,
      );
    },
  },
];

async function main() {
  const browser = await chromium.launch({ headless: true });
  const selected = SCENARIOS.filter((scenario) => !ONLY || scenario.id.startsWith(ONLY));
  console.log(`Recette intégration v2 — ${selected.length} scénario(s) sur ${BASE_URL}`);
  for (const definition of selected) {
    // eslint-disable-next-line no-await-in-loop
    await scenario(browser, definition);
  }
  await browser.close();

  writeFileSync(join(HERE, 'console-report.json'), JSON.stringify(consoleEntries, null, 2), 'utf8');
  writeFileSync(join(HERE, 'network-report.json'), JSON.stringify(failedResponses, null, 2), 'utf8');
  writeFileSync(join(HERE, '_failures.json'), JSON.stringify(failures, null, 2), 'utf8');
  console.log(`\nCaptures : ${CAPTURES}`);
  console.log(`Erreurs console : ${consoleEntries.length} (console-report.json)`);
  console.log(`Scénarios en échec : ${failures.length} (_failures.json)`);
  if (failures.length) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
