'use client';

import React, { useMemo } from 'react';
import { AlertTriangle, Check, Package, RotateCcw, X } from 'lucide-react';
import type { ClubGearVaultItem, ClubToastPayload } from '../../ClubDrawerTypes';
import { ClubEmptyCard } from '../../ClubSharedUi';
import type { UseClubCapabilitiesResult } from '../useClubCapabilities';

export interface AdminLoansGearPaneProps {
  vaultGear: ClubGearVaultItem[];
  loanFilter: 'all' | 'requested' | 'approved' | 'active';
  caps: UseClubCapabilitiesResult;
  onTransitionGearLoan?: (payload: {
    loanId: string;
    gearItemId: string;
    status: 'approved' | 'checked_out' | 'returned' | 'issue' | 'declined' | 'cancelled';
    checkoutCondition?: 'new' | 'good' | 'worn' | 'repair';
    returnCondition?: 'new' | 'good' | 'worn' | 'repair';
    conditionNote?: string;
  }) => Promise<boolean> | void;
  onToast?: (toast: ClubToastPayload) => void;
}

const LOAN_STATUS_LABEL: Record<string, string> = {
  requested: 'À valider',
  approved: 'Validé',
  checked_out: 'Remis',
  returned: 'Retourné',
  overdue: 'En retard',
  issue: 'Incident',
  declined: 'Refusé',
  cancelled: 'Annulé',
};

export function AdminLoansGearPane({
  vaultGear,
  loanFilter,
  caps,
  onTransitionGearLoan,
  onToast,
}: AdminLoansGearPaneProps) {
  const canApproveLoans = caps.has('gear.approve_club_loans');
  const clubGear = useMemo(
    () => vaultGear.filter((g) => g.ownershipScope === 'club'),
    [vaultGear],
  );

  const loans = useMemo(() => {
    const withLoan = vaultGear.filter((g) => Boolean(g.loanStatus));
    if (loanFilter === 'requested') return withLoan.filter((g) => g.loanStatus === 'requested');
    if (loanFilter === 'approved') return withLoan.filter((g) => g.loanStatus === 'approved');
    if (loanFilter === 'active') {
      return withLoan.filter((g) => g.loanStatus === 'checked_out' || g.loanStatus === 'overdue');
    }
    return withLoan;
  }, [loanFilter, vaultGear]);

  const epiAlerts = useMemo(() => {
    const soon = Date.now() + 30 * 86400_000;
    return clubGear.filter(
      (g) => g.isEpi && g.epiExpiresAt && Date.parse(g.epiExpiresAt) <= soon,
    );
  }, [clubGear]);

  const transition = async (
    item: ClubGearVaultItem,
    status: 'approved' | 'checked_out' | 'returned' | 'declined',
  ) => {
    if (!canApproveLoans || !item.loanId) return;
    await onTransitionGearLoan?.({
      loanId: item.loanId,
      gearItemId: item.id,
      status,
    });
    onToast?.({ title: `Prêt : ${LOAN_STATUS_LABEL[status] ?? status}`, subtitle: item.name });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {epiAlerts.length > 0 ? (
        <div
          className="club-glass-card"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            border: '0.5px solid rgba(180, 83, 9, 0.3)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 700, color: '#b45309' }}>
            <AlertTriangle size={14} aria-hidden="true" />
            <span>Alertes EPI ({epiAlerts.length})</span>
          </div>
          {epiAlerts.map((item) => (
            <div key={item.id} style={{ fontSize: 11.5, color: 'var(--label2)' }}>
              {item.name} — contrôle / expiration le {item.epiExpiresAt}
            </div>
          ))}
        </div>
      ) : null}

      <div className="club-glass-card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 700, color: '#17402c' }}>
            <Package size={14} aria-hidden="true" />
            <span>Suivi des prêts matériel</span>
          </span>
          <span className="club-badge-sage">{loans.length}</span>
        </div>

        {loans.length === 0 ? (
          <ClubEmptyCard
            icon={<Package size={18} />}
            title="Aucun prêt dans ce filtre"
            description={`${clubGear.length} équipements disponibles dans le parc matériel du club.`}
          />
        ) : (
          loans.map((item) => (
            <div
              key={`${item.id}-${item.loanId ?? ''}`}
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
                <div>
                  <b style={{ fontSize: 13 }}>{item.name}</b>
                  <div style={{ fontSize: 11, color: 'var(--label2)' }}>
                    {item.borrowerName ? `Emprunteur : ${item.borrowerName}` : item.brand}
                  </div>
                </div>
                <span className="club-badge-sage" style={{ fontSize: 10.5 }}>
                  {LOAN_STATUS_LABEL[item.loanStatus ?? ''] ?? item.loanStatus}
                </span>
              </div>

              {canApproveLoans && item.loanId ? (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {item.loanStatus === 'requested' ? (
                    <>
                      <button
                        type="button"
                        className="lkdv-carnet-btn-soft"
                        style={{ height: 28, padding: '0 10px', fontSize: 11, color: '#17402c', background: 'rgba(23, 64, 44, 0.1)' }}
                        onClick={() => void transition(item, 'approved')}
                      >
                        <Check size={12} aria-hidden="true" />
                        <span>Valider</span>
                      </button>
                      <button
                        type="button"
                        className="lkdv-carnet-btn-soft"
                        style={{ height: 28, padding: '0 10px', fontSize: 11, color: '#b91c1c' }}
                        onClick={() => void transition(item, 'declined')}
                      >
                        <X size={12} aria-hidden="true" />
                        <span>Refuser</span>
                      </button>
                    </>
                  ) : null}
                  {item.loanStatus === 'approved' ? (
                    <button
                      type="button"
                      className="lkdv-carnet-btn-soft"
                      style={{ height: 28, padding: '0 10px', fontSize: 11, color: '#17402c' }}
                      onClick={() => void transition(item, 'checked_out')}
                    >
                      <Check size={12} aria-hidden="true" />
                      <span>Marquer remis</span>
                    </button>
                  ) : null}
                  {item.loanStatus === 'checked_out' || item.loanStatus === 'overdue' ? (
                    <button
                      type="button"
                      className="lkdv-carnet-btn-soft"
                      style={{ height: 28, padding: '0 10px', fontSize: 11, color: '#17402c' }}
                      onClick={() => void transition(item, 'returned')}
                    >
                      <RotateCcw size={12} aria-hidden="true" />
                      <span>Réceptionner retour</span>
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
