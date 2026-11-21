'use client';

import { useState, useTransition, type FormEvent } from 'react';
import { newId } from '@/lib/uuid';
import { createCockpitExpense } from './budgetActions';
import { groupExpensesByCategory, projectRemainingBudget, splitCentsExactly } from './budgetMath';
import { computeExactSettlements } from './settlementsAndGear';
import { enqueueOfflineOp, type ExpenseCreatePayload } from './offlineQueue';
import type { CockpitData, CockpitExpense } from './model';
import { DrawerRow, DrawerSection, ProgressBar, SegmentedTabs, StatusBadge } from './DrawerPrimitives';
import ds from './cockpitDrawers.module.css';

const CATEGORIES = ['Hébergement', 'Nourriture', 'Transport', 'Activité', 'Matériel', 'Autre'] as const;

const CATEGORY_ICONS: Record<string, string> = {
  Hébergement: 'home',
  Nourriture: 'utensils',
  Transport: 'train',
  Activité: 'compass',
  Matériel: 'backpack',
  Autre: 'receipt',
};

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
  const [tab, setTab] = useState<'categories' | 'partage'>('categories');
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

  // Calcul des remboursements simplifiés à partir des dépenses réelles payées
  const netByUser: Record<string, number> = {};
  for (const s of shares) netByUser[s.participantId] = -s.cents;
  for (const exp of realExpenses) {
    if (exp.currency !== currency || !exp.payer) continue;
    const match = people.find((p) => p.name === exp.payer);
    if (match && Object.hasOwn(netByUser, match.id)) {
      netByUser[match.id] += Math.round(exp.amount * 100);
    }
  }
  const settlements = computeExactSettlements(netByUser);

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
        setFeedback('Dépense enregistrée dans le voyage.');
      } else {
        setFeedback(res.message);
      }
    });
  }

  return (
    <div className={ds.drawerRoot} style={{ paddingBottom: 0 }}>
      {canEdit && !fixture && (
        !openForm ? (
          <button type="button" className={ds.btnPrimary} onClick={() => setOpenForm(true)}>
            + Ajouter une dépense réelle
          </button>
        ) : (
          <DrawerSection title="Nouvelle dépense réelle" padded>
            <form onSubmit={submit} className={ds.drawerRoot} style={{ paddingBottom: 0 }} aria-label="Nouvelle dépense">
              <label className={ds.fieldGroup}>
                <span className={ds.fieldLabel}>Montant ({currency})</span>
                <input
                  type="text"
                  inputMode="decimal"
                  className={`${ds.fieldInput} ${ds.amountInput}`}
                  value={amount}
                  required
                  placeholder="18,50"
                  onChange={(e) => setAmount(e.currentTarget.value)}
                />
              </label>
              <label className={ds.fieldGroup}>
                <span className={ds.fieldLabel}>Intitulé</span>
                <input
                  type="text"
                  className={ds.fieldInput}
                  value={title}
                  maxLength={120}
                  required
                  placeholder="Ex. Refuge, ravitaillement…"
                  onChange={(e) => setTitle(e.currentTarget.value)}
                />
              </label>
              <div className={ds.fieldGroup}>
                <span className={ds.fieldLabel}>Catégorie</span>
                <select
                  aria-label="Catégorie"
                  className={ds.fieldSelect}
                  value={category}
                  onChange={(e) => setCategory(e.currentTarget.value)}
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
              <div className={ds.btnRow}>
                <button type="submit" className={ds.btnPrimary} disabled={pending}>
                  {pending ? 'Enregistrement…' : 'Enregistrer'}
                </button>
                <button type="button" className={ds.btnSecondary} onClick={() => setOpenForm(false)}>
                  Annuler
                </button>
              </div>
            </form>
          </DrawerSection>
        )
      )}

      {feedback && (
        <div className={ds.alertBanner} data-tone="good" role="status">
          {feedback}
        </div>
      )}

      {projection && (
        <div className={ds.kpiGrid3} role="region" aria-label="Projection budgétaire">
          <div className={ds.kpiTile}>
            <span className={ds.kpiLabel}>Rythme / jour</span>
            <span className={ds.kpiValue}>{money(projection.dailyPaceCents / 100, currency)}</span>
          </div>
          <div className={ds.kpiTile}>
            <span className={ds.kpiLabel}>Projection fin</span>
            <span className={ds.kpiValue}>{money(projection.projectedTotalCents / 100, currency)}</span>
          </div>
          <div className={ds.kpiTile}>
            <span className={ds.kpiLabel}>
              {projection.remainingBudgetCents == null
                ? 'Jours restants'
                : projection.remainingBudgetCents >= 0 ? 'Marge' : 'Dépassement'}
            </span>
            <span className={ds.kpiValue} style={{
              color: projection.remainingBudgetCents != null
                ? (projection.remainingBudgetCents >= 0 ? 'var(--hub-good)' : 'var(--hub-bad)')
                : undefined,
            }}>
              {projection.remainingBudgetCents != null
                ? money(Math.abs(projection.remainingBudgetCents) / 100, currency)
                : `${projection.remainingDays} j`}
            </span>
          </div>
        </div>
      )}

      {(categories.length > 0 || shares.length > 0) && (
        <SegmentedTabs
          ariaLabel="Vues budget"
          value={tab}
          onChange={setTab}
          tabs={[
            { id: 'categories', label: `Catégories (${categories.length})` },
            { id: 'partage', label: `Partage (${people.length})` },
          ]}
        />
      )}

      {tab === 'categories' && categories.length > 0 && (
        <DrawerSection title="Dépenses réelles par catégorie">
          {categories.map((cat) => {
            const pct = totalSpent > 0 ? Math.round((cat.amount / totalSpent) * 100) : 0;
            return (
              <div key={`${cat.currency}-${cat.category}`} className={ds.row} style={{ flexDirection: 'column', alignItems: 'stretch', gap: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                  <span className={ds.rowTitle}>
                    {cat.category} <span className={ds.rowSub}>({cat.count})</span>
                  </span>
                  <span className={ds.rowRight}>{money(cat.amount, cat.currency)}</span>
                </div>
                <ProgressBar value={pct} tone="tint" />
              </div>
            );
          })}
        </DrawerSection>
      )}

      {tab === 'partage' && shares.length > 0 && (
        <>
          <DrawerSection
            title={`Répartition exacte (${people.length} participants)`}
            right={<StatusBadge tone="good">Au centime</StatusBadge>}
          >
            {shares.map((share) => {
              const person = people.find((p) => p.id === share.participantId);
              return (
                <DrawerRow
                  key={share.participantId}
                  icon="user"
                  iconTone="neutral"
                  title={person?.name ?? 'Participant'}
                  subtitle={person?.role}
                  right={money(share.amount, currency)}
                />
              );
            })}
          </DrawerSection>

          {settlements.length > 0 && (
            <DrawerSection title="Remboursements simplifiés">
              {settlements.map((s) => {
                const from = people.find((p) => p.id === s.fromUserId)?.name ?? 'Participant';
                const to = people.find((p) => p.id === s.toUserId)?.name ?? 'Participant';
                return (
                  <DrawerRow
                    key={`${s.fromUserId}-${s.toUserId}`}
                    icon={CATEGORY_ICONS.Autre}
                    iconTone="warn"
                    title={`${from} → ${to}`}
                    subtitle="Règlement conseillé"
                    right={<StatusBadge tone="warn">{money(s.amount, currency)}</StatusBadge>}
                  />
                );
              })}
            </DrawerSection>
          )}
        </>
      )}
    </div>
  );
}
