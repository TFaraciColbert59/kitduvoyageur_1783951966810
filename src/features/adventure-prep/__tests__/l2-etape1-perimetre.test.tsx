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
import { DepartureStep } from '../components/DepartureStep';
import { ItineraryStepScreen } from '../components/ItineraryStep';
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
 * Un scroller de jours se reconnait a son role de groupe. On ne cherche pas
 * seulement la classe CSS : le libelle est ce que la personne voit, et c est
 * lui qui doit disparaitre de l etape 1.
 */
function porteScrollerDeJours(html: string): boolean {
  return html.includes('prep-days') || visible(html).includes('Tout');
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

  it('L2-07b : contre-exemple — l etape 2, elle, rend bien le scroller', () => {
    // Sans ce contre-exemple, L2-07 prouverait que la sonde ne trouve rien,
    // pas que l etape 1 est propre. L etape 2 est l autre moitie du produit :
    // si elle cesse d afficher ses jours, c est la sonde qui est cassee.
    expect(porteScrollerDeJours(rendreEtape2(draftConstruit()))).toBe(true);
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