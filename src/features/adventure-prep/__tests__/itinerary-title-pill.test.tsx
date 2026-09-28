/**
 * P0.11 — Le titre de l'etape 2 est un bug de mise en page.
 *
 * Dans une seule pastille de verre cohabitaient le titre du parcours ET la
 * notice de generation, chacun replie sur trois ou quatre lignes, avec deux
 * icones sparkles. Ces tests verrouillent la forme voulue : UN titre dans la
 * pastille, UN sous-titre en dessous. Ils portent sur le MARQUAGE, parce que
 * deux textes dans une meme pastille ne se voient pas dans les tests de
 * contenu — ils se voient, ou pas, sur l'ecran.
 */

import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ItineraryStepScreen } from '../components/ItineraryStep';
import { buildItinerary } from '../engine/itinerary';
import { AI_ACCEPTED } from '../engine/itineraryPhases';
import { fullDraft } from './fixtures';
import type { AdventurePrepDraft, ItineraryModel } from '../types';

const state = vi.hoisted(() => ({ current: null as { draft: AdventurePrepDraft } | null }));

vi.mock('../store/useAdventurePrepStore', () => {
  const use = ((selector: (store: { draft: AdventurePrepDraft }) => unknown) =>
    selector(state.current as { draft: AdventurePrepDraft })) as unknown as {
    getState: () => unknown;
  };
  use.getState = () => state.current;
  return { useAdventurePrepStore: use };
});

const noop = () => undefined;

function draftWithNotice(notice: string | null): AdventurePrepDraft {
  const draft = fullDraft();
  const model: ItineraryModel = buildItinerary(draft)!;
  return { ...draft, itinerary: model, generation: { ...draft.generation, status: 'termine', notice } };
}

function render(): string {
  return renderToStaticMarkup(React.createElement(ItineraryStepScreen, { onOpenSheet: noop }));
}

/** Le contenu textuel de la SEULE pastille de titre, icones exclues. */
function pillText(html: string): string {
  const match = html.match(/<button[^>]*class="[^"]*prep-pill[^"]*"[^>]*>([\s\S]*?)<\/button>/);
  if (!match) throw new Error('pastille de titre introuvable');
  return match[1]
    .replace(/<[^>]*>/g, ' ')
    .replace(/&#x27;/g, "'")
    .replace(/&rsquo;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

describe('P0.11 — Un titre, un sous-titre, deux lignes', () => {
  it('P0.11-01: la pastille ne contient QUE le titre, jamais la notice', () => {
    state.current = { draft: draftWithNotice(AI_ACCEPTED) };
    // Sur l'ecran du 2026-09-28 la pastille lisait « Parcours sur mesure
    // Parcours enrichi par l'IA, puis verifie : les prix et les
    // disponibilites restent a confirmer. » sur trois lignes melangees.
    expect(pillText(render())).not.toContain('restent à confirmer');
    expect(pillText(render())).not.toContain(AI_ACCEPTED);
  });

  it('P0.11-02: la notice reste affichee, en dehors de la pastille', () => {
    state.current = { draft: draftWithNotice(AI_ACCEPTED) };
    // La notice ne doit pas disparaitre : elle dit honnetement que les prix
    // restent a confirmer. Elle change de place, pas de sens.
    expect(render()).toContain('restent à confirmer');
  });

  it('P0.11-03: le sous-titre est un bloc distinct, pas un second titre', () => {
    state.current = { draft: draftWithNotice(AI_ACCEPTED) };
    const html = render();
    const match = html.match(/<p[^>]*class="[^"]*prep-notice[^"]*"[^>]*>/);
    expect(match).not.toBeNull();
  });

  it('P0.11-04: une seule icone dans la pastille de titre', () => {
    state.current = { draft: draftWithNotice(AI_ACCEPTED) };
    const match = render().match(/<button[^>]*class="[^"]*prep-pill[^"]*"[^>]*>([\s\S]*?)<\/button>/)!;
    // Deux lucarnes sparkles dans une pastille de 40 px, c'est le meme
    // defaut de hierarchie : l'icone double suggere deux titres.
    // L'icone est un span masque (role="img"), pas un <svg> : c'est ce
    // marqueur-la qu'il faut compter, sinon le test passe sans rien prouver.
    expect((match[1].match(/role="img"/g) ?? []).length).toBe(1);
  });

  it('P0.11-05: sans notice, la pastille ne garde que le titre', () => {
    state.current = { draft: draftWithNotice(null) };
    const html = render();
    expect(html).not.toContain('prep-notice');
    expect(pillText(html)).not.toBe('');
  });
});
