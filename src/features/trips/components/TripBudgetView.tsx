'use client';

import React, { useState, useTransition } from 'react';
import { CreditCard, Plus, Trash2, TrendingUp, AlertTriangle, CheckCircle, ArrowRight, X } from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import { GlassCapsuleBtn } from '@/components/ui/GlassCapsuleBtn';
import { EmptyState } from '@/components/ui/EmptyState';
import { calculateBudgetSummary } from '../engine/budgetEngine';
import { addExpenseAction, deleteExpenseAction } from '@/app/voyages/budget-actions';
import { ConfirmDialog } from './ConfirmDialog';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import type { TripFull } from '../types/trip.types';

interface TripBudgetViewProps {
  trip: TripFull;
}

export function TripBudgetView({ trip }: TripBudgetViewProps) {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [confirmState, setConfirmState] = useState<{ expenseId: string; title: string } | null>(null);
  const { triggerHaptic } = useHapticFeedback();

  const budgetSummary = calculateBudgetSummary(
    { estimated_budget: trip.estimated_budget, budget_currency: trip.budget_currency },
    trip.expenses || [],
    trip.collaborators || []
  );

  const canManage = trip.permissions.canManageBudget;

  const confirmDelete = () => {
    if (!confirmState) return;
    const { expenseId } = confirmState;
    setConfirmState(null);
    triggerHaptic('medium');
    startTransition(async () => {
      const res = await deleteExpenseAction(trip.id, expenseId, trip.slug);
      if (!res.success) {
        setErrorMsg(res.error || 'Impossible de supprimer cette dépense');
      }
    });
  };

  const handleAddSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMsg(null);

    const formData = new FormData(e.currentTarget);
    formData.set('tripId', trip.id);
    formData.set('tripSlug', trip.slug);
    formData.set('currency', trip.budget_currency || 'EUR');

    startTransition(async () => {
      const res = await addExpenseAction(null, formData);
      if (!res.success) {
        setErrorMsg(res.error || 'Erreur lors de l\'enregistrement');
      } else {
        triggerHaptic('success');
        setIsAddOpen(false);
      }
    });
  };

  const categoryEntries = Object.entries(budgetSummary.categories).sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-6">
      {/* En-tête de section */}
      {errorMsg && (
        <div className="p-3 rounded-xl glass tone-danger text-[var(--lkv-danger)] text-xs">
          {errorMsg}
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold text-lkv-primary flex items-center gap-2">
            <CreditCard size={22} className="text-lkv-secondary" />
            <span>Budget & Partage des Dépenses</span>
          </h3>
          <p className="text-xs text-lkv-secondary mt-1">
            Suivi des dépenses en temps réel, répartition équitable entre membres et simplification des remboursements.
          </p>
        </div>

        {canManage && (
          <GlassCapsuleBtn
            variant="primary"
            size="sm"
            onClick={() => setIsAddOpen(true)}
            icon={<Plus size={16} />}
          >
            Ajouter une dépense
          </GlassCapsuleBtn>
        )}
      </div>

      {/* Cartes de synthèse budgétaire */}
      <div className={`grid grid-cols-1 sm:grid-cols-2 ${trip.collaborators.length > 0 ? 'lg:grid-cols-4' : 'sm:grid-cols-3'} gap-4`}>
        {/* Total dépensé */}
        <GlassCard tone="neutral" className="p-4 rounded-[var(--lkv-radius-lg)] border border-white/60 shadow-sm">
          <div className="text-xs text-lkv-secondary font-semibold">Total des dépenses réelles</div>
          <div className="text-2xl font-extrabold text-lkv-primary mt-1">
            {budgetSummary.totalSpent} {budgetSummary.currency}
          </div>
          <div className="text-[11px] text-[var(--lkv-text-muted)] mt-1">
            {trip.expenses.length} dépense{trip.expenses.length > 1 ? 's' : ''} enregistrée{trip.expenses.length > 1 ? 's' : ''}
          </div>
        </GlassCard>

        {/* Budget prévisionnel & reste */}
        <GlassCard tone="neutral" className="p-4 rounded-[var(--lkv-radius-lg)] border border-white/60 shadow-sm">
          <div className="text-xs text-lkv-secondary font-semibold">Budget prévisionnel</div>
          <div className="text-2xl font-extrabold text-lkv-primary mt-1">
            {budgetSummary.estimatedBudget ? `${budgetSummary.estimatedBudget} ${budgetSummary.currency}` : 'Non défini'}
          </div>
          <div className="text-[11px] mt-1">
            {budgetSummary.remainingBudget !== null ? (
              <span className={budgetSummary.isOverBudget ? 'text-[var(--lkv-danger)] font-semibold flex items-center gap-1' : 'text-[var(--lkv-success)]'}>
                {budgetSummary.isOverBudget && <AlertTriangle size={12} />}
                {budgetSummary.isOverBudget
                  ? `Dépassement de ${Math.abs(budgetSummary.remainingBudget)} ${budgetSummary.currency}`
                  : `Reste disponible : ${budgetSummary.remainingBudget} ${budgetSummary.currency}`}
              </span>
            ) : (
              <span className="text-[var(--lkv-text-muted)]">Aucune limite fixée</span>
            )}
          </div>
        </GlassCard>

        {/* Taux de consommation */}
        <GlassCard tone="neutral" className="p-4 rounded-[var(--lkv-radius-lg)] border border-white/60 shadow-sm">
          <div className="text-xs text-lkv-secondary font-semibold">Taux de consommation</div>
          <div className="text-2xl font-extrabold text-lkv-primary mt-1">
            {budgetSummary.spentPercentage !== null ? `${budgetSummary.spentPercentage}%` : '—'}
          </div>
          {budgetSummary.spentPercentage !== null && (
            <div className="w-full bg-white/30 h-2 rounded-full mt-2 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  budgetSummary.isOverBudget ? 'bg-[var(--lkv-danger)]' : 'bg-[var(--lkv-primary)]'
                }`}
                style={{ width: `${Math.min(budgetSummary.spentPercentage, 100)}%` }}
              />
            </div>
          )}
        </GlassCard>

        {/* Répartition par tête si groupe / duo */}
        {trip.collaborators.length > 0 && (
          <GlassCard tone="neutral" className="p-4 rounded-[var(--lkv-radius-lg)] border border-white/60 shadow-sm">
            <div className="text-xs text-lkv-secondary font-semibold">Part moyenne / voyageur</div>
            <div className="text-2xl font-extrabold text-lkv-primary mt-1">
              {Math.round(budgetSummary.totalSpent / (trip.collaborators.length + 1))} {budgetSummary.currency}
            </div>
            <div className="text-[11px] text-[var(--lkv-text-muted)] mt-1">
              Sur {trip.collaborators.length + 1} participants
            </div>
          </GlassCard>
        )}
      </div>

      {/* Règlements de compte simplifiés & Balances */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Settlements (Qui doit à qui) */}
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

        {/* Balances individuelles */}
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

      {/* Ventilation par Catégories */}
      {categoryEntries.length > 0 && (
        <GlassCard tone="neutral" className="p-5 rounded-[var(--lkv-radius-lg)] border border-white/60 shadow-sm space-y-3">
          <h4 className="text-sm font-bold text-lkv-primary">Ventilation par catégorie</h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {categoryEntries.map(([cat, amt]) => {
              const pct = Math.round((amt / budgetSummary.totalSpent) * 100);
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

      {/* Liste des dépenses détaillées */}
      <div className="space-y-3">
        <h4 className="text-base font-bold text-lkv-primary">Historique des dépenses</h4>
        {trip.expenses.length === 0 ? (
          <EmptyState
            icon={<CreditCard size={32} className="text-lkv-secondary" />}
            title="Aucune dépense enregistrée"
            description="Enregistrez les frais d'hébergement, transport, nourriture ou matériel pour suivre les comptes."
            actionLabel={canManage ? "Ajouter une dépense" : undefined}
            onAction={canManage ? () => setIsAddOpen(true) : undefined}
          />
        ) : (
          <div className="space-y-2">
            {trip.expenses.map(exp => (
              <GlassCard
                key={exp.id}
                tone="neutral"
                className="p-3.5 rounded-[var(--lkv-radius-lg)] border border-white/60 flex items-center justify-between gap-3 shadow-xs"
              >
                <div>
                  <div className="text-sm font-bold text-lkv-primary">{exp.title}</div>
                  <div className="text-xs text-lkv-secondary mt-0.5">
                    Payé par <span className="font-semibold">{exp.payer?.full_name || 'Voyageur'}</span> ·{' '}
                    <span className="capitalize">{exp.category || 'divers'}</span> · {exp.expense_date}
                    {exp.split_type === 'individual' && ' · Individuel'}
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-base font-extrabold text-lkv-primary">
                    {exp.amount} {exp.currency}
                  </div>
                  {canManage && (
                    <button
                      onClick={() => setConfirmState({ expenseId: exp.id, title: exp.title })}
                      disabled={isPending}
                      className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full glass-sub-card border border-white/60 text-[var(--lkv-text-muted)] hover:text-[var(--lkv-danger)] hover:bg-[var(--lkv-danger)]/10 transition-all shadow-2xs"
                      title="Supprimer la dépense"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </GlassCard>
            ))}
          </div>
        )}
      </div>

      {/* Modal d'ajout de dépense */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in">
          <GlassCard
            tone="neutral"
            className="w-full max-w-md p-6 rounded-[var(--lkv-radius-xl)] border border-white/80 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between pb-3 border-b border-white/40">
              <h4 className="text-base font-bold text-lkv-primary flex items-center gap-2">
                <CreditCard size={18} className="text-lkv-secondary" />
                <span>Nouvelle dépense</span>
              </h4>
              <button
                onClick={() => setIsAddOpen(false)}
                aria-label="Fermer"
                className="w-8 h-8 rounded-full glass-sub-card border border-white/60 flex items-center justify-center text-[var(--lkv-text-secondary)] hover:text-[var(--lkv-text-primary)] hover:bg-white transition-all cursor-pointer shadow-2xs"
              >
                <X size={18} />
              </button>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-xl glass tone-danger text-[var(--lkv-danger)] text-xs">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleAddSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-lkv-primary mb-1">
                  Intitulé de la dépense
                </label>
                <input
                  type="text"
                  name="title"
                  required
                  placeholder="ex: Refuge des Écrins, Ravitaillement bivouac"
                  className="glass-input w-full px-3 py-2 text-sm text-[var(--lkv-text-primary)]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-lkv-primary mb-1">
                    Montant ({trip.budget_currency || 'EUR'})
                  </label>
                  <input
                    type="number"
                    name="amount"
                    step="0.01"
                    min="0.01"
                    required
                    placeholder="0.00"
                    className="glass-input w-full px-3 py-2 text-sm text-[var(--lkv-text-primary)]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-lkv-primary mb-1">
                    Catégorie
                  </label>
                  <select
                    name="category"
                    defaultValue="hébergement"
                    className="glass-input w-full px-3 py-2 text-sm text-[var(--lkv-text-primary)]"
                  >
                    <option value="hébergement">Hébergement</option>
                    <option value="nourriture">Nourriture</option>
                    <option value="transport">Transport</option>
                    <option value="activités">Activités / Topo</option>
                    <option value="matériel">Matériel</option>
                    <option value="divers">Divers</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-lkv-primary mb-1">
                    Date
                  </label>
                  <input
                    type="date"
                    name="expenseDate"
                    defaultValue={new Date().toISOString().slice(0, 10)}
                    required
                    className="glass-input w-full px-3 py-2 text-sm text-[var(--lkv-text-primary)]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-lkv-primary mb-1">
                    Répartition
                  </label>
                  <select
                    name="splitType"
                    defaultValue="equal"
                    className="glass-input w-full px-3 py-2 text-sm text-[var(--lkv-text-primary)]"
                  >
                    <option value="equal">Partagée équitablement</option>
                    <option value="individual">Dépense personnelle</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <GlassCapsuleBtn
                  type="button"
                  variant="default"
                  size="sm"
                  onClick={() => setIsAddOpen(false)}
                >
                  Annuler
                </GlassCapsuleBtn>
                <GlassCapsuleBtn
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={isPending}
                >
                  {isPending ? 'Enregistrement...' : 'Valider la dépense'}
                </GlassCapsuleBtn>
              </div>
            </form>
          </GlassCard>
        </div>
      )}

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
