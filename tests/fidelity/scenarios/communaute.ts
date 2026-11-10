import type { FidelityRole, MeasureSpec, MockOptions, Scenario, Step } from '../lib/types';
import { CHROME_MASKS, GLASS, MAQUETTE_COMMUNAUTE, measure } from './common';

/**
 * Communauté v2 (`/communaute`) contre `maquette-communaute.html`.
 *
 * Recettes d'accès tirées de
 * `docs/audit/communaute-v2-2026-11-08/ecarts-maquette/capture-all.spec.ts`
 * (app, données simulées par `tests/e2e/communaute-v2.fixtures.ts`) et des
 * deep links de la maquette (`#explorer-<volet>`, `#creer-<type>`) et de son
 * panneau de démo (`[data-p="st-load|st-empty|st-err"]`, `[data-p="role"]`).
 */

const APP_FRAME = '.lkdv-communaute-v2';
const APP_FRAME_WIDE = '.lkdv-feed-column';
const MAQ_FRAME = '#phone';
const TABLIST = '[role="tablist"][aria-label="Volets de l’explorateur"]';

/** Données qui diffèrent légitimement (textes, couvertures, avatars des jeux d'exemple). */
const DATA_MASKS = {
  app: [
    '.lkdv-cv2-cover',
    '.lkdv-cv2-avatars',
    '.lkdv-cv2-title',
    '.lkdv-cv2-meta',
    '.lkdv-cv2-visa',
  ],
  maquette: ['#phone .ct-cover', '#phone .tvs', '#phone .ct-t', '#phone .ct-m', '#phone .visa'],
};

/**
 * Fond neutralisé derrière le tiroir (voir `lib/neutral.ts`). Le dialogue d'aperçu
 * (appui long) est conservé : il peut être monté hors du tiroir.
 */
const NEUTRE: Scenario['neutre'] = {
  app: { sheet: '.lkdv-cv2-sheet', root: APP_FRAME, keep: ['[role="dialog"][aria-label^="Aperçu"]'] },
  maquette: { sheet: '#phone .sheet', root: MAQ_FRAME, keep: ['#phone .ctx'] },
};

const MASQUES = {
  app: [...CHROME_MASKS.app, ...DATA_MASKS.app],
  maquette: [...CHROME_MASKS.maquette, ...DATA_MASKS.maquette],
};

const SHEET_MEASURES: MeasureSpec[] = [
  measure('Tiroir', '.lkdv-cv2-sheet', '#phone .sheet', GLASS),
  measure('Poignée', '.lkdv-cv2-grab', '#phone .grab', ['border-radius', 'background-color']),
  measure('Capsule des volets', '.lkdv-cv2-topnav .lkdv-cv2-capsule', '.slot-topnav .capsule', GLASS),
  measure('Mini-capsule (filtres)', '.lkdv-lens-float', '#phone .ig-tabs.lens-tabs', GLASS),
];

const TILE = (id: string, app: string, maq: string, props: string[] = ['border-radius']): MeasureSpec => measure(id, app, maq, props);

function app(url: string, steps: Step[], session: 'member' | 'anonymous' = 'member', mock?: MockOptions): Scenario['app'] {
  return {
    url,
    session,
    mock,
    hydrate: 'button[aria-label="Explorer et rechercher"]',
    steps,
    frame: APP_FRAME,
    frameWide: APP_FRAME_WIDE,
  };
}

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
/** Les commandes du panneau de démo sont masquées sous 900 px : clic DOM direct. */
const panel = (selector: string): Step => ({ eval: `document.querySelector('${selector}').click()` });
const volet = (name: string): Step => ({ click: { role: 'tab', name, within: TABLIST } });

function scenario(
  id: string,
  ecran: string,
  etat: string,
  role: FidelityRole,
  options: {
    appSteps: Step[];
    hash?: string;
    maqSteps?: Step[];
    measures: MeasureSpec[];
    session?: 'member' | 'anonymous';
    mock?: MockOptions;
    nonAtteignable?: Scenario['nonAtteignable'];
  },
): Scenario {
  return {
    id,
    surface: 'communaute',
    ecran,
    etat,
    role,
    app: app('/communaute', options.appSteps, options.session ?? (role === 'invite' ? 'anonymous' : 'member'), options.mock),
    maquette: { file: MAQUETTE_COMMUNAUTE, hash: options.hash, steps: options.maqSteps ?? [], frame: MAQ_FRAME },
    masques: MASQUES,
    neutre: NEUTRE,
    mesures: options.measures,
    nonAtteignable: options.nonAtteignable,
  };
}

const CARNET_TILE = TILE('Tuile carnet', '[data-testid="cv2-tile-carnet"]', '#phone .ct');
const CLUB_TILE = TILE('Tuile club', '[data-testid="cv2-tile-club"]', '#phone .kt');
const SORTIE_TILE = TILE('Tuile sortie', '[data-testid="cv2-tile-sortie"]', '#phone .tk');
const SORT_BUTTON = measure('Bouton de tri', '[data-testid="cv2-sort-button"]', '#phone .sort-btn', ['border-radius', 'background-color', 'background-image']);

export const COMMUNAUTE_SCENARIOS: Scenario[] = [
  scenario('communaute-explorer-carnets', 'Explorer · carnets', 'chargé', 'membre', {
    hash: 'explorer-carnets',
    appSteps: [...openExplorer, volet('Carnets'), { wait: 600 }],
    measures: [...SHEET_MEASURES, CARNET_TILE, SORT_BUTTON],
  }),
  scenario('communaute-explorer-clubs', 'Explorer · clubs', 'chargé', 'membre', {
    hash: 'explorer-clubs',
    appSteps: [...openExplorer, volet('Clubs'), { wait: 600 }],
    measures: [...SHEET_MEASURES, CLUB_TILE, SORT_BUTTON],
  }),
  scenario('communaute-explorer-sorties', 'Explorer · sorties', 'chargé', 'membre', {
    hash: 'explorer-sorties',
    appSteps: [...openExplorer, volet('Sorties'), { wait: 600 }],
    measures: [...SHEET_MEASURES, SORTIE_TILE],
  }),
  scenario('communaute-recherche-accueil', 'Explorer · recherche', 'accueil de la recherche', 'membre', {
    hash: 'explorer-search',
    appSteps: openSearch,
    measures: [
      ...SHEET_MEASURES,
      // Parent direct du champ : la maquette mesure le conteneur `.srch`, pas l'<input>.
      measure('Champ de recherche', ':has(> input[type="search"])', '#phone .srch', ['border-radius', 'background-color', 'background-image']),
    ],
  }),
  scenario('communaute-recherche-resultats', 'Explorer · recherche', 'résultats pour « ecrins »', 'membre', {
    hash: 'explorer-search',
    appSteps: [
      ...openSearch,
      { fill: { role: 'searchbox', name: 'Rechercher dans toute la communauté' }, value: 'ecrins' },
      { waitFor: { css: '[data-testid="cv2-tile-carnet"]' } },
      { wait: 700 },
    ],
    maqSteps: [{ fill: { css: '#phone .srch input' }, value: 'ecrins' }, { wait: 900 }],
    measures: SHEET_MEASURES,
  }),
  scenario('communaute-peek-carnet', 'Explorer · carnets', 'aperçu (appui long sur une tuile)', 'membre', {
    hash: 'explorer-carnets',
    appSteps: [
      ...openExplorer,
      volet('Carnets'),
      { waitFor: { css: '[data-testid="cv2-tile-carnet"]' } },
      { longPress: { css: '[data-testid="cv2-tile-carnet"]' } },
      { waitFor: { role: 'dialog', name: 'Aperçu' } },
      { wait: 500 },
    ],
    maqSteps: [{ longPress: { css: '#phone .ct' } }, { wait: 600 }],
    measures: [measure('Aperçu (peek)', '[role="dialog"][aria-label^="Aperçu"]', '#phone .ctx .box', [])],
  }),
  scenario('communaute-creation-publication-etape1', 'Création · publication', 'étape 1', 'membre', {
    hash: 'creer-post',
    appSteps: [
      { click: { role: 'button', name: 'Créer dans l’application', exact: true } },
      { waitFor: { css: '[data-testid="communaute-v2-create"]' } },
      { wait: 900 },
    ],
    measures: [
      measure('Tiroir', '.lkdv-cv2-sheet', '#phone .sheet', GLASS),
      measure('Capsule des 6 types', '.lkdv-cv2-topnav .lkdv-cv2-capsule', '.slot-topnav .capsule', GLASS),
      measure('Formulaire', '[data-testid="cv2-form-post"]', '#phone .cr-vp', []),
    ],
  }),
  scenario('communaute-explorer-carnets-chargement', 'Explorer · carnets', 'chargement (squelette)', 'membre', {
    hash: 'explorer-carnets',
    mock: { latencyMs: 15_000 },
    appSteps: [...openExplorer, volet('Carnets'), { wait: 300 }],
    maqSteps: [panel('[data-p="st-load"]'), { wait: 300 }],
    measures: SHEET_MEASURES,
  }),
  scenario('communaute-explorer-carnets-vide', 'Explorer · carnets', 'vide', 'membre', {
    hash: 'explorer-carnets',
    mock: { state: 'empty' },
    appSteps: [...openExplorer, volet('Carnets'), { wait: 900 }],
    maqSteps: [panel('[data-p="st-empty"]'), { wait: 600 }],
    measures: SHEET_MEASURES,
  }),
  scenario('communaute-explorer-carnets-erreur', 'Explorer · carnets', 'erreur de chargement', 'membre', {
    hash: 'explorer-carnets',
    mock: { state: 'error' },
    appSteps: [...openExplorer, volet('Carnets'), { wait: 900 }],
    maqSteps: [panel('[data-p="st-err"]'), { wait: 600 }],
    measures: SHEET_MEASURES,
  }),
  scenario('communaute-explorer-carnets-invite', 'Explorer · carnets', 'chargé', 'invite', {
    hash: 'explorer-carnets',
    session: 'anonymous',
    appSteps: [...openExplorer, volet('Carnets'), { wait: 600 }],
    maqSteps: [panel('[data-p="role"][data-v="g"]'), { wait: 500 }],
    measures: [...SHEET_MEASURES, CARNET_TILE],
  }),
];
