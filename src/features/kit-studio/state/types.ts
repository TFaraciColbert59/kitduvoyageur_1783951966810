/**
 * src/features/kit-studio/state/types.ts
 * Core types for Kit Studio single source of truth state container.
 * Zero dependencies on React, Three.js or DOM.
 */

export type PartId =
  | 'body'
  | 'lid'
  | 'front-pocket'
  | 'side-pocket-l'
  | 'side-pocket-r'
  | 'shoulder-strap-l'
  | 'shoulder-strap-r'
  | 'hip-belt'
  | 'compression-strap-l-1'
  | 'compression-strap-r-1'
  | 'compression-strap-l-2'
  | 'compression-strap-r-2'
  | 'lid-buckle'
  | 'interior'
  | string;

export type SlotId =
  | 'interior-bottom'
  | 'interior-top'
  | 'front-pocket'
  | 'side-pocket-l'
  | 'side-pocket-r'
  | 'lid-pocket'
  | 'attach-top'
  | 'attach-bottom'
  | 'attach-side-l'
  | 'attach-side-r'
  | string;

export type AnchorId =
  | 'badge-body-front'
  | 'badge-lid'
  | 'badge-front-pocket'
  | string;

export interface PartConfig {
  material?: string;
  color?: string; // CSS variable or token reference, e.g. 'var(--lkv-accent)'
  finish?: 'matte' | 'gloss' | 'metallic' | 'rough';
}

export interface BagCapabilities {
  rotatable: boolean;
  openable: boolean;
  hasInterior: boolean;
  customizableParts: PartId[];
  badgeAnchors: AnchorId[];
  attachmentPoints: SlotId[];
}

export interface BagState {
  modelId: string | null; // e.g. 'trekker-55', null = mode Liste
  capabilities: BagCapabilities;
  parts: Record<PartId, PartConfig>;
  declaredCapacityL: number | null;
}

export interface SlotState {
  id: SlotId;
  kind: 'interior' | 'pocket' | 'attachment';
  capacityL: number | null; // null = non modélisé
  maxItems: number | null;
  itemIds: string[]; // item IDs assigned to this slot
}

export interface ItemVisual {
  meshId?: string;
  scale?: [number, number, number];
  color?: string;
}

export interface KitItem {
  id: string; // uuid
  productOwnershipId: string | null;
  name: string;
  category: string | null;
  quantity: number;
  weightG: number | null; // null = INCONNU, JAMAIS 0 par défaut
  weightSource: 'declared' | 'catalog' | 'unknown';
  isChecked: boolean;
  slotId: SlotId | null; // null = non rangé
  slotOrder: number | null;
  visual: ItemVisual | null; // null = non représentable en 3D
}

export interface PlacedBadge {
  id: string; // uuid
  badgeId: string;
  anchorId: AnchorId;
  scale: number; // between 0.5 and 3.0, default 1.0
}

export interface KitConfiguration {
  kitId: string;
  revision: number; // strictly monotonic integer
  bag: BagState;
  slots: Record<SlotId, SlotState>;
  items: KitItem[];
  placedBadges: PlacedBadge[];
}

export interface DerivedTotals {
  knownWeightG: number;
  unknownWeightCount: number; // Number of items whose weight is unknown (weightG === null)
  itemCount: number;          // Total item units (sum of quantities)
  checkedCount: number;       // Total checked item units
  volumeEstimateL: number | null; // Estimated volume in liters, or null if unreliable
}

export type KitAction =
  | {
      type: 'item/add';
      payload: {
        item: Omit<KitItem, 'slotOrder'>;
        slotId?: SlotId | null;
      };
    }
  | {
      type: 'item/remove';
      payload: {
        itemId: string;
      };
    }
  | {
      type: 'item/move';
      payload: {
        itemId: string;
        targetSlotId: SlotId | null;
        slotOrder?: number | null;
      };
    }
  | {
      type: 'item/check';
      payload: {
        itemId: string;
        isChecked: boolean;
      };
    }
  | {
      type: 'item/updateQuantity';
      payload: {
        itemId: string;
        quantity: number;
      };
    }
  | {
      type: 'part/customize';
      payload: {
        partId: PartId;
        config: Partial<PartConfig>;
      };
    }
  | {
      type: 'bag/select';
      payload: {
        modelId: string | null;
        capabilities: BagCapabilities;
        declaredCapacityL: number | null;
        availableSlots: SlotState[];
      };
    }
  | {
      type: 'badge/place';
      payload: {
        badgeId: string;
        anchorId: AnchorId;
        scale?: number;
      };
    }
  | {
      type: 'badge/remove';
      payload: {
        placedBadgeId: string;
      };
    }
  | {
      type: 'state/reconcile';
      payload: {
        serverState: KitConfiguration;
      };
    }
  | {
      type: 'state/reset';
      payload: {
        initialState: KitConfiguration;
      };
    };
