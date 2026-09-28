import { describe, expect, it, vi } from 'vitest';
import {
  detectUnsourcedClaims,
  findTimeOverlap,
  materializeSteps,
  validateDrafted,
  type DraftedItinerary,
  type DraftedStep,
} from '../engine/itineraryEngine';
import {
  AI_ACCEPTED,
  AI_ENRICHMENT_UNAVAILABLE,
  annotateAvailability,
  assembleModel,
  extractJsonObject,
  runItineraryGeneration,
  type PhaseReporter,
} from '../engine/itineraryPhases';
import { buildItinerary } from '../engine/itinerary';
import { PRICE_TO_CHECK, type GenerationPhaseId, type ItineraryStep } from '../types';
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

const toDomain = (draftedSteps: DraftedStep[]): ItineraryStep[] =>
  materializeSteps({ days: 2, steps: draftedSteps, hypotheses: [] }, 2);

describe('extraction de la reponse brute du modele', () => {
  it('lit un JSON nu, un bloc markdown et du texte autour', () => {
    expect(extractJsonObject('{"a":1}')).toEqual({ a: 1 });
    expect(extractJsonObject('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(extractJsonObject('Voici : {"a":1} — voila.')).toEqual({ a: 1 });
  });

  it('renvoie null plutot que de deviner quand il n y a pas d objet', () => {
    expect(extractJsonObject('pas de json ici')).toBeNull();
    expect(extractJsonObject('{"a":')).toBeNull();
    expect(extractJsonObject('{"a":1}{"b":2')).toBeNull();
  });
});

describe('garde-fou : le modele ne peut pas inventer un prix ni une disponibilite', () => {
  it('detecte les montants et les reservations ecrites en clair', () => {
    expect(detectUnsourcedClaims('Refuge a 54 EUR la nuit')).toContain('prix');
    expect(detectUnsourcedClaims('Depart 9h, 30 € compris')).toContain('prix');
    expect(detectUnsourcedClaims('Table reservee pour 19h')).toContain('disponibilite');
    expect(detectUnsourcedClaims('Reservation confirmee par le prestataire')).toContain('disponibilite');
  });

  it('laisse passer un texte normal qui parle de lieu et d horaire', () => {
    expect(detectUnsourcedClaims('Le plan d eau est a 10 km du refuge')).toEqual([]);
    expect(detectUnsourcedClaims('Depart a 08:00, arrivee vers 17:00')).toEqual([]);
    expect(detectUnsourcedClaims(null)).toEqual([]);
  });

  it('refuse une proposition qui glisse un prix dans un titre ou une raison', () => {
    const avecPrix = drafted({
      steps: [step({ title: 'Nuit au refuge — 54 EUR la nuit' })],
    });
    const verdict = validateDrafted(avecPrix);
    expect(verdict.ok).toBe(false);
    expect(verdict.reason).toBe('affirmation_non_sourcee');
    expect(verdict.offending).toContain('prix');
  });
});

describe('invariant horaire', () => {
  it('detecte deux etapes qui se chevauchent dans la meme journee', () => {
    const steps = toDomain([
      step({ startTime: '09:00', durationMin: 120 }),
      step({ startTime: '10:30', durationMin: 60 }),
    ]);
    const overlap = findTimeOverlap(steps);
    expect(overlap).not.toBeNull();
    expect(overlap?.[0].title).toBe('Pause au col');
  });

  it('laisse passer des etapes qui s enchainent et des journees distinctes', () => {
    const enchainees = toDomain([
      step({ startTime: '09:00', durationMin: 60 }),
      step({ startTime: '10:00', durationMin: 60 }),
    ]);
    expect(findTimeOverlap(enchainees)).toBeNull();

    const joursDistincts = toDomain([
      step({ day: 1, startTime: '09:00', durationMin: 600 }),
      step({ day: 2, startTime: '09:00', durationMin: 60 }),
    ]);
    expect(findTimeOverlap(joursDistincts)).toBeNull();
  });

  it('refuse une proposition dont le planning ne tient pas', () => {
    const verdict = validateDrafted(
      drafted({
        steps: [step({ startTime: '09:00', durationMin: 120 }), step({ startTime: '10:30', durationMin: 60 })],
      }),
    );
    expect(verdict.ok).toBe(false);
    expect(verdict.reason).toBe('chevauchement_horaire');
    expect(verdict.detail).toBeTruthy();
  });

  it('refuse une proposition vide', () => {
    expect(validateDrafted(drafted({ steps: [] })).reason).toBe('aucune_etape');
  });

  // Mesure live du 2026-09-28 (393x852, `/prepare?nouvelle=1`, Chamonix ->
  // Argentiere, 3 jours) : le modele a repondu avec UNE seule etape, le jour 1.
  // L'ecapuchon affichait alors « Jour 2 » et « Jour 3 » VIDES sous un titre
  // « 3 jours » et des tiles « a verifier » : le parcours complet n existait
  // pas, et rien ne le signalait.
  //
  // Une reponse qui ne couvre pas chaque journee est INCOMPLETE, pas fausse :
  // elle doit etre refusee pour que le repli regles prenne le relais. Ce
  // repli ne fabrique aucune donnee — il ne propose qu une structure, tout
  // chiffre non verifiable restant « a verifier ».
  it('refuse une proposition qui ne couvre pas chaque journee', () => {
    const incomplet = drafted({
      days: 3,
      steps: [step({ day: 1, kind: 'trajet', title: 'Chamonix-Mont-Blanc a Argentiere' })],
    });
    const verdict = validateDrafted(incomplet);
    expect(verdict.ok).toBe(false);
    expect(verdict.reason).toBe('journee_non_couverte');
    expect(verdict.detail).toBeTruthy();
  });

  it('accepte une proposition qui couvre chaque journee', () => {
    const complet = drafted({
      days: 3,
      steps: [
        step({ day: 1, kind: 'trajet', title: 'Chamonix-Mont-Blanc a Argentiere' }),
        step({ day: 2, kind: 'repos', title: 'Pause au col' }),
        step({ day: 3, kind: 'trajet', title: 'Retour depuis Argentiere' }),
      ],
    });
    expect(validateDrafted(complet).ok).toBe(true);
  });

  it('ne confond pas une journee hors borne avec une journee couverte', () => {
    // Une etape du jour 4 pour un voyage de 3 jours ne couvre pas le jour 2.
    const horsBorne = drafted({
      days: 3,
      steps: [step({ day: 1 }), step({ day: 4 }), step({ day: 4 })],
    });
    expect(validateDrafted(horsBorne).reason).toBe('journee_non_couverte');
  });
});

describe('materialisation : aucun prix ne peut naitre du modele', () => {
  it('chaque etape herite du prix a verifier, whatever la proposition', () => {
    const steps = materializeSteps(drafted(), 2);
    expect(steps).toHaveLength(2);
    for (const item of steps) {
      expect(item.price).toEqual(PRICE_TO_CHECK);
      expect(item.price.amount).toBeNull();
      expect(item.state).toBe('propose');
    }
  });
});

describe('classement des reservations', () => {
  it('nuit et trajet demandent une reservation, le reste reste une proposition', () => {
    const steps = annotateAvailability(
      toDomain([step({ kind: 'nuit' }), step({ kind: 'trajet' }), step({ kind: 'repos' })]),
    );
    expect(steps.map((item) => item.state)).toEqual(['a_reserver', 'a_reserver', 'propose']);
  });

  it('ne confirme jamais une etape a la place de l utilisateur', () => {
    const steps = annotateAvailability(toDomain([step({ kind: 'nuit' }), step({ kind: 'arret' })]));
    expect(steps.every((item) => item.state !== 'confirme')).toBe(true);
  });
});

describe('rail de generation : une phase cochee est une phase terminee', () => {
  it('ne coche aucune phase avant le retour reel du proposeur', async () => {
    // `release` est affecte par l'executor du Promise : on part d'une fonction
    // neutre plutot que de `null`, sinon TypeScript croit qu'il ne sera jamais
    // defini et refuse l'appel de liberation.
    let release: () => void = () => {};
    const gate = new Promise<DraftedItinerary | null>((resolve) => {
      release = () => resolve(drafted());
    });
    const phases: GenerationPhaseId[] = [];
    const onPhase: PhaseReporter = (phase) => phases.push(phase);

    const run = runItineraryGeneration(fullDraft(), new AbortController().signal, async () => ({ drafted: await gate, failure: null }), onPhase);
    await Promise.resolve();
    // L appel reseau est en vol : rien n est coche, meme pas la phase 1
    // qui n a pas encore rendu la main.
    expect(phases).toEqual([]);

    release();
    await run;
    expect(phases).toEqual([
      'recherche_parcours',
      'verification_etapes',
      'disponibilites',
      'lieux',
      'trace',
      'meteo',
      'synthese',
    ]);
  });

  it('en cas de repli, seules les phases reellement faites sont cochees', async () => {
    const phases: GenerationPhaseId[] = [];
    const outcome = await runItineraryGeneration(
      fullDraft(),
      new AbortController().signal,
      async () => ({ drafted: null, failure: null }),
      (phase) => phases.push(phase),
    );

    // La recherche a bien eu lieu, elle n a rien rapporte : elle est cochee. Le
    // repli regles refait verification et disponibilites de son cote, et les
    // mesures passent aussi par lui.
    expect(phases).toEqual([
      'recherche_parcours',
      'verification_etapes',
      'disponibilites',
      'lieux',
      'trace',
      'meteo',
      'synthese',
    ]);
    expect(outcome.engineId).toBe('rules');
    expect(outcome.degraded).toBe(true);
    expect(outcome.message).toBe(AI_ENRICHMENT_UNAVAILABLE);
    expect(outcome.model).toEqual(buildItinerary(fullDraft()));
  });

  it('une reponse non conforme est refusee et le repli est actif', async () => {
    const outcome = await runItineraryGeneration(
      fullDraft(),
      new AbortController().signal,
      async () => ({ drafted: drafted({ steps: [step({ title: 'Nuit — 80 EUR' })] }), failure: null }),
      () => {},
    );

    expect(outcome.engineId).toBe('rules');
    expect(outcome.rejectedReason).toBe('affirmation_non_sourcee');
    expect(outcome.model).not.toBeNull();
  });

  it('une reponse conforme produit un parcours IA complet et annonce', async () => {
    const outcome = await runItineraryGeneration(
      fullDraft(),
      new AbortController().signal,
      async () => ({ drafted: drafted(), failure: null }),
      () => {},
    );

    expect(outcome.engineId).toBe('ai');
    expect(outcome.degraded).toBe(false);
    expect(outcome.message).toBe(AI_ACCEPTED);
    expect(outcome.model?.days).toBe(2);
    expect(outcome.model?.steps.every((item) => item.price.amount === null)).toBe(true);
    // Les compteurs restent nuls : le modele ne fournit ni distance ni denivele.
    expect(outcome.model?.totals.distanceKm).toBeNull();
  });

  it('une annulation en cours de route ne produit aucun parcours', async () => {
    const controller = new AbortController();
    const phases: GenerationPhaseId[] = [];
    const outcome = await runItineraryGeneration(
      fullDraft(),
      controller.signal,
      async () => {
        controller.abort();
        return { drafted: drafted(), failure: null };
      },
      (phase) => phases.push(phase),
    );
    // Un parcours a moitie construit serait pire que pas de parcours du tout.
    expect(outcome.model).toBeNull();
    expect(phases).toEqual([]);
  });
});

describe('assemblage du modele', () => {
  it('renumerote par journee et joint les points de repli', () => {
    const steps = toDomain([
      step({ day: 1, kind: 'arret' }),
      step({ day: 1, kind: 'repos' }),
      step({ day: 2, kind: 'nuit' }),
    ]);
    const model = assembleModel(fullDraft(), { days: 2, steps: [], hypotheses: [] }, steps);
    expect(model.steps.map((item) => [item.day, item.order])).toEqual([
      [1, 0],
      [1, 1],
      [2, 0],
    ]);
    expect(model.contingencies.length).toBeGreaterThan(0);
    expect(model.activityCount).toBe(1);
  });

  it('conserve le budget saisi et ne l invente pas quand il est absent', () => {
    const avecBudget = assembleModel(fullDraft(), drafted(), []);
    expect(avecBudget.budgetPerPerson.amount).toBe(90);

    const sansBudget = assembleModel(
      fullDraft({ preferences: { ...fullDraft().preferences, budgetPerPerson: null } }),
      drafted(),
      [],
    );
    expect(sansBudget.budgetPerPerson.amount).toBeNull();
  });
});

describe('le proposeur injecte ne doit jamais lever', () => {
  it('un proposeur qui rejette est traite comme une indisponibilite', async () => {
    const broken = vi.fn(async () => {
      throw new Error('reseau parti');
    });
    const outcome = await runItineraryGeneration(
      fullDraft(),
      new AbortController().signal,
      broken as never,
      () => {},
    );
    expect(outcome.engineId).toBe('rules');
    expect(outcome.degraded).toBe(true);
  });
});
