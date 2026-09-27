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
import { PREP_STEPS } from '../types';
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

  setRoute: (draft: AdventurePrepDraft, route: RouteBlock): AdventurePrepDraft =>
    commit(draft, { route, itinerary: null }),

  setCalendar: (draft: AdventurePrepDraft, calendar: CalendarBlock): AdventurePrepDraft =>
    commit(draft, { calendar, itinerary: null }),

  setGroup: (draft: AdventurePrepDraft, group: GroupBlock): AdventurePrepDraft =>
    commit(draft, { group }),

  setPreferences: (draft: AdventurePrepDraft, preferences: PreferencesBlock): AdventurePrepDraft =>
    commit(draft, { preferences }),

  setCoverName: (draft: AdventurePrepDraft, coverName: string | null): AdventurePrepDraft =>
    commit(draft, { coverName: coverName && coverName.trim().length > 0 ? coverName.trim() : null }),

  goToStep: (draft: AdventurePrepDraft, currentStep: PrepStepId): AdventurePrepDraft =>
    commit(draft, { currentStep }),

  completeStep: (draft: AdventurePrepDraft, step: PrepStepId): AdventurePrepDraft => {
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

