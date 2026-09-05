'use client';

import React, { useState, useTransition } from 'react';
import { CreditCard, Plus, Trash2, TrendingUp, AlertTriangle, CheckCircle, ArrowRight, X } from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import { LkvButton } from '@/components/ui/LkvButton';
import { calculateBudgetSummary } from '../engine/budgetEngine';
import { addExpenseAction, deleteExpenseAction } from '@/app/voyages/budget-actions';
import type { TripFull } from '../types/trip.types';

interface TripBudgetViewProps {
  trip: TripFull;
}

export function TripBudgetView({ trip }: TripBudgetViewProps) {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const budgetSummary = calculateBudgetSummary(
    { estimated_budget: trip.estimated_budget, budget_currency: trip.budget_currency },
    trip.expenses || [],
    trip.collaborators || []
  );

  const canManage = trip.permissions.canManageBudget;

  const handleDelete = (expenseId: string, title: string) => {
    if (confirm(`Supprimer la dépense "${title}" ?`)) {
      startTransition(async () => {
        const res = await deleteExpenseAction(trip.id, expenseId, trip.slug);
        if (!res.success) {
          alert(res.error || 'Impossible de supprimer cette dépense');
        }
      });
    }
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
        setIsAddOpen(false);
      }
    });
  };

  const categoryEntries = Object.entries(budgetSummary.categories).sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-6">
      {/* En-tête de section */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold text-[#17402C] flex items-center gap-2">
            <CreditCard size={22} className="text-[#5B7F55]" />
            <span>Budget & Partage des Dépenses</span>
          </h3>
          <p className="text-xs text-[#5B7F55] mt-1">
            Suivi des dépenses en temps réel, répartition équitable entre membres et simplification des remboursements.
          </p>
        </div>

        {canManage && (
          <LkvButton
            variant="primary"
            size="sm"
            onClick={() => setIsAddOpen(true)}
            className="flex items-center gap-2 min-h-[44px]"
          >
            <Plus size={16} />
            <span>Ajouter une dépense</span>
          </LkvButton>
        )}
      </div>

      {/* Cartes de synthèse budgétaire */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Total dépensé */}
        <GlassCard tone="neutral" className="p-4 rounded-[20px] border border-white/60 shadow-sm">
          <div className="text-xs text-[#5B7F55] font-semibold">Total des dépenses réelles</div>
          <div className="text-2xl font-extrabold text-[#17402C] mt-1">
            {budgetSummary.totalSpent} {budgetSummary.currency}
          </div>
          <div className="text-[11px] text-gray-500 mt-1">
            {trip.expenses.length} dépense{trip.expenses.length > 1 ? 's' : ''} enregistrée{trip.expenses.length > 1 ? 's' : ''}
          </div>
        </GlassCard>

        {/* Budget prévisionnel & reste */}
        <GlassCard tone="neutral" className="p-4 rounded-[20px] border border-white/60 shadow-sm">
          <div className="text-xs text-[#5B7F55] font-semibold">Budget prévisionnel</div>
          <div className="text-2xl font-extrabold text-[#17402C] mt-1">
            {budgetSummary.estimatedBudget ? `${budgetSummary.estimatedBudget} ${budgetSummary.currency}` : 'Non défini'}
          </div>
          <div className="text-[11px] mt-1">
            {budgetSummary.remainingBudget !== null ? (
              <span className={budgetSummary.isOverBudget ? 'text-red-600 font-semibold flex items-center gap-1' : 'text-emerald-700'}>
                {budgetSummary.isOverBudget && <AlertTriangle size={12} />}
                {budgetSummary.isOverBudget
                  ? `Dépassement de ${Math.abs(budgetSummary.remainingBudget)} ${budgetSummary.currency}`
                  : `Reste disponible : ${budgetSummary.remainingBudget} ${budgetSummary.currency}`}
              </span>
            ) : (
              <span className="text-gray-400">Aucune limite fixée</span>
            )}
          </div>
        </GlassCard>

        {/* Taux de consommation */}
        <GlassCard tone="neutral" className="p-4 rounded-[20px] border border-white/60 shadow-sm">
          <div className="text-xs text-[#5B7F55] font-semibold">Taux de consommation</div>
          <div className="text-2xl font-extrabold text-[#17402C] mt-1">
            {budgetSummary.spentPercentage !== null ? `${budgetSummary.spentPercentage}%` : '—'}
          </div>
          {budgetSummary.spentPercentage !== null && (
            <div className="w-full bg-black/5 h-2 rounded-full mt-2 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  budgetSummary.isOverBudget ? 'bg-red-500' : 'bg-[#17402C]'
                }`}
                style={{ width: `${Math.min(budgetSummary.spentPercentage, 100)}%` }}
              />
            </div>
          )}
        </GlassCard>
      </div>

      {/* Règlements de compte simplifiés & Balances */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Settlements (Qui doit à qui) */}
        <GlassCard tone="neutral" className="p-5 rounded-[22px] border border-white/60 shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b border-black/5 pb-2">
            <h4 className="text-sm font-bold text-[#17402C] flex items-center gap-2">
              <TrendingUp size={16} className="text-[#5B7F55]" />
              <span>Règlements de compte optimaux</span>
            </h4>
            <span className="text-[11px] text-[#5B7F55]">Algorithme de split</span>
          </div>

          {budgetSummary.settlements.length === 0 ? (
            <div className="p-4 rounded-xl bg-emerald-50/60 border border-emerald-200/50 text-emerald-800 text-xs flex items-center gap-2">
              <CheckCircle size={16} className="shrink-0 text-emerald-600" />
              <span>Tous les comptes sont équilibrés. Aucun remboursement en attente.</span>
            </div>
          ) : (
            <div className="space-y-2">
              {budgetSummary.settlements.map((s, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-xl bg-white/70 border border-black/5 flex items-center justify-between text-xs gap-2"
                >
                  <div className="flex items-center gap-2 truncate">
                    <span className="font-semibold text-gray-900">{s.fromName}</span>
                    <ArrowRight size={14} className="text-[#5B7F55] shrink-0" />
                    <span className="font-semibold text-[#17402C]">{s.toName}</span>
                  </div>
                  <div className="text-sm font-extrabold text-[#17402C] shrink-0">
                    {s.amount} {budgetSummary.currency}
                  </div>
                </div>
              ))}
            </div>
          )}
        </GlassCard>

        {/* Balances individuelles */}
        <GlassCard tone="neutral" className="p-5 rounded-[22px] border border-white/60 shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b border-black/5 pb-2">
            <h4 className="text-sm font-bold text-[#17402C]">Solde net par participant</h4>
            <span className="text-[11px] text-[#5B7F55]">{budgetSummary.balances.length} membres</span>
          </div>

          <div className="space-y-2">
            {budgetSummary.balances.map(b => (
              <div
                key={b.userId}
                className="p-2.5 rounded-xl bg-white/60 border border-black/5 flex items-center justify-between text-xs"
              >
                <div>
                  <div className="font-semibold text-[#17402C]">{b.name}</div>
                  <div className="text-[10px] text-gray-500">
                    Payé : {b.paid} {budgetSummary.currency} · Part : {b.share} {budgetSummary.currency}
                  </div>
                </div>
                <div
                  className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                    b.net > 0
                      ? 'bg-emerald-100 text-emerald-800'
                      : b.net < 0
                      ? 'bg-red-100 text-red-800'
                      : 'bg-gray-100 text-gray-600'
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
        <GlassCard tone="neutral" className="p-5 rounded-[22px] border border-white/60 shadow-sm space-y-3">
          <h4 className="text-sm font-bold text-[#17402C]">Ventilation par catégorie</h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {categoryEntries.map(([cat, amt]) => {
              const pct = Math.round((amt / budgetSummary.totalSpent) * 100);
              return (
                <div key={cat} className="p-3 rounded-xl bg-white/70 border border-black/5 space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="capitalize font-semibold text-[#17402C]">{cat}</span>
                    <span className="text-gray-500">{pct}%</span>
                  </div>
                  <div className="text-sm font-bold text-gray-800">
                    {amt} {budgetSummary.currency}
                  </div>
                  <div className="w-full bg-black/5 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-[#5B7F55] h-full rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </GlassCard>
      )}

      {/* Liste des dépenses détaillées */}
      <div className="space-y-3">
        <h4 className="text-base font-bold text-[#17402C]">Historique des dépenses</h4>
        {trip.expenses.length === 0 ? (
          <GlassCard tone="neutral" className="p-6 rounded-[20px] text-center text-xs text-gray-500">
            Aucune dépense enregistrée sur cette expédition.
          </GlassCard>
        ) : (
          <div className="space-y-2">
            {trip.expenses.map(exp => (
              <GlassCard
                key={exp.id}
                tone="neutral"
                className="p-3.5 rounded-[18px] border border-white/60 flex items-center justify-between gap-3 shadow-xs"
              >
                <div>
                  <div className="text-sm font-bold text-[#17402C]">{exp.title}</div>
                  <div className="text-xs text-[#5B7F55] mt-0.5">
                    Payé par <span className="font-semibold">{exp.payer?.full_name || 'Voyageur'}</span> ·{' '}
                    <span className="capitalize">{exp.category || 'divers'}</span> · {exp.expense_date}
                    {exp.split_type === 'individual' && ' · Individuel'}
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-base font-extrabold text-[#17402C]">
                    {exp.amount} {exp.currency}
                  </div>
                  {canManage && (
                    <button
                      onClick={() => handleDelete(exp.id, exp.title)}
                      disabled={isPending}
                      className="w-9 h-9 flex items-center justify-center rounded-xl text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in">
          <GlassCard
            tone="neutral"
            className="w-full max-w-md p-6 rounded-[24px] bg-white border border-white/80 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h4 className="text-base font-bold text-[#17402C] flex items-center gap-2">
                <CreditCard size={18} className="text-[#5B7F55]" />
                <span>Nouvelle dépense</span>
              </h4>
              <button
                onClick={() => setIsAddOpen(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-100"
              >
                <X size={18} />
              </button>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleAddSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#17402C] mb-1">
                  Intitulé de la dépense
                </label>
                <input
                  type="text"
                  name="title"
                  required
                  placeholder="ex: Refuge des Écrins, Ravitaillement bivouac"
                  className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 bg-gray-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#17402C]/20"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#17402C] mb-1">
                    Montant ({trip.budget_currency || 'EUR'})
                  </label>
                  <input
                    type="number"
                    name="amount"
                    step="0.01"
                    min="0.01"
                    required
                    placeholder="0.00"
                    className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 bg-gray-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#17402C]/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#17402C] mb-1">
                    Catégorie
                  </label>
                  <select
                    name="category"
                    defaultValue="hébergement"
                    className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 bg-gray-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#17402C]/20"
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
                  <label className="block text-xs font-semibold text-[#17402C] mb-1">
                    Date
                  </label>
                  <input
                    type="date"
                    name="expenseDate"
                    defaultValue={new Date().toISOString().slice(0, 10)}
                    required
                    className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 bg-gray-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#17402C]/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#17402C] mb-1">
                    Répartition
                  </label>
                  <select
                    name="splitType"
                    defaultValue="equal"
                    className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 bg-gray-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#17402C]/20"
                  >
                    <option value="equal">Partagée équitablement</option>
                    <option value="individual">Dépense personnelle</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <LkvButton
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setIsAddOpen(false)}
                >
                  Annuler
                </LkvButton>
                <LkvButton
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={isPending}
                  className="min-h-[44px]"
                >
                  {isPending ? 'Enregistrement...' : 'Valider la dépense'}
                </LkvButton>
              </div>
            </form>
          </GlassCard>
        </div>
      )}
    </div>
  );
}
