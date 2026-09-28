import type {
  ActivitySelection,
  AdventurePrepDraft,
  CalendarBlock,
  GroupBlock,
  ItineraryModel,
  ItineraryStepKind,
  MealSlot,
  PreferencesBlock,
  PrepStepId,
  RouteBlock,
} from '../types';
import { PREP_STEPS, deriveRouteShape, failedGenerationPhase } from '../types';
import { canOpenStep, isStepSatisfied } from '../engine/steps';
import { applyAdjustment } from '../engine/adjustments';
import {
  addStep,
  buildItinerary,
  removeStep,
  setStepKept,
  setStepMealSlot,
  type StepDraft,
} from '../engine/itinerary';
import type { AdjustmentId } from '../types';
import type { GenerationPhaseId, GenerationState } from '../types';
import type { PhaseRetry } from '../engine/itineraryPhases';
import {
  finishGeneration,
  interruptGeneration,
  markPhaseDone,
  resumeGeneration,
  setPartial,
  startGeneration,
  failGeneration,
} from '../engine/generation';
import { resolvedGear } from '../engine/gear';
import { emptyDraft } from '../engine/emptyDraft';
import { suggestDuration } from '../engine/calendar';

/** Chaque mutation renvoie un nouveau brouillon et bumps la version de reprise. */
function commit(draft: AdventurePrepDraft, patch: Partial<AdventurePrepDraft>): AdventurePrepDraft {
  return {
    ...draft,
    ...patch,
    version: draft.version + 1,
    updatedAt: Date.now(),
  };
}

export const draftActions = {
  reset: (draft: AdventurePrepDraft): AdventurePrepDraft => ({
    ...emptyDraft(),
    version: draft.version + 1,
  }),

  setActivities: (draft: AdventurePrepDraft, activities: ActivitySelection): AdventurePrepDraft =>
    suggestDuration(commit(draft, { activities, itinerary: null })),

  // Partir sans activite du catalogue : le catalogue se ferme, l etape 1
  // reste ouverte sur le depart, la date et les participants.
  dismissPicker: (draft: AdventurePrepDraft): AdventurePrepDraft =>
    commit(draft, { pickerDismissed: true }),

  /**
   * La forme du parcours n'est jamais saisie : elle est derivee des lieux
   * choisis. Une arrivee absente donne une boucle, une arrivee presente un
   * aller simple. Toute valeur de `shape` recue de l'appelant est ecrasee.
   */
  setRoute: (draft: AdventurePrepDraft, route: RouteBlock): AdventurePrepDraft =>
    commit(draft, {
      route: { ...route, shape: deriveRouteShape(route) },
      itinerary: null,
    }),

  /** Invite libre de l'etape 1 : elle alimente la generation IA. */
  setBrief: (draft: AdventurePrepDraft, brief: string | null): AdventurePrepDraft =>
    commit(draft, {
      brief: brief && brief.trim().length > 0 ? brief.trim() : null,
      itinerary: null,
    }),

  setCalendar: (draft: AdventurePrepDraft, calendar: CalendarBlock): AdventurePrepDraft =>
    commit(draft, { calendar, itinerary: null }),

  setGroup: (draft: AdventurePrepDraft, group: GroupBlock): AdventurePrepDraft =>
    commit(draft, { group }),

  setPreferences: (draft: AdventurePrepDraft, preferences: PreferencesBlock): AdventurePrepDraft =>
    commit(draft, { preferences }),

  setCoverName: (draft: AdventurePrepDraft, coverName: string | null): AdventurePrepDraft =>
    commit(draft, { coverName: coverName && coverName.trim().length > 0 ? coverName.trim() : null }),

  /**
   * Seul passage possible vers une autre etape — et il est REFUSE tant que
   * l etape precedente n est pas satisfaite.
   *
   * Le defaut : `currentStep` etait pose sans verification. Une fois
   * `currentStep` incoherent, `completedSteps` ne suffisait plus a dire ce que
   * l utilisateur avait REALLY valide : un aller-retour « Revenir a
   * Preparation » pouvait laisser le parcours pointer l etape 3 sans que
   * l etape 2 ait produit de parcours. Le store autorisait donc un etat que
   * l ecran ne pouvait pas expliquer.
   *
   * On refuse au lieu de corriger apres coup : renvoyer le MEME objet, sans
   * passer par `commit`, laisse `version` intacte — donc pas de re-rendu et
   * pas d ecriture dans le brouillon autosave pour un saut qui n a pas eu
   * lieu.
   */
  goToStep: (draft: AdventurePrepDraft, currentStep: PrepStepId): AdventurePrepDraft => {
    if (currentStep === draft.currentStep) return draft;
    if (!canOpenStep(draft, currentStep)) return draft;
    return commit(draft, { currentStep });
  },

  /**
   * Validation explicite d une etape, followed d avance d une seule.
   *
   * On refuse de valider une etape non satisfaite : sans ce garde, un ecran
   * pouvait appeler `completeStep` par megarde et hop — l etape entrait dans
   * `completedSteps` avec des reponses manquantes, ce qui rendait ensuite
   * `canOpenStep` faux alors que l utilisateur croyait avoir valide.
   */
  completeStep: (draft: AdventurePrepDraft, step: PrepStepId): AdventurePrepDraft => {
    if (!isStepSatisfied(draft, step)) return draft;
    const completedSteps = draft.completedSteps.includes(step)
      ? draft.completedSteps
      : [...draft.completedSteps, step];
    const next = PREP_STEPS[PREP_STEPS.indexOf(step) + 1];
    return commit(draft, {
      completedSteps,
      currentStep: next ?? draft.currentStep,
    });
  },

  setGeneration: (draft: AdventurePrepDraft, generation: GenerationState): AdventurePrepDraft =>
    commit(draft, { generation }),

  /**
   * Re-arme UNE phase, et rien d autre.
   *
   * C est le seul geste autorise derriere un bouton « Reessayer ». Deux garde-fous
   * tiennent l integrite de l etat :
   *
   * 1. Seule la phase REELLEMENT en echec est re-armee. Rejouer `trace` alors
   *    que c est `meteo` qui a echoue lui ferait perdre des mesures deja acquises
   *    pour rien. Le refus rend le MEME objet : `version` intacte, donc ni
   *    re-rendu ni ecriture autosave pour une reprise qui n a pas eu lieu.
   * 2. Aucune phase n est cochee, aucune etape n est ajoutee. Re-armee veut dire
   *    « en attente », pas « reussie » : cocher ici produirait exactement le
   *    mensonge que ce preparateur interdit — une coche sans travail derriere.
   *
   * `notice` et `failure` sont conserves : c est la derniere cause REELLEMENT
   * observee, et elle reste vraie tant qu un resultat n est pas venu la
   * remplacer. Les effacer au clic ferait disparaitre l information au moment
   * ou l utilisateur cherche a comprendre.
   */
  retryPhase: (draft: AdventurePrepDraft, phase: GenerationPhaseId): AdventurePrepDraft => {
    const fallen = failedGenerationPhase(draft.generation);
    if (!fallen || fallen.id !== phase) return draft;
    return commit(draft, {
      generation: {
        ...draft.generation,
        status: 'en_cours',
        error: null,
        phases: draft.generation.phases.map((p) => (p.id === phase ? { ...p, done: false } : p)),
      },
    });
  },

  /**
   * Depose le resultat REEL d une reprise de phase.
   *
   * Succes : la phase cochee est cochee, le modele renvoye par le moteur est
   * depose tel quel, l erreur est effacee. Echec : RIEN n est coche, le parcours
   * d origine est conserve intact — `retryGenerationPhase` garantit que le
   * modele qu il rend est alors exactement celui qu il a recu, donc deposer un
   * parcours a moitie reconstruit est impossible ici par construction.
   *
   * La raison de l echec est stockee dans `error`, qui est un texte libre honnete
   * : elle vient du moteur, deja redigee pour etre lue. `failure` n est pas
   * touche : c est la cause du service, pas le resultat de cette reprise.
   */
  applyPhaseRetry: (draft: AdventurePrepDraft, retry: PhaseRetry): AdventurePrepDraft => {
    const { phase, model, outcome } = retry;
    if (outcome.status !== 'reussie') {
      return commit(draft, {
        generation: {
          ...draft.generation,
          status: 'echec',
          error: outcome.reason ?? 'Cette étape de préparation n a pas abouti.',
        },
      });
    }
    return commit(draft, {
      itinerary: model,
      generation: {
        ...markPhaseDone(draft.generation, phase),
        status: 'termine',
        error: null,
      },
    });
  },

  setItinerary: (draft: AdventurePrepDraft, itinerary: ItineraryModel | null): AdventurePrepDraft =>
    commit(draft, { itinerary }),

  updateItinerary: (draft: AdventurePrepDraft, next: ItineraryModel): AdventurePrepDraft =>
    commit(draft, { itinerary: next }),

  addItineraryStep: (
    draft: AdventurePrepDraft,
    day: number,
    kind: ItineraryStepKind,
    stepDraft: StepDraft,
  ): AdventurePrepDraft => {
    if (!draft.itinerary) return draft;
    return commit(draft, { itinerary: addStep(draft.itinerary, day, kind, stepDraft) });
  },

  setItineraryKept: (draft: AdventurePrepDraft, stepId: string, kept: boolean): AdventurePrepDraft => {
    if (!draft.itinerary) return draft;
    return commit(draft, { itinerary: setStepKept(draft.itinerary, stepId, kept) });
  },

  setItineraryMealSlot: (
    draft: AdventurePrepDraft,
    stepId: string,
    mealSlot: MealSlot | null,
  ): AdventurePrepDraft => {
    if (!draft.itinerary) return draft;
    return commit(draft, { itinerary: setStepMealSlot(draft.itinerary, stepId, mealSlot) });
  },

  removeItineraryStep: (draft: AdventurePrepDraft, stepId: string): AdventurePrepDraft => {
    if (!draft.itinerary) return draft;
    return commit(draft, { itinerary: removeStep(draft.itinerary, stepId) });
  },

  applyAdjustment: (draft: AdventurePrepDraft, id: AdjustmentId): AdventurePrepDraft => {
    if (!draft.itinerary) return draft;
    return commit(draft, { itinerary: applyAdjustment(draft.itinerary, id) });
  },

  setPacked: (draft: AdventurePrepDraft, gearId: string, packed: boolean): AdventurePrepDraft => {
    const packedGearIds = packed
      ? [...new Set([...draft.packedGearIds, gearId])]
      : draft.packedGearIds.filter((id) => id !== gearId);
    return commit(draft, {
      packedGearIds,
      gear: draft.gear.map((item) => (item.id === gearId ? { ...item, packed } : item)),
    });
  },

  setGearWeight: (draft: AdventurePrepDraft, gearId: string, grams: number | null): AdventurePrepDraft =>
    commit(draft, {
      gear: draft.gear.map((item) =>
        item.id === gearId ? { ...item, weightGrams: grams } : item,
      ),
    }),

  assignGear: (draft: AdventurePrepDraft, gearId: string, ownerId: string | null): AdventurePrepDraft =>
    commit(draft, {
      gear: draft.gear.map((item) => (item.id === gearId ? { ...item, ownerId } : item)),
    }),

  refreshGear: (draft: AdventurePrepDraft): AdventurePrepDraft => {
    return commit(draft, { gear: resolvedGear(draft) });
  },
};

