import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  getTripBookingOverview,
  toBookingOverviewEntry,
  toCartOverviewEntry,
} from '@/features/hub/server/getTripBookingOverview';
import type { PublicBooking } from '@/features/booking/server/bookingPersistence';
import type { CartLine } from '@/features/cart/cartTypes';
import { cartLineRow, createFakeSupabase, type TableHandler } from '../cart/fakeSupabase';

/**
 * W6 (P4) — le hub doit lire `bookings` et `cart_lines`, tables qui existent
 * depuis P1 sans avoir jamais ete branchees sur une section.
 *
 * Le cas qui compte le plus n'est pas le chemin nominal : c'est la migration
 * absente. Les quatre migrations du chantier ne sont pas appliquees partout,
 * et une section budget qui renvoie 500 sur `/hub/budget` casserait le hub
 * entier. Une table manquante doit degrader l'apercu, pas la page.
 */

const USER = 'user-1';
const TRIP = 'trip-1';

function bookingRow(overrides: Record<string, unknown> = {}) {
  return {
    id: '22222222-2222-4222-8222-222222222222',
    trip_id: TRIP,
    vertical: 'flight',
    provider: 'routestack',
    external_ref: 'FL-1',
    amount_eur: 640.5,
    currency: 'EUR',
    status: 'pending',
    checkout_mode: 'deeplink',
    metadata: { title: 'CDG -> NRT', checkout_channel: 'deeplink' },
    created_at: '2026-09-27T08:00:00.000Z',
    updated_at: '2026-09-27T08:00:00.000Z',
    ...overrides,
  };
}

function client(tables: Record<string, TableHandler>) {
  return createFakeSupabase({ tables, userId: USER }) as unknown as SupabaseClient;
}

const tripsTable: TableHandler = (_op, state) =>
  state.filters.id === TRIP
    ? { data: { id: TRIP, user_id: USER }, error: null }
    : { data: null, error: null };

describe('getTripBookingOverview', () => {
  it('lit les reservations et le panier du voyage', async () => {
    const overview = await getTripBookingOverview(
      client({
        trips: tripsTable,
        bookings: () => ({ data: [bookingRow()], error: null }),
        cart_lines: () => ({ data: [cartLineRow()], error: null }),
      }),
      { tripId: TRIP, userId: USER }
    );

    expect(overview.bookingsAvailable).toBe(true);
    expect(overview.cartAvailable).toBe(true);
    expect(overview.reservations).toHaveLength(1);
    expect(overview.reservations[0]).toMatchObject({
      title: 'CDG -> NRT',
      amountEur: 640.5,
      checkoutChannel: 'deeplink',
    });
    expect(overview.cartLines).toHaveLength(1);
    expect(overview.cartTotals.totalEur).toBe(49.9);
  });

  it('ne compte en pending que les reservations non confirmees', async () => {
    const overview = await getTripBookingOverview(
      client({
        trips: tripsTable,
        bookings: () => ({
          data: [
            bookingRow({ id: 'a', status: 'pending', amount_eur: 100 }),
            bookingRow({ id: 'b', status: 'confirmed', amount_eur: 250 }),
            bookingRow({ id: 'c', status: 'cancelled', amount_eur: 400 }),
          ],
          error: null,
        }),
        cart_lines: () => ({ data: [], error: null }),
      }),
      { tripId: TRIP, userId: USER }
    );

    // Une reservation confirmee n'est pas un encours, une annulee non plus.
    expect(overview.pendingEur).toBe(100);
  });

  it('migration bookings absente : degrade les reservations, garde le panier', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const overview = await getTripBookingOverview(
      client({
        trips: tripsTable,
        bookings: () => ({ data: null, error: { code: '42P01', message: 'relation absente' } }),
        cart_lines: () => ({ data: [cartLineRow()], error: null }),
      }),
      { tripId: TRIP, userId: USER }
    );

    expect(overview.bookingsAvailable).toBe(false);
    expect(overview.cartAvailable).toBe(true);
    expect(overview.reservations).toEqual([]);
    expect(overview.cartLines).toHaveLength(1);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('migration cart_lines absente : degrade le panier, garde les reservations', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const overview = await getTripBookingOverview(
      client({
        trips: tripsTable,
        bookings: () => ({ data: [bookingRow()], error: null }),
        cart_lines: () => ({ data: null, error: { code: 'PGRST205', message: 'absente' } }),
      }),
      { tripId: TRIP, userId: USER }
    );

    expect(overview.cartAvailable).toBe(false);
    expect(overview.bookingsAvailable).toBe(true);
    expect(overview.reservations).toHaveLength(1);
    expect(overview.cartTotals.totalEur).toBe(0);
    warn.mockRestore();
  });

  it('les deux tables absentes : aucunmontant invente', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const overview = await getTripBookingOverview(
      client({
        trips: tripsTable,
        bookings: () => ({ data: null, error: { code: '42P01', message: 'absente' } }),
        cart_lines: () => ({ data: null, error: { code: '42P01', message: 'absente' } }),
      }),
      { tripId: TRIP, userId: USER }
    );

    expect(overview.bookingsAvailable).toBe(false);
    expect(overview.cartAvailable).toBe(false);
    expect(overview.reservations).toEqual([]);
    expect(overview.cartLines).toEqual([]);
    expect(overview.pendingEur).toBe(0);
    expect(overview.cartTotals.totalEur).toBe(0);
    warn.mockRestore();
  });

  it('une panne RLS est journalisee comme une erreur, pas comme une migration absente', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    await getTripBookingOverview(
      client({
        trips: tripsTable,
        bookings: () => ({ data: null, error: { code: '42501', message: 'RLS' } }),
        cart_lines: () => ({ data: [], error: null }),
      }),
      { tripId: TRIP, userId: USER }
    );

    expect(warn).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalled();
    // Le message Postgres n'est jamais journalise : il peut contenir du SQL.
    const logged = JSON.stringify(error.mock.calls);
    expect(logged).not.toContain('RLS');
    warn.mockRestore();
    error.mockRestore();
  });
});

describe('toBookingOverviewEntry', () => {
  const base: PublicBooking = {
    id: 'b1',
    trip_id: TRIP,
    vertical: 'flight',
    provider: 'routestack',
    external_ref: null,
    amount_eur: 10,
    currency: 'EUR',
    status: 'pending',
    checkout_mode: 'deeplink',
    metadata: {},
    created_at: '2026-09-27T08:00:00.000Z',
    updated_at: '2026-09-27T08:00:00.000Z',
  };

  it('retombe sur un libelle de verticale plutot que d inventer un titre', () => {
    const entry = toBookingOverviewEntry(base);
    expect(entry.title).toBe('Vol');
    expect(entry.checkoutChannel).toBeNull();
  });

  it('porte le canal de checkout externe lu dans les metadonnees', () => {
    const entry = toBookingOverviewEntry({
      ...base,
      provider: 'viator',
      vertical: 'activity',
      checkout_mode: 'deeplink',
      metadata: { checkout_channel: 'external' },
    });
    // La colonne reste un enum valide, la nature externe vit dans les metadonnees.
    expect(entry.checkoutMode).toBe('deeplink');
    expect(entry.checkoutChannel).toBe('external');
  });

  it('un montant non numerique devient 0, jamais NaN dans le rendu', () => {
    const entry = toBookingOverviewEntry({ ...base, amount_eur: Number.NaN });
    expect(entry.amountEur).toBe(0);
  });
});

describe('toCartOverviewEntry', () => {
  it('remonte le titre resolu cote serveur', () => {
    const line = {
      id: 'l1',
      userId: USER,
      tripId: TRIP,
      kind: 'booking',
      refId: 'b1',
      quantity: 2,
      unitPriceEur: 30,
      currency: 'EUR',
      metadata: { title: 'Nuit au refuge' },
      createdAt: '2026-09-27T08:00:00.000Z',
      updatedAt: '2026-09-27T08:00:00.000Z',
    } satisfies CartLine;

    expect(toCartOverviewEntry(line)).toMatchObject({
      kind: 'booking',
      quantity: 2,
      unitPriceEur: 30,
      title: 'Nuit au refuge',
    });
  });

  it('ligne sans titre : null plutot qu un libelle fabrique', () => {
    const line = {
      id: 'l2',
      userId: USER,
      tripId: TRIP,
      kind: 'product',
      refId: 'p1',
      quantity: 1,
      unitPriceEur: 12,
      currency: 'EUR',
      metadata: {},
      createdAt: '2026-09-27T08:00:00.000Z',
      updatedAt: '2026-09-27T08:00:00.000Z',
    } satisfies CartLine;

    expect(toCartOverviewEntry(line).title).toBeNull();
  });
});
