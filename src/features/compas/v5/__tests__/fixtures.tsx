import { vi } from 'vitest';
import React, { type ReactNode } from 'react';
import { buildCompasModel, type CompasInput, type CompasItemInput } from '../../engine/compasModel';
import { assessDanger } from '../../engine/danger';
import type { CompasData } from '../../server/getCompasData';
import type { CompasCtl } from '../../components/compasTypes';
import { FR_T } from '../../components/compasTypes';
import { V5Context, type V5Api } from '../context';
import { EMPTY_EXTRAS, type V5Extras, type V5Space } from '../types';

/**
 * Fixtures partagées des tests du Compas v5 : un voyage réaliste (Vercors, 3 jours, 4 personnes, 3 étapes,
 * 6 objets) construit par le vrai moteur (`buildCompasModel`), et un `V5Api` dont le contrôleur est espionné.
 * Seules les frontières réseau (actions serveur) doivent être simulées par les tests.
 */
export const TRIP = '11111111-1111-4111-8111-111111111111';
export const U = {
  tony: '22222222-2222-4222-8222-222222222222',
  claire: '33333333-3333-4333-8333-333333333333',
  leo: '44444444-4444-4444-8444-444444444444',
  maya: '55555555-5555-4555-8555-555555555555',
};

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
    ownerId: U.tony,
    inventoryItemId: null,
    shopProductId: null,
    condition: null,
    reason: null,
    purchaseState: null,
    ...p,
  };
}

export function makeInput(overrides: Partial<CompasInput> = {}): CompasInput {
  return {
    trip: {
      id: TRIP,
      slug: 'vercors-novembre',
      title: 'Randonnée · Vercors',
      destinationName: 'Vercors',
      startDate: '2026-11-03',
      endDate: '2026-11-05',
      primaryActivity: 'hiking',
      estimatedBudget: 600,
      budgetCurrency: 'EUR',
      partySize: 4,
      ownerId: U.tony,
    },
    steps: [
      { id: 's1', dayNumber: 1, orderIndex: 0, title: 'Sainte-Eulalie-en-Royans → Rencurel', locationName: 'Rencurel', lat: 45.0, lon: 5.4, distanceKm: 14, elevationGainM: 820, elevationLossM: 300, accommodationName: 'Gîte du Royans', transportMode: 'foot', startTime: null },
      { id: 's2', dayNumber: 2, orderIndex: 0, title: 'Rencurel → Corrençon-en-Vercors', locationName: 'Corrençon-en-Vercors', lat: 45.07, lon: 5.52, distanceKm: 19, elevationGainM: 1080, elevationLossM: 700, accommodationName: null, transportMode: 'foot', startTime: null },
      { id: 's3', dayNumber: 3, orderIndex: 0, title: 'Corrençon-en-Vercors → La Chapelle-en-Vercors', locationName: 'La Chapelle-en-Vercors', lat: 45.1, lon: 5.4, distanceKm: 10, elevationGainM: 420, elevationLossM: 900, accommodationName: null, transportMode: 'foot', startTime: null },
    ],
    items: [
      item({ id: 'i1', name: 'Sac à dos 38 L', category: 'porter', weightGrams: 1250, isPacked: true }),
      item({ id: 'i2', name: 'Veste de pluie', category: 'vetements', weightGrams: 320, reason: 'Averses le 4 au matin' }),
      item({ id: 'i3', name: 'Trousse de secours', category: 'securite', weightGrams: 260, isVital: true, purchaseState: 'to_buy' }),
      item({ id: 'i4', name: 'Frontale', category: 'securite', weightGrams: 95, isPacked: true }),
      item({ id: 'i5', name: 'Tente 2 places', category: 'dormir', weightGrams: 1900, ownership: 'shared', ownerId: null }),
      item({ id: 'i6', name: 'Réchaud et popote', category: 'eau', weightGrams: 520, ownership: 'shared', ownerId: null }),
    ],
    members: [
      { userId: U.tony, name: 'Tony', avatarUrl: null, role: 'owner', maxCarryKg: 14, flatSpeedKmh: 4.2, experienceLevel: 'regulier', calibrationLevel: null },
      { userId: U.claire, name: 'Claire', avatarUrl: null, role: 'editor', maxCarryKg: 12, flatSpeedKmh: 4.6, experienceLevel: 'aguerri', calibrationLevel: null },
      { userId: U.leo, name: 'Léo', avatarUrl: null, role: 'member', maxCarryKg: null, flatSpeedKmh: 3.4, experienceLevel: 'debut', calibrationLevel: null },
      { userId: U.maya, name: 'Maya', avatarUrl: null, role: 'member', maxCarryKg: 10, flatSpeedKmh: 4.0, experienceLevel: 'regulier', calibrationLevel: null },
    ],
    expenses: [
      { id: 'e1', title: 'Essence, aller', amount: 32, category: 'transport', isPlanned: false, payerId: U.tony, splitType: 'equal' },
      { id: 'e2', title: 'Courses, Carrefour Villard', amount: 48, category: 'repas', isPlanned: false, payerId: U.claire, splitType: 'equal' },
    ],
    inventory: [],
    bookings: [],
    weather: [
      { date: '2026-11-03', tempMinC: 2, tempMaxC: 8, precipPct: 10, precipMm: 0, weathercode: 1 },
      { date: '2026-11-04', tempMinC: 0, tempMaxC: 5, precipPct: 70, precipMm: 4, weathercode: 61 },
      { date: '2026-11-05', tempMinC: 1, tempMaxC: 7, precipPct: 5, precipMm: 0, weathercode: 2 },
    ],
    routeDurationMin: 900,
    routeHasGeometry: true,
    waterPointsCount: 3,
    viewerId: U.tony,
    now: new Date('2026-10-22T12:00:00Z'),
    timeZone: 'Europe/Paris',
    ...overrides,
  };
}

export function makeData(overrides: Partial<CompasInput> = {}, extra: Partial<CompasData> = {}): CompasData {
  const input = makeInput(overrides);
  return {
    model: buildCompasModel(input),
    itinerary: input.steps.map((st) => ({ id: st.id, day: st.dayNumber, title: st.title, distanceKm: st.distanceKm, elevationGainM: st.elevationGainM, accommodation: st.accommodationName })),
    bookings: [],
    expenses: input.expenses,
    routeGeojson: null,
    elevation: null,
    countryCode: 'fr',
    points: input.steps.map((st) => ({ id: `s-${st.id}`, lat: st.lat ?? 0, lon: st.lon ?? 0, label: st.title, category: 'step', kind: 'step' as const })),
    inventory: [],
    shop: [
      { id: '66666666-6666-4666-8666-666666666666', slug: 'trousse-secours', mode: 'achat', name: 'Trousse de secours randonnée', brand: 'Forclaz', category: 'Sécurité', weightG: 260, priceEur: 24.9, pricePerDay: null, rating: 4.6, reviewCount: 120, image: null, imageAlt: null },
    ],
    affiliateLinks: [],
    canEdit: true,
    viewerId: U.tony,
    providers: { routestack: 'disabled', viator: 'disabled' },
    fx: null,
    danger: assessDanger({ dayPlans: [], forecasts: [], alerts: [] }),
    kitAdvice: [],
    routePois: [],
    weather: null,
    route: { id: null, name: null },
    origin: { lat: 45.0, lon: 5.4 },
    pendingInvites: [],
    autofill: 'done',
    aiOn: false,
    ...extra,
  };
}

/** Contrôleur espion : `run` exécute l'action et rend son succès, comme le vrai (sans annonce). */
export function makeCtl(data: CompasData): CompasCtl & { runs: string[] } {
  const runs: string[] = [];
  return {
    data,
    lines: data.model.kit.lines,
    busy: false,
    open: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    close: vi.fn(),
    enlarge: vi.fn(),
    run: vi.fn(async (success: string, action: () => Promise<{ success: boolean; error?: string }>) => {
      runs.push(success);
      const res = await action();
      return res.success;
    }),
    togglePacked: vi.fn(),
    memberName: (id) => data.model.crew.loads.find((m) => m.userId === id)?.name ?? '—',
    product: (id) => data.shop.find((p) => p.id === id),
    notify: vi.fn(),
    t: FR_T,
    locale: 'fr',
    runs,
  };
}

export function makeApi(
  overrides: Partial<V5Api> = {},
  opts: { data?: CompasData; extras?: V5Extras } = {}
): V5Api & { ctl: CompasCtl & { runs: string[] } } {
  type Spy = CompasCtl & { runs: string[] };
  const data = opts.data ?? makeData();
  const ctl: Spy = makeCtl(data);
  const people = Math.max(1, data.model.crew.size);
  return {
    data,
    extras: opts.extras ?? EMPTY_EXTRAS,
    t: FR_T,
    locale: 'fr',
    canEdit: data.canEdit,
    solo: people <= 1,
    people,
    space: null,
    tab: 0,
    day: 0,
    openSpace: vi.fn(),
    closeSpace: vi.fn(),
    setTab: vi.fn(),
    announce: vi.fn(),
    prefs: { outdoor: false, setOutdoor: vi.fn(), undoS: 15, setUndoS: vi.fn(), offlineSavedAt: null },
    ...overrides,
    ctl,
  };
}

/** Enveloppe de rendu : `render(<WithApi api={api}><Body /></WithApi>)`. */
export function WithApi({ api, children }: { api: V5Api; children: ReactNode }) {
  return <V5Context.Provider value={api}>{children}</V5Context.Provider>;
}

export type { V5Space };
