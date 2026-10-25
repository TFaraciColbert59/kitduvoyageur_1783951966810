import { describe, it, expect, beforeEach } from 'vitest';
import {
  calculateDogMaxPackWeight,
  calculateDogWaterRation,
  calculateDogFoodRation,
} from '../src/features/participants/services/dogCareService';
import { useParticipantsStore } from '../src/features/participants/stores/useParticipantsStore';

describe('Participants Feature — Canine Care & Portage Domain Services', () => {
  it('TEST-PART-01: calculates dog max carrying capacity at 15% body weight', () => {
    const max20kg = calculateDogMaxPackWeight(20);
    expect(max20kg).toBe(3.0);

    const max30kg = calculateDogMaxPackWeight(30);
    expect(max30kg).toBe(4.5);

    const maxZero = calculateDogMaxPackWeight(0);
    expect(maxZero).toBe(0);
  });

  it('TEST-PART-02: calculates dog water ration with elevation gain and heat wave modifier', () => {
    // 20kg dog, 500m D+, 20°C: (20 * 0.05) + (5 * 0.02) = 1.0 + 0.10 = 1.10 L
    const temperateRation = calculateDogWaterRation(20, 500, 20);
    expect(temperateRation).toBe(1.1);

    // 20kg dog, 500m D+, 30°C: 1.10 * 1.20 = 1.32 L
    const heatwaveRation = calculateDogWaterRation(20, 500, 30);
    expect(heatwaveRation).toBe(1.32);
  });

  it('TEST-PART-03: calculates dog food rations for active hiking days', () => {
    const food20kg = calculateDogFoodRation(20, true);
    expect(food20kg).toBe(560); // 20 * 28g

    const foodResting = calculateDogFoodRation(20, false);
    expect(foodResting).toBe(440); // 20 * 22g
  });
});

describe('Participants Feature — Privacy Matrix & Zustand Store', () => {
  beforeEach(() => {
    useParticipantsStore.getState().lockAll();
  });

  it('TEST-PART-04: ensures participants are locked by default', () => {
    const humans = useParticipantsStore.getState().humans;
    expect(humans.length).toBeGreaterThan(0);
    humans.forEach((human) => {
      expect(human.isUnlocked).toBe(false);
      expect(human.unlockedAt).toBeUndefined();
    });
  });

  it('TEST-PART-05: unlocks and locks participant explicitly', () => {
    const store = useParticipantsStore.getState();
    const firstId = store.humans[0].id;

    store.unlockParticipant(firstId);
    let target = useParticipantsStore.getState().humans.find((h) => h.id === firstId);
    expect(target?.isUnlocked).toBe(true);
    expect(target?.unlockedAt).toBeDefined();

    store.lockParticipant(firstId);
    target = useParticipantsStore.getState().humans.find((h) => h.id === firstId);
    expect(target?.isUnlocked).toBe(false);
    expect(target?.unlockedAt).toBeUndefined();
  });

  it('TEST-PART-06: calculates group telemetry and portage correctly', () => {
    const stats = useParticipantsStore.getState().getGroupStats();
    expect(stats.totalHumans).toBeGreaterThanOrEqual(1);
    expect(stats.totalDogs).toBeGreaterThanOrEqual(1);
    expect(stats.totalPackWeightKg).toBeGreaterThan(0);
    expect(stats.totalWaterDailyLiters).toBeGreaterThan(0);
  });
});
