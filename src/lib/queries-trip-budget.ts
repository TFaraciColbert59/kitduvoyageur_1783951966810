import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type { TripExpense, TripBudgetCurrency } from '@/features/trips/types/trip.types';

/**
 * 7.4.1 Récupérer les dépenses d'un voyage (réelles + prévues)
 */
export async function getTripExpenses(tripId: string): Promise<TripExpense[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('trip_expenses')
    .select(`
      id,
      trip_id,
      payer_id,
      title,
      amount,
      currency,
      category,
      expense_date,
      split_type,
      is_planned,
      metadata,
      created_at,
      updated_at
    `)
    .eq('trip_id', tripId)
    .order('expense_date', { ascending: false });

  if (error) {
    console.error('[LKDV Budget] Erreur getTripExpenses:', error);
    return [];
  }

  // Tenter de joindre les noms des payeurs
  const payerIds = Array.from(new Set((data || []).map(r => r.payer_id)));
  const profileMap = new Map<string, { full_name?: string | null; avatar_url?: string | null }>();

  if (payerIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url, username')
      .in('id', payerIds);

    (profiles || []).forEach((p: any) => {
      profileMap.set(p.id, {
        full_name: p.full_name || p.username,
        avatar_url: p.avatar_url,
      });
    });
  }

  return (data || []).map((row: any) => ({
    id: row.id,
    trip_id: row.trip_id,
    payer_id: row.payer_id,
    title: row.title,
    amount: Number(row.amount),
    currency: row.currency as TripBudgetCurrency,
    category: row.category,
    expense_date: row.expense_date,
    split_type: row.split_type,
    is_planned: Boolean(row.is_planned),
    metadata: row.metadata,
    created_at: row.created_at,
    updated_at: row.updated_at,
    payer: profileMap.get(row.payer_id),
  }));
}

/**
 * 7.4.2 Ajouter une dépense sur un voyage (réelle ou prévisionnelle)
 */
export async function addTripExpense(input: {
  trip_id: string;
  payer_id: string;
  title: string;
  amount: number;
  currency?: TripBudgetCurrency;
  category?: string;
  expense_date?: string;
  split_type?: 'equal' | 'custom' | 'individual';
  is_planned?: boolean;
  metadata?: Record<string, unknown>;
}): Promise<TripExpense | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('trip_expenses')
    .insert({
      trip_id: input.trip_id,
      payer_id: input.payer_id,
      title: input.title,
      amount: input.amount,
      currency: input.currency || 'EUR',
      category: input.category || 'divers',
      expense_date: input.expense_date || new Date().toISOString().slice(0, 10),
      split_type: input.split_type || 'equal',
      is_planned: input.is_planned ?? false,
      metadata: input.metadata || {},
    })
    .select()
    .single();

  if (error) {
    console.error('[LKDV Budget] Erreur addTripExpense:', error);
    return null;
  }

  return mapExpenseRow(data);
}

/**
 * 7.4.3 Mettre à jour une dépense (édition inline, passage prévu → réel)
 */
export async function updateTripExpense(
  tripId: string,
  expenseId: string,
  patch: {
    title?: string;
    amount?: number;
    category?: string;
    expense_date?: string;
    payer_id?: string;
    split_type?: 'equal' | 'custom' | 'individual';
    is_planned?: boolean;
  }
): Promise<TripExpense | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('trip_expenses')
    .update(patch)
    .eq('id', expenseId)
    .eq('trip_id', tripId)
    .select()
    .single();

  if (error) {
    console.error('[LKDV Budget] Erreur updateTripExpense:', error);
    return null;
  }

  return mapExpenseRow(data);
}

/**
 * 7.4.4 Supprimer une dépense d'un voyage
 */
export async function deleteTripExpense(tripId: string, expenseId: string): Promise<boolean> {
  const supabase = await createClient();

  const { error } = await supabase
    .from('trip_expenses')
    .delete()
    .eq('id', expenseId)
    .eq('trip_id', tripId);

  if (error) {
    console.error('[LKDV Budget] Erreur deleteTripExpense:', error);
    return false;
  }

  return true;
}

function mapExpenseRow(row: any): TripExpense {
  return {
    id: row.id,
    trip_id: row.trip_id,
    payer_id: row.payer_id,
    title: row.title,
    amount: Number(row.amount),
    currency: row.currency as TripBudgetCurrency,
    category: row.category,
    expense_date: row.expense_date,
    split_type: row.split_type,
    is_planned: Boolean(row.is_planned),
    metadata: row.metadata,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}
