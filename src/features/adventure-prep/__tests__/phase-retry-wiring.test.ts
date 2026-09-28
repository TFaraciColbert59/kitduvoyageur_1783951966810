// P0.3 - Le bouton « Reessayer » existait, etait affiche, et ne pouvait rien
// rejouer.
//
// `retryGenerationPhase` refuse `recherche_parcours` sans `fetchProposal`, et
// `trace` et `meteo` sans `measure`. Or `PrepFlow` rendait `AdventurePrepShell`
// SANS `phaseRetryDeps` : la prop vaut `undefined`, le moteur recevait `{}`, et
// chaque phase rejouable echouait. Le bandeau s affirmait « reessayer » et le
// clic ne produisait aucun effet visible - exactement le piege que
// `itinerary-lieux-wiring.test.ts` documente pour la phase LIEUX : un argument
// manquant ne casse aucune compilation, il casse l ecran.
//
// Ces deux tests verrouillent le raccordement ET la transmission des lieux.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runItineraryGeneration } from '../engine/itineraryPhases';
import { retryGenerationPhase } from '../engine/itineraryPhases';
import { assignPlaces, type PlaceCandidate } from '../engine/places';
import { fullDraft } from './fixtures';

const flowPath = join(__dirname, '..', 'components', 'PrepFlow.tsx');
const flow = readFileSync(flowPath, 'utf8');

function candidate(id: string, name: string, category: string, lat: number, lon: number): PlaceCandidate {
  return {
    id,
    name,
    category,
    lat,
    lon,
    description: null,
    region: null,
    country: 'France',
    pricePerNight: null,
    phone: null,
    website: null,
    isVerifiable: true,
  };
}

const CANDIDATES = [
  candidate('mont-blanc', 'Mont Blanc', 'summit', 45.8326, 6.8652),
  candidate('gouter', 'Refuge du Gouter', 'refuge', 45.8622, 6.7975),
  candidate('lac-blanc', 'Lac Blanc', 'water', 45.9339, 6.8852),
];

describe('P0.3 - le bouton Reessayer est branche', () => {
  it('l orchestrateur fournit les dependances de reprise', () => {
    const tag = flow.slice(flow.indexOf('<AdventurePrepShell'), flow.indexOf('>', flow.indexOf('<AdventurePrepShell')));
    expect(tag).toContain('phaseRetryDeps');
  });

  it('la reprise de recherche_parcours rend un parcours LOCALISE', async () => {
    // Sans le resolveur transmis, la reprise replace un modele entier dont
    // aucune etape n a de position : plus aucune chaine a router, donc plus
    // aucun kilometre. Une reprise qui degrade le parcours qu elle vient de
    // reparer est pire qu une reprise refusee.
    const outcome = await runItineraryGeneration(
      fullDraft(),
      new AbortController().signal,
      async () => ({
        drafted: {
          title: null,
          days: 2,
          steps: [
            { day: 1, kind: 'nuit', title: 'Nuit', placeName: null, startTime: null, durationMin: null, reason: null, lat: null, lon: null },
            { day: 2, kind: 'arret', title: 'Arret', placeName: null, startTime: null, durationMin: null, reason: null, lat: null, lon: null },
          ],
          hypotheses: [],
        },
        failure: null,
        suggestedStartDate: null,
        suggestedDurationDays: null,
      }),
      () => {},
      undefined,
      {},
      async (_draft, model) =>
        assignPlaces(model, CANDIDATES, _draft.route.origin, _draft.route.destination),
    );
    expect(outcome.model?.steps.some((step) => step.lat !== null && step.lon !== null)).toBe(true);
  });

  it('retryGenerationPhase transmet le resolveur au moteur complet', async () => {
    // La preuve du trou : `deps` ne portait que `measure` et `fetchProposal`, et
    // l appel a `runItineraryGeneration` s arretait au cinquieme argument. Le
    // resolveur tom therefore sur `NO_PLACES` et la reprise renvoyait un
    // parcours sans une seule position - donc sans kilometre ni point sur la
    // carte, apres avoir promis de reparer.
    const draft = fullDraft();
    const base = await runItineraryGeneration(
      draft,
      new AbortController().signal,
      async () => ({
        drafted: {
          title: null,
          days: 1,
          steps: [
            { day: 1, kind: 'nuit', title: 'Nuit', placeName: null, startTime: null, durationMin: null, reason: null, lat: null, lon: null },
          ],
          hypotheses: [],
        },
        failure: null,
        suggestedStartDate: null,
        suggestedDurationDays: null,
      }),
      () => {},
    );
    const model = base.model;
    if (!model) throw new Error('modele attendu');

    const retry = await retryGenerationPhase(
      draft,
      model,
      'recherche_parcours',
      {
        fetchProposal: async () => ({
          drafted: {
            title: null,
            days: 1,
            steps: [
              { day: 1, kind: 'nuit', title: 'Nuit', placeName: null, startTime: null, durationMin: null, reason: null, lat: null, lon: null },
            ],
            hypotheses: [],
          },
          failure: null,
          suggestedStartDate: null,
          suggestedDurationDays: null,
        }),
        resolvePlaces: async (d, next) =>
          assignPlaces(next, CANDIDATES, d.route.origin, d.route.destination),
      },
      new AbortController().signal,
    );
    expect(retry.model.steps.some((step) => step.lat !== null && step.lon !== null)).toBe(true);
  });
});
