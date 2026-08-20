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

  // ── Projections & analyses (opérations pures sur les données chargées) ────

  /** Objets correspondant à une liste d'ids (table gear_items, RLS auth.uid()). */
  async fetchByIds(ids: string[]): Promise<UserEquipmentItem[]> {
    if (ids.length === 0) return [];
    const { data, error } = await this.supabase
      .from('gear_items')
      .select('*')
      .in('id', ids)
      .limit(500);
    if (error) {
      console.warn('[GearService] fetchByIds:', error.message);
      return [];
    }
    return (data || []) as UserEquipmentItem[];
  }

  /** Objets répondant à un état (`condition`). */
  filterByCondition(equipment: UserEquipmentItem[], condition: UserEquipmentItem['condition']): UserEquipmentItem[] {
    return equipment.filter((e) => e.condition === condition);
  }

  /** Usure moyenne pondérée de l'inventaire (0..100). */
  averageWear(equipment: UserEquipmentItem[]): number {
    const withWear = equipment.filter((e) => typeof e.wear_percentage === 'number');
    if (withWear.length === 0) return 0;
    return Math.round(
      withWear.reduce((sum, e) => sum + (e.wear_percentage || 0), 0) / withWear.length
    );
  }

  /** Top N objets les plus usés (par wear_percentage, puis par condition dégradée). */
  topWear(equipment: UserEquipmentItem[], n = 3): UserEquipmentItem[] {
    const score = (e: UserEquipmentItem): number =>
      Number(e.wear_percentage || 0) +
      (e.condition === 'à_remplacer' ? 100 : e.condition === 'à_réparer' ? 60 : 0);
    return [...equipment].sort((a, b) => score(b) - score(a)).slice(0, n);
  }

  /** Objets avec informations essentielles manquantes (photo, taille, série, état). */
  missingInfo(equipment: UserEquipmentItem[]): UserEquipmentItem[] {
    return equipment.filter(
      (e) => !e.image || !e.size_label || !e.serial_number || !e.condition
    );
  }

  /** Détection de doublons par nom normalisé (threshold 0..1 = similarité). */
  findDuplicates(equipment: UserEquipmentItem[], threshold = 0.9): Array<[UserEquipmentItem, UserEquipmentItem]> {
    const pairs: Array<[UserEquipmentItem, UserEquipmentItem]> = [];
    const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9àâäéèêëîïôöùûüç]/gi, ' ').replace(/\s+/g, ' ').trim();
    for (let i = 0; i < equipment.length; i++) {
      for (let j = i + 1; j < equipment.length; j++) {
        const a = norm(equipment[i].name || '');
        const b = norm(equipment[j].name || '');
        if (!a || !b) continue;
        const sim = this.similarity(a, b);
        if (sim >= threshold) pairs.push([equipment[i], equipment[j]]);
      }
    }
    return pairs;
  }

  private similarity(a: string, b: string): number {
    if (a === b) return 1;
    const longer = a.length > b.length ? a : b;
    const shorter = a.length > b.length ? b : a;
    if (longer.length === 0) return 0;
    // Similarité Levenshtein normalisée.
    const costs = new Array(shorter.length + 1);
    for (let i = 0; i <= shorter.length; i++) costs[i] = i;
    for (let i = 1; i <= longer.length; i++) {
      let prev = costs[0];
      costs[0] = i;
      for (let j = 1; j <= shorter.length; j++) {
        const tmp = costs[j];
        const cost = longer[i - 1] === shorter[j - 1] ? 0 : 1;
        costs[j] = Math.min(costs[j - 1] + 1, costs[j] + 1, prev + cost);
        prev = tmp;
      }
    }
    return 1 - costs[shorter.length] / longer.length;
  }

  /** Objets dormants : jamais/n'plus utilisés depuis `months` mois. */
  idleSince(equipment: UserEquipmentItem[], months = 6): UserEquipmentItem[] {
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - months);
    return equipment.filter((e) => {
      const lastUsed = (e as UserEquipmentItem & { last_used_at?: string }).last_used_at || e.last_used_date;
      if (lastUsed) {
        const last = new Date(lastUsed);
        if (Number.isNaN(last.getTime())) return !e.usage_count;
        return last < cutoff;
      }
      // Absence totale de trace d'usage → considéré dormant si jamais utilisé.
      return !e.usage_count;
    });
  }

  /** Objets libres (ni prêtés, ni en vente, ni à remplacer) dans la fenêtre. */
  freeGearWithin(equipment: UserEquipmentItem[], _days = 30): UserEquipmentItem[] {
    return equipment.filter((e) => {
      const isLent = e.loan_status === 'prêté' || Boolean(e.loan_to_name);
      const listedForSale = Boolean(e.is_listed_for_sale);
      return !isLent && !listedForSale && (e.condition !== 'à_remplacer');
    });
  }

  /** Ratio de disponibilité sur la fenêtre (0..1). */
  availabilityRatio(equipment: UserEquipmentItem[]): number {
    if (equipment.length === 0) return 1;
    const free = this.freeGearWithin(equipment);
    return Math.round((free.length / equipment.length) * 100) / 100;
  }

  /** Conflits : objets engagés pour le prochain départ mais indisponibles. */
  checkConflicts(
    equipment: UserEquipmentItem[],
    opts: { hikeCommittedGearIds?: string[] } = {}
  ): UserEquipmentItem[] {
    const committed = new Set(opts.hikeCommittedGearIds || []);
    return equipment.filter((e) => {
      if (!committed.has(e.id)) return false;
      return e.loan_status === 'prêté' || Boolean(e.loan_to_name) || e.condition === 'à_remplacer';
    });
  }

  /** Historique d'alertes résolues (table gear_alert_history — M4). */
  async listAlertHistory(userId: string, limit = 100): Promise<AlertHistoryRow[]> {
    if (!userId) return [];
    const { data, error } = await this.supabase
      .from('gear_alert_history')
      .select('*')
      .eq('user_id', userId)
      .order('resolved_at', { ascending: false })
      .limit(limit);
    if (error) {
      console.warn('[GearService] listAlertHistory:', error.message);
      return [];
    }
    return (data || []) as AlertHistoryRow[];
  }

  /** Trace la résolution d'une alerte (table gear_alert_history — M4). */
  async resolveAlert(params: {
    userId: string;
    gearId: string;
    alertType: string;
    label?: string;
  }): Promise<GearMutationResult> {
    if (!params.userId) return { ok: true };
    const { error } = await this.supabase.from('gear_alert_history').insert({
      user_id: params.userId,
      gear_item_id: params.gearId,
      alert_type: params.alertType,
      label: params.label || null,
      resolved_at: new Date().toISOString(),
    });
    if (error) {
      console.warn('[GearService] resolveAlert:', error.message);
      return { ok: false, error: error.message };
    }
    return { ok: true };
  }
}

export interface AlertHistoryRow {
  id: string;
  user_id: string;
  gear_item_id?: string | null;
  alert_type: string;
  label?: string | null;
  resolved_at?: string | null;
  created_at?: string | null;
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