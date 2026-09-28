import { describe, expect, it } from 'vitest';
import { measureDayWeather, type MeasurementRunners } from '../engine/measurements';
import { runItineraryGeneration } from '../engine/itineraryPhases';
import { assignPlaces } from '../engine/places';
import type { DayWeather } from '../engine/weather';
import type { AdventurePrepDraft, ItineraryModel } from '../types';
import type { DraftedItinerary, DraftedStep } from '../engine/itineraryEngine';
import { fullDraft } from './fixtures';

/**
 * P0.16 — la meteo doit se mesurer sur la date que l'IA vient de choisir.
 *
 * Constat releve en pilotant l'ecran le 2026-09-28 : sur une generation REELLE
 * sans date choisie, le bandeau « Echec : Meteo des jours de ton aventure »
 * s'affichait alors que le parcours etait complet et correct (10,3 km,
 * 2 491 m, Refuge du Gouter). Cause : la phase mesurait avec le brouillon
 * d'origine, dont `startDate` valait `null` ; la date proposee par l'IA
 * n'etait deposee qu'APRES toutes les phases. Sans date, `dateRange(null,
 * jours)` ne rend rien, aucune prevision n'est demandee, et la phase echoue sur
 * une absence qu'elle ne peut pas distinguer d'une panne du fournisseur.
 *
 * Le test passe par le VRAI `measureDayWeather` : c'est lui qui lit la date.
 * Un double qui remplacerait toute la phase ne prouverait rien.
 */

const DATE_IA = '2026-10-10';

function step(overrides: Partial<DraftedStep> = {}): DraftedStep {
  return {
    day: 1,
    kind: 'arret',
    title: 'Pause au col',
    placeName: null,
    startTime: null,
    durationMin: null,
    reason: null,
    ...overrides,
  };
}

function drafted(overrides: Partial<DraftedItinerary> = {}): DraftedItinerary {
  return {
    title: null,
    days: 2,
    steps: [
      step({ day: 1, kind: 'trajet', title: 'Depart de Chamonix' }),
      step({ day: 2, kind: 'nuit' }),
    ],
    hypotheses: [],
    ...overrides,
  };
}

async function placesResolved(
  draft: AdventurePrepDraft,
  model: ItineraryModel,
): Promise<ItineraryModel> {
  return assignPlaces(model, [
    {
      id: 'o-charpoua',
      name: 'Refuge de la Charpoua',
      category: 'refuge',
      lat: 45.9012,
      lon: 6.9234,
      description: null,
      region: null,
      country: null,
      pricePerNight: null,
      phone: null,
      website: null,
      isVerifiable: true,
    },
  ], draft.route.origin, draft.route.destination);
}

/**
 * Un fournisseur qui note les dates reellement demandees, puis repond.
 * C'est lui que le vrai `measureDayWeather` appelle, groupe par groupe.
 */
function runnersWithSpy(demandees: string[][]): MeasurementRunners {
  return {
    trace: async (_draft, model) => model,
    weather: (draft, model, signal) =>
      measureDayWeather(
        draft,
        model,
        async (dates) => {
          demandees.push([...dates]);
          return dates.map(
            (date): DayWeather => ({
              date,
              tMaxC: 12,
              tMinC: 3,
              precipMm: 0,
              precipProbPct: 10,
              windMaxKmh: 12,
              code: 2,
              label: 'Partiellement nuageux',
            }),
          );
        },
        signal,
      ),
  };
}

function sansDate(): AdventurePrepDraft {
  return fullDraft({
    calendar: {
      startDate: null,
      startDateIsSuggested: false,
      durationDays: 2,
      durationIsSuggested: false,
      returnDate: null,
    },
  });
}

describe('P0.16 — la meteo se mesure sur la date proposee par l IA', () => {
  it('P016-01: sans date choisie, la phase meteo interroge la date proposee par l IA', async () => {
    const demandees: string[][] = [];
    const outcome = await runItineraryGeneration(
      sansDate(),
      new AbortController().signal,
      async () => ({
        drafted: drafted(),
        failure: null,
        suggestedStartDate: DATE_IA,
        suggestedDurationDays: null,
      }),
      () => undefined,
      runnersWithSpy(demandees),
      {},
      placesResolved,
    );

    expect(outcome.suggestedStartDate).toBe(DATE_IA);
    // Avant le correctif, `demandees` etait VIDE : aucune prevision n'etait
    // demandee, faute de date.
    expect(demandees.flat()).toEqual([DATE_IA, '2026-10-11']);
    expect(outcome.model?.weather.map((day) => day?.date ?? null)).toEqual([
      DATE_IA,
      '2026-10-11',
    ]);
  });

  it('P016-02: la phase meteo est reussie, et non un Echec affiche a l ecran', async () => {
    const demandees: string[][] = [];
    const outcome = await runItineraryGeneration(
      sansDate(),
      new AbortController().signal,
      async () => ({
        drafted: drafted(),
        failure: null,
        suggestedStartDate: DATE_IA,
        suggestedDurationDays: null,
      }),
      () => undefined,
      runnersWithSpy(demandees),
      {},
      placesResolved,
    );

    const meteo = outcome.phases.find((phase) => phase.id === 'meteo');
    expect(meteo?.status).toBe('reussie');
    expect(meteo?.reason).toBeNull();
  });

  it('P016-03: une date saisie a la main n est jamais remplacee par celle de l IA', async () => {
    const demandees: string[][] = [];
    const manuelle = fullDraft({
      calendar: {
        startDate: '2026-07-11',
        startDateIsSuggested: false,
        durationDays: 2,
        durationIsSuggested: false,
        returnDate: '2026-07-12',
      },
    });

    await runItineraryGeneration(
      manuelle,
      new AbortController().signal,
      async () => ({
        drafted: drafted(),
        failure: null,
        suggestedStartDate: DATE_IA,
        suggestedDurationDays: null,
      }),
      () => undefined,
      runnersWithSpy(demandees),
      {},
      placesResolved,
    );

    expect(demandees.flat()).toEqual(['2026-07-11', '2026-07-12']);
  });

  it('P016-04: sans date ET sans proposition, la phase echoue honestly — aucune meteo inventee', async () => {
    const demandees: string[][] = [];
    const outcome = await runItineraryGeneration(
      sansDate(),
      new AbortController().signal,
      async () => ({ drafted: drafted(), failure: null, suggestedStartDate: null, suggestedDurationDays: null }),
      () => undefined,
      runnersWithSpy(demandees),
      {},
      placesResolved,
    );

    // Aucune date n'existe : rien n'est demande, et l'absence est annoncee
    // comme telle plutot que remplie par une valeur plausible.
    expect(demandees).toEqual([]);
    expect(outcome.model?.weather.every((day) => day === null)).toBe(true);
    const meteo = outcome.phases.find((phase) => phase.id === 'meteo');
    // Le runner rend le modele INCHANGE : safely ne peut alors pas distinguer
    // « il n avait rien a mesurer » d une panne du fournisseur. Il dit donc
    // inverifiable, ce qui est le verdict honnete : ni meteo inventee, ni
    // fausse panne annoncee a l ecran.
    expect(meteo?.status).toBe('inverifiable');
  });
});
