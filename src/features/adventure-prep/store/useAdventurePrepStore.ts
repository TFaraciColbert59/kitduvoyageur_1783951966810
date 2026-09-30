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
  setGenerationNotice,
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
  ItineraryModel,
  MealSlot,
  PreferencesBlock,
  PrepStepId,
  RouteBlock,
} from '../types';

export interface AdventurePrepState {
  adventureId: string;
  draft: AdventurePrepDraft;
  /**
   * Aventure enregistree que ce brouillon modifie. `null` = nouvelle aventure :
   * l'enregistrement la cree. Sinon il ajoute une version a ce plan (L0.7).
   */
  planId: string | null;
  /** Version du plan sur laquelle l'ecran travaille (verrou optimiste). */
  planVersion: number | null;
  /** `true` une fois la reprise du brouillon terminee : evite tout ecart de rendu. */
  hydrated: boolean;
}

export interface AdventurePrepActions {
  markHydrated: () => void;
  startNewAdventure: () => void;
  /** Ouvre une aventure enregistree dans le meme ecran que la creation. */
  loadSavedPlan: (planId: string, planVersion: number, draft: AdventurePrepDraft) => void;
  /** Rattache le brouillon au plan que le serveur vient d'ecrire. */
  markSaved: (planId: string, planVersion: number) => void;
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
  /**
   * Depose le parcours reellement produit, quel que soit le moteur qui l'a
   * construit, et la phrase qui dit si l'enrichissement a eu lieu. Les regles
   * et l'IA passent donc par le meme point d'entree : l'ecran ne connait pas le
   * moteur, il affiche ce qu'il a recu.
   */
  applyGenerated: (itinerary: ItineraryModel, notice: string | null) => void;
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

/** Format persiste courant. Ne jamais reutiliser un numero deja publie. */
export const PREP_PERSIST_VERSION = 2;

/**
 * Reprise d'un etat persiste d'une version anterieure. Un brouillon en cours
 * n'est JAMAIS jete a la mise a jour : seuls les champs nouveaux sont completes.
 */
export function migratePersistedPrep(persisted: unknown): Partial<AdventurePrepState> {
  if (persisted === null || typeof persisted !== 'object') return {};
  const raw = persisted as Partial<AdventurePrepState>;
  return {
    ...raw,
    planId: typeof raw.planId === 'string' ? raw.planId : null,
    planVersion: typeof raw.planVersion === 'number' ? raw.planVersion : null,
  };
}

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
        planId: null,
        planVersion: null,
        hydrated: false,
        markHydrated: () => set({ hydrated: true }),
        startNewAdventure: () =>
          set({
            adventureId: newAdventureId(),
            draft: { ...emptyDraft(), version: PREP_DRAFT_VERSION },
            planId: null,
            planVersion: null,
          }),
        loadSavedPlan: (planId, planVersion, draft) =>
          set({ adventureId: newAdventureId(), draft, planId, planVersion }),
        markSaved: (planId, planVersion) => set({ planId, planVersion }),
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
            planId: null,
            planVersion: null,
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
        applyGenerated: (itinerary, notice) =>
          patch((draft) => {
            const finished = draftActions.setGeneration(
              draft,
              setGenerationNotice(finishGeneration(draft.generation), notice),
            );
            return draftActions.setItinerary(finished, itinerary);
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
      // Version du FORMAT persiste (distincte de la version du brouillon) :
      // 2 ajoute planId/planVersion. Les brouillons v1 sont repris tels quels.
      version: PREP_PERSIST_VERSION,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        adventureId: state.adventureId,
        draft: state.draft,
        planId: state.planId,
        planVersion: state.planVersion,
      }),
      migrate: (persisted) => migratePersistedPrep(persisted),
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
