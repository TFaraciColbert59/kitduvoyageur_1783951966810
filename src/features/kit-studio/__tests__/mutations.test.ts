// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createInitialKitConfiguration } from '../state/kitConfiguration';
import { selectDerivedTotals } from '../state/selectors';
import type { KitConfiguration, KitItem, SlotState } from '../state/types';
import { useKitStudio, type KitMutationPayload } from '../state/useKitStudio';

/**
 * Générateur pseudo-aléatoire déterministe (Mulberry32)
 */
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('Optimistic Mutations & Rollback Stress Test (L1-3)', () => {
  const initialSlots: Record<string, SlotState> = {
    'interior-bottom': {
      id: 'interior-bottom',
      kind: 'interior',
      capacityL: 30,
      maxItems: null,
      itemIds: ['item-0'],
    },
    'interior-top': {
      id: 'interior-top',
      kind: 'interior',
      capacityL: 20,
      maxItems: null,
      itemIds: [],
    },
    'front-pocket': {
      id: 'front-pocket',
      kind: 'pocket',
      capacityL: 5,
      maxItems: null,
      itemIds: [],
    },
  };

  const initialItems: KitItem[] = [
    {
      id: 'item-0',
      productOwnershipId: null,
      name: 'Duvet Grand Froid',
      category: 'dormir',
      quantity: 1,
      weightG: 1200,
      weightSource: 'catalog',
      isChecked: false,
      slotId: 'interior-bottom',
      slotOrder: 0,
      visual: null,
    },
  ];

  const baseConfig: KitConfiguration = createInitialKitConfiguration('kit-stress-test', {
    revision: 10,
    slots: initialSlots,
    items: initialItems,
  });

  it('gère 50 mutations dont exactement 20 en échec avec intégrité absolue et rollback sans fuite', async () => {
    const rng = mulberry32(42);

    // Déterminer à l'avance quelles 20 itérations échouent sur les 50
    const indices = Array.from({ length: 50 }, (_, i) => i);
    // Mélange de Fisher-Yates déterministe
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    const failedIndices = new Set(indices.slice(0, 20));
    expect(failedIndices.size).toBe(20);

    let serverRevision = baseConfig.revision;
    const failureLog: number[] = [];
    const successLog: number[] = [];

    // Client mock simulant les succès et les 20 erreurs
    const mockApiClient = async (
      _mutation: KitMutationPayload,
      clientRevision: number
    ) => {
      const currentOp = failureLog.length + successLog.length;
      if (failedIndices.has(currentOp)) {
        failureLog.push(currentOp);
        throw new Error(`Simulation échec serveur sur opération ${currentOp}`);
      }

      serverRevision = clientRevision;
      successLog.push(currentOp);
      return { success: true, revision: serverRevision };
    };

    const { result } = renderHook(() =>
      useKitStudio({
        initialConfig: baseConfig,
        apiClient: mockApiClient,
      })
    );

    let priorConfirmedState = result.current.state;

    for (let i = 0; i < 50; i++) {
      const isExpectedFail = failedIndices.has(i);
      const snapshotBeforeMutation = result.current.state;

      // Choix de mutation varié basé sur i % 5
      const mutationType = i % 5;

      await act(async () => {
        try {
          if (mutationType === 0) {
            // Déplacement d'article vers un slot différent
            const curSlot = result.current.state.items.find((x) => x.id === 'item-0')?.slotId;
            const targetSlot = curSlot === 'interior-top' ? 'front-pocket' : 'interior-top';
            await result.current.moveItem('item-0', targetSlot, 0);
          } else if (mutationType === 1) {
            // Bascule garantie du check
            const curChecked = result.current.state.items.find((x) => x.id === 'item-0')?.isChecked ?? false;
            await result.current.toggleItemChecked('item-0', !curChecked);
          } else if (mutationType === 2) {
            // Personnalisation d'une partie avec nouvelle valeur
            await result.current.customizePart('body', {
              color: `color-${i}`,
              finish: 'matte',
            });
          } else if (mutationType === 3) {
            // Ajout d'article avec id unique
            await result.current.addItem(
              {
                id: `item-${i + 1}`,
                name: `Article ${i + 1}`,
                category: 'divers',
                quantity: 1,
                weightG: 100 + i * 10,
                weightSource: 'declared',
                isChecked: false,
                productOwnershipId: null,
                slotId: null,
                visual: null,
              },
              null
            );
          } else {
            // Incrément garanti de la quantité
            const curQty = result.current.state.items.find((x) => x.id === 'item-0')?.quantity ?? 1;
            await result.current.updateItemQuantity('item-0', curQty + 1);
          }
        } catch {
          // Exception absorbée ici si le hook ou le caller throw
        }
      });

      if (isExpectedFail) {
        // VÉRIFICATION CRITIQUE : En cas d'échec, l'état a été restauré EXACTEMENT
        // à l'état snapshot d'avant la mutation
        expect(result.current.state).toEqual(snapshotBeforeMutation);
        expect(result.current.activeError).toContain(`Simulation échec serveur sur opération ${i}`);
      } else {
        // En cas de succès : la révision a progressé et pas d'erreur active
        expect(result.current.state.revision).toBeGreaterThan(snapshotBeforeMutation.revision);
        expect(result.current.activeError).toBeNull();
        priorConfirmedState = result.current.state;
      }
    }

    expect(failureLog).toHaveLength(20);
    expect(successLog).toHaveLength(30);

    // VÉRIFICATION FINALE DE L'ÉTAT :
    // 1. Les totaux dérivés correspondent parfaitement au sélecteur
    const expectedTotals = selectDerivedTotals(result.current.state);
    expect(result.current.totals).toEqual(expectedTotals);

    // 2. La révision finale est exactement baseConfig.revision + 30 succès
    expect(result.current.state.revision).toBe(baseConfig.revision + 30);

    // 3. L'état actuel correspond au dernier état confirmé réussi
    expect(result.current.state).toEqual(priorConfirmedState);
  });
});
