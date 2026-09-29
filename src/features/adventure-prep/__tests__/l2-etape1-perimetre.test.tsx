/**
 * L2 — ou vit reellement la surface de l etape 1 « Creations ».
 *
 * POURQUOI CE FICHIER EXISTE
 *
 * La section L2 de `CHECKLIST-PREP.md` porte sur l ETAPE 1. Le routage de
 * `PrepFlow.tsx` est sans ambiguite :
 *
 *   step === 'destination' -> <DestinationStep />       <- etape 1 « Creations »
 *   step === 'itinerary'   -> <ItineraryStepScreen />  <- etape 2 « Preparation »
 *   step === 'departure'   -> <DepartureStep />         <- etape 3 « En avant ! »
 *
 * Les items L2.3 a L2.6 (ligne Depart, ligne Arrivee, picker de date, duree
 * estimee) sont des proprietes de l ETAPE 1 : ils se jouent dans
 * `DestinationStep.tsx` et `stepOneProfile.ts`. `DepartureStep.tsx` est le
 * RECAPITULATIF — l ecran qui enregistre et redirige vers le hub. Luiyer
 * attribuer L2.3 a L2.6 n aurait rien corrige.
 *
 * Trois items sont en revanche demontrables ici, parce qu ils sont des
 * ABSENCES et qu une absence se prouve sur l etape 1 :
 *
 *   - L2.7  le scroller de jours ne doit PAS etre sur l etape 1 ;
 *   - L2.9  le bouton « Zone » ne doit PAS-etre sur l etape 1 ;
 *   - L2.10 « Agrandir » / « Recentrer » ne doivent PAS-etre sur l etape 1.
 *
 * Ce sont des garde-fous de non-regression : si le scroller ou la carte
 * revenaient sur l etape 1, ces trois tests rougiraient.
 *
 * LA PREUVE N EST PAS VACANTE
 *
 * Un test qui dit « la carte n est pas la » passe aussi bien si la carte
 * etait presente mais invisible. Chaque assertion d absence est donc
 * accompagnee d un CONTRE-EXEMPLE tire d un ecran REEL du meme depot : si la
 * sonde etait aveugle, le contre-exemple le prouverait.
 *
 * Harnais : `renderToStaticMarkup`, comme le reste du dossier (ni DOM ni
 * Testing Library ici). Zustand v5 sert l etat INITIAL en rendu serveur, donc
 * le store est pilote par `getState()` — ce n est pas une doublure.
 */

import { describe, expect, it, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DestinationStep } from '../components/DestinationStep';
import DayPlateau from '@/components/mobile-nav/navigation/DayPlateau';
import { DepartureStep } from '../components/DepartureStep';
import { ItineraryStepScreen } from '../components/ItineraryStep';
import { useDayFocusStore, type DayFocusState } from '@/components/mobile-nav/dayFocusStore';
import { buildItinerary } from '../engine/itinerary';
import { fullDraft } from './fixtures';
import type { AdventurePrepDraft } from '../types';

const state = vi.hoisted(() => ({ current: null as { draft: AdventurePrepDraft } | null }));

vi.mock('../store/useAdventurePrepStore', () => {
  const use = ((selector: (store: { draft: AdventurePrepDraft }) => unknown) =>
    selector(state.current as { draft: AdventurePrepDraft })) as unknown as {
    getState: () => unknown;
  };
  use.getState = () => state.current;
  return { useAdventurePrepStore: use };
});

// Le recapitulatif appelle `useRouter()` au rendu. Sans routeur monte, Next
// leve « invariant expected app router to be mounted » — un echec de harnais,
// pas un echec de produit. Le routeur n est appele qu au clic sur
// « Enregistrer », donc aucune de ces assertions ne touche a la navigation.
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: () => undefined,
    replace: () => undefined,
    back: () => undefined,
    prefetch: () => undefined,
  }),
}));

/**
 * L2-07b - le rail de jours vit dans le CHROME.
 *
 * `DayPlateau` est monte par `WebNavigationBar`, dans un arbre React disjoint :
 * le corps de l etape 2 ne le rend donc plus (L3.7 a retire le doublon), et
 * compter ses onglets demande de le monter pour compte. Meme limite de harnais
 * que dans `etape2-hierarchie.test.tsx` : zustand v5 sert l etat INITIAL au
 * rendu serveur, donc un composant monte par `renderToStaticMarkup` ne voit
 * jamais les journees publiees. Ce shim ne fabrique rien et ne doublure aucun
 * comportement - `getState`, `setState` et `subscribe` restent ceux du vrai
 * store ; seul le snapshot serveur change.
 */
vi.mock('@/components/mobile-nav/dayFocusStore', async (importOriginal) => {
  const reel = await importOriginal<typeof import('@/components/mobile-nav/dayFocusStore')>();
  const store = reel.useDayFocusStore;
  const useSSR = ((selector: (s: DayFocusState) => unknown) =>
    selector(store.getState())) as unknown as typeof store;
  Object.assign(useSSR, store);
  return { ...reel, useDayFocusStore: useSSR };
});

const noop = () => undefined;

function draftConstruit(): AdventurePrepDraft {
  const draft = fullDraft();
  const model = buildItinerary(draft);
  if (!model) throw new Error('fixture : le brouillon de base doit etre construisible');
  return { ...draft, itinerary: model };
}

function rendreEtape1(draft: AdventurePrepDraft): string {
  state.current = { draft };
  return renderToStaticMarkup(React.createElement(DestinationStep, { onOpenSheet: noop }));
}

function rendreEtape2(draft: AdventurePrepDraft): string {
  state.current = { draft };
  return renderToStaticMarkup(React.createElement(ItineraryStepScreen, { onOpenSheet: noop }));
}

function rendreEtape3(draft: AdventurePrepDraft): string {
  state.current = { draft };
  return renderToStaticMarkup(React.createElement(DepartureStep, { onOpenSheet: noop }));
}

function visible(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#x27;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Un scroller de jours se reconnait a son role de groupe, pas a une classe.
 * `.prep-days` a disparu du corps de l etape 2 (L3.7) : ne le chercher que
 * laisserait passer une absence de rail pour une preuve de proprete. On
 * regarde donc ce que la machine lit ET ce que la personne voit.
 */
function porteScrollerDeJours(html: string): boolean {
  return html.includes('role="tablist"') || visible(html).includes('Tout');
}

/**
 * Publie les journees du modele dans le store partage, comme le fait le shell,
 * puis rend le rail du chrome pour compte. Renvoie le markup ET ce que le
 * store a ACCEPTE - pas ce qu on lui a donne.
 */
function railDuChrome(model: { days: number }): { html: string; jours: number } {
  useDayFocusStore.getState().clear();
  useDayFocusStore.getState().publishDays(
    Array.from({ length: model.days }, (_, index) => ({
      day: index + 1,
      dateLabel: null,
      stepsCount: 0,
      distanceKm: null,
      elevGainM: null,
    })),
  );
  return {
    html: renderToStaticMarkup(React.createElement(DayPlateau)),
    jours: useDayFocusStore.getState().days.length,
  };
}

/** Les trois controles de carte qui runaway du contenu sur l etape 1. */
function controlesCarte(html: string): string[] {
  const trouves: string[] = [];
  if (html.includes('Zone')) trouves.push('Zone');
  if (html.includes('Agrandir la carte')) trouves.push('Agrandir');
  if (html.includes('Recentrer sur le parcours')) trouves.push('Recentrer');
  return trouves;
}

describe('L2 — ou est la surface de l etape 1', () => {
  // Ces trois assertions ferment la porte a l erreur qui a fait naaitre ce
  // fichier : attribuer a l etape 3 une correction d etape 1.

  it('L2-00a : l etape 1 porte les quatre lignes de la section L2', () => {
    const texte = visible(rendreEtape1(fullDraft()));
    expect(texte).toContain('Départ');
    expect(texte).toContain('Arrivée');
    expect(texte).toContain('Date');
    expect(texte).toContain('Durée estimée');
  });

  it('L2-00b : le recapitulatif est l ecran de sauvegarde, pas l etape 1', () => {
    expect(visible(rendreEtape3(fullDraft()))).toContain('Enregistrer mon aventure');
  });

  it('L2-00c : le recapitulatif ne porte aucune des lignes de l etape 1', () => {
    // « Durée estimée » est la cellule propre a l etape 1 : elle vient de
    // `stepOneProfile`. Si le recapitulatif la portait, l attribution des
    // items L2 serait ambigue et il faudrait les corriger deux fois.
    expect(visible(rendreEtape3(fullDraft()))).not.toContain('Durée estimée');
  });
});

describe('L2-7 — le scroller de jours appartient a l etape 2', () => {
  it('L2-07 : l etape 1 ne rend aucun scroller de jours', () => {
    expect(porteScrollerDeJours(rendreEtape1(fullDraft()))).toBe(false);
  });

  it('L2-07b : contre-exemple — le rail existe, dans le chrome, un onglet par jour', () => {
    // Sans ce contre-exemple, L2-07 prouverait que la sonde ne trouve rien,
    // pas que l etape 1 est propre. Le rail de jours est l autre moitie du
    // produit : s il cesse d afficher ses journees, c est la sonde qui est
    // cassee. Il vit dans le chrome - partage par les trois etapes - et nulle
    // part ailleurs, ce que L2-07c verifie.
    const draft = draftConstruit();
    state.current = { draft };
    const model = draft.itinerary!;
    const rail = railDuChrome(model);
    expect(porteScrollerDeJours(rail.html)).toBe(true);
    // Ce que le store a ACCEPTE, pas ce qu on lui a donne : sous deux journees
    // le store vide ses jours, et un test qui compterait le modele au lieu du
    // store validerait un rail qui n existe pas.
    expect(rail.jours).toBe(model.days);
    expect(rail.html).toContain('Tout');
    expect(Array.from(rail.html.matchAll(/role="tab"/g)).length).toBe(model.days + 1);
  });

  it('L2-07c : le rail est dans le chrome, pas dans le corps d une etape', () => {
    // Le doublon retire (L3.7) ne doit pas revenir par l autre bout : ni dans
    // l etape 1, ni dans le corps de l etape 2, qui affiche pourtant autant de
    // journees. Un seul rail, dans la barre basse.
    const draft = draftConstruit();
    state.current = { draft };
    expect(porteScrollerDeJours(rendreEtape1(draft))).toBe(false);
    expect(porteScrollerDeJours(rendreEtape2(draft))).toBe(false);
    const rail = railDuChrome(draft.itinerary!);
    expect(Array.from(rail.html.matchAll(/role="tablist"/g)).length).toBe(1);
  });
});

describe('L2-9 / L2-10 — aucun controle de carte sur l etape 1', () => {
  it('L2-09 : le bouton Zone ne supperpose rien sur l etape 1', () => {
    expect(controlesCarte(rendreEtape1(fullDraft()))).not.toContain('Zone');
  });

  it('L2-10 : ni Agrandir ni Recentrer ne mangent la carte de l etape 1', () => {
    expect(controlesCarte(rendreEtape1(fullDraft()))).toEqual([]);
  });

  it('L2-09b : contre-exemple — le recapitulatif, lui, affiche bien sa carte', () => {
    // Le recapitulatif garde sa carte : c est l etape 1 qui l a perdue. Ce
    // contre-exemple est ce qui distingue « l etape 1 est propre » de « la
    // carte a ete supprimee du produit ».
    const trouve = controlesCarte(rendreEtape3(fullDraft()));
    expect(trouve).toContain('Agrandir');
    expect(trouve).toContain('Recentrer');
  });
});