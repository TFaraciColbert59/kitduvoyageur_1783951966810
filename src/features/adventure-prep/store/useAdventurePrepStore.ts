'use client';

import { useCallback } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { emptyDraft } from '../engine/emptyDraft';
import { buildItinerary, type StepDraft } from '../engine/itinerary';
import {
  failGeneration,
  finishGeneration,
  interruptGeneration,
  markPhaseDone,
  resumeGeneration,
  setPartial,
  startGeneration,
} from '../engine/generation';
import { PREP_DRAFT_VERSION } from '../engine/emptyDraft';
import { draftActions } from './reducer';
import type {
  ActivitySelection,
  AdventurePrepDraft,
  AdjustmentId,
  CalendarBlock,
  GenerationPhaseId,
  GroupBlock,
  ItineraryStepKind,
  MealSlot,
  PreferencesBlock,
  PrepStepId,
  RouteBlock,
} from '../types';

export interface AdventurePrepState {
  adventureId: string;
  draft: AdventurePrepDraft;
  /** `true` une fois la reprise du brouillon terminee : evite tout ecart de rendu. */
  hydrated: boolean;
}

export interface AdventurePrepActions {
  markHydrated: () => void;
  startNewAdventure: () => void;
  setActivities: (value: ActivitySelection) => void;
  setRoute: (value: RouteBlock) => void;
  setCalendar: (value: CalendarBlock) => void;
  setGroup: (value: GroupBlock) => void;
  setPreferences: (value: PreferencesBlock) => void;
  setCoverName: (value: string | null) => void;
  resetDraft: () => void;
  goToStep: (step: PrepStepId) => void;
  completeStep: (step: PrepStepId) => void;
  proposeItinerary: () => void;
  startGenerationRun: () => void;
  continueGeneration: () => void;
  markPhase: (id: GenerationPhaseId) => void;
  pushGenerated: (days: number) => void;
  stopGeneration: () => void;
  failGenerationRun: (message: string) => void;
  endGeneration: () => void;
  addStepToDay: (day: number, kind: ItineraryStepKind, step: StepDraft) => void;
  keepStep: (stepId: string, kept: boolean) => void;
  linkMeal: (stepId: string, slot: MealSlot | null) => void;
  dropStep: (stepId: string) => void;
  adjust: (id: AdjustmentId) => void;
  setPacked: (gearId: string, packed: boolean) => void;
  setGearWeight: (gearId: string, grams: number | null) => void;
  assignGear: (gearId: string, ownerId: string | null) => void;
  syncGear: () => void;
}

export type AdventurePrepStore = AdventurePrepState & AdventurePrepActions;

const newAdventureId = (): string =>
  `av-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export const useAdventurePrepStore = create<AdventurePrepStore>()(
  persist(
    (set, get) => {
      const patch = (next: (draft: AdventurePrepDraft) => AdventurePrepDraft) =>
        set((state) => ({ draft: next(state.draft) }));
      return {
        adventureId: newAdventureId(),
        draft: emptyDraft(),
        hydrated: false,
        markHydrated: () => set({ hydrated: true }),
        startNewAdventure: () =>
          set({ adventureId: newAdventureId(), draft: { ...emptyDraft(), version: PREP_DRAFT_VERSION } }),
        setActivities: (value) => patch((draft) => draftActions.setActivities(draft, value)),
        setRoute: (value) => patch((draft) => draftActions.setRoute(draft, value)),
        setCalendar: (value) => patch((draft) => draftActions.setCalendar(draft, value)),
        setGroup: (value) => patch((draft) => draftActions.setGroup(draft, value)),
        setPreferences: (value) => patch((draft) => draftActions.setPreferences(draft, value)),
        setCoverName: (value) => patch((draft) => draftActions.setCoverName(draft, value)),
        resetDraft: () =>
          set((state) => ({
            adventureId: newAdventureId(),
            draft: draftActions.reset(state.draft),
          })),
        goToStep: (step) => patch((draft) => draftActions.goToStep(draft, step)),
        completeStep: (step) => patch((draft) => draftActions.completeStep(draft, step)),
        proposeItinerary: () =>
          patch((draft) => {
            const itinerary = buildItinerary(draft);
            return itinerary
              ? draftActions.setItinerary(draft, itinerary)
              : draftActions.setItinerary(draft, null);
          }),
        startGenerationRun: () =>
          patch((draft) => draftActions.setGeneration(draft, startGeneration(draft.generation))),
        continueGeneration: () =>
          patch((draft) => draftActions.setGeneration(draft, resumeGeneration(draft.generation))),
        markPhase: (id) =>
          patch((draft) => draftActions.setGeneration(draft, markPhaseDone(draft.generation, id))),
        pushGenerated: (days) =>
          patch((draft) => {
            const steps = buildItinerary(draft)?.steps ?? draft.generation.steps;
            return draftActions.setGeneration(draft, setPartial(draft.generation, steps, days));
          }),
        stopGeneration: () =>
          patch((draft) => draftActions.setGeneration(draft, interruptGeneration(draft.generation))),
        failGenerationRun: (message) =>
          patch((draft) => draftActions.setGeneration(draft, failGeneration(draft.generation, message))),
        endGeneration: () =>
          patch((draft) => {
            const itinerary = buildItinerary(draft);
            const generation = finishGeneration(draft.generation);
            const withGeneration = draftActions.setGeneration(draft, generation);
            return itinerary
              ? draftActions.setItinerary(withGeneration, itinerary)
              : withGeneration;
          }),
        addStepToDay: (day, kind, step) =>
          patch((draft) => draftActions.addItineraryStep(draft, day, kind, step)),
        keepStep: (stepId, kept) =>
          patch((draft) => draftActions.setItineraryKept(draft, stepId, kept)),
        linkMeal: (stepId, slot) =>
          patch((draft) => draftActions.setItineraryMealSlot(draft, stepId, slot)),
        dropStep: (stepId) => patch((draft) => draftActions.removeItineraryStep(draft, stepId)),
        adjust: (id) => patch((draft) => draftActions.applyAdjustment(draft, id)),
        setPacked: (gearId, packed) =>
          patch((draft) => draftActions.setPacked(draft, gearId, packed)),
        setGearWeight: (gearId, grams) =>
          patch((draft) => draftActions.setGearWeight(draft, gearId, grams)),
        assignGear: (gearId, ownerId) =>
          patch((draft) => draftActions.assignGear(draft, gearId, ownerId)),
        syncGear: () => patch((draft) => draftActions.refreshGear(draft)),
      };
    },
    {
      name: `lkdv_adventure_prep_v${PREP_DRAFT_VERSION}`,
      version: PREP_DRAFT_VERSION,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ adventureId: state.adventureId, draft: state.draft }),
      onRehydrateStorage: () => (state) => {
        state?.markHydrated();
      },
    },
  ),
);

/** Selecteur de draft : la route n'abonne que l'ecran qui en a besoin. */
export const usePrepDraft = (): AdventurePrepDraft => useAdventurePrepStore((state) => state.draft);

export const usePrepAction = <T,>(
  select: (store: AdventurePrepStore) => T,
): T => useAdventurePrepStore(select);

/** Acces hors React (tests, gestionnaires d'evenements). */
export const prepStore = {
  get: (): AdventurePrepStore => useAdventurePrepStore.getState(),
  subscribe: (listener: () => void) => useAdventurePrepStore.subscribe(listener),
};

/** Reference stable pour les gestionnaires d'evenements sans re-rendu. */
export const useStableCallback = <T extends (...args: never[]) => unknown>(fn: T): T =>
  useCallback(fn, [fn]);
