/**
 * src/features/kit-studio/state/kitConfiguration.ts
 * Pure reducer and state machine for Kit Studio.
 *
 * STRICT INVARIANT:
 * Zero dependencies or imports on React, ReactDOM, Three.js, or any WebGL library.
 * Pure immutable TypeScript state transitions only.
 */

import type {
  BagCapabilities,
  KitAction,
  KitConfiguration,
  KitItem,
  PlacedBadge,
  SlotId,
  SlotState,
} from './types';

export const DEFAULT_BAG_CAPABILITIES: BagCapabilities = {
  rotatable: true,
  openable: true,
  hasInterior: true,
  customizableParts: ['body', 'lid', 'front-pocket', 'side-pocket-l', 'side-pocket-r', 'shoulder-strap-l', 'shoulder-strap-r', 'hip-belt'],
  badgeAnchors: ['badge-body-front', 'badge-lid', 'badge-front-pocket'],
  attachmentPoints: ['attach-top', 'attach-bottom', 'attach-side-l', 'attach-side-r'],
};

export function createInitialKitConfiguration(
  kitId: string,
  overrides?: Partial<KitConfiguration>
): KitConfiguration {
  return {
    kitId,
    revision: 1,
    bag: {
      modelId: null, // null = mode Liste
      capabilities: DEFAULT_BAG_CAPABILITIES,
      parts: {},
      declaredCapacityL: null,
    },
    slots: {},
    items: [],
    placedBadges: [],
    ...overrides,
  };
}

/**
 * Pure reducer function for KitConfiguration.
 * Guarantees immutability and monotonic revision increments.
 */
export function kitConfigurationReducer(
  state: KitConfiguration,
  action: KitAction
): KitConfiguration {
  switch (action.type) {
    case 'item/add': {
      const { item, slotId = null } = action.payload;
      const targetSlot = slotId && state.slots[slotId] ? slotId : null;

      const existingIndex = state.items.findIndex((i) => i.id === item.id);
      const updatedSlots: Record<SlotId, SlotState> = { ...state.slots };
      let updatedItems: KitItem[];

      if (existingIndex >= 0) {
        const existingItem = state.items[existingIndex];
        const oldSlotId = existingItem.slotId;
        const addQuantity = Math.max(1, item.quantity ?? 1);
        const newQuantity = Math.max(1, existingItem.quantity + addQuantity);

        // If targetSlot is specified and differs from existing slot, move item to targetSlot
        if (targetSlot && targetSlot !== oldSlotId) {
          // Remove from previous slot
          if (oldSlotId && updatedSlots[oldSlotId]) {
            updatedSlots[oldSlotId] = {
              ...updatedSlots[oldSlotId],
              itemIds: updatedSlots[oldSlotId].itemIds.filter((id) => id !== item.id),
            };
          }

          // Add to new slot
          const curSlot = updatedSlots[targetSlot];
          if (!curSlot.itemIds.includes(item.id)) {
            updatedSlots[targetSlot] = {
              ...curSlot,
              itemIds: [...curSlot.itemIds, item.id],
            };
          }

          const newSlotOrder = updatedSlots[targetSlot].itemIds.indexOf(item.id);

          updatedItems = state.items.map((i, idx) =>
            idx === existingIndex
              ? {
                  ...i,
                  quantity: newQuantity,
                  slotId: targetSlot,
                  slotOrder: newSlotOrder >= 0 ? newSlotOrder : null,
                }
              : i
          );
        } else {
          // No slot specified or same slot: retain existing slot assignment without phantom references
          updatedItems = state.items.map((i, idx) =>
            idx === existingIndex
              ? { ...i, quantity: newQuantity }
              : i
          );
        }
      } else {
        if (targetSlot && updatedSlots[targetSlot]) {
          const curSlot = updatedSlots[targetSlot];
          if (!curSlot.itemIds.includes(item.id)) {
            updatedSlots[targetSlot] = {
              ...curSlot,
              itemIds: [...curSlot.itemIds, item.id],
            };
          }
        }

        const newItem: KitItem = {
          ...item,
          quantity: Math.max(1, item.quantity ?? 1),
          slotId: targetSlot,
          slotOrder: targetSlot && updatedSlots[targetSlot]
            ? updatedSlots[targetSlot].itemIds.indexOf(item.id)
            : null,
        };
        updatedItems = [...state.items, newItem];
      }

      return {
        ...state,
        revision: state.revision + 1,
        items: updatedItems,
        slots: updatedSlots,
      };
    }

    case 'item/remove': {
      const { itemId } = action.payload;
      const targetItem = state.items.find((i) => i.id === itemId);
      if (!targetItem) return state;

      const updatedItems = state.items.filter((i) => i.id !== itemId);
      const updatedSlots: Record<SlotId, SlotState> = { ...state.slots };

      if (targetItem.slotId && updatedSlots[targetItem.slotId]) {
        const slot = updatedSlots[targetItem.slotId];
        updatedSlots[targetItem.slotId] = {
          ...slot,
          itemIds: slot.itemIds.filter((id) => id !== itemId),
        };
      }

      return {
        ...state,
        revision: state.revision + 1,
        items: updatedItems,
        slots: updatedSlots,
      };
    }

    case 'item/move': {
      const { itemId, targetSlotId, slotOrder = null } = action.payload;
      const item = state.items.find((i) => i.id === itemId);
      if (!item) return state;

      const oldSlotId = item.slotId;
      const validTarget = targetSlotId && state.slots[targetSlotId] ? targetSlotId : null;

      if (oldSlotId === validTarget && item.slotOrder === slotOrder) {
        return state;
      }

      const updatedSlots: Record<SlotId, SlotState> = { ...state.slots };

      // Remove from old slot
      if (oldSlotId && updatedSlots[oldSlotId]) {
        updatedSlots[oldSlotId] = {
          ...updatedSlots[oldSlotId],
          itemIds: updatedSlots[oldSlotId].itemIds.filter((id) => id !== itemId),
        };
      }

      // Add to new slot
      if (validTarget && updatedSlots[validTarget]) {
        const targetIds = updatedSlots[validTarget].itemIds.filter((id) => id !== itemId);
        if (slotOrder !== null && slotOrder >= 0 && slotOrder <= targetIds.length) {
          targetIds.splice(slotOrder, 0, itemId);
        } else {
          targetIds.push(itemId);
        }
        updatedSlots[validTarget] = {
          ...updatedSlots[validTarget],
          itemIds: targetIds,
        };
      }

      const updatedItems = state.items.map((i) =>
        i.id === itemId ? { ...i, slotId: validTarget, slotOrder } : i
      );

      return {
        ...state,
        revision: state.revision + 1,
        items: updatedItems,
        slots: updatedSlots,
      };
    }

    case 'item/check': {
      const { itemId, isChecked } = action.payload;
      const item = state.items.find((i) => i.id === itemId);
      if (!item || item.isChecked === isChecked) return state;

      return {
        ...state,
        revision: state.revision + 1,
        items: state.items.map((i) =>
          i.id === itemId ? { ...i, isChecked } : i
        ),
      };
    }

    case 'item/updateQuantity': {
      const { itemId, quantity } = action.payload;
      if (quantity < 1) return state;
      const item = state.items.find((i) => i.id === itemId);
      if (!item || item.quantity === quantity) return state;

      return {
        ...state,
        revision: state.revision + 1,
        items: state.items.map((i) =>
          i.id === itemId ? { ...i, quantity } : i
        ),
      };
    }

    case 'part/customize': {
      const { partId, config } = action.payload;
      const currentPart = state.bag.parts[partId] ?? {};
      return {
        ...state,
        revision: state.revision + 1,
        bag: {
          ...state.bag,
          parts: {
            ...state.bag.parts,
            [partId]: { ...currentPart, ...config },
          },
        },
      };
    }

    case 'bag/select': {
      const { modelId, capabilities, declaredCapacityL, availableSlots } = action.payload;
      const newSlotsMap: Record<SlotId, SlotState> = {};
      availableSlots.forEach((s) => {
        newSlotsMap[s.id] = { ...s, itemIds: [] };
      });

      // Re-assign items if their slot still exists; otherwise set slotId = null
      const updatedItems = state.items.map((item) => {
        if (item.slotId && newSlotsMap[item.slotId]) {
          newSlotsMap[item.slotId].itemIds.push(item.id);
          return item;
        }
        return { ...item, slotId: null, slotOrder: null };
      });

      // Filter placed badges to anchors supported by new bag capabilities
      const validAnchors = new Set(capabilities.badgeAnchors);
      const updatedBadges = state.placedBadges.filter((b) => validAnchors.has(b.anchorId));

      return {
        ...state,
        revision: state.revision + 1,
        bag: {
          modelId,
          capabilities,
          parts: {}, // Reset custom parts to new model defaults
          declaredCapacityL,
        },
        slots: newSlotsMap,
        items: updatedItems,
        placedBadges: updatedBadges,
      };
    }

    case 'badge/place': {
      const { badgeId, anchorId, scale = 1.0 } = action.payload;
      // Anchor uniqueness: one badge per anchor
      const filteredBadges = state.placedBadges.filter((b) => b.anchorId !== anchorId);
      const newBadge: PlacedBadge = {
        id: crypto.randomUUID ? crypto.randomUUID() : `badge-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        badgeId,
        anchorId,
        scale: Math.max(0.5, Math.min(3.0, scale)),
      };

      return {
        ...state,
        revision: state.revision + 1,
        placedBadges: [...filteredBadges, newBadge],
      };
    }

    case 'badge/remove': {
      const { placedBadgeId } = action.payload;
      return {
        ...state,
        revision: state.revision + 1,
        placedBadges: state.placedBadges.filter((b) => b.id !== placedBadgeId),
      };
    }

    case 'state/reconcile': {
      const { serverState } = action.payload;
      // Monotonic revision rule: stale responses (revision <= state.revision) are dropped
      if (serverState.revision <= state.revision) {
        return state;
      }
      return serverState;
    }

    case 'state/reset': {
      return action.payload.initialState;
    }

    default:
      return state;
  }
}
