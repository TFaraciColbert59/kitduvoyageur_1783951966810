'use client';

import { useCallback, useId, useMemo, useState } from 'react';

import {
  LoanCard,
  isLoanActive,
  isLoanOverdue,
  type LoanAction,
  type LoanActionHandler,
  type LoanActionOutcome,
  type LoanRecord,
  type LoanViewer,
} from '../cards/LoanCard';

export type LoansLens = 'lend' | 'borrow' | 'trust';

export interface TrustSummary {
  verified: boolean;
  active: number;
  onTimeRate: number;
  rating: number;
}

export interface LoansSlotProps {
  /** `lend` / `lender` · `borrow` / `borrower` · `trust` (ids de la coquille). */
  lens?: string;
  /** Payload du bootstrap : `{ loans, trust }`. Aucune donnée inventée. */
  payload?: unknown;
  loans?: LoanRecord[];
  trust?: TrustSummary;
  viewer?: LoanViewer;
  onAction?: LoanActionHandler;
}

/** Les ids de lentille de `ProfileDrawerHost` sont `lender`/`borrower`. */
export function normalizeLoansLens(lens?: string): LoansLens {
  if (lens === 'trust') return 'trust';
  if (lens === 'borrow' || lens === 'borrower') return 'borrow';
  return 'lend';
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/**
 * Propriétaire par défaut, visiteur si l'appelant le dit : prop directe,
 * `payload.viewer`, puis `payload.profile.viewer` (profil public).
 */
export function resolveLoansViewer(viewer: LoanViewer | undefined, payload: unknown): LoanViewer {
  if (viewer === 'owner' || viewer === 'visitor') return viewer;
  const root = asRecord(payload);
  if (root?.viewer === 'visitor') return 'visitor';
  const profile = asRecord(root?.profile);
  if (profile?.viewer === 'visitor') return 'visitor';
  return 'owner';
}

/** Lecture défensive du payload bootstrap : aucune ligne sans identifiant. */
export function readLoansPayload(payload: unknown): LoanRecord[] {
  const root = asRecord(payload);
  if (!root || !Array.isArray(root.loans)) return [];

  return root.loans.flatMap((entry) => {
    const row = asRecord(entry);
    const id = asString(row?.id);
    if (!row || !id) return [];
    return [
      {
        id,
        itemName: asString(row.itemName),
        counterpart: asString(row.counterpart),
        role: row.role === 'borrower' || row.role === 'borrow' ? ('borrower' as const) : ('lender' as const),
        status: asString(row.status),
        loanedAt: asString(row.loanedAt),
        dueDate: asString(row.dueDate),
        returnedAt: asString(row.returnedAt),
        rating: asNumber(row.rating),
      },
    ];
  });
}

/** Carte agrégée : les quatre nombres du bootstrap, rien de plus. */
export function readTrustPayload(payload: unknown): TrustSummary | null {
  const root = asRecord(payload);
  const row = asRecord(root?.trust);
  if (!row) return null;
  return {
    verified: row.verified === true,
    active: asNumber(row.active) ?? 0,
    onTimeRate: asNumber(row.onTimeRate) ?? 0,
    rating: asNumber(row.rating) ?? 0,
  };
}

function formatRating(value: number): string {
  return value.toLocaleString('fr-FR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="lkdv-slot-state" data-state="empty">
      <span className="lkdv-slot-state-ico" aria-hidden="true">
        ○
      </span>
      <p>{label}</p>
    </div>
  );
}

function TrustCard({ trust }: { trust: TrustSummary | null }) {
  const titleId = useId();
  if (!trust) return <EmptyState label="Aucune donnée de confiance." />;

  return (
    <article className="lkdv-trust-card" aria-labelledby={titleId}>
      <header className="lkdv-trust-head">
        <div className="lkdv-trust-head-txt">
          <h3 className="lkdv-trust-title" id={titleId}>
            Indice de confiance
          </h3>
          <p className="lkdv-trust-sub">Agrégat de tes prêts, sans historique détaillé.</p>
        </div>
        <span className={`lkdv-trust-badge ${trust.verified ? 'is-on' : 'is-off'}`}>
          <span className="lkdv-trust-badge-ico" aria-hidden="true">
            {trust.verified ? '✓' : '○'}
          </span>
          <span className="lkdv-trust-badge-txt">
            {trust.verified ? 'Profil vérifié' : 'Profil non vérifié'}
          </span>
        </span>
      </header>

      <div className="lkdv-trust-grid" role="group" aria-label="Agrégats de confiance">
        <div className="lkdv-trust-stat">
          <b>{trust.active}</b>
          <span>Prêts actifs</span>
        </div>
        <div className="lkdv-trust-stat">
          <b>{trust.onTimeRate} %</b>
          <span>Taux de retour à temps</span>
        </div>
        <div className="lkdv-trust-stat">
          <b>{formatRating(trust.rating)} / 5</b>
          <span>Note moyenne</span>
        </div>
      </div>
    </article>
  );
}

/**
 * Slot Prêts.
 *
 * - **Je prête** : résumé (actifs, en retard, cette année) + cartes prêt.
 * - **J'emprunte** : même structure côté emprunteur.
 * - **Confiance** : carte agrégée uniquement — **aucun historique « prêts
 *   rendus »** ni liste de prêts.
 *
 * Le payload vient du bootstrap (`{ loans, trust }`). Les props directes
 * (`loans`, `trust`, `viewer`) servent aux tests et aux écrans ciblés.
 */
export function LoansSlot({
  lens,
  payload,
  loans,
  trust,
  viewer,
  onAction,
}: LoansSlotProps) {
  const activeLens = normalizeLoansLens(lens);
  const [overrides, setOverrides] = useState<Record<string, Partial<LoanRecord>>>({});

  const sourceLoans = useMemo(() => loans ?? readLoansPayload(payload), [loans, payload]);
  const sourceTrust = useMemo(() => trust ?? readTrustPayload(payload), [trust, payload]);
  const viewerMode = resolveLoansViewer(viewer, payload);

  const effectiveLoans = useMemo(
    () =>
      sourceLoans.map((loan) => ({
        ...loan,
        ...(overrides[loan.id] ?? {}),
      })),
    [sourceLoans, overrides]
  );

  const roleLoans = useMemo(() => {
    const role = activeLens === 'borrow' ? 'borrower' : 'lender';
    const rank = (loan: LoanRecord) => (isLoanActive(loan) ? (isLoanOverdue(loan) ? 0 : 1) : 2);
    return effectiveLoans
      .filter((loan) => loan.role === role)
      .slice()
      .sort((a, b) => {
        const byRank = rank(a) - rank(b);
        if (byRank !== 0) return byRank;
        return (a.dueDate || a.loanedAt).localeCompare(b.dueDate || b.loanedAt);
      });
  }, [effectiveLoans, activeLens]);

  const summary = useMemo(() => {
    const year = String(new Date().getFullYear());
    return {
      active: roleLoans.filter(isLoanActive).length,
      overdue: roleLoans.filter((loan) => isLoanOverdue(loan)).length,
      thisYear: roleLoans.filter((loan) => loan.loanedAt.startsWith(year)).length,
    };
  }, [roleLoans]);

  const runDefaultAction = useCallback(
    async (
      action: LoanAction,
      loan: LoanRecord,
      rating?: number
    ): Promise<LoanActionOutcome> => {
      if (action === 'remind') {
        // Aucun canal de notification n'est exposé sous RLS : on publie un
        // événement d'intégration, sans prétendre qu'un rappel est parti.
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('lkdv:loan-remind', { detail: { loanId: loan.id } })
          );
        }
        return { ok: false, reason: 'no_channel' };
      }

      try {
        const response = await fetch('/api/compte/loans', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action, loanId: loan.id, rating }),
        });
        if (!response.ok) return { ok: false, reason: 'request_failed' };
        if (action === 'accept') {
          setOverrides((current) => ({ ...current, [loan.id]: { status: 'en_cours' } }));
        } else if (action === 'decline') {
          setOverrides((current) => ({ ...current, [loan.id]: { status: 'annule' } }));
        } else if (action === 'return') {
          setOverrides((current) => ({
            ...current,
            [loan.id]: {
              status: 'rendu',
              returnedAt: new Date().toISOString().slice(0, 10),
            },
          }));
        } else if (action === 'rate' && rating !== undefined) {
          setOverrides((current) => ({ ...current, [loan.id]: { rating } }));
        } else if (action === 'dispute') {
          setOverrides((current) => ({ ...current, [loan.id]: { status: 'litige' } }));
        }
        return { ok: true };
      } catch {
        return { ok: false, reason: 'network_error' };
      }
    },
    []
  );

  const handleAction = useCallback<LoanActionHandler>(
    (action, loan, rating) => {
      if (onAction) return onAction(action, loan, rating);
      return runDefaultAction(action, loan, rating);
    },
    [onAction, runDefaultAction]
  );

  if (activeLens === 'trust') {
    return (
      <section
        className="lkdv-loans"
        data-testid="slot-content"
        data-slot="prets"
        data-lens="trust"
      >
        <style dangerouslySetInnerHTML={{ __html: LOANS_CSS }} />
        <TrustCard trust={sourceTrust} />
      </section>
    );
  }

  const isLend = activeLens === 'lend';
  const listLabel = isLend ? 'Prêts que tu accordes' : 'Prêts que tu empruntes';
  const emptyLabel = isLend ? 'Aucun prêt en cours.' : 'Aucun emprunt en cours.';

  return (
    <section
      className="lkdv-loans"
      data-testid="slot-content"
      data-slot="prets"
      data-lens={activeLens}
    >
      <style dangerouslySetInnerHTML={{ __html: LOANS_CSS }} />

      <div
        className="lkdv-loans-summary"
        role="group"
        aria-label={isLend ? 'Résumé des prêts' : 'Résumé des emprunts'}
      >
        <div className="lkdv-loans-stat">
          <b>{summary.active}</b>
          <span>Actifs</span>
        </div>
        <div className="lkdv-loans-stat">
          <b>{summary.overdue}</b>
          <span>En retard</span>
        </div>
        <div className="lkdv-loans-stat">
          <b>{summary.thisYear}</b>
          <span>Cette année</span>
        </div>
      </div>

      {roleLoans.length ? (
        <ul className="lkdv-loans-list" aria-label={listLabel}>
          {roleLoans.map((loan) => (
            <li key={loan.id}>
              <LoanCard loan={loan} viewer={viewerMode} onAction={handleAction} />
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState label={emptyLabel} />
      )}
    </section>
  );
}

/**
 * Styles locaux du slot Prêts. Ils ne définissent que la géométrie des cartes
 * et réutilisent les tokens du verre (`--label`, `--label2`, `--sf`,
 * `--accent`) ; les états vides réutilisent `.lkdv-slot-state` de la coquille.
 */
export const LOANS_CSS = `
.lkdv-loans{display:flex!important;flex-direction:column!important;gap:10px!important;padding:2px 0 4px!important;}
.lkdv-loans-summary{display:grid!important;grid-template-columns:repeat(3,1fr)!important;gap:1px!important;padding:12px 6px!important;border-radius:18px!important;background:rgba(255,255,255,.5)!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.92),0 0 0 .5px rgba(23,43,36,.07),0 6px 18px rgba(23,43,36,.05)!important;}
.lkdv-loans-stat{display:flex!important;flex-direction:column!important;align-items:center!important;gap:2px!important;text-align:center!important;min-width:0!important;}
.lkdv-loans-stat b{font:700 20px/1.1 var(--sf)!important;font-variant-numeric:tabular-nums!important;color:var(--label)!important;}
.lkdv-loans-stat span{font:500 11px/1.2 var(--sf)!important;color:var(--label2)!important;}
.lkdv-loans-list{list-style:none!important;margin:0!important;padding:0!important;display:flex!important;flex-direction:column!important;gap:8px!important;}
.lkdv-loan-card{display:flex!important;flex-direction:column!important;gap:8px!important;padding:11px 12px!important;border-radius:18px!important;background:rgba(255,255,255,.54)!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.92),0 0 0 .5px rgba(23,43,36,.08),0 6px 18px rgba(23,43,36,.05)!important;transition:box-shadow .2s ease!important;}
.lkdv-loan-main{display:flex!important;flex-direction:column!important;justify-content:center!important;gap:3px!important;min-height:84px!important;}
.lkdv-loan-head{display:flex!important;align-items:center!important;gap:8px!important;}
.lkdv-loan-item{margin:0!important;flex:1!important;min-width:0!important;font:600 15px/1.25 var(--sf)!important;letter-spacing:-.01em!important;color:var(--label)!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;}
.lkdv-loan-status{flex:none!important;display:inline-flex!important;align-items:center!important;height:22px!important;padding:0 9px!important;border-radius:999px!important;font:600 10.5px/1 var(--sf)!important;letter-spacing:.01em!important;white-space:nowrap!important;}
.lkdv-loan-status.is-en_attente{background:rgba(196,140,60,.18)!important;color:#7A4A12!important;}
.lkdv-loan-status.is-en_cours{background:rgba(150,186,142,.32)!important;color:#17402C!important;}
.lkdv-loan-status.is-en_retard{background:rgba(196,90,74,.14)!important;color:#8C2F25!important;}
.lkdv-loan-status.is-rendu{background:rgba(23,43,36,.07)!important;color:#56665D!important;}
.lkdv-loan-status.is-litige{background:rgba(140,80,120,.16)!important;color:#6B2E56!important;}
.lkdv-loan-status.is-annule{background:rgba(23,43,36,.07)!important;color:#56665D!important;}
.lkdv-loan-person{margin:0!important;display:flex!important;align-items:baseline!important;gap:5px!important;min-width:0!important;}
.lkdv-loan-person-name{font:600 13px/1.3 var(--sf)!important;color:var(--label)!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;}
.lkdv-loan-person-role{font:400 11.5px/1.3 var(--sf)!important;color:var(--label2)!important;}
.lkdv-loan-dates{margin:0!important;font:400 12px/1.35 var(--sf)!important;color:var(--label2)!important;}
.lkdv-loan-rate{margin:0!important;font:500 12px/1.35 var(--sf)!important;color:var(--accent)!important;}
.lkdv-loan-actions{display:flex!important;align-items:center!important;gap:6px!important;overflow-x:auto!important;padding:0 0 1px!important;scrollbar-width:none!important;}
.lkdv-loan-actions::-webkit-scrollbar{display:none!important;}
.lkdv-loan-action{flex:0 0 auto!important;min-height:44px!important;padding:0 13px!important;border:0!important;border-radius:999px!important;background:rgba(255,255,255,.72)!important;color:#17402C!important;font:600 12px/1 var(--sf)!important;box-shadow:inset 0 1px 0 #fff,0 0 0 .5px rgba(23,43,36,.12),0 2px 8px rgba(23,43,36,.05)!important;cursor:pointer!important;transition:transform .15s ease,opacity .15s ease!important;}
.lkdv-loan-action.is-danger{color:#8C2F25!important;}
.lkdv-loan-action[disabled]{opacity:.48!important;cursor:default!important;}
.lkdv-loan-action:active:not([disabled]){transform:scale(.96)!important;}
.lkdv-loan-action:focus-visible,.lkdv-loan-star:focus-visible{outline:2px solid rgba(23,64,44,.45)!important;outline-offset:2px!important;}
.lkdv-loan-rate-picker{display:flex!important;align-items:center!important;gap:8px!important;flex-wrap:wrap!important;}
.lkdv-loan-rate-label{margin:0!important;font:500 12px/1.3 var(--sf)!important;color:var(--label2)!important;}
.lkdv-loan-stars{display:flex!important;gap:4px!important;}
.lkdv-loan-star{width:44px!important;height:44px!important;display:grid!important;place-items:center!important;border:0!important;border-radius:12px!important;background:rgba(255,255,255,.72)!important;color:#17402C!important;font-size:19px!important;line-height:1!important;box-shadow:inset 0 1px 0 #fff,0 0 0 .5px rgba(23,43,36,.1)!important;cursor:pointer!important;}
.lkdv-loan-dispute{margin:0!important;font:500 11.5px/1.35 var(--sf)!important;color:#6B2E56!important;}
.lkdv-loan-feedback{margin:0!important;padding:7px 10px!important;border-radius:12px!important;font:500 11.5px/1.4 var(--sf)!important;}
.lkdv-loan-feedback.is-info{background:rgba(150,186,142,.22)!important;color:#17402C!important;}
.lkdv-loan-feedback.is-error{background:rgba(196,90,74,.1)!important;color:#8C2F25!important;}
.lkdv-trust-card{display:flex!important;flex-direction:column!important;gap:12px!important;padding:14px!important;border-radius:20px!important;background:rgba(255,255,255,.54)!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.94),0 0 0 .5px rgba(23,43,36,.08),0 6px 18px rgba(23,43,36,.05)!important;transition:box-shadow .2s ease!important;}
.lkdv-trust-head{display:flex!important;align-items:flex-start!important;gap:10px!important;}
.lkdv-trust-head-txt{flex:1!important;min-width:0!important;}
.lkdv-trust-title{margin:0!important;font:600 16px/1.2 var(--sf)!important;letter-spacing:-.01em!important;color:var(--label)!important;}
.lkdv-trust-sub{margin:3px 0 0!important;font:400 12px/1.35 var(--sf)!important;color:var(--label2)!important;}
.lkdv-trust-badge{flex:none!important;display:inline-flex!important;align-items:center!important;gap:4px!important;height:24px!important;padding:0 9px!important;border-radius:999px!important;font:600 10.5px/1 var(--sf)!important;white-space:nowrap!important;}
.lkdv-trust-badge.is-on{background:rgba(150,186,142,.32)!important;color:#17402C!important;}
.lkdv-trust-badge.is-off{background:rgba(23,43,36,.07)!important;color:#56665D!important;}
.lkdv-trust-badge-ico{font-size:11px!important;}
.lkdv-trust-grid{display:grid!important;grid-template-columns:repeat(3,1fr)!important;gap:1px!important;}
.lkdv-trust-stat{display:flex!important;flex-direction:column!important;align-items:center!important;gap:3px!important;text-align:center!important;min-width:0!important;padding:6px 2px!important;}
.lkdv-trust-stat b{font:700 22px/1.1 var(--sf)!important;font-variant-numeric:tabular-nums!important;color:var(--label)!important;}
.lkdv-trust-stat span{font:500 10.5px/1.25 var(--sf)!important;color:var(--label2)!important;}
@media (prefers-reduced-motion:reduce){.lkdv-loan-card,.lkdv-trust-card,.lkdv-loan-action{transition:none!important;animation:none!important;}.lkdv-loan-action:active:not([disabled]){transform:none!important;}}
`;

export default LoansSlot;
