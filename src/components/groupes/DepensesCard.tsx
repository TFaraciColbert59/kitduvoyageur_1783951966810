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
    <div className="bg-white rounded-[2rem] p-6 border border-[#1C2620]/10 shadow-sm relative">
      <div className="flex justify-between items-start mb-2">
        <h2 className="font-display text-xl text-[#1C2620]">Dépenses <span className="font-serif italic font-bold">du voyage</span></h2>
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] uppercase tracking-widest text-[#1C2620]/60 bg-[#1C2620]/5 px-2 py-0.5 rounded-full">{expenses.total}€</span>
        </div>
      </div>
      
      <div className="flex justify-between items-center mb-6">
        <button className="text-xs font-medium text-[#17402C] hover:underline font-sans">Historique</button>
        <button 
          onClick={() => setIsAdding(!isAdding)}
          className="px-3 py-1.5 rounded-full bg-[#33463C] text-white font-sans font-medium text-xs hover:bg-[#33463C]/90 transition-colors flex items-center gap-1"
        >
          <Icon name={isAdding ? "XMarkIcon" : "PlusIcon"} size={12} /> {isAdding ? 'Annuler' : 'Ajouter'}
        </button>
      </div>

      {isAdding && (
        <form onSubmit={handleAddExpense} className="mb-6 bg-[#E7E3D6]/20 p-4 rounded-2xl border border-[#1C2620]/10">
          <div className="flex flex-wrap gap-3 mb-3">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-[10px] font-mono text-[#1C2620]/60 uppercase tracking-widest mb-1.5">Titre</label>
              <input 
                type="text" 
                autoFocus
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                placeholder="Ex: Plein d'essence..." 
                className="w-full bg-white border border-[#1C2620]/10 rounded-xl py-2 px-4 text-sm text-[#1C2620] focus:outline-none focus:ring-2 focus:ring-[#33463C]/20"
                disabled={loading}
              />
            </div>
            <div className="w-24">
              <label className="block text-[10px] font-mono text-[#1C2620]/60 uppercase tracking-widest mb-1.5">Montant (€)</label>
              <input 
                type="number" 
                step="0.01"
                value={newAmount}
                onChange={e => setNewAmount(e.target.value)}
                placeholder="Ex: 45.50" 
                className="w-full bg-white border border-[#1C2620]/10 rounded-xl py-2 px-4 text-sm text-[#1C2620] focus:outline-none focus:ring-2 focus:ring-[#33463C]/20"
                disabled={loading}
              />
            </div>
            <div className="w-full sm:w-40">
              <label className="block text-[10px] font-mono text-[#1C2620]/60 uppercase tracking-widest mb-1.5">Payé par</label>
              <select 
                value={paidBy}
                onChange={e => setPaidBy(e.target.value)}
                className="w-full bg-white border border-[#1C2620]/10 rounded-xl py-2 px-4 text-sm text-[#1C2620] focus:outline-none focus:ring-2 focus:ring-[#33463C]/20"
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
              className="px-6 py-2 bg-[#1C2620] text-white rounded-xl text-xs font-semibold disabled:opacity-50"
            >
              Enregistrer
            </button>
          </div>
        </form>
      )}
      
      <div className="grid grid-cols-3 gap-2 mb-8">
        <div className="bg-[#E7E3D6]/30 p-3 rounded-xl border border-[#1C2620]/5">
          <p className="font-mono text-[9px] uppercase tracking-widest text-[#1C2620]/50 mb-1">Total engagé</p>
          <p className="font-mono font-bold text-lg text-[#1C2620]">{expenses.total}€</p>
        </div>
        <div className="bg-[#E7E3D6]/30 p-3 rounded-xl border border-[#1C2620]/5">
          <p className="font-mono text-[9px] uppercase tracking-widest text-[#1C2620]/50 mb-1">Par personne</p>
          <p className="font-mono font-bold text-lg text-[#1C2620]">{expenses.perPerson}€</p>
        </div>
        <div className="bg-[#1C2620]/5 p-3 rounded-xl border border-[#1C2620]/10">
          <p className="font-mono text-[9px] uppercase tracking-widest text-[#1C2620]/50 mb-1">Vous devez</p>
          <p className="font-mono font-bold text-lg text-[#17402C]">{expenses.userBalance}€</p>
        </div>
      </div>
      
      <div className="space-y-4 mb-6">
        {expenses.items.length === 0 && (
          <p className="text-center text-sm text-[#1C2620]/50 py-2">Aucune dépense enregistrée.</p>
        )}
        {expenses.items.map((item) => (
          <div key={item.id} className="flex items-center justify-between group p-2 hover:bg-[#E7E3D6]/20 rounded-xl transition-colors">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-[#E7E3D6] flex items-center justify-center text-[#1C2620]/50 flex-shrink-0 mt-0.5">
                <Icon name="CurrencyEuroIcon" size={14} />
              </div>
              <div>
                <h3 className="font-sans font-semibold text-sm text-[#1C2620]">{item.title}</h3>
                <p className="text-[11px] text-[#1C2620]/50 font-sans">{item.payer}</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="font-mono font-bold text-sm text-[#1C2620]">{item.amount}€</p>
                <p className="font-mono text-[9px] uppercase tracking-widest text-[#1C2620]/40">{item.parts} parts</p>
              </div>
              <button 
                onClick={() => handleDeleteExpense(item.id)}
                className="p-1.5 text-[#1C2620]/30 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                title="Supprimer"
              >
                <Icon name="TrashIcon" size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>
      
      <div className="bg-[#E7E3D6]/40 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 border border-[#1C2620]/5">
        <p className="text-xs text-[#1C2620]/70 font-sans leading-relaxed">
          {expenses.userDebts}
        </p>
        <button 
          onClick={handleEquilibrer}
          className="w-full sm:w-auto px-4 py-2 bg-[#1C2620] text-white rounded-full text-xs font-medium hover:bg-[#1C2620]/80 transition-colors whitespace-nowrap"
        >
          Équilibrer les comptes
        </button>
      </div>

      {showBalanceModal && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] p-8 max-w-md w-full shadow-2xl relative">
            <button 
              onClick={() => setShowBalanceModal(false)}
              className="absolute top-6 right-6 text-[#1C2620]/50 hover:text-[#1C2620]"
            >
              <Icon name="XMarkIcon" size={24} />
            </button>
            <h2 className="font-display text-2xl text-[#1C2620] mb-4">Équilibre <span className="font-serif italic font-bold">des comptes</span></h2>
            <p className="text-sm text-[#1C2620]/80 mb-6">
              Simulation du calcul des dettes pour {expenses.items.length > 0 ? expenses.items.length : 0} dépenses.
            </p>
            <div className="bg-[#E7E3D6]/30 p-4 rounded-xl mb-6 border border-[#1C2620]/10">
              <p className="text-center font-mono text-sm text-[#1C2620]">Vous ne devez rien à personne pour l'instant (démo statique).</p>
            </div>
            <button 
              onClick={() => setShowBalanceModal(false)}
              className="w-full py-3 bg-[#1C2620] text-white rounded-xl text-sm font-semibold"
            >
              Fermer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
