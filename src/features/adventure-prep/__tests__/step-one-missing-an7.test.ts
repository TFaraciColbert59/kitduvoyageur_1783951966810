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
 * lui-meme declare non bloquants. L'ecran annoncait donc un blocage inexistant,
 * et l'utilisateur
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
  it('AN7-1: RACCORD UI — aucun bloqueur annonce ne laisse le CTA ouvert', () => {
    // ROUGE VOLONTAIRE. L INVARIANT d AN7 ne parle plus du depart : depuis B4
    // l absence de depart n est plus un bloqueur, et « lieu de depart » reste
    // pourtant annonce comme tel parce que `ENGINE_BLOCKING`
    // (components/stepOneProfile.ts:269, HORS PERIMETRE) le contient encore.
    // RACCORD : retirer 'origin' de ENGINE_BLOCKING, ligne 269.
    //
    // Melange PREEXISTANT, hors B4, signale sans etre traite ici : quand le
    // catalogue est ferme, `stepOneMissing` ajoute 'activite' dans
    // `optional` (ligne 312) SANS regarder `blocking`. Les deux listes se
    // melangent donc quand l intention manque — item a part, meme ligne.
    const base = fullDraft();
    const toutSauf = fullDraft({
      route: { ...base.route, origin: null, destination: null },
      calendar: { ...base.calendar, startDate: null, returnDate: null },
    });
    const { blocking, optional } = stepOneMissing(toutSauf, 'trajet');
    // Un bloqueur annonce doit correspondre a un bouton mort, jamais l inverse.
    expect(blocking.length === 0 || !canCreateStepOne(toutSauf)).toBe(true);
    // ARBITRAGE A (2026-09-29) : le moteur fait foi. `hasEngineMinimum` ne lit
    // que l intention, et `requestDraftedItinerary` part desormais sans origine
    // (B4) en nommant le trou « depart non precise » SANS le combler. Un
    // depart manquant n est donc pas un arret : c est un complement.
    //
    // Nommer le depart explicitement est ce qui interdit a ce test de devenir
    // vacuous. Une assertion qui ne ferait que recompter la liste pourrait
    // verdir sur un ecran muet ; celle-ci exige le nom du champ.
    expect(blocking).toEqual([]);
    expect(optional).toEqual(['lieu de départ', 'lieu d’arrivée', 'date']);
  });

  it('AN7-2: le CTA actif est exactement « aucun bloqueur »', () => {
    const complet = fullDraft();
    expect(stepOneMissing(complet, 'trajet').blocking).toEqual([]);
    expect(canCreateStepOne(complet)).toBe(true);

    // B4 : sans depart, le moteur construit quand meme le parcours. Le CTA
    // reste donc actif — c est le comportement, mesure sur le cas reel.
    const sansDepart = fullDraft({ route: { ...complet.route, origin: null } });
    expect(canCreateStepOne(sansDepart)).toBe(true);

    // Sans INTENTION, en revanche, le CTA meurt : le modele n a aucun sujet.
    const sansIntention = fullDraft({
      activities: { primary: null, extra: [], nights: [] },
    });
    expect(canCreateStepOne(sansIntention)).toBe(false);
  });

  it('AN7-3: tant qu un bloqueur existe, aucune promesse de complements', () => {
    // Le seul bloqueur restant est l INTENTION. On lui laisse des complements
    // REELS a afficher, sinon « aucune promesse » ne prouverait rien.
    const base = fullDraft();
    const sansIntention = fullDraft({
      activities: { primary: null, extra: [], nights: [] },
      calendar: { ...base.calendar, startDate: null, returnDate: null },
    });
    expect(canCreateStepOne(sansIntention)).toBe(false);
    expect(stepOneMissing(sansIntention, 'trajet').optional.length).toBeGreaterThan(0);
    expect(stepOneReadySummary(sansIntention, 'trajet')).toBeNull();
  });

  it('AN7-4: plus rien ne bloque, l ecran dit ce que l IA completera', () => {
    expect(stepOneReadySummary(saufOptionnels(), 'trajet')).toBe(
      'L’IA proposera : lieu d’arrivée, date'
    );
  });

  it('AN7-5: un CTA ACTIF n’est jamais surmonte par « Il manque »', () => {
    const text = visible(render(saufOptionnels()));
    expect(text).toContain('Créer mon parcours');
    expect(text).not.toContain('Il manque');
    expect(text).toContain('L’IA proposera');
  });

  it('AN7-6: un depart manquant est un COMPLEMENT, jamais un arret nomme', () => {
    // ARBITRAGE A (2026-09-29) : ce test est la version datee de AN7-4 et
    // AN7-5 pour le depart. Il ne verifiait qu une moitie du contrat — que le
    // CTA bloque ne nomme QUE ce qui bloque — et laissait passer le cas
    // symetrique : un CTA ACTIF qui annonce quand meme un arret inexistant.
    // C etait exactement le « bouton actif et mort ».
    //
    // Il exige donc les DEUX moities, et nomme le depart dans chacune :
    // « complera » seul autoriserait un ecran muet, et une assertion muette
    // autoriserait un ecran qui nomme nimporte quoi.
    const base = fullDraft();
    const sansDepart = fullDraft({
      route: { ...base.route, origin: null },
      calendar: { ...base.calendar, startDate: null, returnDate: null },
    });
    const text = visible(render(sansDepart));

    // Moitie 1 — le CTA est actif, et l ecran ne pretend pas le contraire.
    expect(text).toContain('Créer mon parcours');
    expect(text).not.toContain('Il manque : lieu de départ');
    expect(stepOneMissing(sansDepart, 'trajet').blocking).toEqual([]);

    // Moitie 2 — le depart est bien nomme, et comme complement. Sans ce
    // `toContain`, le test passerait sur un ecran entierement muet. L IA ne
    // pose jamais d origine (2026-10-01) : la date lui est proposee, le depart
    // est nomme par ce que son absence coute.
    expect(text).toContain(
      'L’IA proposera : date · Sans lieu de départ, la carte et les distances resteront à vérifier'
    );
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
