'use server';

import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import {
  buildItemHistory,
  type HistoryEntry,
  type RawLoan,
  type RawOrder,
  type RawPastTrip,
} from '../engine/itemHistory';

/**
 * Historique d'un objet du kit, en LECTURE seule : prêts, autres voyages, commandes du produit
 * choisi. Tout est lu sous la RLS de la personne (prêts : prêteur ou emprunteur ; voyages :
 * `can_read_trip` ; commandes : les siennes). L'objet est relu côté serveur depuis le voyage : ni
 * l'inventaire ni le produit ne viennent du navigateur. Une source illisible est nommée dans
 * `unavailable`, jamais comblée.
 */

const uuid = z.string().uuid('Identifiant invalide');
const input = z.object({ tripId: uuid, itemId: uuid });

export type CompasHistorySource = 'prêts' | 'voyages' | 'commandes';

export type CompasItemHistoryResult =
  | { success: true; entries: HistoryEntry[]; unavailable: CompasHistorySource[] }
  | { success: false; error: string };

export async function compasItemHistoryAction(raw: unknown): Promise<CompasItemHistoryResult> {
  const parsed = input.safeParse(raw);
  if (!parsed.success) return { success: false, error: 'Objet invalide.' };
  const { tripId, itemId } = parsed.data;
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Connecte-toi pour voir l’historique.' };

    const { data: item } = await supabase
      .from('trip_items')
      .select('id, trip_id, inventory_item_id, shop_product_id')
      .eq('id', itemId)
      .eq('trip_id', tripId)
      .maybeSingle();
    const row = item as { inventory_item_id: string | null; shop_product_id: string | null } | null;
    if (!row) return { success: false, error: 'Objet introuvable ou non autorisé.' };

    const unavailable: CompasHistorySource[] = [];

    const loans = async (): Promise<RawLoan[]> => {
      if (!row.inventory_item_id) return [];
      const { data, error } = await supabase
        .from('materiel_loans')
        .select('id, status, loaned_at, due_date, returned_at, borrower_contact')
        .eq('product_ownership_id', row.inventory_item_id)
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []) as RawLoan[];
    };

    const trips = async (): Promise<RawPastTrip[]> => {
      if (!row.inventory_item_id) return [];
      const { data, error } = await supabase
        .from('trip_items')
        .select('trip_id')
        .eq('inventory_item_id', row.inventory_item_id)
        .limit(50);
      if (error) throw error;
      const ids = [
        ...new Set(
          ((data ?? []) as Array<{ trip_id: string }>).map((r) => r.trip_id).filter((id) => id !== tripId)
        ),
      ];
      if (!ids.length) return [];
      const { data: found, error: e2 } = await supabase
        .from('trips')
        .select('id, title, start_date, end_date')
        .in('id', ids)
        .limit(50);
      if (e2) throw e2;
      return ((found ?? []) as Array<{ id: string; title: string | null; start_date: string | null; end_date: string | null }>).map(
        (t) => ({ trip_id: t.id, title: t.title, start_date: t.start_date, end_date: t.end_date })
      );
    };

    const orders = async (): Promise<RawOrder[]> => {
      if (!row.shop_product_id) return [];
      const { data, error } = await supabase
        .from('order_items')
        .select('id, order_id, quantity, total_price_eur, transaction_type')
        .eq('product_id', row.shop_product_id)
        .limit(50);
      if (error) throw error;
      const lines = (data ?? []) as Array<{
        id: string;
        order_id: string;
        quantity: number | null;
        total_price_eur: number | null;
        transaction_type: string | null;
      }>;
      if (!lines.length) return [];
      const { data: heads, error: e2 } = await supabase
        .from('orders')
        .select('id, order_number, status, created_at, user_id')
        .in('id', [...new Set(lines.map((l) => l.order_id))])
        .eq('user_id', user.id)
        .limit(50);
      if (e2) throw e2;
      const byId = new Map(
        ((heads ?? []) as Array<{ id: string; order_number: string | null; status: string | null; created_at: string | null }>).map(
          (h) => [h.id, h]
        )
      );
      return lines.flatMap((l) => {
        const h = byId.get(l.order_id);
        return h
          ? [
              {
                id: l.id,
                order_number: h.order_number,
                status: h.status,
                created_at: h.created_at,
                quantity: l.quantity,
                total_price_eur: l.total_price_eur,
                transaction_type: l.transaction_type,
              },
            ]
          : [];
      });
    };

    const settle = async <T,>(name: CompasHistorySource, run: () => Promise<T[]>): Promise<T[]> => {
      try {
        return await run();
      } catch {
        unavailable.push(name);
        return [];
      }
    };
    const [l, t, o] = await Promise.all([
      settle('prêts', loans),
      settle('voyages', trips),
      settle('commandes', orders),
    ]);
    return { success: true, entries: buildItemHistory({ loans: l, trips: t, orders: o }), unavailable };
  } catch {
    return { success: false, error: 'Connexion perdue : réessaie.' };
  }
}
