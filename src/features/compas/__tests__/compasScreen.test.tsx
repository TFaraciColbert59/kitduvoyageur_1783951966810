// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { buildCompasModel, type CompasInput, type CompasItemInput } from '../engine/compasModel';
import type { CompasData } from '../server/getCompasData';

/* Frontières réseau et navigateur uniquement : l'écran, les cartes, les
   tiroirs et le moteur sont les vrais. */
const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh, push: vi.fn() }), usePathname: () => '/compas' }));
vi.mock('next/dynamic', () => ({ default: () => () => <div data-testid="map" /> }));

const kit = vi.hoisted(() => ({
  togglePackedAction: vi.fn(async () => ({ success: true })),
  deleteTripItemAction: vi.fn(async () => ({ success: true })),
  addInventoryItemToTripAction: vi.fn(async () => ({ success: true })),
  addCustomTripItemAction: vi.fn(async () => ({ success: true })),
}));
vi.mock('@/app/voyages/kit-actions', () => kit);

const compas = vi.hoisted(() => ({
  compasSetCarrierAction: vi.fn(async () => ({ success: true })),
  compasPickShopProductAction: vi.fn(async () => ({ success: true })),
  compasAddShopProductToTripAction: vi.fn(async () => ({ success: true })),
  compasAddInventoryItemAction: vi.fn(async () => ({ success: true })),
  compasMarkReturnedAction: vi.fn(async () => ({ success: true })),
  compasSetBudgetAction: vi.fn(async () => ({ success: true })),
}));
vi.mock('../server/compasActions', () => compas);

const cart = vi.hoisted(() => ({ addToCart: vi.fn() }));
vi.mock('@/lib/cart', () => cart);

import { CompasScreen } from '../components/CompasScreen';

const TRIP = '11111111-1111-4111-8111-111111111111';
const U1 = '22222222-2222-4222-8222-222222222222';
const U2 = '33333333-3333-4333-8333-333333333333';
const SLEEP = '44444444-4444-4444-8444-444444444444';
const TENT = '55555555-5555-4555-8555-555555555555';
const PRODUCT = '66666666-6666-4666-8666-666666666666';

function item(p: Partial<CompasItemInput> & { id: string; name: string }): CompasItemInput {
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

const baseTrip: CompasInput['trip'] = {
  id: TRIP,
  slug: 'trek-3-vallees',
  title: 'Trek des 3 Vallées',
  destinationName: 'Pyrénées',
  startDate: '2026-10-12',
  endDate: '2026-10-15',
  primaryActivity: 'hiking',
  estimatedBudget: 900,
  budgetCurrency: 'EUR',
  partySize: 2,
  ownerId: U1,
};

function makeData(overrides: Partial<CompasInput> = {}): CompasData {
  const input: CompasInput = {
    trip: baseTrip,
    steps: [
      { id: 's1', dayNumber: 1, orderIndex: 0, title: 'Gavarnie', locationName: 'Gavarnie', lat: 42.73, lon: -0.01, distanceKm: 12.4, elevationGainM: 900, elevationLossM: 300, accommodationName: null, transportMode: 'foot', startTime: null },
      { id: 's2', dayNumber: 2, orderIndex: 0, title: 'Refuge', locationName: 'Refuge', lat: 42.7, lon: 0.02, distanceKm: 10, elevationGainM: 700, elevationLossM: 800, accommodationName: 'Refuge', transportMode: 'foot', startTime: null },
    ],
    items: [
      item({ id: SLEEP, name: 'Sac de couchage', category: 'sleep', isVital: true, reason: 'Nuit à −3 °C', ownerId: U1 }),
      item({ id: TENT, name: 'Tente 2P', category: 'shelter', ownership: 'shared', weightGrams: 1720, isPacked: true }),
    ],
    members: [
      { userId: U1, name: 'Tony', avatarUrl: null, role: 'owner', maxCarryKg: 14, flatSpeedKmh: 4.6, experienceLevel: null, calibrationLevel: null },
      { userId: U2, name: 'Léa', avatarUrl: null, role: 'member', maxCarryKg: null, flatSpeedKmh: null, experienceLevel: null, calibrationLevel: null },
    ],
    expenses: [],
    inventory: [],
    bookings: [],
    weather: [],
    routeDurationMin: 325,
    routeHasGeometry: false,
    waterPointsCount: null,
    viewerId: U1,
    now: new Date('2026-09-30T12:00:00Z'),
    timeZone: 'Europe/Paris',
    ...overrides,
  };
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
    points: [],
    inventory: [],
    shop: [
      {
        id: PRODUCT,
        slug: 'duvet-trek-0',
        mode: 'achat',
        name: 'Sac de couchage Trek 0°',
        brand: 'Forclaz',
        category: 'Couchage',
        weightG: 980,
        priceEur: 75,
        pricePerDay: null,
        rating: 4.6,
        reviewCount: 120,
        image: null,
        imageAlt: null,
      },
    ],
    affiliateLinks: [],
    canEdit: true,
    viewerId: U1,
    providers: { routestack: 'disabled', viator: 'disabled' },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  class RO {
    observe() {}
    disconnect() {}
  }
  (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = RO;
});
afterEach(cleanup);

const stepsNav = () => screen.getByRole('navigation', { name: 'Étapes du Compas' });

describe('CompasScreen', () => {
  it('ouvre sur l’étape de la prochaine décision réelle', () => {
    render(<CompasScreen data={makeData()} />);
    expect(within(stepsNav()).getByRole('button', { name: /Kit/ }).getAttribute('aria-current')).toBe('step');
    expect(screen.getByText('Trouver : sac de couchage')).toBeTruthy();
    expect(screen.getByText('Prêt sur les points vérifiés')).toBeTruthy();
    expect(screen.getByText(/1 vital à trouver/)).toBeTruthy();
  });

  it('décision → tiroir Kit → fiche → Acheter → produit précis relié et mis au panier', async () => {
    render(<CompasScreen data={makeData()} />);
    fireEvent.click(screen.getByText('Trouver : sac de couchage'));
    const kitSheet = await screen.findByRole('dialog', { name: 'Kit' });
    fireEvent.click(within(kitSheet).getByText('Sac de couchage'));
    const sheet = await screen.findByRole('dialog', { name: 'Sac de couchage' });
    expect(within(sheet).getByText('Nuit à −3 °C')).toBeTruthy();
    fireEvent.click(within(sheet).getByRole('button', { name: /Acheter/ }));

    const shop = await screen.findByRole('dialog', { name: 'Trouver : Sac de couchage' });
    expect(within(shop).getByText('Sac de couchage Trek 0°')).toBeTruthy();
    fireEvent.click(within(shop).getByRole('button', { name: 'Choisir' }));

    await waitFor(() =>
      expect(compas.compasPickShopProductAction).toHaveBeenCalledWith({
        tripId: TRIP,
        tripSlug: 'trek-3-vallees',
        itemId: SLEEP,
        shopProductId: PRODUCT,
      }),
    );
    await waitFor(() => expect(cart.addToCart).toHaveBeenCalledWith(expect.objectContaining({ id: PRODUCT, priceEur: 75 })));
    expect(refresh).toHaveBeenCalled();
  });

  const openAllKit = async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Détails : Kit' }));
    const sheet = await screen.findByRole('dialog', { name: 'Kit' });
    fireEvent.click(within(sheet).getByRole('button', { name: /Tout/ }));
    return sheet;
  };

  it('emballer est optimiste puis confirmé par le serveur', async () => {
    render(<CompasScreen data={makeData()} />);
    await openAllKit();
    fireEvent.click(screen.getByRole('button', { name: 'Emballer Sac de couchage' }));
    expect(screen.getByRole('button', { name: 'Déballer Sac de couchage' })).toBeTruthy();
    await waitFor(() => expect(kit.togglePackedAction).toHaveBeenCalledWith(SLEEP, true, 'trek-3-vallees'));
  });

  it('un échec serveur annule l’état optimiste et le dit', async () => {
    kit.togglePackedAction.mockResolvedValueOnce({ success: false, error: 'Refusé par la RLS' } as never);
    render(<CompasScreen data={makeData()} />);
    await openAllKit();
    fireEvent.click(screen.getByRole('button', { name: 'Emballer Sac de couchage' }));
    expect(await screen.findByText('Refusé par la RLS')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Emballer Sac de couchage' })).toBeTruthy();
  });

  it('sacs : le commun sans porteur est confié à quelqu’un de l’équipe', async () => {
    render(<CompasScreen data={makeData()} />);
    fireEvent.click(screen.getByRole('button', { name: /1 objet commun sans porteur/ }));
    const sacs = await screen.findByRole('dialog', { name: 'Kit' });
    fireEvent.click(within(sacs).getByRole('button', { name: /Tente 2P/ }));
    const carrier = await screen.findByRole('dialog', { name: 'Qui porte : Tente 2P' });
    fireEvent.click(within(carrier).getByRole('button', { name: /Léa/ }));
    await waitFor(() =>
      expect(compas.compasSetCarrierAction).toHaveBeenCalledWith({
        tripId: TRIP,
        tripSlug: 'trek-3-vallees',
        itemId: TENT,
        carrierId: U2,
        shared: true,
      }),
    );
  });

  it('sans dates : aucun chiffre inventé, la décision demande les dates', () => {
    const data = makeData({
      trip: {
        id: TRIP,
        slug: 'trek-3-vallees',
        title: 'Sortie',
        destinationName: null,
        startDate: null,
        endDate: null,
        primaryActivity: null,
        estimatedBudget: null,
        budgetCurrency: 'EUR',
        partySize: 1,
        ownerId: U1,
      },
      items: [],
    });
    render(<CompasScreen data={data} />);
    expect(screen.getByText('Choisir les dates')).toBeTruthy();
    expect(within(stepsNav()).getByRole('button', { name: /Où/ }).getAttribute('aria-current')).toBe('step');
    expect(screen.getAllByText(/Dates à choisir/).length).toBeGreaterThan(0);
    expect(screen.getByText('Avec les dates')).toBeTruthy();
    expect(screen.getByText('À choisir')).toBeTruthy();
  });

  it('Nous : budget réel, aucune enveloppe inventée, l’équipe la fixe', async () => {
    render(<CompasScreen data={makeData({ trip: { ...baseTrip, estimatedBudget: null } })} />);
    fireEvent.click(within(stepsNav()).getByRole('button', { name: /Nous/ }));
    expect(screen.getByText('Aucune enveloppe fixée pour ce voyage.')).toBeTruthy();
    expect(screen.getByText(/Capacité de portage renseignée/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Détails : Nous' }));
    const sheet = await screen.findByRole('dialog', { name: 'Nous' });
    fireEvent.click(within(sheet).getByRole('button', { name: /Budget/ }));
    fireEvent.change(within(sheet).getByLabelText(/Enveloppe du voyage/), { target: { value: '1200' } });
    fireEvent.click(within(sheet).getByRole('button', { name: 'Enregistrer' }));
    await waitFor(() =>
      expect(compas.compasSetBudgetAction).toHaveBeenCalledWith({ tripId: TRIP, tripSlug: 'trek-3-vallees', amount: 1200 }),
    );
  });

  it('objet prêté : « Je l’ai récupéré » remet l’objet de l’inventaire en service', async () => {
    const INV = '77777777-7777-4777-8777-777777777777';
    const inventory = [
      { id: INV, name: 'Frontale', brand: 'Petzl', category: 'Électronique', weightG: 80, condition: 'bon', isLent: true, maintenanceDueAt: null, expiryDate: null, quantity: 1 },
    ];
    const data = makeData({ items: [item({ id: SLEEP, name: 'Frontale', isVital: true, inventoryItemId: INV })], inventory });
    render(<CompasScreen data={{ ...data, inventory }} />);
    fireEvent.click(screen.getByText('Récupérer : frontale'));
    const kitSheet = await screen.findByRole('dialog', { name: 'Kit' });
    fireEvent.click(within(kitSheet).getByText('Frontale'));
    const sheet = await screen.findByRole('dialog', { name: 'Frontale' });
    fireEvent.click(within(sheet).getByRole('button', { name: /Je l’ai récupéré/ }));
    await waitFor(() => expect(compas.compasMarkReturnedAction).toHaveBeenCalledWith({ inventoryItemId: INV }));
  });

  it('agrandir la carte réduit le haut à une carte-titre', () => {
    const { container } = render(<CompasScreen data={makeData()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Agrandir la carte' }));
    expect(container.querySelector('.compas')?.getAttribute('data-map')).toBe('big');
    fireEvent.click(screen.getAllByRole('button', { name: 'Réduire la carte' })[0]);
    expect(container.querySelector('.compas')?.getAttribute('data-map')).toBeNull();
  });
});
