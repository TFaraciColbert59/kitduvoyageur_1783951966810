/**
 * Focus jour — source unique de verite du « jour » selectionne dans le hub.
 *
 * Pourquoi un store module et pas un contexte React : la bottom bar est rendue
 * par `MobileNavWrapper` dans `src/app/layout.tsx` (overlay `position: fixed`),
 * tandis que le contenu du hub vit dans `AppShell` monte par `HubShell`. Les
 * deux sont des arbres React DISJOINTS : aucun contexte ne peut les relier.
 * C'est exactement le meme contrat que `hasExtendedNav` + `window.CustomEvent`,
 * mais avec un etat au lieu d'un evenement — parce qu'un jour selectionne doit
 * survivre aux changements de section.
 *
 * Regles :
 * - le store est ALIMENTE par le client uniquement (jamais de persistance) :
 *   le premier rendu serveur et le premier rendu client voient donc le meme
 *   etat vide, et l'apparition du plateau est un ajout post-hydratation — pas
 *   un mismatch d'hydratation ;
 * - `null` = vue globale du voyage ; un entier >= 1 = jour focalise ;
 * - la selection est purgee des que le jour n'existe plus (jour supprime,
 *   voyage change, retour sur un voyage mono-jour).
 */

import { create } from 'zustand';

/**
 * Surfaces qui portent le plateau jour : le hub ET le preparateur.
 *
 * Le rail jour doit etre le MEME everywhere — c'est la condition pour que la
 * selection survive d'un ecran a l'autre. Le preparateur y expose le
 * programme deja decoupe en journees, exactement comme le hub : les deux
 * lectures de la meme aventure doivent produire les memes onglets.
 *
 * Duplique volontairement de `isHubSurfacePathname`
 * (features/hub/context/adventureLists) : importer ce module ici tirerait
 * `hubSectionRegistry` — donc toutes les icones Lucide — dans `AppShell`,
 * monte sur TOUTES les pages. Le prefixe de route se paie en deux lignes de
 * plus plutot qu'en icones sur tout le site. Le hub garde la racine seule
 * (`/hub`) ; le preparateur garde la racine ET ses sous-ecrans.
 */
const DAY_FOCUS_SURFACE_PREFIXES: readonly string[] = ['/hub', '/prepare'];

export function isDayFocusSurfacePathname(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return DAY_FOCUS_SURFACE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/** Jour publie par le hub, derive de `trip_steps.day_number`. */
export interface DayFocusDay {
  day: number;
  /** Date civile courte (« sam. 12 »), null si le voyage n'a pas de dates. */
  dateLabel: string | null;
  stepsCount: number;
  /**
   * Mesures du jour, `null` quand elles ne sont pas verifiees.
   *
   * Le rail affiche ces nombres sans contexte : un `0` se lirait comme une
   * mesure reelle. `null` oblige donc l'affichage a dire « à vérifier ».
   */
  distanceKm: number | null;
  elevGainM: number | null;
}

export interface DayFocusState {
  days: DayFocusDay[];
  /** `null` = vue globale ; sinon 1..days.length. */
  selectedDay: number | null;
  /**
   * L ecran courant affiche-t-il un contenu focusable par jour ?
   *
   * Un rail de jours sur un ecran qui n en montre aucun est un CONTROLE MORT :
   * il repond, `aria-selected` passe, et rien ne bouge a l ecran. C est
   * exactement le symptome « le selecteur de jours ne se met pas a jour sur
   * toutes les pages ». L etape 1 (« Creations ») n a aucun jour a
   * surligner, donc elle publie `false`.
   *
   * Ce flag est VISUEL : il masque le rendu et la reservation, il ne purge ni
   * les journees ni la selection — sinon revenir a l etape 2 perdrait le jour
   * choisi. Il repasse a `true` par defaut et le hub ne le touche jamais.
   */
  focusable: boolean;
  publishDays: (days: DayFocusDay[]) => void;
  selectDay: (day: number | null) => void;
  setFocusable: (focusable: boolean) => void;
  clear: () => void;
}

const EMPTY: DayFocusDay[] = [];

/**
 * Le plateau jour n'apparait qu'une fois le voyage decoupe en AU MOINS DEUX
 * journees : un voyage d'une seule journee n'a rien a focaliser, et afficher
 * une barre « J1 » au-dessus de la bottom bar serait du bruit.
 */
export function isDayFocusReady(days: readonly DayFocusDay[]): boolean {
  return days.length > 1 && days.every((entry) => Number.isInteger(entry.day) && entry.day >= 1);
}

/**
 * Decide si la bottom bar doit reserver la hauteur du plateau jour.
 *
 * Fonction PURE volontairement evaluee a deux endroits, comme
 * `hasExtendedNav` : `AppShell` (reservation) et `WebNavigationBar` (rendu)
 * sont dans deux arbres React distincts, donc aucun contrat type ne peut les
 * relier. Une seule fonction partagee garantit qu'ils ne peuvent pas diverger.
 *
 * Le store doit etre purge hors des surfaces focus : sans cette garde, un
 * voyage a plusieurs jours ferait reservation etendue sur des pages sans
 * plateau.
 */
export function hasDayFocusPlateau(
  pathname: string | null | undefined,
  days: readonly DayFocusDay[],
  focusable: boolean = true,
): boolean {
  return isDayFocusSurfacePathname(pathname) && isDayFocusReady(days) && focusable;
}

function isValidDay(days: readonly DayFocusDay[], day: number | null): day is number {
  return day != null && days.some((entry) => entry.day === day);
}

export const useDayFocusStore = create<DayFocusState>((set) => ({
  days: EMPTY,
  selectedDay: null,
  focusable: true,

  publishDays: (days) =>
    set((state) => {
      const next = isDayFocusReady(days) ? days : EMPTY;
      // Rien n'est focusable tant que le plateau n'est pas visible : on evite
      // un etat « jour 2 selectionne » orphelin, invisible et non reinitialisable.
      if (next.length === 0) {
        if (state.days.length === 0 && state.selectedDay === null) return state;
        return { days: EMPTY, selectedDay: null };
      }
      if (state.days === next) return state;
      // Le jour selectionne survit s'il existe toujours (aller-retour entre
      // sections) ; sinon on retombe sur la vue globale.
      const kept = isValidDay(next, state.selectedDay) ? state.selectedDay : null;
      if (
        state.days.length === next.length &&
        state.days.every((entry, index) => entry === next[index]) &&
        kept === state.selectedDay
      ) {
        return state;
      }
      return { days: next, selectedDay: kept };
    }),

  selectDay: (day) =>
    set((state) => {
      if (!isDayFocusReady(state.days)) return state;
      const next = day === null ? null : isValidDay(state.days, day) ? day : null;
      if (next === state.selectedDay) return state;
      return { selectedDay: next };
    }),

  setFocusable: (focusable) =>
    set((state) => (state.focusable === focusable ? state : { focusable })),

  clear: () => set({ days: EMPTY, selectedDay: null, focusable: true }),
}));

/** Selecteur : le plateau jour doit-il etre rendu/reserve ici ? */
export function selectDayFocusPlateau(state: DayFocusState, pathname: string | null): boolean {
  return hasDayFocusPlateau(pathname, state.days, state.focusable);
}
