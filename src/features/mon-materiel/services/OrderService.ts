'use client';

/**
 * LKDV — Mon Matériel : service commandes (`orders`, `order_items`).
 * Permet d'afficher « En commande » et de confirmer la réception d'un article
 * (insert inventaire + marquage `received_at` + destination kit/checklist/départ).
 */

import { createClient } from '@/lib/supabase/client';
import type { UserEquipmentItem, UnifiedProduct } from '@/hooks/useEquipment';
import type { GearDestination, OrderedProductItem } from '../types/gear';
import {
  buildReceptionGear,
  buildReceptionHistory,
  hasDuplicate,
  toOrderedProductItem,
} from '../domain/order-reception';
import { gearDestinationSchema, orderedProductItemSchema } from '../domain/validation';
import { GearService } from './GearService';

export interface OrderConfirmation {
  ok: boolean;
  gear?: UserEquipmentItem;
  error?: string;
  duplicate?: boolean;
}

export interface OrderRow {
  id: string;
  status: string;
  created_at?: string;
}

export class OrderService {
  private supabase = createClient();
  private gearService = new GearService();

  /** Commandes de l'utilisateur (RLS : `user_id = auth.uid()`). */
  async listOrders(userId: string): Promise<OrderRow[]> {
    const { data, error } = await this.supabase
      .from('orders')
      .select('id, status, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) {
      console.warn('[OrderService] listOrders:', error.message);
      return [];
    }
    return (data || []) as OrderRow[];
  }

  /** Lignes de commande de l'utilisateur (RLS : via orders de l'utilisateur). */
  async listOrderItems(
    userId: string,
    destinations: Record<string, GearDestination | undefined>
  ): Promise<OrderedProductItem[]> {
    const orders = await this.listOrders(userId);
    if (orders.length === 0) return [];

    const orderMap = new Map(orders.map((o) => [o.id, o.status]));
    const { data, error } = await this.supabase
      .from('order_items')
      .select('id, order_id, product_id, product_slug, product_name, product_brand, quantity, unit_price_eur, received_at, created_at')
      .in('order_id', orders.map((o) => o.id))
      .order('created_at', { ascending: false })
      .limit(500);

    if (error) {
      console.warn('[OrderService] listOrderItems:', error.message);
      return [];
    }

    const rows = (data || []) as Array<
      Record<string, unknown> & { id: string; order_id: string }
    >;

    return rows
      .filter((row) => !row.received_at && orderMap.has(row.order_id))
      .map((row) => {
        return toOrderedProductItem(row as never, orderMap.get(row.order_id) || null, undefined);
      })
      .map((item) => ({
        ...item,
        destination: destinations[item.productId || item.slug || item.name] || undefined,
      }));
  }

  /**
   * Confirme la réception d'une ligne commandée :
   * 1. crée l'objet d'inventaire (source 'achat'),
   * 2. marque `received_at` sur la ligne,
   * 3. rattache à la destination (kit) si renseignée,
   * 4. écrit l'historique (best-effort).
   */
  async confirmReception(params: {
    userId: string;
    ordered: OrderedProductItem;
    product: UnifiedProduct | null;
    equipment: UserEquipmentItem[];
    destination?: GearDestination;
    onAttachToKit?: (kitId: string, gear: UserEquipmentItem) => Promise<void>;
  }): Promise<OrderConfirmation> {
    const { userId, ordered, product, equipment, destination, onAttachToKit } = params;

    // Validation stricte (Zod) avant toute mutation.
    const orderedParsed = orderedProductItemSchema.safeParse(ordered);
    if (!orderedParsed.success) {
      return { ok: false, error: orderedParsed.error.issues[0]?.message || 'Ligne de commande invalide.' };
    }
    if (destination) {
      const destParsed = gearDestinationSchema.safeParse(destination);
      if (!destParsed.success) {
        return { ok: false, error: destParsed.error.issues[0]?.message || 'Destination invalide.' };
      }
    }

    const gear = buildReceptionGear(ordered, product);
    gear.user_id = userId;

    if (hasDuplicate({ name: gear.name, brand: gear.brand || '', id: product?.id }, equipment)) {
      return { ok: false, duplicate: true, error: 'Objet déjà présent dans l’inventaire.' };
    }

    const inserted = await this.gearService.insertGear(gear);
    if (!inserted.ok) return { ok: false, error: inserted.error };

    // Marquage réception sur la ligne de commande.
    const { error: recvErr } = await this.supabase
      .from('order_items')
      .update({ received_at: new Date().toISOString() })
      .eq('id', ordered.orderItemId);
    if (recvErr) console.warn('[OrderService] received_at update:', recvErr.message);

    // Rattachement à la destination.
    if (destination && destination.type === 'kit' && destination.refId && onAttachToKit) {
      try {
        await onAttachToKit(destination.refId, gear);
      } catch (err) {
        console.warn('[OrderService] attach to kit:', err);
      }
    }

    // Historique.
    for (const event of buildReceptionHistory(ordered, destination)) {
      await this.gearService.writeHistory({ ...event, gear_item_id: gear.id });
    }

    return { ok: true, gear };
  }
}