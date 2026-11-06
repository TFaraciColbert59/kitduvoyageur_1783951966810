'use client';

import { useCallback, useMemo, useReducer, useRef, useState } from 'react';
import { z } from 'zod';
import {
  DEFAULT_BAG_CAPABILITIES,
  kitConfigurationReducer,
} from './kitConfiguration';
import { selectDerivedTotals } from './selectors';
import type {
  AnchorId,
  BagCapabilities,
  DerivedTotals,
  KitAction,
  KitConfiguration,
  KitItem,
  PartConfig,
  PartId,
  SlotId,
  SlotState,
} from './types';

// ── 1. Schémas de validation Zod ──────────────────────────────────────────────

export const kitPartCustomizeSchema = z.object({
  partId: z.string().min(1).max(64),
  config: z.object({
    material: z.string().max(64).optional(),
    color: z.string().max(64).optional(),
    finish: z.enum(['matte', 'gloss', 'metallic', 'rough']).optional(),
  }),
});

export const kitItemMoveSchema = z.object({
  itemId: z.string().min(1),
  targetSlotId: z.string().max(64).nullable(),
  slotOrder: z.number().int().min(0).max(1000).nullable().optional(),
});

export const kitBagSelectSchema = z.object({
  modelId: z.string().max(64).nullable(),
  capabilities: z.any().optional(),
  declaredCapacityL: z.number().nullable().optional(),
  availableSlots: z.array(z.any()).optional(),
});

export const kitItemCheckSchema = z.object({
  itemId: z.string().min(1),
  isChecked: z.boolean(),
});

export const kitItemUpdateQuantitySchema = z.object({
  itemId: z.string().min(1),
  quantity: z.number().int().min(1),
});

export const kitItemAddSchema = z.object({
  item: z.object({
    id: z.string().min(1),
    productOwnershipId: z.string().nullable().optional(),
    name: z.string().min(1),
    category: z.string().nullable().optional(),
    quantity: z.number().int().min(1).default(1),
    weightG: z.number().nullable().optional(),
    weightSource: z.enum(['declared', 'catalog', 'unknown']).default('unknown'),
    isChecked: z.boolean().default(false),
    slotId: z.string().nullable().optional(),
    visual: z.any().optional(),
  }),
  slotId: z.string().nullable().optional(),
});

export const kitItemRemoveSchema = z.object({
  itemId: z.string().min(1),
});

export const kitBadgePlaceSchema = z.object({
  badgeId: z.string().min(1),
  anchorId: z.string().min(1),
  scale: z.number().min(0.5).max(3.0).optional(),
});

export const kitBadgeRemoveSchema = z.object({
  placedBadgeId: z.string().min(1),
});

export const kitMutationPayloadSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('part/customize'),
    payload: kitPartCustomizeSchema,
  }),
  z.object({
    type: z.literal('item/move'),
    payload: kitItemMoveSchema,
  }),
  z.object({
    type: z.literal('bag/select'),
    payload: kitBagSelectSchema,
  }),
  z.object({
    type: z.literal('item/check'),
    payload: kitItemCheckSchema,
  }),
  z.object({
    type: z.literal('item/updateQuantity'),
    payload: kitItemUpdateQuantitySchema,
  }),
  z.object({
    type: z.literal('item/add'),
    payload: kitItemAddSchema,
  }),
  z.object({
    type: z.literal('item/remove'),
    payload: kitItemRemoveSchema,
  }),
  z.object({
    type: z.literal('badge/place'),
    payload: kitBadgePlaceSchema,
  }),
  z.object({
    type: z.literal('badge/remove'),
    payload: kitBadgeRemoveSchema,
  }),
]);

export type KitMutationPayload = z.infer<typeof kitMutationPayloadSchema>;

// ── 2. Interfaces & Types du Hook ─────────────────────────────────────────────

export interface UseKitStudioOptions {
  initialConfig: KitConfiguration;
  onSaveSuccess?: (config: KitConfiguration) => void;
  onSaveError?: (error: Error, snapshot: KitConfiguration) => void;
  apiClient?: (
    mutation: KitMutationPayload,
    clientRevision: number
  ) => Promise<{ revision: number; [key: string]: any }>;
}

export interface UseKitStudioResult {
  state: KitConfiguration;
  totals: DerivedTotals;
  isSaving: boolean;
  activeError: string | null;
  // Mutations optimistes
  moveItem: (itemId: string, targetSlotId: SlotId | null, slotOrder?: number | null) => Promise<void>;
  toggleItemChecked: (itemId: string, isChecked: boolean) => Promise<void>;
  updateItemQuantity: (itemId: string, quantity: number) => Promise<void>;
  addItem: (item: Omit<KitItem, 'slotOrder'>, slotId?: SlotId | null) => Promise<void>;
  removeItem: (itemId: string) => Promise<void>;
  customizePart: (partId: PartId, config: Partial<PartConfig>) => Promise<void>;
  selectBagModel: (
    modelId: string | null,
    capabilities?: BagCapabilities,
    declaredCapacityL?: number | null,
    availableSlots?: SlotState[]
  ) => Promise<void>;
  placeBadge: (badgeId: string, anchorId: AnchorId, scale?: number) => Promise<void>;
  removeBadge: (placedBadgeId: string) => Promise<void>;
  resetToSnapshot: () => void;
}

// ── 3. Implémentation du Hook ─────────────────────────────────────────────────

export function useKitStudio({
  initialConfig,
  onSaveSuccess,
  onSaveError,
  apiClient,
}: UseKitStudioOptions): UseKitStudioResult {
  const [state, dispatch] = useReducer(kitConfigurationReducer, initialConfig);

  // ── Synchronous State & Queue Tracking Refs ──
  // latestStateRef guarantees synchronous state access across chained microtasks without React closure staleness
  const latestStateRef = useRef<KitConfiguration>(initialConfig);
  // snapshotRef holds the latest server-confirmed state (for resetToSnapshot)
  const snapshotRef = useRef<KitConfiguration>(initialConfig);
  // mutationQueueRef serializes all optimistic executions into a strict FIFO promise chain
  const mutationQueueRef = useRef<Promise<void>>(Promise.resolve());
  // pendingCountRef tracks in-flight queued operations to prevent isSaving flicker
  const pendingCountRef = useRef<number>(0);

  const [isSaving, setIsSaving] = useState(false);
  const [activeError, setActiveError] = useState<string | null>(null);

  const totals = useMemo(() => selectDerivedTotals(state), [state]);

  const defaultApiCall = useCallback(
    async (mutation: KitMutationPayload, clientRevision: number) => {
      const response = await fetch('/api/kit-studio/configuration', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kitId: latestStateRef.current.kitId,
          clientRevision,
          mutation,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Erreur serveur (${response.status})`);
      }

      return response.json();
    },
    []
  );

  const executeOptimisticMutation = useCallback(
    (mutation: KitMutationPayload, action: KitAction): Promise<void> => {
      // 1. Validation locale Zod synchrone immédiate (échoue avant la mise en file)
      const parseResult = kitMutationPayloadSchema.safeParse(mutation);
      if (!parseResult.success) {
        const msg = parseResult.error.issues[0]?.message || 'Validation locale échouée';
        setActiveError(msg);
        return Promise.reject(new Error(msg));
      }

      pendingCountRef.current += 1;
      setIsSaving(true);

      const runMutationTask = async () => {
        // 2. Capture de l'état préalable exact pour CETTE mutation
        const priorState = latestStateRef.current;
        setActiveError(null);

        // 3. Calcul synchrone de l'état optimiste via le réducteur pur
        const optimisticState = kitConfigurationReducer(priorState, action);

        // Détermination de la révision cible monotone
        const targetRevision =
          optimisticState.revision > priorState.revision
            ? optimisticState.revision
            : priorState.revision + 1;

        const finalOptimisticState: KitConfiguration =
          optimisticState.revision === targetRevision
            ? optimisticState
            : { ...optimisticState, revision: targetRevision };

        // Mise à jour immédiate de la référence synchrone et notification React
        latestStateRef.current = finalOptimisticState;
        dispatch(action);

        try {
          const caller = apiClient || defaultApiCall;
          const result = await caller(mutation, targetRevision);

          let confirmedState = finalOptimisticState;
          if (result && typeof result.revision === 'number') {
            if (result.revision > targetRevision) {
              confirmedState = {
                ...finalOptimisticState,
                revision: result.revision,
              };
              dispatch({
                type: 'state/reconcile',
                payload: { serverState: confirmedState },
              });
            }
          }

          // Avancement de l'état confirmé et du snapshot
          latestStateRef.current = confirmedState;
          snapshotRef.current = confirmedState;

          if (onSaveSuccess) {
            onSaveSuccess(confirmedState);
          }
        } catch (err: any) {
          // 4. Échec isolé : rollback UNIQUEMENT vers priorState (isole les mutations précédentes)
          latestStateRef.current = priorState;
          dispatch({
            type: 'state/reset',
            payload: { initialState: priorState },
          });

          const errorMsg = err?.message || 'Échec de l’enregistrement';
          setActiveError(errorMsg);

          if (onSaveError) {
            onSaveError(err instanceof Error ? err : new Error(errorMsg), priorState);
          }

          // Propagation de l'erreur à l'appelant individuel
          throw err instanceof Error ? err : new Error(errorMsg);
        } finally {
          pendingCountRef.current = Math.max(0, pendingCountRef.current - 1);
          if (pendingCountRef.current === 0) {
            setIsSaving(false);
          }
        }
      };

      // Chaînage séquentiel dans la file de promesses
      const taskPromise = mutationQueueRef.current.then(runMutationTask);

      // Maintien de la file vivante même en cas de rejet d'une tâche précédente
      mutationQueueRef.current = taskPromise.catch(() => {});

      return taskPromise;
    },
    [apiClient, defaultApiCall, onSaveSuccess, onSaveError]
  );

  const moveItem = useCallback(
    async (itemId: string, targetSlotId: SlotId | null, slotOrder: number | null = null) => {
      const mutation: KitMutationPayload = {
        type: 'item/move',
        payload: { itemId, targetSlotId, slotOrder },
      };
      const action: KitAction = {
        type: 'item/move',
        payload: { itemId, targetSlotId, slotOrder },
      };
      await executeOptimisticMutation(mutation, action);
    },
    [executeOptimisticMutation]
  );

  const toggleItemChecked = useCallback(
    async (itemId: string, isChecked: boolean) => {
      const mutation: KitMutationPayload = {
        type: 'item/check',
        payload: { itemId, isChecked },
      };
      const action: KitAction = {
        type: 'item/check',
        payload: { itemId, isChecked },
      };
      await executeOptimisticMutation(mutation, action);
    },
    [executeOptimisticMutation]
  );

  const updateItemQuantity = useCallback(
    async (itemId: string, quantity: number) => {
      const mutation: KitMutationPayload = {
        type: 'item/updateQuantity',
        payload: { itemId, quantity },
      };
      const action: KitAction = {
        type: 'item/updateQuantity',
        payload: { itemId, quantity },
      };
      await executeOptimisticMutation(mutation, action);
    },
    [executeOptimisticMutation]
  );

  const addItem = useCallback(
    async (item: Omit<KitItem, 'slotOrder'>, slotId: SlotId | null = null) => {
      const mutation: KitMutationPayload = {
        type: 'item/add',
        payload: {
          item: {
            ...item,
            productOwnershipId: item.productOwnershipId ?? null,
            category: item.category ?? null,
            weightG: item.weightG ?? null,
            weightSource: item.weightSource ?? 'unknown',
            isChecked: Boolean(item.isChecked),
            slotId: item.slotId ?? null,
            visual: item.visual ?? null,
          },
          slotId,
        },
      };
      const action: KitAction = {
        type: 'item/add',
        payload: { item, slotId },
      };
      await executeOptimisticMutation(mutation, action);
    },
    [executeOptimisticMutation]
  );

  const removeItem = useCallback(
    async (itemId: string) => {
      const mutation: KitMutationPayload = {
        type: 'item/remove',
        payload: { itemId },
      };
      const action: KitAction = {
        type: 'item/remove',
        payload: { itemId },
      };
      await executeOptimisticMutation(mutation, action);
    },
    [executeOptimisticMutation]
  );

  const customizePart = useCallback(
    async (partId: PartId, config: Partial<PartConfig>) => {
      const mutation: KitMutationPayload = {
        type: 'part/customize',
        payload: { partId, config },
      };
      const action: KitAction = {
        type: 'part/customize',
        payload: { partId, config },
      };
      await executeOptimisticMutation(mutation, action);
    },
    [executeOptimisticMutation]
  );

  const selectBagModel = useCallback(
    async (
      modelId: string | null,
      capabilities: BagCapabilities = DEFAULT_BAG_CAPABILITIES,
      declaredCapacityL: number | null = null,
      availableSlots: SlotState[] = []
    ) => {
      const mutation: KitMutationPayload = {
        type: 'bag/select',
        payload: {
          modelId,
          capabilities,
          declaredCapacityL,
          availableSlots,
        },
      };
      const action: KitAction = {
        type: 'bag/select',
        payload: {
          modelId,
          capabilities,
          declaredCapacityL,
          availableSlots,
        },
      };
      await executeOptimisticMutation(mutation, action);
    },
    [executeOptimisticMutation]
  );

  const placeBadge = useCallback(
    async (badgeId: string, anchorId: AnchorId, scale = 1.0) => {
      const mutation: KitMutationPayload = {
        type: 'badge/place',
        payload: { badgeId, anchorId, scale },
      };
      const action: KitAction = {
        type: 'badge/place',
        payload: { badgeId, anchorId, scale },
      };
      await executeOptimisticMutation(mutation, action);
    },
    [executeOptimisticMutation]
  );

  const removeBadge = useCallback(
    async (placedBadgeId: string) => {
      const mutation: KitMutationPayload = {
        type: 'badge/remove',
        payload: { placedBadgeId },
      };
      const action: KitAction = {
        type: 'badge/remove',
        payload: { placedBadgeId },
      };
      await executeOptimisticMutation(mutation, action);
    },
    [executeOptimisticMutation]
  );

  const resetToSnapshot = useCallback(() => {
    latestStateRef.current = snapshotRef.current;
    dispatch({
      type: 'state/reset',
      payload: { initialState: snapshotRef.current },
    });
  }, []);

  return {
    state,
    totals,
    isSaving,
    activeError,
    moveItem,
    toggleItemChecked,
    updateItemQuantity,
    addItem,
    removeItem,
    customizePart,
    selectBagModel,
    placeBadge,
    removeBadge,
    resetToSnapshot,
  };
}
