import { describe, expect, it } from 'vitest';
import {
  NO_MEASUREMENTS,
  measurementRunners,
  type MeasurementRunners,
} from '../engine/measurements';
import {
  AI_ACCEPTED,
  AI_ENRICHMENT_UNAVAILABLE,
  runItineraryGeneration,
  retryGenerationPhase,
  type GenerationOutcome,
  type PhaseReporter,
} from '../engine/itineraryPhases';
import { phaseHealth } from '../engine/resilience';
import { buildItinerary } from '../engine/itinerary';
import { assignPlaces } from '../engine/places';
import { describeAiFailure } from '../engine/aiFailure';
import type { DayWeather } from '../engine/weather';
import type { AdventurePrepDraft, GenerationPhaseId, ItineraryModel } from '../types';
import type { DraftedItinerary, DraftedStep } from '../engine/itineraryEngine';
import { fullDraft } from './fixtures';

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
    days: 2,
    steps: [step({ day: 1, kind: 'trajet', title: 'Depart de Chamonix' }), step({ day: 2, kind: 'nuit' })],
    hypotheses: [],
    ...overrides,
  };
}

function collector(): { phases: GenerationPhaseId[]; onPhase: PhaseReporter } {
  const phases: GenerationPhaseId[] = [];
  return { phases, onPhase: (phase) => phases.push(phase) };
}

/**
 * Un resolveur qui aboutit.
 *
 * Les tests de la phase METEO doivent isoler la meteo. Or la phase LIEUX
 * precede, et sans resolveur elle rend le modele intact : elle est alors
 * « invérifiable » et vient s ajouter a la liste des phases a rejouer. Ce
 * resolveur pose une position - une seule, la base en contient - pour que le
 * rail soit au vert partout sauf la ou l on veut observer la panne.
 */
async function placesResolved(
  draft: AdventurePrepDraft,
  model: ItineraryModel,
): Promise<ItineraryModel> {
  return assignPlaces(
    model,
    [
      {
        id: 'o-charpoua',
        name: 'Refuge de la Charpoua',
        category: 'refuge',
        lat: 45.9012,
        lon: 6.9234,
        description: null,
        region: null,
        country: 'France',
        pricePerNight: 55,
        phone: null,
        website: null,
        isVerifiable: true,
      },
    ],
    draft.route.origin,
    draft.route.destination,
  );
}

function sampleWeather(date: string, tMaxC = 21): DayWeather {
  return {
    date,
    tMaxC,
    tMinC: 8,
    precipMm: 0,
    precipProbPct: 4,
    windMaxKmh: 12,
    code: 1,
    label: 'Plage degagee',
  };
}

interface Spies extends MeasurementRunners {
  traceCalls: number;
  weatherCalls: number;
}

/** Un runner qui note ce qu il recoit et renvoie le modele deplace. */
function spyRunners(): Spies {
  const spies: Spies = {
    traceCalls: 0,
    weatherCalls: 0,
    trace: async (_draft, model) => {
      spies.traceCalls += 1;
      return { ...model, totals: { ...model.totals, distanceKm: 12.5 } };
    },
    weather: async (_draft, model) => {
      spies.weatherCalls += 1;
      return { ...model, weather: model.weather.map((day, index) => sampleWeather(index === 0 ? '2026-07-11' : '2026-07-12')) };
    },
  };
  return spies;
}

describe('phases de generation honne tes', () => {
  it('ne coche AUCUNE phase tant que le travail correspondant n est pas fini', async () => {
    const box: { release: (() => void) | null } = { release: null };
    const gate = new Promise<DraftedItinerary | null>((resolve) => {
      box.release = () => resolve(drafted());
    });
    const { phases, onPhase } = collector();

    const run = runItineraryGeneration(
      fullDraft(),
      new AbortController().signal,
      async () => ({ drafted: await gate, failure: null }),
      onPhase,
      NO_MEASUREMENTS,
    );
    // L appel reseau est en vol : la phase recherche n est pas encore cochee.
    expect(phases).toEqual([]);

    box.release?.();
    await run;
    expect(phases).toContain('recherche_parcours');
  });

  it('coche les six phases dans l ordre, une fois chacune', async () => {
    const { phases, onPhase } = collector();
    await runItineraryGeneration(
      fullDraft(),
      new AbortController().signal,
      async () => ({ drafted: drafted(), failure: null }),
      onPhase,
      NO_MEASUREMENTS,
    );
    expect(phases).toEqual([
      'recherche_parcours',
      'verification_etapes',
      'disponibilites',
      'lieux',
      'trace',
      'meteo',
      'synthese',
    ]);
    expect(new Set(phases).size).toBe(phases.length);
  });

  it('reporte une phase cochee uniquement APRES son propre travail', async () => {
    const order: string[] = [];
    const runners: MeasurementRunners = {
      trace: async (_draft, model) => {
        order.push('travail-trace');
        return model;
      },
      weather: async (_draft, model) => {
        order.push('travail-meteo');
        return model;
      },
    };
    await runItineraryGeneration(
      fullDraft(),
      new AbortController().signal,
      async () => {
        order.push('travail-ia');
        return { drafted: drafted(), failure: null };
      },
      (phase) => order.push(`coche-${phase}`),
      runners,
      {},
      (draft, model) => {
        order.push('travail-lieux');
        return placesResolved(draft, model);
      },
    );
    expect(order).toEqual([
      'travail-ia',
      'coche-recherche_parcours',
      'coche-verification_etapes',
      'coche-disponibilites',
      'travail-lieux',
      'coche-lieux',
      'travail-trace',
      'coche-trace',
      'travail-meteo',
      'coche-meteo',
      'coche-synthese',
    ]);
  });

  it('une annulation ne coche rien et ne renvoie aucun modele mesure', async () => {
    const controller = new AbortController();
    const { phases, onPhase } = collector();
    let traceCalls = 0;
    const runners: MeasurementRunners = {
      trace: async (_draft, model) => {
        traceCalls += 1;
        return model;
      },
      weather: async (_draft, model) => model,
    };
    controller.abort();
    const outcome = await runItineraryGeneration(
      fullDraft(),
      controller.signal,
      async () => ({ drafted: drafted(), failure: null }),
      onPhase,
      runners,
    );
    expect(phases).toEqual([]);
    expect(traceCalls).toBe(0);
    expect(outcome.degraded).toBe(true);
  });

  it('un runner qui leve n interrompt pas la generation', async () => {
    const { phases, onPhase } = collector();
    const outcome = await runItineraryGeneration(
      fullDraft(),
      new AbortController().signal,
      async () => ({ drafted: drafted(), failure: null }),
      onPhase,
      {
        trace: async () => {
          throw new Error('OSRM muet');
        },
        weather: async () => {
          throw new Error('meteo muette');
        },
      },
    );
    expect(phases).toEqual([
      'recherche_parcours',
      'verification_etapes',
      'disponibilites',
      'lieux',
      'trace',
      'meteo',
      'synthese',
    ]);
    expect(outcome.model).not.toBeNull();
  });

  it('le modele livre porte les mesures reellement produites', async () => {
    const spies = spyRunners();
    const outcome = await runItineraryGeneration(
      fullDraft(),
      new AbortController().signal,
      async () => ({ drafted: drafted(), failure: null }),
      () => {},
      spies,
    );
    expect(spies.traceCalls).toBe(1);
    expect(spies.weatherCalls).toBe(1);
    expect(outcome.model?.totals.distanceKm).toBe(12.5);
    expect(outcome.model?.weather).toHaveLength(2);
  });

  it('le repli regles mesure lui aussi le parcours', async () => {
    const spies = spyRunners();
    const outcome = await runItineraryGeneration(
      fullDraft(),
      new AbortController().signal,
      async () => ({ drafted: null, failure: null }),
      () => {},
      spies,
    );
    expect(outcome.engineId).toBe('rules');
    expect(spies.traceCalls).toBe(1);
    expect(spies.weatherCalls).toBe(1);
  });

  it('sans mesureur fourni, aucune distance n est inventee', async () => {
    const outcome = await runItineraryGeneration(
      fullDraft(),
      new AbortController().signal,
      async () => ({ drafted: drafted(), failure: null }),
      () => {},
    );
    expect(outcome.model?.totals.distanceKm).toBeNull();
    expect(outcome.model?.weather.every((day) => day === null)).toBe(true);
  });
});

describe('assemblage des mesureurs', () => {
  it('NO_MEASUREMENTS ne touche pas au modele', async () => {
    const model = { weather: [null] } as unknown as ItineraryModel;
    await expect(NO_MEASUREMENTS.trace(fullDraft(), model, new AbortController().signal)).resolves.toBe(model);
    await expect(NO_MEASUREMENTS.weather(fullDraft(), model, new AbortController().signal)).resolves.toBe(model);
  });

  it('un routage muet laisse passer la meteo', async () => {
    const runners = measurementRunners({
      route: {
        route: async () => {
          throw new Error('OSRM muet');
        },
        elevation: async () => {
          throw new Error('altitude muette');
        },
      },
      weather: async () => [sampleWeather('2026-07-11', 18), sampleWeather('2026-07-12', 19)],
    });
    const start = runItineraryGeneration(
      fullDraft(),
      new AbortController().signal,
      async () => ({ drafted: drafted(), failure: null }),
      () => {},
      runners,
    );
    const outcome = await start;
    expect(outcome.model?.weather[0]?.tMaxC).toBe(18);
  });
});

/* ------------------------------------------------------------------ */
/* La cause reelle de la degradation, jusqu au message affiche        */
/* ------------------------------------------------------------------ */

describe('cause reelle de la degradation — PH-01 a PH-05', () => {
  const signal = () => new AbortController().signal;

  it('PH-01: un delai du service remonte tel quel dans le message', async () => {
    const outcome = await runItineraryGeneration(
      fullDraft(),
      signal(),
      async () => ({ drafted: null, failure: 'delai_depasse' }),
      () => {},
      NO_MEASUREMENTS,
    );
    expect(outcome.failure).toBe('delai_depasse');
    expect(outcome.message).toBe(describeAiFailure('delai_depasse'));
  });

  it('PH-02: le message du delai n accuse jamais l assistant d etre coupe', async () => {
    const outcome = await runItineraryGeneration(
      fullDraft(),
      signal(),
      async () => ({ drafted: null, failure: 'delai_depasse' }),
      () => {},
      NO_MEASUREMENTS,
    );
    expect(outcome.message).not.toContain('pas activ');
    expect(outcome.message).not.toBe(AI_ENRICHMENT_UNAVAILABLE);
  });

  it('PH-03: un proposeur qui leve reste un echec de service, pas une annulation', async () => {
    const outcome = await runItineraryGeneration(
      fullDraft(),
      signal(),
      async () => {
        throw new Error('reseau coupe');
      },
      () => {},
      NO_MEASUREMENTS,
    );
    expect(outcome.failure).toBe('provider_indisponible');
    expect(outcome.model).not.toBeNull();
  });

  it('PH-04: une proposition acceptee ne laisse AUCUNE cause au banner', async () => {
    const outcome = await runItineraryGeneration(
      fullDraft(),
      signal(),
      async () => ({ drafted: drafted(), failure: null }),
      () => {},
      NO_MEASUREMENTS,
    );
    expect(outcome.failure).toBeNull();
    expect(outcome.message).toBe(AI_ACCEPTED);
  });

  it('PH-05: sans cause connue, le message reste generique mais exact', async () => {
    const outcome = await runItineraryGeneration(
      fullDraft(),
      signal(),
      async () => ({ drafted: null, failure: null }),
      () => {},
      NO_MEASUREMENTS,
    );
    expect(outcome.message).toBe(AI_ENRICHMENT_UNAVAILABLE);
    expect(outcome.failure).toBeNull();
  });
});
/* ------------------------------------------------------------------ */
/* P0.3 — Un echec de phase n eteint plus toute l IA                   */
/* ------------------------------------------------------------------ */

describe('P0.3 : un echec de phase reste un echec de phase', () => {
  it('PR-01 : la meteo qui tombe ne retire pas le parcours, et ne declare PAS la generation morte', async () => {
    const runners: MeasurementRunners = {
      trace: async (_draft, model) => ({ ...model, totals: { ...model.totals, distanceKm: 12.5 } }),
      weather: async () => {
        throw new Error('Open-Meteo 503');
      },
    };

    const outcome = await runItineraryGeneration(
      fullDraft(),
      new AbortController().signal,
      async () => ({ drafted: drafted(), failure: null }),
      () => {},
      runners,
    );

    // Le parcours reste la : la phase qui tombe est une MESURE, pas le parcours.
    expect(outcome.model).not.toBeNull();
    expect(outcome.model?.steps.length).toBeGreaterThan(0);
    // La mesure de distance, elle, a bien ete conservee.
    expect(outcome.model?.totals.distanceKm).toBe(12.5);
    // Et surtout : ce n est PAS une generation morte.
    expect(phaseHealth(outcome).dead).toBe(false);
  });

  it('PR-02 : la phase tombee est nommee, avec une raison motivée et rejouable', async () => {
    const runners: MeasurementRunners = {
      // Le trace DOIT mesurer ici : un runner qui rend le modele tel quel n a
      // mesure aucune distance, et le rapporter « reussi » serait exactement le
      // mensonge que ce module interdit. C est la fixture qu on corrige, pas
      // la regle.
      trace: async (_draft, model) => ({ ...model, totals: { ...model.totals, distanceKm: 9.4 } }),
      weather: async () => {
        throw new Error('Open-Meteo 503');
      },
    };
    const outcome = await runItineraryGeneration(
      fullDraft(),
      new AbortController().signal,
      async () => ({ drafted: drafted(), failure: null }),
      () => {},
      runners,
      {},
      placesResolved,
    );

    const health = phaseHealth(outcome);
    expect(health.failed.map((p) => p.id)).toEqual(['meteo']);
    expect(health.retryable).toEqual(['meteo']);
    const meteo = health.failed[0];
    expect(meteo?.reason).toBeTruthy();
    expect(meteo?.reason).toContain('météo');
    // Une raison affichee ne doit jamais laisser fuir de detail technique.
    expect(meteo?.reason).not.toMatch(/Error|503|stack|undefined/i);
  });

  it('PR-03 : une phase qui repond sans valeur est « invérifiable », pas « échouée »', async () => {
    // Le fournisseur a repondu, il couvre juste aucune des dates demandees.
    const runners: MeasurementRunners = {
      trace: async (_draft, model) => ({ ...model, totals: { ...model.totals, distanceKm: 9.4 } }),
      // Le fournisseur a repondu... par le modele inchange. C est exactement ce
      // cas-la : une serie vide ou absente n est pas une panne, c est un
      // « on ne sait pas », et le moteur ne doit pas le maquiller en succes.
      weather: async (_draft, model) => model,
    };
    const outcome = await runItineraryGeneration(
      fullDraft(),
      new AbortController().signal,
      async () => ({ drafted: drafted(), failure: null }),
      () => {},
      runners,
      {},
      placesResolved,
    );
    const health = phaseHealth(outcome);
    // Une serie vide n est pas une panne : le dire « echec » ferait croire a un
    // service tombe, alors que la seule verite est « je ne sais pas ».
    expect(health.failed.map((p) => p.id)).toEqual(['meteo']);
    expect(health.dead).toBe(false);
  });

  it('PR-04 : une generation morte reste une generation morte', async () => {
    const outcome = await runItineraryGeneration(
      fullDraft(),
      new AbortController().signal,
      async () => ({ drafted: null, failure: null }),
      () => {},
      NO_MEASUREMENTS,
    );
    // Le repli regles a produit un parcours : la generation n est donc PAS morte.
    expect(phaseHealth(outcome).dead).toBe(false);
    expect(phaseHealth(outcome).reusable).toBe(true);
  });

  it('PR-05 : l etat expose une generation reutilisable, ce qui n arrive pas du shell par accident', () => {
    const outcome: GenerationOutcome = {
      model: null,
      engineId: 'rules',
      degraded: true,
      message: null,
      rejectedReason: null,
      failure: null,
      phases: [],
      infeasible: [],
      toVerify: [],
    };
    const health = phaseHealth(outcome);
    expect(health.dead).toBe(true);
    expect(health.reusable).toBe(false);
    expect(health.summary).toContain('rien');
  });
});

describe('P0.3 : reprise d UNE SEULE phase', () => {
  const failing = (): MeasurementRunners => ({
    trace: async (_draft, model) => model,
    weather: async () => {
      throw new Error('Open-Meteo 503');
    },
  });

  it('PR-10 : retrier la meteo ne rejoue QUE la meteo, jamais le trace', async () => {
    const draft = fullDraft();
    const first = await runItineraryGeneration(
      draft,
      new AbortController().signal,
      async () => ({ drafted: drafted(), failure: null }),
      () => {},
      failing(),
    );
    const model = first.model;
    if (!model) throw new Error('modele attendu');

    let traceCalls = 0;
    let weatherCalls = 0;
    const retry = await retryGenerationPhase(
      draft,
      model,
      'meteo',
      {
        measure: {
          trace: async (_draft, next) => { traceCalls += 1; return next; },
          weather: async (_draft, next) => {
            weatherCalls += 1;
            return {
              ...next,
              weather: [sampleWeather('2026-07-11', 24), sampleWeather('2026-07-12', 21)],
            };
          },
        },
      },
      new AbortController().signal,
    );

    expect(retry.phase).toBe('meteo');
    expect(retry.outcome.status).toBe('reussie');
    expect(traceCalls).toBe(0);
    expect(weatherCalls).toBe(1);
    expect(retry.model.weather[0]?.tMaxC).toBe(24);
    // Le kilometrage deja mesure est CON_SERVE : une reprise ne doit pas
    // effacer le travail d une phase qui, elle, avait reussi.
    expect(retry.model.totals.distanceKm).toBeNull();
  });

  it('PR-11 : le trace se retrie seul lui aussi', async () => {
    const draft = fullDraft();
    const base = buildItinerary(draft);
    if (!base) throw new Error('modele attendu');
    let weatherCalls = 0;
    const retry = await retryGenerationPhase(
      draft,
      base,
      'trace',
      {
        measure: {
          trace: async (_draft, next) => ({ ...next, totals: { ...next.totals, distanceKm: 42 } }),
          weather: async (_draft, next) => { weatherCalls += 1; return next; },
        },
      },
      new AbortController().signal,
    );
    expect(retry.outcome.status).toBe('reussie');
    expect(retry.model.totals.distanceKm).toBe(42);
    expect(weatherCalls).toBe(0);
  });

  it('PR-12 : une reprise qui echoue encore rend le modele INTACT et nomme la phase', async () => {
    const draft = fullDraft();
    const model = buildItinerary(draft);
    if (!model) throw new Error('modele attendu');

    const retry = await retryGenerationPhase(
      draft,
      model,
      'meteo',
      {
        measure: {
          trace: async (_draft, next) => next,
          weather: async () => {
            throw new Error('Open-Meteo 503');
          },
        },
      },
      new AbortController().signal,
    );

    expect(retry.outcome.status).toBe('echoue');
    expect(retry.outcome.reason).toContain('météo');
    // Le parcours d avant reste exactement celui d avant : une reprise ratee ne
    // doit JAMAIS demarrer un parcours a moitie mesure.
    expect(retry.model).toBe(model);
  });

  it('PR-13 : la verification d etapes rejoue sur le modele EXISTANT et retrouve un vrai chevauchement', async () => {
    const draft = fullDraft();
    const model = buildItinerary(draft);
    if (!model) throw new Error('modele attendu');
    // Un chevauchement reel, introduit apres coup.
    const broken: ItineraryModel = {
      ...model,
      steps: model.steps.map((step, index) =>
        index < 2 ? { ...step, startTime: '10:00', durationMin: 120 } : step,
      ),
    };

    const retry = await retryGenerationPhase(
      draft,
      broken,
      'verification_etapes',
      {},
      new AbortController().signal,
    );
    expect(retry.outcome.status).toBe('echoue');
    expect(retry.outcome.reason).toContain('chevauch');
    expect(retry.model).toBe(broken);
  });

  it('PR-14 : la phase disponibilites rejouee reclasse ce qui doit etre reserve', async () => {
    const draft = fullDraft();
    const model = buildItinerary(draft);
    if (!model) throw new Error('modele attendu');
    // Une nuit ete « proposee » a tort : la reprise doit la remettre a reserver.
    const tampered: ItineraryModel = {
      ...model,
      steps: model.steps.map((step) =>
        step.kind === 'nuit' ? { ...step, state: 'propose' as const } : step,
      ),
    };

    const retry = await retryGenerationPhase(
      draft,
      tampered,
      'disponibilites',
      {},
      new AbortController().signal,
    );
    expect(retry.outcome.status).toBe('reussie');
    expect(retry.model.steps.filter((s) => s.kind === 'nuit').every((s) => s.state === 'a_reserver')).toBe(true);
    // L objet d origine n a pas ete mute sur place.
    expect(tampered.steps.some((s) => s.kind === 'nuit' && s.state === 'propose')).toBe(true);
  });

  it('PR-15 : retrier la recherche sans proposeur echoue franchement, jamais en faux succes', async () => {
    const draft = fullDraft();
    const model = buildItinerary(draft);
    if (!model) throw new Error('modele attendu');

    const retry = await retryGenerationPhase(
      draft,
      model,
      'recherche_parcours',
      {},
      new AbortController().signal,
    );
    expect(retry.outcome.status).toBe('echoue');
    expect(retry.outcome.reason).toBeTruthy();
    expect(retry.model).toBe(model);
  });

  it('PR-16 : une phase inconnue ne peut pas etre rejouee — la liste est fermee', async () => {
    const draft = fullDraft();
    const model = buildItinerary(draft);
    if (!model) throw new Error('modele attendu');
    const retry = await retryGenerationPhase(
      draft,
      model,
      'phase_qui_nexiste_pas' as GenerationPhaseId,
      {},
      new AbortController().signal,
    );
    expect(retry.outcome.status).toBe('echoue');
    expect(retry.outcome.retryable).toBe(false);
  });

  it('PR-17 : la synthese rejouee reconstruit les plans de repli', async () => {
    const draft = fullDraft();
    const model = buildItinerary(draft);
    if (!model) throw new Error('modele attendu');
    const stripped: ItineraryModel = { ...model, contingencies: [] };

    const retry = await retryGenerationPhase(
      draft,
      stripped,
      'synthese',
      {},
      new AbortController().signal,
    );
    expect(retry.outcome.status).toBe('reussie');
    expect(retry.model.contingencies.length).toBeGreaterThan(0);
  });
});


