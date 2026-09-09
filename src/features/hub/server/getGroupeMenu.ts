import { createClient } from '@/lib/supabase/server';

export interface GroupeMenuSummary {
  kind: 'groupe' | 'equipage';
  name: string | null;
  members: number;
  pendingInvites: number;
  tasksOpen: number;
  equipmentCount: number;
  expensesTotal: number;
  pollsOpen: number;
  lastMessage: string | null;
  inviteCode: string | null;
  progression: number;
  linkedTrips: number;
  departureLabel: string | null;
}

const EMPTY: GroupeMenuSummary = {
  kind: 'groupe',
  name: null,
  members: 0,
  pendingInvites: 0,
  tasksOpen: 0,
  equipmentCount: 0,
  expensesTotal: 0,
  pollsOpen: 0,
  lastMessage: null,
  inviteCode: null,
  progression: 0,
  linkedTrips: 0,
  departureLabel: null,
};

function depLabel(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  const days = Math.round((d.getTime() - Date.now()) / 86400000);
  return days >= 0 ? `J-${days}` : null;
}

/**
 * Hub V4 — Résumé serveur d'un collectif pour le MENU (léger, RLS).
 * Comptes agrégés : membres, tâches, équipement, dépenses, votes, discussion,
 * voyages liés. Pas de grosse jointure getGroupeComplet.
 */
export async function getGroupeMenuSummary(
  id: string,
  kind: 'groupe' | 'equipage',
): Promise<GroupeMenuSummary> {
  const supabase = await createClient();
  try {
    if (kind === 'groupe') {
      const [{ data: grp }, { data: members }, { data: tasks }, { data: eq }, { data: exp }, { data: polls }, { data: msgs }, { data: trips }] =
        await Promise.all([
          supabase
            .from('travel_groups')
            .select('name, invite_code, optimization_score, departure_date, return_date')
            .eq('id', id)
            .maybeSingle(),
          supabase
            .from('group_members')
            .select('status')
            .eq('group_id', id),
          supabase
            .from('group_tasks')
            .select('id')
            .eq('group_id', id)
            .eq('status', 'todo'),
          supabase
            .from('group_kit_items')
            .select('id')
            .eq('group_id', id),
          supabase
            .from('group_expenses')
            .select('amount')
            .eq('group_id', id),
          supabase
            .from('group_polls')
            .select('id')
            .eq('group_id', id)
            .eq('status', 'open'),
          supabase
            .from('group_messages')
            .select('content')
            .eq('group_id', id)
            .order('created_at', { ascending: false })
            .limit(1),
          supabase
            .from('trips')
            .select('id')
            .eq('group_id', id),
        ]);

      const rows = (members ?? []) as Array<{ status: string }>;
      return {
        ...EMPTY,
        kind: 'groupe',
        name: (grp as { name?: string } | null)?.name ?? null,
        members: rows.filter((m) => m.status === 'active').length,
        pendingInvites: rows.filter((m) => m.status === 'pending').length,
        tasksOpen: (tasks ?? []).length,
        equipmentCount: (eq ?? []).length,
        expensesTotal: Math.round((exp ?? []).reduce((s: number, r: { amount: number }) => s + Number(r.amount || 0), 0)),
        pollsOpen: (polls ?? []).length,
        lastMessage: ((msgs as Array<{ content: string }> | null)?.[0]?.content ?? null),
        inviteCode: (grp as { invite_code?: string | null } | null)?.invite_code ?? null,
        progression: Math.min(100, Math.max(0, Number((grp as { optimization_score?: number | null } | null)?.optimization_score ?? 0))),
        linkedTrips: (trips ?? []).length,
        departureLabel: depLabel((grp as { departure_date?: string | null } | null)?.departure_date),
      };
    }

    // kind === 'equipage'
    const [{ data: crew }, { data: members }, { data: trips }] = await Promise.all([
      supabase
        .from('crews')
        .select('name, invite_code')
        .eq('id', id)
        .maybeSingle(),
      supabase
        .from('crew_members')
        .select('status')
        .eq('crew_id', id),
      supabase
        .from('trips')
        .select('id')
        .eq('crew_id', id),
    ]);
    const rows = (members ?? []) as Array<{ status: string }>;
    return {
      ...EMPTY,
      kind: 'equipage',
      name: (crew as { name?: string } | null)?.name ?? null,
      members: rows.filter((m) => m.status === 'active').length,
      pendingInvites: rows.filter((m) => m.status === 'pending').length,
      inviteCode: (crew as { invite_code?: string | null } | null)?.invite_code ?? null,
      linkedTrips: (trips ?? []).length,
    };
  } catch {
    return { ...EMPTY, kind };
  }
}