import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  createInitialKitConfiguration,
  DEFAULT_BAG_CAPABILITIES,
  kitConfigurationReducer,
} from '../state/kitConfiguration';
import {
  formatWeight,
  formatWeightSummary,
  selectDerivedTotals,
} from '../state/selectors';
import type { KitConfiguration, KitItem, SlotState } from '../state/types';

describe('Purity verification (L1-1)', () => {
  it('kitConfiguration.ts has ZERO imports from react, react-dom, or three', () => {
    const filePath = path.resolve(__dirname, '../state/kitConfiguration.ts');
    const content = fs.readFileSync(filePath, 'utf8');

    expect(content).not.toMatch(/from\s+['"]react['"]/);
    expect(content).not.toMatch(/from\s+['"]react-dom['"]/);
    expect(content).not.toMatch(/from\s+['"]three['"]/);
  });

  it('selectors.ts has ZERO imports from react, react-dom, or three', () => {
    const filePath = path.resolve(__dirname, '../state/selectors.ts');
    const content = fs.readFileSync(filePath, 'utf8');

    expect(content).not.toMatch(/from\s+['"]react['"]/);
    expect(content).not.toMatch(/from\s+['"]react-dom['"]/);
    expect(content).not.toMatch(/from\s+['"]three['"]/);
  });
});

describe('kitConfigurationReducer', () => {
  const initialConfig = createInitialKitConfiguration('kit-123', {
    slots: {
      'interior-bottom': {
        id: 'interior-bottom',
        kind: 'interior',
        capacityL: 30,
        maxItems: null,
        itemIds: [],
      },
      'interior-top': {
        id: 'interior-top',
        kind: 'interior',
        capacityL: 20,
        maxItems: null,
        itemIds: [],
      },
    },
  });

  const sampleItem: Omit<KitItem, 'slotOrder'> = {
    id: 'item-1',
    productOwnershipId: null,
    name: 'Duvet duvet',
    category: 'dormir',
    quantity: 1,
    weightG: 850,
    weightSource: 'catalog',
    isChecked: false,
    slotId: null,
    visual: null,
  };

  it('génère un état initial avec révision = 1 et sac par défaut', () => {
    const config = createInitialKitConfiguration('kit-test');
    expect(config.kitId).toBe('kit-test');
    expect(config.revision).toBe(1);
    expect(config.bag.modelId).toBeNull();
    expect(config.items).toHaveLength(0);
  });

  it('ajoute un nouvel article et incrémente la révision', () => {
    const next = kitConfigurationReducer(initialConfig, {
      type: 'item/add',
      payload: { item: sampleItem, slotId: 'interior-bottom' },
    });

    expect(next.revision).toBe(initialConfig.revision + 1);
    expect(next.items).toHaveLength(1);
    expect(next.items[0].id).toBe('item-1');
    expect(next.items[0].slotId).toBe('interior-bottom');
    expect(next.slots['interior-bottom'].itemIds).toContain('item-1');
  });

  it('incrémente la quantité si l article existe déjà', () => {
    const state1 = kitConfigurationReducer(initialConfig, {
      type: 'item/add',
      payload: { item: sampleItem },
    });

    const state2 = kitConfigurationReducer(state1, {
      type: 'item/add',
      payload: { item: { ...sampleItem, quantity: 2 } },
    });

    expect(state2.revision).toBe(state1.revision + 1);
    expect(state2.items).toHaveLength(1);
    expect(state2.items[0].quantity).toBe(3);
  });

  it('supprime un article et nettoie sa référence de slot', () => {
    const state1 = kitConfigurationReducer(initialConfig, {
      type: 'item/add',
      payload: { item: sampleItem, slotId: 'interior-bottom' },
    });

    const state2 = kitConfigurationReducer(state1, {
      type: 'item/remove',
      payload: { itemId: 'item-1' },
    });

    expect(state2.revision).toBe(state1.revision + 1);
    expect(state2.items).toHaveLength(0);
    expect(state2.slots['interior-bottom'].itemIds).not.toContain('item-1');
  });

  it('déplace un article vers un autre slot avec réordonnancement', () => {
    const state1 = kitConfigurationReducer(initialConfig, {
      type: 'item/add',
      payload: { item: sampleItem, slotId: 'interior-bottom' },
    });

    const state2 = kitConfigurationReducer(state1, {
      type: 'item/move',
      payload: { itemId: 'item-1', targetSlotId: 'interior-top', slotOrder: 0 },
    });

    expect(state2.revision).toBe(state1.revision + 1);
    expect(state2.items[0].slotId).toBe('interior-top');
    expect(state2.slots['interior-bottom'].itemIds).not.toContain('item-1');
    expect(state2.slots['interior-top'].itemIds).toEqual(['item-1']);
  });

  it('ignore un déplacement sans changement', () => {
    const state1 = kitConfigurationReducer(initialConfig, {
      type: 'item/add',
      payload: { item: sampleItem, slotId: 'interior-bottom' },
    });

    const state2 = kitConfigurationReducer(state1, {
      type: 'item/move',
      payload: { itemId: 'item-1', targetSlotId: 'interior-bottom', slotOrder: 0 },
    });

    expect(state2).toBe(state1);
  });

  it('coche et décoche un article', () => {
    const state1 = kitConfigurationReducer(initialConfig, {
      type: 'item/add',
      payload: { item: sampleItem },
    });

    const state2 = kitConfigurationReducer(state1, {
      type: 'item/check',
      payload: { itemId: 'item-1', isChecked: true },
    });

    expect(state2.items[0].isChecked).toBe(true);
    expect(state2.revision).toBe(state1.revision + 1);

    // No-op if already checked
    const state3 = kitConfigurationReducer(state2, {
      type: 'item/check',
      payload: { itemId: 'item-1', isChecked: true },
    });
    expect(state3).toBe(state2);
  });

  it('met à jour la quantité d un article', () => {
    const state1 = kitConfigurationReducer(initialConfig, {
      type: 'item/add',
      payload: { item: sampleItem },
    });

    const state2 = kitConfigurationReducer(state1, {
      type: 'item/updateQuantity',
      payload: { itemId: 'item-1', quantity: 5 },
    });

    expect(state2.items[0].quantity).toBe(5);
    expect(state2.revision).toBe(state1.revision + 1);

    // Rejette quantité < 1
    const state3 = kitConfigurationReducer(state2, {
      type: 'item/updateQuantity',
      payload: { itemId: 'item-1', quantity: 0 },
    });
    expect(state3).toBe(state2);
  });

  it('personnalise une partie du sac', () => {
    const next = kitConfigurationReducer(initialConfig, {
      type: 'part/customize',
      payload: {
        partId: 'body',
        config: { color: 'var(--lkv-primary)', material: 'cordura-500d' },
      },
    });

    expect(next.revision).toBe(initialConfig.revision + 1);
    expect(next.bag.parts.body).toEqual({
      color: 'var(--lkv-primary)',
      material: 'cordura-500d',
    });
  });

  it('sélectionne un nouveau modèle de sac et réassigne les slots', () => {
    // Équiper avec un article dans interior-bottom
    const state1 = kitConfigurationReducer(initialConfig, {
      type: 'item/add',
      payload: { item: sampleItem, slotId: 'interior-bottom' },
    });

    // Équiper avec un article dans un slot qui va disparaître
    const state2 = kitConfigurationReducer(state1, {
      type: 'item/add',
      payload: {
        item: { ...sampleItem, id: 'item-2', name: 'Gourde' },
        slotId: 'interior-top',
      },
    });

    const newSlots: SlotState[] = [
      {
        id: 'interior-bottom',
        kind: 'interior',
        capacityL: 45,
        maxItems: null,
        itemIds: [],
      },
    ];

    const state3 = kitConfigurationReducer(state2, {
      type: 'bag/select',
      payload: {
        modelId: 'trekker-70',
        capabilities: DEFAULT_BAG_CAPABILITIES,
        declaredCapacityL: 70,
        availableSlots: newSlots,
      },
    });

    expect(state3.bag.modelId).toBe('trekker-70');
    expect(state3.items.find((i) => i.id === 'item-1')?.slotId).toBe('interior-bottom');
    // item-2 a perdu son slot car interior-top n'existe plus
    expect(state3.items.find((i) => i.id === 'item-2')?.slotId).toBeNull();
  });

  it('place et retire un badge avec unicité d ancrage', () => {
    const state1 = kitConfigurationReducer(initialConfig, {
      type: 'badge/place',
      payload: { badgeId: 'badge-mont-blanc', anchorId: 'badge-body-front', scale: 1.2 },
    });

    expect(state1.placedBadges).toHaveLength(1);
    expect(state1.placedBadges[0].badgeId).toBe('badge-mont-blanc');
    expect(state1.placedBadges[0].scale).toBe(1.2);

    // Remplacement sur le même anchor
    const state2 = kitConfigurationReducer(state1, {
      type: 'badge/place',
      payload: { badgeId: 'badge-gr20', anchorId: 'badge-body-front', scale: 1.0 },
    });

    expect(state2.placedBadges).toHaveLength(1);
    expect(state2.placedBadges[0].badgeId).toBe('badge-gr20');

    // Suppression
    const state3 = kitConfigurationReducer(state2, {
      type: 'badge/remove',
      payload: { placedBadgeId: state2.placedBadges[0].id },
    });
    expect(state3.placedBadges).toHaveLength(0);
  });

  it('rejette les réconciliations serveur périmées (revision <= client)', () => {
    const staleServerState: KitConfiguration = {
      ...initialConfig,
      revision: initialConfig.revision, // même révision
      items: [sampleItem as KitItem],
    };

    const next = kitConfigurationReducer(initialConfig, {
      type: 'state/reconcile',
      payload: { serverState: staleServerState },
    });

    expect(next).toBe(initialConfig);
    expect(next.items).toHaveLength(0);
  });

  it('accepte les réconciliations serveur fraîches (revision > client)', () => {
    const freshServerState: KitConfiguration = {
      ...initialConfig,
      revision: initialConfig.revision + 5,
      items: [sampleItem as KitItem],
    };

    const next = kitConfigurationReducer(initialConfig, {
      type: 'state/reconcile',
      payload: { serverState: freshServerState },
    });

    expect(next).toBe(freshServerState);
    expect(next.items).toHaveLength(1);
  });
});

describe('selectDerivedTotals (Data Honesty)', () => {
  it('calcule correctement pour un sac vide', () => {
    const config = createInitialKitConfiguration('kit-empty');
    const totals = selectDerivedTotals(config);

    expect(totals.knownWeightG).toBe(0);
    expect(totals.unknownWeightCount).toBe(0);
    expect(totals.itemCount).toBe(0);
    expect(totals.checkedCount).toBe(0);
    expect(totals.volumeEstimateL).toBeNull();
  });

  it('ne convertit JAMAIS un poids null en 0g (C-03)', () => {
    const config = createInitialKitConfiguration('kit-null', {
      items: [
        {
          id: 'item-1',
          name: 'Tente sans étiquette',
          weightG: null, // Poids inconnu
          quantity: 2,
          category: 'abri',
          isChecked: false,
          productOwnershipId: null,
          weightSource: 'unknown',
          slotId: null,
          slotOrder: null,
          visual: null,
        },
      ],
    });

    const totals = selectDerivedTotals(config);
    expect(totals.knownWeightG).toBe(0);
    expect(totals.unknownWeightCount).toBe(2);

    const summary = formatWeightSummary(totals);
    expect(summary.primary).toBe('—');
    expect(summary.secondary).toBe('2 objets non pesés');
    expect(summary.fullLabel).toBe('— (2 non pesés)');
  });

  it('calcule les totaux mixtes avec formatage explicite', () => {
    const config = createInitialKitConfiguration('kit-mixed', {
      items: [
        {
          id: 'item-1',
          name: 'Réchaud',
          weightG: 350,
          quantity: 1,
          category: 'cuisine',
          isChecked: true,
          productOwnershipId: null,
          weightSource: 'catalog',
          slotId: null,
          slotOrder: null,
          visual: null,
        },
        {
          id: 'item-2',
          name: 'Couteau suisse',
          weightG: null,
          quantity: 1,
          category: 'outils',
          isChecked: false,
          productOwnershipId: null,
          weightSource: 'unknown',
          slotId: null,
          slotOrder: null,
          visual: null,
        },
        {
          id: 'item-3',
          name: 'Polaire',
          weightG: 1200,
          quantity: 1,
          category: 'vetements',
          isChecked: true,
          productOwnershipId: null,
          weightSource: 'catalog',
          slotId: null,
          slotOrder: null,
          visual: null,
        },
      ],
    });

    const totals = selectDerivedTotals(config);
    expect(totals.knownWeightG).toBe(1550);
    expect(totals.unknownWeightCount).toBe(1);
    expect(totals.itemCount).toBe(3);
    expect(totals.checkedCount).toBe(2);

    const summary = formatWeightSummary(totals);
    expect(summary.primary).toBe('1,6 kg');
    expect(summary.secondary).toBe('+ 1 non pesé');
    expect(summary.fullLabel).toBe('1,6 kg + 1 non pesé');
  });

  it('formate correctement les grammes sous 1000g et kilogrammes au-dessus', () => {
    expect(formatWeight(450)).toBe('450 g');
    expect(formatWeight(1000)).toBe('1,0 kg');
    expect(formatWeight(8420)).toBe('8,4 kg');
  });

  it('retourne volumeEstimateL = null si le sac n a pas de capacité déclarée', () => {
    const config = createInitialKitConfiguration('kit-no-vol');
    const totals = selectDerivedTotals(config);
    expect(totals.volumeEstimateL).toBeNull();
  });
});
