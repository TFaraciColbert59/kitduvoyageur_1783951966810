import type { AdventurePrepDraft, PlaceRef } from '../types';
import { emptyDraft } from '../engine/emptyDraft';

export const CHAMONIX: PlaceRef = {
  id: 'chamonix',
  name: 'Chamonix',
  country: 'France',
  lat: 45.9237,
  lon: 6.8694,
};

export const ARGENTIERE: PlaceRef = {
  id: 'argentiere',
  name: 'Argentière',
  country: 'France',
  lat: 45.9819,
  lon: 6.9269,
};

const BASE = {
  activities: { primary: 'rando-refuge', extra: [], nights: [] },
  route: { origin: CHAMONIX, destination: ARGENTIERE, shape: 'aller_simple' as const },
  calendar: {
    startDate: '2026-07-11',
    startDateIsSuggested: false,
    durationDays: 3,
    durationIsSuggested: false,
    returnDate: '2026-07-13',
  },
  group: {
    mode: 'groupe' as const,
    adults: 2,
    children: 0,
    hasPets: false,
    knownMembers: ['Camille'],
  },
  preferences: {
    budgetPerPerson: 90,
    budgetLevel: 'modere' as const,
    pace: 'normal' as const,
    transport: 'train' as const,
    interests: ['paysage'],
    accessibilityNeeds: [],
  },
  currentStep: 'destination' as const,
  completedSteps: ['destination' as const],
};

/** Brouillon complet et coherent : une rando-refuge de 3 jours. */
export function fullDraft(overrides: Partial<AdventurePrepDraft> = {}): AdventurePrepDraft {
  return { ...emptyDraft(), ...BASE, ...overrides };
}

export function draftWithoutItineraryInput(
  overrides: Partial<AdventurePrepDraft> = {},
): AdventurePrepDraft {
  return fullDraft({
    activities: { primary: null, extra: [], nights: [] },
    ...overrides,
  });
}

