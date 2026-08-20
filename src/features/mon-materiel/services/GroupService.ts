'use client';

/**
 * LKDV — Mon Matériel : service groupes (`travel_groups`, `group_members`,
 * `group_kit_items`). Affiche les groupes de l'utilisateur et les engagements
 * de matériel partagé (RLS respectées par les policies existantes).
 */

import { createClient } from '@/lib/supabase/client';
import type { GroupKitItem, TravelGroupLite } from '../types/catalog';

interface GroupKitItemRow {
  id: string;
  group_id: string;
  assigned_to?: string | null;
  name: string;
  weight_grams?: number;
  category?: string;
  quantity?: number;
  is_shared?: boolean;
  notes?: string;
  start_date?: string | null;
  end_date?: string | null;
  created_at?: string | null;
}

interface TravelGroupRow {
  id: string;
  name: string;
  destination?: string;
  visibility?: string;
  owner_id?: string;
  departure_date?: string | null;
  return_date?: string | null;
}

export class GroupService {
  private supabase = createClient();

  /** Groupes dont l'utilisateur est membre ou organisateur (statut actif). */
  async fetchGroups(userId: string): Promise<TravelGroupLite[]> {
    if (!userId) return [];
    // L'utilisateur est soit owner, soit membre actif.
    const memberRows = await this.supabase
      .from('group_members')
      .select('group_id')
      .eq('user_id', userId)
      .eq('status', 'active');
    const memberIds = (memberRows.data || []).map((r) => r.group_id).filter(Boolean);
    const ownerQuery = await this.supabase
      .from('travel_groups')
      .select('*')
      .or(`owner_id.eq.${userId}${memberIds.length ? `,id.in.(${memberIds.join(',')})` : ''}`)
      .order('created_at', { ascending: false })
      .limit(100);
    if (ownerQuery.error) {
      console.warn('[GroupService] fetchGroups:', ownerQuery.error.message);
      return [];
    }
    const rows = (ownerQuery.data || []) as unknown as TravelGroupRow[];
    return rows.map((g) => ({
      id: g.id,
      name: g.name,
      destination: g.destination,
      visibility: g.visibility,
      owner_id: g.owner_id,
      departure_date: g.departure_date,
      return_date: g.return_date,
    }));
  }

  /** Engagements de matériel partagé d'un groupe (table group_kit_items). */
  async groupKitAssignments(groupId: string): Promise<GroupKitItem[]> {
    if (!groupId) return [];
    const { data, error } = await this.supabase
      .from('group_kit_items')
      .select('*')
      .eq('group_id', groupId)
      .order('created_at', { ascending: false })
      .limit(500);
    if (error) {
      console.warn('[GroupService] groupKitAssignments:', error.message);
      return [];
    }
    return (data || []).map((r) => this.projectKitItem(r as unknown as GroupKitItemRow));
  }

  /** Engagements de l'utilisateur dans tous ses groupes (fenêtre effective). */
  async userGroupAssignments(userId: string): Promise<GroupKitItem[]> {
    const groups = await this.fetchGroups(userId);
    const all: GroupKitItem[] = [];
    for (const g of groups) {
      const items = await this.groupKitAssignments(g.id);
      all.push(
        ...items.map((i) => ({
          ...i,
          groupName: g.name,
        }) as GroupKitItem & { groupName?: string })
      );
    }
    return all;
  }

  private projectKitItem(r: GroupKitItemRow): GroupKitItem {
    return {
      id: r.id,
      group_id: r.group_id,
      assigned_to: r.assigned_to ?? null,
      name: r.name,
      weight_grams: Number(r.weight_grams ?? 0),
      category: r.category || 'Divers',
      quantity: Number(r.quantity ?? 1),
      is_shared: Boolean(r.is_shared),
      notes: r.notes ?? null,
      start_date: r.start_date ?? null,
      end_date: r.end_date ?? null,
      created_at: r.created_at ?? null,
    };
  }
}