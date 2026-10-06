// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { buildCompasModel, type CompasInput, type CompasItemInput } from '../engine/compasModel';
import { assessDanger } from '../engine/danger';
import type { CompasData } from '../server/getCompasData';

/* Frontières réseau et navigateur uniquement : l'écran, les cartes, les
   tiroirs et le moteur sont les vrais. */
const refresh = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh, push: vi.fn() }),
  usePathname: () => '/compas',
}));
vi.mock('next/dynamic', () => ({ default: () => () => <div data-testid="map" /> }));

const kit = vi.hoisted(() => ({
  togglePackedAction: vi.fn(async () => ({ success: true })),
  deleteTripItemAction: vi.fn(async () => ({ success: true })),
  addInventoryItemToTripAction: vi.fn(async () => ({ success: true })),
  addCustomTripItemAction: vi.fn(async () => ({ success: true })),
}));
vi.mock('@/app/voyages/kit-actions', () => kit);

const budgetActions = vi.hoisted(() => ({
  addExpenseAction: vi.fn(async (_prev: unknown, _fd: FormData) => ({ success: true })),
}));
vi.mock('@/app/voyages/budget-actions', () => budgetActions);

const compas = vi.hoisted(() => ({
  compasSetCarrierAction: vi.fn(async () => ({ success: true })),
  compasPickShopProductAction: vi.fn(async () => ({ success: true })),
  compasAddShopProductToTripAction: vi.fn(async () => ({ success: true })),
  compasAddInventoryItemAction: vi.fn(async () => ({ success: true })),
  compasMarkReturnedAction: vi.fn(async () => ({ success: true })),
  compasSetBudgetAction: vi.fn(async () => ({ success: true })),
  compasSetDatesAction: vi.fn(async () => ({ success: true })),
  compasSetActivityAction: vi.fn(async () => ({ success: true })),
  compasSetPreferencesAction: vi.fn(async () => ({ success: true })),
  compasSetPartySizeAction: vi.fn(async () => ({ success: true })),
  compasSetStayAction: vi.fn(async () => ({ success: true })),
  compasSearchStaysAction: vi.fn(async () => ({
    success: true,
    mode: 'sandbox' as const,
    fetchedAt: '2026-10-01T10:00:00Z',
    offers: [
      {
        id: 'h1',
        title: 'Gîte des Cimes',
        description: null,
        amount: 64,
        currency: 'EUR',
        provider: 'routestack',
        url: 'https://partner.example/h1',
        requiresRevalidation: true,
      },
      {
        id: 'h2',
        title: 'Refuge sans prix',
        description: null,
        amount: null,
        currency: null,
        provider: 'routestack',
        url: null,
        requiresRevalidation: true,
      },
    ],
  })),
  compasListMyKitsAction: vi.fn(async () => ({
    success: true,
    kits: [
      {
        id: '8d9c1a52-0000-4000-8000-000000000001',
        name: 'Automne alpin',
        season: 'automne',
        items: [
          {
            id: 'i1',
            name: 'Gourde 1 L',
            category: null,
            weightG: 120,
            quantity: 1,
            isVital: false,
            productOwnershipId: null,
          },
          {
            id: 'i2',
            name: 'Frontale',
            category: null,
            weightG: 90,
            quantity: 1,
            isVital: true,
            productOwnershipId: null,
          },
        ],
      },
    ],
  })),
  compasApplyKitAction: vi.fn(async () => ({ success: true })),
  compasSearchPeopleAction: vi.fn(async () => ({
    success: true,
    people: [
      {
        userId: '5c1d2e3f-0000-4000-8000-0000000000aa',
        name: 'Léa Montagne',
        avatarUrl: null,
        location: 'Grenoble',
        followed: true,
      },
    ],
  })),
  compasInviteMemberAction: vi.fn(async () => ({ success: true, invitationId: 'inv-1' })),
  compasCancelInvitationAction: vi.fn(async () => ({ success: true })),
  compasInviteLinkAction: vi.fn(async () => ({ success: true, path: '/invitation/abcdef0123456789' })),
  compasRestoreMemberAction: vi.fn(async () => ({ success: true })),
  compasSetMemberRoleAction: vi.fn(async () => ({ success: true })),
  compasRemoveMemberAction: vi.fn(async () => ({ success: true })),
  compasCreateKitFromTripAction: vi.fn(async () => ({ success: true, kitId: 'k', count: 3 })),
  compasApplyRouteAction: vi.fn(async () => ({ success: true, kept: 0 })),
  compasMyRoutesAction: vi.fn(async () => ({ success: true, routes: [] })),
  compasSearchRoutesAction: vi.fn(async () => ({ success: true, routes: [] as unknown[] })),
  compasInterpretAction: vi.fn(async () => ({
    success: true,
    proposals: [] as unknown[],
    usedAi: false,
    note: null,
  })),
  compasClearStartSayAction: vi.fn(async () => ({ success: true })),
}));
vi.mock('../server/compasActions', () => compas);
const bottle = vi.hoisted(() => ({
  compasBottleStateAction: vi.fn(async () => ({
    success: true,
    state: {
      country: 'fr',
      countryName: 'France',
      trustScore: 80,
      canLaunch: true,
      blocked: null,
      bottles: [
        {
          id: '9b9b9b9b-0000-4000-8000-000000000001',
          name: 'GR en équipe',
          description: null,
          departure: '2026-10-12',
          returnDate: '2026-10-15',
          maxMembers: 6,
          minTrust: 60,
          mixite: 'all',
          activeCount: 1,
          applicants: [
            {
              memberId: '9b9b9b9b-0000-4000-8000-0000000000a1',
              userId: '9b9b9b9b-0000-4000-8000-0000000000b1',
              name: 'Noé Sentier',
              avatarUrl: null,
              trustScore: 72,
            },
          ],
        },
      ],
    },
  })),
  compasLaunchBottleAction: vi.fn(async () => ({ success: true })),
  compasAnswerApplicantAction: vi.fn(async () => ({ success: true })),
  compasCloseBottleAction: vi.fn(async () => ({ success: true })),
}));
vi.mock('../server/bottleActions', () => bottle);
const resa = vi.hoisted(() => ({
  compasNearbyActivitiesAction: vi.fn(async () => ({
    success: true,
    unavailable: false,
    offers: [
      {
        id: 'v1',
        title: 'Cirque de Gavarnie avec un guide',
        untitled: false,
        description: null,
        amount: 45,
        currency: 'EUR',
        provider: 'viator',
        url: 'https://example.test/activite',
        requiresRevalidation: false,
      },
    ],
  })),
  compasSearchOffersAction: vi.fn(async () => ({
    success: true,
    mode: 'sandbox',
    fetchedAt: '2026-10-02T08:00:00Z',
    offers: [
      {
        id: 'o1',
        title: 'Lyon → Pau',
        untitled: false,
        description: null,
        amount: 89,
        currency: 'EUR',
        provider: 'routestack',
        url: 'https://example.test/offer',
        requiresRevalidation: true,
      },
    ],
  })),
}));
vi.mock('../server/resaActions', () => resa);
const autofill = vi.hoisted(() => ({
  compasAutofillAction: vi.fn(async () => ({
    success: true,
    summary: {
      nights: [
        { night: 1, type: 'refuge', place: 'Refuge des Oulettes', reason: 'ton profil : confort' },
        { night: 2, type: 'bivouac', place: null, reason: 'ta préférence' },
      ],
      transport: { mode: 'voiture', km: 412.3, minutes: 250, walkKm: 0.8, fuelEur: 97, basis: '' },
      kit: { inventaire: 2, pret: 0, location: 0, achat: 1, a_trouver: 1 },
      budget: [],
      total: 486,
      notes: [],
      usedAi: true,
      stepsCreated: 0,
    },
  })),
  compasUndoAutofillAction: vi.fn(async () => ({ success: true })),
}));
vi.mock('../server/autofillActions', () => autofill);

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
    items: [
      item({
        id: SLEEP,
        name: 'Sac de couchage',
        category: 'sleep',
        isVital: true,
        reason: 'Nuit à −3 °C',
        ownerId: U1,
      }),
      item({
        id: TENT,
        name: 'Tente 2P',
        category: 'shelter',
        ownership: 'shared',
        weightGrams: 1720,
        isPacked: true,
      }),
    ],
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
        maxCarryKg: null,
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
    elevation: null,
    countryCode: 'fr',
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
    autofill: 'done' as const,
    pendingInvites: [
      {
        id: 'b1c2d3e4-0000-4000-8000-0000000000bb',
        userId: '5c1d2e3f-0000-4000-8000-0000000000cc',
        name: 'Sam Crête',
        avatarUrl: null,
        role: 'editor' as const,
        createdAt: '2026-09-30T10:00:00Z',
      },
    ],
    providers: { routestack: 'disabled', viator: 'disabled' },
    fx: null,
    kitAdvice: [],
    routePois: [],
    danger: assessDanger({ dayPlans: [], forecasts: [], alerts: [] }),
    weather: null,
    route: { id: 374, name: 'Tour des Vallées' },
    origin: { lat: 42.73, lon: -0.01 },
  };
}

// jsdom n'a pas PointerEvent : sans lui, les gestes perdent clientX/clientY.
if (typeof window !== 'undefined' && !('PointerEvent' in window)) {
  class TestPointerEvent extends MouseEvent {
    pointerId: number;
    pointerType: string;
    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init);
      this.pointerId = init.pointerId ?? 1;
      this.pointerType = init.pointerType ?? 'mouse';
    }
  }
  (window as unknown as { PointerEvent: unknown }).PointerEvent = TestPointerEvent;
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
    expect(
      within(stepsNav()).getByRole('button', { name: /Kit/ }).getAttribute('aria-current')
    ).toBe('step');
    expect(screen.getByText('Trouver : sac de couchage')).toBeTruthy();
    expect(screen.getByText('Pas encore prêt')).toBeTruthy();
    expect(screen.getByText(/1 vital à trouver/)).toBeTruthy();
  });

  it('CONTRE-EXEMPLE — sac vide : ni « prêt » ni « rien de vital ne manque »', () => {
    render(<CompasScreen data={makeData({ items: [] })} initialStep="kit" />);
    expect(screen.getByText('Sac à composer')).toBeTruthy();
    expect(screen.getByText('aucun objet prévu pour ce voyage')).toBeTruthy();
    expect(screen.queryByText('Prêt sur les points vérifiés')).toBeNull();
    expect(screen.queryByText(/rien de vital ne manque/)).toBeNull();
  });

  it('double-touche sur un produit : le choisit comme le bouton, un toucher seul ne fait rien', async () => {
    render(<CompasScreen data={makeData()} />);
    fireEvent.click(screen.getByText('Trouver : sac de couchage'));
    const kitSheet = await screen.findByRole('dialog', { name: 'Kit' });
    fireEvent.click(within(kitSheet).getByText('Sac de couchage'));
    const sheet = await screen.findByRole('dialog', { name: 'Sac de couchage' });
    fireEvent.click(within(sheet).getByRole('button', { name: /Acheter/ }));
    const shop = await screen.findByRole('dialog', { name: 'Trouver : Sac de couchage' });
    const row = within(shop).getByText('Sac de couchage Trek 0°').closest('.cp-row') as HTMLElement;
    fireEvent.click(row);
    expect(compas.compasPickShopProductAction).not.toHaveBeenCalled();
    fireEvent.click(row);
    await waitFor(() =>
      expect(compas.compasPickShopProductAction).toHaveBeenCalledWith(
        expect.objectContaining({ itemId: SLEEP, shopProductId: PRODUCT })
      )
    );
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
      })
    );
    await waitFor(() =>
      expect(cart.addToCart).toHaveBeenCalledWith(
        expect.objectContaining({ id: PRODUCT, priceEur: 75 })
      )
    );
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
    await waitFor(() =>
      expect(kit.togglePackedAction).toHaveBeenCalledWith(SLEEP, true, 'trek-3-vallees')
    );
  });

  it('glisser un objet à gauche fait apparaître « Retirer », qui seul retire', async () => {
    render(<CompasScreen data={makeData()} />);
    const sheet = await openAllKit();
    const row = within(sheet)
      .getByRole('button', { name: 'Emballer Sac de couchage' })
      .closest('.cp-row') as HTMLElement;
    fireEvent.pointerDown(row, { clientX: 300, clientY: 10, pointerType: 'touch' });
    fireEvent.pointerMove(row, { clientX: 220, clientY: 12, pointerType: 'touch' });
    fireEvent.pointerUp(row, { clientX: 220, clientY: 12, pointerType: 'touch' });
    fireEvent.click(row);
    // Le glissement n'ouvre pas la fiche et ne retire rien à lui seul.
    expect(screen.queryByRole('dialog', { name: 'Sac de couchage' })).toBeNull();
    expect(kit.deleteTripItemAction).not.toHaveBeenCalled();
    fireEvent.click(within(row).getByRole('button', { name: 'Retirer du kit : Sac de couchage' }));
    await waitFor(() =>
      expect(kit.deleteTripItemAction).toHaveBeenCalledWith(SLEEP, 'trek-3-vallees')
    );
  });

  it('un échec serveur annule l’état optimiste et le dit', async () => {
    kit.togglePackedAction.mockResolvedValueOnce({
      success: false,
      error: 'Refusé par la RLS',
    } as never);
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
      })
    );
  });

  it('eau : besoin par personne, contenants au volume écrit, points d’eau du tracé', async () => {
    const data = makeData({
      items: [item({ id: SLEEP, name: 'Gourde 1 L', quantity: 2 })],
    });
    data.routePois = [
      {
        id: 9,
        name: 'Source du Clot',
        category: 'water',
        lat: 42.7,
        lon: 0,
        distanceM: 120,
        elevationM: null,
      },
    ];
    render(<CompasScreen data={data} />);
    fireEvent.click(within(stepsNav()).getByRole('button', { name: /Kit/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Détails : Kit' }));
    const sheet = await screen.findByRole('dialog', { name: 'Kit' });
    const tabs = within(sheet).getByRole('group', { name: 'Parcours du tiroir' });
    fireEvent.click(within(tabs).getByText('Eau'));
    expect(within(sheet).getByText(/^Eau par personne/)).toBeTruthy();
    expect(within(sheet).getByText('Gourde 1 L')).toBeTruthy();
    expect(within(sheet).getByText(/2 × · 2 L/)).toBeTruthy();
    expect(within(sheet).getByText('Source du Clot')).toBeTruthy();
    expect(within(sheet).getByText(/peut être tarie/)).toBeTruthy();
  });

  it('états : réservations réelles comptées par état, aucun clic ne confirme', async () => {
    const bookings = [
      { id: 'b1', vertical: 'hotel', provider: 'affiliate', status: 'pending', amountEur: 80 },
      { id: 'b2', vertical: 'activity', provider: 'viator', status: 'confirmed', amountEur: 40 },
      { id: 'b3', vertical: 'hotel', provider: 'affiliate', status: 'cancelled', amountEur: 60 },
    ];
    const data = makeData({ bookings });
    render(<CompasScreen data={{ ...data, bookings }} />);
    fireEvent.click(within(stepsNav()).getByRole('button', { name: /Résa/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Détails : Mes réservations' }));
    const sheet = await screen.findByRole('dialog', { name: 'Mes réservations' });
    const tabs = within(sheet).getByRole('group', { name: 'Parcours du tiroir' });
    fireEvent.click(within(tabs).getByText('États'));
    const value = (label: string) =>
      within(sheet).getByText(label).closest('.cp-row')?.querySelector('.cp-row__end')?.textContent;
    expect(value('En attente')).toBe('1');
    expect(value('Confirmée')).toBe('1');
    expect(value('Annulée')).toBe('1');
    expect(within(sheet).queryByText('Expirée')).toBeNull();
    expect(within(sheet).getByText(/ne confirme jamais/)).toBeTruthy();
  });

  it('inventaire : classé par catégorie, « Dans le kit » ouvre la fiche, le reste s’ajoute', async () => {
    const INV1 = '88888888-8888-4888-8888-888888888881';
    const INV2 = '88888888-8888-4888-8888-888888888882';
    const inv = (id: string, name: string, category: string) => ({
      id,
      name,
      brand: null,
      category,
      weightG: 300,
      condition: 'bon',
      isLent: false,
      maintenanceDueAt: null,
      expiryDate: '2020-01-01',
      quantity: 1,
    });
    const inventory = [inv(INV1, 'Réchaud', 'Cuisine'), inv(INV2, 'Popote', 'Cuisine')];
    const data = makeData({
      items: [item({ id: SLEEP, name: 'Réchaud', inventoryItemId: INV1 })],
      inventory,
    });
    render(<CompasScreen data={{ ...data, inventory }} />);
    fireEvent.click(within(stepsNav()).getByRole('button', { name: /Kit/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Détails : Kit' }));
    const sheet = await screen.findByRole('dialog', { name: 'Kit' });
    const tabs = within(sheet).getByRole('group', { name: 'Parcours du tiroir' });
    fireEvent.click(within(tabs).getByText('Inventaire'));
    expect(within(sheet).getAllByText(/périmé/)).toHaveLength(2);
    fireEvent.click(within(sheet).getByRole('button', { name: 'Ajouter au kit : Popote' }));
    await waitFor(() =>
      expect(kit.addInventoryItemToTripAction).toHaveBeenCalledWith(
        TRIP,
        'trek-3-vallees',
        INV2,
        'Popote',
        'Cuisine',
        300
      )
    );
    fireEvent.click(within(sheet).getByRole('button', { name: 'Fiche : Réchaud' }));
    expect(await screen.findByRole('dialog', { name: 'Réchaud' })).toBeTruthy();
  });

  it('défiler un tiroir vers le bas réduit la barre d’onglets, le fermer la rend', async () => {
    const { container } = render(<CompasScreen data={makeData()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Détails : Kit' }));
    const sheet = await screen.findByRole('dialog', { name: 'Kit' });
    const body = sheet.querySelector('.cp-sheet__body') as HTMLElement;
    const root = container.querySelector('.compas') as HTMLElement;
    body.scrollTop = 120;
    fireEvent.scroll(body);
    expect(root.hasAttribute('data-tabmin')).toBe(true);
    body.scrollTop = 40;
    fireEvent.scroll(body);
    expect(root.hasAttribute('data-tabmin')).toBe(false);
    body.scrollTop = 160;
    fireEvent.scroll(body);
    expect(root.hasAttribute('data-tabmin')).toBe(true);
    fireEvent.click(within(sheet).getByRole('button', { name: 'Fermer' }));
    await waitFor(() => expect(root.hasAttribute('data-tabmin')).toBe(false));
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
    expect(
      within(stepsNav()).getByRole('button', { name: /Où/ }).getAttribute('aria-current')
    ).toBe('step');
    expect(screen.getAllByText(/Dates à choisir/).length).toBeGreaterThan(0);
    expect(screen.getAllByText('À choisir').length).toBe(2);
  });

  it('Nous : ajouter une dépense par personne = montant × taille réelle du groupe', async () => {
    render(<CompasScreen data={makeData()} />);
    fireEvent.click(within(stepsNav()).getByRole('button', { name: /Nous/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Détails : Nous' }));
    const sheet = await screen.findByRole('dialog', { name: 'Nous' });
    fireEvent.click(within(sheet).getByRole('button', { name: /Budget/ }));
    fireEvent.click(within(sheet).getByRole('button', { name: /Ajouter une dépense/ }));
    fireEvent.change(within(sheet).getByLabelText('Nom'), { target: { value: 'Parking' } });
    fireEvent.change(within(sheet).getByLabelText(/Montant \(/), { target: { value: '7.5' } });
    fireEvent.click(within(sheet).getByRole('button', { name: 'Par pers.' }));
    expect(within(sheet).getByText(/pour 2 personnes/)).toBeTruthy();
    fireEvent.click(within(sheet).getByRole('button', { name: 'Ajouter' }));
    await waitFor(() => expect(budgetActions.addExpenseAction).toHaveBeenCalled());
    const fd = budgetActions.addExpenseAction.mock.calls[0][1] as FormData;
    expect(fd.get('title')).toBe('Parking');
    expect(fd.get('amount')).toBe('15');
    expect(fd.get('isPlanned')).toBe('true');
    expect(fd.get('splitType')).toBe('equal');
    expect(fd.get('tripId')).toBe(TRIP);
  });

  it('Préremplissage : lieu et dates connus → écrit une fois, annonce le total, annulable', async () => {
    autofill.compasAutofillAction.mockImplementationOnce(
      async () => ({ success: true, pending: true, stepsCreated: 3 }) as never
    );
    render(<CompasScreen data={{ ...makeData(), autofill: 'none' }} />);
    expect(await screen.findByText('Je prépare ton aventure…')).toBeTruthy();
    // Deux temps : l'itinéraire, puis le reste.
    await waitFor(() =>
      expect(autofill.compasAutofillAction).toHaveBeenCalledWith({
        tripId: TRIP,
        tripSlug: 'trek-3-vallees',
        from: null,
        phase: 'steps',
      })
    );
    await waitFor(() =>
      expect(autofill.compasAutofillAction).toHaveBeenCalledWith({
        tripId: TRIP,
        tripSlug: 'trek-3-vallees',
        from: null,
        phase: 'rest',
      })
    );
    expect(await screen.findByText(/Aventure préparée · 486/)).toBeTruthy();
    expect(screen.getByText('1 refuge, 1 bivouac · 412 km de route · 4 objets au kit')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Annuler' }));
    await waitFor(() =>
      expect(autofill.compasUndoAutofillAction).toHaveBeenCalledWith({ tripId: TRIP, tripSlug: 'trek-3-vallees' })
    );
    expect(autofill.compasAutofillAction).toHaveBeenCalledTimes(2);
  });

  it('Préremplissage : déjà fait ou annulé → ne se relance pas', () => {
    render(<CompasScreen data={{ ...makeData(), autofill: 'undone' }} />);
    expect(autofill.compasAutofillAction).not.toHaveBeenCalled();
  });

  it('Nous · Qui : invite les personnes suivies, compte présents / en attente / libres, annule une invitation', async () => {
    render(<CompasScreen data={makeData()} />);
    fireEvent.click(within(stepsNav()).getByRole('button', { name: /Nous/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Détails : Nous' }));
    const sheet = await screen.findByRole('dialog', { name: 'Nous' });
    const tabs = within(sheet).getByRole('group', { name: 'Parcours du tiroir' });
    fireEvent.click(within(tabs).getByText('Qui'));
    await waitFor(() =>
      expect(compas.compasSearchPeopleAction).toHaveBeenCalledWith({ tripId: TRIP, query: '' })
    );
    expect(await within(sheet).findByText('Léa Montagne')).toBeTruthy();
    fireEvent.click(within(sheet).getByRole('button', { name: 'Lecture seule' }));
    fireEvent.click(within(sheet).getByRole('button', { name: 'Inviter Léa Montagne' }));
    await waitFor(() =>
      expect(compas.compasInviteMemberAction).toHaveBeenCalledWith({
        tripId: TRIP,
        tripSlug: 'trek-3-vallees',
        userId: '5c1d2e3f-0000-4000-8000-0000000000aa',
        role: 'viewer',
        source: 'friend',
      })
    );
    // Compteur : présents · en attente · total (l'invitée n'est pas encore dans le voyage).
    expect(within(sheet).getByText(/2 présents · 1 en attente/)).toBeTruthy();
    expect(within(sheet).getByText('Sam Crête')).toBeTruthy();
    // L'envoi de l'invitation occupe l'écran un instant : on attend que le bouton revienne.
    const cancel = within(sheet).getByRole('button', { name: 'Annuler l’invitation de Sam Crête' });
    await waitFor(() => expect((cancel as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(cancel);
    await waitFor(() =>
      expect(compas.compasCancelInvitationAction).toHaveBeenCalledWith({
        tripId: TRIP,
        invitationId: 'b1c2d3e4-0000-4000-8000-0000000000bb',
      })
    );
    const linkBtn = within(sheet).getByRole('button', { name: 'Créer le lien d’invitation' });
    await waitFor(() => expect((linkBtn as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(linkBtn);
    await waitFor(() =>
      expect(compas.compasInviteLinkAction).toHaveBeenCalledWith({ tripId: TRIP, role: 'viewer' })
    );
    expect(await within(sheet).findByText(/\/invitation\/abcdef0123456789/)).toBeTruthy();
    expect(within(sheet).queryByRole('link', { name: /hub/i })).toBeNull();
  });

  it('Nous · Bouteille : tiroir où / à qui / quand, lancer et accepter une candidature', async () => {
    render(<CompasScreen data={makeData()} />);
    fireEvent.click(within(stepsNav()).getByRole('button', { name: /Nous/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Détails : Nous' }));
    const sheet = await screen.findByRole('dialog', { name: 'Nous' });
    const tabs = within(sheet).getByRole('group', { name: 'Parcours du tiroir' });
    fireEvent.click(within(tabs).getByText('Bouteille'));
    expect(await within(sheet).findByText('Noé Sentier')).toBeTruthy();
    fireEvent.click(within(sheet).getByRole('button', { name: 'Accepter Noé Sentier' }));
    await waitFor(() =>
      expect(bottle.compasAnswerApplicantAction).toHaveBeenCalledWith({
        tripId: TRIP,
        tripSlug: 'trek-3-vallees',
        groupId: '9b9b9b9b-0000-4000-8000-000000000001',
        memberId: '9b9b9b9b-0000-4000-8000-0000000000a1',
        accept: true,
      })
    );
    const form = within(sheet).getByRole('form', { name: 'Lancer une bouteille' });
    fireEvent.click(within(form).getByRole('button', { name: 'Femmes' }));
    fireEvent.click(within(form).getByLabelText(/18 ans/));
    fireEvent.click(within(form).getByRole('button', { name: /Lancer$/ }));
    await waitFor(() =>
      expect(bottle.compasLaunchBottleAction).toHaveBeenCalledWith(
        expect.objectContaining({ tripId: TRIP, mixite: 'women_only', minTrust: 60, isAdult: true })
      )
    );
    expect(within(sheet).queryByRole('link', { name: /bouteille/i })).toBeNull();
  });

  it('Nous : budget réel, aucune enveloppe inventée, l’équipe la fixe', async () => {
    render(<CompasScreen data={makeData({ trip: { ...baseTrip, estimatedBudget: null } })} />);
    fireEvent.click(within(stepsNav()).getByRole('button', { name: /Nous/ }));
    expect(screen.getByText('Aucune enveloppe fixée pour ce voyage.')).toBeTruthy();
    expect(screen.getByText(/Capacité de portage renseignée/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Détails : Nous' }));
    const sheet = await screen.findByRole('dialog', { name: 'Nous' });
    fireEvent.click(within(sheet).getByRole('button', { name: /Budget/ }));
    fireEvent.change(within(sheet).getByLabelText(/Enveloppe du voyage/), {
      target: { value: '1200' },
    });
    fireEvent.click(within(sheet).getByRole('button', { name: 'Enregistrer' }));
    await waitFor(() =>
      expect(compas.compasSetBudgetAction).toHaveBeenCalledWith({
        tripId: TRIP,
        tripSlug: 'trek-3-vallees',
        amount: 1200,
      })
    );
  });

  it('objet prêté : « Je l’ai récupéré » remet l’objet de l’inventaire en service', async () => {
    const INV = '77777777-7777-4777-8777-777777777777';
    const inventory = [
      {
        id: INV,
        name: 'Frontale',
        brand: 'Petzl',
        category: 'Électronique',
        weightG: 80,
        condition: 'bon',
        isLent: true,
        maintenanceDueAt: null,
        expiryDate: null,
        quantity: 1,
      },
    ];
    const data = makeData({
      items: [item({ id: SLEEP, name: 'Frontale', isVital: true, inventoryItemId: INV })],
      inventory,
    });
    render(<CompasScreen data={{ ...data, inventory }} />);
    fireEvent.click(screen.getByText('Récupérer : frontale'));
    const kitSheet = await screen.findByRole('dialog', { name: 'Kit' });
    fireEvent.click(within(kitSheet).getByText('Frontale'));
    const sheet = await screen.findByRole('dialog', { name: 'Frontale' });
    fireEvent.click(within(sheet).getByRole('button', { name: /Je l’ai récupéré/ }));
    await waitFor(() =>
      expect(compas.compasMarkReturnedAction).toHaveBeenCalledWith({ inventoryItemId: INV })
    );
  });

  it('Personnaliser la carte : masquer le profil retire l’accessoire, le choix est retenu', () => {
    const { unmount } = render(<CompasScreen data={makeData()} />);
    expect(screen.getByText(/^D\+ /)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Personnaliser la carte' }));
    const panel = screen.getByRole('dialog', { name: 'Personnaliser la carte' });
    const profil = within(panel).getByRole('switch', { name: /Profil/ });
    expect(profil.getAttribute('aria-checked')).toBe('true');
    fireEvent.click(profil);
    expect(screen.queryByText(/^D\+ /)).toBeNull();
    // Aucun point d'eau sur ce voyage : le calque est grisé, pas inventé.
    expect((within(panel).getByRole('switch', { name: /Eau/ }) as HTMLButtonElement).disabled).toBe(
      true
    );
    unmount();
    render(<CompasScreen data={makeData()} />);
    expect(screen.queryByText(/^D\+ /)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Personnaliser la carte' }));
    fireEvent.click(screen.getByRole('button', { name: 'Tout afficher' }));
    expect(screen.getByText(/^D\+ /)).toBeTruthy();
  });

  it('agrandir la carte réduit le haut à une carte-titre', () => {
    const { container } = render(<CompasScreen data={makeData()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Agrandir la carte' }));
    expect(container.querySelector('.compas')?.getAttribute('data-map')).toBe('big');
    fireEvent.click(screen.getAllByRole('button', { name: 'Réduire la carte' })[0]);
    expect(container.querySelector('.compas')?.getAttribute('data-map')).toBeNull();
  });

  it('Résa : six catégories, Vols cherche en direct (RouteStack), Extras liste les offres', async () => {
    const data = makeData();
    data.affiliateLinks = [
      { id: 'a2', label: 'Assurance', category: 'insurance', partner: 'Heymondo', url: '/go/ass' },
    ];
    render(<CompasScreen data={data} />);
    fireEvent.click(within(stepsNav()).getByRole('button', { name: /Résa/ }));
    for (const name of ['Randonnées', 'Activités', 'Hébergement', 'Vols', 'Transports', 'Extras'])
      expect(screen.getByRole('button', { name: new RegExp(`^${name}`) })).toBeTruthy();
    expect((screen.getByRole('button', { name: /^Activités/ }) as HTMLButtonElement).disabled).toBe(
      false
    );
    fireEvent.click(screen.getByRole('button', { name: 'Vols' }));
    const sheet = await screen.findByRole('dialog', { name: 'Mes réservations' });
    const form = within(sheet).getByRole('form', { name: 'Chercher : vols' });
    fireEvent.change(within(form).getByLabelText('Départ de'), { target: { value: 'Lyon' } });
    fireEvent.click(within(form).getByRole('button', { name: /Chercher en direct/ }));
    await waitFor(() =>
      expect(resa.compasSearchOffersAction).toHaveBeenCalledWith(
        expect.objectContaining({ tripId: TRIP, vertical: 'flight', from: 'Lyon' })
      )
    );
    expect(await within(sheet).findByText('Lyon → Pau')).toBeTruthy();
    expect(within(sheet).getByText(/Mode test du partenaire/)).toBeTruthy();
    expect(within(sheet).queryByText('Assurance')).toBeNull();
    const cats = within(sheet).getByRole('group', { name: 'Catégorie' });
    fireEvent.click(within(cats).getByText('Extras'));
    expect(within(sheet).getByText('Assurance')).toBeTruthy();
  });

  it('Résa : partenaire non activé, des exemples étiquetés et aucun lien', async () => {
    resa.compasSearchOffersAction.mockResolvedValueOnce({
      success: false,
      unavailable: true,
      error: 'Partenaire non activé pour cette catégorie : recherche en direct indisponible.',
    } as never);
    render(<CompasScreen data={makeData()} />);
    fireEvent.click(within(stepsNav()).getByRole('button', { name: /Résa/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Activités' }));
    const sheet = await screen.findByRole('dialog', { name: 'Mes réservations' });
    fireEvent.click(within(sheet).getByRole('button', { name: /Chercher en direct/ }));
    expect(await within(sheet).findByText(/Partenaire non activé/)).toBeTruthy();
    expect(within(sheet).getAllByText('Exemple').length).toBeGreaterThan(0);
    expect(within(sheet).queryAllByRole('link')).toHaveLength(0);
  });

  it('nuits : noter un hébergement écrit sans rien réserver, liens affiliés balisés', async () => {
    const data = makeData();
    data.affiliateLinks = [
      {
        id: 'a1',
        label: 'Gîte du col',
        category: 'Hébergement',
        partner: 'Gîtes',
        url: '/go/gite',
      },
    ];
    render(<CompasScreen data={data} />);
    fireEvent.click(within(stepsNav()).getByRole('button', { name: /Résa/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Détails : Mes réservations' }));
    const sheet = await screen.findByRole('dialog', { name: 'Mes réservations' });
    fireEvent.click(
      within(within(sheet).getByRole('group', { name: 'Parcours du tiroir' })).getByRole('button', {
        name: /Nuits/,
      })
    );
    const input = within(sheet).getByLabelText('Hébergement de la nuit du jour 1');
    fireEvent.change(input, { target: { value: 'Gîte du col' } });
    fireEvent.click(within(sheet).getAllByRole('button', { name: 'OK' })[0]);
    await waitFor(() =>
      expect(compas.compasSetStayAction).toHaveBeenCalledWith({
        tripId: TRIP,
        tripSlug: 'trek-3-vallees',
        day: 1,
        name: 'Gîte du col',
      })
    );
    const link = within(sheet).getByRole('link', { name: /Gîte du col/ });
    expect(link.getAttribute('rel')).toContain('sponsored');
    expect(link.getAttribute('rel')).toContain('nofollow');
    expect(within(sheet).getByRole('note')).toBeTruthy();
  });

  it('mes kits : liste les décomptes et applique sans rien retirer', async () => {
    render(<CompasScreen data={makeData()} />);
    fireEvent.click(within(stepsNav()).getByRole('button', { name: /Kit/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Détails : Kit' }));
    const sheet = await screen.findByRole('dialog', { name: 'Kit' });
    fireEvent.click(within(sheet).getByRole('button', { name: /Mes kits/ }));
    expect(await within(sheet).findByText(/Automne alpin/)).toBeTruthy();
    expect(within(sheet).getByText(/2 à ajouter/)).toBeTruthy();
    fireEvent.click(within(sheet).getByRole('button', { name: 'Appliquer' }));
    await waitFor(() =>
      expect(compas.compasApplyKitAction).toHaveBeenCalledWith({
        tripId: TRIP,
        tripSlug: 'trek-3-vallees',
        kitId: '8d9c1a52-0000-4000-8000-000000000001',
      })
    );
  });

  it('mes kits : « Créer mon kit » enregistre le kit du voyage et relit la liste', async () => {
    render(<CompasScreen data={makeData()} />);
    fireEvent.click(within(stepsNav()).getByRole('button', { name: /Kit/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Détails : Kit' }));
    const sheet = await screen.findByRole('dialog', { name: 'Kit' });
    fireEvent.click(within(sheet).getByRole('button', { name: /Mes kits/ }));
    fireEvent.click(await within(sheet).findByRole('button', { name: /Créer mon kit/ }));
    const form = within(sheet).getByRole('form', { name: 'Créer mon kit' });
    fireEvent.change(within(form).getByLabelText('Nom'), { target: { value: 'Mon kit GR' } });
    fireEvent.change(within(form).getByLabelText('Saison'), { target: { value: 'automne' } });
    const before = compas.compasListMyKitsAction.mock.calls.length;
    fireEvent.click(within(form).getByRole('button', { name: 'Créer le kit' }));
    await waitFor(() =>
      expect(compas.compasCreateKitFromTripAction).toHaveBeenCalledWith({
        tripId: TRIP,
        tripSlug: 'trek-3-vallees',
        name: 'Mon kit GR',
        season: 'automne',
      })
    );
    await waitFor(() =>
      expect(compas.compasListMyKitsAction.mock.calls.length).toBeGreaterThan(before)
    );
  });

  it('sur le tracé : liste les points OSM, filtre par catégorie, cite la source', async () => {
    const data = makeData();
    data.routePois = [
      { id: 1, name: null, category: 'water', lat: 42.7, lon: 0, distanceM: 80, elevationM: 1850 },
      {
        id: 2,
        name: 'Refuge des Oulettes',
        category: 'refuge',
        lat: 42.7,
        lon: 0.01,
        distanceM: 300,
        elevationM: null,
      },
    ];
    render(<CompasScreen data={data} />);
    fireEvent.click(within(stepsNav()).getByRole('button', { name: /Où/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Détails : Préparer' }));
    const sheet = await screen.findByRole('dialog', { name: 'Préparer' });
    fireEvent.click(within(sheet).getByRole('button', { name: /Sur le tracé/ }));
    expect(within(sheet).getByText('Refuge des Oulettes')).toBeTruthy();
    expect(within(sheet).getByText('Point d’eau')).toBeTruthy();
    fireEvent.click(within(sheet).getByRole('button', { name: /Refuge ou abri \(1\)/ }));
    expect(within(sheet).queryByText('Point d’eau')).toBeNull();
    expect(within(sheet).getByText(/contributeurs OpenStreetMap/)).toBeTruthy();
  });

  it('tiroir : trois hauteurs (petit, moyen, grand) et fermeture en tirant la poignée', async () => {
    // jsdom n'a pas PointerEvent : sans lui, clientY est perdu.
    class TestPointerEvent extends MouseEvent {
      pointerId: number;
      constructor(type: string, init: MouseEventInit & { pointerId?: number } = {}) {
        super(type, init);
        this.pointerId = init.pointerId ?? 1;
      }
    }
    vi.stubGlobal('PointerEvent', TestPointerEvent);
    render(<CompasScreen data={makeData()} />);
    fireEvent.click(within(stepsNav()).getByRole('button', { name: /Nous/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Détails : Nous' }));
    const sheet = await screen.findByRole('dialog', { name: 'Nous' });
    const grab = () => within(sheet).getByRole('button', { name: /(Agrandir|Réduire) le tiroir/ });
    const pull = (dy: number) => {
      fireEvent.pointerDown(grab(), { clientY: 300, pointerId: 1 });
      fireEvent.pointerMove(grab(), { clientY: 300 + dy, pointerId: 1 });
      fireEvent.pointerUp(grab(), { clientY: 300 + dy, pointerId: 1 });
    };
    const detent = () => sheet.getAttribute('data-detent');
    // Ramène à « moyen » si le contenu avait agrandi le tiroir, puis descend en « petit ».
    if (detent() === 'large') pull(60);
    expect(detent()).toBe('medium');
    pull(60);
    expect(detent()).toBe('small');
    pull(-60);
    expect(detent()).toBe('medium');
    pull(-60);
    expect(detent()).toBe('large');
    pull(60);
    pull(60);
    expect(detent()).toBe('small');
    pull(60);
    expect(screen.queryByRole('dialog', { name: 'Nous' })).toBeNull();
  });

  it('nuits : recherche en direct (mode test signalé), noter une offre sans rien réserver', async () => {
    const data = makeData();
    data.providers = { routestack: 'sandbox', viator: 'disabled' };
    render(<CompasScreen data={data} />);
    fireEvent.click(within(stepsNav()).getByRole('button', { name: /Résa/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Détails : Mes réservations' }));
    const sheet = await screen.findByRole('dialog', { name: 'Mes réservations' });
    fireEvent.click(
      within(within(sheet).getByRole('group', { name: 'Parcours du tiroir' })).getByRole('button', {
        name: /Nuits/,
      })
    );
    fireEvent.click(within(sheet).getByRole('button', { name: 'Chercher' }));
    await waitFor(() =>
      expect(compas.compasSearchStaysAction).toHaveBeenCalledWith({ tripId: TRIP, day: 1 })
    );
    expect(await within(sheet).findByText('Gîte des Cimes')).toBeTruthy();
    expect(within(sheet).getByText(/Mode test/)).toBeTruthy();
    expect(within(sheet).getByText('Prix non confirmé par le fournisseur')).toBeTruthy();
    const link = within(sheet).getByRole('link', { name: 'Voir l’offre' });
    expect(link.getAttribute('rel')).toContain('sponsored');
    fireEvent.click(within(sheet).getAllByRole('button', { name: 'Noter' })[0]);
    await waitFor(() =>
      expect(compas.compasSetStayAction).toHaveBeenCalledWith({
        tripId: TRIP,
        tripSlug: 'trek-3-vallees',
        day: 1,
        name: 'Gîte des Cimes',
      })
    );
  });

  const openOu = async (flow: RegExp) => {
    fireEvent.click(within(stepsNav()).getByRole('button', { name: /Où/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Détails : Préparer' }));
    const sheet = await screen.findByRole('dialog', { name: 'Préparer' });
    fireEvent.click(within(sheet).getByRole('button', { name: flow }));
    return sheet;
  };

  it('règle de durée : glisser propose, ✓ écrit les dates et redécoupe le parcours', async () => {
    render(<CompasScreen data={makeData()} />);
    fireEvent.click(within(stepsNav()).getByRole('button', { name: /Où/ }));
    const ruler = screen.getByRole('slider', { name: 'Durée de la sortie' });
    expect(ruler.getAttribute('aria-valuetext')).toBe('4 j');
    fireEvent.keyDown(ruler, { key: 'ArrowRight' });
    expect(compas.compasSetDatesAction).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Appliquer : 5 j' }));
    await waitFor(() =>
      expect(compas.compasSetDatesAction).toHaveBeenCalledWith({
        tripId: TRIP,
        tripSlug: 'trek-3-vallees',
        startDate: '2026-10-12',
        endDate: '2026-10-16',
        durationHours: null,
        resplit: true,
      })
    );
    expect(await screen.findByText('Durée : 5 j · parcours redécoupé')).toBeTruthy();
  });

  it('Quand : toucher un jour du calendrier fixe le départ et l’enregistre aussitôt', async () => {
    const calendar = Array.from({ length: 14 }, (_, i) => {
      const date = `2026-10-${String(10 + i).padStart(2, '0')}`;
      return {
        date,
        kind: 'prevision' as const,
        quality: i === 6 ? ('moyen' as const) : ('bon' as const),
        reasons: [],
        tMin: 4,
        tMax: 14,
      };
    });
    const data = makeData();
    data.weather = { source: 'MET Norway', trendSource: 'NASA POWER', horizon: '2026-10-23', tripDays: [], calendar };
    render(<CompasScreen data={data} />);
    const sheet = await openOu(/Quand/);
    expect(within(sheet).getAllByText(/12 oct\.? → \S+ 15 oct/).length).toBeGreaterThan(0);
    fireEvent.click(within(sheet).getByRole('button', { name: /14 oct\.? :/ }));
    await waitFor(() =>
      expect(compas.compasSetDatesAction).toHaveBeenCalledWith(
        expect.objectContaining({ startDate: '2026-10-14', endDate: '2026-10-17' })
      )
    );
    expect(
      await screen.findByText(/^Quand : \S+ 14 oct\.? → \S+ 17 oct\.? · conditions moyennes/)
    ).toBeTruthy();
  });

  it('Parcours : chercher un lieu, voir la communauté, choisir découpé sur les dates', async () => {
    compas.compasSearchRoutesAction.mockResolvedValueOnce({
      success: true,
      routes: [
        {
          routeId: 812,
          name: 'GR 10 · Gavarnie',
          region: 'Hautes-Pyrénées',
          distanceKm: 41.2,
          elevationGainM: 2100,
          durationHours: 14,
          difficulty: 'difficile',
          distanceFromKm: 3,
          communitySessions: 7,
          mine: null,
        },
      ],
    });
    render(<CompasScreen data={makeData()} />);
    const sheet = await openOu(/Parcours/);
    fireEvent.change(within(sheet).getByRole('searchbox'), { target: { value: 'Gavarnie' } });
    fireEvent.click(within(sheet).getByRole('button', { name: 'Chercher' }));
    await waitFor(() =>
      expect(compas.compasSearchRoutesAction).toHaveBeenCalledWith({
        lat: 42.73,
        lon: -0.01,
        query: 'Gavarnie',
      })
    );
    // Activité partenaire (guidée) dans la même liste, badge discret, lien sponsorisé.
    const partner = await within(sheet).findByRole('link', { name: /Cirque de Gavarnie avec un guide/ });
    expect(partner.getAttribute('rel')).toContain('sponsored');
    expect(within(partner).getByText('Partenaire')).toBeTruthy();
    expect(resa.compasNearbyActivitiesAction).toHaveBeenLastCalledWith({ tripId: TRIP, place: 'Gavarnie' });
    fireEvent.click(await within(sheet).findByRole('button', { name: /GR 10 · Gavarnie/ }));
    expect(within(sheet).getByText('7 sorties publiques')).toBeTruthy();
    fireEvent.click(within(sheet).getByRole('button', { name: /Choisir ce parcours/ }));
    await waitFor(() =>
      expect(compas.compasApplyRouteAction).toHaveBeenCalledWith({
        tripId: TRIP,
        tripSlug: 'trek-3-vallees',
        routeId: 812,
        days: 4,
      })
    );
  });

  it('Préférences : choisir le bivouac enregistre les préférences complètes', async () => {
    render(<CompasScreen data={makeData()} />);
    const sheet = await openOu(/Préférences/);
    fireEvent.click(within(sheet).getByRole('button', { name: /Bivouac/ }));
    await waitFor(() =>
      expect(compas.compasSetPreferencesAction).toHaveBeenCalledWith({
        tripId: TRIP,
        tripSlug: 'trek-3-vallees',
        preferences: { pace: 'normal', nights: 'bivouac', avoid: [], wishes: [] },
      })
    );
  });

  it('Annuler : l’annonce rétablit les préférences d’avant, Ctrl+Z aussi', async () => {
    render(<CompasScreen data={makeData()} />);
    const sheet = await openOu(/Préférences/);
    const before = { pace: 'normal', nights: null, avoid: [], wishes: [] };
    fireEvent.click(within(sheet).getByRole('button', { name: /Bivouac/ }));
    const undo = await screen.findByRole('button', { name: 'Annuler' });
    fireEvent.click(undo);
    await waitFor(() =>
      expect(compas.compasSetPreferencesAction).toHaveBeenLastCalledWith({
        tripId: TRIP,
        tripSlug: 'trek-3-vallees',
        preferences: before,
      })
    );
    expect(await screen.findByText(/^Annulé :/)).toBeTruthy();
    // L'annulation elle-même ne s'annule pas.
    expect(screen.queryByRole('button', { name: 'Annuler' })).toBeNull();

    fireEvent.click(within(sheet).getByRole('button', { name: /Bivouac/ }));
    await screen.findByRole('button', { name: 'Annuler' });
    const calls = compas.compasSetPreferencesAction.mock.calls.length;
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
    await waitFor(() =>
      expect(compas.compasSetPreferencesAction.mock.calls.length).toBe(calls + 1)
    );
    expect(compas.compasSetPreferencesAction).toHaveBeenLastCalledWith(
      expect.objectContaining({ preferences: before })
    );
  });

  it('Annuler : deux doigts glissés vers la gauche rétablissent aussi', async () => {
    render(<CompasScreen data={makeData()} />);
    const sheet = await openOu(/Préférences/);
    fireEvent.click(within(sheet).getByRole('button', { name: /Bivouac/ }));
    await screen.findByRole('button', { name: 'Annuler' });
    const calls = compas.compasSetPreferencesAction.mock.calls.length;
    const touches = (x: number) => [
      { clientX: x, clientY: 300, identifier: 1 },
      { clientX: x + 40, clientY: 300, identifier: 2 },
    ];
    fireEvent.touchStart(window, { touches: touches(300) });
    fireEvent.touchMove(window, { touches: touches(200) });
    fireEvent.touchEnd(window, { touches: [] });
    await waitFor(() =>
      expect(compas.compasSetPreferencesAction.mock.calls.length).toBe(calls + 1)
    );
    expect(compas.compasSetPreferencesAction).toHaveBeenLastCalledWith(
      expect.objectContaining({
        preferences: { pace: 'normal', nights: null, avoid: [], wishes: [] },
      })
    );
  });

  it('capsule d’étapes : la lentille suit le doigt, l’étape sous elle est choisie', () => {
    render(<CompasScreen data={makeData()} />);
    const nav = stepsNav();
    nav.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: 390, height: 50, right: 390, bottom: 50, x: 0, y: 0 }) as DOMRect;
    fireEvent.click(within(nav).getByRole('button', { name: /Où/ }));
    expect(within(nav).getByRole('button', { name: /Où/ }).getAttribute('aria-current')).toBe(
      'step'
    );
    fireEvent.pointerDown(nav, { clientX: 20, pointerType: 'touch' });
    fireEvent.pointerMove(nav, { clientX: 200, pointerType: 'touch' });
    expect(nav.hasAttribute('data-drag')).toBe(true);
    fireEvent.pointerMove(nav, { clientX: 250, pointerType: 'touch' });
    fireEvent.pointerUp(nav, { clientX: 250, pointerType: 'touch' });
    // Le clic qui suit le relâchement est absorbé.
    fireEvent.click(within(nav).getByRole('button', { name: /Résa/ }));
    expect(
      within(nav)
        .getByRole('button', { name: /Verdict/ })
        .getAttribute('aria-current')
    ).toBe('step');
    expect(nav.hasAttribute('data-drag')).toBe(false);
  });

  it('Phrase de départ gardée sur le voyage : appliquée à l’ouverture, puis oubliée', async () => {
    compas.compasInterpretAction.mockResolvedValueOnce({
      success: true,
      usedAi: false,
      note: null,
      proposals: [
        {
          id: '0-set_party_size',
          action: { type: 'set_party_size', count: 4 },
          label: '4 personnes',
          ok: true,
          reason: null,
          source: 'regles',
        },
      ],
    });
    render(<CompasScreen data={{ ...makeData(), startSay: 'rando à 4' }} />);
    await waitFor(() =>
      expect(compas.compasInterpretAction).toHaveBeenCalledWith({ tripId: TRIP, text: 'rando à 4' })
    );
    await waitFor(() =>
      expect(compas.compasSetPartySizeAction).toHaveBeenCalledWith({
        tripId: TRIP,
        tripSlug: 'trek-3-vallees',
        partySize: 4,
      })
    );
    await waitFor(() => expect(compas.compasClearStartSayAction).toHaveBeenCalledWith({ tripId: TRIP }));
  });

  it('Phrase de départ : l’écriture échoue, elle reste sur le voyage pour la prochaine visite', async () => {
    compas.compasInterpretAction.mockResolvedValueOnce({
      success: true,
      usedAi: false,
      note: null,
      proposals: [
        {
          id: '0-set_party_size',
          action: { type: 'set_party_size', count: 4 },
          label: '4 personnes',
          ok: true,
          reason: null,
          source: 'regles',
        },
      ],
    });
    compas.compasSetPartySizeAction.mockResolvedValueOnce({ success: false, error: 'Connexion perdue' });
    render(<CompasScreen data={{ ...makeData(), startSay: 'rando à 4' }} />);
    await waitFor(() => expect(compas.compasSetPartySizeAction).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 50));
    expect(compas.compasClearStartSayAction).not.toHaveBeenCalled();
  });

  it('Dis-le : les propositions refusées ne s’appliquent pas, les autres oui', async () => {
    compas.compasInterpretAction.mockResolvedValueOnce({
      success: true,
      usedAi: true,
      note: null,
      proposals: [
        {
          id: '0-set_party_size',
          action: { type: 'set_party_size', count: 4 },
          label: '4 personnes',
          ok: true,
          reason: null,
          source: 'ia',
        },
        {
          id: '1-set_pace',
          action: { type: 'set_pace', pace: 'tranquille' },
          label: 'Rythme tranquille',
          ok: true,
          reason: null,
          source: 'regles',
        },
        {
          id: '2-set_budget',
          action: { type: 'set_budget', amount: 50 },
          label: 'Enveloppe : 50 €',
          ok: false,
          reason: 'Sous les 240 € déjà engagés',
          source: 'regles',
        },
      ],
    });
    render(<CompasScreen data={makeData()} />);
    const sheet = await openOu(/Quand/);
    fireEvent.change(within(sheet).getByLabelText('Dis-le'), {
      target: { value: 'à 4, tranquille, 50 €' },
    });
    fireEvent.click(within(sheet).getByRole('button', { name: 'Comprendre la phrase' }));
    await waitFor(() =>
      expect(compas.compasInterpretAction).toHaveBeenCalledWith({
        tripId: TRIP,
        text: 'à 4, tranquille, 50 €',
      })
    );
    expect(await within(sheet).findByText('Sous les 240 € déjà engagés')).toBeTruthy();
    fireEvent.click(within(sheet).getByRole('button', { name: /Appliquer \(2\)/ }));
    await waitFor(() =>
      expect(compas.compasSetPartySizeAction).toHaveBeenCalledWith({
        tripId: TRIP,
        tripSlug: 'trek-3-vallees',
        partySize: 4,
      })
    );
    expect(compas.compasSetPreferencesAction).toHaveBeenCalledWith({
      tripId: TRIP,
      tripSlug: 'trek-3-vallees',
      preferences: { pace: 'tranquille', nights: null, avoid: [], wishes: [] },
    });
    expect(compas.compasSetBudgetAction).not.toHaveBeenCalled();
  });
});
