// @vitest-environment jsdom
/**
 * tests/adversarial/lot-l1-adversarial.spec.ts
 *
 * EMPIRICAL ADVERSARIAL STRESS TEST SUITE: LOT L1
 * (Pure State Container, Selectors, Optimistic Mutations, Monotonic Revisions)
 *
 * Focus:
 * 1. Rapid concurrent / sequential mutation dispatches to kitConfigurationReducer.
 * 2. Stale revision rejection: action/serverState.revision <= state.revision & API 409 conflict.
 * 3. Slot integrity: item move/remove unlinking, bag model switch slot re-evaluation without dropping items.
 * 4. Derived totals calculation under extreme loads (1000 items with arbitrary known/null weights, zero-leak check).
 * 5. Mutation snapshot rollback: failure reversion, snapshot integrity, and memory stability.
 */

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createInitialKitConfiguration,
  DEFAULT_BAG_CAPABILITIES,
  kitConfigurationReducer,
} from '@/features/kit-studio/state/kitConfiguration';
import {
  formatWeight,
  formatWeightSummary,
  selectDerivedTotals,
} from '@/features/kit-studio/state/selectors';
import type {
  BagCapabilities,
  KitAction,
  KitConfiguration,
  KitItem,
  PlacedBadge,
  SlotState,
} from '@/features/kit-studio/state/types';
import {
  useKitStudio,
  type KitMutationPayload,
} from '@/features/kit-studio/state/useKitStudio';
import { PATCH } from '@/app/api/kit-studio/configuration/route';
import { NextRequest } from 'next/server';

/**
 * Deep freeze helper to guarantee absolute immutability.
 * If any reducer or selector mutates an object in place, strict mode throws TypeError.
 */
function deepFreeze<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') return obj;
  Object.freeze(obj);
  for (const key of Object.keys(obj)) {
    const val = (obj as any)[key];
    if (val !== null && typeof val === 'object' && !Object.isFrozen(val)) {
      deepFreeze(val);
    }
  }
  return obj;
}

/**
 * Deterministic pseudo-random number generator (Mulberry32)
 */
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('Adversarial Lot L1 — 1. Rapid Mutation Dispatches & Immutability', () => {
  it('processes 10,000 rapid sequential mutations with ZERO in-place mutation (deep-frozen state)', () => {
    const rng = mulberry32(1337);
    let state = createInitialKitConfiguration('kit-stress-10k', {
      slots: {
        'slot-a': { id: 'slot-a', kind: 'interior', capacityL: 25, maxItems: null, itemIds: [] },
        'slot-b': { id: 'slot-b', kind: 'interior', capacityL: 15, maxItems: null, itemIds: [] },
        'slot-c': { id: 'slot-c', kind: 'pocket', capacityL: 5, maxItems: null, itemIds: [] },
      },
    });

    const slotNames = ['slot-a', 'slot-b', 'slot-c'];
    const startTime = performance.now();

    for (let i = 0; i < 10000; i++) {
      // Freeze the state before each mutation to guarantee that reducer never mutates in-place
      deepFreeze(state);

      const op = i % 8;
      let action: KitAction;

      switch (op) {
        case 0: // item/add
          action = {
            type: 'item/add',
            payload: {
              item: {
                id: `item-${i % 200}`,
                productOwnershipId: null,
                name: `Gear ${i}`,
                category: 'matériel',
                quantity: 1,
                weightG: Math.floor(rng() * 1000),
                weightSource: 'catalog',
                isChecked: false,
                slotId: null,
                visual: null,
              },
              slotId: slotNames[Math.floor(rng() * 3)],
            },
          };
          break;

        case 1: // item/check
          action = {
            type: 'item/check',
            payload: {
              itemId: `item-${Math.floor(rng() * 200)}`,
              isChecked: rng() > 0.5,
            },
          };
          break;

        case 2: // item/move
          action = {
            type: 'item/move',
            payload: {
              itemId: `item-${Math.floor(rng() * 200)}`,
              targetSlotId: rng() > 0.2 ? slotNames[Math.floor(rng() * 3)] : null,
              slotOrder: Math.floor(rng() * 5),
            },
          };
          break;

        case 3: // item/updateQuantity
          action = {
            type: 'item/updateQuantity',
            payload: {
              itemId: `item-${Math.floor(rng() * 200)}`,
              quantity: Math.floor(rng() * 5) + 1,
            },
          };
          break;

        case 4: // part/customize
          action = {
            type: 'part/customize',
            payload: {
              partId: 'body',
              config: { color: `var(--lkv-accent-${i % 5})`, finish: 'matte' },
            },
          };
          break;

        case 5: // badge/place
          action = {
            type: 'badge/place',
            payload: {
              badgeId: `badge-${i % 10}`,
              anchorId: 'badge-body-front',
              scale: 1.0 + (i % 5) * 0.2,
            },
          };
          break;

        case 6: // badge/remove
          action = {
            type: 'badge/remove',
            payload: {
              placedBadgeId: state.placedBadges[0]?.id ?? 'non-existent',
            },
          };
          break;

        case 7: // item/remove
        default:
          action = {
            type: 'item/remove',
            payload: {
              itemId: `item-${Math.floor(rng() * 200)}`,
            },
          };
          break;
      }

      const nextState = kitConfigurationReducer(state, action);
      expect(nextState).toBeDefined();

      // If state actually changed, revision must have incremented
      if (nextState !== state) {
        expect(nextState.revision).toBe(state.revision + 1);
      }

      state = nextState;
    }

    const elapsed = performance.now() - startTime;
    // 10,000 mutations through frozen state should execute in < 2000ms
    expect(elapsed).toBeLessThan(2000);
    expect(state.revision).toBeGreaterThan(5000);
  });

  it('preserves exact object identity (no-op) when redundant mutations are dispatched', () => {
    const initial = createInitialKitConfiguration('kit-noop', {
      slots: {
        'slot-a': { id: 'slot-a', kind: 'interior', capacityL: 20, maxItems: null, itemIds: ['item-1'] },
      },
      items: [
        {
          id: 'item-1',
          name: 'Veste Hardshell',
          category: 'vetements',
          quantity: 2,
          weightG: 450,
          weightSource: 'catalog',
          isChecked: true,
          productOwnershipId: null,
          slotId: 'slot-a',
          slotOrder: 0,
          visual: null,
        },
      ],
    });

    deepFreeze(initial);

    // 1. Check with same isChecked value -> NO-OP
    const s1 = kitConfigurationReducer(initial, {
      type: 'item/check',
      payload: { itemId: 'item-1', isChecked: true },
    });
    expect(s1).toBe(initial);

    // 2. Move to same slot and order -> NO-OP
    const s2 = kitConfigurationReducer(initial, {
      type: 'item/move',
      payload: { itemId: 'item-1', targetSlotId: 'slot-a', slotOrder: 0 },
    });
    expect(s2).toBe(initial);

    // 3. Update quantity to same quantity -> NO-OP
    const s3 = kitConfigurationReducer(initial, {
      type: 'item/updateQuantity',
      payload: { itemId: 'item-1', quantity: 2 },
    });
    expect(s3).toBe(initial);

    // 4. Update quantity to invalid quantity (< 1) -> NO-OP
    const s4 = kitConfigurationReducer(initial, {
      type: 'item/updateQuantity',
      payload: { itemId: 'item-1', quantity: 0 },
    });
    expect(s4).toBe(initial);

    // 5. Remove non-existent item -> NO-OP
    const s5 = kitConfigurationReducer(initial, {
      type: 'item/remove',
      payload: { itemId: 'non-existent-item' },
    });
    expect(s5).toBe(initial);
  });
});

describe('Adversarial Lot L1 — 2. Stale Revision Rejection & Monotonicity', () => {
  it('rejects stale server reconciliation when serverState.revision <= state.revision', () => {
    const clientState = createInitialKitConfiguration('kit-rev', {
      revision: 42,
      items: [
        {
          id: 'item-client',
          name: 'Client Item',
          category: 'divers',
          quantity: 1,
          weightG: 100,
          weightSource: 'declared',
          isChecked: true,
          productOwnershipId: null,
          slotId: null,
          slotOrder: null,
          visual: null,
        },
      ],
    });

    deepFreeze(clientState);

    // Case 1: server revision strictly less than client revision (41 < 42)
    const staleOlderServerState: KitConfiguration = {
      ...clientState,
      revision: 41,
      items: [],
    };
    const r1 = kitConfigurationReducer(clientState, {
      type: 'state/reconcile',
      payload: { serverState: staleOlderServerState },
    });
    expect(r1).toBe(clientState);
    expect(r1.items).toHaveLength(1);

    // Case 2: server revision equal to client revision (42 === 42)
    const staleEqualServerState: KitConfiguration = {
      ...clientState,
      revision: 42,
      items: [],
    };
    const r2 = kitConfigurationReducer(clientState, {
      type: 'state/reconcile',
      payload: { serverState: staleEqualServerState },
    });
    expect(r2).toBe(clientState);
    expect(r2.items).toHaveLength(1);

    // Case 3: server revision strictly greater (43 > 42) -> ACCEPTED
    const freshServerState: KitConfiguration = {
      ...clientState,
      revision: 43,
      items: [],
    };
    const r3 = kitConfigurationReducer(clientState, {
      type: 'state/reconcile',
      payload: { serverState: freshServerState },
    });
    expect(r3).toBe(freshServerState);
    expect(r3.items).toHaveLength(0);
  });

  it('withstands a storm of out-of-order server reconciliation packets', () => {
    const rng = mulberry32(777);
    let state = createInitialKitConfiguration('kit-storm', { revision: 10 });

    // Generate 100 packets with revisions ranging between 1 and 50 in random order
    const revisions: number[] = [];
    for (let i = 0; i < 100; i++) {
      revisions.push(Math.floor(rng() * 50) + 1);
    }

    let acceptedCount = 0;
    let rejectedCount = 0;

    for (const rev of revisions) {
      const priorRev = state.revision;
      const packet: KitConfiguration = {
        ...state,
        revision: rev,
      };

      state = kitConfigurationReducer(state, {
        type: 'state/reconcile',
        payload: { serverState: packet },
      });

      if (rev > priorRev) {
        expect(state.revision).toBe(rev);
        acceptedCount++;
      } else {
        expect(state.revision).toBe(priorRev);
        rejectedCount++;
      }
    }

    expect(acceptedCount + rejectedCount).toBe(100);
    expect(state.revision).toBe(Math.max(10, ...revisions));
  });
});

// Mock Supabase & feature flags for PATCH route testing
const mockSupabase = {
  auth: {
    getUser: vi.fn(),
  },
  from: vi.fn(),
};

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => mockSupabase,
}));

let mockFeatureFlagValue = true;
vi.mock('@/features/hub/server/featureFlags', () => ({
  currentFeatureFlags: async () => ({
    hub_camp_v1: mockFeatureFlagValue,
  }),
}));

describe('Adversarial Lot L1 — 2b. API Route Revision Monotonicity (409 Conflict)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFeatureFlagValue = true;
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'usr-123' } },
    });
  });

  it('rejects clientRevision <= serverRevision with 409 Conflict', async () => {
    const validKitId = 'a0000000-0000-4000-8000-000000000001';

    // Mock DB kit at revision 5
    mockSupabase.from.mockReturnValue({
      select: () => ({
        eq: () => ({
          eq: () => ({
            single: async () => ({
              data: {
                id: validKitId,
                user_id: 'usr-123',
                studio_revision: 5,
                custom_parts: {},
                bag_parts: {},
                bag_model: 'trekker-50',
                bag_model_id: 'trekker-50',
              },
              error: null,
            }),
          }),
        }),
      }),
    });

    // 1. Submit clientRevision 5 (equal)
    const reqEqual = new NextRequest('http://localhost/api/kit-studio/configuration', {
      method: 'PATCH',
      body: JSON.stringify({
        kitId: validKitId,
        clientRevision: 5,
        mutation: {
          type: 'item/check',
          payload: { itemId: 'item-1', isChecked: true },
        },
      }),
    });

    const resEqual = await PATCH(reqEqual);
    expect(resEqual.status).toBe(409);
    const bodyEqual = await resEqual.json();
    expect(bodyEqual.error).toContain('Conflit de révision concurrente');
    expect(bodyEqual.serverRevision).toBe(5);

    // 2. Submit clientRevision 4 (stale)
    const reqStale = new NextRequest('http://localhost/api/kit-studio/configuration', {
      method: 'PATCH',
      body: JSON.stringify({
        kitId: validKitId,
        clientRevision: 4,
        mutation: {
          type: 'item/check',
          payload: { itemId: 'item-1', isChecked: true },
        },
      }),
    });

    const resStale = await PATCH(reqStale);
    expect(resStale.status).toBe(409);
  });

  it('enforces feature flag hub_camp_v1: returns 403 if disabled', async () => {
    mockFeatureFlagValue = false;
    const validKitId = 'a0000000-0000-4000-8000-000000000001';

    const req = new NextRequest('http://localhost/api/kit-studio/configuration', {
      method: 'PATCH',
      body: JSON.stringify({
        kitId: validKitId,
        clientRevision: 10,
        mutation: {
          type: 'item/check',
          payload: { itemId: 'item-1', isChecked: true },
        },
      }),
    });

    const res = await PATCH(req);
    expect(res.status).toBe(403);
  });

  it('enforces authentication: returns 401 if unauthenticated', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null } });
    const validKitId = 'a0000000-0000-4000-8000-000000000001';

    const req = new NextRequest('http://localhost/api/kit-studio/configuration', {
      method: 'PATCH',
      body: JSON.stringify({
        kitId: validKitId,
        clientRevision: 10,
        mutation: {
          type: 'item/check',
          payload: { itemId: 'item-1', isChecked: true },
        },
      }),
    });

    const res = await PATCH(req);
    expect(res.status).toBe(401);
  });
});

describe('Adversarial Lot L1 — 3. Slot Integrity, Bag Switches & Item Unlinking', () => {
  it('correctly unlinks slot associations when an item is moved to null or another slot', () => {
    const config = createInitialKitConfiguration('kit-slots', {
      slots: {
        'slot-1': { id: 'slot-1', kind: 'interior', capacityL: 20, maxItems: null, itemIds: ['item-a', 'item-b'] },
        'slot-2': { id: 'slot-2', kind: 'pocket', capacityL: 5, maxItems: null, itemIds: ['item-c'] },
      },
      items: [
        { id: 'item-a', name: 'A', category: 'matériel', quantity: 1, weightG: 100, weightSource: 'catalog', isChecked: false, productOwnershipId: null, slotId: 'slot-1', slotOrder: 0, visual: null },
        { id: 'item-b', name: 'B', category: 'matériel', quantity: 1, weightG: 200, weightSource: 'catalog', isChecked: false, productOwnershipId: null, slotId: 'slot-1', slotOrder: 1, visual: null },
        { id: 'item-c', name: 'C', category: 'matériel', quantity: 1, weightG: 300, weightSource: 'catalog', isChecked: false, productOwnershipId: null, slotId: 'slot-2', slotOrder: 0, visual: null },
      ],
    });

    deepFreeze(config);

    // 1. Move item-a to slot-2
    const movedToSlot2 = kitConfigurationReducer(config, {
      type: 'item/move',
      payload: { itemId: 'item-a', targetSlotId: 'slot-2', slotOrder: 0 },
    });

    expect(movedToSlot2.slots['slot-1'].itemIds).toEqual(['item-b']);
    expect(movedToSlot2.slots['slot-2'].itemIds).toEqual(['item-a', 'item-c']);
    expect(movedToSlot2.items.find((i) => i.id === 'item-a')?.slotId).toBe('slot-2');

    // 2. Move item-b to null (unslotted)
    const unslotted = kitConfigurationReducer(movedToSlot2, {
      type: 'item/move',
      payload: { itemId: 'item-b', targetSlotId: null },
    });

    expect(unslotted.slots['slot-1'].itemIds).toEqual([]);
    expect(unslotted.items.find((i) => i.id === 'item-b')?.slotId).toBeNull();
  });

  it('unlinks slot association upon item removal', () => {
    const config = createInitialKitConfiguration('kit-rm-slot', {
      slots: {
        'pocket-front': { id: 'pocket-front', kind: 'pocket', capacityL: 3, maxItems: null, itemIds: ['lamp-1'] },
      },
      items: [
        { id: 'lamp-1', name: 'Frontale', category: 'matériel', quantity: 1, weightG: 85, weightSource: 'catalog', isChecked: false, productOwnershipId: null, slotId: 'pocket-front', slotOrder: 0, visual: null },
      ],
    });

    const next = kitConfigurationReducer(config, {
      type: 'item/remove',
      payload: { itemId: 'lamp-1' },
    });

    expect(next.items).toHaveLength(0);
    expect(next.slots['pocket-front'].itemIds).toEqual([]);
  });

  it('switching bag models re-evaluates slots and sets discontinued slots to null WITHOUT dropping items', () => {
    // 50 items distributed across 3 slots: slot-old-1, slot-old-2, and unslotted
    const items: KitItem[] = [];
    const itemIdsOld1: string[] = [];
    const itemIdsOld2: string[] = [];

    for (let i = 0; i < 50; i++) {
      let slotId: string | null = null;
      if (i < 20) {
        slotId = 'slot-old-1';
        itemIdsOld1.push(`item-${i}`);
      } else if (i < 35) {
        slotId = 'slot-old-2';
        itemIdsOld2.push(`item-${i}`);
      }
      items.push({
        id: `item-${i}`,
        name: `Item ${i}`,
        category: 'matériel',
        quantity: 1,
        weightG: 100,
        weightSource: 'catalog',
        isChecked: false,
        productOwnershipId: null,
        slotId,
        slotOrder: slotId ? i : null,
        visual: null,
      });
    }

    const config = createInitialKitConfiguration('kit-bag-switch', {
      bag: {
        modelId: 'old-model-50',
        capabilities: DEFAULT_BAG_CAPABILITIES,
        parts: { body: { color: 'green' } },
        declaredCapacityL: 50,
      },
      slots: {
        'slot-old-1': { id: 'slot-old-1', kind: 'interior', capacityL: 30, maxItems: null, itemIds: itemIdsOld1 },
        'slot-old-2': { id: 'slot-old-2', kind: 'interior', capacityL: 20, maxItems: null, itemIds: itemIdsOld2 },
      },
      items,
      placedBadges: [
        { id: 'pb-1', badgeId: 'b1', anchorId: 'badge-body-front', scale: 1.0 },
        { id: 'pb-2', badgeId: 'b2', anchorId: 'badge-lid', scale: 1.0 },
      ],
    });

    deepFreeze(config);

    // New bag model retains ONLY 'slot-old-1' and introduces 'slot-new-1'; 'slot-old-2' is discontinued.
    // Also capabilities remove 'badge-lid' anchor.
    const newCapabilities: BagCapabilities = {
      ...DEFAULT_BAG_CAPABILITIES,
      badgeAnchors: ['badge-body-front'], // badge-lid dropped
    };

    const newSlots: SlotState[] = [
      { id: 'slot-old-1', kind: 'interior', capacityL: 40, maxItems: null, itemIds: [] },
      { id: 'slot-new-1', kind: 'pocket', capacityL: 10, maxItems: null, itemIds: [] },
    ];

    const switchedState = kitConfigurationReducer(config, {
      type: 'bag/select',
      payload: {
        modelId: 'new-model-60',
        capabilities: newCapabilities,
        declaredCapacityL: 60,
        availableSlots: newSlots,
      },
    });

    // CRITICAL CHECKS:
    // 1. Total items preserved: EXACTLY 50 items (ZERO dropped items)
    expect(switchedState.items).toHaveLength(50);

    // 2. Items from slot-old-1 retained their slot
    const retainedItems = switchedState.items.filter((i) => i.slotId === 'slot-old-1');
    expect(retainedItems).toHaveLength(20);
    expect(switchedState.slots['slot-old-1'].itemIds).toEqual(itemIdsOld1);

    // 3. Items from slot-old-2 (discontinued) were set to null slotId and null slotOrder
    const discontinuedItems = switchedState.items.filter((i) => {
      const idx = parseInt(i.id.replace('item-', ''), 10);
      return idx >= 20 && idx < 35;
    });
    expect(discontinuedItems).toHaveLength(15);
    for (const item of discontinuedItems) {
      expect(item.slotId).toBeNull();
      expect(item.slotOrder).toBeNull();
    }

    // 4. Previously unslotted items remained unslotted
    const unslottedItems = switchedState.items.filter((i) => {
      const idx = parseInt(i.id.replace('item-', ''), 10);
      return idx >= 35;
    });
    expect(unslottedItems).toHaveLength(15);
    for (const item of unslottedItems) {
      expect(item.slotId).toBeNull();
    }

    // 5. Placed badges: badge on discontinued anchor 'badge-lid' was pruned, valid anchor kept
    expect(switchedState.placedBadges).toHaveLength(1);
    expect(switchedState.placedBadges[0].anchorId).toBe('badge-body-front');

    // 6. Parts were reset to empty defaults
    expect(switchedState.bag.parts).toEqual({});
  });
});

describe('Adversarial Lot L1 — 4. Derived Totals Calculation Under Extreme Loads (1000 items)', () => {
  it('calculates exact derived totals for 1,000 items with arbitrary mix of weights', () => {
    const rng = mulberry32(999);
    const items: KitItem[] = [];

    let expectedKnownWeightG = 0;
    let expectedUnknownWeightCount = 0;
    let expectedItemCount = 0;
    let expectedCheckedCount = 0;

    for (let i = 0; i < 1000; i++) {
      const qty = Math.floor(rng() * 5) + 1; // 1 to 5
      const isChecked = rng() > 0.6;
      let weightG: number | null;

      const type = i % 6;
      if (type === 0) {
        // null weight (unweighed)
        weightG = null;
        expectedUnknownWeightCount += qty;
      } else if (type === 1) {
        // undefined coerced
        weightG = undefined as any;
        expectedUnknownWeightCount += qty;
      } else if (type === 2) {
        // NaN coerced
        weightG = Number.NaN;
        expectedUnknownWeightCount += qty;
      } else if (type === 3) {
        // 0g weight (known weight of 0)
        weightG = 0;
        expectedKnownWeightG += 0;
      } else if (type === 4) {
        // negative weight (adversarial input: must be clamped to 0)
        weightG = -50;
        expectedKnownWeightG += 0;
      } else {
        // normal weight
        const val = Math.floor(rng() * 2000) + 10;
        weightG = val;
        expectedKnownWeightG += val * qty;
      }

      expectedItemCount += qty;
      if (isChecked) {
        expectedCheckedCount += qty;
      }

      items.push({
        id: `extreme-item-${i}`,
        name: `Extreme Item ${i}`,
        category: 'matériel',
        quantity: qty,
        weightG,
        weightSource: weightG === null ? 'unknown' : 'catalog',
        isChecked,
        productOwnershipId: null,
        slotId: null,
        slotOrder: null,
        visual: null,
      });
    }

    const config = createInitialKitConfiguration('kit-1000', {
      bag: {
        modelId: 'trekker-60',
        capabilities: DEFAULT_BAG_CAPABILITIES,
        parts: {},
        declaredCapacityL: 60,
      },
      slots: {
        'interior-1': { id: 'interior-1', kind: 'interior', capacityL: 35.5, maxItems: null, itemIds: [] },
        'interior-2': { id: 'interior-2', kind: 'interior', capacityL: 20.0, maxItems: null, itemIds: [] },
      },
      items,
    });

    deepFreeze(config);

    // Benchmark 10,000 selector evaluations
    const t0 = performance.now();
    let totals = selectDerivedTotals(config);
    for (let run = 0; run < 1000; run++) {
      totals = selectDerivedTotals(config);
    }
    const t1 = performance.now();

    // Accuracy assertions
    expect(totals.knownWeightG).toBe(expectedKnownWeightG);
    expect(totals.unknownWeightCount).toBe(expectedUnknownWeightCount);
    expect(totals.itemCount).toBe(expectedItemCount);
    expect(totals.checkedCount).toBe(expectedCheckedCount);
    expect(totals.volumeEstimateL).toBe(55.5);

    // Performance budget: 1,000 selector runs across 1,000 items should take < 500ms
    expect(t1 - t0).toBeLessThan(500);
  });

  it('guarantees unweighed items NEVER produce 0g or misleading weight summaries', () => {
    // Case 1: 100 items all unweighed (weightG === null)
    const itemsAllNull: KitItem[] = Array.from({ length: 100 }, (_, i) => ({
      id: `null-item-${i}`,
      name: `Objet Inconnu ${i}`,
      category: 'matériel',
      quantity: 1,
      weightG: null,
      weightSource: 'unknown',
      isChecked: false,
      productOwnershipId: null,
      slotId: null,
      slotOrder: null,
      visual: null,
    }));

    const configAllNull = createInitialKitConfiguration('kit-all-null', { items: itemsAllNull });
    const totalsAllNull = selectDerivedTotals(configAllNull);

    expect(totalsAllNull.knownWeightG).toBe(0);
    expect(totalsAllNull.unknownWeightCount).toBe(100);

    const summaryAllNull = formatWeightSummary(totalsAllNull);
    // MUST NEVER BE "0 g"
    expect(summaryAllNull.primary).toBe('—');
    expect(summaryAllNull.primary).not.toContain('0 g');
    expect(summaryAllNull.fullLabel).not.toBe('0 g');
    expect(summaryAllNull.secondary).toBe('100 objets non pesés');
    expect(summaryAllNull.fullLabel).toBe('— (100 non pesés)');

    // Case 2: Empty kit honestly produces "0 g"
    const emptyConfig = createInitialKitConfiguration('kit-zero');
    const emptyTotals = selectDerivedTotals(emptyConfig);
    const emptySummary = formatWeightSummary(emptyTotals);
    expect(emptySummary.primary).toBe('0 g');
    expect(emptySummary.secondary).toBeNull();
  });
});

describe('Adversarial Lot L1 — 5. Mutation Snapshot Rollback & Memory Leaks', () => {
  it('reverts to EXACT prior snapshot on 100 consecutive failures across diverse mutation types', async () => {
    const rng = mulberry32(54321);

    const baseConfig = createInitialKitConfiguration('kit-rollback-100', {
      revision: 100,
      slots: {
        'slot-a': { id: 'slot-a', kind: 'interior', capacityL: 20, maxItems: null, itemIds: ['base-item'] },
        'slot-b': { id: 'slot-b', kind: 'pocket', capacityL: 5, maxItems: null, itemIds: [] },
      },
      items: [
        {
          id: 'base-item',
          name: 'Base Item',
          category: 'matériel',
          quantity: 1,
          weightG: 500,
          weightSource: 'catalog',
          isChecked: false,
          productOwnershipId: null,
          slotId: 'slot-a',
          slotOrder: 0,
          visual: null,
        },
      ],
    });

    // Mock API client that ALWAYS throws an error
    let callCounter = 0;
    const failingApiClient = vi.fn(async () => {
      callCounter++;
      throw new Error(`Forced server outage #${callCounter}`);
    });

    const { result } = renderHook(() =>
      useKitStudio({
        initialConfig: baseConfig,
        apiClient: failingApiClient,
      })
    );

    const initialSnapshot = JSON.parse(JSON.stringify(result.current.state));

    for (let i = 0; i < 100; i++) {
      const stateBefore = JSON.parse(JSON.stringify(result.current.state));
      const op = i % 7;

      await act(async () => {
        try {
          if (op === 0) {
            await result.current.addItem({
              id: `item-${i}`,
              name: `New ${i}`,
              category: 'divers',
              quantity: 1,
              weightG: 100,
              weightSource: 'catalog',
              isChecked: false,
              productOwnershipId: null,
              slotId: null,
              visual: null,
            });
          } else if (op === 1) {
            await result.current.moveItem('base-item', 'slot-b', 0);
          } else if (op === 2) {
            await result.current.toggleItemChecked('base-item', true);
          } else if (op === 3) {
            await result.current.updateItemQuantity('base-item', 10);
          } else if (op === 4) {
            await result.current.customizePart('body', { color: 'red' });
          } else if (op === 5) {
            await result.current.placeBadge('badge-x', 'badge-body-front', 1.5);
          } else {
            await result.current.removeItem('base-item');
          }
        } catch {
          // Expected throw absorbed
        }
      });

      // EXACT ROLLBACK VERIFICATION:
      expect(result.current.state).toEqual(stateBefore);
      expect(result.current.activeError).toContain(`Forced server outage #${i + 1}`);
      expect(result.current.isSaving).toBe(false);
    }

    // After 100 consecutive failures, the state is still 100% identical to initialSnapshot
    expect(result.current.state).toEqual(initialSnapshot);
    expect(failingApiClient).toHaveBeenCalledTimes(100);
  });

  it('investigates snapshot integrity after successful mutation and resetToSnapshot()', async () => {
    const baseConfig = createInitialKitConfiguration('kit-snap-integrity', {
      revision: 1,
      items: [],
    });

    let currentServerRev = 1;
    const successfulApiClient = vi.fn(async (_mutation, clientRev) => {
      currentServerRev = clientRev;
      return { success: true, revision: currentServerRev };
    });

    const { result } = renderHook(() =>
      useKitStudio({
        initialConfig: baseConfig,
        apiClient: successfulApiClient,
      })
    );

    await act(async () => {
      await result.current.addItem({
        id: 'item-saved-1',
        name: 'Tente Ultralight',
        category: 'abri',
        quantity: 1,
        weightG: 950,
        weightSource: 'catalog',
        isChecked: false,
        productOwnershipId: null,
        slotId: null,
        visual: null,
      });
    });

    // Verify item was added and revision incremented
    expect(result.current.state.items).toHaveLength(1);
    expect(result.current.state.revision).toBe(2);

    // Call resetToSnapshot()
    act(() => {
      result.current.resetToSnapshot();
    });

    // Check what resetToSnapshot() does:
    // Does the snapshot retain the confirmed state with the item?
    expect(result.current.state.revision).toBe(2);
    expect(result.current.state.items).toHaveLength(1);
    expect(result.current.state.items[0].id).toBe('item-saved-1');
  });

  it('verifies slot uniqueness: re-adding existing item to another slot does not leave phantom references', () => {
    const initial = createInitialKitConfiguration('kit-phantom-test', {
      slots: {
        'slot-a': { id: 'slot-a', kind: 'interior', capacityL: 20, maxItems: null, itemIds: [] },
        'slot-b': { id: 'slot-b', kind: 'interior', capacityL: 10, maxItems: null, itemIds: [] },
      },
    });

    // 1. Add item to slot-a
    const s1 = kitConfigurationReducer(initial, {
      type: 'item/add',
      payload: {
        item: {
          id: 'item-1',
          name: 'Corde',
          category: 'escalade',
          quantity: 1,
          weightG: 1500,
          weightSource: 'catalog',
          isChecked: false,
          productOwnershipId: null,
          slotId: null,
          visual: null,
        },
        slotId: 'slot-a',
      },
    });

    expect(s1.slots['slot-a'].itemIds).toContain('item-1');
    expect(s1.items[0].slotId).toBe('slot-a');

    // 2. Add same item with slot-b
    const s2 = kitConfigurationReducer(s1, {
      type: 'item/add',
      payload: {
        item: {
          id: 'item-1',
          name: 'Corde',
          category: 'escalade',
          quantity: 1,
          weightG: 1500,
          weightSource: 'catalog',
          isChecked: false,
          productOwnershipId: null,
          slotId: null,
          visual: null,
        },
        slotId: 'slot-b',
      },
    });

    // Check whether s2 has item-1 in slot-b
    expect(s2.items[0].quantity).toBe(2);

    // Invariant check: An item should NEVER be present in multiple slots simultaneously
    const inSlotA = s2.slots['slot-a'].itemIds.includes('item-1');
    const inSlotB = s2.slots['slot-b'].itemIds.includes('item-1');
    expect(inSlotA && inSlotB).toBe(false);
  });

  it('investigates concurrent dispatches to useKitStudio', async () => {
    const baseConfig = createInitialKitConfiguration('kit-concurrent-test', {
      revision: 1,
      items: [
        {
          id: 'item-0',
          name: 'Item 0',
          category: 'matériel',
          quantity: 1,
          weightG: 100,
          weightSource: 'catalog',
          isChecked: false,
          productOwnershipId: null,
          slotId: null,
          slotOrder: null,
          visual: null,
        },
      ],
    });

    let serverRev = 1;
    const delayedApiClient = vi.fn(async (_mutation, clientRev) => {
      // Simulate small 10ms server network delay
      await new Promise((resolve) => setTimeout(resolve, 10));
      serverRev = clientRev;
      return { success: true, revision: serverRev };
    });

    const { result } = renderHook(() =>
      useKitStudio({
        initialConfig: baseConfig,
        apiClient: delayedApiClient,
      })
    );

    // Dispatch two concurrent mutations without awaiting the first one
    let errorCaught: any = null;
    await act(async () => {
      try {
        const p1 = result.current.updateItemQuantity('item-0', 2);
        const p2 = result.current.updateItemQuantity('item-0', 3);
        await Promise.all([p1, p2]);
      } catch (err) {
        errorCaught = err;
      }
    });

    // Check if concurrent mutations caused a revision collision or race condition
    // With serialization queue in place, client revisions increment strictly monotonically
    expect(delayedApiClient).toHaveBeenCalledTimes(2);
    const clientRevsSubmitted = delayedApiClient.mock.calls.map((call) => call[1]);
    expect(clientRevsSubmitted).toEqual([2, 3]);
    expect(errorCaught).toBeNull();
    expect(result.current.state.revision).toBe(3);
    expect(result.current.state.items[0].quantity).toBe(3);
  });

  it('isolates error when mutation A succeeds and concurrent mutation B fails', async () => {
    const baseConfig = createInitialKitConfiguration('kit-isolation-test', {
      revision: 1,
      items: [
        {
          id: 'item-0',
          name: 'Item 0',
          category: 'matériel',
          quantity: 1,
          weightG: 100,
          weightSource: 'catalog',
          isChecked: false,
          productOwnershipId: null,
          slotId: null,
          slotOrder: null,
          visual: null,
        },
      ],
    });

    let callCount = 0;
    const partiallyFailingApiClient = vi.fn(async (_mutation, clientRev) => {
      callCount++;
      if (callCount === 1) {
        return { success: true, revision: clientRev };
      }
      throw new Error('Mutation B server failure');
    });

    const { result } = renderHook(() =>
      useKitStudio({
        initialConfig: baseConfig,
        apiClient: partiallyFailingApiClient,
      })
    );

    let errorB: any = null;
    await act(async () => {
      const p1 = result.current.updateItemQuantity('item-0', 2);
      const p2 = result.current.updateItemQuantity('item-0', 5).catch((err) => {
        errorB = err;
      });
      await Promise.all([p1, p2]);
    });

    // Mutation A succeeded, Mutation B failed
    expect(errorB).not.toBeNull();
    expect(errorB.message).toBe('Mutation B server failure');
    // State preserves Mutation A's committed quantity (2) and revision (2)
    expect(result.current.state.revision).toBe(2);
    expect(result.current.state.items[0].quantity).toBe(2);
  });
});


