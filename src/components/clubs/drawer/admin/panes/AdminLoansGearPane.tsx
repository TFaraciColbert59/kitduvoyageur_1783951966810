'use client';

import React, { useMemo } from 'react';
import { AlertTriangle, Check, Package, RotateCcw, X } from 'lucide-react';
import type { ClubGearVaultItem, ClubToastPayload } from '../../ClubDrawerTypes';
import { ClubEmptyCard } from '../../ClubSharedUi';
import { AdminAccordionCard, AdminStatusPill, type AdminTone } from '../AdminPrimitives';
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

const LOAN_STATUS_META: Record<string, { label: string; tone: AdminTone }> = {
  requested: { label: 'À valider', tone: 'warn' },
  approved: { label: 'Validé', tone: 'sage' },
  checked_out: { label: 'Remis', tone: 'sage' },
  returned: { label: 'Retourné', tone: 'neutral' },
  overdue: { label: 'En retard', tone: 'danger' },
  issue: { label: 'Incident', tone: 'danger' },
  declined: { label: 'Refusé', tone: 'neutral' },
  cancelled: { label: 'Annulé', tone: 'neutral' },
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

  const allWithLoan = useMemo(
    () => vaultGear.filter((g) => Boolean(g.loanStatus)),
    [vaultGear],
  );

  const requestedCount = useMemo(
    () => allWithLoan.filter((g) => g.loanStatus === 'requested').length,
    [allWithLoan],
  );
  const activeCount = useMemo(
    () => allWithLoan.filter((g) => g.loanStatus === 'checked_out' || g.loanStatus === 'overdue').length,
    [allWithLoan],
  );

  const loans = useMemo(() => {
    if (loanFilter === 'requested') return allWithLoan.filter((g) => g.loanStatus === 'requested');
    if (loanFilter === 'approved') return allWithLoan.filter((g) => g.loanStatus === 'approved');
    if (loanFilter === 'active') {
      return allWithLoan.filter((g) => g.loanStatus === 'checked_out' || g.loanStatus === 'overdue');
    }
    return allWithLoan;
  }, [allWithLoan, loanFilter]);

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
    onToast?.({ title: `Prêt : ${LOAN_STATUS_META[status]?.label ?? status}`, subtitle: item.name });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div
        className="club-glass-card"
        style={{
          padding: '8px 10px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 6,
          flexWrap: 'wrap',
        }}
      >
        <AdminStatusPill tone={requestedCount > 0 ? 'warn' : 'neutral'}>
          À valider · {requestedCount}
        </AdminStatusPill>
        <AdminStatusPill tone="sage">
          En cours · {activeCount}
        </AdminStatusPill>
        <AdminStatusPill tone={epiAlerts.length > 0 ? 'danger' : 'neutral'}>
          Alertes EPI · {epiAlerts.length}
        </AdminStatusPill>
      </div>

      {epiAlerts.length > 0 ? (
        <AdminAccordionCard
          title={`Alertes EPI (${epiAlerts.length})`}
          icon={<AlertTriangle size={14} aria-hidden="true" />}
          tone="warn"
          defaultOpen={false}
          compact
        >
          {epiAlerts.map((item) => (
            <div key={item.id} style={{ fontSize: 11.5, color: 'var(--label2)' }}>
              <b>{item.name}</b> — échéance {item.epiExpiresAt}
            </div>
          ))}
        </AdminAccordionCard>
      ) : null}

      <div className="club-glass-card" style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '10px 12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: 'var(--tint, #17402c)' }}>
            <Package size={14} aria-hidden="true" />
            <span>Prêts matériel</span>
          </span>
          <AdminStatusPill tone="neutral">{loans.length}</AdminStatusPill>
        </div>

        {loans.length === 0 ? (
          <ClubEmptyCard
            icon={<Package size={17} />}
            title="Aucun prêt dans ce filtre"
            description={`${clubGear.length} équipements dans le parc club.`}
          />
        ) : (
          loans.map((item) => {
            const st = LOAN_STATUS_META[item.loanStatus ?? ''] ?? {
              label: item.loanStatus ?? '—',
              tone: 'neutral' as AdminTone,
            };
            return (
              <div
                key={`${item.id}-${item.loanId ?? ''}`}
                style={{
                  padding: '8px 10px',
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
                      {item.name}
                    </b>
                    <AdminStatusPill tone={st.tone}>{st.label}</AdminStatusPill>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--label2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.borrowerName ?? item.brand}
                  </div>
                </div>

                {canApproveLoans && item.loanId ? (
                  <div style={{ display: 'inline-flex', gap: 4, flex: 'none' }}>
                    {item.loanStatus === 'requested' ? (
                      <>
                        <button
                          type="button"
                          className="lkdv-carnet-btn-soft"
                          aria-label={`Valider prêt ${item.name}`}
                          title="Valider"
                          style={{
                            height: 28,
                            width: 28,
                            padding: 0,
                            justifyContent: 'center',
                            color: 'var(--tint, #17402c)',
                            background: 'var(--club-soft-bg, #d3ebd9)',
                          }}
                          onClick={() => void transition(item, 'approved')}
                        >
                          <Check size={13} aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          className="lkdv-carnet-btn-soft"
                          aria-label={`Refuser prêt ${item.name}`}
                          title="Refuser"
                          style={{
                            height: 28,
                            width: 28,
                            padding: 0,
                            justifyContent: 'center',
                            color: '#991b1b',
                            background: 'var(--club-danger-bg, #f5ddd9)',
                          }}
                          onClick={() => void transition(item, 'declined')}
                        >
                          <X size={13} aria-hidden="true" />
                        </button>
                      </>
                    ) : null}
                    {item.loanStatus === 'approved' ? (
                      <button
                        type="button"
                        className="lkdv-carnet-btn-soft"
                        style={{ height: 28, padding: '0 9px', fontSize: 11, color: 'var(--tint, #17402c)', background: 'var(--club-soft-bg, #d3ebd9)' }}
                        onClick={() => void transition(item, 'checked_out')}
                      >
                        <Check size={11} aria-hidden="true" />
                        <span>Remis</span>
                      </button>
                    ) : null}
                    {item.loanStatus === 'checked_out' || item.loanStatus === 'overdue' ? (
                      <button
                        type="button"
                        className="lkdv-carnet-btn-soft"
                        style={{ height: 28, padding: '0 9px', fontSize: 11, color: 'var(--tint, #17402c)' }}
                        onClick={() => void transition(item, 'returned')}
                      >
                        <RotateCcw size={11} aria-hidden="true" />
                        <span>Retour</span>
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
