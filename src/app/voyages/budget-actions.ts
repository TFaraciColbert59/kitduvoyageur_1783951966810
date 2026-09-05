'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import {
  addTripExpenseSchema,
  deleteTripExpenseSchema,
} from '@/features/trips/schemas/trip.schema';
import { addTripExpense, deleteTripExpense } from '@/lib/queries-trip-budget';

export async function addExpenseAction(
  prevState: any,
  formData: FormData
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const rawData = {
      tripId: formData.get('tripId'),
      title: formData.get('title'),
      amount: formData.get('amount'),
      currency: formData.get('currency') || 'EUR',
      category: formData.get('category') || 'divers',
      expenseDate: formData.get('expenseDate') || new Date().toISOString().slice(0, 10),
      splitType: formData.get('splitType') || 'equal',
    };

    const parsed = addTripExpenseSchema.safeParse(rawData);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || 'Données de dépense invalides',
      };
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: 'Vous devez être connecté pour ajouter une dépense' };
    }

    const created = await addTripExpense({
      trip_id: parsed.data.tripId,
      payer_id: user.id,
      title: parsed.data.title,
      amount: parsed.data.amount,
      currency: parsed.data.currency,
      category: parsed.data.category,
      expense_date: parsed.data.expenseDate,
      split_type: parsed.data.splitType,
      metadata: parsed.data.metadata,
    });

    if (!created) {
      return { success: false, error: 'Impossible d\'enregistrer la dépense' };
    }

    const tripSlug = formData.get('tripSlug')?.toString();
    if (tripSlug) {
      revalidatePath(`/voyages/${tripSlug}`);
    }

    return { success: true, message: 'Dépense enregistrée avec succès' };
  } catch (err: any) {
    console.error('[LKDV Action] Erreur addExpenseAction:', err);
    return { success: false, error: 'Une erreur inattendue est survenue' };
  }
}

export async function deleteExpenseAction(
  tripId: string,
  expenseId: string,
  tripSlug?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const parsed = deleteTripExpenseSchema.safeParse({ tripId, expenseId });
    if (!parsed.success) {
      return { success: false, error: 'Identifiants invalides' };
    }

    const ok = await deleteTripExpense(tripId, expenseId);
    if (!ok) {
      return { success: false, error: 'Impossible de supprimer cette dépense' };
    }

    if (tripSlug) {
      revalidatePath(`/voyages/${tripSlug}`);
    }

    return { success: true };
  } catch (err: any) {
    console.error('[LKDV Action] Erreur deleteExpenseAction:', err);
    return { success: false, error: 'Erreur inattendue' };
  }
}
