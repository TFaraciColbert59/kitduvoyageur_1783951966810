import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Lecture du voyage (`/voyages`, hub) : la dépense « Formalités » rangée par une préparation d'avant le
 * lot Z1 dit la nationalité du lanceur ; retirée tant qu'elle est planifiée et intacte, comme dans le
 * Compas (`getCompasData`) : les deux écrans comptent la même chose. Réglée ou retouchée par la
 * personne, elle reste comptée normalement, quelle que soit sa base.
 */
const h = vi.hoisted(() => ({ db: null as unknown as MemorySupabase }));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => h.db.client }));

import { getTripBySlug } from '@/lib/queries-trips';
import { memorySupabase, type MemorySupabase, type Row } from './helpers/memorySupabase';

const TRIP = '88888888-8888-4888-8888-888888888888';
const CREATED = '2026-10-09T09:00:00.000Z';
const prepared = (basis?: string) => ({ autofill: 'run-0', source: 'estimation', ...(basis === undefined ? {} : { basis }) });

const expense = (id: string, over: Partial<Row>): Row => ({
  id,
  trip_id: TRIP,
  payer_id: 'u1',
  title: 'Formalités : ESTA (40 $)',
  amount: 70,
  currency: 'EUR',
  category: 'divers',
  expense_date: '2026-11-10',
  split_type: 'equal',
  is_planned: true,
  metadata: prepared('barème Compas 2026-10 · ressortissant français, tarif officiel connu'),
  created_at: CREATED,
  updated_at: CREATED,
  ...over,
});

beforeEach(() => {
  h.db = memorySupabase({ user: () => ({ id: 'u2' }) });
  h.db.rows('trips').push({
    id: TRIP,
    slug: 'voyage',
    user_id: 'u1',
    title: 'Séjour · New York',
    visibility: 'public',
    share_token: null,
    metadata: {},
  });
});

const titlesOf = async () => (await getTripBySlug('voyage', 'u2'))?.expenses.map((e) => e.id) ?? [];

describe('getTripBySlug : la dépense « Formalités » d’une ancienne préparation', () => {
  it('planifiée et intacte : retirée, quelle que soit sa base', async () => {
    h.db.rows('trip_expenses').push(
      expense('base-francais', {}),
      expense('base-autre', { metadata: prepared('barème Compas 2026-09 · tarif officiel connu') }),
      expense('sans-base', { metadata: prepared() })
    );
    expect(await titlesOf()).toEqual([]);
  });

  it('réglée ou retouchée depuis sa création : elle reste, comptée comme les autres', async () => {
    h.db.rows('trip_expenses').push(
      expense('reglee', { is_planned: false }),
      expense('retouchee', { updated_at: '2026-10-10T18:30:00.000Z' }),
      expense('intacte', {})
    );
    expect(await titlesOf()).toEqual(['reglee', 'retouchee']);
  });

  it('saisie à la main (aucune signature de la préparation), même nommée ainsi : elle reste', async () => {
    h.db.rows('trip_expenses').push(
      expense('main', { title: 'Formalités : visa étudiant', amount: 12, metadata: null }),
      expense('parking', { title: 'Parking', amount: 7 })
    );
    expect(await titlesOf()).toEqual(['main', 'parking']);
  });
});
