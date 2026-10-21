'use client';

import React, { useState } from 'react';

/** Rôle du propriétaire du profil sur ce prêt. */
export type LoanRole = 'lender' | 'borrower';

/** Les quatre statuts réels de `materiel_loans` (et leurs alias d'affichage). */
export type LoanStatus = 'en_cours' | 'rendu' | 'en_retard' | 'litige' | (string & {});

export type LoanAction = 'remind' | 'return' | 'rate' | 'dispute';

export type LoanViewer = 'owner' | 'visitor';

/** Forme exacte produite par `mapLoans` dans le bootstrap du Compte. */
export interface LoanRecord {
  id: string;
  itemName: string;
  counterpart: string;
  role: LoanRole;
  status: LoanStatus;
  loanedAt: string;
  dueDate: string;
  returnedAt: string;
  rating: number | null;
}

export type LoanActionHandler = (
  action: LoanAction,
  loan: LoanRecord,
  rating?: number
) => void | Promise<void>;

export interface LoanCardProps {
  loan: LoanRecord;
  /** Visiteur : la personne est toujours désignée par « Membre ». */
  viewer?: LoanViewer;
  onAction?: LoanActionHandler;
}

const MONTHS_SHORT = [
  'janv.',
  'févr.',
  'mars',
  'avr.',
  'mai',
  'juin',
  'juil.',
  'août',
  'sept.',
  'oct.',
  'nov.',
  'déc.',
];

const STATUS_LABEL: Record<string, string> = {
  en_cours: 'En cours',
  en_retard: 'En retard',
  rendu: 'Rendu',
  litige: 'Litige',
};

/** Date ISO (`AAAA-MM-JJ`) → « 21 oct. », sans décalage de fuseau. */
export function formatShortDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return '';
  const month = Number(match[2]) - 1;
  if (month < 0 || month > 11) return '';
  return `${Number(match[3])} ${MONTHS_SHORT[month]}`;
}

export function loanStatusLabel(status: string): string {
  return STATUS_LABEL[status] ?? status;
}

export function isLoanActive(loan: Pick<LoanRecord, 'status'>): boolean {
  return loan.status === 'en_cours' || loan.status === 'en_retard';
}

/** Retard réel : statut `en_retard` ou échéance dépassée sur un prêt actif. */
export function isLoanOverdue(
  loan: Pick<LoanRecord, 'status' | 'dueDate' | 'returnedAt'>,
  today = new Date().toISOString().slice(0, 10)
): boolean {
  if (loan.status === 'en_retard') return true;
  if (!isLoanActive(loan) || loan.returnedAt || !loan.dueDate) return false;
  return loan.dueDate < today;
}

function normalizeRole(role: unknown): LoanRole {
  return role === 'borrower' || role === 'borrow' ? 'borrower' : 'lender';
}

/**
 * Carte d'un prêt.
 *
 * - objet, personne (visiteur : « Membre »), dates, statut, échéance ;
 * - actions contextuelles : Rappeler / Marquer rendu / Rendre / Noter / Signaler ;
 * - cibles tactiles de 44 px, libellés accessibles explicites ;
 * - aucune donnée inventée : les champs absents ne sont pas rendus.
 */
export function LoanCard({ loan, viewer = 'owner', onAction }: LoanCardProps) {
  const [ratingOpen, setRatingOpen] = useState(false);
  const [ratedLocally, setRatedLocally] = useState(false);

  const role = normalizeRole(loan.role);
  const title = loan.itemName?.trim() || 'Objet';
  const person = viewer === 'visitor' ? 'Membre' : loan.counterpart?.trim() || 'Contact';
  const active = isLoanActive(loan);
  const returned = loan.status === 'rendu';
  const disputed = loan.status === 'litige';
  const overdue = isLoanOverdue(loan);
  const canRate = returned && loan.rating === null && !ratedLocally;
  const titleId = `lkdv-loan-title-${loan.id}`;

  const dates: string[] = [];
  if (loan.loanedAt) dates.push(`Prêté le ${formatShortDate(loan.loanedAt)}`);
  if (loan.returnedAt) dates.push(`Rendu le ${formatShortDate(loan.returnedAt)}`);
  if (!loan.returnedAt && loan.dueDate) dates.push(`Échéance ${formatShortDate(loan.dueDate)}`);

  const submit = (action: LoanAction, rating?: number) => {
    if (rating !== undefined) {
      setRatedLocally(true);
      setRatingOpen(false);
    }
    void onAction?.(action, loan, rating);
  };

  const actionButton = (
    label: string,
    action: LoanAction,
    options: { disabled?: boolean; danger?: boolean; title?: string; opensRating?: boolean } = {}
  ) => (
    <button
      key={`${label}-${action}`}
      type="button"
      className={`lkdv-loan-action${options.danger ? ' is-danger' : ''}`}
      aria-label={`${label} · ${title}`}
      disabled={options.disabled}
      title={options.disabled ? options.title : undefined}
      onClick={() => {
        if (options.opensRating) {
          setRatingOpen(true);
          return;
        }
        submit(action);
      }}
    >
      {label}
    </button>
  );

  const actions: React.ReactNode[] = [];
  if (active && role === 'lender') {
    actions.push(actionButton('Rappeler', 'remind'));
    actions.push(actionButton('Marquer rendu', 'return'));
    actions.push(
      actionButton('Noter', 'rate', {
        disabled: true,
        title: 'Disponible après le retour',
        opensRating: true,
      })
    );
    actions.push(actionButton('Signaler', 'dispute', { danger: true }));
  } else if (active && role === 'borrower') {
    actions.push(actionButton('Rendre', 'return'));
    actions.push(
      actionButton('Noter', 'rate', {
        disabled: true,
        title: 'Disponible après le retour',
        opensRating: true,
      })
    );
    actions.push(actionButton('Signaler', 'dispute', { danger: true }));
  } else if (returned) {
    actions.push(
      actionButton('Noter', 'rate', {
        disabled: !canRate,
        title: canRate ? undefined : 'Prêt déjà noté',
        opensRating: true,
      })
    );
    actions.push(actionButton('Signaler', 'dispute', { danger: true }));
  }

  return (
    <article
      className="lkdv-loan-card"
      data-testid={`loan-card-${loan.id}`}
      data-role={role}
      data-status={loan.status}
      data-overdue={overdue ? 'true' : undefined}
      aria-labelledby={titleId}
    >
      <div className="lkdv-loan-main">
        <div className="lkdv-loan-head">
          <h3 className="lkdv-loan-item" id={titleId}>
            {title}
          </h3>
          <span className={`lkdv-loan-status is-${loan.status}`}>{loanStatusLabel(loan.status)}</span>
        </div>

        <p className="lkdv-loan-person">
          <span className="lkdv-loan-person-name">{person}</span>
          <span className="lkdv-loan-person-role">
            {role === 'lender' ? 'emprunteur' : 'prêteur'}
          </span>
        </p>

        {dates.length ? <p className="lkdv-loan-dates">{dates.join(' · ')}</p> : null}

        {loan.rating !== null ? (
          <p className="lkdv-loan-rate">Note {loan.rating} / 5</p>
        ) : null}
      </div>

      {actions.length ? (
        <div className="lkdv-loan-actions" role="group" aria-label={`Actions pour ${title}`}>
          {actions}
        </div>
      ) : null}

      {ratingOpen ? (
        <div className="lkdv-loan-rate-picker">
          <p className="lkdv-loan-rate-label">Choisir une note</p>
          <div className="lkdv-loan-stars" role="group" aria-label={`Note pour ${title}`}>
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                key={value}
                type="button"
                className="lkdv-loan-star"
                aria-label={`${value} sur 5`}
                onClick={() => submit('rate', value)}
              >
                ★
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {disputed ? (
        <p className="lkdv-loan-dispute" role="note">
          Litige en cours.
        </p>
      ) : null}
    </article>
  );
}

export default LoanCard;
