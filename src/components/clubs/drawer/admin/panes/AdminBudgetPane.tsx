'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, CheckCircle2, Download, Plus, Wallet, X } from 'lucide-react';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import type { ClubBudgetEntry, ClubBudgetKind, ClubBudgetStatus } from '@/features/clubs/types';
import { AnimatedNumber } from '../../ClubDrawerMotion';
import type { ClubItemData, ClubOutingData, ClubToastPayload } from '../../ClubDrawerTypes';
import { ClubEmptyCard } from '../../ClubSharedUi';
import { AdminCollapsibleCreate, AdminStatusPill, type AdminTone } from '../AdminPrimitives';
import type { UseClubCapabilitiesResult } from '../useClubCapabilities';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface AdminBudgetPaneProps {
  activeClub: ClubItemData;
  outings: ClubOutingData[];
  eventFilter: string;
  caps: UseClubCapabilitiesResult;
  onToast?: (toast: ClubToastPayload) => void;
}

const STATUS_META: Record<ClubBudgetStatus, { label: string; tone: AdminTone }> = {
  proposed: { label: 'Proposé', tone: 'warn' },
  approved: { label: 'Validé', tone: 'sage' },
  paid: { label: 'Payé', tone: 'neutral' },
  rejected: { label: 'Rejeté', tone: 'danger' },
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
  const [createOpen, setCreateOpen] = useState(false);

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
    const total = incomeCents + expenseCents;
    const incomeRatio = total > 0 ? Math.round((incomeCents / total) * 100) : 50;
    return {
      incomeCents,
      expenseCents,
      balanceCents: incomeCents - expenseCents,
      pendingCount,
      incomeRatio,
      hasFlow: total > 0,
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
      setCreateOpen(false);
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
    onToast?.({ title: `Statut : ${STATUS_META[status].label}` });
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div className="club-glass-card" style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '10px 12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, fontWeight: 700, color: 'var(--label2)' }}>
              <Wallet size={13} aria-hidden="true" />
              <span>Solde</span>
            </span>
            <b style={{ fontSize: 20, fontWeight: 800, color: summary.balanceCents < 0 ? '#991b1b' : 'var(--tint, #17402c)', letterSpacing: '-0.02em' }}>
              <AnimatedNumber value={summary.balanceCents / 100} suffix=" €" maximumFractionDigits={2} />
            </b>
          </div>

          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            {summary.pendingCount > 0 ? (
              <AdminStatusPill tone="warn">{summary.pendingCount} en attente</AdminStatusPill>
            ) : null}
            {canApprove ? (
              <button
                type="button"
                onClick={handleExportCsv}
                className="lkdv-carnet-btn-soft"
                style={{ height: 26, padding: '0 8px', fontSize: 11, color: 'var(--tint, #17402c)' }}
                aria-label="Exporter le budget en CSV"
              >
                <Download size={11} aria-hidden="true" />
                <span>CSV</span>
              </button>
            ) : null}
          </div>
        </div>

        {/* Visual Recettes vs Dépenses ratio bar */}
        <div
          aria-label="Ratio recettes et dépenses"
          style={{
            height: 7,
            width: '100%',
            borderRadius: 999,
            overflow: 'hidden',
            display: 'flex',
            background: 'rgba(23, 43, 36, 0.08)',
          }}
        >
          {summary.hasFlow ? (
            <>
              <div
                style={{
                  width: `${summary.incomeRatio}%`,
                  background: '#17402c',
                  transition: 'width 0.35s ease',
                }}
              />
              <div
                style={{
                  width: `${100 - summary.incomeRatio}%`,
                  background: '#c25145',
                  transition: 'width 0.35s ease',
                }}
              />
            </>
          ) : null}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5 }}>
          <span style={{ color: 'var(--tint, #17402c)', fontWeight: 700 }}>
            +{formatEur(summary.incomeCents)} <span style={{ fontWeight: 500, color: 'var(--label2)' }}>recettes</span>
          </span>
          <span style={{ color: '#991b1b', fontWeight: 700 }}>
            -{formatEur(summary.expenseCents)} <span style={{ fontWeight: 500, color: 'var(--label2)' }}>dépenses</span>
          </span>
        </div>
      </div>

      {canPropose ? (
        <AdminCollapsibleCreate
          label={canApprove ? 'Écriture' : 'Proposer'}
          open={createOpen}
          onToggle={setCreateOpen}
          rightSlot={
            <AdminStatusPill tone="neutral">
              {filteredEntries.length} lignes
              {eventFilter !== 'all' && eventFilter !== 'global'
                ? ` · ${outings.find((o) => o.id === eventFilter)?.title ?? 'Événement'}`
                : ''}
            </AdminStatusPill>
          }
        >
          <form onSubmit={handleSubmit} className="club-glass-card" style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '10px 12px' }}>
            <SegmentedControl
              size="sm"
              showLabels
              ariaLabel="Type de mouvement"
              value={kind}
              onChange={(v) => setKind(v as ClubBudgetKind)}
              items={[
                { id: 'expense', label: 'Dépense' },
                { id: 'income', label: 'Recette' },
              ]}
            />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px', gap: 8 }}>
              <input
                type="text"
                className="club-glass-input"
                placeholder="Libellé (ex : Barrières départ)"
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
            <input
              type="text"
              className="club-glass-input"
              placeholder="Catégorie (Ravitaillement, Dossards…)"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              maxLength={80}
            />
            <button
              type="submit"
              disabled={submitting || !label.trim() || !amountEur.trim()}
              className="lkdv-carnet-btn-soft"
              style={{
                justifyContent: 'center',
                height: 34,
                background: 'var(--club-soft-bg, #d3ebd9)',
                color: 'var(--tint, #17402c)',
                fontWeight: 700,
              }}
            >
              <Plus size={14} aria-hidden="true" />
              <span>{submitting ? 'Envoi…' : canApprove ? 'Enregistrer' : 'Soumettre'}</span>
            </button>
          </form>
        </AdminCollapsibleCreate>
      ) : null}

      <div className="club-glass-card" style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '10px 12px' }}>
        {loading ? (
          <span style={{ fontSize: 12, color: 'var(--label2)' }}>Chargement…</span>
        ) : filteredEntries.length === 0 ? (
          <ClubEmptyCard
            icon={<Wallet size={17} />}
            title="Aucune ligne budgétaire"
            description="Saisissez vos recettes ou dépenses pour suivre le solde."
          />
        ) : (
          filteredEntries.map((entry) => {
            const st = STATUS_META[entry.status];
            return (
              <div
                key={entry.id}
                style={{
                  padding: '7px 9px',
                  borderRadius: 12,
                  background: 'rgba(255, 255, 255, 0.62)',
                  border: '0.5px solid rgba(23, 43, 36, 0.08)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                }}
              >
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <b style={{ fontSize: 12.5, color: 'var(--label)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {entry.label}
                    </b>
                    <AdminStatusPill tone={st.tone}>{st.label}</AdminStatusPill>
                  </div>
                  <div style={{ fontSize: 10.5, color: 'var(--label2)' }}>{entry.category}</div>
                </div>

                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, flex: 'none' }}>
                  <b
                    style={{
                      fontSize: 12.5,
                      color: entry.kind === 'income' ? 'var(--tint, #17402c)' : '#991b1b',
                    }}
                  >
                    {entry.kind === 'income' ? '+' : '-'}
                    {formatEur(entry.amountCents)}
                  </b>

                  {canApprove && entry.status === 'proposed' ? (
                    <>
                      <button
                        type="button"
                        className="lkdv-carnet-btn-soft"
                        aria-label={`Valider ${entry.label}`}
                        title="Valider"
                        style={{
                          height: 24,
                          width: 24,
                          padding: 0,
                          justifyContent: 'center',
                          color: 'var(--tint, #17402c)',
                          background: 'var(--club-soft-bg, #d3ebd9)',
                        }}
                        onClick={() => void handleStatusChange(entry.id, 'approved')}
                      >
                        <Check size={11} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        className="lkdv-carnet-btn-soft"
                        aria-label={`Rejeter ${entry.label}`}
                        title="Rejeter"
                        style={{
                          height: 24,
                          width: 24,
                          padding: 0,
                          justifyContent: 'center',
                          color: '#991b1b',
                          background: 'var(--club-danger-bg, #f5ddd9)',
                        }}
                        onClick={() => void handleStatusChange(entry.id, 'rejected')}
                      >
                        <X size={11} aria-hidden="true" />
                      </button>
                    </>
                  ) : null}

                  {canApprove && entry.status === 'approved' ? (
                    <button
                      type="button"
                      className="lkdv-carnet-btn-soft"
                      aria-label={`Marquer payé ${entry.label}`}
                      title="Marquer payé"
                      style={{ height: 24, padding: '0 7px', fontSize: 10.5, color: 'var(--tint, #17402c)' }}
                      onClick={() => void handleStatusChange(entry.id, 'paid')}
                    >
                      <CheckCircle2 size={11} aria-hidden="true" />
                      <span>Payé</span>
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
