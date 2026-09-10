import { createClient } from '@/lib/supabase/server';
import { computeGroupeReadiness } from '../mobile/groupeEngine';

export interface GroupeMenuSummary {
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
export async function getGroupeMenuSummary(id: string): Promise<GroupeMenuSummary> {
  const supabase = await createClient();
  try {
    const [{ data: grp }, { data: members }, { data: tasks }, { data: eq }, { data: exp }, { data: polls }, { data: msgs }, { data: trips }] =
        await Promise.all([
          supabase
            .from('travel_groups')
            .select('name, invite_code, departure_date, return_date')
            .eq('id', id)
            .maybeSingle(),
          supabase
            .from('group_members')
            .select('status')
            .eq('group_id', id),
          supabase
            .from('group_tasks')
            .select('id, status')
            .eq('group_id', id),
          supabase
            .from('group_kit_items')
            .select('id, assigned_to')
            .eq('group_id', id),
          supabase
            .from('group_expenses')
            .select('amount, status')
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
      const taskRows = (tasks ?? []) as Array<{ status: string }>;
      const kitRows = (eq ?? []) as Array<{ assigned_to: string | null }>;
      const expRows = (exp ?? []) as Array<{ amount: number; status: string }>;

      // Préparation = score calculé en direct (même moteur que la page groupe).
      const readiness = computeGroupeReadiness({
        tasks: taskRows.map((t, index) => ({ id: String(index), title: '', completed: t.status === 'done' })),
        kit: kitRows.map((k, index) => ({ id: String(index), assigned: !!k.assigned_to })),
        expenses: expRows.map((e, index) => ({ id: String(index), amount: Number(e.amount || 0), settled: e.status === 'settled' })),
        members: rows.map((m, index) => ({ userId: String(index), name: '', status: m.status })),
      });

      return {
        ...EMPTY,
        name: (grp as { name?: string } | null)?.name ?? null,
        members: rows.filter((m) => m.status === 'active').length,
        pendingInvites: rows.filter((m) => m.status === 'pending').length,
        tasksOpen: taskRows.filter((t) => t.status === 'todo').length,
        equipmentCount: kitRows.length,
        expensesTotal: Math.round(expRows.reduce((s, r) => s + Number(r.amount || 0), 0)),
        pollsOpen: (polls ?? []).length,
        lastMessage: ((msgs as Array<{ content: string }> | null)?.[0]?.content ?? null),
        inviteCode: (grp as { invite_code?: string | null } | null)?.invite_code ?? null,
        progression: readiness.pct,
        linkedTrips: (trips ?? []).length,
        departureLabel: depLabel((grp as { departure_date?: string | null } | null)?.departure_date),
      };
  } catch {
    return { ...EMPTY };
  }
}