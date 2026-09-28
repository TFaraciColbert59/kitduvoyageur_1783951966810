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
import type { GenerationOutcome, PhaseRetry } from '../engine/itineraryPhases';
import {
  clearPhaseOutcome,
  finishGeneration,
  interruptGeneration,
  markPhaseDone,
  resumeGeneration,
  setGenerationFailure,
  setGenerationNotice,
  setPartial,
  setPhaseOutcomes,
  startGeneration,
  failGeneration,
} from '../engine/generation';
import { resolvedGear } from '../engine/gear';
import { emptyDraft } from '../engine/emptyDraft';
import { suggestDuration, suggestStartDate } from '../engine/calendar';
import { briefRequestedDays, suggestDurationDays } from '../engine/briefDays';

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

  setActivities: (draft: AdventurePrepDraft, activities: ActivitySelection): AdventurePrepDraft => {
    const chosen = commit(draft, { activities, itinerary: null });
    // Un brief qui NOMME une duree prime sur les heures du catalogue.
    // Sans cette regle, choisir « randonnee avec nuit de refuge » (24 h)
    // ecrivait 1 jour pendant que le brief demandait un week-end : l ecran
    // affichait 1 jour, et le prompt en annoncait 2. Le meme parcours etait
    // donc decrit deux fois, contradictoirement, avant meme la generation.
    // Le brief muet laisse la main au catalogue — et `briefRequestedDays`
    // renvoie `null` dans ce cas, jamais 1.
    const asked = briefRequestedDays(draft.brief);
    return asked === null ? suggestDuration(chosen) : suggestDurationDays(chosen, asked);
  },

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
    commit(draft, {
      coverName: coverName && coverName.trim().length > 0 ? coverName.trim() : null,
    }),

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
      // Le verdict de la phase devient PERIME : il decrit un etat passe, et le
      // garder afficherait « Échec : … » pendant que la reprise travaille.
      generation: clearPhaseOutcome(
        {
          ...draft.generation,
          status: 'en_cours',
          error: null,
          phases: draft.generation.phases.map((p) => (p.id === phase ? { ...p, done: false } : p)),
        },
        phase
      ),
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
        generation: setPhaseOutcomes(
          {
            ...draft.generation,
            status: 'echec',
            error: outcome.reason ?? 'Cette étape de préparation n a pas abouti.',
          },
          [...(draft.generation.outcomes ?? []), outcome]
        ),
      });
    }
    return commit(draft, {
      itinerary: model,
      generation: setPhaseOutcomes(
        {
          ...markPhaseDone(clearPhaseOutcome(draft.generation, phase), phase),
          status: 'termine',
          error: null,
        },
        [...(draft.generation.outcomes ?? []), outcome]
      ),
    });
  },

  setItinerary: (draft: AdventurePrepDraft, itinerary: ItineraryModel | null): AdventurePrepDraft =>
    commit(draft, { itinerary }),

  /**
   * Depose le resultat REEL d une generation terminee.
   *
   * Les regles et l'IA passent donc par le meme point d'entree : l'ecran ne
   * connait pas le moteur, il affiche ce qu'il a recu — y compris les phases qui
   * n'ont rien livre. Ces verdicts-la sont la seule chose qui permette au
   * bandeau de nommer une panne et de proposer de la rejouer.
   */
  applyGenerated: (draft: AdventurePrepDraft, outcome: GenerationOutcome): AdventurePrepDraft => {
    if (!outcome.model) return draft;
    // La date proposee est APPLIQUEE ICI, et nulle part ailleurs : c est le
    // seul moment ou le resultat d une generation devient l'etat affiche.
    // `suggestStartDate` respecte lui-meme les deux garde-fous — une date
    // saisie a la main n est jamais remplacee, une proposition non acceptee
    // ne touche a rien — donc l appel est sur : il n a pas de branche a tester.
    const dated = suggestStartDate(draft, outcome.suggestedStartDate);
    // La duree suit exactement le meme chemin que la date (P0.18) : meme moment
    // d application, memes garde-fous dans `suggestDurationDays`. Elle passe
    // donc par la date plutot que par le brouillon d origine, sinon une date
    // ET une duree proposees ensemble ne s appliqueraient que l une des deux.
    const timed = suggestDurationDays(dated, outcome.suggestedDurationDays);
    const generation = setPhaseOutcomes(
      setGenerationFailure(
        setGenerationNotice(finishGeneration(draft.generation), outcome.message),
        outcome.failure
      ),
      outcome.phases
    );
    return commit(timed, { itinerary: outcome.model, generation });
  },

  updateItinerary: (draft: AdventurePrepDraft, next: ItineraryModel): AdventurePrepDraft =>
    commit(draft, { itinerary: next }),

  addItineraryStep: (
    draft: AdventurePrepDraft,
    day: number,
    kind: ItineraryStepKind,
    stepDraft: StepDraft
  ): AdventurePrepDraft => {
    if (!draft.itinerary) return draft;
    return commit(draft, { itinerary: addStep(draft.itinerary, day, kind, stepDraft) });
  },

  setItineraryKept: (
    draft: AdventurePrepDraft,
    stepId: string,
    kept: boolean
  ): AdventurePrepDraft => {
    if (!draft.itinerary) return draft;
    return commit(draft, { itinerary: setStepKept(draft.itinerary, stepId, kept) });
  },

  setItineraryMealSlot: (
    draft: AdventurePrepDraft,
    stepId: string,
    mealSlot: MealSlot | null
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

  setGearWeight: (
    draft: AdventurePrepDraft,
    gearId: string,
    grams: number | null
  ): AdventurePrepDraft =>
    commit(draft, {
      gear: draft.gear.map((item) => (item.id === gearId ? { ...item, weightGrams: grams } : item)),
    }),

  assignGear: (
    draft: AdventurePrepDraft,
    gearId: string,
    ownerId: string | null
  ): AdventurePrepDraft =>
    commit(draft, {
      gear: draft.gear.map((item) => (item.id === gearId ? { ...item, ownerId } : item)),
    }),

  refreshGear: (draft: AdventurePrepDraft): AdventurePrepDraft => {
    return commit(draft, { gear: resolvedGear(draft) });
  },
};
