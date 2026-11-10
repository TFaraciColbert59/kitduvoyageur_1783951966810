import { test, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve as resolvePath } from 'node:path';

import {
  freezeClock,
  installCommunityV2Mock,
  waitForHydration,
} from '../../../../tests/e2e/communaute-v2.fixtures';
import { diffImages } from '../../../../tests/fidelity/lib/diff';
import { playSteps } from '../../../../tests/fidelity/lib/steps';
import type { MockOptions, Step } from '../../../../tests/fidelity/lib/types';

/**
 * États de finition des tiroirs Communauté v2 — captures app + maquette dans le
 * même état, jamais capturés avant : Création vide / chargement / erreur,
 * thème sombre de chaque tiroir, 360 et 430 au-delà de l'étape 1, invité (toast).
 *
 * Réutilise (sans les modifier) `tests/fidelity/lib` (diff pixel, étapes
 * déclaratives). Sortie : `captures-finition/<taille>-<thème>/<id>.{app,maquette,diff}.png`
 * et `<id>.json` (ratio de pixels différents, hors masques de données).
 *
 * Usage (build fixtures servi sur 4029 avec `tests/fidelity/server/fixture-supabase.cjs`) :
 *   FINITION_BASE=http://127.0.0.1:4029 npx playwright test \
 *     --config=docs/audit/communaute-v2-2026-11-08/ecarts-maquette/playwright.finition.config.ts
 */

const REPO = resolvePath(process.cwd());
const OUT = join(REPO, 'docs/audit/communaute-v2-2026-11-08/ecarts-maquette/captures-finition');
const MAQUETTE = join(REPO, 'handoff/communaute-v2/annexes/maquette-communaute.html');
const BASE = process.env.FINITION_BASE ?? 'http://127.0.0.1:4029';
const CONSENT = JSON.stringify({ necessary: true, analytics: false, marketing: false, version: '1' });
const ONLY = process.env.FINITION_ONLY ? new RegExp(process.env.FINITION_ONLY) : null;

type Size = { width: number; height: number };
const S390: Size = { width: 390, height: 844 };
const S360: Size = { width: 360, height: 780 };
const S430: Size = { width: 430, height: 932 };

interface Scene {
  id: string;
  sizes: Size[];
  themes: Array<'clair' | 'sombre'>;
  session?: 'member' | 'anonymous';
  mock?: MockOptions;
  /** Brouillons posés avant le chargement (clé = type, valeur = {values, step}). */
  drafts?: Record<string, { values: Record<string, unknown>; step: number }>;
  appSteps: Step[];
  maqHash?: string;
  maqSteps?: Step[];
  /** Point que la maquette ne sait pas rendre : consigné, jamais maquillé. */
  maquetteAbsente?: string;
}

const MASKS = {
  app: ['.lkdv-cv2-cover', '.lkdv-cv2-avatars', '.lkdv-cv2-title', '.lkdv-cv2-meta', '.lkdv-cv2-visa'],
  maquette: ['#phone .ct-cover', '#phone .tvs', '#phone .ct-t', '#phone .ct-m', '#phone .visa'],
};

const TABLIST = '[role="tablist"][aria-label="Volets de l’explorateur"]';
const openExplorer: Step[] = [
  { click: { role: 'button', name: 'Explorer et rechercher', exact: true } },
  { waitFor: { css: '[data-testid="communaute-v2-explore"]' } },
  { wait: 900 },
];
const openSearch: Step[] = [
  { click: { role: 'button', name: 'Rechercher dans la communauté', exact: true } },
  { waitFor: { css: '[data-testid="communaute-v2-explore"]' } },
  { wait: 900 },
];
const volet = (name: string): Step => ({ click: { role: 'tab', name, within: TABLIST } });
const panel = (selector: string): Step => ({ eval: `document.querySelector('${selector}').click()` });
const openCreate = (label: string): Step[] => [
  { click: { role: 'button', name: 'Créer dans l’application', exact: true } },
  { waitFor: { css: '[data-testid="communaute-v2-create"]' } },
  { wait: 900 },
  ...(label === 'Publication'
    ? []
    : [{ click: { role: 'tab', name: label, within: '[role="tablist"][aria-label="Type de création"]' } } as Step, { wait: 700 } as Step]),
];

// ── Brouillons minimaux (étapes ≥ 2) ──────────────────────────────────────
const media = {
  id: 'm1',
  name: 'photo.jpg',
  type: 'image/jpeg',
  size: 120,
  previewUrl: '',
  url: 'https://example.test/photo.jpg',
  alt: '',
  cover: true,
  status: 'uploaded',
  progress: 100,
  storageBucket: 'carnet-media',
  storagePath: 'u/photo.jpg',
  crop: 'original',
};
const KINDS = [
  { type: 'post', label: 'Publication', hash: 'creer-post', steps: 3, values: { content: 'Belle sortie au lac Blanc ce week-end.' } },
  { type: 'story', label: 'Story', hash: 'creer-story', steps: 3, values: { media: [{ ...media, storageBucket: 'stories-private', crop: '9:16' }] } },
  {
    type: 'carnet',
    label: 'Carnet',
    hash: 'creer-carnet',
    steps: 4,
    values: { title: 'Tour des Écrins', destination: 'Hautes-Alpes', startDate: '2026-12-01', endDate: '2026-12-03', nbJours: 3 },
  },
  {
    type: 'sortie',
    label: 'Sortie',
    hash: 'creer-sortie',
    steps: 4,
    values: { title: 'Lac Blanc au lever du jour', location: 'Chamonix', date: '2027-01-16', startTime: '08:00' },
  },
  {
    type: 'kit',
    label: 'Kit',
    hash: 'creer-kit',
    steps: 3,
    values: {
      name: 'Kit bivouac',
      items: [
        { id: 'a', name: 'Tente 2 places', category: 'Abri', weightG: 1380, quantity: 1, productId: null, ownershipId: null, isChecked: false },
        { id: 'b', name: 'Duvet 0 °C', category: 'Abri', weightG: 780, quantity: 1, productId: null, ownershipId: null, isChecked: false },
      ],
    },
  },
  { type: 'club', label: 'Club', hash: 'creer-club', steps: 4, values: { name: 'Cordée du Vercors', slug: 'cordee-du-vercors', activities: ['Randonnée'] } },
] as const;

const scenes: Scene[] = [];

// 1. 360 et 430 au-delà de l'étape 1 (étapes 2..N de chacun des 6 types).
for (const kind of KINDS) {
  for (let step = 1; step < kind.steps; step += 1) {
    scenes.push({
      id: `creation-${kind.type}-etape${step + 1}`,
      sizes: [S360, S430],
      themes: ['clair'],
      drafts: { [kind.type]: { values: kind.values, step } },
      appSteps: openCreate(kind.label),
      maqHash: kind.hash,
      maqSteps: [{ eval: `LK.CRE.goStep(${step})` }, { wait: 700 }],
    });
  }
}

// 2. Thème sombre de chaque tiroir (390 × 844) — la maquette n'a pas de rendu
//    sombre du tiroir (carte claire forcée) : la référence reste la maquette.
const DARK: Array<Pick<Scene, 'id' | 'appSteps' | 'maqHash' | 'maqSteps'>> = [
  { id: 'sombre-explorer-carnets', appSteps: [...openExplorer, volet('Carnets'), { wait: 600 }], maqHash: 'explorer-carnets' },
  { id: 'sombre-explorer-clubs', appSteps: [...openExplorer, volet('Clubs'), { wait: 600 }], maqHash: 'explorer-clubs' },
  { id: 'sombre-explorer-sorties', appSteps: [...openExplorer, volet('Sorties'), { wait: 600 }], maqHash: 'explorer-sorties' },
  { id: 'sombre-recherche', appSteps: openSearch, maqHash: 'explorer-search' },
  {
    id: 'sombre-peek-carnet',
    appSteps: [
      ...openExplorer,
      volet('Carnets'),
      { waitFor: { css: '[data-testid="cv2-tile-carnet"]' } },
      { longPress: { css: '[data-testid="cv2-tile-carnet"]' } },
      { waitFor: { role: 'dialog', name: 'Aperçu' } },
      { wait: 500 },
    ],
    maqHash: 'explorer-carnets',
    maqSteps: [{ longPress: { css: '#phone .ct' } }, { wait: 600 }],
  },
  {
    id: 'sombre-detail-club',
    appSteps: [
      ...openExplorer,
      volet('Clubs'),
      { click: { css: '[data-testid="cv2-tile-club"] a, [data-testid="cv2-tile-club"]' } },
      { waitFor: { css: '[data-testid="cv2-detail"]' } },
      { wait: 900 },
    ],
    maqHash: 'explorer-clubs',
    maqSteps: [{ click: { css: '#phone .kt .kt-link' } }, { wait: 700 }],
  },
  {
    id: 'sombre-detail-sortie',
    appSteps: [
      ...openExplorer,
      volet('Sorties'),
      { click: { css: '[data-testid="cv2-tile-sortie"] a, [data-testid="cv2-tile-sortie"]' } },
      { waitFor: { css: '[data-testid="cv2-detail"]' } },
      { wait: 900 },
    ],
    maqHash: 'explorer-sorties',
    maqSteps: [{ click: { css: '#phone .tk a, #phone .tk' } }, { wait: 700 }],
  },
  ...KINDS.map((kind) => ({
    id: `sombre-creation-${kind.type}`,
    appSteps: openCreate(kind.label),
    maqHash: kind.hash,
  })),
];
for (const entry of DARK) scenes.push({ ...entry, sizes: [S390], themes: ['sombre'] });

// 3. Création : vide (validation), chargement, erreur.
scenes.push(
  {
    id: 'creation-vide-validation',
    sizes: [S390],
    themes: ['clair'],
    appSteps: [...openCreate('Publication'), { click: { role: 'button', name: 'Suivant' } }, { wait: 500 }, { click: { role: 'button', name: 'Suivant' } }, { wait: 700 }],
    maqHash: 'creer-post',
    maqSteps: [
      { eval: `document.querySelector('[data-a="cr-next"]').click()` },
      { wait: 600 },
      { eval: `document.querySelector('[data-a="cr-next"]').click()` },
      { wait: 700 },
    ],
  },
  {
    id: 'creation-chargement-kit',
    sizes: [S390],
    themes: ['clair'],
    mock: { latencyMs: 15_000 },
    appSteps: openCreate('Kit'),
    maqHash: 'creer-kit',
  },
  {
    id: 'creation-erreur-envoi',
    sizes: [S390],
    themes: ['clair'],
    mock: { failRpcs: ['create_community_post'] },
    drafts: { post: { values: { content: 'Belle sortie au lac Blanc ce week-end.' }, step: 2 } },
    appSteps: [...openCreate('Publication'), { click: { role: 'button', name: /Publier|Envoyer|Créer/ as unknown as string } }, { wait: 1500 }],
    maqHash: 'creer-post',
    maquetteAbsente: 'la maquette ne simule l’échec d’envoi que par son panneau de démo, sans état propre à comparer',
  },
);

// 4. Invité : lecture seule, pilule de session, toast sur un geste interdit.
scenes.push(
  {
    id: 'invite-creation-post',
    sizes: [S390],
    themes: ['clair'],
    session: 'anonymous',
    // Recette e2e 8c : en invité le tiroir de Création ne s'ouvre pas, `requireAuth`
    // redirige vers l'inscription avec un toast d'invitation. On capture ce toast.
    appSteps: [{ click: { role: 'button', name: 'Créer dans l’application', exact: true } }, { wait: 1800 }],
    maqHash: 'creer-post',
    maqSteps: [panel('[data-p="role"][data-v="g"]'), { wait: 500 }],
  },
  {
    id: 'invite-toast-jaime',
    sizes: [S390],
    themes: ['clair'],
    session: 'anonymous',
    appSteps: [
      ...openExplorer,
      volet('Carnets'),
      { waitFor: { css: '[data-testid="cv2-tile-carnet"]' } },
      { click: { css: '[data-testid="cv2-tile-carnet"] button[aria-pressed]' } },
      { wait: 600 },
    ],
    maqHash: 'explorer-carnets',
    maqSteps: [panel('[data-p="role"][data-v="g"]'), { wait: 500 }, { click: { css: '#phone [data-a="clike"]' } }, { wait: 600 }],
  },
);

async function newContext(browser: Browser, size: Size, scheme: 'light' | 'dark'): Promise<BrowserContext> {
  return browser.newContext({
    viewport: size,
    colorScheme: scheme,
    deviceScaleFactor: 1,
    locale: 'fr-FR',
    timezoneId: 'Europe/Paris',
    serviceWorkers: 'block',
  });
}

for (const scene of scenes.filter((entry) => !ONLY || ONLY.test(entry.id))) {
  for (const size of scene.sizes) {
    for (const theme of scene.themes) {
      const project = `${size.width}x${size.height}-${theme}`;
      test(`${scene.id} · ${project}`, async ({ browser }) => {
        const dir = join(OUT, project);
        mkdirSync(dir, { recursive: true });
        const scheme = theme === 'sombre' ? 'dark' : 'light';
        const record: Record<string, unknown> = { id: scene.id, project };
        const appCtx = await newContext(browser, size, scheme);
        const maqCtx = await newContext(browser, size, scheme);
        try {
          const app = await appCtx.newPage();
          await installCommunityV2Mock(app, { role: scene.session ?? 'member', appOrigin: BASE, ...scene.mock });
          await app.addInitScript(
            ([consent, drafts]) => {
              localStorage.setItem('lkdv_cookie_consent', consent as string);
              for (const [kind, draft] of Object.entries(drafts as Record<string, { values: unknown; step: number }>)) {
                localStorage.setItem(
                  `lkdv.cv2-draft:${kind}:v1`,
                  JSON.stringify({ version: 1, kind, updatedAt: Date.now(), values: draft.values, step: draft.step }),
                );
              }
            },
            [CONSENT, scene.drafts ?? {}] as const,
          );
          await freezeClock(app);
          await app.goto(`${BASE}/communaute`, { waitUntil: 'domcontentloaded' });
          const hydrate = 'button[aria-label="Explorer et rechercher"]';
          await app.locator(hydrate).first().waitFor({ state: 'visible', timeout: 30_000 });
          await waitForHydration(app, hydrate);
          await playSteps(app, scene.appSteps, 'app');
          await app.waitForTimeout(700);
          const appPng = await app.screenshot({ animations: 'disabled', caret: 'hide' });
          writeFileSync(join(dir, `${scene.id}.app.png`), appPng);

          if (scene.maquetteAbsente) {
            writeFileSync(join(dir, `${scene.id}.json`), JSON.stringify({ ...record, maquette: 'absente', raison: scene.maquetteAbsente }, null, 2));
            return;
          }
          const maq = await maqCtx.newPage();
          await maq.route(/^https?:/, (route) => route.abort());
          await maq.goto(`file://${MAQUETTE}${scene.maqHash ? `#${scene.maqHash}` : ''}`, { waitUntil: 'load' });
          await maq.waitForTimeout(1_800);
          await playSteps(maq, scene.maqSteps ?? [], 'maquette');
          await maq.waitForTimeout(900);
          const maqPng = await maq.screenshot({ animations: 'disabled', caret: 'hide' });
          writeFileSync(join(dir, `${scene.id}.maquette.png`), maqPng);
          const rects = async (page: Page, sels: string[]) =>
            page.evaluate((list) => {
              const out: Array<{ x: number; y: number; w: number; h: number }> = [];
              for (const sel of list) {
                document.querySelectorAll(sel).forEach((el) => {
                  const r = el.getBoundingClientRect();
                  if (r.width > 0 && r.height > 0) out.push({ x: r.left, y: r.top, w: r.width, h: r.height });
                });
              }
              return out;
            }, sels);
          const masks = [...(await rects(app, MASKS.app)), ...(await rects(maq, MASKS.maquette))];
          const outcome = diffImages(appPng, maqPng, masks);
          writeFileSync(join(dir, `${scene.id}.diff.png`), outcome.diffPng);
          record.ratio = Math.round(outcome.ratio * 10000) / 10000;
          record.diffPixels = outcome.diffPixels;
          writeFileSync(join(dir, `${scene.id}.json`), JSON.stringify(record, null, 2));
        } catch (error) {
          record.erreur = String(error).split('\n')[0].slice(0, 300);
          writeFileSync(join(dir, `${scene.id}.json`), JSON.stringify(record, null, 2));
        } finally {
          await appCtx.close();
          await maqCtx.close();
        }
      });
    }
  }
}

// `Browser` est importé pour le typage de newContext ; `Page` pour `rects`.
void (null as unknown as Browser);
