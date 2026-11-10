import type { FidelityRole, MeasureSpec, Scenario, Step } from '../lib/types';
import { CARNET_ID, CHROME_MASKS, GLASS, MAQUETTE_CARNET, TEXT, measure } from './common';

/** Horloge de la fiche : le jour 4 du carnet de test, pour que « En route · J4 sur 4 » soit celui de la maquette. */
const NOW = '2026-07-16T12:00:00+02:00';
export const LOADING_CARNET_ID = '00000000-0000-4000-8000-0000000010ad';
export const STORIES_CARNET_ID = '00000000-0000-4000-8000-0000000051f0';

/**
 * Fiche Carnet v2 (`/carnets/[id]`) contre `maquette-fiche-carnet.html`.
 *
 * Le carnet de test est servi côté serveur par `server/fixture-supabase.cjs`
 * (« Tour des Écrins », 4 jours) ; `EMPTY_ID` n'a ni étapes, ni moments, ni kit.
 * Le propriétaire (cookie `member`) est Participant ; le cookie `anonymous`
 * (autre identifiant, aucune ligne de collaborateur) est Visiteur.
 */

export const EMPTY_CARNET_ID = '00000000-0000-4000-8000-00000000e0e0';

const APP_FRAME = '[data-testid="carnet-v2-root"]';
const MAQ_FRAME = '#phone';

/** Zones qui ne portent que des données réelles ou des illustrations : masquées. */
const MASQUES = {
  app: [
    ...CHROME_MASKS.app,
    '.lkdv-carnet-mapzone', // carte (tuiles réseau bloquées, tracé réel)
    '.lkdv-ig-avi', // avatar du carnet (photo)
    '.lkdv-ig-hl-ring', // anneaux des voyageurs (avatars)
    '.lkdv-ig-hl-thumb',
    '.lkdv-carnet-acc', // profil d'altitude (altitudes du fixture)
    '.lkdv-ig-hl-row', // pastilles « À la une » : libellés d'étapes propres au jeu de données
    // illustrations et photos : une donnée (photo réelle en production, scène dessinée sans photo)
    '[class*="voyageCard"] > img',
    '[class*="voyageCard"] > svg',
    '[class*="voyageCard"] [class*="art"]',
    '.lkdv-postcard > img',
    '.lkdv-postcard > svg',
    '.lkdv-mo.media > button',
    '.lkdv-fiche-hero > svg',
    '.lkdv-ig-tile[data-type="photo"]',
    '.lkdv-ig-tile[data-type="video"]',
  ],
  maquette: [
    ...CHROME_MASKS.maquette,
    '#phone .mapzone',
    '#phone .ig-avi',
    '#phone .ig-hl-row',
    '#phone #acc',
    '#phone .voyage-card > svg.art',
    '#phone .postcard > svg.art',
    '#phone .mo.media > button',
    '#phone .fiche-hero > svg.art',
    '#phone .ig-tile:has(svg.art)',
  ],
};

const PILL_PROPS = ['border-radius', 'font-size', 'font-weight', 'color', 'background-color', 'background-image', 'backdrop-filter', 'height'];

/** Mesures de la page (Résumé / jour). */
const PAGE_MEASURES: MeasureSpec[] = [
  measure('Pastille titre', '.lkdv-title-pill', '#rp', PILL_PROPS),
  measure('Bouton « + » (barre du haut)', '.lkdv-carnet-topbar-r .lkdv-gbtn', '.ig-top-r .gbtn', ['border-radius', 'background-color', 'width']),
  measure('Carte du carnet (verre)', '.lkdv-carnet-card', '#phone #card', ['border-radius']),
  measure('Statistique n°1', '.lkdv-ig-stat', '.ig-stat', ['font-size', 'color']),
  measure('Nom du carnet', '.lkdv-ig-name', '.ig-name', TEXT),
  measure('Sous-titre', '.lkdv-ig-handle-sub', '.ig-handle-sub', ['font-size', 'color']),
  measure('Bouton « Ouvrir le carnet »', '.lkdv-ig-open', '.ig-state .pbtn', ['border-radius', 'font-size', 'font-weight', 'color']),
  measure('En-tête (couverture + chiffres)', '.lkdv-ig-header', '#phone .ig-header', []),
  measure('Bio (titre + sous-titre)', '.lkdv-ig-bio', '#phone .ig-bio', []),
  measure('Ligne d’état', '.lkdv-ig-actions', '#phone .ig-state', []),
  measure('Bouton d’état (En route / Terminé)', '.lkdv-ig-live', '#phone .ig-livebtn', ['font-size', 'color', 'background-color', 'border-radius', 'height']),
  measure('Rangée « À la une »', '.lkdv-ig-hl-row', '#phone .ig-hl-row', []),
  measure('Titre de vue (dayhead)', '[class*="dayhead"]:not([class*="dayheadBadge"]):not([class*="dayheadText"])', '#phone .dayhead', []),
  measure('Vue du jour (swipe)', '.lkdv-day-swipe-view', '#phone .ig-swipe-view', []),
  measure('Capsule de jours', '.lkdv-tabs-float', '.ig-tabs-float', ['border-radius', 'backdrop-filter']),
  measure('Poignée de carte', '.lkdv-mgrab', '.mgrab', ['border-radius']),
];

/** Aplats de la grille d'un jour : un par type, comparés à ceux de la maquette. */
const TILE_FILLS: MeasureSpec[] = [
  ['kit', 'c-kit'],
  ['spend', 'c-spend'],
  ['species', 'c-species'],
].map(([type, cls]) =>
  measure(`Aplat « ${type} »`, `.lkdv-ig-tile[data-type="${type}"] .lkdv-tfill`, `#phone .tfill.${cls}`, ['background-color', 'background-image', 'color', 'border-radius']),
);

const DAY_CARD: MeasureSpec = measure('Carte-jour', '[class*="voyageCard"]', '.voyage-card', ['border-radius']);

/** Mesures d'un tiroir ouvert. */
const DRAWER_MEASURES: MeasureSpec[] = [
  measure('Tiroir', '.lkdv-carnet-drawer', '#phone .sheet', GLASS),
  measure('Capsule des 5 slots', '.lkdv-slot-topnav .lkdv-capsule', '.slot-topnav .capsule', GLASS),
  measure('Zone de contenu du slot', '.lkdv-slot-stage', '.slot-stage', []),
  measure('Barre des lentilles', '.lkdv-lens-tabs', '.lens-tabs', GLASS),
];

function scenario(
  id: string,
  ecran: string,
  etat: string,
  role: FidelityRole,
  options: {
    hash?: string;
    appUrl?: string;
    appSteps?: Step[];
    maqSteps?: Step[];
    measures?: MeasureSpec[];
    nonAtteignable?: Scenario['nonAtteignable'];
    noHydrate?: boolean;
    masks?: { app?: string[]; maquette?: string[] };
  },
): Scenario {
  return {
    id,
    surface: 'carnet',
    ecran,
    etat,
    role,
    app: {
      url: options.appUrl ?? `/carnets/${CARNET_ID}`,
      session: role === 'visiteur' ? 'anonymous' : 'member',
      hydrate: options.noHydrate ? undefined : '.lkdv-title-pill',
      noHydrate: options.noHydrate,
      now: NOW,
      steps: options.appSteps ?? [],
      frame: APP_FRAME,
      frameWide: APP_FRAME,
    },
    maquette: { file: MAQUETTE_CARNET, hash: options.hash, steps: options.maqSteps ?? [], frame: MAQ_FRAME },
    masques: {
      app: [...MASQUES.app, ...(options.masks?.app ?? [])],
      maquette: [...MASQUES.maquette, ...(options.masks?.maquette ?? [])],
    },
    mesures: options.measures ?? PAGE_MEASURES,
    nonAtteignable: options.nonAtteignable,
  };
}

/** Les commandes du panneau de démo sont masquées sous 900 px : clic DOM direct. */
const panel = (selector: string): Step => ({ eval: `document.querySelector('${selector}').click()` });

const openDrawer: Step = { click: { role: 'button', name: 'Ouvrir le carnet' } };

function slot(id: string, label: string, hash: string, lens?: { name: string }): Scenario {
  const tab: Step[] = label === 'Fil de bord' ? [] : [{ click: { role: 'tab', name: label, within: '.lkdv-carnet-drawer' } }];
  const lensApp: Step[] = lens ? [{ click: { role: 'tab', name: lens.name, within: '.lkdv-carnet-drawer' } }] : [];
  const lensMaq: Step[] = lens ? [{ click: { role: 'tab', name: lens.name, within: '#phone .sheet' } }] : [];
  return scenario(
    `carnet-tiroir-${id}${lens ? '-2' : ''}`,
    `Carnet · tiroir ${label}`,
    lens ? `chargé, lentille « ${lens.name} »` : 'chargé, première lentille',
    'participant',
    {
      hash,
      appSteps: [openDrawer, { waitFor: { css: '.lkdv-carnet-drawer' } }, ...tab, ...lensApp],
      maqSteps: lensMaq,
      measures: DRAWER_MEASURES,
    }
  );
}

/** Mode modification : le menu de la pastille titre → « Modifier le carnet » (mêmes gestes des deux côtés). */
const editApp: Step[] = [
  { click: { role: 'button', name: 'Menu du carnet', exact: false } },
  { click: { role: 'menuitemcheckbox', name: 'Modifier le carnet' } },
];
const editMaq: Step[] = [{ click: { css: '#rp' } }, { click: { css: '[data-m="edit"]' } }];

export const CARNET_SCENARIOS: Scenario[] = [
  scenario('carnet-resume-participant', 'Carnet · Résumé', 'chargé', 'participant', { measures: [...PAGE_MEASURES, DAY_CARD] }),
  scenario('carnet-j1-participant', 'Carnet · Jour 1', 'chargé', 'participant', {
    hash: 'jour1',
    appSteps: [{ click: { css: '.lkdv-day-capsule-btn', nth: 1 } }],
    measures: [...PAGE_MEASURES, DAY_CARD, ...TILE_FILLS],
  }),
  slot('fil', 'Fil de bord', 'fil'),
  slot('route', 'Route', 'route'),
  slot('sac', 'Sac', 'sac'),
  slot('chiffres', 'Chiffres', 'chiffres'),
  slot('equipage', 'Équipage', 'equipage'),
  slot('fil', 'Fil de bord', 'fil', { name: 'Médias' }),
  slot('route', 'Route', 'route', { name: 'Altitude' }),
  slot('sac', 'Sac', 'sac', { name: 'Verdicts' }),
  slot('chiffres', 'Chiffres', 'chiffres', { name: 'Dénivelé' }),
  slot('equipage', 'Équipage', 'equipage', { name: 'Réactions' }),
  scenario('carnet-modif-resume', 'Carnet · Résumé', 'mode modification', 'participant', {
    appSteps: editApp,
    maqSteps: editMaq,
  }),
  scenario('carnet-modif-j1', 'Carnet · Jour 1', 'mode modification', 'participant', {
    hash: 'jour1',
    appSteps: [...editApp, { click: { css: '.lkdv-day-capsule-btn', nth: 1 } }],
    maqSteps: editMaq,
  }),
  scenario('carnet-modif-tiroir-fil', 'Carnet · tiroir Fil de bord', 'mode modification, pilules « Modifier »', 'participant', {
    hash: 'jour1',
    appSteps: [
      ...editApp,
      { click: { css: '.lkdv-day-capsule-btn', nth: 1 } },
      // en mode modification « Ouvrir le carnet » devient « Terminer » : le tiroir s'ouvre par une statistique
      { click: { css: '.lkdv-ig-stat', nth: 0 } },
      { click: { role: 'tab', name: 'Fil de bord', within: '.lkdv-carnet-drawer' } },
    ],
    maqSteps: [
      ...editMaq,
      { click: { css: '#phone .ig-stat', nth: 0 } },
      { click: { role: 'tab', name: 'Fil de bord', within: '#phone .sheet' } },
    ],
    measures: DRAWER_MEASURES,
  }),
  scenario('carnet-creer-etape2', 'Carnet · feuille Créer', 'étape 2 : formulaire d’un moment texte', 'participant', {
    appSteps: [
      ...editApp,
      { click: { css: '.lkdv-ig-tile-add, [aria-label="Ajouter un moment"]', nth: 0 } },
      { click: { role: 'button', name: 'Texte' } },
    ],
    maqSteps: [...editMaq, { click: { css: '[data-a="create"]', nth: 0 } }, { click: { css: '[data-a="ctype"][data-t="text"]' } }],
    measures: [],
  }),
  /* Visiteur : une personne qui n'est pas l'auteur voit le champ « Envoyer un message… » (on ne répond pas à soi-même).
     Le média plein cadre est masqué (photo réelle) : le ratio de pixels est donc non significatif, le banc compare
     les boîtes (barre de progression, pilule auteur, ···, dock) par mesures DOM. */
  scenario('carnet-stories', 'Carnet · stories', 'visionneuse ouverte depuis la couverture', 'visiteur', {
    hash: 'visiteur',
    appUrl: `/carnets/${STORIES_CARNET_ID}`,
    appSteps: [{ eval: "document.querySelector('.lkdv-ig-avi-wrap').click()" }, { wait: 600 }],
    maqSteps: [panel('[data-a="avatar"]')],
    measures: [
      measure('Barre de progression', '.lkdv-story-progress', '#story .st-bar', []),
      measure('Pilule auteur', '.lkdv-story-viewer .lkdv-post-author', '#story .st-by .lkdv-post-author', ['border-radius', 'height']),
      measure('Bouton ···', '.lkdv-story-viewer .pmi-more-pill', '#story .pmi-more-pill', ['border-radius', 'width', 'height']),
      measure('Dock de réponse', '.lkdv-story-dock', '#story .lkdv-story-dock', []),
      measure('Actions (j’aime, partage)', '.lkdv-story-actions', '#story .lkdv-story-actions', ['border-radius']),
    ],
    masks: {
      app: ['.lkdv-story-viewer img', '.lkdv-story-viewer video'],
      maquette: ['#story .st-media'],
    },
  }),
  scenario('carnet-chargement', 'Carnet · Résumé', 'chargement (squelette)', 'participant', {
    appUrl: `/carnets/${LOADING_CARNET_ID}`,
    noHydrate: true,
    maqSteps: [panel('[data-p="replay"]')],
    measures: [],
  }),
  scenario('carnet-hors-ligne', 'Carnet · Résumé', 'hors ligne', 'participant', {
    appSteps: [{ eval: "window.dispatchEvent(new Event('offline'))" }],
    measures: [],
    nonAtteignable: {
      maquette: 'la maquette ne montre aucun état hors ligne (bandeau « Hors ligne » : texte de la spec § 8, sans rendu de référence) ; couvert par CarnetFinition.test.tsx « hors ligne »',
    },
  }),
  scenario('carnet-carte-indisponible', 'Carnet · carte du bas', 'carte indisponible (WebGL refusé)', 'participant', {
    measures: [],
    nonAtteignable: {
      maquette: 'la maquette n’a pas d’état « Carte indisponible » (carte dessinée en SVG, sans WebGL) ; couvert par CompteMapUnavailable.test.tsx (mock du contexte WebGL)',
    },
  }),
  scenario('carnet-resume-visiteur', 'Carnet · Résumé', 'chargé', 'visiteur', {
    hash: 'visiteur',
    measures: [...PAGE_MEASURES, DAY_CARD],
  }),
  scenario('carnet-resume-vide', 'Carnet · Résumé', 'vide (aucun moment, aucune étape)', 'participant', {
    appUrl: `/carnets/${EMPTY_CARNET_ID}`,
    maqSteps: [panel('[data-p="empty"]')],
  }),
  scenario('carnet-tiroir-erreur', 'Carnet · tiroir', 'erreur de chargement du slot', 'participant', {
    hash: 'fil',
    maqSteps: [panel('[data-p="err-slot"]')],
    nonAtteignable: {
      app: 'CarnetDrawerV2 n’a aucun état d’erreur de slot ni bouton « Réessayer » (CHECKLIST-100 l.76 ouverte) : rien à atteindre côté app',
    },
  }),
];

