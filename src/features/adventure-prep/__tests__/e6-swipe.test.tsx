/**
 * E6 — le balayage de jour existe dans le moteur, et n existait a l ecran.
 *
 * `swipeIntent` et `dayAfterSwipe` saient depuis le debut dire ce qu un geste
 * veut dire et quel jour il vise. Aucun composant ne les appelait : le CSS
 * meme (`overflow-x: hidden` sur `.prep-body`) reservait pourtant le geste
 * horizontal au changement de jour. 48 tests portaient sur une fonction morte.
 *
 * Ce fichier verifie deux choses distinctes, et les deux sont necessaires :
 * 1. le CABLAGE — le geste est porte par le corps de l etape 2, donc ni par la
 *    barre basse (son frere, hors du corps), ni par les tiroirs (portales hors
 *    du corps), ni par la carte (qui a ses propres gestes) ;
 * 2. le GESTE — un vrai touchstart/touchmove/touchend change reellement le jour
 *    affiche, un scroll vertical non, un geste trop court non.
 *
 * Harnais : `renderToStaticMarkup` (ni DOM ni Testing Library dans ce projet).
 * Deux consequences, assumees et documentees :
 * - React ecarte les gestionnaires d evenement au rendu serveur, donc le
 *   cablage est verifie en marquant le hook (E6-01) ;
 * - zustand v5 sert l etat INITIAL en rendu serveur, donc le harnais lit et ecrit
 *   le store par `getState()`. Ce n'est pas une doublure : le `selectDay` appele
 *   est bien celui du store partage avec le rail de jours.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { TouchEvent as ReactTouchEvent } from 'react';
import { ItineraryStepScreen } from '../components/ItineraryStep';
import { useDaySwipe, type DaySwipeHandlers } from '../hooks/useDaySwipe';
import { useDayFocusStore, type DayFocusDay } from '@/components/mobile-nav/dayFocusStore';
import { buildItinerary } from '../engine/itinerary';
import { fullDraft } from './fixtures';
import type { AdventurePrepDraft } from '../types';

/* --- Le store du preparateur : selecteur pur (harnais SSR) -------------- */

const state = vi.hoisted(() => ({ current: null as { draft: AdventurePrepDraft } | null }));

vi.mock('../store/useAdventurePrepStore', () => {
  const use = ((selector: (store: { draft: AdventurePrepDraft }) => unknown) =>
    selector(state.current as { draft: AdventurePrepDraft })) as unknown as {
    getState: () => unknown;
  };
  use.getState = () => state.current;
  return { useAdventurePrepStore: use };
});

/**
 * Le hook est le VRAI, sauf quand un test demande de le marquer.
 *
 * `actif` ajoute un attribut DOM que le rendu serveur conserve : c est la seule
 * facon de prouver, sans DOM, QUE l ecran pose les gestionnaires sur la bonne
 * zone. Le comportement, lui, n est jamais simule.
 */
const marque = vi.hoisted(() => ({ actif: false, valeur: 'contenu' }));

vi.mock('../hooks/useDaySwipe', async (importOriginal) => {
  const reel = await importOriginal<typeof import('../hooks/useDaySwipe')>();
  return {
    ...reel,
    useDaySwipe: (options: Parameters<typeof reel.useDaySwipe>[0]) => {
      const handlers = reel.useDaySwipe(options);
      if (!marque.actif) return handlers;
      return { ...handlers, 'data-day-swipe': marque.valeur };
    },
  };
});

/* --- Outils de geste --------------------------------------------------- */

interface Point {
  readonly clientX: number;
  readonly clientY: number;
}

function pointe(x: number, y: number): Point {
  return { clientX: x, clientY: y };
}

function evenement(
  touches: readonly Point[] = [],
  changedTouches: readonly Point[] = [],
  target: unknown = null,
): ReactTouchEvent<Element> {
  return { touches, changedTouches, target } as unknown as ReactTouchEvent<Element>;
}

const capture = { handlers: null as DaySwipeHandlers | null };

/**
 * Harnais du hook : il rend le jour affiche et garde ses gestionnaires.
 *
 * Il lit le store par `getState()` parce que le rendu serveur sert l etat
 * initial de zustand. Les options sont celles de l ecran, gardees par defaut :
 * la protection de la carte n est donc pas une option du test, c est bien le
 * comportement par defaut du hook.
 */
function Harnais({
  days,
  onSelectDay,
}: {
  days: number;
  onSelectDay?: (day: number | null) => void;
}) {
  const store = useDayFocusStore.getState();
  const handlers = useDaySwipe({
    current: store.selectedDay,
    days,
    onSelectDay: onSelectDay ?? store.selectDay,
  });
  capture.handlers = handlers;
  return <p>{store.selectedDay === null ? 'Ensemble' : `Jour ${store.selectedDay}`}</p>;
}

function afficher(days: number, onSelectDay?: (day: number | null) => void): string {
  return renderToStaticMarkup(
    React.createElement(Harnais, { days, ...(onSelectDay ? { onSelectDay } : {}) }),
  );
}

/** Ce que la personne voit : le jour courant, en toutes lettres. */
function jourAffiche(days: number, onSelectDay?: (day: number | null) => void): string {
  return afficher(days, onSelectDay)
    .replace(/<[^>]*>/g, '')
    .trim();
}

/** Les gestionnaires du harnais, en montant s il le faut. */
function gestionnaires(): DaySwipeHandlers {
  if (!capture.handlers) afficher(3);
  const handlers = capture.handlers;
  if (!handlers) throw new Error('harnais non monte');
  return handlers;
}

function geste(de: Point, a: Point, target: unknown = null): void {
  const handlers = gestionnaires();
  handlers.onTouchStart(evenement([de], [], target));
  handlers.onTouchMove(evenement([a], [], target));
  handlers.onTouchEnd(evenement([], [a], target));
}

/**
 * Les deux sens, nommes comme le moteur les nomme.
 *
 * `swipeIntent` lit le DEPLACEMENT DU DOIGT : vers la droite = suivant, vers la
 * gauche = precedent. Ecrire les coordonnees ici plutot que dans chaque test
 * evite d'inverser un geste en croyant ecrire l'autre — une inversion passe
 * inapercue tant que le carrousel est ferme.
 */
const DEPART = pointe(200, 300);

/** Vers la droite : le jour suivant. */
function avancer(dy = 0, target: unknown = null): void {
  geste(DEPART, pointe(DEPART.clientX + 140, DEPART.clientY + dy), target);
}

/** Vers la gauche : le jour precedent. */
function reculer(dy = 0, target: unknown = null): void {
  geste(DEPART, pointe(DEPART.clientX - 140, DEPART.clientY + dy), target);
}

function troisJours(): DayFocusDay[] {
  return [1, 2, 3].map((day) => ({
    day,
    dateLabel: null,
    stepsCount: 2,
    distanceKm: null,
    elevGainM: null,
  }));
}

function texte(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function construit(): AdventurePrepDraft {
  const draft = fullDraft();
  const model = buildItinerary(draft);
  if (!model) throw new Error('fixture : le brouillon de base doit etre construisible');
  return { ...draft, itinerary: model };
}

function ecran(draft: AdventurePrepDraft = construit()): string {
  state.current = { draft };
  return renderToStaticMarkup(
    React.createElement(ItineraryStepScreen, { onOpenSheet: () => undefined }),
  );
}

beforeEach(() => {
  marque.actif = false;
  capture.handlers = null;
  state.current = { draft: construit() };
  useDayFocusStore.getState().clear();
  useDayFocusStore.getState().publishDays(troisJours());
});

describe('E6 — le balayage est cable sur le contenu de l etape 2', () => {
  it('E6-01: la zone de contenu porte le geste, et elle seule', () => {
    marque.actif = true;
    const html = ecran();

    const porteuse = html.match(/<div[^>]*data-day-swipe="contenu"[^>]*>/);
    expect(porteuse).not.toBeNull();
    // Le corps, PAS la barre basse (`.prep-footer` est son frere) ni la carte.
    expect(porteuse?.[0]).toContain('class="prep-body"');
    expect(porteuse?.[0]).not.toContain('prep-footer');
    expect(porteuse?.[0]).not.toContain('prep-map');
    // Un seul point d entree : pas un second ecran qui pretend balayer aussi.
    expect(html.split('data-day-swipe=').length - 1).toBe(1);
  });

  it('E6-02: balayer a droite affiche le jour suivant', () => {
    expect(jourAffiche(3)).toBe('Ensemble');
    avancer();
    expect(jourAffiche(3)).toBe('Jour 1');
    avancer();
    expect(jourAffiche(3)).toBe('Jour 2');
  });

  it('E6-03: balayer a gauche revient au jour precedent, jusqu a Ensemble', () => {
    useDayFocusStore.getState().selectDay(2);
    expect(jourAffiche(3)).toBe('Jour 2');
    reculer();
    expect(jourAffiche(3)).toBe('Jour 1');
    // Le rail est un carrousel ferme : aucun geste ne finit sur une impasse.
    reculer();
    expect(jourAffiche(3)).toBe('Ensemble');
  });

  it('E6-04: un scroll vertical ne change jamais de jour', () => {
    useDayFocusStore.getState().selectDay(2);
    expect(jourAffiche(3)).toBe('Jour 2');
    geste(pointe(200, 200), pointe(196, 520));
    expect(jourAffiche(3)).toBe('Jour 2');
  });

  it('E6-05: un geste trop court ne change pas de jour', () => {
    useDayFocusStore.getState().selectDay(2);
    geste(pointe(200, 300), pointe(180, 302));
    expect(jourAffiche(3)).toBe('Jour 2');
  });

  it('E6-06: un geste diagonal reste un defilement', () => {
    useDayFocusStore.getState().selectDay(2);
    // 50 px a l horizontale pour 220 a la verticale : ce n est pas un balayage.
    geste(pointe(200, 300), pointe(150, 520));
    expect(jourAffiche(3)).toBe('Jour 2');
  });

  it('E6-07: un pincement a deux doigts n est pas un balayage de jour', () => {
    useDayFocusStore.getState().selectDay(2);
    const handlers = gestionnaires();
    handlers.onTouchStart(evenement([pointe(200, 300), pointe(280, 300)]));
    handlers.onTouchEnd(evenement([], [pointe(60, 300)]));
    expect(jourAffiche(3)).toBe('Jour 2');
  });

  it('E6-08: un balayage qui commence sur la carte lui appartient', () => {
    useDayFocusStore.getState().selectDay(2);
    const surLaCarte = { closest: (selecteur: string) => (selecteur === '.prep-map' ? {} : null) };
    const horsCarte = { closest: () => null };

    avancer(0, surLaCarte);
    expect(jourAffiche(3)).toBe('Jour 2');

    // Temoin : le meme geste, ailleurs, change bien de jour. Ce n est donc pas
    // le seuil qui a refuse le geste, c est la zone.
    avancer(0, horsCarte);
    expect(jourAffiche(3)).toBe('Jour 3');
  });

  it('E6-09: sans programme, aucun geste ne bouge le jour', () => {
    // Pas d itineraire : le hook recoit zero journee.
    expect(jourAffiche(0)).toBe('Ensemble');
    avancer();
    expect(jourAffiche(0)).toBe('Ensemble');
  });

  it('E6-10: un voyage mono-jour n a rien a balayer', () => {
    useDayFocusStore.getState().selectDay(1);
    // Le rail n est pas rendu sous deux journees : aucune navigation ne doit
    // exister derriere, sinon l etat bouge sans que rien ne l annonce.
    expect(jourAffiche(1)).toBe('Jour 1');
    avancer();
    expect(jourAffiche(1)).toBe('Jour 1');
  });

  it('E6-11: un geste annule ne laisse pas de trace', () => {
    useDayFocusStore.getState().selectDay(2);
    const handlers = gestionnaires();
    handlers.onTouchStart(evenement([pointe(200, 300)]));
    handlers.onTouchCancel();
    handlers.onTouchEnd(evenement([], [pointe(340, 300)]));
    expect(jourAffiche(3)).toBe('Jour 2');
  });

  it('E6-12: la selection recoit exactement le jour vise, une seule fois', () => {
    useDayFocusStore.getState().selectDay(1);
    const onSelectDay = vi.fn();
    afficher(3, onSelectDay);
    avancer();
    expect(onSelectDay).toHaveBeenCalledTimes(1);
    expect(onSelectDay).toHaveBeenCalledWith(2);
  });

  it('E6-13: le rail de jours reste un chemin — le geste n est jamais le seul', () => {
    const rail = ecran().match(/<div class="prep-days"[^>]*>([\s\S]*?)<\/div>/)?.[1] ?? '';
    const libelles = texte(rail);
    // Un voyage de trois journees : « Tout », « Jour 1 », « Jour 2 », « Jour 3 ».
    expect(libelles).toContain('Tout');
    expect(libelles).toContain('Jour 2');
    expect(libelles).toContain('Jour 3');
    // Ce sont des <button>, donc ils restent atteignables au clavier.
    expect((rail.match(/<button/g) ?? []).length).toBe(4);
  });
});