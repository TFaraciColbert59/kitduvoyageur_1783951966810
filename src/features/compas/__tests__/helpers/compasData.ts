/**
 * Un voyage complet pour les tests d'écran : le modèle est celui du moteur
 * (`buildCompasModel`), les données autour sont des valeurs de test explicites.
 * Deux jours de marche (Gavarnie 12,4 km, Refuge 10 km), deux membres, un objet vital à trouver.
 */
import { buildCompasModel, type CompasInput, type CompasItemInput } from '../../engine/compasModel';
import { assessDanger } from '../../engine/danger';
import type { CompasData } from '../../server/getCompasData';

export const TRIP = '11111111-1111-4111-8111-111111111111';
export const U1 = '22222222-2222-4222-8222-222222222222';
export const U2 = '33333333-3333-4333-8333-333333333333';
export const SLEEP = '44444444-4444-4444-8444-444444444444';
export const TENT = '55555555-5555-4555-8555-555555555555';
export const STOVE = '77777777-7777-4777-8777-777777777777';
export const MAT = '88888888-8888-4888-8888-888888888888';

export function item(p: Partial<CompasItemInput> & { id: string; name: string }): CompasItemInput {
  return {
    category: null,
    quantity: 1,
    weightGrams: null,
    isPacked: false,
    isVital: false,
    isWorn: false,
    isConsumable: false,
    ownership: 'personal',
    ownerId: null,
    inventoryItemId: null,
    shopProductId: null,
    condition: null,
    reason: null,
    purchaseState: null,
    ...p,
  };
}

export const baseTrip: CompasInput['trip'] = {
  id: TRIP,
  slug: 'trek-3-vallees',
  title: 'Trek des 3 Vallées',
  destinationName: 'Pyrénées',
  startDate: '2026-10-12',
  endDate: '2026-10-13',
  primaryActivity: 'hiking',
  estimatedBudget: 900,
  budgetCurrency: 'EUR',
  partySize: 2,
  ownerId: U1,
};

export function compasInput(overrides: Partial<CompasInput> = {}): CompasInput {
  return {
    trip: baseTrip,
    steps: [
      {
        id: 's1',
        dayNumber: 1,
        orderIndex: 0,
        title: 'Gavarnie',
        locationName: 'Gavarnie',
        lat: 42.73,
        lon: -0.01,
        distanceKm: 12.4,
        elevationGainM: 900,
        elevationLossM: 300,
        accommodationName: null,
        transportMode: 'foot',
        startTime: null,
      },
      {
        id: 's2',
        dayNumber: 2,
        orderIndex: 0,
        title: 'Refuge',
        locationName: 'Refuge',
        lat: 42.7,
        lon: 0.02,
        distanceKm: 10,
        elevationGainM: 700,
        elevationLossM: 800,
        accommodationName: 'Refuge',
        transportMode: 'foot',
        startTime: null,
      },
    ],
    items: [],
    members: [
      {
        userId: U1,
        name: 'Tony',
        avatarUrl: null,
        role: 'owner',
        maxCarryKg: 14,
        flatSpeedKmh: 4.6,
        experienceLevel: null,
        calibrationLevel: null,
      },
      {
        userId: U2,
        name: 'Léa',
        avatarUrl: null,
        role: 'member',
        maxCarryKg: 12,
        flatSpeedKmh: null,
        experienceLevel: null,
        calibrationLevel: null,
      },
    ],
    expenses: [],
    inventory: [],
    bookings: [],
    weather: [],
    routeDurationMin: 325,
    routeHasGeometry: false,
    waterPointsCount: null,
    viewerId: U1,
    now: new Date('2026-10-11T12:00:00Z'),
    timeZone: 'Europe/Paris',
    ...overrides,
  };
}

/** Les données de l'écran construites à partir d'une entrée du moteur. */
export function compasData(overrides: Partial<CompasInput> = {}, patch: Partial<CompasData> = {}): CompasData {
  const input = compasInput(overrides);
  return {
    model: buildCompasModel(input),
    itinerary: input.steps.map((st) => ({
      id: st.id,
      day: st.dayNumber,
      title: st.title,
      distanceKm: st.distanceKm,
      elevationGainM: st.elevationGainM,
      accommodation: st.accommodationName,
    })),
    bookings: [],
    routeGeojson: null,
    elevation: null,
    countryCode: 'fr',
    points: [],
    inventory: [],
    shop: [],
    affiliateLinks: [],
    canEdit: true,
    viewerId: U1,
    autofill: 'done',
    pendingInvites: [],
    providers: { routestack: 'disabled', viator: 'disabled' },
    fx: null,
    kitAdvice: [],
    routePois: [],
    danger: assessDanger({ dayPlans: [], forecasts: [], alerts: [] }),
    weather: null,
    route: { id: 374, name: 'Tour des Vallées' },
    origin: { lat: 42.73, lon: -0.01 },
    aiOn: false,
    ...patch,
  };
}
