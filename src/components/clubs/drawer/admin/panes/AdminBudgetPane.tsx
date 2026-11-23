'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, CheckCircle2, Download, Plus, Wallet, X } from 'lucide-react';
import type { ClubBudgetEntry, ClubBudgetKind, ClubBudgetStatus } from '@/features/clubs/types';
import type { ClubItemData, ClubOutingData, ClubToastPayload } from '../../ClubDrawerTypes';
import { ClubEmptyCard } from '../../ClubSharedUi';
import type { UseClubCapabilitiesResult } from '../useClubCapabilities';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface AdminBudgetPaneProps {
  activeClub: ClubItemData;
  outings: ClubOutingData[];
  eventFilter: string;
  caps: UseClubCapabilitiesResult;
  onToast?: (toast: ClubToastPayload) => void;
}

const STATUS_LABELS: Record<ClubBudgetStatus, string> = {
  proposed: 'Proposé',
  approved: 'Validé',
  paid: 'Payé',
  rejected: 'Rejeté',
};

function formatEur(cents: number): string {
  return `${(cents / 100).toLocaleString('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} €`;
}

export function AdminBudgetPane({
  activeClub,
  outings,
  eventFilter,
  caps,
  onToast,
}: AdminBudgetPaneProps) {
  const [entries, setEntries] = useState<ClubBudgetEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const [kind, setKind] = useState<ClubBudgetKind>('expense');
  const [category, setCategory] = useState('Logistique');
  const [label, setLabel] = useState('');
  const [amountEur, setAmountEur] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const canApprove = caps.has('budget.approve_and_manage');
  const canPropose = canApprove || caps.has('budget.propose_expense');

  const loadBudget = useCallback(async () => {
    if (!UUID_RE.test(activeClub.id) || typeof fetch !== 'function') return;
    setLoading(true);
    try {
      const qs =
        eventFilter && eventFilter !== 'all'
          ? `?eventId=${encodeURIComponent(eventFilter)}`
          : '';
      const res = await fetch(`/api/clubs/${encodeURIComponent(activeClub.id)}/budget${qs}`, {
        credentials: 'include',
      });
      const payload = (await res.json().catch(() => null)) as {
        data?: { entries?: ClubBudgetEntry[] };
      } | null;
      if (res.ok && payload?.data?.entries) {
        setEntries(payload.data.entries);
      }
    } finally {
      setLoading(false);
    }
  }, [activeClub.id, eventFilter]);

  useEffect(() => {
    void loadBudget();
  }, [loadBudget]);

  const filteredEntries = useMemo(() => {
    if (eventFilter === 'all') return entries;
    if (eventFilter === 'global') return entries.filter((e) => !e.eventId);
    return entries.filter((e) => e.eventId === eventFilter);
  }, [entries, eventFilter]);

  const summary = useMemo(() => {
    let incomeCents = 0;
    let expenseCents = 0;
    let pendingCount = 0;
    for (const e of filteredEntries) {
      if (e.status === 'rejected') continue;
      if (e.status === 'proposed') {
        pendingCount += 1;
        continue;
      }
      if (e.kind === 'income') incomeCents += e.amountCents;
      else expenseCents += e.amountCents;
    }
    return {
      incomeCents,
      expenseCents,
      balanceCents: incomeCents - expenseCents,
      pendingCount,
    };
  }, [filteredEntries]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountCents = Math.round(Number(amountEur.replace(',', '.')) * 100);
    if (!canPropose || !label.trim() || !Number.isFinite(amountCents) || amountCents <= 0 || submitting) {
      return;
    }
    setSubmitting(true);
    const targetEventId =
      eventFilter !== 'all' && eventFilter !== 'global' ? eventFilter : null;
    try {
      if (UUID_RE.test(activeClub.id) && typeof fetch === 'function') {
        const res = await fetch(`/api/clubs/${encodeURIComponent(activeClub.id)}/budget`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            eventId: targetEventId && UUID_RE.test(targetEventId) ? targetEventId : null,
            kind,
            category: category.trim() || 'Logistique',
            label: label.trim(),
            amountCents,
          }),
        });
        const payload = (await res.json().catch(() => null)) as { data?: ClubBudgetEntry } | null;
        if (!res.ok || !payload?.data) throw new Error('Saisie refusée');
        setEntries((prev) => [payload.data!, ...prev]);
      } else {
        setEntries((prev) => [
          {
            id: `budget-${Date.now()}`,
            clubId: activeClub.id,
            eventId: targetEventId,
            kind,
            category: category.trim() || 'Logistique',
            label: label.trim(),
            amountCents,
            status: canApprove ? 'approved' : 'proposed',
            notes: null,
            receiptUrl: null,
            createdBy: null,
            approvedBy: null,
            approvedAt: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          ...prev,
        ]);
      }
      setLabel('');
      setAmountEur('');
      onToast?.({
        title: canApprove ? 'Ligne budgétaire ajoutée ✓' : 'Proposition envoyée au bureau ✓',
      });
    } catch {
      onToast?.({ title: 'Impossible d’enregistrer cette ligne' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (entryId: string, status: ClubBudgetStatus) => {
    if (!canApprove) return;
    if (UUID_RE.test(activeClub.id) && UUID_RE.test(entryId) && typeof fetch === 'function') {
      const res = await fetch(`/api/clubs/${encodeURIComponent(activeClub.id)}/budget`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entryId, status }),
      });
      if (!res.ok) {
        onToast?.({ title: 'Mise à jour refusée' });
        return;
      }
    }
    setEntries((prev) => prev.map((e) => (e.id === entryId ? { ...e, status } : e)));
    onToast?.({ title: `Statut : ${STATUS_LABELS[status]}` });
  };

  const handleExportCsv = () => {
    if (!canApprove || typeof window === 'undefined') return;
    const qs =
      eventFilter && eventFilter !== 'all'
        ? `?format=csv&eventId=${encodeURIComponent(eventFilter)}`
        : '?format=csv';
    window.open(`/api/clubs/${encodeURIComponent(activeClub.id)}/budget${qs}`, '_blank', 'noopener');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="club-glass-card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 700, color: '#17402c' }}>
            <Wallet size={14} aria-hidden="true" />
            <span>Synthèse budgétaire</span>
          </span>
          {canApprove ? (
            <button
              type="button"
              onClick={handleExportCsv}
              className="lkdv-carnet-btn-soft"
              style={{ height: 28, padding: '0 10px', fontSize: 11, color: '#17402c' }}
            >
              <Download size={12} aria-hidden="true" />
              <span>Export CSV</span>
            </button>
          ) : null}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
          <div>
            <div style={{ fontSize: 10.5, color: 'var(--label2)' }}>Recettes</div>
            <b style={{ fontSize: 13.5, color: '#17402c' }}>+{formatEur(summary.incomeCents)}</b>
          </div>
          <div>
            <div style={{ fontSize: 10.5, color: 'var(--label2)' }}>Dépenses</div>
            <b style={{ fontSize: 13.5, color: '#b91c1c' }}>-{formatEur(summary.expenseCents)}</b>
          </div>
          <div>
            <div style={{ fontSize: 10.5, color: 'var(--label2)' }}>Solde</div>
            <b style={{ fontSize: 13.5, color: 'var(--label)' }}>{formatEur(summary.balanceCents)}</b>
          </div>
        </div>
        {summary.pendingCount > 0 ? (
          <div style={{ fontSize: 11, color: 'var(--label2)' }}>
            {summary.pendingCount} proposition(s) en attente de validation bureau.
          </div>
        ) : null}
      </div>

      {canPropose ? (
        <form onSubmit={handleSubmit} className="club-glass-card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: '#17402c' }}>
            {canApprove ? 'Ajouter une écriture' : 'Proposer une dépense / recette'}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <select
              className="club-glass-input"
              value={kind}
              onChange={(e) => setKind(e.target.value as ClubBudgetKind)}
              aria-label="Type de mouvement"
            >
              <option value="expense">Dépense</option>
              <option value="income">Recette</option>
            </select>
            <input
              type="text"
              className="club-glass-input"
              placeholder="Catégorie (Ravitaillement, Dossards…)"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              maxLength={80}
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 110px', gap: 8 }}>
            <input
              type="text"
              className="club-glass-input"
              placeholder="Libellé (ex : Barrières départ marathon)"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              minLength={2}
              maxLength={160}
              required
            />
            <input
              type="text"
              inputMode="decimal"
              className="club-glass-input"
              placeholder="Montant €"
              value={amountEur}
              onChange={(e) => setAmountEur(e.target.value)}
              required
            />
          </div>
          <button
            type="submit"
            disabled={submitting || !label.trim() || !amountEur.trim()}
            className="lkdv-carnet-btn-soft"
            style={{
              justifyContent: 'center',
              height: 36,
              background: 'rgba(23, 64, 44, 0.12)',
              color: '#17402c',
              fontWeight: 700,
            }}
          >
            <Plus size={14} aria-hidden="true" />
            <span>{submitting ? 'Envoi…' : canApprove ? 'Enregistrer' : 'Soumettre à validation'}</span>
          </button>
        </form>
      ) : null}

      <div className="club-glass-card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <b style={{ fontSize: 12.5, color: '#17402c' }}>
          Écritures ({filteredEntries.length})
          {eventFilter !== 'all' && eventFilter !== 'global'
            ? ` · ${outings.find((o) => o.id === eventFilter)?.title ?? 'Événement'}`
            : ''}
        </b>

        {loading ? (
          <span style={{ fontSize: 12, color: 'var(--label2)' }}>Chargement…</span>
        ) : filteredEntries.length === 0 ? (
          <ClubEmptyCard
            icon={<Wallet size={18} />}
            title="Aucune ligne budgétaire"
            description="Saisissez vos recettes, devis ou dépenses terrain pour suivre le solde en temps réel."
          />
        ) : (
          filteredEntries.map((entry) => (
            <div
              key={entry.id}
              style={{
                padding: 10,
                borderRadius: 12,
                background: 'rgba(255, 255, 255, 0.6)',
                border: '0.5px solid rgba(23, 43, 36, 0.08)',
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <div style={{ minWidth: 0 }}>
                  <b style={{ fontSize: 13 }}>{entry.label}</b>
                  <div style={{ fontSize: 11, color: 'var(--label2)' }}>
                    {entry.category} · {STATUS_LABELS[entry.status]}
                  </div>
                </div>
                <b
                  style={{
                    fontSize: 13,
                    color: entry.kind === 'income' ? '#17402c' : '#b91c1c',
                    flex: 'none',
                  }}
                >
                  {entry.kind === 'income' ? '+' : '-'}
                  {formatEur(entry.amountCents)}
                </b>
              </div>

              {canApprove && (entry.status === 'proposed' || entry.status === 'approved') ? (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {entry.status === 'proposed' ? (
                    <>
                      <button
                        type="button"
                        className="lkdv-carnet-btn-soft"
                        style={{ height: 26, padding: '0 8px', fontSize: 11, color: '#17402c', background: 'rgba(23, 64, 44, 0.1)' }}
                        onClick={() => void handleStatusChange(entry.id, 'approved')}
                      >
                        <Check size={11} aria-hidden="true" />
                        <span>Valider</span>
                      </button>
                      <button
                        type="button"
                        className="lkdv-carnet-btn-soft"
                        style={{ height: 26, padding: '0 8px', fontSize: 11, color: '#b91c1c' }}
                        onClick={() => void handleStatusChange(entry.id, 'rejected')}
                      >
                        <X size={11} aria-hidden="true" />
                        <span>Rejeter</span>
                      </button>
                    </>
                  ) : null}
                  {entry.status === 'approved' ? (
                    <button
                      type="button"
                      className="lkdv-carnet-btn-soft"
                      style={{ height: 26, padding: '0 8px', fontSize: 11, color: '#17402c' }}
                      onClick={() => void handleStatusChange(entry.id, 'paid')}
                    >
                      <CheckCircle2 size={11} aria-hidden="true" />
                      <span>Marquer payé</span>
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
