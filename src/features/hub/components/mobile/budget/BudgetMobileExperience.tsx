'use client';

import { useEffect, useMemo, useState, useTransition, type FormEvent } from 'react';
import { GlassCapsuleBtn } from '@/components/ui/GlassCapsuleBtn';
import { GlassModal } from '@/components/ui/GlassModal';
import { ConfirmDialog } from '@/features/trips/components/ConfirmDialog';
import { ExpenseFormSheet } from '@/features/trips/components/budget/ExpenseFormSheet';
import { buildBudgetDayPlan, calculateBudgetSummary } from '@/features/trips/engine/budgetEngine';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import {
  addExpenseAction,
  deleteExpenseAction,
  settleExpenseAction,
  updateExpenseAction,
} from '@/app/voyages/budget-actions';
import type { TripExpense, TripFull } from '@/features/trips/types/trip.types';
import {
  budgetOutstandingDebts,
  budgetProgress,
  buildBudgetBalances,
  buildBudgetCategoryRows,
  buildBudgetChips,
  buildBudgetDaySlides,
  type BudgetFilter,
} from '../../../mobile/budgetEngine';
import { BudgetHeroCard } from './BudgetHeroCard';
import { BudgetChipsRow } from './BudgetChipsRow';
import { BudgetDaySlider } from './BudgetDaySlider';
import { BudgetCategoryCard } from './BudgetCategoryCard';
import { BudgetBalancesCard } from './BudgetBalancesCard';
import { BudgetAllExpensesDrawer } from './BudgetAllExpensesDrawer';
import { DayExpensesDrawer } from './DayExpensesDrawer';
import { BudgetSideTrigger } from './BudgetSideTrigger';

export interface BudgetMobileExperienceProps {
  trip: TripFull;
}

export function BudgetMobileExperience({ trip }: BudgetMobileExperienceProps) {
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [confirmState, setConfirmState] = useState<{ expenseId: string; title: string } | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [formTarget, setFormTarget] = useState<TripExpense | null>(null);
  const [formInitialDate, setFormInitialDate] = useState<string | null>(null);
  const [settleTarget, setSettleTarget] = useState<TripExpense | null>(null);
  const [dayKey, setDayKey] = useState<string | null>(null);
  const [dayOpen, setDayOpen] = useState(false);
  const [allOpen, setAllOpen] = useState(false);
  const [filter, setFilter] = useState<BudgetFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const { triggerHaptic } = useHapticFeedback();

  const [localExpenses, setLocalExpenses] = useState<TripExpense[]>(trip.expenses || []);
  useEffect(() => {
    setLocalExpenses(trip.expenses || []);
  }, [trip.expenses]);

  const today = useState(() => new Date().toISOString().slice(0, 10))[0];
  const isMulti = (trip.collaborators || []).length > 0;
  const canManage = trip.permissions.canManageBudget;

  const budgetSummary = calculateBudgetSummary(
    { estimated_budget: trip.estimated_budget, budget_currency: trip.budget_currency },
    localExpenses,
    trip.collaborators || []
  );

  const dayPlan = useMemo(
    () =>
      buildBudgetDayPlan(
        { start_date: trip.start_date, end_date: trip.end_date },
        localExpenses,
        today
      ),
    [trip.start_date, trip.end_date, localExpenses, today]
  );

  const chips = useMemo(
    () =>
      buildBudgetChips({
        summary: budgetSummary,
        expenses: localExpenses,
        isMulti,
        participantCount: trip.collaborators.length + 1,
        daysCount: dayPlan.length,
        today,
      }),
    [budgetSummary, localExpenses, isMulti, trip.collaborators.length, dayPlan.length, today]
  );

  const slides = useMemo(
    () =>
      buildBudgetDaySlides({
        trip: { start_date: trip.start_date, end_date: trip.end_date },
        expenses: localExpenses,
        today,
      }),
    [trip.start_date, trip.end_date, localExpenses, today]
  );

  // Slide courant dérivé des données fraîches : les ids restent synchrones après
  // le refresh serveur (uuid réels) — jamais de snapshot périmé.
  const daySlide = useMemo(
    () => slides.find((slide) => slide.key === dayKey) ?? null,
    [slides, dayKey]
  );

  const categoryRows = useMemo(() => buildBudgetCategoryRows(budgetSummary), [budgetSummary]);
  const balances = useMemo(() => buildBudgetBalances(budgetSummary), [budgetSummary]);
  const progress = budgetProgress(budgetSummary);
  const remaining = isMulti ? budgetOutstandingDebts(budgetSummary) : budgetSummary.remainingBudget;

  const allRows = useMemo(() => {
    const sorted = [...localExpenses].sort(
      (a, b) =>
        (b.expense_date || '').localeCompare(a.expense_date || '') ||
        (b.created_at || '').localeCompare(a.created_at || '')
    );
    return sorted.filter((expense) => {
      if (categoryFilter && (expense.category || 'divers').toLowerCase() !== categoryFilter) {
        return false;
      }
      if (filter === 'real') return !expense.is_planned;
      if (filter === 'planned') return !!expense.is_planned;
      if (filter === 'today') return !expense.is_planned && (expense.expense_date || '') === today;
      return true;
    });
  }, [localExpenses, categoryFilter, filter, today]);

  const dayExpenses = useMemo(() => {
    if (!daySlide) return [];
    const ids = new Set(daySlide.expenseIds);
    return localExpenses
      .filter((expense) => ids.has(expense.id))
      .sort((a, b) => Number(!!a.is_planned) - Number(!!b.is_planned));
  }, [localExpenses, daySlide]);

  /* ---------------- Actions ---------------- */

  const openAdd = (date?: string | null) => {
    setFormTarget(null);
    setFormInitialDate(date ?? null);
    setFormOpen(true);
  };

  const openEdit = (expense: TripExpense) => {
    setFormTarget(expense);
    setFormInitialDate(null);
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setFormTarget(null);
    setFormInitialDate(null);
  };

  const confirmDelete = () => {
    if (!confirmState) return;
    const { expenseId } = confirmState;
    setConfirmState(null);
    triggerHaptic('medium');
    const snapshot = localExpenses;
    setLocalExpenses((prev) => prev.filter((e) => e.id !== expenseId));
    startTransition(async () => {
      const res = await deleteExpenseAction(trip.id, expenseId, trip.slug);
      if (!res.success) {
        setLocalExpenses(snapshot);
        setErrorMsg(res.error || 'Impossible de supprimer cette dépense');
      } else {
        triggerHaptic('success');
      }
    });
  };

  const requestDelete = (expense: TripExpense) => {
    setConfirmState({ expenseId: expense.id, title: expense.title });
  };

  const requestSettle = (expense: TripExpense) => {
    if (isMulti) {
      setSettleTarget(expense);
    } else {
      handleSettle(expense);
    }
  };

  const handleSettle = (expense: TripExpense, payerId?: string) => {
    const formData = new FormData();
    formData.set('tripId', trip.id);
    formData.set('expenseId', expense.id);
    formData.set('tripSlug', trip.slug);
    if (payerId) formData.set('payerId', payerId);

    triggerHaptic('medium');
    const snapshot = localExpenses;
    setLocalExpenses((prev) =>
      prev.map((e) =>
        e.id === expense.id ? { ...e, is_planned: false, payer_id: payerId || e.payer_id } : e
      )
    );
    setSettleTarget(null);
    startTransition(async () => {
      const res = await settleExpenseAction(null, formData);
      if (!res.success) {
        setLocalExpenses(snapshot);
        setErrorMsg(res.error || 'Impossible de régler cette dépense');
      } else {
        triggerHaptic('success');
      }
    });
  };

  const handleSaveExpense = async (
    e: FormEvent<HTMLFormElement>,
    target: TripExpense | null
  ) => {
    e.preventDefault();
    setErrorMsg(null);

    const formData = new FormData(e.currentTarget);
    formData.set('tripId', trip.id);
    formData.set('tripSlug', trip.slug);
    formData.set('currency', trip.budget_currency || 'EUR');
    // Normalise TOUJOURS la case (création ET édition) : 'on' → 'true', absente → 'false'.
    formData.set('isPlanned', formData.get('isPlanned') ? 'true' : 'false');

    const parsedTitle = formData.get('title')?.toString() || '';
    const parsedAmount = Number(formData.get('amount') || 0);
    const parsedDate = formData.get('expenseDate')?.toString() || today;
    const parsedCategory = formData.get('category')?.toString() || 'divers';
    const parsedPayer = formData.get('payerId')?.toString() || '';
    const parsedSplit = formData.get('splitType')?.toString() || 'equal';
    const parsedIsPlanned = formData.get('isPlanned') === 'true';

    const snapshot = localExpenses;
    const optimistic: TripExpense = target
      ? {
          ...target,
          title: parsedTitle || target.title,
          amount: parsedAmount || Number(target.amount),
          category: parsedCategory,
          expense_date: parsedDate,
          payer_id: parsedPayer || target.payer_id,
          split_type: (parsedSplit as TripExpense['split_type']) || target.split_type,
          is_planned: parsedIsPlanned,
        }
      : {
          id: `optimistic-${Date.now()}`,
          trip_id: trip.id,
          payer_id: parsedPayer || trip.user_id,
          title: parsedTitle || 'Dépense',
          amount: parsedAmount,
          currency: trip.budget_currency || 'EUR',
          category: parsedCategory,
          expense_date: parsedDate,
          split_type: (parsedSplit as TripExpense['split_type']) || 'equal',
          is_planned: parsedIsPlanned,
          metadata: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
    setLocalExpenses((prev) =>
      target ? prev.map((ex) => (ex.id === target.id ? optimistic : ex)) : [...prev, optimistic]
    );

    startTransition(async () => {
      const res = target
        ? await updateExpenseAction(null, formData)
        : await addExpenseAction(null, formData);
      if (!res.success) {
        setLocalExpenses(snapshot);
        setErrorMsg(res.error || "Erreur lors de l'enregistrement");
      } else {
        triggerHaptic('success');
        closeForm();
      }
    });
  };

  return (
    <div className="flex min-w-0 flex-col gap-4 pb-1 lg:hidden">
      {errorMsg && (
        <div className="glass tone-danger flex items-center justify-between gap-2 rounded-xl p-3 text-xs text-[var(--lkv-danger)]" role="alert">
          <span>{errorMsg}</span>
          <button
            type="button"
            onClick={() => setErrorMsg(null)}
            className="flex h-11 w-11 items-center justify-center rounded-full text-[var(--lkv-text-muted)] hover:text-[var(--lkv-text-primary)]"
            aria-label="Fermer le message"
          >
            ×
          </button>
        </div>
      )}

      <BudgetHeroCard summary={budgetSummary} isMulti={isMulti} remaining={remaining} onAdd={() => openAdd()} />

      <BudgetChipsRow
        chips={chips}
        onSelect={(nextFilter) => {
          setCategoryFilter(null);
          setFilter(nextFilter);
          setAllOpen(true);
        }}
      />

      <BudgetDaySlider
        slides={slides}
        onSelectDay={(slide) => {
          setDayKey(slide.key);
          setDayOpen(true);
        }}
      />

      <BudgetCategoryCard
        rows={categoryRows}
        onSelect={(key) => {
          setCategoryFilter(key);
          setFilter('all');
          setAllOpen(true);
        }}
      />

      {isMulti && <BudgetBalancesCard view={balances} />}

      <BudgetSideTrigger
        progressPct={progress.pct}
        over={progress.over}
        hasTarget={progress.hasTarget}
        onOpen={() => setAllOpen(true)}
      />

      <DayExpensesDrawer
        open={dayOpen}
        onOpenChange={setDayOpen}
        slide={daySlide}
        expenses={dayExpenses}
        currency={budgetSummary.currency}
        isMulti={isMulti}
        canManage={canManage}
        isPending={isPending}
        onEdit={openEdit}
        onDelete={requestDelete}
        onSettle={requestSettle}
        onAdd={() => openAdd(daySlide?.date)}
      />

      <BudgetAllExpensesDrawer
        open={allOpen}
        onOpenChange={setAllOpen}
        rows={allRows}
        currency={budgetSummary.currency}
        isMulti={isMulti}
        canManage={canManage}
        isPending={isPending}
        filter={filter}
        onFilterChange={setFilter}
        categoryLabel={categoryFilter}
        onClearCategory={() => setCategoryFilter(null)}
        onEdit={openEdit}
        onDelete={requestDelete}
        onSettle={requestSettle}
        onAdd={() => openAdd()}
      />

      <ExpenseFormSheet
        key={formTarget?.id ?? formInitialDate ?? 'new'}
        open={formOpen}
        trip={trip}
        expense={formTarget}
        isMulti={isMulti}
        isPending={isPending}
        initialDate={formInitialDate}
        onSubmit={handleSaveExpense}
        onClose={closeForm}
      />

      <GlassModal
        open={settleTarget !== null}
        onOpenChange={(open) => !open && setSettleTarget(null)}
        title="Régler la dépense prévue"
        variant="sheet"
      >
        <div className="space-y-4 pb-2">
          {settleTarget && (
            <>
              <p className="text-xs text-[var(--lkv-text-muted)]">
                « {settleTarget.title} » ({settleTarget.amount} {budgetSummary.currency}) passe en
                dépense réelle. Qui a payé ?
              </p>
              <div className="space-y-2">
                {(trip.collaborators || []).map((collaborator) => (
                  <button
                    key={collaborator.user_id}
                    type="button"
                    onClick={() => handleSettle(settleTarget, collaborator.user_id)}
                    disabled={isPending}
                    className={`min-h-[44px] w-full rounded-[var(--lkv-radius-md)] border border-white/60 glass-sub-card px-4 py-2.5 text-left text-sm font-semibold transition-all hover:border-[var(--lkv-primary)]/40 ${
                      collaborator.user_id === trip.user_id ? 'ring-1 ring-[var(--lkv-primary)]/30' : ''
                    }`}
                  >
                    {collaborator.profile?.full_name || `Voyageur (${collaborator.user_id.slice(0, 6)})`}
                    {collaborator.user_id === trip.user_id && (
                      <span className="ml-2 text-[10px] text-[var(--lkv-text-muted)]">(moi)</span>
                    )}
                  </button>
                ))}
              </div>
              <div className="flex justify-end pt-1">
                <GlassCapsuleBtn variant="default" size="sm" onClick={() => setSettleTarget(null)}>
                  Annuler
                </GlassCapsuleBtn>
              </div>
            </>
          )}
        </div>
      </GlassModal>

      <ConfirmDialog
        open={confirmState !== null}
        title="Supprimer la dépense ?"
        message={
          confirmState
            ? `La dépense « ${confirmState.title} » sera définitivement supprimée.`
            : undefined
        }
        confirmLabel="Supprimer"
        cancelLabel="Annuler"
        danger
        onConfirm={confirmDelete}
        onCancel={() => setConfirmState(null)}
      />
    </div>
  );
}

export default BudgetMobileExperience;
