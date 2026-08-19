'use client';

/**
 * LKDV — Mon Matériel : service Supabase pour l'équipement (`gear_items`).
 * Toutes les lectures/écritures respectent RLS (`user_id = auth.uid()`).
 */

import { createClient } from '@/lib/supabase/client';
import type { UserEquipmentItem } from '@/hooks/useEquipment';
import type { GearHistoryEvent, GearLoanRecord } from '../types/gear';
import type { GearStatusContext } from '../types/gear';

export interface GearMutationResult {
  ok: boolean;
  error?: string;
}

export class GearService {
  private supabase = createClient();

  /** Liste des prêts actifs (table `loans`, lecture seule). */
  async listActiveLoans(_userId: string): Promise<GearLoanRecord[]> {
    const { data, error } = await this.supabase
      .from('loans')
      .select('*')
      .eq('status', 'active')
      .eq('returned_at', null)
      .order('loaned_at', { ascending: false })
      .limit(200);
    if (error) {
      console.warn('[GearService] listActiveLoans:', error.message);
      return [];
    }
    return (data || []) as GearLoanRecord[];
  }

  /** Historique consolidé d'un objet (table `gear_history`, lecture seule). */
  async listHistory(gearId: string): Promise<GearHistoryEvent[]> {
    const { data, error } = await this.supabase
      .from('gear_history')
      .select('*')
      .eq('gear_item_id', gearId)
      .order('event_date', { ascending: false })
      .limit(100);
    if (error) {
      console.warn('[GearService] listHistory:', error.message);
      return [];
    }
    return (data || []) as GearHistoryEvent[];
  }

  /** Insertion d'un nouvel objet (utilisé par le flux commande → réception). */
  async insertGear(gear: UserEquipmentItem): Promise<GearMutationResult> {
    const { error } = await this.supabase
      .from('gear_items')
      .insert({
        id: gear.id,
        user_id: gear.user_id,
        product_id: gear.product_id || null,
        name: gear.name,
        brand: gear.brand || null,
        model: gear.model || null,
        category: gear.category || 'autre',
        weight_g: gear.weight_g || 0,
        purchase_price: gear.purchase_price ?? null,
        purchase_date: gear.acquired_at || gear.purchase_date || null,
        image: gear.image || null,
        condition: gear.condition || 'neuf',
        source: gear.source || 'achat',
        quantity: gear.quantity || 1,
        notes: gear.notes || null,
        is_favorite: Boolean(gear.is_favorite),
        acquired_at: gear.acquired_at || new Date().toISOString().split('T')[0],
        loan_status: gear.loan_status || 'disponible',
        loan_to_name: gear.loan_to_name || null,
      });
    if (error) {
      console.warn('[GearService] insertGear:', error.message);
      return { ok: false, error: error.message };
    }
    return { ok: true };
  }

  /** Écriture d'un événement d'historique (best-effort : RLS SELECT-only possible). */
  async writeHistory(event: GearHistoryEvent): Promise<boolean> {
    const { error } = await this.supabase.from('gear_history').insert({
      gear_item_id: event.gear_item_id,
      event_type: event.event_type || 'misc',
      event_date: event.event_date || new Date().toISOString(),
      notes: event.notes || null,
    });
    if (error) {
      console.warn('[GearService] writeHistory (best-effort):', error.message);
      return false;
    }
    return true;
  }

  /** Marquer un objet comme « rendu » / réglé (coché dans les alertes). */
  async markReviewed(
    gearId: string,
    patch: Partial<UserEquipmentItem>
  ): Promise<GearMutationResult> {
    const { error } = await this.supabase
      .from('gear_items')
      .update({
        last_maintenance_date: new Date().toISOString().split('T')[0],
        next_maintenance_date: null,
        ...patch,
      })
      .eq('id', gearId);
    if (error) {
      console.warn('[GearService] markReviewed:', error.message);
      return { ok: false, error: error.message };
    }
    return { ok: true };
  }
}

/** Construit le contexte du domaine à partir des ressources chargées. */
export function buildGearContext(partial: Partial<GearStatusContext>): GearStatusContext {
  return {
    now: new Date(),
    activeLoans: [],
    orderedItems: [],
    hikeCommittedGearIds: [],
    kitMembershipIds: [],
    activeDeparture: null,
    kits: [],
    plannedHikes: [],
    ...partial,
  };
}