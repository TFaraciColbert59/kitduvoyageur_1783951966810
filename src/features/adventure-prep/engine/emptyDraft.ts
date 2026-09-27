import type { AdventurePrepDraft } from '../types';
import { initialGeneration } from './generation';

/** Version du format de brouillon : changee uniquement a la migration. */
export const PREP_DRAFT_VERSION = 1;

export function emptyDraft(): AdventurePrepDraft {
  return {
    version: PREP_DRAFT_VERSION,
    activities: { primary: null, extra: [], nights: [] },
    route: { origin: null, destination: null, shape: 'boucle' },
    calendar: { startDate: null, durationDays: null, durationIsSuggested: false, returnDate: null },
    group: { mode: 'solo', adults: 1, children: 0, hasPets: false, knownMembers: [] },
    preferences: {
      budgetPerPerson: null,
      budgetLevel: 'modere',
      pace: 'normal',
      transport: 'mixte',
      interests: [],
      accessibilityNeeds: [],
    },
    generation: initialGeneration(),
    itinerary: null,
    gear: [],
    packedGearIds: [],
    currentStep: 'destination',
    coverName: null,
    completedSteps: [],
    updatedAt: null,
  };
}
