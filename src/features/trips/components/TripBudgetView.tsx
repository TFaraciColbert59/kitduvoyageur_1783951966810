'use client';

import Icon from '@/components/ui/Icon';
import React, { useEffect, useMemo, useState, useTransition } from 'react';
import { Badge, Button, Card, EmptyState, IconButton, ListItem } from '@/components/ui';
import { Sheet } from '@/components/ui/Sheet';
import { calculateBudgetSummary, buildBudgetDayPlan } from '../engine/budgetEngine';
import {
  addExpenseAction,
  updateExpenseAction,
  settleExpenseAction,
  deleteExpenseAction,
} from '@/app/voyages/budget-actions';
import { ConfirmDialog } from './ConfirmDialog';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { ExpenseRow } from './budget/ExpenseRow';
import { ExpenseFormSheet } from './budget/ExpenseFormSheet';
import { formatDayLabel } from './budget/budgetFormat';
import { BudgetMobileExperience } from '@/features/hub/components/mobile/budget/BudgetMobileExperience';
import type { TripFull, TripExpense } from '../types/trip.types';

interface TripBudgetViewProps {
  trip: TripFull;
  /** Deep-link roadbook : jour à ouvrir dans le budget mobile (?jour=N). */
  initialDay?: number;
}

export function TripBudgetView({ trip, initialDay }: TripBudgetViewProps) {
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [confirmState, setConfirmState] = useState<{ expenseId: string; title: string } | null>(
    null
  );
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<TripExpense | null>(null);
  const [settleTarget, setSettleTarget] = useState<TripExpense | null>(null);
  const { triggerHaptic } = useHapticFeedback();

  // Optimistic UI : copie locale des dépenses, synchronisée par le serveur
  const [localExpenses, setLocalExpenses] = useState<TripExpense[]>(trip.expenses || []);
  useEffect(() => {
    setLocalExpenses(trip.expenses || []);
  }, [trip.expenses]);

  const today = useState(() => new Date().toISOString().slice(0, 10))[0];
  const isMulti = (trip.collaborators || []).length > 0;

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

  const canManage = trip.permissions.canManageBudget;

  const revertTo = (snapshot: TripExpense[]) => {
    setLocalExpenses(snapshot);
  };

  /* ---------------- Actions ---------------- */

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
        revertTo(snapshot);
        setErrorMsg(res.error || 'Impossible de supprimer cette dépense');
      } else {
        triggerHaptic('success');
      }
    });
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
        revertTo(snapshot);
        setErrorMsg(res.error || 'Impossible de régler cette dépense');
      } else {
        triggerHaptic('success');
      }
    });
  };

  const handleSaveExpense = async (
    e: React.FormEvent<HTMLFormElement>,
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
    const parsedIsPlanned =
      formData.get('isPlanned') === 'true' || formData.get('isPlanned') === 'on';

    // Optimiste : maj locale immédiate, revert si erreur
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
        revertTo(snapshot);
        setErrorMsg(res.error || "Erreur lors de l'enregistrement");
      } else {
        triggerHaptic('success');
        setIsAddOpen(false);
        setEditTarget(null);
      }
    });
  };

  /* ---------------- Rendu ---------------- */

  const pendingExpenses = localExpenses.filter((e) => e.is_planned);
  const realExpenses = localExpenses.filter((e) => !e.is_planned);
  const outstandingDebts = budgetSummary.balances.reduce((sum, b) => sum + Math.max(0, -b.net), 0);

  return (
    <>
      <div className="hidden space-y-[var(--space-6)] lg:block">
        {errorMsg && (
          <Card
            role="alert"
            tone="danger"
            className="flex items-center justify-between gap-[var(--space-2)] text-[length:var(--lkv-text-footnote)] text-[color:var(--lkv-danger-dark)]"
          >
            <span>{errorMsg}</span>
            <IconButton
              size="sm"
              onClick={() => setErrorMsg(null)}
              aria-label="Fermer le message"
            >
              <Icon name="x" size={16} />
            </IconButton>
          </Card>
        )}

        {/* Bandeau synthèse : prévu vs réel vs reste */}
        <div className="grid grid-cols-1 gap-[var(--space-4)] sm:grid-cols-3">
          <Card variant="compact" className="p-[var(--space-4)]">
            <div className="flex items-center gap-[var(--space-2)] text-[length:var(--lkv-text-footnote)] font-semibold text-[color:var(--lkv-text-secondary)]">
              <Icon name="calendar-days" size={13} /> Prévu (prévisionnel)
            </div>
            <div className="mt-1 text-[length:var(--lkv-text-title-sm)] font-extrabold text-[color:var(--lkv-text-primary)]">
              {budgetSummary.plannedTotal} {budgetSummary.currency}
            </div>
            <div className="mt-1 text-[11px] text-[color:var(--lkv-text-muted)]">
              {pendingExpenses.length} dépense{pendingExpenses.length > 1 ? 's' : ''} à venir
            </div>
          </Card>

          <Card variant="compact" className="p-[var(--space-4)]">
            <div className="flex items-center gap-[var(--space-2)] text-[length:var(--lkv-text-footnote)] font-semibold text-[color:var(--lkv-text-secondary)]">
              <Icon name="banknote" size={13} /> Réel (dépensé)
            </div>
            <div className="mt-1 text-[length:var(--lkv-text-title-sm)] font-extrabold text-[color:var(--lkv-text-primary)]">
              {budgetSummary.totalSpent} {budgetSummary.currency}
            </div>
            <div className="mt-1 text-[11px] text-[color:var(--lkv-text-muted)]">
              {realExpenses.length} dépense{realExpenses.length > 1 ? 's' : ''} réelle
              {realExpenses.length > 1 ? 's' : ''}
            </div>
          </Card>

          <Card variant="compact" className="p-[var(--space-4)]">
            <div className="flex items-center gap-[var(--space-2)] text-[length:var(--lkv-text-footnote)] font-semibold text-[color:var(--lkv-text-secondary)]">
              {isMulti ? (
                <Icon name="trending-up" size={13} />
              ) : (
                <Icon name="credit-card" size={13} />
              )}{' '}
              Restant à payer
            </div>
            <div className="mt-1 text-[length:var(--lkv-text-title-sm)] font-extrabold text-[color:var(--lkv-text-primary)]">
              {isMulti
                ? `${Math.round(outstandingDebts * 100) / 100} ${budgetSummary.currency}`
                : `${budgetSummary.remainingBudget !== null ? budgetSummary.remainingBudget : budgetSummary.totalSpent} ${budgetSummary.currency}`}
            </div>
            <div className="mt-1 text-[11px]">
              {budgetSummary.estimatedBudget !== null ? (
                <span
                  className={
                    budgetSummary.isOverBudget
                      ? 'flex items-center gap-[var(--space-1)] font-semibold text-[color:var(--lkv-danger)]'
                      : 'text-[color:var(--lkv-success)]'
                  }
                >
                  {budgetSummary.isOverBudget && <Icon name="alert-triangle" size={12} />}
                  {budgetSummary.isOverBudget
                    ? `Dépassement de ${Math.abs(budgetSummary.remainingBudget ?? 0)} ${budgetSummary.currency}`
                    : `Reste du budget : ${budgetSummary.remainingBudget} ${budgetSummary.currency}`}
                </span>
              ) : (
                <span className="text-[color:var(--lkv-text-muted)]">Aucun budget estimé</span>
              )}
            </div>
          </Card>
        </div>

        {/* Progression du budget estimé */}
        {budgetSummary.estimatedBudget !== null && (
          <Card variant="compact" className="p-[var(--space-4)]">
            <div className="mb-[var(--space-2)] flex items-center justify-between text-[length:var(--lkv-text-footnote)]">
              <span className="font-semibold text-[color:var(--lkv-text-secondary)]">
                Budget estimé : {budgetSummary.estimatedBudget} {budgetSummary.currency}
              </span>
              <span
                className={`font-bold ${budgetSummary.isOverBudget ? 'text-[color:var(--lkv-danger)]' : 'text-[color:var(--lkv-text-primary)]'}`}
              >
                {budgetSummary.spentPercentage}%
              </span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-[color:var(--btn-tint)]">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  budgetSummary.isOverBudget
                    ? 'bg-[color:var(--lkv-danger)]'
                    : 'bg-[color:var(--lkv-primary)]'
                }`}
                style={{ width: `${Math.min(budgetSummary.spentPercentage ?? 0, 100)}%` }}
              />
            </div>
          </Card>
        )}

        {/* Timeline jour par jour : prévu → réel */}
        <div className="space-y-[var(--space-3)]">
          <div className="flex items-center justify-between">
            <h4 className="flex items-center gap-[var(--space-2)] text-[length:var(--lkv-text-subheadline)] font-bold text-[color:var(--lkv-text-primary)]">
              <Icon name="calendar-check" size={18} className="text-[color:var(--lkv-secondary)]" />
              Jour par jour — prévu vs réel
            </h4>
            {canManage && (
              <Button
                size="sm"
                onClick={() => {
                  setEditTarget(null);
                  setIsAddOpen(true);
                }}
                icon={<Icon name="plus" size={16} />}
              >
                Enregistrer une dépense
              </Button>
            )}
          </div>

          {dayPlan.length === 0 ? (
            <EmptyState
              icon={<Icon name="credit-card" size={32} className="text-[color:var(--lkv-secondary)]" />}
              title="Aucune dépense"
              description="Ajoutez des dépenses prévues à venir, ou enregistrez les dépenses réelles au fil du voyage."
              actionLabel={canManage ? 'Enregistrer une dépense' : undefined}
              onAction={
                canManage
                  ? () => {
                      setEditTarget(null);
                      setIsAddOpen(true);
                    }
                  : undefined
              }
            />
          ) : (
            dayPlan.map((row) => {
              const isToday = row.isToday;
              return (
                <Card key={row.date ?? `day-${row.dayNumber}`} tone={isToday ? 'info' : 'neutral'}>
                  {/* En-tête du jour */}
                  <div className="flex items-center justify-between gap-[var(--space-2)] border-b border-[color:var(--lkv-border-subtle)] pb-[var(--space-2)]">
                    <div className="flex min-w-0 items-center gap-[var(--space-2)]">
                      <Badge tone={isToday ? 'sage' : 'stone'}>J{row.dayNumber}</Badge>
                      <span className="truncate text-[length:var(--lkv-text-footnote)] font-bold text-[color:var(--lkv-text-primary)]">
                        {formatDayLabel(row.date)}
                      </span>
                      {isToday && (
                        <Badge tone="info" className="uppercase tracking-wide">
                          Aujourd&apos;hui
                        </Badge>
                      )}
                    </div>
                    <div className="shrink-0 font-semibold text-[11px] text-[color:var(--lkv-text-secondary)]">
                      {row.plannedTotal > 0 && (
                        <span className="mr-2">
                          Prévu : {row.plannedTotal} {budgetSummary.currency}
                        </span>
                      )}
                      <span
                        className={
                          row.realTotal > row.plannedTotal
                            ? 'text-[color:var(--lkv-danger)]'
                            : 'text-[color:var(--lkv-text-primary)]'
                        }
                      >
                        Réel : {row.realTotal} {budgetSummary.currency}
                      </span>
                    </div>
                  </div>

                  {/* Contenu prévu / réel */}
                  {isToday ? (
                    /* Le jour venu : prévu ET réel côte à côte */
                    <div className="grid grid-cols-1 gap-[var(--space-3)] pt-[var(--space-3)] sm:grid-cols-2">
                      <div className="space-y-[var(--space-2)]">
                        <div className="text-[10px] font-bold uppercase tracking-wide text-[color:var(--lkv-text-secondary)]">
                          Prévu
                        </div>
                        {row.planned.length === 0 ? (
                          <div className="py-1 text-[11px] italic text-[color:var(--lkv-text-muted)]">
                            Rien de prévu
                          </div>
                        ) : (
                          row.planned.map((exp) => (
                            <ExpenseRow
                              key={exp.id}
                              expense={exp}
                              currency={budgetSummary.currency}
                              isMulti={isMulti}
                              canManage={canManage}
                              isPending={isPending}
                              onEdit={() => setEditTarget(exp)}
                              onDelete={() =>
                                setConfirmState({ expenseId: exp.id, title: exp.title })
                              }
                              onSettle={() => {
                                if (isMulti) setSettleTarget(exp);
                                else handleSettle(exp);
                              }}
                            />
                          ))
                        )}
                      </div>
                      <div className="space-y-[var(--space-2)]">
                        <div className="text-[10px] font-bold uppercase tracking-wide text-[color:var(--lkv-text-secondary)]">
                          Réel
                        </div>
                        {row.real.length === 0 ? (
                          <div className="py-1 text-[11px] italic text-[color:var(--lkv-text-muted)]">
                            Rien encore dépensé
                          </div>
                        ) : (
                          row.real.map((exp) => (
                            <ExpenseRow
                              key={exp.id}
                              expense={exp}
                              currency={budgetSummary.currency}
                              isMulti={isMulti}
                              canManage={canManage}
                              isPending={isPending}
                              onEdit={() => setEditTarget(exp)}
                              onDelete={() =>
                                setConfirmState({ expenseId: exp.id, title: exp.title })
                              }
                            />
                          ))
                        )}
                        {canManage && (
                          <Button
                            variant="secondary"
                            fullWidth
                            size="sm"
                            icon={<Icon name="plus" size={14} />}
                            onClick={() => {
                              setEditTarget(null);
                              setIsAddOpen(true);
                            }}
                          >
                            Enregistrer une dépense du jour
                          </Button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-[var(--space-2)] pt-[var(--space-3)]">
                      {row.planned.map((exp) => (
                        <ExpenseRow
                          key={exp.id}
                          expense={exp}
                          currency={budgetSummary.currency}
                          isMulti={isMulti}
                          canManage={canManage}
                          isPending={isPending}
                          onEdit={() => setEditTarget(exp)}
                          onDelete={() => setConfirmState({ expenseId: exp.id, title: exp.title })}
                          onSettle={canManage ? () => handleSettle(exp) : undefined}
                        />
                      ))}
                      {row.real.map((exp) => (
                        <ExpenseRow
                          key={exp.id}
                          expense={exp}
                          currency={budgetSummary.currency}
                          isMulti={isMulti}
                          canManage={canManage}
                          isPending={isPending}
                          onEdit={() => setEditTarget(exp)}
                          onDelete={() => setConfirmState({ expenseId: exp.id, title: exp.title })}
                        />
                      ))}
                      {row.planned.length === 0 && row.real.length === 0 && (
                        <div className="py-1 text-[11px] italic text-[color:var(--lkv-text-muted)]">
                          Aucune dépense ce jour
                        </div>
                      )}
                    </div>
                  )}
                </Card>
              );
            })
          )}
        </div>

        {/* Règlements de compte simplifiés & Balances (multi uniquement) */}
        {isMulti && (
          <div className="grid grid-cols-1 gap-[var(--space-6)] md:grid-cols-2">
            <Card className="space-y-[var(--space-3)]">
              <div className="flex items-center justify-between border-b border-[color:var(--lkv-border-subtle)] pb-[var(--space-2)]">
                <h4 className="flex items-center gap-[var(--space-2)] text-[length:var(--lkv-text-footnote)] font-bold text-[color:var(--lkv-text-primary)]">
                  <Icon name="trending-up" size={16} className="text-[color:var(--lkv-secondary)]" />
                  <span>Règlements de compte optimaux</span>
                </h4>
                <span className="text-[11px] text-[color:var(--lkv-text-secondary)]">
                  Algorithme de split
                </span>
              </div>

              {budgetSummary.settlements.length === 0 ? (
                <Card
                  tone="sage"
                  className="flex items-center gap-[var(--space-2)] p-[var(--space-4)] text-[length:var(--lkv-text-footnote)] text-[color:var(--lkv-text-primary)]"
                >
                  <Icon name="check-circle" size={16} className="shrink-0" />
                  <span>Tous les comptes sont équilibrés. Aucun remboursement en attente.</span>
                </Card>
              ) : (
                <div className="space-y-[var(--space-2)]">
                  {budgetSummary.settlements.map((s, idx) => (
                    <Card
                      key={idx}
                      variant="compact"
                      className="flex items-center justify-between gap-[var(--space-2)] text-[length:var(--lkv-text-footnote)]"
                    >
                      <div className="flex items-center gap-[var(--space-2)] truncate">
                        <span className="font-semibold text-[color:var(--lkv-text-primary)]">
                          {s.fromName}
                        </span>
                        <Icon
                          name="arrow-right"
                          size={14}
                          className="shrink-0 text-[color:var(--lkv-secondary)]"
                        />
                        <span className="font-semibold text-[color:var(--lkv-text-primary)]">
                          {s.toName}
                        </span>
                      </div>
                      <div className="shrink-0 text-[length:var(--lkv-text-footnote)] font-extrabold text-[color:var(--lkv-text-primary)]">
                        {s.amount} {budgetSummary.currency}
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </Card>

            <Card className="space-y-[var(--space-3)]">
              <div className="flex items-center justify-between border-b border-[color:var(--lkv-border-subtle)] pb-[var(--space-2)]">
                <h4 className="text-[length:var(--lkv-text-footnote)] font-bold text-[color:var(--lkv-text-primary)]">
                  Solde net par participant
                </h4>
                <span className="text-[11px] text-[color:var(--lkv-text-secondary)]">
                  {budgetSummary.balances.length} membre
                  {budgetSummary.balances.length > 1 ? 's' : ''}
                </span>
              </div>

              <div className="space-y-[var(--space-2)]">
                {budgetSummary.balances.map((b) => (
                  <Card
                    key={b.userId}
                    variant="compact"
                    className="flex items-center justify-between text-[length:var(--lkv-text-footnote)]"
                  >
                    <div>
                      <div className="font-semibold text-[color:var(--lkv-text-primary)]">
                        {b.name}
                      </div>
                      <div className="text-[10px] text-[color:var(--lkv-text-muted)]">
                        Payé : {b.paid} {budgetSummary.currency} · Part : {b.share}{' '}
                        {budgetSummary.currency}
                      </div>
                    </div>
                    <Badge tone={b.net > 0 ? 'sage' : b.net < 0 ? 'danger' : 'stone'}>
                      {b.net > 0 ? `+${b.net}` : b.net} {budgetSummary.currency}
                    </Badge>
                  </Card>
                ))}
              </div>
            </Card>
          </div>
        )}

        {/* Ventilation par catégories (réel uniquement, via le moteur) */}
        {Object.keys(budgetSummary.categories).length > 0 && (
          <Card className="space-y-[var(--space-3)]">
            <h4 className="text-[length:var(--lkv-text-footnote)] font-bold text-[color:var(--lkv-text-primary)]">
              Ventilation par catégorie
            </h4>
            <div className="grid grid-cols-2 gap-[var(--space-3)] sm:grid-cols-3 md:grid-cols-4">
              {Object.entries(budgetSummary.categories)
                .sort((a, b) => b[1] - a[1])
                .map(([cat, amt]) => {
                  const pct =
                    budgetSummary.totalSpent > 0
                      ? Math.round((amt / budgetSummary.totalSpent) * 100)
                      : 0;
                  return (
                    <Card key={cat} variant="compact" className="space-y-[var(--space-1)]">
                      <div className="flex justify-between text-[length:var(--lkv-text-footnote)]">
                        <span className="font-semibold capitalize text-[color:var(--lkv-text-primary)]">
                          {cat}
                        </span>
                        <span className="text-[color:var(--lkv-text-muted)]">{pct}%</span>
                      </div>
                      <div className="text-[length:var(--lkv-text-footnote)] font-bold text-[color:var(--lkv-text-primary)]">
                        {amt} {budgetSummary.currency}
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-[color:var(--btn-tint)]">
                        <div
                          className="h-full rounded-full bg-[color:var(--lkv-secondary)]"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </Card>
                  );
                })}
            </div>
          </Card>
        )}

        {/* Modal de saisie / édition de dépense */}
        <ExpenseFormSheet
          key={editTarget?.id ?? 'new'}
          open={isAddOpen || editTarget !== null}
          trip={trip}
          expense={editTarget}
          isMulti={isMulti}
          isPending={isPending}
          onSubmit={handleSaveExpense}
          onClose={() => {
            setIsAddOpen(false);
            setEditTarget(null);
          }}
        />

        {/* Choix du payeur pour « Régler » une dépense prévue (multi) */}
        <Sheet
          open={settleTarget !== null}
          onOpenChange={(open) => !open && setSettleTarget(null)}
          title="Régler la dépense prévue"
        >
          <div className="space-y-[var(--space-4)] pb-2">
            {settleTarget && (
              <>
                <p className="text-[length:var(--lkv-text-footnote)] text-[color:var(--lkv-text-muted)]">
                  « {settleTarget.title} » ({settleTarget.amount} {budgetSummary.currency}) passe en
                  dépense réelle. Qui a payé ?
                </p>
                <ul className="space-y-[var(--space-2)]">
                  {(trip.collaborators || []).map((c) => (
                    <li key={c.user_id}>
                      <ListItem
                        as="div"
                        disabled={isPending}
                        selected={c.user_id === trip.user_id}
                        onClick={() => handleSettle(settleTarget, c.user_id)}
                        title={c.profile?.full_name || `Voyageur (${c.user_id.slice(0, 6)})`}
                        trailing={
                          c.user_id === trip.user_id ? (
                            <span className="text-[10px] text-[color:var(--lkv-text-muted)]">
                              (moi)
                            </span>
                          ) : undefined
                        }
                      />
                    </li>
                  ))}
                </ul>
                <div className="flex justify-end pt-[var(--space-1)]">
                  <Button variant="secondary" size="sm" onClick={() => setSettleTarget(null)}>
                    Annuler
                  </Button>
                </div>
              </>
            )}
          </div>
        </Sheet>

        {/* Modale de confirmation de suppression */}
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

      <BudgetMobileExperience trip={trip} initialDay={initialDay} />
    </>
  );
}
