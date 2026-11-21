'use client';

import { useState, useTransition, type FormEvent } from 'react';
import { newId } from '@/lib/uuid';
import { createCockpitExpense } from './budgetActions';
import { groupExpensesByCategory, projectRemainingBudget, splitCentsExactly } from './budgetMath';
import { enqueueOfflineOp, type ExpenseCreatePayload } from './offlineQueue';
import type { CockpitData, CockpitExpense } from './model';
import styles from './cockpit.module.css';

const CATEGORIES = ['Hébergement', 'Nourriture', 'Transport', 'Activité', 'Matériel', 'Autre'] as const;

const money = (amount: number, currency: string) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency }).format(amount);

export function BudgetDrawerTools({
  tripId,
  currency,
  date,
  allExpenses,
  plannedEnvelope,
  day,
  dayCount,
  people,
  canEdit,
  isOnline,
  fixture,
  onAdded,
  onQueued,
}: {
  tripId: string;
  currency: string;
  date: string;
  allExpenses: CockpitExpense[];
  plannedEnvelope: number | null;
  day: number;
  dayCount: number | null;
  people: CockpitData['people'];
  canEdit: boolean;
  isOnline: boolean;
  fixture?: boolean;
  onAdded: (expense: CockpitExpense) => void;
  onQueued?: (payload: ExpenseCreatePayload, operationId: string) => void;
}) {
  const [openForm, setOpenForm] = useState(false);
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<string>('Nourriture');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const realExpenses = allExpenses.filter((e) => !e.planned);
  const totalSpent = realExpenses
    .filter((e) => e.currency === currency)
    .reduce((sum, e) => sum + Math.round(e.amount * 100), 0) / 100;
  const categories = groupExpensesByCategory(realExpenses);
  const projection = dayCount && dayCount > 1
    ? projectRemainingBudget(totalSpent, plannedEnvelope, day, dayCount)
    : null;
  const shares = people.length > 1 && totalSpent > 0
    ? splitCentsExactly(totalSpent, people.map((p) => p.id))
    : [];

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const numeric = Number(amount.replace(',', '.'));
    if (!title.trim() || !Number.isFinite(numeric) || numeric <= 0) {
      setFeedback('Saisis un intitulé et un montant valide.');
      return;
    }
    setFeedback(null);
    const operationId = newId();
    const payload: ExpenseCreatePayload = {
      tripId,
      title: title.trim(),
      amount: Math.round(numeric * 100) / 100,
      currency,
      category,
      date,
    };

    startTransition(async () => {
      if (!isOnline) {
        await enqueueOfflineOp({ operationId, tripId, kind: 'expense_create', payload });
        onQueued?.(payload, operationId);
        setTitle('');
        setAmount('');
        setOpenForm(false);
        setFeedback('Dépense enregistrée hors ligne. Synchronisation au retour réseau.');
        return;
      }
      const res = await createCockpitExpense({ ...payload, operationId });
      if (res.ok) {
        onAdded(res.expense);
        setTitle('');
        setAmount('');
        setOpenForm(false);
      } else {
        setFeedback(res.message);
      }
    });
  }

  return (
    <div className={styles.stepExecution}>
      {canEdit && !fixture && (
        <div>
          {!openForm ? (
            <button type="button" className="lkdv-cv2-chip" onClick={() => setOpenForm(true)}>
              + Ajouter une dépense réelle
            </button>
          ) : (
            <form onSubmit={submit} className={styles.stepExecution} aria-label="Nouvelle dépense">
              <label className={styles.stepNote}>
                Intitulé
                <input
                  type="text"
                  value={title}
                  maxLength={120}
                  required
                  placeholder="Ex. Refuge, ravitaillement…"
                  onChange={(e) => setTitle(e.currentTarget.value)}
                />
              </label>
              <div className={styles.stepButtons}>
                <label className={styles.stepNote}>
                  Montant ({currency})
                  <input
                    type="text"
                    inputMode="decimal"
                    value={amount}
                    required
                    placeholder="18,50"
                    onChange={(e) => setAmount(e.currentTarget.value)}
                  />
                </label>
                <label className={styles.stepNote}>
                  Catégorie
                  <select value={category} onChange={(e) => setCategory(e.currentTarget.value)}>
                    {CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </label>
              </div>
              <div className={styles.stepButtons}>
                <button type="submit" className="lkdv-cv2-chip" disabled={pending}>
                  {pending ? 'Enregistrement…' : 'Enregistrer'}
                </button>
                <button type="button" className="lkdv-cv2-chip" onClick={() => setOpenForm(false)}>
                  Annuler
                </button>
              </div>
            </form>
          )}
          {feedback && <p role="status" className={styles.meta}>{feedback}</p>}
        </div>
      )}

      {projection && (
        <div role="region" aria-label="Projection budgétaire">
          <p className={styles.meta}>
            Rythme réel : {money(projection.dailyPaceCents / 100, currency)}/jour · Projection fin de voyage :{' '}
            <strong>{money(projection.projectedTotalCents / 100, currency)}</strong>
            {projection.remainingBudgetCents != null && (
              <> ({projection.remainingBudgetCents >= 0 ? 'marge ' : 'dépassement '}
                {money(Math.abs(projection.remainingBudgetCents) / 100, currency)})</>
            )}
          </p>
        </div>
      )}

      {categories.length > 0 && (
        <div role="region" aria-label="Dépenses par catégorie">
          <p className={styles.meta}>Par catégorie</p>
          <dl className={styles.stepTimes}>
            {categories.map((cat) => (
              <div key={`${cat.currency}-${cat.category}`}>
                <dt>{cat.category} ({cat.count})</dt>
                <dd>{money(cat.amount, cat.currency)}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      {shares.length > 0 && (
        <div role="region" aria-label="Répartition par participant">
          <p className={styles.meta}>Répartition exacte ({people.length} participants)</p>
          <dl className={styles.stepTimes}>
            {shares.map((share) => {
              const person = people.find((p) => p.id === share.participantId);
              return (
                <div key={share.participantId}>
                  <dt>{person?.name ?? 'Participant'}</dt>
                  <dd>{money(share.amount, currency)}</dd>
                </div>
              );
            })}
          </dl>
        </div>
      )}
    </div>
  );
}
