// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { STEP_FLOWS } from '../components/compasTypes';
import { aiSuggestion } from '../engine/advice';
import { AI_NOTICE_DONE, AI_NOTICE_RUN, AI_STEP_LABEL } from '../engine/aiNotice';
import { buildCompasModel, type CompasInput, type CompasItemInput } from '../engine/compasModel';
import { assessDanger, mergeDangerIntoVerdict, type OfficialAlert } from '../engine/danger';
import { METEOALARM_DISCLAIMER, METEOALARM_HOME } from '../engine/meteoalarmFeeds';
import { resolveProjectContext } from '../engine/projectContext';
import { daylightClock } from '../engine/sun';
import type { CompasData } from '../server/getCompasData';

/* Frontières réseau et navigateur uniquement : l'écran, les cartes, les
   tiroirs et le moteur sont les vrais. */
const refresh = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh, push: vi.fn() }),
  usePathname: () => '/compas',
}));
vi.mock('next/dynamic', () => ({ default: () => () => <div data-testid="map" /> }));
// Fuseau du navigateur fixé : les appels comparés plus bas ne dépendent pas de la machine.
// Le jour du navigateur peut être fixé par un test (`browserDay.today`), sinon le vrai.
const browserDay = vi.hoisted(() => ({ today: null as string | null }));
vi.mock('../engine/zone', async (orig) => {
  const real = await orig<typeof import('../engine/zone')>();
  return {
    ...real,
    browserTimeZone: () => 'Europe/Paris',
    browserToday: (now?: Date) => browserDay.today ?? real.browserToday(now),
  };
});

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
  compasSetOriginAction: vi.fn(async () => ({ success: true }) as { success: boolean; error?: string }),
}));
vi.mock('../server/compasActions', () => compas);
const poi = vi.hoisted(() => ({
  compasStagePoisAction: vi.fn(async () => ({ success: true, pois: [] as unknown[] })),
}));
vi.mock('../server/poiActions', () => poi);
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
  compasAutofillAction: vi.fn(async (_input?: unknown) => ({
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
  compasAutofillStopAction: vi.fn(async () => ({ success: true })),
  compasRefreshAutofillAction: vi.fn(async () => ({ success: true, parts: [] as string[], label: '', kept: 0 })),
  // Lancement immédiat, issue relue ensuite (comme en production, sans requête longue).
  compasAutofillStartAction: vi.fn(async (input: unknown) => {
    const token = `t${++outcomes.n}`;
    outcomes.byToken.set(token, autofill.compasAutofillAction(input as never));
    return { success: true, token, at: Date.now() };
  }),
  compasAutofillOutcomeAction: vi.fn(async ({ token }: { token: string }) => {
    const res = await outcomes.byToken.get(token);
    return { outcome: res ? { ...res, token, at: Date.now() } : null, stamp: 'fin' };
  }),
}));
const outcomes = vi.hoisted(() => ({ n: 0, byToken: new Map<string, Promise<unknown>>() }));
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
    aiOn: true,
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
  browserDay.today = null;
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

  it('Préremplissage : lieu et dates connus → écrit une fois, en une passe, annonce le total, annulable', async () => {
    render(<CompasScreen data={{ ...makeData(), autofill: 'none' }} />);
    expect(await screen.findByText('Je prépare ton aventure…')).toBeTruthy();
    // Une seule passe côté serveur (jusqu'à 300 s).
    await waitFor(() =>
      expect(autofill.compasAutofillAction).toHaveBeenCalledWith({
        tripId: TRIP,
        tripSlug: 'trek-3-vallees',
        from: null,
        phase: 'all',
        timeZone: 'Europe/Paris',
      })
    );
    expect(await screen.findByText(/Aventure préparée · 486/)).toBeTruthy();
    expect(screen.getByText('1 refuge, 1 bivouac · 412 km de route · 4 objets au kit')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Annuler' }));
    await waitFor(() =>
      expect(autofill.compasUndoAutofillAction).toHaveBeenCalledWith({ tripId: TRIP, tripSlug: 'trek-3-vallees' })
    );
    expect(autofill.compasAutofillAction).toHaveBeenCalledTimes(1);
  });

  describe('Préremplissage d’une demande qui ne dit qu’un départ', () => {
    /** « rando 3 jours depuis Lyon » appliquée depuis le tiroir : ni lieu, ni étape, ni dates, trois jours prévus. */
    const onlyOrigin = (originSaid: CompasData['originSaid']): CompasData => ({
      ...makeData({ trip: { ...baseTrip, destinationName: null, startDate: null, endDate: null }, steps: [] }),
      autofill: 'none',
      origin: null,
      itinerary: [],
      plannedDays: 3,
      originSaid,
    });

    it('le départ dit suffit à lancer la préparation autour de lui', async () => {
      render(<CompasScreen data={onlyOrigin({ name: 'Lyon', lat: 45.76, lon: 4.83, countryCode: 'FR' })} />);
      await waitFor(() => expect(autofill.compasAutofillAction).toHaveBeenCalledTimes(1));
    });

    it('sans départ dit ni lieu ni préparation en cours, rien ne part tout seul', async () => {
      render(<CompasScreen data={onlyOrigin(null)} />);
      await new Promise((r) => setTimeout(r, 50));
      expect(autofill.compasAutofillAction).not.toHaveBeenCalled();
    });
  });

  it('Préremplissage sans point de départ : le trajet est dit non chiffré', async () => {
    autofill.compasAutofillAction.mockImplementationOnce(async () => ({
      success: true,
      summary: {
        nights: [
          { night: 1, type: 'refuge', place: 'Refuge des Oulettes', reason: 'ton profil : confort' },
          { night: 2, type: 'bivouac', place: null, reason: 'ta préférence' },
        ],
        transport: null,
        originUnknown: true,
        kit: { inventaire: 2, pret: 0, location: 0, achat: 1, a_trouver: 1 },
        budget: [],
        total: 486,
        notes: [],
        usedAi: true,
        stepsCreated: 0,
      },
    }) as never);
    render(<CompasScreen data={{ ...makeData(), autofill: 'none' }} />);
    expect(
      await screen.findByText('1 refuge, 1 bivouac · Trajet non chiffré : point de départ inconnu · 4 objets au kit')
    ).toBeTruthy();
  });

  it('Préremplissage : le vol dit d’où il part et entre quels aéroports', async () => {
    autofill.compasAutofillAction.mockImplementationOnce(async () => ({
      success: true,
      summary: {
        nights: [{ night: 1, type: 'bivouac', place: null, reason: 'ta préférence' }],
        transport: {
          mode: 'avion',
          km: 790,
          minutes: 0,
          walkKm: 0,
          fuelEur: 0,
          basis: 'vol aller-retour depuis ta position, LYS → CAG',
          route: 'LYS → CAG',
          departure: 'ta position',
        },
        kit: { inventaire: 1, pret: 0, location: 0, achat: 0, a_trouver: 0 },
        budget: [],
        total: 486,
        notes: [],
        usedAi: true,
        stepsCreated: 0,
      },
    }) as never);
    render(<CompasScreen data={{ ...makeData(), autofill: 'none' }} />);
    expect(
      await screen.findByText('1 bivouac · vol LYS → CAG à prévoir (depuis ta position) · 1 objet au kit')
    ).toBeTruthy();
  });

  it('Préremplissage : limite de fréquence → annoncé, relancé seul à la fin de la fenêtre', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      autofill.compasAutofillAction.mockImplementationOnce(
        async () =>
          ({ success: false, error: 'Beaucoup de préparations d’affilée : je reprends seul dans 2 min.', retryInS: 90 }) as never
      );
      render(<CompasScreen data={{ ...makeData(), autofill: 'none' }} />);
      expect(await screen.findByText(/je reprends seul dans 2 min/)).toBeTruthy();
      expect(autofill.compasAutofillAction).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(93_000);
      await waitFor(() => expect(autofill.compasAutofillAction).toHaveBeenCalledTimes(2));
      expect(await screen.findByText(/Aventure préparée/)).toBeTruthy();
    } finally {
      vi.useRealTimers();
    }
  });

  it('Préremplissage : « Arrêter » prévient le serveur et la relance prévue ne part pas', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      autofill.compasAutofillAction.mockImplementationOnce(
        async () =>
          ({ success: false, error: 'Beaucoup de préparations d’affilée : je reprends seul dans 2 min.', retryInS: 90 }) as never
      );
      // Depuis la demande (« Où ») : le panneau de préparation et son bouton « Arrêter ».
      render(<CompasScreen data={{ ...makeData(), autofill: 'none', startSay: 'rando à 4' }} />);
      const panel = await screen.findByRole('status', { name: 'Préparation de l’aventure' });
      await waitFor(() => expect(within(panel).getByText(/je reprends seul dans 2 min/)).toBeTruthy());
      fireEvent.click(within(panel).getByRole('button', { name: 'Arrêter' }));
      await waitFor(() => expect(autofill.compasAutofillStopAction).toHaveBeenCalledWith({ tripId: TRIP }));
      await vi.advanceTimersByTimeAsync(93_000);
      expect(autofill.compasAutofillAction).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  // Quitter l'écran annule aussi les relances programmées (reprise après coupure, limite de fréquence,
  // relectures différées) : une relance armée relançait la préparation, ou relisait la page, pour un
  // écran qui n'existe plus (relecture de la PR #91).
  describe('Préremplissage : quitter l’écran annule les relances programmées', () => {
    it('limite de fréquence : la relance prévue ne part pas après le démontage (et part si l’écran reste)', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      try {
        const limited = async () =>
          ({ success: false, error: 'Beaucoup de préparations d’affilée : je reprends seul dans 2 min.', retryInS: 90 }) as never;
        // Témoin : l'écran reste, la relance part.
        autofill.compasAutofillAction.mockImplementationOnce(limited);
        const stays = render(<CompasScreen data={{ ...makeData(), autofill: 'none' }} />);
        expect(await screen.findByText(/je reprends seul dans 2 min/)).toBeTruthy();
        await vi.advanceTimersByTimeAsync(93_000);
        await waitFor(() => expect(autofill.compasAutofillAction).toHaveBeenCalledTimes(2));
        stays.unmount();
        // Même cas, mais l'écran est quitté avant la fin de l'attente.
        autofill.compasAutofillAction.mockClear();
        autofill.compasAutofillAction.mockImplementationOnce(limited);
        const leaves = render(<CompasScreen data={{ ...makeData(), autofill: 'none' }} />);
        expect(await screen.findByText(/je reprends seul dans 2 min/)).toBeTruthy();
        expect(autofill.compasAutofillAction).toHaveBeenCalledTimes(1);
        await vi.advanceTimersByTimeAsync(10_000);
        leaves.unmount();
        await vi.advanceTimersByTimeAsync(120_000);
        expect(autofill.compasAutofillAction).toHaveBeenCalledTimes(1);
      } finally {
        vi.useRealTimers();
      }
    });

    it('coupure du réseau : la reprise à 66 s ne part pas après le démontage (et part si l’écran reste)', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      try {
        // Témoin : l'écran reste, la préparation reprend une fois.
        autofill.compasAutofillStartAction.mockRejectedValueOnce(new Error('réseau coupé'));
        const stays = render(<CompasScreen data={{ ...makeData(), autofill: 'none' }} />);
        expect(await screen.findByText(/je reprends dans une minute/)).toBeTruthy();
        expect(autofill.compasAutofillStartAction).toHaveBeenCalledTimes(1);
        await vi.advanceTimersByTimeAsync(67_000);
        await waitFor(() => expect(autofill.compasAutofillStartAction).toHaveBeenCalledTimes(2));
        stays.unmount();
        // Même coupure, mais l'écran est quitté pendant l'attente.
        autofill.compasAutofillStartAction.mockClear();
        autofill.compasAutofillStartAction.mockRejectedValueOnce(new Error('réseau coupé'));
        const leaves = render(<CompasScreen data={{ ...makeData(), autofill: 'none' }} />);
        expect(await screen.findByText(/je reprends dans une minute/)).toBeTruthy();
        await vi.advanceTimersByTimeAsync(20_000);
        leaves.unmount();
        await vi.advanceTimersByTimeAsync(120_000);
        expect(autofill.compasAutofillStartAction).toHaveBeenCalledTimes(1);
      } finally {
        vi.useRealTimers();
      }
    });

    it('une réponse qui arrive après le démontage n’arme plus de relance', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      try {
        let fail: (e: Error) => void = () => undefined;
        autofill.compasAutofillStartAction.mockImplementationOnce(
          () => new Promise((_resolve, reject) => (fail = reject)) as never
        );
        const view = render(<CompasScreen data={{ ...makeData(), autofill: 'none' }} />);
        await waitFor(() => expect(autofill.compasAutofillStartAction).toHaveBeenCalledTimes(1));
        view.unmount();
        fail(new Error('réseau coupé'));
        await vi.advanceTimersByTimeAsync(120_000);
        expect(autofill.compasAutofillStartAction).toHaveBeenCalledTimes(1);
      } finally {
        vi.useRealTimers();
      }
    });

    it('autre préparation en cours : les relectures à 20, 45 et 90 s s’arrêtent avec l’écran (et ont lieu s’il reste)', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      try {
        const elsewhere = async () => ({ success: true }) as never;
        // Témoin : l'écran reste, la page est relue aux trois échéances.
        autofill.compasAutofillAction.mockImplementationOnce(elsewhere);
        const stays = render(<CompasScreen data={{ ...makeData(), autofill: 'none' }} />);
        await waitFor(() => expect(autofill.compasAutofillAction).toHaveBeenCalledTimes(1));
        await vi.advanceTimersByTimeAsync(5_000);
        const armed = refresh.mock.calls.length;
        await vi.advanceTimersByTimeAsync(100_000);
        expect(refresh.mock.calls.length - armed).toBeGreaterThanOrEqual(3);
        stays.unmount();
        // Même cas, mais l'écran est quitté après 5 s : aucune relecture ensuite.
        autofill.compasAutofillAction.mockClear();
        autofill.compasAutofillAction.mockImplementationOnce(elsewhere);
        const leaves = render(<CompasScreen data={{ ...makeData(), autofill: 'none' }} />);
        await waitFor(() => expect(autofill.compasAutofillAction).toHaveBeenCalledTimes(1));
        await vi.advanceTimersByTimeAsync(5_000);
        leaves.unmount();
        const left = refresh.mock.calls.length;
        await vi.advanceTimersByTimeAsync(120_000);
        expect(refresh.mock.calls.length).toBe(left);
      } finally {
        vi.useRealTimers();
      }
    });
  });

  it('Préremplissage : lancé puis issue relue, sans tenir de requête ouverte', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      // Deux relectures sans issue, sur un voyage qui n'a pas bougé entre elles.
      autofill.compasAutofillOutcomeAction
        .mockResolvedValueOnce({ outcome: null, stamp: 'v1' } as never)
        .mockResolvedValueOnce({ outcome: null, stamp: 'v1' } as never);
      render(<CompasScreen data={{ ...makeData(), autofill: 'none' }} />);
      await waitFor(() => expect(autofill.compasAutofillStartAction).toHaveBeenCalledTimes(1));
      const refreshesAtStart = refresh.mock.calls.length;
      // Toujours en cours : rien d'annoncé, ni succès ni échec.
      await vi.advanceTimersByTimeAsync(4_100);
      expect(screen.queryByText(/Aventure préparée|interrompue/)).toBeNull();
      // Plan 2.8 : la page n'est relue qu'une fois pour un voyage inchangé.
      expect(refresh.mock.calls.length - refreshesAtStart).toBeLessThanOrEqual(1);
      await vi.advanceTimersByTimeAsync(4_100);
      expect(await screen.findByText(/Aventure préparée · 486/)).toBeTruthy();
      expect(autofill.compasAutofillOutcomeAction.mock.calls.length).toBeGreaterThanOrEqual(3);
      expect(autofill.compasAutofillStartAction).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  // Plan 1.2 « Coût de calcul » : le suivi ralentit, se tait onglet caché ou hors ligne,
  // reprend à la reprise et s'arrête avec « Arrêter ».
  describe('Préremplissage : suivi économe', () => {
    const setTabVisible = (visible: boolean) => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (visible ? 'visible' : 'hidden') });
      document.dispatchEvent(new Event('visibilitychange'));
    };
    const setOnline = (online: boolean) => {
      Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => online });
      window.dispatchEvent(new Event(online ? 'online' : 'offline'));
    };
    const pending = { outcome: null, stamp: 'v1' };
    let original: ((...args: never[]) => unknown) | undefined;
    beforeEach(() => {
      original = autofill.compasAutofillOutcomeAction.getMockImplementation() as typeof original;
    });
    afterEach(() => {
      delete (document as unknown as Record<string, unknown>).visibilityState;
      delete (navigator as unknown as Record<string, unknown>).onLine;
      if (original) autofill.compasAutofillOutcomeAction.mockImplementation(original as never);
    });

    it('onglet caché : aucune relecture ; au retour, une relecture tout de suite et l’issue s’affiche', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      try {
        let answer: unknown = pending;
        autofill.compasAutofillOutcomeAction.mockImplementation((async () => answer) as never);
        render(<CompasScreen data={{ ...makeData(), autofill: 'none' }} />);
        await waitFor(() => expect(autofill.compasAutofillOutcomeAction).toHaveBeenCalledTimes(1));
        setTabVisible(false);
        await vi.advanceTimersByTimeAsync(120_000);
        expect(autofill.compasAutofillOutcomeAction).toHaveBeenCalledTimes(1);
        expect(screen.queryByText(/Aventure préparée/)).toBeNull();
        // Le serveur a fini pendant l'absence : la reprise le montre sans attendre le prochain rythme.
        const done = (await outcomes.byToken.get('t' + outcomes.n)) as Record<string, unknown>;
        answer = { outcome: { ...done, token: 't' + outcomes.n, at: Date.now() }, stamp: 'fin' };
        setTabVisible(true);
        expect(await screen.findByText(/Aventure préparée · 486/)).toBeTruthy();
        expect(autofill.compasAutofillOutcomeAction).toHaveBeenCalledTimes(2);
        // Fini : plus aucune relecture.
        await vi.advanceTimersByTimeAsync(120_000);
        expect(autofill.compasAutofillOutcomeAction).toHaveBeenCalledTimes(2);
      } finally {
        vi.useRealTimers();
      }
    });

    it('hors ligne : aucune relecture ; le réseau revient, la relecture reprend', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      try {
        autofill.compasAutofillOutcomeAction.mockImplementation((async () => pending) as never);
        render(<CompasScreen data={{ ...makeData(), autofill: 'none' }} />);
        await waitFor(() => expect(autofill.compasAutofillOutcomeAction).toHaveBeenCalledTimes(1));
        setOnline(false);
        await vi.advanceTimersByTimeAsync(90_000);
        expect(autofill.compasAutofillOutcomeAction).toHaveBeenCalledTimes(1);
        setOnline(true);
        await vi.advanceTimersByTimeAsync(50);
        expect(autofill.compasAutofillOutcomeAction).toHaveBeenCalledTimes(2);
      } finally {
        vi.useRealTimers();
      }
    });

    it('« Arrêter » hors ligne met fin au suivi : le retour du réseau ne relit plus rien', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      try {
        autofill.compasAutofillOutcomeAction.mockImplementation((async () => pending) as never);
        render(<CompasScreen data={{ ...makeData(), autofill: 'none', startSay: 'rando à 4' }} />);
        const panel = await screen.findByRole('status', { name: 'Préparation de l’aventure' });
        await waitFor(() => expect(autofill.compasAutofillOutcomeAction).toHaveBeenCalledTimes(1));
        setOnline(false);
        await vi.advanceTimersByTimeAsync(10_000);
        fireEvent.click(within(panel).getByRole('button', { name: 'Arrêter' }));
        await waitFor(() => expect(autofill.compasAutofillStopAction).toHaveBeenCalledWith({ tripId: TRIP }));
        setOnline(true);
        await vi.advanceTimersByTimeAsync(120_000);
        expect(autofill.compasAutofillOutcomeAction).toHaveBeenCalledTimes(1);
      } finally {
        vi.useRealTimers();
      }
    });

    it('quitter l’écran met fin au suivi : plus aucune relecture entre deux rythmes', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      try {
        autofill.compasAutofillOutcomeAction.mockImplementation((async () => pending) as never);
        const view = render(<CompasScreen data={{ ...makeData(), autofill: 'none' }} />);
        await waitFor(() => expect(autofill.compasAutofillOutcomeAction).toHaveBeenCalledTimes(1));
        await vi.advanceTimersByTimeAsync(3_500);
        expect(autofill.compasAutofillOutcomeAction).toHaveBeenCalledTimes(2);
        view.unmount();
        await vi.advanceTimersByTimeAsync(120_000);
        expect(autofill.compasAutofillOutcomeAction).toHaveBeenCalledTimes(2);
      } finally {
        vi.useRealTimers();
      }
    });

    it('quitter l’écran onglet caché ou hors ligne : le retour de l’onglet ou du réseau ne relit rien', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      try {
        autofill.compasAutofillOutcomeAction.mockImplementation((async () => pending) as never);
        const view = render(<CompasScreen data={{ ...makeData(), autofill: 'none' }} />);
        await waitFor(() => expect(autofill.compasAutofillOutcomeAction).toHaveBeenCalledTimes(1));
        setTabVisible(false);
        setOnline(false);
        await vi.advanceTimersByTimeAsync(10_000);
        view.unmount();
        setOnline(true);
        setTabVisible(true);
        await vi.advanceTimersByTimeAsync(120_000);
        expect(autofill.compasAutofillOutcomeAction).toHaveBeenCalledTimes(1);
      } finally {
        vi.useRealTimers();
      }
    });

    it('une préparation de 100 s coûte au plus 14 relectures (4 s fixes : 25)', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      try {
        autofill.compasAutofillOutcomeAction.mockImplementation((async () => pending) as never);
        render(<CompasScreen data={{ ...makeData(), autofill: 'none' }} />);
        await waitFor(() => expect(autofill.compasAutofillOutcomeAction).toHaveBeenCalledTimes(1));
        await vi.advanceTimersByTimeAsync(100_000);
        const calls = autofill.compasAutofillOutcomeAction.mock.calls.length;
        expect(calls).toBeGreaterThanOrEqual(8);
        expect(calls).toBeLessThanOrEqual(14);
      } finally {
        vi.useRealTimers();
      }
    });
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

  describe('Nous : le budget aussi dans la devise de la personne (PLAN-100 4.6)', () => {
    const chf = {
      targets: [{ currency: 'CHF', kinds: ['voyageur' as const] }],
      rates: {
        CHF: { base: 'EUR' as const, currency: 'CHF', rate: 0.93, date: '2026-10-09', source: 'Frankfurter (banques centrales)' },
      },
    };

    const spent = {
      id: 'e1',
      title: 'Refuge',
      amount: 400,
      category: 'hébergement',
      isPlanned: true,
      payerId: U1,
      splitType: 'equal',
    };
    const withBudget = (budgetFx: CompasData['budgetFx']) => ({ ...makeData({ expenses: [spent] }), budgetFx });

    it('la carte et le tiroir disent le montant converti avec son taux, sa date et sa source', async () => {
      render(<CompasScreen data={withBudget(chf)} />);
      fireEvent.click(within(stepsNav()).getByRole('button', { name: /Nous/ }));
      const card = screen.getByTestId('budget-also');
      expect(within(card).getByText(/Dans ta devise \(CHF\)/)).toBeTruthy();
      expect(card.textContent).toMatch(/prévus et dépensés ≈ 372\s(CHF|Fr\.?)/);
      expect(card.textContent).toContain('1 € = 0,93 CHF · taux du 9 octobre 2026 · Frankfurter (banques centrales)');
      expect(card.textContent).toContain('le calcul reste en euros');
      fireEvent.click(screen.getByRole('button', { name: 'Détails : Nous' }));
      const sheet = await screen.findByRole('dialog', { name: 'Nous' });
      fireEvent.click(within(sheet).getByRole('button', { name: /Budget/ }));
      const block = within(sheet).getByTestId('budget-also');
      expect(block.textContent).toMatch(/enveloppe ≈ 837/);
      expect(block.textContent).toContain('1 € = 0,93 CHF');
    });

    it('la devise du pays de destination est dite comme telle, à côté de celle du voyageur', () => {
      const jpy = {
        base: 'EUR' as const,
        currency: 'JPY',
        rate: 176.2,
        date: '2026-10-08',
        source: 'currency-api',
      };
      render(
        <CompasScreen
          data={withBudget({
            targets: [...chf.targets, { currency: 'JPY', kinds: ['destination' as const] }],
            rates: { ...chf.rates, JPY: jpy },
          })}
        />
      );
      fireEvent.click(within(stepsNav()).getByRole('button', { name: /Nous/ }));
      const card = screen.getByTestId('budget-also');
      expect(card.textContent).toContain('Dans ta devise (CHF)');
      expect(card.textContent).toContain('Dans la devise du pays (JPY)');
      expect(card.textContent).toContain('1 € = 176,2 JPY · taux du 8 octobre 2026 · currency-api');
    });

    it('sans devise à montrer en plus, rien n’est ajouté', () => {
      render(<CompasScreen data={withBudget(null)} />);
      fireEvent.click(within(stepsNav()).getByRole('button', { name: /Nous/ }));
      expect(screen.queryByTestId('budget-also')).toBeNull();
    });

    it('taux introuvable : la ligne le dit, aucun montant', () => {
      render(<CompasScreen data={withBudget({ targets: chf.targets, rates: {} })} />);
      fireEvent.click(within(stepsNav()).getByRole('button', { name: /Nous/ }));
      const card = screen.getByTestId('budget-also');
      expect(card.textContent).toContain('Conversion en CHF indisponible');
      expect(card.textContent).not.toContain('≈');
    });
  });

  describe('Nous : les formalités d’entrée de la personne, à part du budget (vie privée, lot Z1)', () => {
    const formalities = {
      title: 'Formalités : ESTA (40 $)',
      perPerson: 35,
      party: 2,
      amount: 70,
      currency: 'EUR' as const,
      basis:
        'barème Compas 2026-10 · ressortissant français, tarif officiel connu · calculé pour toi à l’ouverture, non compté dans le total du voyage',
    };
    const withFormalities = (f: CompasData['formalities']) => ({ ...makeData(), formalities: f });

    it('la carte la dit à côté du total, sans l’y ajouter', () => {
      const bigsum = () => document.querySelector('.cp-bigsum')?.textContent ?? '';
      const without = render(<CompasScreen data={withFormalities(null)} />);
      fireEvent.click(within(stepsNav()).getByRole('button', { name: /Nous/ }));
      const total = bigsum();
      expect(total).not.toBe('');
      expect(screen.queryByTestId('formalities-card')).toBeNull();
      without.unmount();
      render(<CompasScreen data={withFormalities(formalities)} />);
      fireEvent.click(within(stepsNav()).getByRole('button', { name: /Nous/ }));
      const line = screen.getByTestId('formalities-card');
      expect(line.textContent).toContain('Formalités d’entrée pour toi');
      // « Pour toi » : le montant PAR PERSONNE (barème de sa nationalité), jamais celui du groupe (70 €),
      // qui supposerait le même passeport pour tous alors que le profil des autres est privé.
      expect(line.textContent).toMatch(/35\s€ par personne/);
      expect(line.textContent).not.toMatch(/70/);
      expect(line.textContent).toContain('hors du total');
      // Le total engagé est celui du budget rangé, ni plus ni moins.
      expect(bigsum()).toBe(total);
    });

    it('le tiroir budget détaille la ligne : titre, groupe, montant et base, à part des catégories', async () => {
      render(<CompasScreen data={withFormalities(formalities)} />);
      fireEvent.click(within(stepsNav()).getByRole('button', { name: /Nous/ }));
      fireEvent.click(screen.getByRole('button', { name: 'Détails : Nous' }));
      const sheet = await screen.findByRole('dialog', { name: 'Nous' });
      fireEvent.click(within(sheet).getByRole('button', { name: /Budget/ }));
      const row = within(sheet).getByTestId('formalities-line');
      expect(row.textContent).toContain('Formalités : ESTA (40 $)');
      expect(row.textContent).toMatch(/2 personnes × 35\s€/);
      expect(row.textContent).toMatch(/70\s€/);
      expect(row.textContent).toContain('non compté dans le total du voyage');
      expect(within(sheet).queryByText('divers')).toBeNull();
    });

    it('la carte ne multiplie jamais par la taille du groupe : 5 personnes, toujours le montant par personne', () => {
      render(<CompasScreen data={withFormalities({ ...formalities, party: 5, amount: 175 })} />);
      fireEvent.click(within(stepsNav()).getByRole('button', { name: /Nous/ }));
      const line = screen.getByTestId('formalities-card');
      expect(line.textContent).toMatch(/35\s€ par personne/);
      expect(line.textContent).not.toMatch(/175/);
    });

    it('le tiroir ne suppose pas le même passeport pour tout le groupe sans le dire', async () => {
      render(<CompasScreen data={withFormalities(formalities)} />);
      fireEvent.click(within(stepsNav()).getByRole('button', { name: /Nous/ }));
      fireEvent.click(screen.getByRole('button', { name: 'Détails : Nous' }));
      const sheet = await screen.findByRole('dialog', { name: 'Nous' });
      fireEvent.click(within(sheet).getByRole('button', { name: /Budget/ }));
      expect(within(sheet).getByTestId('formalities-line').textContent).toContain('si tout le groupe a ta nationalité');
    });

    it('seul : aucune réserve sur le groupe', async () => {
      render(<CompasScreen data={withFormalities({ ...formalities, party: 1, amount: 35 })} />);
      fireEvent.click(within(stepsNav()).getByRole('button', { name: /Nous/ }));
      fireEvent.click(screen.getByRole('button', { name: 'Détails : Nous' }));
      const sheet = await screen.findByRole('dialog', { name: 'Nous' });
      fireEvent.click(within(sheet).getByRole('button', { name: /Budget/ }));
      const row = within(sheet).getByTestId('formalities-line');
      expect(row.textContent).toMatch(/1 personne × 35\s€/);
      expect(row.textContent).not.toContain('tout le groupe');
    });

    it('sans ligne pour cette personne, rien n’est affiché', async () => {
      for (const f of [null, undefined]) {
        const { unmount } = render(<CompasScreen data={withFormalities(f)} />);
        fireEvent.click(within(stepsNav()).getByRole('button', { name: /Nous/ }));
        expect(screen.queryByTestId('formalities-card')).toBeNull();
        expect(screen.queryByTestId('formalities-line')).toBeNull();
        unmount();
      }
    });
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
    fireEvent.click(within(sheet).getByRole('button', { name: /Sur place/ }));
    expect(within(sheet).getByText('Refuge des Oulettes')).toBeTruthy();
    expect(within(sheet).getByText('Point d’eau')).toBeTruthy();
    fireEvent.click(within(sheet).getByRole('button', { name: /Refuge ou abri \(1\)/ }));
    expect(within(sheet).queryByText('Point d’eau')).toBeNull();
    expect(within(sheet).getByText(/contributeurs OpenStreetMap/)).toBeTruthy();
    // Ces points viennent d'Overpass (et du catalogue, OpenStreetMap), jamais de Geoapify :
    // « Powered by Geoapify » n'a rien à faire à côté (plan 5.3 : seulement là où ses résultats s'affichent).
    expect(within(sheet).queryByRole('link', { name: 'Powered by Geoapify' })).toBeNull();
    expect(within(sheet).queryByText(/Photon/)).toBeNull();
  });

  /* ---------- « Powered by Geoapify » à côté des distances qu'il mesure (plan 5.3) ---------- */

  it('Parcours · étapes : une distance mesurée par Geoapify → son crédit, lien suivi', async () => {
    const data = makeData();
    data.itinerary = data.itinerary.map((st, i) => ({ ...st, distanceSource: i === 0 ? 'geoapify' : 'valhalla' }));
    render(<CompasScreen data={data} />);
    const sheet = await openOu(/Parcours/);
    const credit = await within(sheet).findByRole('link', { name: 'Powered by Geoapify' });
    expect(credit.getAttribute('href')).toBe('https://www.geoapify.com/');
    expect(credit.getAttribute('rel') ?? '').not.toContain('nofollow');
  });

  it('Parcours · étapes : distances de Valhalla ou estimées → pas de crédit Geoapify', async () => {
    const data = makeData();
    data.itinerary = data.itinerary.map((st, i) => ({ ...st, distanceSource: i === 0 ? 'valhalla' : 'estimation' }));
    render(<CompasScreen data={data} />);
    const sheet = await openOu(/Parcours/);
    expect(await within(sheet).findByText('Gavarnie')).toBeTruthy();
    expect(within(sheet).queryByRole('link', { name: 'Powered by Geoapify' })).toBeNull();
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

  it('Quand : destination déjà au lendemain, le jour du voyageur reste choisissable (le plus tôt des deux)', async () => {
    // Auckland a déjà passé minuit, Paris non : le serveur accepte le 10 (jour du voyageur).
    browserDay.today = '2026-10-10';
    const calendar = Array.from({ length: 14 }, (_, i) => ({
      date: `2026-10-${String(11 + i).padStart(2, '0')}`,
      kind: 'prevision' as const,
      quality: 'bon' as const,
      reasons: [],
      tMin: 4,
      tMax: 14,
    }));
    const data = makeData();
    data.weather = { source: 'MET Norway', trendSource: 'NASA POWER', horizon: '2026-10-24', tripDays: [], calendar };
    render(<CompasScreen data={data} />);
    const sheet = await openOu(/Quand/);
    const input = within(sheet).getByLabelText('Départ') as HTMLInputElement;
    expect(input.min).toBe('2026-10-10');
    fireEvent.change(input, { target: { value: '2026-10-10' } });
    fireEvent.click(within(sheet).getByRole('button', { name: 'Enregistrer' }));
    await waitFor(() =>
      expect(compas.compasSetDatesAction).toHaveBeenCalledWith(
        expect.objectContaining({ startDate: '2026-10-10' })
      )
    );
    expect(screen.queryByText('Date passée')).toBeNull();
  });

  it('Quand : destination encore la veille, son jour reste choisissable (le plus tôt des deux)', async () => {
    browserDay.today = '2026-10-11';
    const calendar = Array.from({ length: 14 }, (_, i) => ({
      date: `2026-10-${String(10 + i).padStart(2, '0')}`,
      kind: 'prevision' as const,
      quality: 'bon' as const,
      reasons: [],
      tMin: 4,
      tMax: 14,
    }));
    const data = makeData();
    data.weather = { source: 'MET Norway', trendSource: 'NASA POWER', horizon: '2026-10-23', tripDays: [], calendar };
    render(<CompasScreen data={data} />);
    const sheet = await openOu(/Quand/);
    expect((within(sheet).getByLabelText('Départ') as HTMLInputElement).min).toBe('2026-10-10');
  });

  it('Quand : lever et coucher à l’heure de la destination, « heure locale » quand elle diffère du navigateur', async () => {
    const data = makeData({
      steps: [
        {
          id: 's1',
          dayNumber: 1,
          orderIndex: 0,
          title: 'Tongariro',
          locationName: 'Tongariro',
          lat: -39.2,
          lon: 175.58,
          distanceKm: 19.4,
          elevationGainM: 800,
          elevationLossM: 1100,
          accommodationName: null,
          transportMode: 'foot',
          startTime: null,
        },
      ],
    });
    data.zone = 'Pacific/Auckland';
    render(<CompasScreen data={data} />);
    const sheet = await openOu(/Quand/);
    const sun = daylightClock(-39.2, 175.58, '2026-10-12', 'Pacific/Auckland');
    expect(sun.sunrise).toMatch(/^06:/);
    expect(within(sheet).getByText(`${sun.sunrise} – ${sun.sunset} · heure locale`)).toBeTruthy();
  });

  it('Quand : destination à la même heure que le navigateur, aucune mention', async () => {
    const data = makeData();
    data.zone = 'Europe/Paris';
    render(<CompasScreen data={data} />);
    const sheet = await openOu(/Quand/);
    const sun = daylightClock(42.73, -0.01, '2026-10-12', 'Europe/Paris');
    expect(within(sheet).getByText(`${sun.sunrise} – ${sun.sunset}`)).toBeTruthy();
    expect(within(sheet).queryByText(/heure locale/)).toBeNull();
  });

  const openSources = async () => {
    fireEvent.click(within(stepsNav()).getByRole('button', { name: /Verdict/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Détails : Verdict' }));
    const sheet = await screen.findByRole('dialog', { name: 'Verdict' });
    fireEvent.click(within(sheet).getByRole('button', { name: /Sources/ }));
    return sheet;
  };

  const trendWeather = (): CompasData['weather'] => ({
    source: 'MET Norway',
    trendSource: 'NASA POWER',
    horizon: '2026-10-21',
    tripDays: [],
    calendar: [
      { date: '2026-10-30', kind: 'tendance' as const, quality: 'bon' as const, reasons: [], tMin: 3, tMax: 12 },
    ],
  });
  const normalsNote =
    'Période proposée : août (mois le plus sec selon les normales 2001-2020 (NASA POWER)). Change-la dans « Quand » si elle ne te va pas.';

  it('Sources : tendance seule au calendrier : NASA POWER cité pour la tendance seulement', async () => {
    const data = makeData();
    data.weather = trendWeather();
    render(<CompasScreen data={data} />);
    const sheet = await openSources();
    expect(await within(sheet).findByText('NASA POWER (tendance)')).toBeTruthy();
    expect(within(sheet).queryByText(/normales 2001-2020/)).toBeNull();
  });

  it('Sources : période tirée des normales seules (note de la préparation) : NASA POWER cité pour les normales', async () => {
    const data = makeData();
    data.autofillNotes = [normalsNote];
    render(<CompasScreen data={data} />);
    const sheet = await openSources();
    expect(await within(sheet).findByText('NASA POWER (normales 2001-2020)')).toBeTruthy();
    expect(within(sheet).queryByText(/tendance/)).toBeNull();
  });

  it('Sources : tendance et normales : les deux usages cités', async () => {
    const data = makeData();
    data.weather = trendWeather();
    data.autofillNotes = [normalsNote];
    render(<CompasScreen data={data} />);
    const sheet = await openSources();
    expect(await within(sheet).findByText('NASA POWER (tendance, normales 2001-2020)')).toBeTruthy();
  });

  it('Sources : ni tendance ni normales, NASA POWER n’est pas cité', async () => {
    render(<CompasScreen data={makeData()} />);
    const sheet = await openSources();
    expect(await within(sheet).findByText('Étapes et dépenses du voyage')).toBeTruthy();
    expect(within(sheet).queryByText(/NASA POWER/)).toBeNull();
  });

  /* ---------- Alertes officielles : ce que Meteoalarm exige à l'affichage ---------- */

  const mise = (over: Partial<OfficialAlert> = {}): OfficialAlert => ({
    id: 'it-1',
    source: 'Servizio Meteorologico dell’Aeronautica Militare (MeteoAM) via Meteoalarm',
    hazard: 'vent violent',
    level: 'orange',
    area: 'Sardegna',
    onset: '2026-10-12T06:00:00+02:00',
    expires: '2026-10-12T21:00:00+02:00',
    sent: '2026-10-10T16:00:00.000Z',
    updatedSince: null,
    fetchedAt: '2026-10-11T05:00:00.000Z',
    headline: 'Allerta Arancione Vento per Italia - Sardegna',
    web: 'https://www.meteoam.it/',
    ...over,
  });
  const withAlert = (alert: OfficialAlert) => {
    const data = makeData();
    data.alertsStatus = 'partielles';
    data.danger = assessDanger({ dayPlans: [], forecasts: [], alerts: [alert], alertsStatus: 'partielles' });
    data.model = { ...data.model, verdict: mergeDangerIntoVerdict(data.model.verdict, data.danger) };
    return data;
  };

  it('Sources : alertes officielles lues → Meteoalarm cité, avec son lien et l’avertissement mot pour mot', async () => {
    const data = makeData();
    data.alertsStatus = 'lues';
    render(<CompasScreen data={data} />);
    const sheet = await openSources();
    expect(await within(sheet).findByText('Meteoalarm (alertes officielles des services nationaux)')).toBeTruthy();
    const notice = within(sheet).getByTestId('meteoalarm-notice');
    expect(notice.textContent).toContain(METEOALARM_DISCLAIMER);
    const links = within(notice).getAllByRole('link');
    expect(links.length).toBeGreaterThanOrEqual(2);
    for (const a of links) expect(a.getAttribute('href')).toBe(METEOALARM_HOME);
  });

  it('Sources : pays non couvert ou alertes indisponibles → Meteoalarm n’est pas cité', async () => {
    for (const status of ['non_couvert', 'indisponibles', 'zone_non_rapprochee'] as const) {
      cleanup();
      const data = makeData();
      data.alertsStatus = status;
      render(<CompasScreen data={data} />);
      const sheet = await openSources();
      expect(await within(sheet).findByText('Étapes et dépenses du voyage')).toBeTruthy();
      expect(within(sheet).queryByText(/Meteoalarm/)).toBeNull();
      expect(within(sheet).queryByTestId('meteoalarm-notice')).toBeNull();
    }
  });

  it('Signaux du verdict : alerte orange → service national, heure d’émission, texte officiel, lien et avertissement', async () => {
    render(<CompasScreen data={withAlert(mise())} />);
    fireEvent.click(within(stepsNav()).getByRole('button', { name: /Verdict/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Détails : Verdict' }));
    const sheet = await screen.findByRole('dialog', { name: 'Verdict' });
    const row = await within(sheet).findByText(/Vigilance orange · vent violent \(Sardegna\)/);
    expect(row.textContent).toContain('émise le 10 oct. 2026, 16 h 00 UTC');
    expect(row.textContent).toContain('texte officiel : « Allerta Arancione Vento per Italia - Sardegna »');
    expect(
      within(sheet).getByText(/Source : Servizio Meteorologico dell’Aeronautica Militare \(MeteoAM\) via Meteoalarm/)
    ).toBeTruthy();
    expect(within(sheet).getByTestId('meteoalarm-notice').textContent).toContain(METEOALARM_DISCLAIMER);
  });

  it('Verdict : la carte donne la même information, la même exigence', async () => {
    render(<CompasScreen data={withAlert(mise())} />);
    fireEvent.click(within(stepsNav()).getByRole('button', { name: /Verdict/ }));
    const notice = await screen.findByTestId('meteoalarm-notice');
    expect(notice.textContent).toContain(METEOALARM_DISCLAIMER);
    expect(screen.getByText(/émise le 10 oct. 2026, 16 h 00 UTC/)).toBeTruthy();
  });

  it('CONTRE-EXEMPLE — sans alerte officielle affichée, ni lien ni avertissement Meteoalarm', async () => {
    render(<CompasScreen data={makeData()} />);
    fireEvent.click(within(stepsNav()).getByRole('button', { name: /Verdict/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Détails : Verdict' }));
    const sheet = await screen.findByRole('dialog', { name: 'Verdict' });
    expect(within(sheet).queryByTestId('meteoalarm-notice')).toBeNull();
    expect(screen.queryByTestId('meteoalarm-notice')).toBeNull();
  });

  it('Veille : une alerte jaune y figure avec son heure d’émission, et l’avertissement suit', async () => {
    render(<CompasScreen data={withAlert(mise({ level: 'jaune' }))} />);
    fireEvent.click(within(stepsNav()).getByRole('button', { name: /Verdict/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Détails : Verdict' }));
    const sheet = await screen.findByRole('dialog', { name: 'Verdict' });
    fireEvent.click(within(sheet).getByRole('button', { name: /Veille/ }));
    expect(await within(sheet).findByText('Vigilance officielle (services nationaux, via Meteoalarm)')).toBeTruthy();
    expect(within(sheet).getByText(/Vigilance jaune · vent violent \(Sardegna\), émise le 10 oct. 2026, 16 h 00 UTC/)).toBeTruthy();
    expect(within(sheet).getByTestId('meteoalarm-notice').textContent).toContain(METEOALARM_DISCLAIMER);
  });

  /** Ouvre la Veille du verdict et rend la ligne de la règle « Vigilance officielle ». */
  const openVeilleAlertRule = async (data: CompasData) => {
    render(<CompasScreen data={data} />);
    fireEvent.click(within(stepsNav()).getByRole('button', { name: /Verdict/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Détails : Verdict' }));
    const sheet = await screen.findByRole('dialog', { name: 'Verdict' });
    fireEvent.click(within(sheet).getByRole('button', { name: /Veille/ }));
    const label = await within(sheet).findByText('Vigilance officielle (services nationaux, via Meteoalarm)');
    return label.closest('li') as HTMLElement;
  };

  it('Veille : « Rien à signaler » seulement si les alertes ont été lues, sinon ce qui n’a pas été vérifié', async () => {
    const cases = [
      ['lues', 'Rien à signaler sur ce voyage.'],
      ['partielles', 'Non vérifié : alertes officielles (zone reconnue en partie : d’autres alertes peuvent exister).'],
      ['pas_encore_publiees', 'Non vérifié : alertes officielles (publiées la veille du départ).'],
      ['non_couvert', 'Non vérifié : alertes officielles (pays non couvert par Meteoalarm).'],
      ['zone_non_rapprochee', 'Non vérifié : alertes officielles (zone de l’étape non reconnue dans le flux Meteoalarm).'],
      ['indisponibles', 'Non vérifié : alertes officielles.'],
      [undefined, 'Non vérifié : alertes officielles.'],
    ] as const;
    for (const [status, expected] of cases) {
      cleanup();
      const data = makeData();
      data.alertsStatus = status;
      data.danger = assessDanger({ dayPlans: [], forecasts: [], alerts: [], alertsStatus: status });
      const rule = await openVeilleAlertRule(data);
      expect(rule.textContent, String(status)).toContain(expected);
      if (status !== 'lues') expect(rule.textContent, String(status)).not.toContain('Rien à signaler');
    }
  });

  it('Veille : le service national qui a émis l’alerte est nommé sur sa ligne (conditions de Meteoalarm, § 5)', async () => {
    const rule = await openVeilleAlertRule(withAlert(mise({ level: 'jaune' })));
    expect(rule.textContent).toContain('Vigilance jaune · vent violent (Sardegna), émise le 10 oct. 2026, 16 h 00 UTC');
    expect(
      within(rule).getByText('Source : Servizio Meteorologico dell’Aeronautica Militare (MeteoAM) via Meteoalarm')
    ).toBeTruthy();
  });

  it('Veille : deux alertes, chacune avec son service', async () => {
    const data = withAlert(mise({ level: 'jaune' }));
    const autre = mise({
      id: 'de-1',
      level: 'orange',
      hazard: 'orages',
      area: 'Bayern',
      source: 'Deutscher Wetterdienst (DWD) via Meteoalarm',
      texts: undefined,
    });
    data.danger = assessDanger({ dayPlans: [], forecasts: [], alerts: [mise({ level: 'jaune' }), autre], alertsStatus: 'partielles' });
    const rule = await openVeilleAlertRule(data);
    expect(within(rule).getByText(/Source : Servizio Meteorologico/)).toBeTruthy();
    expect(within(rule).getByText('Source : Deutscher Wetterdienst (DWD) via Meteoalarm')).toBeTruthy();
  });

  const TEXTES = [
    {
      lang: 'en-GB',
      headline: 'Orange Wind Warning for Italy - Sardegna',
      description: 'Strong winds|Gusts up to 90 km/h',
      instruction: 'Avoid exposed ridges <script>alert(1)</script>',
    },
    { lang: 'it-IT', headline: 'Allerta Arancione Vento', description: 'Venti forti', instruction: 'Evitare le creste' },
  ];

  it('Signaux du verdict : la période de validité (UTC) est donnée en entier, la ligne ne se tronque pas', async () => {
    render(<CompasScreen data={withAlert(mise())} />);
    fireEvent.click(within(stepsNav()).getByRole('button', { name: /Verdict/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Détails : Verdict' }));
    const sheet = await screen.findByRole('dialog', { name: 'Verdict' });
    const row = await within(sheet).findByText(/Vigilance orange · vent violent \(Sardegna\)/);
    expect(row.textContent).toContain('valable du 12 oct. 2026, 4 h 00 UTC au 12 oct. 2026, 19 h 00 UTC');
    // Meteoalarm veut le service et l'heure d'émission toujours visibles : pas de « … » sur une ligne fixe.
    const line = row.closest('.cp-row');
    expect(line?.className).toContain('cp-row--wrap');
    expect(line?.className).toContain('cp-row--tall');
  });

  it('Signaux du verdict : le texte officiel (titre, description, consignes) de chaque langue, en texte, sans HTML interprété', async () => {
    const data = withAlert(mise({ texts: TEXTES }));
    render(<CompasScreen data={data} />);
    fireEvent.click(within(stepsNav()).getByRole('button', { name: /Verdict/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Détails : Verdict' }));
    const sheet = await screen.findByRole('dialog', { name: 'Verdict' });
    const official = await within(sheet).findByTestId('official-alert-texts');
    expect(official.textContent).toContain('Texte officiel : Vigilance orange · vent violent (Sardegna)');
    for (const phrase of ['Strong winds', 'Gusts up to 90 km/h', 'Avoid exposed ridges', 'Venti forti', 'Evitare le creste'])
      expect(official.textContent).toContain(phrase);
    // Le texte d'un tiers reste du texte.
    expect(official.textContent).toContain('<script>alert(1)</script>');
    expect(sheet.querySelector('script')).toBeNull();
    expect(official.querySelectorAll('li')).toHaveLength(2);
    expect(Array.from(official.querySelectorAll('[lang]')).map((n) => n.getAttribute('lang'))).toEqual(['en-GB', 'it-IT']);
  });

  it('Verdict : le texte officiel est à un geste de la carte (le bouton y mène, même sans autre signal)', async () => {
    render(<CompasScreen data={withAlert(mise({ texts: TEXTES }))} />);
    fireEvent.click(within(stepsNav()).getByRole('button', { name: /Verdict/ }));
    fireEvent.click(await screen.findByRole('button', { name: /Texte officiel et détails/ }));
    const sheet = await screen.findByRole('dialog', { name: 'Verdict' });
    expect(await within(sheet).findByTestId('official-alert-texts')).toBeTruthy();
  });

  it('CONTRE-EXEMPLE — alerte sans texte détaillé : pas de rubrique « Texte officiel », le bouton garde son libellé', async () => {
    render(<CompasScreen data={withAlert(mise())} />);
    fireEvent.click(within(stepsNav()).getByRole('button', { name: /Verdict/ }));
    expect(await screen.findByRole('button', { name: /Sources et détails/ })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Texte officiel et détails/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Détails : Verdict' }));
    const sheet = await screen.findByRole('dialog', { name: 'Verdict' });
    expect(within(sheet).queryByTestId('official-alert-texts')).toBeNull();
  });

  it('l’heure de lecture du flux est donnée avec l’avertissement (une page restée ouverte ne se rafraîchit pas)', async () => {
    const data = withAlert(mise());
    data.alertsReadAt = '2026-10-11T05:03:00.000Z';
    render(<CompasScreen data={data} />);
    fireEvent.click(within(stepsNav()).getByRole('button', { name: /Verdict/ }));
    const notice = await screen.findByTestId('meteoalarm-notice');
    expect(notice.textContent).toContain('Flux lu le 11 oct. 2026, 5 h 03 UTC.');
    expect(notice.textContent).toContain(METEOALARM_DISCLAIMER);
  });

  it('sans heure de lecture connue, l’avertissement reste complet et rien n’est inventé', async () => {
    render(<CompasScreen data={withAlert(mise())} />);
    fireEvent.click(within(stepsNav()).getByRole('button', { name: /Verdict/ }));
    const notice = await screen.findByTestId('meteoalarm-notice');
    expect(notice.textContent).not.toContain('Flux lu');
    expect(notice.textContent).toContain(METEOALARM_DISCLAIMER);
  });

  it('Veille : le texte officiel d’une alerte jaune suit sa ligne', async () => {
    render(<CompasScreen data={withAlert(mise({ level: 'jaune', texts: TEXTES }))} />);
    fireEvent.click(within(stepsNav()).getByRole('button', { name: /Verdict/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Détails : Verdict' }));
    const sheet = await screen.findByRole('dialog', { name: 'Verdict' });
    fireEvent.click(within(sheet).getByRole('button', { name: /Veille/ }));
    const official = await within(sheet).findByTestId('official-alert-texts');
    expect(official.textContent).toContain('Venti forti');
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

  it('Préférences : « Sans voiture » s’enregistre avec les autres réglages', async () => {
    const context = resolveProjectContext({ activity: 'hiking', days: 4, hours: null, partySize: 2, month: 10, project: null, profile: null });
    render(<CompasScreen data={{ ...makeData(), context }} />);
    const sheet = await openOu(/Préférences/);
    const pill = () => within(sheet).getByRole('button', { name: 'Sans voiture' }) as HTMLButtonElement;
    expect(pill().getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(pill());
    await waitFor(() =>
      expect(compas.compasSetPreferencesAction).toHaveBeenLastCalledWith({
        tripId: TRIP,
        tripSlug: 'trek-3-vallees',
        preferences: { pace: 'normal', nights: null, avoid: [], wishes: [], carFree: true },
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

    // L'annonce paraît avant la fin de l'action : le bouton reste grisé un
    // instant, comme pour une vraie personne. On attend qu'il soit actif.
    await waitFor(() =>
      expect((within(sheet).getByRole('button', { name: /Bivouac/ }) as HTMLButtonElement).disabled).toBe(false)
    );
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
      expect(compas.compasInterpretAction).toHaveBeenCalledWith({
        tripId: TRIP,
        text: 'rando à 4',
        timeZone: 'Europe/Paris',
      })
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
    compas.compasSetPartySizeAction.mockResolvedValueOnce({ success: false, error: 'Connexion perdue' } as never);
    render(<CompasScreen data={{ ...makeData(), startSay: 'rando à 4' }} />);
    await waitFor(() => expect(compas.compasSetPartySizeAction).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 50));
    expect(compas.compasClearStartSayAction).not.toHaveBeenCalled();
  });

  it('Phrase de départ : un lieu de départ refusé n’arrête pas la préparation, l’échec est dit', async () => {
    compas.compasInterpretAction.mockResolvedValueOnce({
      success: true,
      usedAi: false,
      note: null,
      proposals: [
        {
          id: '0-set_origin',
          action: { type: 'set_origin', place: 'Lyon' },
          label: 'Départ : Lyon',
          ok: true,
          reason: null,
          source: 'regles',
        },
        {
          id: '1-set_party_size',
          action: { type: 'set_party_size', count: 4 },
          label: '4 personnes',
          ok: true,
          reason: null,
          source: 'regles',
        },
      ],
    });
    compas.compasSetOriginAction.mockResolvedValueOnce({ success: false, error: '« Lyon » introuvable sur la carte.' });
    render(<CompasScreen data={{ ...makeData(), startSay: 'à 4 depuis Lyon' }} />);
    await waitFor(() => expect(compas.compasSetOriginAction).toHaveBeenCalledTimes(1));
    // Le reste est appliqué d'abord : le départ, dont rien ne dépend, passe en dernier.
    expect(compas.compasSetPartySizeAction).toHaveBeenCalledWith({ tripId: TRIP, tripSlug: 'trek-3-vallees', partySize: 4 });
    expect(compas.compasSetPartySizeAction.mock.invocationCallOrder[0]).toBeLessThan(
      compas.compasSetOriginAction.mock.invocationCallOrder[0]
    );
    // L'échec est visible, sans arrêter la préparation : la phrase est consommée et la suite part.
    expect(await screen.findByText('Départ non retenu · « Lyon » introuvable sur la carte.')).toBeTruthy();
    await waitFor(() => expect(compas.compasClearStartSayAction).toHaveBeenCalledWith({ tripId: TRIP }));
    expect(screen.queryByText('Préparation interrompue')).toBeNull();
  });

  it('Phrase de départ : un réglage refusé arrête toujours la préparation, sans tenter le départ', async () => {
    compas.compasInterpretAction.mockResolvedValueOnce({
      success: true,
      usedAi: false,
      note: null,
      proposals: [
        {
          id: '0-set_origin',
          action: { type: 'set_origin', place: 'Lyon' },
          label: 'Départ : Lyon',
          ok: true,
          reason: null,
          source: 'regles',
        },
        {
          id: '1-set_party_size',
          action: { type: 'set_party_size', count: 4 },
          label: '4 personnes',
          ok: true,
          reason: null,
          source: 'regles',
        },
      ],
    });
    compas.compasSetPartySizeAction.mockResolvedValueOnce({ success: false, error: 'Connexion perdue' } as never);
    render(<CompasScreen data={{ ...makeData(), startSay: 'à 4 depuis Lyon' }} />);
    expect(await screen.findByText('Préparation interrompue')).toBeTruthy();
    expect(compas.compasSetOriginAction).not.toHaveBeenCalled();
    expect(compas.compasClearStartSayAction).not.toHaveBeenCalled();
  });

  describe('Phrase de départ : « Arrêter » pendant l’application des réglages', () => {
    /** « rando à 4 » comprise, puis appliquée réglage par réglage (une écriture tenue en l’air). */
    const sayFour = () => ({
      success: true as const,
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
    const noPlace = (): CompasData => ({
      ...makeData({ trip: { ...baseTrip, destinationName: null, startDate: null, endDate: null }, steps: [] }),
      autofill: 'none',
      origin: null,
      itinerary: [],
      // Ni dates ni durée : la préparation ne part pas d'elle-même (le routeur simulé change
      // à chaque rendu et relancerait sinon l'effet de départ pendant la compréhension).
      plannedDays: null,
      startSay: 'rando à 4',
    });
    /** Écriture du réglage tenue en l'air : la personne appuie sur « Arrêter » avant qu'elle réponde. */
    const holdPartySize = (answer: { success: boolean; error?: string }) => {
      let release: () => void = () => undefined;
      compas.compasSetPartySizeAction.mockImplementationOnce(
        () => new Promise((resolve) => (release = () => resolve(answer))) as never
      );
      return () => release();
    };
    const stopWhileApplying = async () => {
      const panel = await screen.findByRole('status', { name: 'Préparation de l’aventure' });
      await waitFor(() => expect(compas.compasSetPartySizeAction).toHaveBeenCalledTimes(1));
      fireEvent.click(within(panel).getByRole('button', { name: 'Arrêter' }));
      await waitFor(() => expect(autofill.compasAutofillStopAction).toHaveBeenCalledWith({ tripId: TRIP }));
      expect(screen.getByText('Préparation arrêtée')).toBeTruthy();
    };

    it('les réglages se terminent : le panneau reste « arrêté », rien ne repart', async () => {
      compas.compasInterpretAction.mockResolvedValueOnce(sayFour());
      const release = holdPartySize({ success: true });
      render(<CompasScreen data={noPlace()} />);
      await stopWhileApplying();
      release();
      await new Promise((r) => setTimeout(r, 60));
      // Avant : setPrep({ stage: 'itinerary' }) écrasait l'arrêt, le panneau restait bloqué.
      expect(screen.getByText('Préparation arrêtée')).toBeTruthy();
      expect(screen.queryByText('Je prépare ton aventure…')).toBeNull();
      expect(autofill.compasAutofillStartAction).not.toHaveBeenCalled();
      // La phrase reste sur le voyage : « Reprendre » (ou la prochaine visite) la rejoue.
      expect(compas.compasClearStartSayAction).not.toHaveBeenCalled();
    });

    it('un réglage refusé pendant ce temps ne remplace pas l’arrêt par une erreur', async () => {
      compas.compasInterpretAction.mockResolvedValueOnce(sayFour());
      const release = holdPartySize({ success: false, error: 'Connexion perdue' });
      render(<CompasScreen data={noPlace()} />);
      await stopWhileApplying();
      release();
      await new Promise((r) => setTimeout(r, 60));
      expect(screen.getByText('Préparation arrêtée')).toBeTruthy();
      expect(screen.queryByText('Préparation interrompue')).toBeNull();
      expect(autofill.compasAutofillStartAction).not.toHaveBeenCalled();
    });

    it('« Reprendre » après cet arrêt rejoue la phrase puis lance la préparation', async () => {
      compas.compasInterpretAction.mockResolvedValueOnce(sayFour()).mockResolvedValueOnce(sayFour());
      const release = holdPartySize({ success: true });
      render(<CompasScreen data={noPlace()} />);
      await stopWhileApplying();
      release();
      await new Promise((r) => setTimeout(r, 60));
      fireEvent.click(screen.getByRole('button', { name: /Reprendre|Réessayer/ }));
      await waitFor(() => expect(compas.compasInterpretAction).toHaveBeenCalledTimes(2));
      await waitFor(() => expect(compas.compasClearStartSayAction).toHaveBeenCalledWith({ tripId: TRIP }));
      expect(screen.queryByText('Préparation arrêtée')).toBeNull();
    });
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
        timeZone: 'Europe/Paris',
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

  /* « N changements appliqués » compte les propositions cochées qui s'écrivent
     (« Chercher un parcours » n'écrit rien). Un départ dit s'écrit : il compte
     avec les autres, et seulement si son écriture a réussi. */
  describe('Dis-le : « depuis Lyon »', () => {
    const said = (id: string, action: object, label: string) => ({
      id,
      action,
      label,
      ok: true,
      reason: null,
      source: 'regles' as const,
    });
    const originProposal = said('0-set_origin', { type: 'set_origin', place: 'Lyon' }, 'Départ : Lyon');
    const partyProposal = said('1-set_party_size', { type: 'set_party_size', count: 4 }, '4 personnes');

    const understand = async (proposals: unknown[], text: string) => {
      compas.compasInterpretAction.mockResolvedValueOnce({ success: true, usedAi: false, note: null, proposals });
      render(<CompasScreen data={makeData()} />);
      const sheet = await openOu(/Quand/);
      fireEvent.change(within(sheet).getByLabelText('Dis-le'), { target: { value: text } });
      fireEvent.click(within(sheet).getByRole('button', { name: 'Comprendre la phrase' }));
      return sheet;
    };

    it('écrit le départ et le compte avec les autres changements', async () => {
      const sheet = await understand([originProposal, partyProposal], 'à 4 depuis Lyon');
      expect(await within(sheet).findByText('Départ : Lyon')).toBeTruthy();
      fireEvent.click(within(sheet).getByRole('button', { name: /Appliquer \(2\)/ }));
      await waitFor(() =>
        expect(compas.compasSetOriginAction).toHaveBeenCalledWith({
          tripId: TRIP,
          tripSlug: 'trek-3-vallees',
          place: 'Lyon',
        })
      );
      expect(compas.compasSetPartySizeAction).toHaveBeenCalledWith({
        tripId: TRIP,
        tripSlug: 'trek-3-vallees',
        partySize: 4,
      });
      expect(await screen.findByText('2 changements appliqués')).toBeTruthy();
    });

    it('seul, le départ est écrit, compté pour un, et « Annuler » l’efface (aucun départ avant)', async () => {
      const sheet = await understand([originProposal], 'depuis Lyon');
      fireEvent.click(await within(sheet).findByRole('button', { name: /Appliquer \(1\)/ }));
      await waitFor(() => expect(compas.compasSetOriginAction).toHaveBeenCalledTimes(1));
      expect(await screen.findByText('1 changement appliqué')).toBeTruthy();
      fireEvent.click(await screen.findByRole('button', { name: 'Annuler' }));
      await waitFor(() => expect(compas.compasSetOriginAction).toHaveBeenCalledTimes(2));
      expect(compas.compasSetOriginAction).toHaveBeenLastCalledWith({
        tripId: TRIP,
        tripSlug: 'trek-3-vallees',
        place: null,
      });
    });

    it('départ changé : « Annuler » rétablit l’ancien tel que rangé, sans le rechercher à nouveau', async () => {
      const grenoble = { name: 'Grenoble', lat: 45.19, lon: 5.72, countryCode: 'FR' };
      compas.compasInterpretAction.mockResolvedValueOnce({
        success: true,
        usedAi: false,
        note: null,
        proposals: [originProposal],
      });
      render(<CompasScreen data={{ ...makeData(), originName: 'Grenoble', originSaid: grenoble }} />);
      const sheet = await openOu(/Quand/);
      fireEvent.change(within(sheet).getByLabelText('Dis-le'), { target: { value: 'depuis Lyon' } });
      fireEvent.click(within(sheet).getByRole('button', { name: 'Comprendre la phrase' }));
      fireEvent.click(await within(sheet).findByRole('button', { name: /Appliquer \(1\)/ }));
      await waitFor(() => expect(compas.compasSetOriginAction).toHaveBeenCalledTimes(1));
      fireEvent.click(await screen.findByRole('button', { name: 'Annuler' }));
      await waitFor(() => expect(compas.compasSetOriginAction).toHaveBeenCalledTimes(2));
      expect(compas.compasSetOriginAction).toHaveBeenLastCalledWith({
        tripId: TRIP,
        tripSlug: 'trek-3-vallees',
        place: 'Grenoble',
        restore: grenoble,
      });
    });

    it('lieu de départ introuvable : l’erreur remplace l’annonce, rien n’est compté comme appliqué', async () => {
      compas.compasSetOriginAction.mockResolvedValueOnce({
        success: false,
        error: '« Lyon » introuvable sur la carte.',
      });
      const sheet = await understand([originProposal], 'depuis Lyon');
      fireEvent.click(await within(sheet).findByRole('button', { name: /Appliquer \(1\)/ }));
      expect(await screen.findByText('« Lyon » introuvable sur la carte.')).toBeTruthy();
      expect(screen.queryByText('1 changement appliqué')).toBeNull();
      expect(screen.queryByRole('button', { name: 'Annuler' })).toBeNull();
    });
  });
});

describe('CompasScreen : réadaptation après un réglage', () => {
  beforeEach(() => {
    autofill.compasRefreshAutofillAction.mockClear();
  });
  afterEach(() => cleanup());

  it('deux changements de départ de suite (Lyon → Paris → Marseille) sont réadaptés tous les deux', async () => {
    const stale = (autofillStale: Array<'transport' | 'budget'>) => ({ ...makeData(), autofill: 'done' as const, autofillStale });
    const { rerender } = render(<CompasScreen data={stale(['transport', 'budget'])} />);
    await waitFor(() => expect(autofill.compasRefreshAutofillAction).toHaveBeenCalledTimes(1));
    // Même liste, même écran : pas de seconde réadaptation tant que rien n'a bougé.
    rerender(<CompasScreen data={stale(['transport', 'budget'])} />);
    expect(autofill.compasRefreshAutofillAction).toHaveBeenCalledTimes(1);
    // La réadaptation a refait ce qui était caduc, puis un nouveau changement rend les mêmes parties caduques.
    rerender(<CompasScreen data={stale([])} />);
    rerender(<CompasScreen data={stale(['transport', 'budget'])} />);
    await waitFor(() => expect(autofill.compasRefreshAutofillAction).toHaveBeenCalledTimes(2));
  });
});

/* Lot Q, PLAN-100 5.2 — accessibilité (WCAG 2.2 AA) de l'écran et des tiroirs. */
describe('CompasScreen : accessibilité (lot Q, 5.2)', () => {
  afterEach(() => cleanup());

  const openKitAll = async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Détails : Kit' }));
    const sheet = await screen.findByRole('dialog', { name: 'Kit' });
    fireEvent.click(within(sheet).getByRole('button', { name: /Tout/ }));
    return sheet;
  };

  describe('KitRow : une ligne, un bouton, aucune commande dans une commande', () => {
    it('aucun bouton, lien ou role=button n’en contient un autre', async () => {
      render(<CompasScreen data={makeData()} />);
      const sheet = await openKitAll();
      const rows = sheet.querySelectorAll('.cp-row');
      expect(rows.length).toBe(2);
      expect(
        sheet.querySelectorAll(
          '[role="button"] button, [role="button"] a, button button, button a, a button'
        ).length
      ).toBe(0);
      for (const row of rows) {
        // La ligne n’est plus elle-même un bouton ; sa commande principale en est un vrai.
        expect(row.getAttribute('role')).toBeNull();
        expect(row.getAttribute('tabindex')).toBeNull();
        expect(row.querySelector('button.cp-row__main')).toBeTruthy();
      }
    });

    it('Entrée ouvre la fiche de l’objet', async () => {
      const user = userEvent.setup();
      render(<CompasScreen data={makeData()} />);
      const sheet = await openKitAll();
      const main = within(sheet).getByText('Sac de couchage').closest('button') as HTMLButtonElement;
      main.focus();
      await user.keyboard('{Enter}');
      expect(await screen.findByRole('dialog', { name: 'Sac de couchage' })).toBeTruthy();
    });

    it('Espace ouvre la fiche de l’objet', async () => {
      const user = userEvent.setup();
      render(<CompasScreen data={makeData()} />);
      const sheet = await openKitAll();
      const main = within(sheet).getByText('Sac de couchage').closest('button') as HTMLButtonElement;
      main.focus();
      await user.keyboard(' ');
      expect(await screen.findByRole('dialog', { name: 'Sac de couchage' })).toBeTruthy();
    });

    it('Espace sur « Emballer » emballe sans ouvrir la fiche', async () => {
      const user = userEvent.setup();
      render(<CompasScreen data={makeData()} />);
      const sheet = await openKitAll();
      const pack = within(sheet).getByRole('button', { name: 'Emballer Sac de couchage' });
      pack.focus();
      await user.keyboard(' ');
      await waitFor(() =>
        expect(kit.togglePackedAction).toHaveBeenCalledWith(SLEEP, true, 'trek-3-vallees')
      );
      expect(screen.queryByRole('dialog', { name: 'Sac de couchage' })).toBeNull();
    });

    it('le clic sur la ligne ouvre toujours la fiche', async () => {
      render(<CompasScreen data={makeData()} />);
      const sheet = await openKitAll();
      fireEvent.click(within(sheet).getByText('Sac de couchage'));
      expect(await screen.findByRole('dialog', { name: 'Sac de couchage' })).toBeTruthy();
    });
  });
  describe('Calendrier des conditions : la qualité est dite, pas seulement colorée', () => {
    const openQuand = async (weather: CompasData['weather']) => {
      const data = makeData();
      data.weather = weather;
      render(<CompasScreen data={data} />);
      fireEvent.click(within(stepsNav()).getByRole('button', { name: /Où/ }));
      fireEvent.click(screen.getByRole('button', { name: 'Détails : Préparer' }));
      const sheet = await screen.findByRole('dialog', { name: 'Préparer' });
      fireEvent.click(within(sheet).getByRole('button', { name: /Quand/ }));
      return sheet;
    };
    const day = (n: number) => `2026-10-${String(n).padStart(2, '0')}`;

    it('chaque jour porte une forme propre à sa qualité et à sa nature, en plus de la couleur et du libellé', async () => {
      const kinds = [
        ['prevision', 'bon'],
        ['prevision', 'moyen'],
        ['prevision', 'mauvais'],
        ['tendance', 'bon'],
        ['tendance', 'moyen'],
        ['tendance', 'mauvais'],
      ] as const;
      const calendar = [
        ...kinds.map(([kind, quality], i) => ({
          date: day(10 + i),
          kind: kind as 'prevision' | 'tendance',
          quality: quality as 'bon' | 'moyen' | 'mauvais',
          reasons: [] as string[],
          tMin: 4,
          tMax: 14,
        })),
        { date: day(16), kind: 'inconnu' as const, quality: null, reasons: [] as string[], tMin: null, tMax: null },
      ];
      const sheet = await openQuand({
        source: 'MET Norway',
        trendSource: 'NASA POWER',
        horizon: day(12),
        tripDays: [],
        calendar,
      });
      const cell = (d: number) =>
        within(sheet).getByRole('button', { name: new RegExp(`\\b${d} oct\\.? :`) });
      const shape = (d: number) => cell(d).querySelector('i')?.textContent ?? '';
      // prévision : forme pleine ; tendance : même forme, creuse
      expect(shape(10)).toBe('●');
      expect(shape(11)).toBe('◆');
      expect(shape(12)).toBe('▲');
      expect(shape(13)).toBe('○');
      expect(shape(14)).toBe('◇');
      expect(shape(15)).toBe('△');
      // pas de donnée : aucune forme de qualité
      expect(shape(16)).toBe('');
      // le libellé dit la qualité en toutes lettres
      expect(cell(11).getAttribute('aria-label')).toMatch(/conditions moyennes \(prévision\)/);
      expect(cell(15).getAttribute('aria-label')).toMatch(/mauvaises conditions \(tendance\)/);
      expect(cell(16).getAttribute('aria-label')).toMatch(/pas de donnée/);
      // les formes sont décoratives : le libellé suffit aux lecteurs d’écran
      expect(cell(10).querySelector('i')?.getAttribute('aria-hidden')).toBe('true');
    });

    it('la légende nomme chaque forme, sans passer par la couleur', async () => {
      const sheet = await openQuand({
        source: 'MET Norway',
        trendSource: 'NASA POWER',
        horizon: day(12),
        tripDays: [],
        calendar: [{ date: day(12), kind: 'prevision', quality: 'bon', reasons: [], tMin: 4, tMax: 14 }],
      });
      const legend = sheet.querySelector('.cp-cal__legend') as HTMLElement;
      expect(legend.textContent).toMatch(/●\s*bon/);
      expect(legend.textContent).toMatch(/◆\s*moyen/);
      expect(legend.textContent).toMatch(/▲\s*mauvais/);
      expect(legend.textContent).toMatch(/forme pleine\s*:\s*prévision/);
      expect(legend.textContent).toMatch(/forme creuse\s*:\s*tendance/);
    });

    it('heure par heure : la qualité de chaque heure est dite en texte, avec ses raisons', async () => {
      const hour = (hh: string, o: Partial<{ code: number; precipPct: number; gustKmh: number }>) => ({
        time: `2026-10-12T${hh}:00`,
        tempC: 9,
        precipPct: o.precipPct ?? 10,
        precipMm: 0,
        windKmh: 10,
        gustKmh: o.gustKmh ?? 15,
        code: o.code ?? 1,
        freezingM: null,
        isDay: true,
      });
      const sheet = await openQuand({
        source: 'MET Norway',
        trendSource: 'NASA POWER',
        horizon: day(20),
        calendar: [{ date: day(12), kind: 'prevision', quality: 'bon', reasons: [], tMin: 4, tMax: 14 }],
        tripDays: [
          {
            day: 1,
            date: day(12),
            lat: 42.73,
            lon: -0.01,
            forecast: {
              date: day(12),
              tMin: 4,
              tMax: 14,
              precipPct: 20,
              precipMm: 1,
              gustMax: 30,
              code: 2,
              sunrise: '07:40',
              sunset: '19:10',
              hours: [hour('09', {}), hour('11', { precipPct: 50 }), hour('14', { precipPct: 85, gustKmh: 65 })],
            },
          },
        ],
      });
      const strip = within(sheet).getByLabelText('Heure par heure');
      const chips = Array.from(strip.querySelectorAll<HTMLElement>('.cp-hour'));
      expect(chips).toHaveLength(3);
      expect(chips[0].textContent).toMatch(/bonnes conditions/);
      expect(chips[1].textContent).toMatch(/conditions moyennes/);
      expect(chips[1].textContent).toMatch(/pluie 50 %/);
      expect(chips[2].textContent).toMatch(/mauvaises conditions/);
      expect(chips[2].textContent).toMatch(/rafales 65 km\/h/);
      // forme de qualité visible, décorative
      expect(chips[2].querySelector('i[aria-hidden="true"]')?.textContent).toBe('▲');
    });
  });

  describe('Pastilles d’alerte des étapes : annoncées au lecteur d’écran', () => {
    // Le calcul du nom accessible de jsdom met une espace entre éléments frères.
    const alertName = (step: string, cause: string) => new RegExp(`^${step} ?, alerte : ${cause}$`);

    it('une étape en alerte dit pourquoi dans son nom accessible, la pastille reste décorative', () => {
      render(<CompasScreen data={makeData()} />);
      // Sac de couchage vital à trouver → alerte rouge sur le Kit.
      const kitStep = within(stepsNav()).getByRole('button', {
        name: alertName('Kit', 'objet vital à trouver'),
      });
      const dot = kitStep.querySelector('.cp-step__dot') as HTMLElement;
      expect(dot.getAttribute('data-tone')).toBe('bad');
      expect(dot.getAttribute('aria-hidden')).toBe('true');
    });

    it('les icônes des étapes sont décoratives : le nom du glyphe n’est plus lu avant l’étape', () => {
      render(<CompasScreen data={makeData()} />);
      expect(within(stepsNav()).queryByRole('img')).toBeNull();
    });

    it('une étape sans alerte garde son nom simple', () => {
      render(<CompasScreen data={makeData()} />);
      const ou = within(stepsNav()).getByRole('button', { name: 'Où' });
      expect(ou.querySelector('.cp-step__dot')).toBeNull();
    });

    it('chaque alerte se dit selon sa cause', () => {
      const data = makeData({ trip: { ...baseTrip, startDate: null, endDate: null } });
      render(<CompasScreen data={data} />);
      const nav = stepsNav();
      expect(within(nav).getByRole('button', { name: alertName('Où', 'dates à choisir') })).toBeTruthy();
      expect(
        within(nav).getByRole('button', { name: /^Verdict ?, alerte : (voyage bloqué|points à vérifier)$/ })
      ).toBeTruthy();
    });
  });

  describe('« Annuler » : délai assez long et réglable, erreurs annoncées', () => {
    const openPrefs = async () => {
      fireEvent.click(within(stepsNav()).getByRole('button', { name: /Où/ }));
      fireEvent.click(screen.getByRole('button', { name: 'Détails : Préparer' }));
      const sheet = await screen.findByRole('dialog', { name: 'Préparer' });
      fireEvent.click(within(sheet).getByRole('button', { name: /Préférences/ }));
      return sheet;
    };
    const undoButton = () => screen.queryByRole('button', { name: 'Annuler' });
    const bivouac = (sheet: HTMLElement) =>
      fireEvent.click(within(sheet).getByRole('button', { name: /Bivouac/ }));
    const DISPLAY_KEY = 'lkdv.compas.affichage';

    afterEach(() => {
      vi.useRealTimers();
      window.localStorage.removeItem(DISPLAY_KEY);
    });

    it('« Annuler » reste proposé bien plus que 6 s, puis disparaît', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      render(<CompasScreen data={makeData()} />);
      const sheet = await openPrefs();
      bivouac(sheet);
      await screen.findByRole('button', { name: 'Annuler' });
      await vi.advanceTimersByTimeAsync(10_000);
      expect(undoButton()).not.toBeNull();
      await vi.advanceTimersByTimeAsync(7_000);
      await waitFor(() => expect(undoButton()).toBeNull());
    });

    it('le délai est suspendu tant que l’annonce a le focus ou le pointeur, et repart ensuite', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      render(<CompasScreen data={makeData()} />);
      const sheet = await openPrefs();
      bivouac(sheet);
      const undo = await screen.findByRole('button', { name: 'Annuler' });
      fireEvent.focus(undo);
      await vi.advanceTimersByTimeAsync(60_000);
      expect(undoButton()).not.toBeNull();
      fireEvent.blur(undo);
      await vi.advanceTimersByTimeAsync(5_000);
      expect(undoButton()).not.toBeNull();
      await vi.advanceTimersByTimeAsync(12_000);
      await waitFor(() => expect(undoButton()).toBeNull());

      // Même chose au pointeur.
      bivouac(sheet);
      const again = await screen.findByRole('button', { name: 'Annuler' });
      const island = again.closest('.cp-island') as HTMLElement;
      fireEvent.pointerEnter(island);
      await vi.advanceTimersByTimeAsync(60_000);
      expect(undoButton()).not.toBeNull();
      fireEvent.pointerLeave(island);
      await vi.advanceTimersByTimeAsync(17_000);
      await waitFor(() => expect(undoButton()).toBeNull());
    });

    it('la durée est réglable dans « Affichage » et gardée sur l’appareil', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      render(<CompasScreen data={makeData()} />);
      fireEvent.click(screen.getByRole('button', { name: /^Affichage/ }));
      const popover = screen.getByRole('dialog', { name: 'Affichage' });
      const choice = within(popover).getByRole('combobox', { name: /Durée de « Annuler »/ });
      expect((choice as HTMLSelectElement).value).toBe('15');
      fireEvent.change(choice, { target: { value: '30' } });
      expect(JSON.parse(window.localStorage.getItem(DISPLAY_KEY) ?? '{}').undoS).toBe(30);

      const sheet = await openPrefs();
      bivouac(sheet);
      await screen.findByRole('button', { name: 'Annuler' });
      await vi.advanceTimersByTimeAsync(25_000);
      expect(undoButton()).not.toBeNull();
      await vi.advanceTimersByTimeAsync(7_000);
      await waitFor(() => expect(undoButton()).toBeNull());
    });

    it('un réglage enregistré est relu au démarrage, une valeur inconnue est ignorée', async () => {
      window.localStorage.setItem(DISPLAY_KEY, JSON.stringify({ outdoor: false, glass: 0.6, v: 2, undoS: 8 }));
      render(<CompasScreen data={makeData()} />);
      fireEvent.click(screen.getByRole('button', { name: /^Affichage/ }));
      await waitFor(() =>
        expect(
          (within(screen.getByRole('dialog', { name: 'Affichage' })).getByRole('combobox', {
            name: /Durée de « Annuler »/,
          }) as HTMLSelectElement).value
        ).toBe('8')
      );
      cleanup();
      window.localStorage.setItem(DISPLAY_KEY, JSON.stringify({ outdoor: false, glass: 0.6, v: 2, undoS: 3 }));
      render(<CompasScreen data={makeData()} />);
      fireEvent.click(screen.getByRole('button', { name: /^Affichage/ }));
      expect(
        (within(screen.getByRole('dialog', { name: 'Affichage' })).getByRole('combobox', {
          name: /Durée de « Annuler »/,
        }) as HTMLSelectElement).value
      ).toBe('15');
    });

    it('une erreur d’action est annoncée en role="alert" et reste lisible plus de 4 s', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      compas.compasSetPreferencesAction.mockResolvedValueOnce({
        success: false,
        error: 'Refusé par le serveur',
      } as never);
      render(<CompasScreen data={makeData()} />);
      const sheet = await openPrefs();
      bivouac(sheet);
      const alert = await screen.findByRole('alert');
      expect(alert.textContent).toContain('Refusé par le serveur');
      await vi.advanceTimersByTimeAsync(8_000);
      expect(screen.queryByRole('alert')).not.toBeNull();
    });

    it('une annonce de réussite reste un role="status", pas une alerte', async () => {
      render(<CompasScreen data={makeData()} />);
      const sheet = await openPrefs();
      bivouac(sheet);
      await screen.findByRole('button', { name: 'Annuler' });
      expect(screen.queryByRole('alert')).toBeNull();
      expect(screen.getByRole('status').textContent).toContain('Annuler');
    });

    it('une erreur de chargement dans un tiroir est annoncée en role="alert"', async () => {
      compas.compasListMyKitsAction.mockResolvedValueOnce({
        success: false,
        error: 'Kits indisponibles',
      } as never);
      render(<CompasScreen data={makeData()} />);
      fireEvent.click(screen.getByRole('button', { name: 'Détails : Kit' }));
      const sheet = await screen.findByRole('dialog', { name: 'Kit' });
      fireEvent.click(within(sheet).getByRole('button', { name: /Mes kits/ }));
      const alert = await within(sheet).findByRole('alert');
      expect(alert.textContent).toBe('Kits indisponibles');
    });
  });

  describe('Ce que porte un `title` est aussi dit au clavier et au lecteur d’écran', () => {
    const describedBy = (el: HTMLElement) =>
      (el.getAttribute('aria-describedby') ?? '')
        .split(/\s+/)
        .filter(Boolean)
        .map((id) => document.getElementById(id)?.textContent ?? '')
        .join(' ')
        .trim();
    const openFlow = async (flow: RegExp) => {
      render(<CompasScreen data={makeData()} />);
      fireEvent.click(within(stepsNav()).getByRole('button', { name: /Où/ }));
      fireEvent.click(screen.getByRole('button', { name: 'Détails : Préparer' }));
      const sheet = await screen.findByRole('dialog', { name: 'Préparer' });
      fireEvent.click(
        within(within(sheet).getByRole('group', { name: 'Parcours du tiroir' })).getByRole('button', {
          name: flow,
        })
      );
      return sheet;
    };

    it('les activités : la description de chacune est lue avec elle, pas seulement au survol', async () => {
      const sheet = await openFlow(/Activité/);
      const tiles = within(within(sheet).getByRole('group', { name: 'Activités' })).getAllByRole('button');
      expect(tiles.length).toBeGreaterThan(3);
      for (const t of tiles) {
        expect(t.getAttribute('title')).toBeTruthy();
        expect(describedBy(t)).toBe(t.getAttribute('title'));
      }
    });

    it('« Dis-le » : l’exemple est une description du champ, pas une info-bulle seule', async () => {
      const sheet = await openFlow(/Quand/);
      const field = within(sheet).getByLabelText('Dis-le');
      expect(describedBy(field)).toMatch(/3 jours à 4, départ samedi/);
    });

    it('carte, calques sans point : « aucun » est écrit, pas seulement dans une info-bulle', async () => {
      render(<CompasScreen data={makeData()} />);
      fireEvent.click(screen.getByRole('button', { name: 'Personnaliser la carte' }));
      const panel = screen.getByRole('dialog', { name: 'Personnaliser la carte' });
      const empty = within(panel)
        .getAllByRole('switch')
        .filter((b) => (b as HTMLButtonElement).disabled);
      expect(empty.length).toBeGreaterThan(0);
      for (const b of empty) expect(b.textContent).toMatch(/aucun/);
    });

    it('Résa : une nuit sans hébergement est une image nommée, pas une lettre « H » sous info-bulle', () => {
      render(<CompasScreen data={makeData()} initialStep="resa" />);
      const slots = document.querySelectorAll<HTMLElement>('.cp-slot');
      expect(slots.length).toBeGreaterThan(0);
      for (const slot of slots) {
        expect(slot.getAttribute('role')).toBe('img');
        expect(slot.getAttribute('aria-label')).toBe(slot.getAttribute('title'));
      }
      expect(within(document.body).getByRole('img', { name: 'Nuit sans hébergement' })).toBeTruthy();
    });

    it('Nous : les avatars (décoratifs) sont doublés par la liste des noms', () => {
      render(<CompasScreen data={makeData()} initialStep="nous" />);
      expect(screen.getByText('Équipe : Tony, Léa')).toBeTruthy();
    });

    it('Verdict : la note d’un axe de danger est dans le texte de la pastille, pas seulement en info-bulle', () => {
      render(<CompasScreen data={makeData()} initialStep="verdict" />);
      const chips = document.querySelectorAll<HTMLElement>('.cp-tchip--axis[title]');
      expect(chips.length).toBeGreaterThan(0);
      for (const chip of chips) expect(chip.textContent).toContain(chip.getAttribute('title') as string);
    });

    it('« Annuler » annonce son raccourci clavier', async () => {
      const sheet = await openFlow(/Préférences/);
      fireEvent.click(within(sheet).getByRole('button', { name: /Bivouac/ }));
      const undo = await screen.findByRole('button', { name: 'Annuler' });
      expect(undo.getAttribute('aria-keyshortcuts')).toBe('Control+Z Meta+Z');
    });

    it('l’onglet précédent nomme sa destination dans son nom accessible', async () => {
      const sheet = await openFlow(/Quand/);
      const prev = within(sheet).getByRole('button', { name: /Onglet précédent/ });
      expect(prev.getAttribute('aria-label')).toMatch(/^Onglet précédent : \S+/);
    });
  });

  describe('axe-core : l’écran et chacun des tiroirs, zéro violation WCAG A/AA', () => {
    /* jsdom n'a ni mise en page ni couleurs : le contraste reste mesuré dans le
       navigateur (tests/a11y, Playwright). Tout le reste des règles A/AA tourne ici. */
    const scan = async (root: Element): Promise<string[]> => {
      const res = await axe.run(root as HTMLElement, {
        runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] },
        rules: {
          'color-contrast': { enabled: false },
          // Fragment de page : ni <main> ni repères de document ici.
          region: { enabled: false },
          'landmark-one-main': { enabled: false },
          'page-has-heading-one': { enabled: false },
        },
      });
      return res.violations.map(
        (v) => `${v.id} (${v.impact}) : ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(' | ')}`
      );
    };

    it('le balayage détecte bien un défaut (témoin : un bouton dans un role="button", l’ancien KitRow)', async () => {
      const { container } = render(
        <div role="button" tabIndex={0}>
          <button type="button" aria-label="Emballer">
            x
          </button>
        </div>
      );
      const found = await scan(container);
      expect(found.some((f) => f.startsWith('nested-interactive'))).toBe(true);
    });

    it('l’écran du Compas, sur chacune des cinq étapes', async () => {
      for (const step of ['ou', 'nous', 'resa', 'verdict', 'kit'] as const) {
        render(<CompasScreen data={makeData()} initialStep={step} />);
        expect(await scan(document.body), `étape ${step}`).toEqual([]);
        cleanup();
      }
    });

    it('fiche d’un objet, porteur, Emprunter / Louer / Acheter, Ajouter au kit, sac d’un membre', async () => {
      render(<CompasScreen data={makeData()} initialStep="kit" />);
      const settle = () => new Promise((r) => setTimeout(r, 50));
      const current = async () => {
        await settle();
        return screen.getByRole('dialog');
      };
      const click = async (name: RegExp) => {
        fireEvent.click(within(await current()).getByRole('button', { name }));
        await settle();
      };
      fireEvent.click(screen.getByRole('button', { name: /^Détails : / }));
      await click(/Tout/);
      // fiche de l'objet à trouver (sac de couchage), puis ses quatre sorties
      fireEvent.click(within(await current()).getByText('Sac de couchage'));
      expect(await scan(await current()), 'fiche objet').toEqual([]);
      await click(/Porteur/);
      expect(await scan(await current()), 'porteur').toEqual([]);
      await click(/^Retour$/);
      await click(/Acheter/);
      expect(await scan(await current()), 'acheter').toEqual([]);
      await click(/^Retour$/);
      await click(/Emprunter/);
      expect(await scan(await current()), 'emprunter').toEqual([]);
      await click(/^Retour$/);
      await click(/Louer/);
      expect(await scan(await current()), 'louer').toEqual([]);
      // ajouter au kit, puis sac d'un membre (flux « Sacs »)
      cleanup();
      render(<CompasScreen data={makeData()} initialStep="kit" />);
      fireEvent.click(screen.getByRole('button', { name: /^Détails : / }));
      await click(/Tout/);
      await click(/Ajouter au kit/);
      expect(await scan(await current()), 'ajouter au kit').toEqual([]);
      cleanup();
      render(<CompasScreen data={makeData()} initialStep="kit" />);
      fireEvent.click(screen.getByRole('button', { name: /^Détails : / }));
      await click(/Sacs/);
      fireEvent.click(within(await current()).getAllByRole('button', { name: /Tony/ })[0]);
      expect(await scan(await current()), 'sac d’un membre').toEqual([]);
    });

    const CASES = (Object.keys(STEP_FLOWS) as Array<keyof typeof STEP_FLOWS>).flatMap((step) =>
      STEP_FLOWS[step].map((f) => [step, f.id, f.label] as const)
    );
    it.each(CASES)('tiroir %s / %s (%s)', async (step, _flow, label) => {
      render(<CompasScreen data={makeData()} initialStep={step} />);
      fireEvent.click(screen.getByRole('button', { name: /^Détails : / }));
      const sheet = await screen.findByRole('dialog');
      const tabs = within(sheet).getByRole('group', { name: 'Parcours du tiroir' });
      const tab = within(tabs)
        .getAllByRole('button')
        .find((b) => b.textContent?.trim() === label);
      expect(tab, `onglet ${label}`).toBeTruthy();
      fireEvent.click(tab as HTMLElement);
      // Les parcours chargent parfois (Mes kits, bouteille…) : on laisse l'état se poser.
      await new Promise((r) => setTimeout(r, 50));
      expect(await scan(screen.getByRole('dialog')), `${step}/${label}`).toEqual([]);
    });
  });

});

describe('CompasScreen : la mention « IA » (lot Z2, PLAN-100 5.3)', () => {
  const openParcours = async () => {
    fireEvent.click(within(stepsNav()).getByRole('button', { name: /Où/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Détails : Préparer' }));
    const sheet = await screen.findByRole('dialog', { name: 'Préparer' });
    fireEvent.click(within(sheet).getByRole('button', { name: /Parcours/ }));
    return sheet;
  };
  const withAiStep = (aiOn = true): CompasData => {
    const data = makeData();
    data.aiOn = aiOn;
    data.itinerary = data.itinerary.map((st, i) => ({ ...st, aiProposed: i === 0 }));
    return data;
  };

  it('Parcours · étapes : seule l’étape proposée par l’IA le dit, en texte, sur sa ligne', async () => {
    render(<CompasScreen data={withAiStep()} />);
    const sheet = await openParcours();
    const labels = await within(sheet).findAllByText(AI_STEP_LABEL);
    expect(labels).toHaveLength(1);
    expect(labels[0].closest('.cp-row')?.textContent).toContain('Gavarnie');
    // La seconde étape n'est pas de l'IA : sa ligne ne le dit pas.
    const second = within(sheet).getByText(/^Jour 2 ·/).closest('.cp-row');
    expect(second?.textContent).toContain('Refuge');
    expect(second?.textContent).not.toContain(AI_STEP_LABEL);
  });

  it('Parcours · étapes calculées par le Compas : aucune mention', async () => {
    render(<CompasScreen data={makeData()} />);
    const sheet = await openParcours();
    expect(await within(sheet).findByText('Gavarnie')).toBeTruthy();
    expect(within(sheet).queryByText(AI_STEP_LABEL)).toBeNull();
  });

  it('étape déjà proposée par l’IA, puis IA éteinte : la mention reste (le contenu, lui, existe)', async () => {
    render(<CompasScreen data={withAiStep(false)} />);
    const sheet = await openParcours();
    expect(await within(sheet).findAllByText(AI_STEP_LABEL)).toHaveLength(1);
  });

  it('conseil de l’IA dans les notes de la préparation : « Suggestion de l’IA (facultatif) » est lu avec lui', () => {
    const data = { ...makeData(), autofill: 'done' as const, autofillNotes: [aiSuggestion('Prévois une frontale de secours.')] };
    render(<CompasScreen data={data} initialStep="ou" />);
    expect(screen.getByText('Suggestion de l’IA (facultatif) : prévois une frontale de secours.')).toBeTruthy();
  });

  describe('Verdict · Risques : « Expliquer avec l’IA »', () => {
    const openRisks = async () => {
      fireEvent.click(within(stepsNav()).getByRole('button', { name: /Verdict/ }));
      fireEvent.click(screen.getByRole('button', { name: /^Détails : / }));
      return screen.findByRole('dialog');
    };

    it('IA allumée : le bouton est là, son libellé dit que c’est l’IA', async () => {
      render(<CompasScreen data={makeData()} />);
      const sheet = await openRisks();
      expect(within(sheet).getByRole('button', { name: 'Expliquer avec l’IA' })).toBeTruthy();
    });

    it('IA éteinte (AI_MODE=off) : ni bouton ni mot sur l’IA dans le tiroir', async () => {
      render(<CompasScreen data={{ ...makeData(), aiOn: false }} />);
      const sheet = await openRisks();
      expect(within(sheet).queryByRole('button', { name: /IA/ })).toBeNull();
      expect(sheet.textContent ?? '').not.toMatch(/\bIA\b/);
    });
  });

  describe('préparation lancée depuis la demande (panneau visible)', () => {
    const say = () => ({ ...makeData(), startSay: 'rando à 4' }) as CompasData;
    const panel = () => screen.findByRole('status', { name: 'Préparation de l’aventure' });

    it('IA allumée : la mention est dite dès le démarrage, dans le panneau', async () => {
      render(<CompasScreen data={say()} />);
      const p = await panel();
      expect(within(p).getByRole('note').textContent).toContain(AI_NOTICE_RUN);
    });

    it('IA éteinte : le panneau ne parle pas d’IA', async () => {
      render(<CompasScreen data={{ ...say(), aiOn: false }} />);
      const p = await panel();
      expect(within(p).queryByRole('note')).toBeNull();
      expect(p.textContent ?? '').not.toMatch(/\bIA\b/);
    });

    it('terminée : la mention « l’IA a contribué » suit ce que le serveur dit avoir produit', async () => {
      render(<CompasScreen data={{ ...say(), autofill: 'none' }} />);
      expect(await screen.findByText('Ton aventure est prête')).toBeTruthy();
      expect(within(await panel()).getByRole('note').textContent).toContain(AI_NOTICE_DONE);
    });

    it('terminée sans que l’IA ait rien produit : plus aucune mention', async () => {
      autofill.compasAutofillAction.mockResolvedValueOnce({
        success: true,
        summary: {
          nights: [],
          transport: null,
          kit: { inventaire: 0, pret: 0, location: 0, achat: 0, a_trouver: 0 },
          budget: [],
          total: 0,
          notes: [],
          usedAi: false,
          stepsCreated: 0,
        },
      } as never);
      render(<CompasScreen data={{ ...say(), autofill: 'none' }} />);
      expect(await screen.findByText('Ton aventure est prête')).toBeTruthy();
      expect(within(await panel()).queryByRole('note')).toBeNull();
    });
  });

  it('Dis-le : l’IA qui a compris est dite en texte (pas seulement l’icône) ; les règles seules ne le disent pas', async () => {
    compas.compasInterpretAction.mockResolvedValueOnce({
      success: true,
      usedAi: true,
      note: null,
      proposals: [
        { id: '0-set_party_size', action: { type: 'set_party_size', count: 4 }, label: '4 personnes', ok: true, reason: null, source: 'ia' },
        { id: '1-set_pace', action: { type: 'set_pace', pace: 'tranquille' }, label: 'Rythme tranquille', ok: true, reason: null, source: 'regles' },
      ],
    });
    render(<CompasScreen data={makeData()} />);
    fireEvent.click(within(stepsNav()).getByRole('button', { name: /Où/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Détails : Préparer' }));
    const sheet = await screen.findByRole('dialog', { name: 'Préparer' });
    fireEvent.click(within(sheet).getByRole('button', { name: /Quand/ }));
    fireEvent.change(within(sheet).getByLabelText('Dis-le'), { target: { value: 'à 4, tranquille' } });
    fireEvent.click(within(sheet).getByRole('button', { name: 'Comprendre la phrase' }));
    expect(await within(sheet).findByText('Compris par l’IA, vérifié par le Compas.')).toBeTruthy();
    // La pastille de la proposition de l'IA a un nom en texte ; celle des règles n'en a pas.
    const ai = within(sheet).getByText('4 personnes').closest('label');
    const rules = within(sheet).getByText('Rythme tranquille').closest('label');
    expect(ai?.textContent).toContain('Compris par l’IA');
    expect(rules?.textContent).not.toContain('Compris par l’IA');
    expect(ai?.querySelector('[aria-label="Compris par l’IA"]')).toBeNull();
  });

  describe('axe-core : les écrans touchés, avec la mention', () => {
    const scan = async (root: Element): Promise<string[]> => {
      const res = await axe.run(root as HTMLElement, {
        runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] },
        rules: {
          'color-contrast': { enabled: false },
          region: { enabled: false },
          'landmark-one-main': { enabled: false },
          'page-has-heading-one': { enabled: false },
        },
      });
      return res.violations.map(
        (v) => `${v.id} (${v.impact}) : ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(' | ')}`
      );
    };

    it('Parcours · étapes avec une étape de l’IA', async () => {
      render(<CompasScreen data={withAiStep()} />);
      const sheet = await openParcours();
      await within(sheet).findAllByText(AI_STEP_LABEL);
      expect(await scan(sheet)).toEqual([]);
    });

    it('Verdict · Risques avec « Expliquer avec l’IA »', async () => {
      render(<CompasScreen data={makeData()} />);
      fireEvent.click(within(stepsNav()).getByRole('button', { name: /Verdict/ }));
      fireEvent.click(screen.getByRole('button', { name: /^Détails : / }));
      const sheet = await screen.findByRole('dialog');
      expect(within(sheet).getByRole('button', { name: 'Expliquer avec l’IA' })).toBeTruthy();
      expect(await scan(sheet)).toEqual([]);
    });

    it('le panneau de préparation, mention comprise', async () => {
      render(<CompasScreen data={{ ...makeData(), startSay: 'rando à 4' }} />);
      const p = await screen.findByRole('status', { name: 'Préparation de l’aventure' });
      expect(within(p).getByRole('note')).toBeTruthy();
      expect(await scan(p)).toEqual([]);
    });

    it('les notes d’une préparation qui contient un conseil de l’IA', async () => {
      const data = { ...makeData(), autofill: 'done' as const, autofillNotes: [aiSuggestion('Prévois une frontale de secours.')] };
      const { container } = render(<CompasScreen data={data} initialStep="ou" />);
      expect(screen.getByText(/^Suggestion de l’IA \(facultatif\) : /)).toBeTruthy();
      expect(await scan(container)).toEqual([]);
    });
  });
});

describe('CompasScreen : divulgation d’affiliation avant les offres (lot Z2, PLAN-100 5.3)', () => {
  /** La divulgation (Art. L121-2 et L121-3 du Code de la consommation) : la note « Transparence publicitaire ». */
  const disclosure = (root: HTMLElement) => within(root).getByRole('note', { name: /Transparence publicitaire et affiliation/ });
  const precedes = (a: Element, b: Element) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
  /** Tout lien sortant d'une offre est balisé « sponsored nofollow » (DGCCRF, balisage rel). */
  const expectSponsored = (root: HTMLElement) => {
    const links = Array.from(root.querySelectorAll<HTMLAnchorElement>('a[target="_blank"]'));
    expect(links.length).toBeGreaterThan(0);
    for (const a of links) {
      const rel = (a.getAttribute('rel') ?? '').split(/\s+/);
      expect(rel, a.outerHTML).toContain('sponsored');
      expect(rel, a.outerHTML).toContain('nofollow');
    }
  };
  const openNights = async () => {
    const data = makeData();
    data.providers = { routestack: 'sandbox', viator: 'disabled' };
    render(<CompasScreen data={data} />);
    fireEvent.click(within(stepsNav()).getByRole('button', { name: /Résa/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Détails : Mes réservations' }));
    const sheet = await screen.findByRole('dialog', { name: 'Mes réservations' });
    fireEvent.click(
      within(within(sheet).getByRole('group', { name: 'Parcours du tiroir' })).getByRole('button', { name: /Nuits/ })
    );
    return sheet;
  };

  it('Nuits · recherche en direct : la divulgation est dite AVANT la liste des offres, qui sont balisées', async () => {
    const sheet = await openNights();
    // Avant la recherche : aucune offre, donc aucune divulgation.
    expect(within(sheet).queryByRole('note', { name: /Transparence publicitaire/ })).toBeNull();
    fireEvent.click(within(sheet).getByRole('button', { name: 'Chercher' }));
    expect(await within(sheet).findByText('Gîte des Cimes')).toBeTruthy();
    const list = within(sheet).getByRole('group', { name: 'Offres d’hébergement' });
    expect(precedes(disclosure(sheet), list)).toBe(true);
    expectSponsored(sheet);
  });

  it('Nuits · recherche en direct sans offre : pas de divulgation (rien n’est vendu)', async () => {
    compas.compasSearchStaysAction.mockResolvedValueOnce({
      success: true,
      mode: 'live',
      fetchedAt: '2026-10-01T10:00:00Z',
      offers: [],
    } as never);
    const sheet = await openNights();
    fireEvent.click(within(sheet).getByRole('button', { name: 'Chercher' }));
    expect(await within(sheet).findByText('Aucune offre trouvée pour cette nuit.')).toBeTruthy();
    expect(within(sheet).queryByRole('note', { name: /Transparence publicitaire/ })).toBeNull();
  });

  it('Parcours · activités partenaires : la divulgation précède la liste (et non plus la suit)', async () => {
    render(<CompasScreen data={makeData()} />);
    fireEvent.click(within(stepsNav()).getByRole('button', { name: /Où/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Détails : Préparer' }));
    const sheet = await screen.findByRole('dialog', { name: 'Préparer' });
    fireEvent.click(within(sheet).getByRole('button', { name: /Parcours/ }));
    fireEvent.change(within(sheet).getByRole('searchbox'), { target: { value: 'Gavarnie' } });
    fireEvent.click(within(sheet).getByRole('button', { name: 'Chercher' }));
    const partner = await within(sheet).findByRole('link', { name: /Cirque de Gavarnie avec un guide/ });
    const list = sheet.querySelector('[aria-label="Parcours trouvés"]') as HTMLElement;
    expect(list).toBeTruthy();
    expect(list.contains(partner)).toBe(true);
    expect(precedes(disclosure(sheet), list)).toBe(true);
    expectSponsored(sheet);
  });

  it('Parcours sans activité partenaire : pas de divulgation', async () => {
    resa.compasNearbyActivitiesAction.mockResolvedValueOnce({ success: true, unavailable: false, offers: [] } as never);
    render(<CompasScreen data={makeData()} />);
    fireEvent.click(within(stepsNav()).getByRole('button', { name: /Où/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Détails : Préparer' }));
    const sheet = await screen.findByRole('dialog', { name: 'Préparer' });
    fireEvent.click(within(sheet).getByRole('button', { name: /Parcours/ }));
    fireEvent.change(within(sheet).getByRole('searchbox'), { target: { value: 'Gavarnie' } });
    fireEvent.click(within(sheet).getByRole('button', { name: 'Chercher' }));
    await waitFor(() => expect(resa.compasNearbyActivitiesAction).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 30));
    expect(within(sheet).queryByRole('note', { name: /Transparence publicitaire/ })).toBeNull();
  });

  it('Résa · recherche en direct (vols) et offres Extras : divulgation avant la liste, liens balisés', async () => {
    const data = makeData();
    data.affiliateLinks = [{ id: 'a2', label: 'Assurance', category: 'insurance', partner: 'Heymondo', url: '/go/ass' }];
    render(<CompasScreen data={data} />);
    fireEvent.click(within(stepsNav()).getByRole('button', { name: /Résa/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Vols' }));
    const sheet = await screen.findByRole('dialog', { name: 'Mes réservations' });
    const form = within(sheet).getByRole('form', { name: 'Chercher : vols' });
    fireEvent.change(within(form).getByLabelText('Départ de'), { target: { value: 'Lyon' } });
    fireEvent.click(within(form).getByRole('button', { name: /Chercher en direct/ }));
    expect(await within(sheet).findByText('Lyon → Pau')).toBeTruthy();
    const live = sheet.querySelector('[aria-label="Offres en direct"]') as HTMLElement;
    const notes = within(sheet).getAllByRole('note', { name: /Transparence publicitaire/ });
    // Une divulgation avant « Offres en direct ».
    expect(notes.some((n) => precedes(n, live))).toBe(true);
    expectSponsored(sheet);
    fireEvent.click(within(within(sheet).getByRole('group', { name: 'Catégorie' })).getByText('Extras'));
    const extras = sheet.querySelector('[aria-label="Offres partenaires"]') as HTMLElement;
    expect(extras).toBeTruthy();
    const noteBeforeExtras = within(sheet).getAllByRole('note', { name: /Transparence publicitaire/ }).filter((n) => precedes(n, extras));
    expect(noteBeforeExtras.length).toBeGreaterThan(0);
    expectSponsored(sheet);
  });

  it('axe-core : la recherche d’hébergement avec sa divulgation', async () => {
    const sheet = await openNights();
    fireEvent.click(within(sheet).getByRole('button', { name: 'Chercher' }));
    expect(await within(sheet).findByText('Gîte des Cimes')).toBeTruthy();
    expect(disclosure(sheet)).toBeTruthy();
    const res = await axe.run(sheet, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] },
      rules: {
        'color-contrast': { enabled: false },
        region: { enabled: false },
        'landmark-one-main': { enabled: false },
        'page-has-heading-one': { enabled: false },
      },
    });
    expect(res.violations.map((v) => `${v.id} : ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`)).toEqual([]);
  });
});
