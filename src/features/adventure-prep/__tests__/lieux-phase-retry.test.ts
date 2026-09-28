/**
 * Reprise de la phase `lieux` — rejouer les lieux SANS detruire le parcours.
 *
 * Le defaut, MESURE en direct (etat `lkdv_adventure_prep_v2`, 2026-09-28) : la
 * phase `lieux` n avait AUCUNE branche dans `retryGenerationPhase`. Elle tombait
 * donc dans le filet de `recherche_parcours` et relanca une generation COMPLETE.
 * Consequence relevee, pas theorique : un parcours de 5 etapes est tombe a 2
 * etapes — les trois etapes du refuge ont disparu — et les distances sont
 * restees « a verifier ».
 *
 * Rejouer « les lieux » doit signifier « rattacher des positions a CE
 * parcours-la », jamais « redemander un autre parcours a l'IA ». Ce fichier
 * verrouille cette difference, et les trois sorties honnetes quand le depot ne
 * sait rien : aucune position inventee, modele rendu INTACT.
 *
 * Regle absolue rappelee ici : zero resultat simule. Sans resolveur branche, la
 * reprise echoue en nommant la phase — elle ne fabrique aucune position.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  retryGenerationPhase,
  PHASE_RAISED,
  PHASE_NO_VALUE,
  type PlaceResolver,
} from '../engine/itineraryPhases';
import type { AdventurePrepDraft, ItineraryModel, ItineraryStep } from '../types';
import { buildItinerary } from '../engine/itinerary';
import { CHAMONIX, fullDraft } from './fixtures';

/* --- Le parcours reellement observe, SANS position ---------------------- */

function etape(over: Partial<ItineraryStep> & Pick<ItineraryStep, 'id' | 'title'>): ItineraryStep {
  return {
    day: 1,
    order: 0,
    kind: 'trajet',
    placeName: null,
    startTime: '08:00',
    durationMin: 120,
    reason: null,
    price: { amount: null, currency: 'EUR', state: 'a_reserver' },
    state: 'a_reserver',
    kept: false,
    icon: 'navigation',
    lat: null,
    lon: null,
    ...over,
  };
}

const TITRES = [
  'Depart vers les Grands Mulets',
  'Montee refuge Grands Mulets',
  'Nuit au refuge Grands Mulets',
  'Descente vers Chamonix',
  'Arrivee a Chamonix',
] as const;

/**
 * Le draft de la reproduction : une boucle, sans arrivee fixee — donc sans
 * etape de retour ajoutee par la continuite, et le nombre d etapes reste
 * comparable d un test a l autre.
 */
const draft: AdventurePrepDraft = fullDraft({
  route: { origin: CHAMONIX, destination: null, shape: 'boucle' },
});

const INCONNU = {
  distanceKm: null,
  movingMin: null,
  activityMin: null,
  elevGainM: null,
  elevLossM: null,
} as const;

/**
 * 5 etapes sur 2 jours, dans l ordre de la maquette, toutes sans position.
 *
 * Le modele vient du VRAI constructeur : il ne manque donc aucun des champs que
 * `ItineraryModel` exige, et rien n est fabrique a la main pour satisfaire le
 * typage. Seules les etapes sont remplacees, pour reproduire a l identique le
 * parcours observe le 2026-09-28.
 */
function modelSansPosition(): ItineraryModel {
  const base = buildItinerary(draft);
  if (!base) throw new Error('modele de depart attendu');
  return {
    ...base,
    days: 2,
    steps: TITRES.map((titre, i) =>
      etape({
        id: `etape-${i}`,
        day: i < 3 ? 1 : 2,
        order: i,
        title: titre,
        placeName: i === 0 || i === 4 ? 'Chamonix-Mont-Blanc' : 'Grands Mulets',
      }),
    ),
    totals: { ...INCONNU },
    perDay: [{ ...INCONNU }, { ...INCONNU }],
  };
}


describe('retryGenerationPhase — la phase lieux', () => {
  it('LR-01 ne redemande PAS un parcours a l IA', async () => {
    const fetchProposal = vi.fn();
    const resolvePlaces = vi.fn(async (_d: AdventurePrepDraft, m: ItineraryModel) => m);

    await retryGenerationPhase(draft, modelSansPosition(), 'lieux', {
      fetchProposal: fetchProposal as never,
      resolvePlaces,
    });

    expect(fetchProposal).not.toHaveBeenCalled();
    expect(resolvePlaces).toHaveBeenCalledTimes(1);
  });

  it('LR-02 conserve TOUTES les etapes et y accroche les positions', async () => {
    const resolvePlaces: PlaceResolver = async (_d, m) => ({
      ...m,
      steps: m.steps.map((s) => ({ ...s, lat: 45.8666, lon: 6.8613 })),
    });

    const retry = await retryGenerationPhase(draft, modelSansPosition(), 'lieux', { resolvePlaces });

    expect(retry.outcome.status).toBe('reussie');
    expect(retry.model.steps).toHaveLength(TITRES.length);
    expect(retry.model.steps.map((s) => s.title)).toEqual([...TITRES]);
    expect(retry.model.steps.every((s) => s.lat === 45.8666 && s.lon === 6.8613)).toBe(true);
  });

  /* --- LR-03..05 : les trois sorties honnetes -------------------------- */

  it('LR-03 sans resolveur, echoue en nommant la phase et ne rend rien', async () => {
    const model = modelSansPosition();
    const retry = await retryGenerationPhase(draft, model, 'lieux', {});

    expect(retry.outcome.status).toBe('echoue');
    expect(retry.outcome.reason).toBe(PHASE_RAISED.lieux);
    expect(retry.model).toBe(model);
  });

  it('LR-04 le depot ne sait rien : inverifiable, modele INTACT', async () => {
    const model = modelSansPosition();
    const resolvePlaces: PlaceResolver = async (_d, m) => m;

    const retry = await retryGenerationPhase(draft, model, 'lieux', { resolvePlaces });

    expect(retry.outcome.status).toBe('inverifiable');
    expect(retry.outcome.reason).toBe(PHASE_NO_VALUE.lieux);
    expect(retry.model).toBe(model);
  });

  it('LR-05 le resolveur leve : echoue, modele INTACT', async () => {
    const model = modelSansPosition();
    const resolvePlaces: PlaceResolver = async () => {
      throw new Error('reseau muet');
    };

    const retry = await retryGenerationPhase(draft, model, 'lieux', { resolvePlaces });

    expect(retry.outcome.status).toBe('echoue');
    expect(retry.model).toBe(model);
  });

  /* --- LR-06 : la CONTINUITE, comme dans la generation ----------------- */

  it('LR-06 rejoue la CONTINUITE : le jour 2 demarre ou le jour 1 finit', async () => {
    // Jour 1 termine a 45.8666 ; le jour 2 commence 40 km plus au nord. Sans
    // continuite, l ecran afficherait un saut de 40 km que personne n aura fait.
    const resolvePlaces: PlaceResolver = async (_d, m) => ({
      ...m,
      steps: m.steps.map((s) => ({ ...s, lat: s.day === 1 ? 45.8666 : 46.2237, lon: 6.8613 })),
    });

    const retry = await retryGenerationPhase(draft, modelSansPosition(), 'lieux', { resolvePlaces });

    // La journee 2 demarre LA ou la journee 1 s est terminee...
    const premierJour2 = retry.model.steps[3];
    expect(premierJour2.lat).toBe(45.8666);
    expect(premierJour2.lon).toBe(6.8613);
    expect(premierJour2.placeName).toBe('Grands Mulets');

    // ...mais la suite de la journee garde SA position. Ancrer toute la journee
    // au point de la veille telecoporterait des etapes que personne ne fait :
    // la continuite garantit le RATTACHEMENT, pas l egalite.
    expect(retry.model.steps[4].lat).toBe(46.2237);
  });
});
