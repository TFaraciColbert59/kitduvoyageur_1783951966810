import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DestinationStep } from '../components/DestinationStep';
import { canCreateStepOne, stepOneMissing, stepOneReadySummary } from '../components/stepOneProfile';
import { buildItineraryPrompt } from '../../../lib/ai/features/itinerary';
import { fullDraft } from './fixtures';
import type { AdventurePrepDraft } from '../types';

/**
 * D1 — « depart facultatif, CTA au strict necessaire ».
 *
 * Mesure du 2026-09-28, en 393x852 sur le vrai Preparateur : depart ET arrivee
 * reels (Chamonix-Mont-Blanc, Les Houches, deux lieux geocodes), et
 * « Creer mon parcours » reste `disabled`. L ecran annoncait « Il manque :
 * date, temps disponible ».
 *
 * Aucun des deux n etait un obstacle, et la consigne le dit mot pour mot :
 * « si on en selectionne aucune l IA choisit par elle-meme le moment le plus
 * opportun ». Le verrou venait de `BLOCKING`, ou `duration` figurait a cote
 * d `origin` alors que toute la chaine de choix existe deja (P0.15 pour la
 * date, P0.18 pour la duree).
 *
 * Ces tests portent sur le CAS REEL mesure — un brouillon sans date et sans
 * duree. Les tests AN7 existants utilisaient `fullDraft()`, qui en contient
 * une : ils ne pouvaient donc pas voir ce defaut.
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

/**
 * Le cas mesure : deux lieux reels, aucune date, aucune duree.
 *
 * `durationDays: null` + `durationIsSuggested: false` est l absence de duree —
 * `isMissing` teste `!durationDays`, et une proposition de l IA reste une
 * duree presente, donc seule la valeur compte ici.
 */
function deuxLieuxSansDateNiDuree(): AdventurePrepDraft {
  const base = fullDraft();
  return fullDraft({
    route: { ...base.route, origin: base.route.origin, destination: base.route.destination },
    calendar: {
      ...base.calendar,
      startDate: null,
      returnDate: null,
      durationDays: null,
      durationIsSuggested: false,
    },
  });
}

describe('D1 — le CTA ne demande que le strict necessaire', () => {
  it('D1-01: deux lieux et rien d autre suffisent', () => {
    // Le cas mesure, nom pour nom. Avant : false, et l ecran promettait un arret.
    expect(canCreateStepOne(deuxLieuxSansDateNiDuree())).toBe(true);
  });

  it('D1-02: la duree est un complement, jamais un bloqueur', () => {
    const { blocking, optional } = stepOneMissing(deuxLieuxSansDateNiDuree(), 'trajet');
    expect(blocking).toEqual([]);
    expect(optional).toContain('temps disponible');
    expect(optional).toContain('date');
  });

  it('D1-03: l ecran promet les trois complements, et rien d arret', () => {
    const base = fullDraft();
    const sansArrivee = deuxLieuxSansDateNiDuree();
    const ouvert = fullDraft({
      route: { ...sansArrivee.route, destination: null },
      calendar: sansArrivee.calendar,
    });
    expect(base.route.origin).not.toBeNull();
    expect(ouvert.route.origin).not.toBeNull();
    expect(stepOneReadySummary(ouvert, 'trajet')).toBe(
      'L’IA complètera : lieu d’arrivée, date, temps disponible'
    );
  });

  it('D1-04: le depart reste le seul bloqueur, et il se nomme', () => {
    const sansDepart = deuxLieuxSansDateNiDuree();
    const ouvert = fullDraft({
      route: { ...sansDepart.route, origin: null },
      calendar: sansDepart.calendar,
    });
    expect(canCreateStepOne(ouvert)).toBe(false);
    expect(stepOneMissing(ouvert, 'trajet').blocking).toEqual(['lieu de départ']);
    // Aucune promesse de complement sous un bouton mort : ce serait le
    // mensonge exact que AN7 a fait disappear.
    expect(stepOneReadySummary(ouvert, 'trajet')).toBeNull();
  });

  it('D1-05: rendu reel — un CTA actif, sans « Il manque »', () => {
    const text = visible(render(deuxLieuxSansDateNiDuree()));
    expect(text).toContain('Créer mon parcours');
    expect(text).not.toContain('Il manque');
    expect(text).toContain('L’IA complètera');
  });
});

/**
 * Le prompt doit dire la meme chose que l ecran.
 *
 * Tant que la duree n'est pas un fait, le prompt annoncait « Duree : 1
 * jour(s) » ET « Ce voyage dure 1 jour » — deux fois un defaut de calcul
 * (`durationDays ?? 1`) presente comme une decision — puis « choisis » une
 * fois. Le modele couvrait donc un jour en proposant trois, et sa proposition
 * partait refusee pour `journee_non_couverte`.
 */
const BRIEF_SANS_DUREE = 'je veux voir les sommets et manger bien';

const baseInput = {
  activityLabel: 'randonnee',
  originLabel: 'Chamonix-Mont-Blanc',
  destinationLabel: 'Les Houches',
  startDateLabel: null,
  durationDays: 1,
  briefDays: null as number | null,
  durationChosenByUser: false,
  partySize: 2,
  pace: 'normal',
  loop: false,
  preferences: [],
  knownPlaces: [],
  brief: BRIEF_SANS_DUREE,
};

function prompt(over: Partial<typeof baseInput>): string {
  return buildItineraryPrompt({ ...baseInput, ...over, todayIso: '2026-09-28' } as never).prompt;
}

describe('D1 — le prompt ne presente pas un defaut de calcul comme un fait', () => {
  it('D1-06: sans choix et sans brief, aucun jour n est annonce', () => {
    const p = prompt({});
    expect(p).not.toContain('Duree : 1 jour');
    expect(p).not.toContain('Ce voyage dure 1 jour');
    expect(p).toContain('Duree : pas choisie, a toi de la proposer');
    // La couverture suit la duree proposee, au lieu de la figer sur le defaut.
    expect(p).toContain('chaque journee de 1 a la valeur que tu proposes');
    expect(p).toContain('suggestedDurationDays');
  });

  it('D1-07: une duree CHOISIE reste un fait, des la ligne jusqu a la couverture', () => {
    const p = prompt({ durationDays: 4, durationChosenByUser: true });
    expect(p).toContain('Duree : 4 jour(s)');
    expect(p).toContain('Ce voyage dure 4 jour(s)');
  });

  it('D1-08: une duree demandée dans le brief commande aussi la couverture', () => {
    // Le defaut de calcul valait 1 : le suivre ici aurait refuse un plan de
    // 2 jours pour `journee_non_couverte`.
    const p = prompt({ durationDays: 1, briefDays: 2 });
    expect(p).toContain('Duree : 2 jour(s)');
    expect(p).toContain('Ce voyage dure 2 jour(s)');
    expect(p).not.toContain('Ce voyage dure 1 jour');
  });
});
