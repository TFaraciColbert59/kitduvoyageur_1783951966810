import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Historique d'un objet : l'action est la VRAIE ; seule la base est le client en mémoire
 * (`helpers/memorySupabase.ts`). La RLS n'y est pas rejouée : les politiques lues par l'action
 * (prêts : prêteur ou emprunteur ; commandes : les siennes ; voyages : lisibles) sont portées à la main
 * dans `canSelect` d'après `20260825000000_materiel_rebuild.sql` et `20260715240000_inventory_stock_orders.sql`.
 */
const h = vi.hoisted(() => ({
  session: null as { id: string } | null,
  db: null as unknown as MemorySupabase,
  fail: new Set<string>(),
  read: [] as string[],
}));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => h.db.client }));

import { compasItemHistoryAction } from '../server/itemHistoryActions';
import { memorySupabase, type MemorySupabase, type Row } from './helpers/memorySupabase';

const ME = 'aaaaaaaa-0000-4000-8000-000000000001';
const OTHER = 'aaaaaaaa-0000-4000-8000-000000000002';
const TRIP = 'bbbbbbbb-0000-4000-8000-000000000001';
const TRIP2 = 'bbbbbbbb-0000-4000-8000-000000000002';
const TRIP3 = 'bbbbbbbb-0000-4000-8000-000000000003';
const ITEM = 'cccccccc-0000-4000-8000-000000000001';
const INV = 'dddddddd-0000-4000-8000-000000000001';
const PRODUCT = 'eeeeeeee-0000-4000-8000-000000000001';

/** Politique de lecture portée à la main (voir l'en-tête). */
function canSelect(table: string, row: Row): boolean {
  const me = h.session?.id;
  if (!me) return false;
  switch (table) {
    case 'materiel_loans':
      return row.lender_id === me || row.borrower_id === me;
    case 'orders':
      return row.user_id === me;
    case 'trips':
    case 'trip_items':
      return h.db.rows('trips').some((t) => t.id === (table === 'trips' ? row.id : row.trip_id) && t.user_id === me);
    case 'order_items':
      return h.db.rows('orders').some((o) => o.id === row.order_id && o.user_id === me);
    default:
      return true;
  }
}

beforeEach(() => {
  h.session = { id: ME };
  h.fail = new Set();
  h.db = memorySupabase({
    user: () => h.session,
    canSelect,
    onQuery: (q) => {
      h.read.push(q.table);
    },
    failQuery: (q) => (h.fail.has(q.table) ? { code: '500', message: 'panne' } : undefined),
  });
  h.db.rows('trips').push(
    { id: TRIP, user_id: ME, title: 'Trek des 3 Vallées', start_date: '2026-10-14', end_date: '2026-10-18' },
    { id: TRIP2, user_id: ME, title: 'Tour du Mont Blanc', start_date: '2026-07-05', end_date: '2026-07-12' },
    { id: TRIP3, user_id: OTHER, title: 'Voyage d’un autre', start_date: '2026-06-01', end_date: '2026-06-05' }
  );
  h.db.rows('trip_items').push(
    { id: ITEM, trip_id: TRIP, inventory_item_id: INV, shop_product_id: PRODUCT },
    { id: 'x1', trip_id: TRIP2, inventory_item_id: INV, shop_product_id: null },
    { id: 'x2', trip_id: TRIP3, inventory_item_id: INV, shop_product_id: null }
  );
  h.db.rows('materiel_loans').push(
    { id: 'l1', product_ownership_id: INV, lender_id: ME, borrower_id: null, borrower_contact: 'Marc', status: 'rendu', loaned_at: '2026-08-01', due_date: null, returned_at: '2026-08-10', created_at: '2026-08-01' },
    { id: 'l2', product_ownership_id: INV, lender_id: OTHER, borrower_id: OTHER, borrower_contact: 'Secret', status: 'en_cours', loaned_at: '2026-09-01', due_date: null, returned_at: null, created_at: '2026-09-01' }
  );
  h.db.rows('orders').push(
    { id: 'o1', user_id: ME, order_number: 'LKDV-1', status: 'delivered', created_at: '2026-09-02T10:00:00Z' },
    { id: 'o2', user_id: OTHER, order_number: 'LKDV-2', status: 'delivered', created_at: '2026-09-03T10:00:00Z' }
  );
  h.db.rows('order_items').push(
    { id: 'oi1', order_id: 'o1', product_id: PRODUCT, quantity: 1, total_price_eur: 39, transaction_type: 'achat' },
    { id: 'oi2', order_id: 'o2', product_id: PRODUCT, quantity: 1, total_price_eur: 39, transaction_type: 'achat' }
  );
});

describe('compasItemHistoryAction', () => {
  it('prêts, autres voyages et commandes de la personne, du plus récent au plus ancien', async () => {
    const res = await compasItemHistoryAction({ tripId: TRIP, itemId: ITEM });
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.unavailable).toEqual([]);
    expect(res.entries.map((e) => e.id)).toEqual(['commande-oi1', 'pret-l1', 'voyage-' + TRIP2]);
  });

  it('ne montre ni le prêt d’un autre, ni sa commande, ni son voyage, ni le voyage en cours', async () => {
    const res = await compasItemHistoryAction({ tripId: TRIP, itemId: ITEM });
    if (!res.success) throw new Error('attendu : succès');
    const text = JSON.stringify(res.entries);
    expect(text).not.toContain('Secret');
    expect(text).not.toContain('LKDV-2');
    expect(text).not.toContain('Voyage d’un autre');
    expect(text).not.toContain('Trek des 3 Vallées');
  });

  it('objet sans inventaire ni produit : aucune entrée, aucune lecture de prêt, de voyage ni de commande', async () => {
    const FREE = 'cccccccc-0000-4000-8000-000000000009';
    h.db.rows('trip_items').push({ id: FREE, trip_id: TRIP, inventory_item_id: null, shop_product_id: null });
    h.read.length = 0;
    const res = await compasItemHistoryAction({ tripId: TRIP, itemId: FREE });
    expect(res).toEqual({ success: true, entries: [], unavailable: [] });
    expect(h.read).toEqual(['trip_items']);
  });

  it('une source en panne est nommée, les autres sont lues', async () => {
    h.fail.add('materiel_loans');
    const res = await compasItemHistoryAction({ tripId: TRIP, itemId: ITEM });
    if (!res.success) throw new Error('attendu : succès');
    expect(res.unavailable).toEqual(['prêts']);
    expect(res.entries.map((e) => e.kind).sort()).toEqual(['commande', 'voyage']);
  });

  it('sans session : refus ; entrée invalide : refus ; objet d’un voyage non lisible : introuvable', async () => {
    h.session = null;
    expect(await compasItemHistoryAction({ tripId: TRIP, itemId: ITEM })).toEqual({
      success: false,
      error: 'Connecte-toi pour voir l’historique.',
    });
    h.session = { id: ME };
    expect(await compasItemHistoryAction({ tripId: 'pas-un-uuid', itemId: ITEM })).toEqual({
      success: false,
      error: 'Objet invalide.',
    });
    h.session = { id: OTHER };
    expect(await compasItemHistoryAction({ tripId: TRIP, itemId: ITEM })).toEqual({
      success: false,
      error: 'Objet introuvable ou non autorisé.',
    });
  });

  it('ne fait aucune écriture', async () => {
    await compasItemHistoryAction({ tripId: TRIP, itemId: ITEM });
    expect(h.db.writes).toEqual([]);
  });
});
