import React, { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import Icon from '@/components/ui/AppIcon';

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
      alert('Erreur: ' + error.message);
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
    if (!confirm('Voulez-vous vraiment supprimer cette dépense ?')) return;
    const { error } = await supabase.from('group_expenses').delete().eq('id', id);
    if (!error && onRefresh) onRefresh();
  };

  const handleEquilibrer = () => {
    setShowBalanceModal(true);
  };

  return (
    <div className="glass p-6 relative transition-all duration-300">
      <div className="flex justify-between items-start mb-2">
        <h2 className="font-display font-bold text-xl text-[#17402C]">Dépenses <span className="font-serif italic font-normal text-[#17402C]">du voyage</span></h2>
        <div className="flex items-center gap-2">
          <span className="glass-pill">{expenses.total}€</span>
        </div>
      </div>
      
      <div className="flex justify-between items-center mb-6">
        <button
          onClick={() => setShowBalanceModal(true)}
          className="glass-capsule-btn py-1 px-3 text-xs font-semibold"
        >
          <span className="relative z-10">Historique</span>
        </button>
        <button 
          onClick={() => setIsAdding(!isAdding)}
          className="glass-capsule-btn primary py-1.5 px-3 text-xs font-bold flex items-center gap-1"
        >
          <Icon name={isAdding ? "XMarkIcon" : "PlusIcon"} size={12} className="relative z-10" />
          <span className="relative z-10">{isAdding ? 'Annuler' : 'Ajouter'}</span>
        </button>
      </div>

      {isAdding && (
        <form onSubmit={handleAddExpense} className="mb-6 glass-sub-card p-4 rounded-2xl">
          <div className="flex flex-wrap gap-3 mb-3">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-[10px] font-mono text-[#5C6B5E] uppercase tracking-widest mb-1.5 font-bold">Titre</label>
              <input 
                type="text" 
                autoFocus
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                placeholder="Ex: Plein d'essence..." 
                className="glass-input w-full text-xs"
                disabled={loading}
              />
            </div>
            <div className="w-24">
              <label className="block text-[10px] font-mono text-[#5C6B5E] uppercase tracking-widest mb-1.5 font-bold">Montant (€)</label>
              <input 
                type="number" 
                step="0.01"
                value={newAmount}
                onChange={e => setNewAmount(e.target.value)}
                placeholder="Ex: 45.50" 
                className="glass-input w-full text-xs"
                disabled={loading}
              />
            </div>
            <div className="w-full sm:w-40">
              <label className="block text-[10px] font-mono text-[#5C6B5E] uppercase tracking-widest mb-1.5 font-bold">Payé par</label>
              <select 
                value={paidBy}
                onChange={e => setPaidBy(e.target.value)}
                className="glass-input w-full text-xs"
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
          <div className="flex justify-end mt-2">
            <button 
              type="submit"
              disabled={!newTitle.trim() || !newAmount || loading}
              className="glass-capsule-btn primary py-2 px-5 text-xs font-bold disabled:opacity-50"
            >
              <span className="relative z-10">Enregistrer</span>
            </button>
          </div>
        </form>
      )}
      
      <div className="grid grid-cols-3 gap-2 mb-6">
        <div className="glass-sub-card p-3 rounded-xl">
          <p className="font-mono text-[9px] uppercase tracking-widest text-[#5C6B5E] mb-1 font-bold">Total engagé</p>
          <p className="font-mono font-bold text-lg text-[#17402C]">{expenses.total}€</p>
        </div>
        <div className="glass-sub-card p-3 rounded-xl">
          <p className="font-mono text-[9px] uppercase tracking-widest text-[#5C6B5E] mb-1 font-bold">Par personne</p>
          <p className="font-mono font-bold text-lg text-[#17402C]">{expenses.perPerson}€</p>
        </div>
        <div className="glass-sub-card p-3 rounded-xl">
          <p className="font-mono text-[9px] uppercase tracking-widest text-[#5C6B5E] mb-1 font-bold">Vous devez</p>
          <p className="font-mono font-bold text-lg text-[#17402C]">{expenses.userBalance}€</p>
        </div>
      </div>
      
      <div className="space-y-3 mb-6">
        {expenses.items.length === 0 && (
          <p className="text-center text-sm text-[#5C6B5E] py-2">Aucune dépense enregistrée.</p>
        )}
        {expenses.items.map((item) => (
          <div key={item.id} className="flex items-center justify-between group p-3 glass-sub-card rounded-xl">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full glass-sub-card flex items-center justify-center text-[#17402C] flex-shrink-0 mt-0.5">
                <Icon name="CurrencyEuroIcon" size={14} className="relative z-10" />
              </div>
              <div>
                <h3 className="font-sans font-bold text-sm text-[#17402C]">{item.title}</h3>
                <p className="text-[11px] text-[#5C6B5E] font-sans">{item.payer}</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="font-mono font-bold text-sm text-[#17402C]">{item.amount}€</p>
                <p className="font-mono text-[9px] uppercase tracking-widest text-[#5C6B5E]">{item.parts} parts</p>
              </div>
              <button 
                onClick={() => handleDeleteExpense(item.id)}
                className="glass-capsule-btn p-1.5 text-red-600 opacity-0 group-hover:opacity-100"
                title="Supprimer"
              >
                <Icon name="TrashIcon" size={14} className="relative z-10" />
              </button>
            </div>
          </div>
        ))}
      </div>
      
      <div className="glass-sub-card rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <p className="text-xs text-[#5C6B5E] font-sans leading-relaxed">
          {expenses.userDebts}
        </p>
        <button 
          onClick={handleEquilibrer}
          className="w-full sm:w-auto glass-capsule-btn primary py-2 px-4 text-xs font-bold whitespace-nowrap"
        >
          <span className="relative z-10">Équilibrer les comptes</span>
        </button>
      </div>

      {showBalanceModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="glass rounded-2xl p-6 sm:p-8 max-w-md w-full relative">
            <button 
              onClick={() => setShowBalanceModal(false)}
              className="glass-capsule-btn p-2 absolute top-6 right-6"
            >
              <Icon name="XMarkIcon" size={18} className="relative z-10" />
            </button>
            <h2 className="font-display font-bold text-2xl text-[#17402C] mb-4">Équilibre <span className="font-serif italic font-normal text-[#17402C]">des comptes</span></h2>
            <p className="text-sm text-[#5C6B5E] mb-6">
              Simulation du calcul des dettes pour {expenses.items.length > 0 ? expenses.items.length : 0} dépenses.
            </p>
            <div className="glass-sub-card p-4 rounded-xl mb-6">
              <p className="text-center font-mono text-sm text-[#17402C] font-semibold">Vous ne devez rien à personne pour l'instant (démo statique).</p>
            </div>
            <button 
              onClick={() => setShowBalanceModal(false)}
              className="w-full glass-capsule-btn primary py-3 text-xs font-bold"
            >
              <span className="relative z-10">Fermer</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
