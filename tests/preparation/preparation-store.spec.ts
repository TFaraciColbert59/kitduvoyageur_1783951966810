import { describe, it, expect, beforeEach } from 'vitest';
import { usePreparationStore } from '@/features/preparation/stores/usePreparationStore';

describe('usePreparationStore — Section 2 Préparation', () => {
  beforeEach(() => {
    // Reset store state
    usePreparationStore.setState({
      activeTab: 'gear',
      categoryFilter: 'all',
      statusFilter: 'all',
      items: [
        {
          id: 'test-1',
          name: 'Tente 2P MSR',
          weightGrams: 1720,
          category: 'shelter',
          status: 'packed',
          isPrivate: false,
          isWorn: false,
          isConsumable: false,
          isVital: false,
          quantity: 1,
        },
        {
          id: 'test-2',
          name: 'Duvet Valandré',
          weightGrams: 770,
          category: 'sleep',
          status: 'packed',
          isPrivate: false,
          isWorn: false,
          isConsumable: false,
          isVital: false,
          quantity: 1,
        },
        {
          id: 'test-3',
          name: 'Trousse de secours',
          weightGrams: 250,
          category: 'safety',
          status: 'to_buy',
          isPrivate: false,
          isWorn: false,
          isConsumable: false,
          isVital: true,
          quantity: 1,
        },
      ],
      humans: [
        {
          id: 'h1',
          type: 'human',
          publicData: {
            id: 'h1',
            firstName: 'Camille',
            bodyWeightKg: 65,
            packWeightKg: 8.5,
            fitnessScore: 88,
            role: 'guide',
          },
          privateData: {
            bloodType: 'O+',
            allergies: ['Pénicilline'],
            iceContact: {
              name: 'Lucas',
              phone: '+33 6 12 34 56 78',
              relationship: 'Conjoint',
            },
          },
          isUnlocked: false,
        },
      ],
      dogs: [
        {
          id: 'd1',
          type: 'dog',
          name: 'Taïga',
          breed: 'Berger Australien',
          weightKg: 20,
          isCarryingPack: true,
          packWeightKg: 2.4,
          maxCarryingCapacityKg: 3.0,
          waterRationLitersPerDay: 1.1,
          foodRationGramsPerDay: 560,
        },
      ],
    });
  });

  it('ajoute, met à jour et supprime un équipement', () => {
    const { addItem, updateItem, removeItem } = usePreparationStore.getState();

    addItem({
      name: 'Lampe frontale Petzl',
      weightGrams: 90,
      category: 'tech',
      status: 'packed',
      isPrivate: false,
      isWorn: false,
      isConsumable: false,
      isVital: true,
      quantity: 1,
    });

    let state = usePreparationStore.getState();
    expect(state.items.length).toBe(4);
    const added = state.items.find((i) => i.name === 'Lampe frontale Petzl');
    expect(added).toBeDefined();

    updateItem(added!.id, { weightGrams: 85 });
    state = usePreparationStore.getState();
    expect(state.items.find((i) => i.id === added!.id)?.weightGrams).toBe(85);

    removeItem(added!.id);
    state = usePreparationStore.getState();
    expect(state.items.length).toBe(3);
  });

  it('bascule le statut porté et vérifie l impact sur le Base Weight', () => {
    const { toggleItemWorn, getWeightBreakdown } = usePreparationStore.getState();

    let breakdown = getWeightBreakdown();
    const initialBase = breakdown.baseWeightGrams; // 1720 + 770 = 2490g

    toggleItemWorn('test-1'); // Passer la tente en "porté"
    breakdown = getWeightBreakdown();
    expect(breakdown.baseWeightGrams).toBe(initialBase - 1720); // 770g
    expect(breakdown.wornWeightGrams).toBe(1720);
  });

  it('gère le déverrouillage sécurisé Glass Break et le reverrouillage', () => {
    const { unlockParticipant, lockParticipant, lockAll } = usePreparationStore.getState();

    unlockParticipant('h1');
    let state = usePreparationStore.getState();
    expect(state.humans.find((h) => h.id === 'h1')?.isUnlocked).toBe(true);

    lockParticipant('h1');
    state = usePreparationStore.getState();
    expect(state.humans.find((h) => h.id === 'h1')?.isUnlocked).toBe(false);

    unlockParticipant('h1');
    lockAll();
    state = usePreparationStore.getState();
    expect(state.humans.find((h) => h.id === 'h1')?.isUnlocked).toBe(false);
  });

  it('ajoute et met à jour un compagnon canin avec recalcul automatique du portage 15%', () => {
    const { addDog, updateDog } = usePreparationStore.getState();

    addDog({
      type: 'dog',
      name: 'Rex',
      breed: 'Malinois',
      weightKg: 30,
      isCarryingPack: true,
      packWeightKg: 3.5,
    });

    let state = usePreparationStore.getState();
    const addedDog = state.dogs.find((d) => d.name === 'Rex');
    expect(addedDog).toBeDefined();
    expect(addedDog?.maxCarryingCapacityKg).toBe(4.5); // 30 * 0.15

    updateDog(addedDog!.id, { weightKg: 32 });
    state = usePreparationStore.getState();
    expect(state.dogs.find((d) => d.id === addedDog!.id)?.maxCarryingCapacityKg).toBe(4.8); // 32 * 0.15
  });

  it('génère un rapport Shakedown et des statistiques de préparation', () => {
    const { getShakedownReport, getPreparationStats } = usePreparationStore.getState();

    const report = getShakedownReport();
    expect(report.score).toBeGreaterThan(0);
    expect(report.score).toBeLessThanOrEqual(100);

    const stats = getPreparationStats();
    expect(stats.totalCount).toBe(3);
    expect(stats.packedCount).toBe(2);
    expect(stats.toBuyCount).toBe(1);
    expect(stats.vitalCount).toBe(1);
  });
});
