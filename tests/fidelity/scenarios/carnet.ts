import type { FidelityRole, MeasureSpec, Scenario, Step } from '../lib/types';
import { CARNET_ID, CHROME_MASKS, GLASS, MAQUETTE_CARNET, TEXT, measure } from './common';

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
  ],
  maquette: [...CHROME_MASKS.maquette, '#phone .mapzone', '#phone .ig-avi', '#phone .ig-hl-ring', '#phone #acc'],
};

const PILL_PROPS = ['border-radius', 'font-size', 'font-weight', 'color', 'background-color', 'background-image', 'backdrop-filter', 'height'];

/** Mesures de la page (Résumé / jour). */
const PAGE_MEASURES: MeasureSpec[] = [
  measure('Pastille titre', '.lkdv-title-pill', '#rp', PILL_PROPS),
  measure('Bouton « + » (barre du haut)', '.lkdv-carnet-topbar-r .lkdv-gbtn', '.ig-top-r .gbtn', ['border-radius', 'background-color', 'width']),
  measure('Carte du carnet (verre)', '.lkdv-carnet-card', '#phone .card-scroll', ['border-radius']),
  measure('Statistique n°1', '.lkdv-ig-stat', '.ig-stat', ['font-size', 'color']),
  measure('Nom du carnet', '.lkdv-ig-name', '.ig-name', TEXT),
  measure('Sous-titre', '.lkdv-ig-handle-sub', '.ig-handle-sub', ['font-size', 'color']),
  measure('Bouton « Ouvrir le carnet »', '.lkdv-ig-open', '.ig-state .pbtn', ['border-radius', 'font-size', 'font-weight', 'color']),
  measure('Capsule de jours', '.lkdv-tabs-float', '.ig-tabs-float', ['border-radius', 'backdrop-filter']),
  measure('Poignée de carte', '.lkdv-mgrab', '.mgrab', ['border-radius']),
];

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
      hydrate: '.lkdv-title-pill',
      steps: options.appSteps ?? [],
      frame: APP_FRAME,
      frameWide: APP_FRAME,
    },
    maquette: { file: MAQUETTE_CARNET, hash: options.hash, steps: options.maqSteps ?? [], frame: MAQ_FRAME },
    masques: MASQUES,
    mesures: options.measures ?? PAGE_MEASURES,
    nonAtteignable: options.nonAtteignable,
  };
}

/** Les commandes du panneau de démo sont masquées sous 900 px : clic DOM direct. */
const panel = (selector: string): Step => ({ eval: `document.querySelector('${selector}').click()` });

const openDrawer: Step = { click: { role: 'button', name: 'Ouvrir le carnet' } };

function slot(id: string, label: string, hash: string): Scenario {
  const tab: Step[] = label === 'Fil de bord' ? [] : [{ click: { role: 'tab', name: label, within: '.lkdv-carnet-drawer' } }];
  return scenario(`carnet-tiroir-${id}`, `Carnet · tiroir ${label}`, 'chargé, première lentille', 'participant', {
    hash,
    appSteps: [openDrawer, { waitFor: { css: '.lkdv-carnet-drawer' } }, ...tab],
    measures: DRAWER_MEASURES,
  });
}

export const CARNET_SCENARIOS: Scenario[] = [
  scenario('carnet-resume-participant', 'Carnet · Résumé', 'chargé', 'participant', { measures: [...PAGE_MEASURES, DAY_CARD] }),
  scenario('carnet-j1-participant', 'Carnet · Jour 1', 'chargé', 'participant', {
    hash: 'jour1',
    appSteps: [{ click: { css: '.lkdv-day-capsule-btn', nth: 1 } }],
    measures: [...PAGE_MEASURES, DAY_CARD],
  }),
  slot('fil', 'Fil de bord', 'fil'),
  slot('route', 'Route', 'route'),
  slot('sac', 'Sac', 'sac'),
  slot('chiffres', 'Chiffres', 'chiffres'),
  slot('equipage', 'Équipage', 'equipage'),
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

