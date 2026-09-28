'use client';

import { useCallback } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { emptyDraft } from '../engine/emptyDraft';
import { insertWaypoint, type MapCoord } from '../engine/dayNavigation';
import { buildItinerary, type StepDraft } from '../engine/itinerary';
import {
  failGeneration,
  finishGeneration,
  interruptGeneration,
  markPhaseDone,
  resumeGeneration,
  setGenerationFailure,
  setGenerationNotice,
  setPartial,
  startGeneration,
} from '../engine/generation';
import { PREP_DRAFT_VERSION } from '../engine/emptyDraft';
import { draftActions } from './reducer';
import type { PhaseRetry } from '../engine/itineraryPhases';
import type { AIFailureReason } from '@/lib/ai/providers/types';
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
  /** `true` une fois la reprise du brouillon terminee : evite tout ecart de rendu. */
  hydrated: boolean;
}

export interface AdventurePrepActions {
  markHydrated: () => void;
  startNewAdventure: () => void;
  setActivities: (value: ActivitySelection) => void;
  /** Partir sans activite du catalogue : l invite libre suffit. */
  dismissPicker: () => void;
  setRoute: (value: RouteBlock) => void;
  /** Invite libre de l'etape 1 : ce que l'utilisateur veut, en toutes lettres. */
  setBrief: (value: string | null) => void;
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
   * Re-arme UNE phase de generation, et une seule.
   *
   * Refuse toute phase qui n est pas celle que l etat designe comme tombee,
   * et ne coche rien : elle rend la phase « en attente », pas « reussie ».
   */
  retryPhase: (id: GenerationPhaseId) => void;
  /**
   * Depose le resultat reel d une reprise. Succes : phase cochee + modele depose.
   * Echec : rien de coche, parcours d origine conserve, raison ecrite dans
   * generation.error pour que le bandeau puisse la nommer.
   */
  applyPhaseRetry: (retry: PhaseRetry) => void;
  /**
   * Depose le parcours reellement produit, quel que soit le moteur qui l'a
   * construit, et la phrase qui dit si l'enrichissement a eu lieu. Les regles
   * et l'IA passent donc par le meme point d'entree : l'ecran ne connait pas le
   * moteur, il affiche ce qu'il a recu.
   */
  applyGenerated: (
    itinerary: ItineraryModel,
    notice: string | null,
    failure: AIFailureReason | null,
  ) => void;
  addStepToDay: (day: number, kind: ItineraryStepKind, step: StepDraft) => void;
  /**
   * Pose un point de passage a la position indiquee sur la carte.
   *
   * Passe par `insertWaypoint` et non par `applyGenerated` : un point pose par
   * l'utilisateur n est pas une production de l IA, et la notice qui dit ce que
   * l IA a propose doit survivre a cette edition.
   */
  addWaypoint: (coord: MapCoord, day: number) => void;
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
        dismissPicker: () => patch((draft) => draftActions.dismissPicker(draft)),
        setRoute: (value) => patch((draft) => draftActions.setRoute(draft, value)),
        setBrief: (value) => patch((draft) => draftActions.setBrief(draft, value)),
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
        retryPhase: (id) => patch((draft) => draftActions.retryPhase(draft, id)),
        applyPhaseRetry: (retry) =>
          patch((draft) => draftActions.applyPhaseRetry(draft, retry)),
        applyGenerated: (itinerary, notice, failure) =>
          patch((draft) => {
            const finished = setGenerationFailure(
              setGenerationNotice(finishGeneration(draft.generation), notice),
              failure,
            );
            return draftActions.setItinerary(draftActions.setGeneration(draft, finished), itinerary);
          }),
        addStepToDay: (day, kind, step) =>
          patch((draft) => draftActions.addItineraryStep(draft, day, kind, step)),
        addWaypoint: (coord, day) =>
          patch((draft) =>
            draft.itinerary
              ? draftActions.updateItinerary(
                  draft,
                  insertWaypoint(draft.itinerary, coord, day),
                )
              : draft,
          ),
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
