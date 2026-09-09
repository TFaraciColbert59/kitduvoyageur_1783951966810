'use server';

import { tripSegmentPath } from '@/features/trips/registry/tripPaths';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import {
  addTripExpenseSchema,
  updateTripExpenseSchema,
  deleteTripExpenseSchema,
} from '@/features/trips/schemas/trip.schema';
import {
  addTripExpense,
  updateTripExpense,
  deleteTripExpense,
} from '@/lib/queries-trip-budget';
import { getTripById } from '@/lib/queries-trips';

/** Revalidations budget : pages hub active (pas les routes /voyages legacy). */
function revalidateBudgetPaths(tripSlug?: string) {
  revalidatePath('/hub/budget');
  revalidatePath('/hub');
  if (tripSlug) {
    revalidatePath(tripSegmentPath(tripSlug, ''));
  }
}

export type ExpenseActionResult = { success: boolean; message?: string; error?: string };

export async function addExpenseAction(
  prevState: any,
  formData: FormData
): Promise<ExpenseActionResult> {
  try {
    const rawData = {
      tripId: formData.get('tripId'),
      title: formData.get('title'),
      amount: formData.get('amount'),
      currency: formData.get('currency') || 'EUR',
      category: formData.get('category') || 'divers',
      expenseDate: formData.get('expenseDate') || new Date().toISOString().slice(0, 10),
      splitType: formData.get('splitType') || 'equal',
      isPlanned: formData.get('isPlanned') === 'true',
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

    const trip = await getTripById(parsed.data.tripId, user.id);
    if (!trip || !trip.permissions.canManageBudget) {
      return { success: false, error: 'Permission refusée pour la gestion du budget de ce voyage' };
    }

    const payerId = resolvePayerId(formData.get('payerId')?.toString() ?? null, user.id, trip);
    if (!payerId) {
      return { success: false, error: 'Payeur invalide pour ce voyage' };
    }

    const created = await addTripExpense({
      trip_id: parsed.data.tripId,
      payer_id: payerId,
      title: parsed.data.title,
      amount: parsed.data.amount,
      currency: parsed.data.currency,
      category: parsed.data.category,
      expense_date: parsed.data.expenseDate,
      split_type: parsed.data.splitType,
      is_planned: parsed.data.isPlanned,
      metadata: parsed.data.metadata,
    });

    if (!created) {
      return { success: false, error: 'Impossible d\'enregistrer la dépense' };
    }

    revalidateBudgetPaths(formData.get('tripSlug')?.toString());

    return { success: true, message: 'Dépense enregistrée avec succès' };
  } catch (err: any) {
    console.error('[LKDV Action] Erreur addExpenseAction:', err);
    return { success: false, error: 'Une erreur inattendue est survenue' };
  }
}

export async function updateExpenseAction(
  prevState: any,
  formData: FormData
): Promise<ExpenseActionResult> {
  try {
    const rawData = {
      tripId: formData.get('tripId'),
      expenseId: formData.get('expenseId'),
    };
    const patchRaw: Record<string, unknown> = {};
    if (formData.has('title')) patchRaw.title = formData.get('title');
    if (formData.has('amount')) patchRaw.amount = formData.get('amount');
    if (formData.has('category')) patchRaw.category = formData.get('category');
    if (formData.has('expenseDate')) patchRaw.expenseDate = formData.get('expenseDate');
    if (formData.has('payerId') && formData.get('payerId')) patchRaw.payerId = formData.get('payerId');
    if (formData.has('splitType') && formData.get('splitType')) patchRaw.splitType = formData.get('splitType');
    if (formData.has('isPlanned')) patchRaw.isPlanned = formData.get('isPlanned') === 'true';

    const parsed = updateTripExpenseSchema.safeParse({ ...rawData, ...patchRaw });
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
      return { success: false, error: 'Vous devez être connecté pour modifier une dépense' };
    }

    const trip = await getTripById(parsed.data.tripId, user.id);
    if (!trip || !trip.permissions.canManageBudget) {
      return { success: false, error: 'Permission refusée pour la gestion du budget de ce voyage' };
    }

    const patch: Record<string, unknown> = {};
    if (parsed.data.title !== undefined) patch.title = parsed.data.title;
    if (parsed.data.amount !== undefined) patch.amount = parsed.data.amount;
    if (parsed.data.category !== undefined) patch.category = parsed.data.category;
    if (parsed.data.expenseDate !== undefined) patch.expense_date = parsed.data.expenseDate;
    if (parsed.data.splitType !== undefined) patch.split_type = parsed.data.splitType;
    if (parsed.data.isPlanned !== undefined) patch.is_planned = parsed.data.isPlanned;
    if (parsed.data.payerId !== undefined) {
      const payerId = resolvePayerId(parsed.data.payerId, user.id, trip);
      if (!payerId) {
        return { success: false, error: 'Payeur invalide pour ce voyage' };
      }
      patch.payer_id = payerId;
    }

    const updated = await updateTripExpense(parsed.data.tripId, parsed.data.expenseId, patch);
    if (!updated) {
      return { success: false, error: 'Impossible de modifier cette dépense' };
    }

    revalidateBudgetPaths(formData.get('tripSlug')?.toString());

    return { success: true, message: 'Dépense mise à jour' };
  } catch (err: any) {
    console.error('[LKDV Action] Erreur updateExpenseAction:', err);
    return { success: false, error: 'Erreur inattendue' };
  }
}

/**
 * « Régler » une dépense prévue : is_planned → false (elle devient réelle),
 * payeur au choix en multi (par défaut : l'utilisateur courant), montant éditable.
 */
export async function settleExpenseAction(
  prevState: any,
  formData: FormData
): Promise<ExpenseActionResult> {
  try {
    const tripId = formData.get('tripId')?.toString() || '';
    const expenseId = formData.get('expenseId')?.toString() || '';
    const tripSlug = formData.get('tripSlug')?.toString();

    const parsed = deleteTripExpenseSchema.safeParse({ tripId, expenseId });
    if (!parsed.success) {
      return { success: false, error: 'Identifiants invalides' };
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: 'Vous devez être connecté pour régler une dépense' };
    }

    const trip = await getTripById(parsed.data.tripId, user.id);
    if (!trip || !trip.permissions.canManageBudget) {
      return { success: false, error: 'Permission refusée pour la gestion du budget de ce voyage' };
    }

    const target = (trip.expenses ?? []).find((e) => e.id === parsed.data.expenseId);
    if (!target) {
      return { success: false, error: 'Dépense introuvable' };
    }
    if (!target.is_planned) {
      return { success: false, error: 'Cette dépense est déjà réelle' };
    }

    const patch: Record<string, unknown> = { is_planned: false };
    const requestedPayer = formData.get('payerId')?.toString();
    if (requestedPayer) {
      const payerId = resolvePayerId(requestedPayer, user.id, trip);
      if (!payerId) {
        return { success: false, error: 'Payeur invalide pour ce voyage' };
      }
      patch.payer_id = payerId;
    }

    const updated = await updateTripExpense(parsed.data.tripId, parsed.data.expenseId, patch);
    if (!updated) {
      return { success: false, error: 'Impossible de régler cette dépense' };
    }

    revalidateBudgetPaths(tripSlug);

    return { success: true, message: 'Dépense réglée' };
  } catch (err: any) {
    console.error('[LKDV Action] Erreur settleExpenseAction:', err);
    return { success: false, error: 'Erreur inattendue' };
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

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: 'Vous devez être connecté pour supprimer une dépense' };
    }

    const trip = await getTripById(parsed.data.tripId, user.id);
    if (!trip || !trip.permissions.canManageBudget) {
      return { success: false, error: 'Permission refusée pour la gestion du budget de ce voyage' };
    }

    const ok = await deleteTripExpense(tripId, expenseId);
    if (!ok) {
      return { success: false, error: 'Impossible de supprimer cette dépense' };
    }

    revalidateBudgetPaths(tripSlug);

    return { success: true };
  } catch (err: any) {
    console.error('[LKDV Action] Erreur deleteExpenseAction:', err);
    return { success: false, error: 'Erreur inattendue' };
  }
}

/**
 * Valide le payeur demandé : il doit être un collaborateur du voyage
 * (ou retombe sur l'utilisateur courant). Retourne null si invalide.
 */
function resolvePayerId(
  requested: FormData | string | null,
  fallbackUserId: string,
  trip: NonNullable<Awaited<ReturnType<typeof getTripById>>>
): string | null {
  const requestedId =
    typeof requested === 'string' && requested.trim() ? requested.trim() : fallbackUserId;

  const collaboratorIds = (trip.collaborators || []).map(c => c.user_id);
  if (collaboratorIds.length > 0) {
    if (collaboratorIds.includes(requestedId)) return requestedId;
    if (requestedId === fallbackUserId) return fallbackUserId;
    if (collaboratorIds.includes(fallbackUserId)) return fallbackUserId;
    return null;
  }

  return requestedId === fallbackUserId ? fallbackUserId : null;
}
