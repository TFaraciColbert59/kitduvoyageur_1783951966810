import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DestinationStep } from '../components/DestinationStep';
import {
  canCreateStepOne,
  stepOneMissing,
  stepOneMissingSummary,
  stepOneReadySummary,
} from '../components/stepOneProfile';
import { fullDraft } from './fixtures';
import type { AdventurePrepDraft } from '../types';

/**
 * AN7 + AN6 — l'etape 1.
 *
 * Le defaut mesure sur 393x852 : un CTA **actif** (« Creer mon parcours »)
 * surmontait « Il manque : lieu d'arrivee, date » — deux champs que le moteur
 * lui-meme declare non bloquants (`BLOCKING` ne contient que `origin` et
 * `duration`). L'ecran annoncait donc un blocage inexistant, et l'utilisateur
 * ne pouvait pas distinguer ce qui l'arretait de ce que l'IA completait.
 *
 * meme harnais que step-one-profile.test.tsx : sous `renderToStaticMarkup`,
 * zustand v5 sert l'etat INITIAL, donc le module du store est remplace par un
 * selecteur pur — le composant est reellement execute.
 */
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

function render(draft: AdventurePrepDraft): string {
  state.current = { draft };
  return renderToStaticMarkup(React.createElement(DestinationStep, { onOpenSheet: noop }));
}

function visible(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Depart et duree saisis, seule l'arrivee et la date manquent. */
function saufOptionnels(): AdventurePrepDraft {
  const base = fullDraft();
  return {
    ...base,
    route: { ...base.route, destination: null },
    calendar: { ...base.calendar, startDate: null, returnDate: null },
  };
}

describe('AN7 — le manque se dit blockers et facultatifs, jamais melanges', () => {
  it('AN7-1: le depart bloque, l arrivee et la date non', () => {
    // Rien d autre que le depart : c est le seul cas ou les deux listes
    // sont remplies en meme temps, donc le seul qui prouve la separation.
    const base = fullDraft();
    const toutSauf = fullDraft({
      route: { ...base.route, origin: null, destination: null },
      calendar: { ...base.calendar, startDate: null, returnDate: null },
    });
    const { blocking, optional } = stepOneMissing(toutSauf, 'trajet');
    expect(blocking).toEqual(['lieu de départ']);
    expect(optional).toEqual(['lieu d’arrivée', 'date']);
  });

  it('AN7-2: le CTA actif est exactement « aucun bloqueur »', () => {
    const complet = fullDraft();
    expect(stepOneMissing(complet, 'trajet').blocking).toEqual([]);
    expect(canCreateStepOne(complet, 'trajet')).toBe(true);

    const sansDepart = fullDraft({ route: { ...complet.route, origin: null } });
    expect(stepOneMissing(sansDepart, 'trajet').blocking.length).toBe(1);
    expect(canCreateStepOne(sansDepart, 'trajet')).toBe(false);
  });

  it('AN7-3: tant qu un bloqueur existe, aucune promesse de complements', () => {
    const sansDepart = fullDraft({ route: { ...fullDraft().route, origin: null } });
    expect(stepOneReadySummary(sansDepart, 'trajet')).toBeNull();
  });

  it('AN7-4: plus rien ne bloque, l ecran dit ce que l IA completera', () => {
    expect(stepOneReadySummary(saufOptionnels(), 'trajet')).toBe(
      'L’IA complètera : lieu d’arrivée, date'
    );
  });

  it('AN7-5: un CTA ACTIF n’est jamais surmonte par « Il manque »', () => {
    const text = visible(render(saufOptionnels()));
    expect(text).toContain('Créer mon parcours');
    expect(text).not.toContain('Il manque');
    expect(text).toContain('L’IA complètera');
  });

  it('AN7-6: un CTA bloque ne nomme QUE ce qui bloque', () => {
    const base = fullDraft();
    const sansDepart = fullDraft({
      route: { ...base.route, origin: null },
      calendar: { ...base.calendar, startDate: null, returnDate: null },
    });
    expect(visible(render(sansDepart))).toContain('Il manque : lieu de départ');
    expect(visible(render(sansDepart))).not.toContain('L’IA complètera');
  });

  it('AN7-7: le resume historique reste disponible et complet', () => {
    // On ne retire rien : `stepOneMissingSummary` continue de lister tout ce
    // qui manque, filtres compris. C est l affichage qui change, pas la mesure.
    expect(stepOneMissingSummary(fullDraft(), 'trajet')).toBeNull();
    expect(stepOneMissingSummary(saufOptionnels(), 'trajet')).toBe(
      'Il manque : lieu d’arrivée, date'
    );
  });
});

describe('AN6 — une duree proposee est affichee, jamais cachee', () => {
  it('AN6-1: une duree seulement proposee affiche son nombre', () => {
    const proposee = fullDraft({
      calendar: { ...fullDraft().calendar, durationDays: 3, durationIsSuggested: true },
    });
    const text = visible(render(proposee));
    expect(stepOneMissing(proposee, 'trajet').blocking).toEqual([]);
    expect(text).toContain('3 jours');
  });

  it('AN6-2: la pastille dit que la valeur est une proposition, pas un choix', () => {
    const proposee = fullDraft({
      calendar: { ...fullDraft().calendar, durationDays: 3, durationIsSuggested: true },
    });
    const text = visible(render(proposee));
    expect(text).toContain('modifiable');
    expect(text).not.toContain('Durée à préciser');
  });

  it('AN6-3: une duree vraiment choisie reste un choix, sans pastille', () => {
    const choisie = fullDraft({
      calendar: { ...fullDraft().calendar, durationDays: 2, durationIsSuggested: false },
    });
    const text = visible(render(choisie));
    expect(text).toContain('2 jours');
    expect(text).not.toContain('Proposé par l’IA');
  });
});
