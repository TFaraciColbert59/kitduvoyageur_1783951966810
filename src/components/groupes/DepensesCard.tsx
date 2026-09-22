import { lkvAlert, lkvConfirm } from '@/components/ui/dialogs';
import React, { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import Icon from '@/components/ui/AppIcon';
import { Badge, Button, Card, EmptyState, IconButton, ListItem, Modal } from '@/components/ui';

interface Expense {
  id: string;
  title: string;
  payerId?: string;
  payer: string;
  parts: number;
  amount: number;
}

interface DepensesCardProps {
  expenses: {
    total: number;
    perPerson: number;
    userBalance: number;
    userDebts: string;
    items: Expense[];
  };
  groupId?: string;
  onRefresh?: () => void;
  user?: any;
  members?: any[];
}

const FIELD_CLASS =
  'w-full rounded-[var(--lkv-radius-md)] border border-[color:var(--lkv-border)] bg-[color:var(--lkv-field-bg)] px-[var(--space-3)] py-[var(--space-2)] text-[length:var(--lkv-text-caption)] text-[color:var(--lkv-text-primary)] placeholder:text-[color:var(--lkv-text-muted)] focus:outline-none focus:ring-2 focus:ring-[color:var(--lkv-focus-ring)]';

export default function DepensesCard({ expenses, groupId, onRefresh, user, members }: DepensesCardProps) {
  const supabase = createClient();
  const [isAdding, setIsAdding] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [paidBy, setPaidBy] = useState('');
  const [loading, setLoading] = useState(false);
  const [showBalanceModal, setShowBalanceModal] = useState(false);

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newAmount || !groupId || !user) return;
    setLoading(true);

    const amount = parseFloat(newAmount) || 0;
    const payerId = paidBy || user.id;

    const { error } = await supabase.from('group_expenses').insert({
      group_id: groupId,
      title: newTitle.trim(),
      amount: amount,
      paid_by: payerId,
      category: 'Divers',
      split_between: members?.map(m => m.user_id) || [user.id],
      status: 'pending'
    });

    if (error) {
      console.error(error);
      lkvAlert('Erreur: ' + error.message);
    } else {
      setNewTitle('');
      setNewAmount('');
      setPaidBy('');
      setIsAdding(false);
      if (onRefresh) onRefresh();
    }

    setLoading(false);
  };

  const handleDeleteExpense = async (id: string) => {
    if (!(await lkvConfirm('Voulez-vous vraiment supprimer cette dépense ?'))) return;
    const { error } = await supabase.from('group_expenses').delete().eq('id', id);
    if (!error && onRefresh) onRefresh();
  };

  const handleEquilibrer = () => {
    setShowBalanceModal(true);
  };

  return (
    <Card className="relative p-[var(--space-6)] transition-all duration-[var(--motion-control-duration)]">
      <div className="mb-[var(--space-2)] flex items-start justify-between">
        <h2 className="font-display text-[length:var(--lkv-text-title-sm)] font-bold text-[color:var(--lkv-text-primary)]">
          Dépenses <span className="font-serif italic font-normal text-[color:var(--lkv-text-primary)]">du voyage</span>
        </h2>
        <Badge>{expenses.total}€</Badge>
      </div>

      <div className="mb-[var(--space-6)] flex items-center justify-between">
        <Button variant="secondary" size="sm" onClick={() => setShowBalanceModal(true)}>
          Historique
        </Button>
        <Button
          variant={isAdding ? 'secondary' : 'primary'}
          size="sm"
          onClick={() => setIsAdding(!isAdding)}
          icon={<Icon name={isAdding ? 'XMarkIcon' : 'PlusIcon'} size={12} aria-hidden="true" />}
        >
          {isAdding ? 'Annuler' : 'Ajouter'}
        </Button>
      </div>

      {isAdding && (
        <Card variant="compact" className="mb-[var(--space-6)] p-[var(--space-4)]">
          <form onSubmit={handleAddExpense} className="space-y-[var(--space-3)]">
            <div className="flex flex-wrap gap-[var(--space-3)]">
              <div className="min-w-[200px] flex-1">
                <label htmlFor="expense-title" className="mb-[var(--space-1)] block font-mono text-[length:var(--lkv-text-caption-2)] font-bold uppercase tracking-widest text-[color:var(--lkv-text-muted)]">Titre</label>
                <input
                  id="expense-title"
                  type="text"
                  autoFocus
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  placeholder="Ex: Plein d'essence..."
                  className={FIELD_CLASS}
                  disabled={loading}
                />
              </div>
              <div className="w-24">
                <label htmlFor="expense-amount" className="mb-[var(--space-1)] block font-mono text-[length:var(--lkv-text-caption-2)] font-bold uppercase tracking-widest text-[color:var(--lkv-text-muted)]">Montant (€)</label>
                <input
                  id="expense-amount"
                  type="number"
                  step="0.01"
                  value={newAmount}
                  onChange={e => setNewAmount(e.target.value)}
                  placeholder="Ex: 45.50"
                  className={FIELD_CLASS}
                  disabled={loading}
                />
              </div>
              <div className="w-full sm:w-40">
                <label htmlFor="expense-payer" className="mb-[var(--space-1)] block font-mono text-[length:var(--lkv-text-caption-2)] font-bold uppercase tracking-widest text-[color:var(--lkv-text-muted)]">Payé par</label>
                <select
                  id="expense-payer"
                  value={paidBy}
                  onChange={e => setPaidBy(e.target.value)}
                  className={`${FIELD_CLASS} min-h-[var(--control-height-md)]`}
                  disabled={loading}
                >
                  <option value="">(Moi-même)</option>
                  {members?.map(m => (
                    <option key={m.user_id} value={m.user_id}>
                      {m.user_profiles?.full_name || 'Membre'}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={!newTitle.trim() || !newAmount || loading} loading={loading}>
                Enregistrer
              </Button>
            </div>
          </form>
        </Card>
      )}

      <div className="mb-[var(--space-6)] grid grid-cols-3 gap-[var(--space-2)]">
        <Card variant="compact">
          <p className="mb-[var(--space-1)] font-mono text-[length:var(--lkv-text-caption-2)] font-bold uppercase tracking-widest text-[color:var(--lkv-text-muted)]">Total engagé</p>
          <p className="font-mono text-[length:var(--lkv-text-subheadline)] font-bold text-[color:var(--lkv-text-primary)]">{expenses.total}€</p>
        </Card>
        <Card variant="compact">
          <p className="mb-[var(--space-1)] font-mono text-[length:var(--lkv-text-caption-2)] font-bold uppercase tracking-widest text-[color:var(--lkv-text-muted)]">Par personne</p>
          <p className="font-mono text-[length:var(--lkv-text-subheadline)] font-bold text-[color:var(--lkv-text-primary)]">{expenses.perPerson}€</p>
        </Card>
        <Card variant="compact">
          <p className="mb-[var(--space-1)] font-mono text-[length:var(--lkv-text-caption-2)] font-bold uppercase tracking-widest text-[color:var(--lkv-text-muted)]">Vous devez</p>
          <p className="font-mono text-[length:var(--lkv-text-subheadline)] font-bold text-[color:var(--lkv-text-primary)]">{expenses.userBalance}€</p>
        </Card>
      </div>

      <div className="mb-[var(--space-6)] space-y-[var(--space-1)]">
        {expenses.items.length === 0 && (
          <EmptyState compact icon={<Icon name="CurrencyEuroIcon" size={22} aria-hidden="true" />} title="Aucune dépense enregistrée" />
        )}
        {expenses.items.map((item) => (
          <ListItem
            key={item.id}
            as="div"
            className="group bg-[color:var(--btn-tint)] border border-[color:var(--btn-glass-border)] backdrop-blur-[var(--btn-blur)] saturate-[var(--btn-saturate)] lkv-rim-btn"
            leading={
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[color:var(--btn-tint)] border border-[color:var(--btn-glass-border)] backdrop-blur-[var(--btn-blur)] saturate-[var(--btn-saturate)] lkv-rim-btn text-[color:var(--lkv-text-primary)]">
                <Icon name="CurrencyEuroIcon" size={14} aria-hidden="true" />
              </span>
            }
            title={item.title}
            subtitle={item.payer}
            metadata={
              <span className="text-right">
                <span className="block font-mono font-bold text-[color:var(--lkv-text-primary)]">{item.amount}€</span>
                <span className="block font-mono text-[length:var(--lkv-text-caption-2)] uppercase tracking-widest">{item.parts} parts</span>
              </span>
            }
            trailing={
              <IconButton
                variant="ghost"
                size="sm"
                onClick={() => handleDeleteExpense(item.id)}
                aria-label={`Supprimer la dépense ${item.title}`}
                className="opacity-0 group-hover:opacity-100 text-[color:var(--lkv-danger)]"
              >
                <Icon name="TrashIcon" size={14} aria-hidden="true" />
              </IconButton>
            }
          />
        ))}
      </div>

      <Card variant="compact" className="flex flex-col items-center justify-between gap-[var(--space-4)] sm:flex-row">
        <p className="font-sans text-[length:var(--lkv-text-caption)] leading-relaxed text-[color:var(--lkv-text-muted)]">
          {expenses.userDebts}
        </p>
        <Button onClick={handleEquilibrer} className="w-full whitespace-nowrap sm:w-auto">
          Équilibrer les comptes
        </Button>
      </Card>

      <Modal
        open={showBalanceModal}
        onOpenChange={setShowBalanceModal}
        title="Équilibre des comptes"
        description={`Simulation du calcul des dettes pour ${expenses.items.length} dépenses.`}
        size="sm"
      >
        <div className="space-y-[var(--space-4)]">
          <Card variant="compact">
            <p className="text-center font-mono text-[length:var(--lkv-text-caption)] font-semibold text-[color:var(--lkv-text-primary)]">
              Vous ne devez rien à personne pour l&apos;instant (démo statique).
            </p>
          </Card>
          <Button fullWidth onClick={() => setShowBalanceModal(false)}>
            Fermer
          </Button>
        </div>
      </Modal>
    </Card>
  );
}
