/**
 * Données d'ESSAI de la page de laboratoire `/dev/compas` (jamais servie en production).
 *
 * Elles ne servent qu'à regarder le rendu de l'écran (captures Playwright, réglage de la mise en
 * page bureau et tablette) sans compte ni base : le voyage, les personnes et les prix ci-dessous
 * sont des valeurs de test écrites ici, pas des données réelles. Le modèle, lui, est calculé par le
 * vrai moteur (`buildCompasModel`).
 */
import { compasData, item, TRIP, U1, U2 } from '../__tests__/helpers/compasData';
import type { CompasInput } from '../engine/compasModel';
import type { CompasData, CompasShopProduct } from '../server/getCompasData';

export const U3 = '66666666-6666-4666-8666-666666666666';

const STEPS: CompasInput['steps'] = [
  ['Gavarnie', 42.735, -0.01, 12.4, 900],
  ['Cabane des Sarradets', 42.69, -0.002, 9.1, 650],
  ['Refuge de Baysselance', 42.78, -0.09, 14.2, 800],
  ['Cirque de Troumouse', 42.72, 0.06, 8.3, 400],
].map(([title, lat, lon, km, gain], i) => ({
  id: `s${i + 1}`,
  dayNumber: i + 1,
  orderIndex: 0,
  title: String(title),
  locationName: String(title),
  lat: Number(lat),
  lon: Number(lon),
  distanceKm: Number(km),
  elevationGainM: Number(gain),
  elevationLossM: 300,
  accommodationName: i === 1 || i === 2 ? String(title) : null,
  transportMode: 'foot',
  startTime: null,
}));

const SHOP: CompasShopProduct[] = [
  {
    id: 'p-loc-1',
    slug: 'jetboil-location',
    mode: 'location',
    name: 'Réchaud compact',
    brand: 'Jetboil',
    category: 'cook',
    weightG: 410,
    priceEur: null,
    pricePerDay: 6,
    rating: null,
    reviewCount: null,
    image: null,
    imageAlt: null,
  },
  {
    id: 'p-ach-1',
    slug: 'rechaud-mini',
    mode: 'achat',
    name: 'Mini réchaud à gaz',
    brand: 'Trangia',
    category: 'cook',
    weightG: 85,
    priceEur: 39,
    pricePerDay: null,
    rating: 4.4,
    reviewCount: 38,
    image: null,
    imageAlt: null,
  },
  {
    id: 'p-ach-2',
    slug: 'rechaud-titane',
    mode: 'achat',
    name: 'Réchaud titane',
    brand: 'Primus',
    category: 'cook',
    weightG: 62,
    priceEur: 64,
    pricePerDay: null,
    rating: null,
    reviewCount: null,
    image: null,
    imageAlt: null,
  },
  {
    id: 'p-occ-1',
    slug: 'rechaud-occasion',
    mode: 'occasion',
    name: 'Réchaud gaz, occasion',
    brand: 'MSR',
    category: 'cook',
    weightG: 180,
    priceEur: 22,
    pricePerDay: null,
    rating: null,
    reviewCount: null,
    image: null,
    imageAlt: null,
  },
];

/** Un voyage de 5 jours, trois personnes (dont une invitée), un réchaud vital à trouver. */
export function labCompasData(): CompasData {
  const base = compasData({
    trip: {
      id: TRIP,
      slug: 'trek-3-vallees',
      title: 'Trek des 3 Vallées',
      destinationName: 'Pyrénées',
      startDate: '2026-10-14',
      endDate: '2026-10-18',
      primaryActivity: 'hiking',
      estimatedBudget: 900,
      budgetCurrency: 'EUR',
      partySize: 3,
      ownerId: U1,
    },
    steps: STEPS,
    items: [
      item({ id: 'i-tent', name: 'Tente 2 places', category: 'shelter', weightGrams: 1800, ownership: 'shared', ownerId: U1, inventoryItemId: 'inv-tent', isPacked: true }),
      item({ id: 'i-lamp', name: 'Lampe frontale', category: 'tech', weightGrams: 90, isVital: true, inventoryItemId: 'inv-lamp' }),
      item({ id: 'i-stove', name: 'Réchaud', category: 'cook', weightGrams: null, isVital: true, ownership: 'shared' }),
      item({ id: 'i-mat', name: 'Matelas isolant', category: 'sleep', weightGrams: 480 }),
      item({ id: 'i-bag', name: 'Duvet 0 °C', category: 'sleep', weightGrams: 900, inventoryItemId: 'inv-bag' }),
    ],
    inventory: [
      { id: 'inv-tent', name: 'Tente 2 places', brand: 'Quechua', category: 'shelter', weightG: 1800, condition: 'bon', isLent: false, maintenanceDueAt: null, expiryDate: null, quantity: 1 },
      { id: 'inv-lamp', name: 'Lampe frontale', brand: 'Petzl', category: 'tech', weightG: 90, condition: 'neuf', isLent: false, maintenanceDueAt: null, expiryDate: null, quantity: 1 },
      { id: 'inv-bag', name: 'Duvet 0 °C', brand: null, category: 'sleep', weightG: 900, condition: 'bon', isLent: false, maintenanceDueAt: null, expiryDate: null, quantity: 1 },
    ],
    members: [
      { userId: U1, name: 'Tony', avatarUrl: null, role: 'owner', maxCarryKg: 14, flatSpeedKmh: 4.6, experienceLevel: 'advanced', calibrationLevel: 'contextualization', profileSources: { flatSpeedKmH: 'learned', experienceLevel: 'estimated', maxCarryKg: 'estimated' } },
      { userId: U2, name: 'Léa', avatarUrl: null, role: 'member', maxCarryKg: 14, flatSpeedKmh: null, experienceLevel: null, calibrationLevel: null, profileSources: { flatSpeedKmH: 'average', experienceLevel: 'average', maxCarryKg: 'average' } },
      { userId: U3, name: 'Noé', avatarUrl: null, role: 'viewer', maxCarryKg: 12, flatSpeedKmh: 3.6, experienceLevel: 'beginner', calibrationLevel: 'contextualization', profileSources: { flatSpeedKmH: 'learned', experienceLevel: 'estimated', maxCarryKg: 'estimated' } },
    ],
  });
  return {
    ...base,
    shop: SHOP,
    routeGeojson: {
      type: 'Feature',
      properties: { name: 'Trek des 3 Vallées' },
      geometry: {
        type: 'LineString',
        coordinates: STEPS.map((s) => [s.lon as number, s.lat as number]),
      },
    },
    points: [
      ...STEPS.map((s) => ({
        id: `s-${s.id}`,
        lat: s.lat as number,
        lon: s.lon as number,
        label: s.title,
        category: s.accommodationName ? 'stay' : 'step',
        kind: 'step' as const,
      })),
      { id: 'p-eau', lat: 42.71, lon: -0.006, label: 'Source du Sarradets', category: 'water', kind: 'poi' as const },
    ],
    pendingInvites: [
      { id: 'inv-1', userId: '77777777-7777-4777-8777-777777777771', name: 'Sam', avatarUrl: null, role: 'editor', createdAt: '2026-10-10T09:00:00Z' },
    ],
  };
}
