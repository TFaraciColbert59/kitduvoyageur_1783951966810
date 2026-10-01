import { describe, expect, it } from 'vitest';
import { draftActions } from '../store/reducer';
import { initialGeneration, startGeneration } from '../engine/generation';
import { shouldLaunchGeneration } from '../engine/stepTransition';
import {
  failedGenerationPhase,
  type AdventurePrepDraft,
  type GenerationState,
  type ItineraryModel,
} from '../types';
import { fullDraft } from './fixtures';

/**
 * Mesure du 2026-10-01 : apres un parcours dont la meteo avait echoue, changer
 * le depart jetait le parcours mais gardait le verdict. L ecran affichait
 * « Échec : Météo des jours de ton aventure » au-dessus de « Générer mon
 * parcours », sans aucun parcours a qui l echec se rapportait.
 */

const termineeMeteoEchouee = (): GenerationState => ({
  ...initialGeneration(),
  status: 'termine',
  outcomes: [
    { id: 'trace', status: 'reussie', reason: null, retryable: true },
    { id: 'meteo', status: 'echoue', reason: 'Météo injoignable.', retryable: true },
  ],
});

const genere = (): AdventurePrepDraft =>
  fullDraft({ itinerary: {} as ItineraryModel, generation: termineeMeteoEchouee() });

const saisies: Array<[string, (d: AdventurePrepDraft) => AdventurePrepDraft]> = [
  ['le départ', (d) => draftActions.setRoute(d, { ...d.route, origin: null })],
  ['la phrase', (d) => draftActions.setBrief(d, 'Trois jours depuis Chamonix')],
  ['la date', (d) => draftActions.setCalendar(d, { ...d.calendar, startDate: null })],
  ['l’activité', (d) => draftActions.setActivities(d, { ...d.activities, extra: [] })],
];

describe('une saisie qui jette le parcours jette aussi son verdict', () => {
  it('garde du test : le brouillon de départ annonce bien l’échec météo', () => {
    expect(failedGenerationPhase(genere().generation)?.id).toBe('meteo');
  });

  it.each(saisies)('changer %s : plus de parcours, plus d’« Échec »', (_nom, saisir) => {
    const apres = saisir(genere());
    expect(apres.itinerary).toBeNull();
    expect(failedGenerationPhase(apres.generation)).toBeNull();
    expect(apres.generation.outcomes).toEqual([]);
    // Le parcours a refaire se construit en arrivant sur l étape 2, comme la
    // première fois : « Créer mon parcours » ne mène plus à un second bouton.
    expect(shouldLaunchGeneration(apres)).toBe(true);
  });

  it('une génération EN COURS reste à son run', () => {
    const enCours = fullDraft({ generation: startGeneration(initialGeneration()) });
    const apres = draftActions.setBrief(enCours, 'Deux jours au départ de Gavarnie');
    expect(apres.generation).toBe(enCours.generation);
  });

  it('CONTRE-EXEMPLE — une saisie qui garde le parcours garde son verdict', () => {
    const avant = genere();
    const apres = draftActions.setGroup(avant, avant.group);
    expect(apres.itinerary).not.toBeNull();
    expect(failedGenerationPhase(apres.generation)?.id).toBe('meteo');
  });
});
