import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { getTripById } from '@/lib/queries-trips';
import { tripPartySize } from '@/features/compas/server/compasServer';
import { desiredBudgetLines, planBudgetSync, type ExistingBudgetLine } from '../budgetSync';
import { loadPublishedWorkspaceForTrip } from './publishedRoute';

/**
 * Écrit dans `trip_expenses` les nuits réellement choisies de la version publiée (10.6). Droit exigé :
 * `permissions.canManageBudget` (même règle que `addExpenseAction`), lecture/écriture sous RLS. Idempotent,
 * voir `../budgetSync.ts` pour les règles (aucun montant inventé, lignes retouchées jamais écrasées).
 */
export type BudgetSyncResult =
  | { status: 'synced'; inserted: number; updated: number; removed: number }
  | { status: 'unauthenticated' | 'forbidden' | 'no_published' | 'error' };

export async function syncPublishedRouteBudget(tripId: string): Promise<BudgetSyncResult> {
  try {
    const supabase = (await createClient()) as unknown as SupabaseClient;
    const { data: auth } = await supabase.auth.getUser();
    const user = auth.user;
    if (!user) return { status: 'unauthenticated' };
    const trip = await getTripById(tripId, user.id);
    if (!trip || !trip.permissions.canManageBudget) return { status: 'forbidden' };
    const published = await loadPublishedWorkspaceForTrip(tripId, supabase);
    if (!published) return { status: 'no_published' };

    // Taille du groupe : même lecture que le Compas (`tripPartySize`), jamais recalculée ici.
    const { data: tripRow } = await supabase.from('trips').select('id, user_id, party_size').eq('id', tripId).maybeSingle();
    if (!tripRow) return { status: 'forbidden' };
    const party = await tripPartySize(supabase as never, tripRow as { id: string; user_id: string; party_size: number | null });
    const desired = desiredBudgetLines(published, party);

    const { data: rows, error } = await supabase
      .from('trip_expenses')
      .select('id, amount, is_planned, metadata')
      .eq('trip_id', tripId)
      .not('metadata->>route_collab_key', 'is', null);
    if (error) return { status: 'error' };
    const existing: ExistingBudgetLine[] = ((rows ?? []) as Array<{ id: string; amount: number | string; is_planned: boolean; metadata: Record<string, unknown> | null }>).map((r) => ({
      id: r.id,
      amount: Number(r.amount),
      isPlanned: r.is_planned === true,
      metadata: r.metadata,
    }));
    const plan = planBudgetSync(desired, existing);

    const meta = (line: (typeof desired)[number]) => ({
      route_collab_key: line.key,
      route_collab_amount: line.amount,
      route_collab_revision: line.revisionNo,
      source: 'route-collab',
      basis: line.basis,
    });
    if (plan.insert.length > 0) {
      const { error: insertError } = await supabase.from('trip_expenses').insert(
        plan.insert.map((line) => ({
          trip_id: tripId,
          payer_id: user.id,
          title: line.title,
          amount: line.amount,
          currency: line.currency,
          category: line.category,
          expense_date: line.expenseDate ?? trip.start_date ?? new Date().toISOString().slice(0, 10),
          split_type: 'equal',
          is_planned: true,
          metadata: meta(line),
        })),
      );
      if (insertError) return { status: 'error' };
    }
    for (const { id, line } of plan.update) {
      const { error: updateError } = await supabase
        .from('trip_expenses')
        .update({ title: line.title, amount: line.amount, metadata: meta(line) })
        .eq('id', id)
        .eq('trip_id', tripId);
      if (updateError) return { status: 'error' };
    }
    if (plan.remove.length > 0) {
      const { error: removeError } = await supabase.from('trip_expenses').delete().eq('trip_id', tripId).in('id', plan.remove);
      if (removeError) return { status: 'error' };
    }
    return { status: 'synced', inserted: plan.insert.length, updated: plan.update.length, removed: plan.remove.length };
  } catch {
    return { status: 'error' };
  }
}
