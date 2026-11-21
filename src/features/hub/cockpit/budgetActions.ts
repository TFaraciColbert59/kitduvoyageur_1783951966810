'use server';

import { createClient } from '@/lib/supabase/server';
import type { CockpitExpense } from './model';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const CURRENCIES = new Set(['EUR', 'USD', 'GBP', 'CHF', 'CAD', 'JPY', 'AUD', 'NZD', 'NOK', 'SEK', 'ISK', 'MAD']);

export type CreateCockpitExpenseInput = {
  tripId: string;
  operationId?: string;
  title: string;
  amount: number;
  currency: string;
  category: string;
  date: string;
};

export type CreateCockpitExpenseResult =
  | { ok: true; expense: CockpitExpense }
  | { ok: false; message: string };

export async function createCockpitExpense(
  input: CreateCockpitExpenseInput,
): Promise<CreateCockpitExpenseResult> {
  if (!UUID.test(input.tripId)) return { ok: false, message: 'Voyage introuvable.' };
  const title = input.title.trim().slice(0, 120);
  if (!title) return { ok: false, message: 'Indique un intitulé pour la dépense.' };
  const amount = Math.round(Number(input.amount) * 100) / 100;
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000) {
    return { ok: false, message: 'Indique un montant positif valide.' };
  }
  const currency = CURRENCIES.has(input.currency.toUpperCase()) ? input.currency.toUpperCase() : 'EUR';
  const category = input.category.trim().slice(0, 60) || 'Autre';
  const expenseDate = DATE_RE.test(input.date) ? input.date : new Date().toISOString().slice(0, 10);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: 'Connexion requise pour ajouter une dépense.' };

  if (input.operationId && UUID.test(input.operationId)) {
    const existing = await supabase
      .from('trip_expenses')
      .select('id,title,amount,currency,expense_date,is_planned,category')
      .eq('trip_id', input.tripId)
      .contains('metadata', { operation_id: input.operationId })
      .maybeSingle();
    if (existing.data) {
      return {
        ok: true,
        expense: {
          id: existing.data.id,
          title: existing.data.title,
          amount: Number(existing.data.amount),
          currency: existing.data.currency,
          date: existing.data.expense_date,
          planned: existing.data.is_planned,
          category: existing.data.category,
        },
      };
    }
  }

  const { data, error } = await supabase
    .from('trip_expenses')
    .insert({
      trip_id: input.tripId,
      payer_id: user.id,
      title,
      amount,
      currency,
      category,
      expense_date: expenseDate,
      is_planned: false,
      split_type: 'equal',
      metadata: input.operationId ? { operation_id: input.operationId, source: 'hub_cockpit' } : { source: 'hub_cockpit' },
    })
    .select('id,title,amount,currency,expense_date,is_planned,category')
    .single();

  if (error || !data) {
    return {
      ok: false,
      message: error?.code === '42501'
        ? 'Droits insuffisants pour enregistrer une dépense sur ce voyage.'
        : 'Impossible d’enregistrer la dépense. Réessaie.',
    };
  }

  return {
    ok: true,
    expense: {
      id: data.id,
      title: data.title,
      amount: Number(data.amount),
      currency: data.currency,
      date: data.expense_date,
      planned: data.is_planned,
      category: data.category,
    },
  };
}
