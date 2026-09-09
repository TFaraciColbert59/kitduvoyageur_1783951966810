'use client';

import React, { useEffect, useMemo, useState, useTransition } from 'react';
import {
  CreditCard,
  Plus,
  Trash2,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  ArrowRight,
  CalendarDays,
  Pencil,
  Banknote,
  CalendarCheck,
} from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import { GlassCapsuleBtn } from '@/components/ui/GlassCapsuleBtn';
import { GlassModal } from '@/components/ui/GlassModal';
import { EmptyState } from '@/components/ui/EmptyState';
import { calculateBudgetSummary, buildBudgetDayPlan } from '../engine/budgetEngine';
import {
  addExpenseAction,
  updateExpenseAction,
  settleExpenseAction,
  deleteExpenseAction,
} from '@/app/voyages/budget-actions';
import { ConfirmDialog } from './ConfirmDialog';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import type { TripFull, TripExpense } from '../types/trip.types';

interface TripBudgetViewProps {
  trip: TripFull;
}

const CATEGORY_OPTIONS = ['hébergement', 'nourriture', 'transport', 'activités', 'matériel', 'divers'];

const MONTHS_FR = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

function formatDayLabel(date: string | null): string {
  if (!date) return 'Sans date';
  const [, m, d] = date.split('-');
  return `${Number(d)} ${MONTHS_FR[Number(m) - 1] ?? ''}`;
}

export function TripBudgetView({ trip }: TripBudgetViewProps) {
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [confirmState, setConfirmState] = useState<{ expenseId: string; title: string } | null>(null);
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
    setLocalExpenses(prev => prev.filter(e => e.id !== expenseId));
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
    setLocalExpenses(prev =>
      prev.map(e => (e.id === expense.id ? { ...e, is_planned: false, payer_id: payerId || e.payer_id } : e))
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

  const handleSaveExpense = async (e: React.FormEvent<HTMLFormElement>, target: TripExpense | null) => {
    e.preventDefault();
    setErrorMsg(null);

    const formData = new FormData(e.currentTarget);
    formData.set('tripId', trip.id);
    formData.set('tripSlug', trip.slug);
    formData.set('currency', trip.budget_currency || 'EUR');
    if (!target) {
      formData.set('isPlanned', formData.get('isPlanned') === 'on' ? 'true' : 'false');
    }

    const parsedTitle = formData.get('title')?.toString() || '';
    const parsedAmount = Number(formData.get('amount') || 0);
    const parsedDate = formData.get('expenseDate')?.toString() || today;
    const parsedCategory = formData.get('category')?.toString() || 'divers';
    const parsedPayer = formData.get('payerId')?.toString() || '';
    const parsedSplit = formData.get('splitType')?.toString() || 'equal';
    const parsedIsPlanned = formData.get('isPlanned') === 'true' || formData.get('isPlanned') === 'on';

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
    setLocalExpenses(prev =>
      target ? prev.map(ex => (ex.id === target.id ? optimistic : ex)) : [...prev, optimistic]
    );

    startTransition(async () => {
      const res = target
        ? await updateExpenseAction(null, formData)
        : await addExpenseAction(null, formData);
      if (!res.success) {
        revertTo(snapshot);
        setErrorMsg(res.error || 'Erreur lors de l\'enregistrement');
      } else {
        triggerHaptic('success');
        setIsAddOpen(false);
        setEditTarget(null);
      }
    });
  };

  /* ---------------- Rendu ---------------- */

  const pendingExpenses = localExpenses.filter(e => e.is_planned);
  const realExpenses = localExpenses.filter(e => !e.is_planned);
  const outstandingDebts = budgetSummary.balances.reduce((sum, b) => sum + Math.max(0, -b.net), 0);

  return (
    <div className="space-y-6">
      {errorMsg && (
        <div className="p-3 rounded-xl glass tone-danger text-[var(--lkv-danger)] text-xs flex items-center justify-between gap-2">
          <span>{errorMsg}</span>
          <button
            onClick={() => setErrorMsg(null)}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full text-[var(--lkv-text-muted)] hover:text-[var(--lkv-text-primary)]"
            aria-label="Fermer le message"
          >
            ×
          </button>
        </div>
      )}

      {/* Bandeau synthèse : prévu vs réel vs reste */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <GlassCard tone="neutral" className="p-4 rounded-[var(--lkv-radius-lg)] border border-white/60 shadow-sm">
          <div className="text-xs text-lkv-secondary font-semibold flex items-center gap-1.5">
            <CalendarDays size={13} /> Prévu (prévisionnel)
          </div>
          <div className="text-2xl font-extrabold text-lkv-primary mt-1">
            {budgetSummary.plannedTotal} {budgetSummary.currency}
          </div>
          <div className="text-[11px] text-[var(--lkv-text-muted)] mt-1">
            {pendingExpenses.length} dépense{pendingExpenses.length > 1 ? 's' : ''} à venir
          </div>
        </GlassCard>

        <GlassCard tone="neutral" className="p-4 rounded-[var(--lkv-radius-lg)] border border-white/60 shadow-sm">
          <div className="text-xs text-lkv-secondary font-semibold flex items-center gap-1.5">
            <Banknote size={13} /> Réel (dépensé)
          </div>
          <div className="text-2xl font-extrabold text-lkv-primary mt-1">
            {budgetSummary.totalSpent} {budgetSummary.currency}
          </div>
          <div className="text-[11px] text-[var(--lkv-text-muted)] mt-1">
            {realExpenses.length} dépense{realExpenses.length > 1 ? 's' : ''} réelle{realExpenses.length > 1 ? 's' : ''}
          </div>
        </GlassCard>

        <GlassCard tone="neutral" className="p-4 rounded-[var(--lkv-radius-lg)] border border-white/60 shadow-sm">
          <div className="text-xs text-lkv-secondary font-semibold flex items-center gap-1.5">
            {isMulti ? <TrendingUp size={13} /> : <CreditCard size={13} />} Restant à payer
          </div>
          <div className="text-2xl font-extrabold text-lkv-primary mt-1">
            {isMulti
              ? `${Math.round(outstandingDebts * 100) / 100} ${budgetSummary.currency}`
              : `${budgetSummary.remainingBudget !== null ? budgetSummary.remainingBudget : budgetSummary.totalSpent} ${budgetSummary.currency}`}
          </div>
          <div className="text-[11px] mt-1">
            {budgetSummary.estimatedBudget !== null ? (
              <span className={budgetSummary.isOverBudget ? 'text-[var(--lkv-danger)] font-semibold flex items-center gap-1' : 'text-[var(--lkv-success)]'}>
                {budgetSummary.isOverBudget && <AlertTriangle size={12} />}
                {budgetSummary.isOverBudget
                  ? `Dépassement de ${Math.abs(budgetSummary.remainingBudget ?? 0)} ${budgetSummary.currency}`
                  : `Reste du budget : ${budgetSummary.remainingBudget} ${budgetSummary.currency}`}
              </span>
            ) : (
              <span className="text-[var(--lkv-text-muted)]">Aucun budget estimé</span>
            )}
          </div>
        </GlassCard>
      </div>

      {/* Progression du budget estimé */}
      {budgetSummary.estimatedBudget !== null && (
        <GlassCard tone="neutral" className="p-4 rounded-[var(--lkv-radius-lg)] border border-white/60 shadow-sm">
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="font-semibold text-lkv-secondary">
              Budget estimé : {budgetSummary.estimatedBudget} {budgetSummary.currency}
            </span>
            <span className={`font-bold ${budgetSummary.isOverBudget ? 'text-[var(--lkv-danger)]' : 'text-lkv-primary'}`}>
              {budgetSummary.spentPercentage}%
            </span>
          </div>
          <div className="w-full bg-white/30 h-2.5 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                budgetSummary.isOverBudget ? 'bg-[var(--lkv-danger)]' : 'bg-[var(--lkv-primary)]'
              }`}
              style={{ width: `${Math.min(budgetSummary.spentPercentage ?? 0, 100)}%` }}
            />
          </div>
        </GlassCard>
      )}

      {/* Timeline jour par jour : prévu → réel */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-base font-bold text-lkv-primary flex items-center gap-2">
            <CalendarCheck size={18} className="text-lkv-secondary" />
            Jour par jour — prévu vs réel
          </h4>
          {canManage && (
            <GlassCapsuleBtn
              variant="primary"
              size="sm"
              onClick={() => {
                setEditTarget(null);
                setIsAddOpen(true);
              }}
              icon={<Plus size={16} />}
            >
              Enregistrer une dépense
            </GlassCapsuleBtn>
          )}
        </div>

        {dayPlan.length === 0 ? (
          <EmptyState
            icon={<CreditCard size={32} className="text-lkv-secondary" />}
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
          dayPlan.map(row => {
            const isToday = row.isToday;
            return (
              <GlassCard
                key={row.date ?? `day-${row.dayNumber}`}
                tone={isToday ? 'info' : 'neutral'}
                className={`p-4 rounded-[var(--lkv-radius-lg)] border shadow-xs ${
                  isToday ? 'border-[var(--lkv-primary)]/40 ring-1 ring-[var(--lkv-primary)]/20' : 'border-white/60'
                }`}
              >
                {/* En-tête du jour */}
                <div className="flex items-center justify-between gap-2 pb-2 border-b border-white/40">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`text-xs font-extrabold px-2 py-0.5 rounded-full ${
                      isToday ? 'bg-[var(--lkv-primary)] text-white' : 'glass-pill text-lkv-secondary'
                    }`}>
                      J{row.dayNumber}
                    </span>
                    <span className="text-sm font-bold text-lkv-primary truncate">
                      {formatDayLabel(row.date)}
                    </span>
                    {isToday && (
                      <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-[var(--lkv-primary)]/15 text-[var(--lkv-primary)] border border-[var(--lkv-primary)]/30">
                        Aujourd&apos;hui
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-lkv-secondary shrink-0 font-semibold">
                    {row.plannedTotal > 0 && <span className="mr-2">Prévu : {row.plannedTotal} {budgetSummary.currency}</span>}
                    <span className={row.realTotal > row.plannedTotal ? 'text-[var(--lkv-danger)]' : 'text-lkv-primary'}>
                      Réel : {row.realTotal} {budgetSummary.currency}
                    </span>
                  </div>
                </div>

                {/* Contenu prévu / réel */}
                {isToday ? (
                  /* Le jour venu : prévu ET réel côte à côte */
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3">
                    <div className="space-y-2">
                      <div className="text-[10px] font-bold uppercase tracking-wide text-lkv-secondary">Prévu</div>
                      {row.planned.length === 0 ? (
                        <div className="text-[11px] text-[var(--lkv-text-muted)] italic py-1">Rien de prévu</div>
                      ) : (
                        row.planned.map(exp => (
                          <DayExpenseRow
                            key={exp.id}
                            expense={exp}
                            currency={budgetSummary.currency}
                            isMulti={isMulti}
                            canManage={canManage}
                            isPending={isPending}
                            onEdit={() => setEditTarget(exp)}
                            onDelete={() => setConfirmState({ expenseId: exp.id, title: exp.title })}
                            onSettle={() => {
                              if (isMulti) setSettleTarget(exp);
                              else handleSettle(exp);
                            }}
                          />
                        ))
                      )}
                    </div>
                    <div className="space-y-2">
                      <div className="text-[10px] font-bold uppercase tracking-wide text-lkv-secondary">Réel</div>
                      {row.real.length === 0 ? (
                        <div className="text-[11px] text-[var(--lkv-text-muted)] italic py-1">Rien encore dépensé</div>
                      ) : (
                        row.real.map(exp => (
                          <DayExpenseRow
                            key={exp.id}
                            expense={exp}
                            currency={budgetSummary.currency}
                            isMulti={isMulti}
                            canManage={canManage}
                            isPending={isPending}
                            onEdit={() => setEditTarget(exp)}
                            onDelete={() => setConfirmState({ expenseId: exp.id, title: exp.title })}
                          />
                        ))
                      )}
                      {canManage && (
                        <button
                          onClick={() => {
                            setEditTarget(null);
                            setIsAddOpen(true);
                          }}
                          className="min-h-[44px] w-full flex items-center justify-center gap-2 rounded-[var(--lkv-radius-md)] border border-dashed border-[var(--lkv-primary)]/40 text-[var(--lkv-primary)] text-xs font-semibold hover:bg-[var(--lkv-primary)]/5 transition-all"
                        >
                          <Plus size={14} /> Enregistrer une dépense du jour
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2 pt-3">
                    {row.planned.map(exp => (
                      <DayExpenseRow
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
                    {row.real.map(exp => (
                      <DayExpenseRow
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
                      <div className="text-[11px] text-[var(--lkv-text-muted)] italic py-1">Aucune dépense ce jour</div>
                    )}
                  </div>
                )}
              </GlassCard>
            );
          })
        )}
      </div>

      {/* Règlements de compte simplifiés & Balances (multi uniquement) */}
      {isMulti && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <GlassCard tone="neutral" className="p-5 rounded-[var(--lkv-radius-lg)] border border-white/60 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-white/40 pb-2">
              <h4 className="text-sm font-bold text-lkv-primary flex items-center gap-2">
                <TrendingUp size={16} className="text-lkv-secondary" />
                <span>Règlements de compte optimaux</span>
              </h4>
              <span className="text-[11px] text-lkv-secondary">Algorithme de split</span>
            </div>

            {budgetSummary.settlements.length === 0 ? (
              <div className="p-4 rounded-xl glass tone-sage text-[var(--lkv-success)] text-xs flex items-center gap-2">
                <CheckCircle size={16} className="shrink-0" />
                <span>Tous les comptes sont équilibrés. Aucun remboursement en attente.</span>
              </div>
            ) : (
              <div className="space-y-2">
                {budgetSummary.settlements.map((s, idx) => (
                  <div
                    key={idx}
                    className="glass-sub-card p-3 rounded-[var(--lkv-radius-md)] border border-white/60 flex items-center justify-between text-xs gap-2 shadow-2xs"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span className="font-semibold text-[var(--lkv-text-primary)]">{s.fromName}</span>
                      <ArrowRight size={14} className="text-lkv-secondary shrink-0" />
                      <span className="font-semibold text-lkv-primary">{s.toName}</span>
                    </div>
                    <div className="text-sm font-extrabold text-lkv-primary shrink-0">
                      {s.amount} {budgetSummary.currency}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </GlassCard>

          <GlassCard tone="neutral" className="p-5 rounded-[var(--lkv-radius-lg)] border border-white/60 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-white/40 pb-2">
              <h4 className="text-sm font-bold text-lkv-primary">Solde net par participant</h4>
              <span className="text-[11px] text-lkv-secondary">{budgetSummary.balances.length} membre{budgetSummary.balances.length > 1 ? 's' : ''}</span>
            </div>

            <div className="space-y-2">
              {budgetSummary.balances.map(b => (
                <div
                  key={b.userId}
                  className="glass-sub-card p-2.5 rounded-[var(--lkv-radius-md)] border border-white/60 flex items-center justify-between text-xs shadow-2xs"
                >
                  <div>
                    <div className="font-semibold text-lkv-primary">{b.name}</div>
                    <div className="text-[10px] text-[var(--lkv-text-muted)]">
                      Payé : {b.paid} {budgetSummary.currency} · Part : {b.share} {budgetSummary.currency}
                    </div>
                  </div>
                  <div
                    className={`text-xs font-bold px-2.5 py-1 rounded-full border ${
                      b.net > 0
                        ? 'bg-[var(--lkv-primary)]/10 text-[var(--lkv-primary)] border-[var(--lkv-primary)]/20'
                        : b.net < 0
                        ? 'bg-[var(--lkv-danger)]/10 text-[var(--lkv-danger)] border-[var(--lkv-danger)]/20'
                        : 'glass-pill'
                    }`}
                  >
                    {b.net > 0 ? `+${b.net}` : b.net} {budgetSummary.currency}
                  </div>
                </div>
              ))}
            </div>
          </GlassCard>
        </div>
      )}

      {/* Ventilation par catégories (réel uniquement, via le moteur) */}
      {Object.keys(budgetSummary.categories).length > 0 && (
        <GlassCard tone="neutral" className="p-5 rounded-[var(--lkv-radius-lg)] border border-white/60 shadow-sm space-y-3">
          <h4 className="text-sm font-bold text-lkv-primary">Ventilation par catégorie</h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {Object.entries(budgetSummary.categories)
              .sort((a, b) => b[1] - a[1])
              .map(([cat, amt]) => {
                const pct = budgetSummary.totalSpent > 0 ? Math.round((amt / budgetSummary.totalSpent) * 100) : 0;
                return (
                  <div key={cat} className="glass-sub-card p-3 rounded-[var(--lkv-radius-md)] border border-white/60 space-y-1 shadow-2xs">
                    <div className="flex justify-between text-xs">
                      <span className="capitalize font-semibold text-lkv-primary">{cat}</span>
                      <span className="text-[var(--lkv-text-muted)]">{pct}%</span>
                    </div>
                    <div className="text-sm font-bold text-[var(--lkv-text-primary)]">
                      {amt} {budgetSummary.currency}
                    </div>
                    <div className="w-full bg-white/30 h-1.5 rounded-full overflow-hidden">
                      <div className="bg-[var(--lkv-secondary)] h-full rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
          </div>
        </GlassCard>
      )}

      {/* Modal de saisie / édition de dépense */}
      <ExpenseEditModal
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
      <GlassModal
        open={settleTarget !== null}
        onOpenChange={open => !open && setSettleTarget(null)}
        title="Régler la dépense prévue"
        variant="sheet"
      >
        <div className="pb-2 space-y-4">
          {settleTarget && (
            <>
              <p className="text-xs text-[var(--lkv-text-muted)]">
                « {settleTarget.title} » ({settleTarget.amount} {budgetSummary.currency}) passe en dépense réelle.
                Qui a payé ?
              </p>
              <div className="space-y-2">
                {(trip.collaborators || []).map(c => (
                  <button
                    key={c.user_id}
                    onClick={() => handleSettle(settleTarget, c.user_id)}
                    disabled={isPending}
                    className={`min-h-[44px] w-full glass-sub-card px-4 py-2.5 rounded-[var(--lkv-radius-md)] border border-white/60 text-sm font-semibold text-left transition-all hover:border-[var(--lkv-primary)]/40 ${
                      c.user_id === trip.user_id ? 'ring-1 ring-[var(--lkv-primary)]/30' : ''
                    }`}
                  >
                    {c.profile?.full_name || `Voyageur (${c.user_id.slice(0, 6)})`}
                    {c.user_id === trip.user_id && (
                      <span className="text-[10px] ml-2 text-[var(--lkv-text-muted)]">(moi)</span>
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

      {/* Modale de confirmation de suppression */}
      <ConfirmDialog
        open={confirmState !== null}
        title='Supprimer la dépense ?'
        message={confirmState ? `La dépense « ${confirmState.title} » sera définitivement supprimée.` : undefined}
        confirmLabel="Supprimer"
        cancelLabel="Annuler"
        danger
        onConfirm={confirmDelete}
        onCancel={() => setConfirmState(null)}
      />
    </div>
  );
}

/* ================= Sous-composants ================= */

interface DayExpenseRowProps {
  expense: TripExpense;
  currency: string;
  isMulti: boolean;
  canManage: boolean;
  isPending: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onSettle?: () => void;
}

function DayExpenseRow({
  expense,
  currency,
  isMulti,
  canManage,
  isPending,
  onEdit,
  onDelete,
  onSettle,
}: DayExpenseRowProps) {
  const isPlanned = expense.is_planned;
  return (
    <div
      className={`glass-sub-card p-2.5 rounded-[var(--lkv-radius-md)] border flex items-center justify-between gap-2 shadow-2xs ${
        isPlanned ? 'border-dashed border-[var(--lkv-secondary)]/40' : 'border-white/60'
      }`}
    >
      <div className="min-w-0">
        <div className="text-sm font-bold text-lkv-primary truncate">{expense.title}</div>
        <div className="text-[10px] text-lkv-secondary truncate">
          <span className="capitalize">{expense.category || 'divers'}</span>
          {isMulti && expense.payer?.full_name && <> · {expense.payer.full_name}</>}
          {isPlanned && expense.split_type !== 'individual' && ' · partagé'}
        </div>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        <div className={`text-sm font-extrabold ${isPlanned ? 'text-lkv-secondary' : 'text-lkv-primary'}`}>
          {expense.amount} {currency}
        </div>
        {canManage && onSettle && (
          <button
            onClick={onSettle}
            disabled={isPending}
            className="min-h-[44px] min-w-[44px] px-2 flex items-center justify-center gap-1 rounded-full bg-[var(--lkv-primary)]/10 text-[var(--lkv-primary)] text-[11px] font-bold hover:bg-[var(--lkv-primary)]/20 transition-all"
            title="Régler cette dépense prévue"
          >
            <CheckCircle size={14} />
            <span className="sr-only sm:inline">Régler</span>
          </button>
        )}
        {canManage && (
          <>
            <button
              onClick={onEdit}
              disabled={isPending}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full glass-sub-card border border-white/60 text-[var(--lkv-text-muted)] hover:text-lkv-primary transition-all shadow-2xs"
              title="Modifier la dépense"
            >
              <Pencil size={14} />
            </button>
            <button
              onClick={onDelete}
              disabled={isPending}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full glass-sub-card border border-white/60 text-[var(--lkv-text-muted)] hover:text-[var(--lkv-danger)] hover:bg-[var(--lkv-danger)]/10 transition-all shadow-2xs"
              title="Supprimer la dépense"
            >
              <Trash2 size={14} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

interface ExpenseEditModalProps {
  open: boolean;
  trip: TripFull;
  expense: TripExpense | null;
  isMulti: boolean;
  isPending: boolean;
  onSubmit: (e: React.FormEvent<HTMLFormElement>, target: TripExpense | null) => void;
  onClose: () => void;
}

function ExpenseEditModal({ open, trip, expense, isMulti, isPending, onSubmit, onClose }: ExpenseEditModalProps) {
  const todayStr = new Date().toISOString().slice(0, 10);
  const isPlannedDefault = expense ? expense.is_planned : false;

  return (
    <GlassModal open={open} onOpenChange={o => !o && onClose()} title={expense ? 'Modifier la dépense' : 'Nouvelle dépense'} variant="sheet">
      <div className="pb-2">
        <form onSubmit={e => onSubmit(e, expense)} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-lkv-primary mb-1">Intitulé de la dépense</label>
            <input
              type="text"
              name="title"
              required
              defaultValue={expense?.title ?? ''}
              placeholder="ex : Refuge des Écrins, Ravitaillement bivouac"
              className="glass-input w-full px-3 py-2 text-sm text-[var(--lkv-text-primary)]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-lkv-primary mb-1">Montant ({trip.budget_currency || 'EUR'})</label>
              <input
                type="number"
                name="amount"
                step="0.01"
                min="0.01"
                required
                defaultValue={expense?.amount ?? ''}
                placeholder="0.00"
                className="glass-input w-full px-3 py-2 text-sm text-[var(--lkv-text-primary)]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-lkv-primary mb-1">Catégorie</label>
              <select
                name="category"
                defaultValue={expense?.category ?? 'hébergement'}
                className="glass-input w-full px-3 py-2 text-sm text-[var(--lkv-text-primary)]"
              >
                {CATEGORY_OPTIONS.map(cat => (
                  <option key={cat} value={cat}>
                    {cat.charAt(0).toUpperCase() + cat.slice(1)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-lkv-primary mb-1">Date</label>
              <input
                type="date"
                name="expenseDate"
                defaultValue={expense?.expense_date ?? todayStr}
                required
                className="glass-input w-full px-3 py-2 text-sm text-[var(--lkv-text-primary)]"
              />
            </div>

            {isMulti ? (
              <div>
                <label className="block text-xs font-semibold text-lkv-primary mb-1">Répartition</label>
                <select
                  name="splitType"
                  defaultValue={expense?.split_type ?? 'equal'}
                  className="glass-input w-full px-3 py-2 text-sm text-[var(--lkv-text-primary)]"
                >
                  <option value="equal">Partagée équitablement</option>
                  <option value="individual">Dépense personnelle</option>
                </select>
              </div>
            ) : (
              <input type="hidden" name="splitType" value={expense?.split_type ?? 'equal'} className="hidden" />
            )}
          </div>

          {isMulti && (
            <div>
              <label className="block text-xs font-semibold text-lkv-primary mb-1">Payé par</label>
              <select
                name="payerId"
                defaultValue={expense?.payer_id ?? trip.user_id}
                className="glass-input w-full px-3 py-2 text-sm text-[var(--lkv-text-primary)]"
              >
                {(trip.collaborators || []).map(c => (
                  <option key={c.user_id} value={c.user_id}>
                    {c.profile?.full_name || `Voyageur (${c.user_id.slice(0, 6)})`}
                  </option>
                ))}
              </select>
            </div>
          )}

          <label className="flex items-center gap-2 min-h-[44px] text-xs font-semibold text-lkv-primary cursor-pointer">
            <input
              type="checkbox"
              name="isPlanned"
              defaultChecked={expense?.is_planned ?? false}
              className="w-4 h-4 accent-[var(--lkv-primary)]"
            />
            Dépense prévue (à régler le jour venu)
          </label>

          <div className="flex items-center justify-end gap-3 pt-2">
            <GlassCapsuleBtn type="button" variant="default" size="sm" onClick={onClose}>
              Annuler
            </GlassCapsuleBtn>
            <GlassCapsuleBtn type="submit" variant="primary" size="sm" disabled={isPending}>
              {isPending ? 'Enregistrement...' : expense ? 'Enregistrer les modifications' : 'Valider la dépense'}
            </GlassCapsuleBtn>
          </div>
        </form>
      </div>
    </GlassModal>
  );
}
