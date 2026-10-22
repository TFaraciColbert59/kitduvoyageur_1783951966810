'use client';

import React, { useState } from 'react';

/** Rôle du propriétaire du profil sur ce prêt. */
export type LoanRole = 'lender' | 'borrower';

/** Les six statuts réels de `materiel_loans` (et leurs alias d'affichage). */
export type LoanStatus =
  | 'en_attente'
  | 'en_cours'
  | 'rendu'
  | 'en_retard'
  | 'litige'
  | 'annule'
  | (string & {});

export type LoanAction = 'accept' | 'decline' | 'remind' | 'return' | 'rate' | 'dispute';

export type LoanViewer = 'owner' | 'visitor';

/** Résultat d'une action : `ok: false` garde le picker ouvert et permet le retry. */
export interface LoanActionOutcome {
  ok: boolean;
  reason?: string;
}

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
) => void | LoanActionOutcome | Promise<void | LoanActionOutcome>;

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
  en_attente: 'En attente',
  en_cours: 'En cours',
  en_retard: 'En retard',
  rendu: 'Rendu',
  litige: 'Litige',
  annule: 'Annulé',
};

/** Date ISO (`AAAA-MM-JJ`) → « 21 oct. » ; l'année n'apparaît que si utile. */
export function formatShortDate(value: string, currentYear = new Date().getFullYear()): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return '';
  const month = Number(match[2]) - 1;
  if (month < 0 || month > 11) return '';
  const year = Number(match[1]);
  const suffix = year === currentYear ? '' : ` ${year}`;
  return `${Number(match[3])} ${MONTHS_SHORT[month]}${suffix}`;
}

export function loanStatusLabel(status: string): string {
  return STATUS_LABEL[status] ?? status;
}

export function isLoanActive(loan: Pick<LoanRecord, 'status'>): boolean {
  return loan.status === 'en_cours' || loan.status === 'en_retard';
}

/** Retard réel : jamais vrai dès qu'un retour est enregistré. */
export function isLoanOverdue(
  loan: Pick<LoanRecord, 'status' | 'dueDate' | 'returnedAt'>,
  today = new Date().toISOString().slice(0, 10)
): boolean {
  if (loan.returnedAt) return false;
  if (loan.status === 'en_retard') return true;
  if (!isLoanActive(loan) || !loan.dueDate) return false;
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
 * - visiteur : aucune action mutante ;
 * - cibles tactiles de 44 px, libellés accessibles explicites ;
 * - aucune donnée inventée : les champs absents ne sont pas rendus.
 */
export function LoanCard({ loan, viewer = 'owner', onAction }: LoanCardProps) {
  const [ratingOpen, setRatingOpen] = useState(false);
  const [ratedLocally, setRatedLocally] = useState(false);
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState<{ tone: 'info' | 'error'; text: string } | null>(
    null
  );

  const role = normalizeRole(loan.role);
  const canAct = viewer !== 'visitor';
  const title = loan.itemName?.trim() || 'Objet';
  const person = viewer === 'visitor' ? 'Membre' : loan.counterpart?.trim() || 'Contact';
  const active = isLoanActive(loan);
  const returned = loan.status === 'rendu';
  const disputed = loan.status === 'litige';
  const overdue = isLoanOverdue(loan);
  const canRate = returned && loan.rating === null && !ratedLocally;
  const currentYear = new Date().getFullYear();
  const titleId = `lkdv-loan-title-${loan.id}`;

  const dates: string[] = [];
  if (loan.loanedAt) dates.push(`Prêté le ${formatShortDate(loan.loanedAt, currentYear)}`);
  if (loan.returnedAt) dates.push(`Rendu le ${formatShortDate(loan.returnedAt, currentYear)}`);
  if (!loan.returnedAt && loan.dueDate) {
    dates.push(`Échéance ${formatShortDate(loan.dueDate, currentYear)}`);
  }

  const submit = async (action: LoanAction, rating?: number) => {
    // « Rappeler » n'a aucun canal sous RLS : la notice est neutre et honnête,
    // jamais un faux succès ni un bouton muet.
    if (action === 'remind') {
      setFeedback({ tone: 'info', text: 'Rappel non envoyé : canal à venir.' });
      void Promise.resolve()
        .then(() => onAction?.(action, loan))
        .catch(() => {});
      return;
    }
    if (pending) return;

    setPending(true);
    setFeedback(null);
    try {
      const outcome = await onAction?.(action, loan, rating);
      if (outcome && outcome.ok === false) {
        throw new Error(outcome.reason || 'loan_action_failed');
      }
      if (rating !== undefined) {
        // Latch « déjà noté » seulement après succès.
        setRatedLocally(true);
        setRatingOpen(false);
        setFeedback({ tone: 'info', text: 'Note enregistrée.' });
      } else if (action === 'accept') {
        setFeedback({ tone: 'info', text: 'Demande acceptée.' });
      } else if (action === 'decline') {
        setFeedback({
          tone: 'info',
          text: role === 'borrower' ? 'Demande refusée.' : 'Demande annulée.',
        });
      } else if (action === 'return') {
        setFeedback({ tone: 'info', text: 'Prêt marqué rendu.' });
      } else if (action === 'dispute') {
        setFeedback({ tone: 'info', text: 'Litige signalé.' });
      }
    } catch {
      if (rating !== undefined) {
        // Échec : le picker reste ouvert, l'utilisateur peut réessayer.
        setRatingOpen(true);
        setFeedback({ tone: 'error', text: 'Note non enregistrée. Réessaie.' });
      } else {
        setFeedback({ tone: 'error', text: 'Action impossible pour le moment.' });
      }
    } finally {
      setPending(false);
    }
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
      disabled={options.disabled || pending}
      title={options.disabled ? options.title : undefined}
      onClick={() => {
        if (options.opensRating) {
          setFeedback(null);
          setRatingOpen(true);
          return;
        }
        void submit(action);
      }}
    >
      {label}
    </button>
  );

  const actions: React.ReactNode[] = [];
  if (canAct && loan.status === 'en_attente') {
    // Consentement : l'emprunteur accepte ou refuse, le prêteur peut retirer
    // sa demande. Un visiteur n'a aucune de ces actions (cf. canAct).
    if (role === 'borrower') {
      actions.push(actionButton('Accepter', 'accept'));
      actions.push(actionButton('Refuser', 'decline', { danger: true }));
    } else {
      actions.push(actionButton('Annuler la demande', 'decline', { danger: true }));
    }
  } else if (canAct && role === 'lender' && active) {
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
  } else if (canAct && role === 'borrower' && active) {
    actions.push(actionButton('Rendre', 'return'));
    actions.push(
      actionButton('Noter', 'rate', {
        disabled: true,
        title: 'Disponible après le retour',
        opensRating: true,
      })
    );
    actions.push(actionButton('Signaler', 'dispute', { danger: true }));
  } else if (canAct && returned) {
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
      aria-busy={pending ? 'true' : undefined}
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

        {loan.rating != null ? (
          <p className="lkdv-loan-rate">Note {loan.rating} / 5</p>
        ) : null}
      </div>

      {actions.length ? (
        <div
          className="lkdv-loan-actions"
          data-hscroll="true"
          role="group"
          aria-label={`Actions pour ${title}`}
        >
          {actions}
        </div>
      ) : null}

      {canAct && ratingOpen ? (
        <div className="lkdv-loan-rate-picker">
          <p className="lkdv-loan-rate-label">Choisir une note</p>
          <div className="lkdv-loan-stars" role="group" aria-label={`Note pour ${title}`}>
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                key={value}
                type="button"
                className="lkdv-loan-star"
                aria-label={`${value} sur 5`}
                disabled={pending}
                onClick={() => void submit('rate', value)}
              >
                ★
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {canAct && feedback ? (
        <p
          className={`lkdv-loan-feedback is-${feedback.tone}`}
          role={feedback.tone === 'error' ? 'alert' : 'status'}
        >
          {feedback.text}
        </p>
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
