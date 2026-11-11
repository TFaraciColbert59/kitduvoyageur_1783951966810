import type { FidelityRole, MeasureSpec, MockOptions, Scenario, Step } from '../lib/types';
import { CHROME_MASKS, GLASS, MAQUETTE_COMMUNAUTE, measure } from './common';
import { MAQUETTE_AGENDA_ROWS, MAQUETTE_CLUB_ROWS, MAQUETTE_EVENT_ROWS, MAQUETTE_WEATHER_BY_LAT } from './maquetteData';

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
    '.lkdv-cv2x-tile-foot .lkdv-cv2-num',
  ],
  maquette: ['#phone .ct-cover', '#phone .tvs', '#phone .ct-t', '#phone .ct-m', '#phone .visa', '#phone .ct-foot .ct-b span'],
};

/**
 * Fond neutralisé derrière le tiroir (voir `lib/neutral.ts`). Le dialogue d'aperçu
 * (appui long) est conservé : il peut être monté hors du tiroir.
 */
const NEUTRE: Scenario['neutre'] = {
  // Pilule « Mode invité · lecture seule » : ajout de l'app (01-SPEC), absente de la maquette (qui passe par l'île « Se connecter »).
  // Bandeau « Brouillon restauré · Effacer » : artefact du banc (l'étape s'ouvre depuis un brouillon vide), la maquette n'en a pas.
  app: { sheet: '.lkdv-cv2-sheet', root: APP_FRAME, keep: ['[role="dialog"][aria-label^="Aperçu"]'], hide: ['.lkdv-cv2-guest', '.lkdv-cv2c-draft'] },
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

function app(url: string, steps: Step[], session: 'member' | 'anonymous' = 'member', mock?: MockOptions, rpc?: Record<string, unknown>, weather?: Scenario['app']['weather'], drafts?: Record<string, number>): Scenario['app'] {
  return {
    url,
    drafts,
    session,
    mock,
    rpc,
    weather,
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
    rpc?: Record<string, unknown>;
    weather?: Scenario['app']['weather'];
    drafts?: Record<string, number>;
    alignerTextes?: Scenario['alignerTextes'];
    /** Garde le focus que la maquette donne d'elle-même (recherche : champ focalisé des deux côtés). */
    keepMaquetteFocus?: boolean;
    /** Masques ajoutés à ceux de la surface (données propres à l'écran). */
    masques?: { app: string[]; maquette: string[] };
    nonAtteignable?: Scenario['nonAtteignable'];
  },
): Scenario {
  return {
    id,
    surface: 'communaute',
    ecran,
    etat,
    role,
    app: app('/communaute', options.appSteps, options.session ?? (role === 'invite' ? 'anonymous' : 'member'), options.mock, options.rpc, options.weather, options.drafts),
    maquette: {
      file: MAQUETTE_COMMUNAUTE,
      hash: options.hash,
      steps: [...(options.maqSteps ?? []), ...(options.keepMaquetteFocus ? [] : [BLUR_MAQUETTE])],
      frame: MAQ_FRAME,
    },
    masques: { app: [...MASQUES.app, ...(options.masques?.app ?? [])], maquette: [...MASQUES.maquette, ...(options.masques?.maquette ?? [])] },
    neutre: NEUTRE,
    mesures: options.measures,
    alignerTextes: options.alignerTextes,
    nonAtteignable: options.nonAtteignable,
  };
}

/**
 * Tendances de la maquette (`D.TRENDS`, L1887) : mêmes six libellés, quatre « lieux » pour les
 * quatre vignettes de « Lieux populaires » (l'app tire les deux blocs de la même RPC). Les
 * compteurs diffèrent de nature (« recherches » dans la maquette, « publications » dans l'app :
 * décision documentée dans `SearchHome.tsx`) et sont masqués.
 */
const MAQUETTE_TRENDS = [
  { kind: 'lieu', label: 'Lac Blanc', hits: 40 },
  { kind: 'tag', label: 'ski de rando', hits: 77 },
  { kind: 'lieu', label: 'Vercors', hits: 114 },
  { kind: 'tag', label: 'bivouac', hits: 61 },
  { kind: 'lieu', label: 'Mercantour', hits: 98 },
  { kind: 'lieu', label: 'GR20', hits: 45 },
];
/** La maquette amorce trois recherches récentes ; l'app n'en garde aucune sans saisie (mémoire de session) : on les retire côté maquette. */
/**
 * La maquette ouvre un deep link en donnant le focus clavier à l'onglet actif (anneau `:focus-visible`
 * vert autour de la lentille) : artefact du banc, absent de l'app. Retiré hors recherche (où le focus
 * du champ est voulu des deux côtés).
 */
const BLUR_MAQUETTE: Step = { eval: 'document.activeElement && document.activeElement.blur && document.activeElement.blur()' };

const CLEAR_MAQUETTE_RECENTS: Step = {
  eval: `for (let n = 0; n < 9; n += 1) { const b = document.querySelector('#phone [data-a="q-del"]'); if (!b) break; b.click(); }`,
};

/** Titres des tuiles carnet : même longueur que la maquette, donc mêmes retours à la ligne. */
const CARNET_TITLES = [{ app: '[data-testid="cv2-tile-carnet"] .lkdv-cv2x-carnet-title', maquette: '#phone .ct .ct-t' }];

const CARNET_TILE = TILE('Tuile carnet', '[data-testid="cv2-tile-carnet"]', '#phone .ct');
const CLUB_TILE = TILE('Tuile club', '[data-testid="cv2-tile-club"]', '#phone .kt');
const SORTIE_TILE = TILE('Tuile sortie', '[data-testid="cv2-tile-sortie"] .lkdv-cv2-ticket', '#phone .tk');
const SORT_BUTTON = measure('Bouton de tri', '[data-testid="cv2-sort-button"]', '#phone .sort-btn', ['border-radius', 'background-color', 'background-image']);

export const COMMUNAUTE_SCENARIOS: Scenario[] = [
  scenario('communaute-explorer-carnets', 'Explorer · carnets', 'chargé', 'membre', {
    hash: 'explorer-carnets',
    appSteps: [...openExplorer, volet('Carnets'), { wait: 600 }],
    alignerTextes: CARNET_TITLES,
    measures: [...SHEET_MEASURES, CARNET_TILE, SORT_BUTTON],
  }),
  scenario('communaute-explorer-clubs', 'Explorer · clubs', 'chargé', 'membre', {
    hash: 'explorer-clubs',
    appSteps: [...openExplorer, volet('Clubs'), { wait: 600 }],
    // Jeu exact de la maquette (L1853) : ordre « activité », adhésions, cadenas, blasons, signaux.
    rpc: { community_clubs_feed: MAQUETTE_CLUB_ROWS },
    // Signal d'activité et décompte d'amis : textes de données.
    masques: { app: ['.lkdv-cv2x-club-signal', '.lkdv-cv2x-club-friends small'], maquette: ['#phone .kt-sig', '#phone .kt-fr small'] },
    measures: [
      ...SHEET_MEASURES,
      CLUB_TILE,
      SORT_BUTTON,
      measure('Puce d’activité', '.lkdv-cv2x-club-chips .lkdv-cv2-chip', '#phone .chip', ['border-radius', 'background-color', 'box-shadow', 'font-size', 'font-weight', 'color']),
      measure('Blason (grand)', '.lkdv-cv2x-club.is-month .lkdv-crest', '#phone .kt.month .bl', []),
      measure('Pastille « Club du mois »', '.lkdv-cv2x-club-month', '#phone .kt-mo', ['border-radius', 'background-color', 'font-size', 'font-weight', 'color']),
      measure('Titre du club', '.lkdv-cv2x-club-title', '#phone .kt .ct-t', ['font-size', 'font-weight', 'color', 'line-height']),
      measure('Méta du club', '.lkdv-cv2x-club .lkdv-cv2-meta', '#phone .kt .ct-m', ['font-size', 'line-height', 'color']),
      measure('Signal d’activité', '.lkdv-cv2x-club-signal', '#phone .kt-sig', ['font-size', 'font-weight', 'color']),
      measure('Décompte des amis', '.lkdv-cv2x-club-friends small', '#phone .kt-fr small', ['font-size', 'font-weight', 'color']),
      measure('Cadenas du club', '.lkdv-cv2x-club-lock', '#phone .kt-lock', ['border-radius', 'background-color', 'color']),
      measure('Pilule « Rejoindre »', '.lkdv-cv2x-club .lkdv-cv2x-join', '#phone .kt .joinbtn', ['border-radius', 'background-color', 'font-size', 'font-weight', 'box-shadow', 'color']),
    ],
  }),
  scenario('communaute-explorer-sorties', 'Explorer · sorties', 'chargé', 'membre', {
    hash: 'explorer-sorties',
    appSteps: [...openExplorer, volet('Sorties'), { wait: 600 }],
    // Jeu exact de la maquette (L1869) : dates, états d'inscription, jauges, agenda et météo du jour J.
    rpc: { community_events_feed: MAQUETTE_EVENT_ROWS, community_events_agenda: MAQUETTE_AGENDA_ROWS },
    weather: MAQUETTE_WEATHER_BY_LAT,
    // Carte topo du billet : décor tracé au hasard (graine propre à chaque côté), non comparable. Elle porte la
    // pastille météo, dont la géométrie et les styles sont mesurés plus bas.
    // + textes de données (titre, méta, pastilles, talon, jauge) : même police, rendu des glyphes propre à chaque page ;
    // leur position, taille et couleur sont mesurées plus bas. + chiffres en police mono (JetBrains Mono du banc contre repli de la maquette).
    masques: {
      app: ['.lkdv-cv2-ticket-topo', '.lkdv-cv2-ticket-title', '.lkdv-cv2-ticket-chips', '.lkdv-cv2-ticket-meta', '.lkdv-cv2-ticket-stub', '.lkdv-cv2x-event-foot-note', '.lkdv-cv2-agenda-day b'],
      maquette: ['#phone .tk-topo', '#phone .tk-main .ct-t', '#phone .tk-chips', '#phone .tk-main .ct-m', '#phone .tk-stub', '#phone .tk .gtx', '#phone .ag b'],
    },
    measures: [
      ...SHEET_MEASURES,
      SORTIE_TILE,
      measure('Jour de l’agenda', '.lkdv-cv2-agenda-day', '#phone .ag', ['border-radius', 'background-color', 'box-shadow']),
      measure('Initiale du jour', '.lkdv-cv2-agenda-day i', '#phone .ag i', ['font-size', 'font-weight', 'color']),
      measure('Numéro du jour', '.lkdv-cv2-agenda-day b', '#phone .ag b', ['font-size', 'font-weight', 'color']),
      measure('Point d’agenda', '.lkdv-cv2-agenda-dots u', '#phone .ag .dots u', ['background-color', 'border-radius']),
      measure('Surtitre « Affichage »', '.lkdv-cv2x-events-head .lkdv-cv2-eyebrow', '#phone .ctxrow .h5.inl', ['font-size', 'font-weight', 'letter-spacing'], false),
      measure('Sélecteur Grille / Liste', '.lkdv-cv2x-events-head .lkdv-cv2-seg', '#phone .ctxrow .seg-s', ['border-radius', 'background-color', 'box-shadow']),
      measure('Bouton du sélecteur (sorties)', '.lkdv-cv2x-events-head .lkdv-cv2-seg button', '#phone .ctxrow .seg-s button', ['font-size', 'font-weight', 'color']),
      measure('Talon du billet', '.lkdv-cv2-ticket-stub', '#phone .tk-stub', ['background-color', 'color']),
      measure('Jour de la semaine (talon)', '.lkdv-cv2-ticket-wd', '#phone .tk-wd', ['font-size', 'font-weight', 'letter-spacing']),
      measure('Numéro (talon)', '.lkdv-cv2-ticket-day', '#phone .tk-stub b', ['font-size', 'font-weight']),
      measure('Mois (talon)', '.lkdv-cv2-ticket-mo', '#phone .tk-mo', ['font-size', 'font-weight']),
      measure('Titre du billet', '.lkdv-cv2-ticket-title', '#phone .tk-main .ct-t', ['font-size', 'font-weight', 'line-height', 'color']),
      measure('Pastilles du billet', '.lkdv-cv2-ticket-chips', '#phone .tk-chips', []),
      measure('Pastille du billet', '.lkdv-cv2-ticket-chips i', '#phone .tk-chips i', ['background-color', 'font-size', 'font-weight', 'border-radius', 'color']),
      measure('Méta du billet', '.lkdv-cv2-ticket-meta', '#phone .tk-main .ct-m', ['font-size', 'line-height']),
      measure('Carte topo du billet', '.lkdv-cv2-ticket-topo', '#phone .tk-topo', []),
      measure('Pastille météo', '.lkdv-cv2x-wxc', '#phone .wxc', ['border-radius', 'background-color', 'font-size', 'color']),
      measure('Jauge de places', '.lkdv-cv2x-gauge', '#phone .tk .gauge', ['border-radius', 'background-color']),
      measure('Remplissage de la jauge', '.lkdv-cv2x-gauge > i', '#phone .tk .gauge i', ['border-radius', 'background-image']),
      measure('Libellé des places', '.lkdv-cv2x-event-foot-note', '#phone .tk .gtx', ['font-size', 'font-weight', 'color']),
      measure('Bouton d’inscription', '.lkdv-cv2x-event-action button', '#phone .tk .joinbtn', ['border-radius', 'background-color', 'font-size', 'font-weight', 'box-shadow']),
    ],
  }),
  scenario('communaute-recherche-accueil', 'Explorer · recherche', 'accueil de la recherche', 'membre', {
    hash: 'explorer-search',
    keepMaquetteFocus: true,
    appSteps: openSearch,
    maqSteps: [CLEAR_MAQUETTE_RECENTS],
    rpc: { community_search_trending: MAQUETTE_TRENDS },
    masques: {
      // Compteurs et noms des lieux : données ; illustrations des vignettes : couvertures.
      // + rang : police mono de repli de la maquette (IBM Plex Mono absente du banc) contre celle de l'app.
      // + saisie : placeholder #46584D (7:1, AA) de l'app contre #8A968D (2,9:1) de la maquette, choix d'accessibilité assumé ;
      // sa position et sa police sont mesurées (« Saisie »).
      app: ['.lkdv-cv2x-trend-meta', '.lkdv-cv2x-trend-rank', '.lkdv-cv2x-place-label small', '.lkdv-cv2x-place-label b', '.lkdv-cv2x-place-art', '.lkdv-cv2x-search-field input'],
      maquette: ['#phone .trends small', '#phone .trends .rk', '#phone .place small', '#phone .place b', '#phone .place svg.art', '#phone .srch input'],
    },
    measures: [
      ...SHEET_MEASURES,
      // Parent direct du champ : la maquette mesure le conteneur `.srch`, pas l'<input>.
      measure('Champ de recherche', ':has(> input[type="search"])', '#phone .srch', ['border-radius', 'background-color', 'background-image', 'box-shadow']),
      measure('Puce de contexte', '.lkdv-cv2x-ctx-chips .lkdv-cv2-chip', '#phone .ctxrow .chip', ['border-radius', 'background-color', 'box-shadow', 'color', 'font-size', 'font-weight']),
      measure('Sélecteur Liste / Carte', '.lkdv-cv2x-search-view', '#phone .seg-s', ['border-radius', 'background-color', 'background-image', 'box-shadow']),
      // Couleur non comparée : l'encre du surtitre reste l'encre pleine (AA sur verre, FID-080) ; la maquette utilise `--label2`.
      measure('Surtitre', '.lkdv-cv2x-search-home .lkdv-cv2-eyebrow', '#phone .eyebrow-row .h5', ['font-size', 'font-weight', 'letter-spacing'], false),
      measure('Carte des tendances', '.lkdv-cv2x-trends', '#phone .menu2.trends', ['border-radius', 'background-color', 'background-image', 'box-shadow']),
      measure('Ligne de tendance', '.lkdv-cv2x-trend-row', '#phone .menu2.trends .li', ['color']),
      measure('Vignette de lieu', '.lkdv-cv2x-place', '#phone .place', ['border-radius']),
      measure('Libellé de tendance', '.lkdv-cv2x-trend-label', '#phone .menu2.trends .tt', ['font-size', 'font-weight', 'line-height', 'color'], false),
      measure('Rang de tendance', '.lkdv-cv2x-trend-rank', '#phone .menu2.trends .rk', ['font-size', 'font-weight', 'line-height', 'color'], false),
      measure('Icône de tendance', '.lkdv-cv2x-trend-ico', '#phone .menu2.trends .ico', ['border-radius', 'background-color']),
      measure('Texte de puce', '.lkdv-cv2x-ctx-chips .lkdv-cv2-chip', '#phone .ctxrow .chip', ['line-height']),
      measure('Bouton du sélecteur', '.lkdv-cv2x-search-view button', '#phone .seg-s button', ['line-height', 'font-size', 'color']),
      measure('Saisie', '.lkdv-cv2x-search-field input', '#phone .srch input', ['font-size', 'font-weight', 'line-height', 'color', 'padding-left', 'text-indent']),
    ],
  }),
  scenario('communaute-recherche-resultats', 'Explorer · recherche', 'résultats pour « ecrins »', 'membre', {
    hash: 'explorer-search',
    keepMaquetteFocus: true,
    appSteps: [
      ...openSearch,
      { fill: { role: 'searchbox', name: 'Rechercher dans toute la communauté' }, value: 'ecrins' },
      { waitFor: { css: '[data-testid="cv2-tile-carnet"]' } },
      { wait: 700 },
    ],
    maqSteps: [{ fill: { css: '#phone .srch input' }, value: 'ecrins' }, { wait: 900 }],
    // Couvertures, titres, sous-titres : données (jeux d'exemple différents).
    masques: { app: ['.lkdv-cv2x-search-media', '.lkdv-cv2x-search-body'], maquette: ['#phone .res-row .rr-cover', '#phone .res-row .rr-t'] },
    measures: [
      ...SHEET_MEASURES,
      measure('Ligne de résultat', '.lkdv-cv2x-search-list > a', '#phone .res-row', ['border-radius', 'background-image', 'box-shadow']),
      // Sans position : la maquette n'affiche la distance que géolocalisée, la RPC simulée la renvoie toujours.
      measure('Pastille de type', '.lkdv-cv2x-search-end .lkdv-cv2-type', '#phone .res-row .rr-pill', ['border-radius', 'background-color', 'font-size', 'font-weight', 'height'], false),
      measure('Surtitre de groupe', '.lkdv-cv2x-search-pane .lkdv-cv2-group-head', '#phone .eyebrow-row', []),
    ],
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
    // Couverture et textes de la carte : données (jeu d'exemple de la maquette contre fixtures).
    masques: { app: ['.lkdv-cv2x-peek-media', '.lkdv-cv2x-peek-text'], maquette: ['#phone .ctx .pk-art', '#phone .ctx .pv > b', '#phone .ctx .pv .s2'] },
    measures: [measure('Aperçu (peek)', '[role="dialog"][aria-label^="Aperçu"]', '#phone .ctx .box', [])],
  }),
  scenario('communaute-creation-publication-etape1', 'Création · publication', 'étape 1', 'membre', {
    hash: 'creer-post',
    appSteps: [
      { click: { role: 'button', name: 'Créer dans l’application', exact: true } },
      { waitFor: { css: '[data-testid="communaute-v2-create"]' } },
      { wait: 900 },
    ],
    // Nom et méta de l'auteur de l'aperçu : l'app montre le compte connecté, la maquette « Toi ».
    // + libellés des cartes : « Photo » (app, vidéo reportée en publication, 01-SPEC § 6) contre « Photo / vidéo », et rendu des glyphes.
    masques: {
      app: ['.lkdv-cv2c-live-preview .lkdv-post-author-txt', '.lkdv-cv2c-format-card b', '.lkdv-cv2c-format-card small', '.lkdv-cv2c-audience-card b', '.lkdv-cv2c-audience-card small'],
      maquette: ['#phone .cr-prev .lkdv-post-author-txt', '#phone .fmt b', '#phone .fmt small', '#phone .rcard b', '#phone .rcard small'],
    },
    measures: [
      measure('Tiroir', '.lkdv-cv2-sheet', '#phone .sheet', GLASS),
      measure('Capsule des 6 types', '.lkdv-cv2-topnav .lkdv-cv2-capsule', '.slot-topnav .capsule', GLASS),
      // Le formulaire vit dans le pager : on mesure le conteneur du corps (maquette `.cr-vp`), l'aperçu et le pied.
      measure('Corps du formulaire', '.lkdv-cv2-body', '#phone .cr-vp', []),
      measure('Aperçu du post', '.lkdv-cv2-preview-slot', '#phone .cr-prev', ['border-radius']),
      measure('Pied de formulaire', '.lkdv-cv2-footer', '#phone .cr-foot', []),
      measure('Libellé « Format »', '#cv2c-format-label', '#phone .lp-pane[data-n="0"] fieldset:first-of-type legend', ['font-size', 'font-weight', 'letter-spacing'], false),
      measure('Carte de format', '.lkdv-cv2c-format-card', '#phone .fmt', ['border-radius', 'background-image', 'box-shadow', 'color']),
      measure('Icône de format', '.lkdv-cv2c-format-ico', '#phone .fmt .ic', ['color', 'width', 'height']),
      measure('Titre de format', '.lkdv-cv2c-format-card b', '#phone .fmt b', ['font-size', 'font-weight', 'color']),
      measure('Carte d’audience', '.lkdv-cv2c-audience-card', '#phone .rcard', ['border-radius', 'background-image', 'box-shadow']),
      measure('Pastille d’icône d’audience', '.lkdv-cv2c-aud-ico', '#phone .rcard .rc-i', ['border-radius', 'background-color', 'color']),
      measure('Radio d’audience', '.lkdv-cv2c-radio', '#phone .rcard .rc-r', ['border-radius', 'box-shadow']),
      measure('Titre d’audience', '.lkdv-cv2c-audience-card b', '#phone .rcard b', ['font-size', 'font-weight', 'color']),
      measure('Aperçu : carte', '.lkdv-cv2c-live-preview .lkdv-feed-post', '#phone .cr-prev .lkdv-feed-post', ['border-radius']),
      measure('Bouton « Retour »', '.lkdv-cv2c-back', '#phone .cr-foot .back', ['border-radius', 'background-color', 'background-image', 'box-shadow', 'opacity', 'font-size', 'font-weight', 'color']),
      measure('Bouton « Suivant »', '.lkdv-cv2c-next', '#phone .cr-foot .next', ['border-radius', 'background-color', 'box-shadow', 'font-size', 'font-weight', 'color']),
      measure('Capsule d’étapes', '.lkdv-cv2-mini', '.lkdv-lens-float, #phone .cr-steps', ['border-radius', 'box-shadow']),
    ],
  }),
  scenario('communaute-explorer-carnets-chargement', 'Explorer · carnets', 'chargement (squelette)', 'membre', {
    hash: 'explorer-carnets',
    mock: { latencyMs: 15_000 },
    appSteps: [...openExplorer, volet('Carnets'), { wait: 300 }],
    maqSteps: [panel('[data-p="st-load"]'), { wait: 300 }],
    // Le dégradé des tuiles est lisse : le diff pixel ne voit pas un décalage de 4 px, la mesure le voit.
    measures: [...SHEET_MEASURES, measure('Tuile squelette', '.lkdv-cv2x-skeleton-tile', '#phone .ct-skel', ['border-radius'])],
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
    alignerTextes: CARNET_TITLES,
    measures: [...SHEET_MEASURES, CARNET_TILE],
  }),
];

/**
 * Création : étapes de chaque type (maquette `CRE.forms.<type>.steps`). L'app restaure l'étape depuis
 * un brouillon vide ; la maquette y va par `CRE.goStep` avec la validation neutralisée le temps du
 * saut (la maquette refuse d'avancer d'une étape invalide : on compare les formulaires vides).
 */
const CREATE_MEASURES: MeasureSpec[] = [
  measure('Tiroir', '.lkdv-cv2-sheet', '#phone .sheet', GLASS),
  measure('Capsule des 6 types', '.lkdv-cv2-topnav .lkdv-cv2-capsule', '.slot-topnav .capsule', GLASS),
  measure('Corps du formulaire', '.lkdv-cv2-body', '#phone .cr-vp', []),
  measure('Aperçu du formulaire', '.lkdv-cv2-preview-slot', '#phone .cr-prev', ['border-radius']),
  measure('Pied de formulaire', '.lkdv-cv2-footer', '#phone .cr-foot', []),
];

const CREATE_TYPES: Array<{ type: string; label: string; etapes: string[] }> = [
  { type: 'post', label: 'Publication', etapes: ['Format', 'Contenu', 'Diffusion'] },
  { type: 'story', label: 'Story', etapes: ['Média', 'Édition', 'Diffusion'] },
  { type: 'carnet', label: 'Carnet', etapes: ['Infos', 'Tracé', 'Jours', 'Partage'] },
  { type: 'sortie', label: 'Sortie', etapes: ['Activité et lieu', 'Itinéraire', 'Participants', 'Sécurité'] },
  { type: 'kit', label: 'Kit', etapes: ['Inventaire', 'Compléter', 'Partager'] },
  { type: 'club', label: 'Club', etapes: ['Identité', 'Univers', 'Adhésion', 'Publication'] },
];

const CREATE_STEP_SCENARIOS: Scenario[] = CREATE_TYPES.flatMap(({ type, label, etapes }) =>
  etapes.map((etape, index) => {
    const n = index + 1;
    return scenario(`communaute-creation-${type}-etape${n}`, `Création · ${label.toLowerCase()}`, `étape ${n} : ${etape}`, 'membre', {
      hash: `creer-${type}`,
      drafts: n > 1 ? { [type]: index } : undefined,
      appSteps: [
        { click: { role: 'button', name: 'Créer dans l’application', exact: true } },
        { waitFor: { css: '[data-testid="communaute-v2-create"]' } },
        { wait: 900 },
        ...(type === 'post' ? [] : [{ click: { role: 'tab', name: label, within: '[role="tablist"][aria-label="Type de création"]' } } as Step, { wait: 700 } as Step]),
      ],
      maqSteps:
        n > 1
          ? [{ eval: `(() => { const f = LK.CRE.forms['${type}']; const v = f.validate; f.validate = () => ({}); LK.CRE.goStep(${index}); f.validate = v; })()` }, { wait: 500 }]
          : [],
      measures: CREATE_MEASURES,
    });
  }),
);

export const COMMUNAUTE_CREATION_SCENARIOS: Scenario[] = CREATE_STEP_SCENARIOS.filter((item) => item.id !== 'communaute-creation-post-etape1');
