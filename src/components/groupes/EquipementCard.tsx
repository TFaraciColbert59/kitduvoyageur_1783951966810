import React, { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import Icon from '@/components/ui/AppIcon';

interface EquipementItem {
  id: string;
  item: string;
  assigneeId?: string;
  assignee: string;
  weight: string;
  status: string;
  notes: string;
  statusColor: string;
}

interface EquipementCardProps {
  equipment: EquipementItem[];
  groupId?: string;
  onRefresh?: () => void;
  user?: any;
  members?: any[];
}

export default function EquipementCard({ equipment, groupId, onRefresh, user, members }: EquipementCardProps) {
  const supabase = createClient();
  const [isAdding, setIsAdding] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemWeight, setNewItemWeight] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim() || !groupId || !user) return;
    setLoading(true);

    const weightGrams = parseInt(newItemWeight) || 0;
    const { error } = await supabase.from('group_kit_items').insert({
      group_id: groupId,
      name: newItemName.trim(),
      weight_grams: weightGrams,
      assigned_to: assignedTo || null,
      category: 'Divers',
      quantity: 1
    });
    
    if (error) {
      console.error(error);
      alert('Erreur: ' + error.message);
    } else {
      setNewItemName('');
      setNewItemWeight('');
      setAssignedTo('');
      setIsAdding(false);
      if (onRefresh) onRefresh();
    }
    
    setLoading(false);
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!confirm('Retirer cet objet du kit partagé ?')) return;
    const { error } = await supabase.from('group_kit_items').delete().eq('id', itemId);
    if (!error && onRefresh) onRefresh();
  };

  const handleImportKit = () => {
    alert("Simulation: Ouvre le tiroir pour sélectionner depuis l'inventaire personnel.");
  };

  const unassignedCount = equipment.filter(e => e.assignee === 'Non attribué').length;
  const totalGrams = equipment.reduce((acc, curr) => {
    const val = parseInt(curr.weight.replace(/[^0-9]/g, ''));
    return acc + (isNaN(val) ? 0 : val);
  }, 0);
  const totalKg = (totalGrams / 1000).toFixed(2);

  return (
    <div className="bg-white rounded-[2rem] p-6 border border-[#1C2620]/10 shadow-sm">
      <div className="flex justify-between items-start mb-2">
        <h2 className="font-display text-xl text-[#1C2620]">Équipement <span className="font-serif italic font-bold">partagé</span></h2>
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] uppercase tracking-widest text-[#1C2620]/60 bg-[#1C2620]/5 px-2 py-0.5 rounded-full">{equipment.length} items</span>
          <span className="font-mono text-[10px] uppercase tracking-widest text-[#1C2620]/60 bg-[#1C2620]/5 px-2 py-0.5 rounded-full">{unassignedCount} non-attribués</span>
        </div>
      </div>
      
      <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
        <p className="text-sm text-[#1C2620]/80 font-sans max-w-sm hidden sm:block">
          Chaque objet est apporté par une personne. Les poids se totalisent automatiquement.
        </p>
        <div className="flex gap-2 w-full sm:w-auto justify-end">
          <button 
            onClick={handleImportKit}
            className="px-3 py-1.5 rounded-full bg-[#1C2620]/5 text-[#1C2620] font-sans font-medium text-xs hover:bg-[#1C2620]/10 transition-colors flex items-center gap-1"
          >
            <Icon name="ArrowDownTrayIcon" size={12} /> Import kit
          </button>
          <button 
            onClick={() => setIsAdding(!isAdding)}
            className="px-3 py-1.5 rounded-full bg-[#33463C] text-white font-sans font-medium text-xs hover:bg-[#33463C]/90 transition-colors flex items-center gap-1"
          >
            <Icon name={isAdding ? "XMarkIcon" : "PlusIcon"} size={12} /> {isAdding ? 'Annuler' : 'Ajouter'}
          </button>
        </div>
      </div>

      {isAdding && (
        <form onSubmit={handleAddItem} className="mb-6 bg-[#E7E3D6]/20 p-4 rounded-2xl border border-[#1C2620]/10">
          <div className="flex flex-wrap gap-3 mb-3">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-[10px] font-mono text-[#1C2620]/60 uppercase tracking-widest mb-1.5">Nom de l'objet</label>
              <input 
                type="text" 
                autoFocus
                value={newItemName}
                onChange={e => setNewItemName(e.target.value)}
                placeholder="Ex: Tente MSR..." 
                className="w-full bg-white border border-[#1C2620]/10 rounded-xl py-2 px-4 text-sm text-[#1C2620] focus:outline-none focus:ring-2 focus:ring-[#33463C]/20"
                disabled={loading}
              />
            </div>
            <div className="w-24">
              <label className="block text-[10px] font-mono text-[#1C2620]/60 uppercase tracking-widest mb-1.5">Poids (g)</label>
              <input 
                type="number" 
                value={newItemWeight}
                onChange={e => setNewItemWeight(e.target.value)}
                placeholder="Ex: 450" 
                className="w-full bg-white border border-[#1C2620]/10 rounded-xl py-2 px-4 text-sm text-[#1C2620] focus:outline-none focus:ring-2 focus:ring-[#33463C]/20"
                disabled={loading}
              />
            </div>
            <div className="w-full sm:w-40">
              <label className="block text-[10px] font-mono text-[#1C2620]/60 uppercase tracking-widest mb-1.5">Porteur</label>
              <select 
                value={assignedTo}
                onChange={e => setAssignedTo(e.target.value)}
                className="w-full bg-white border border-[#1C2620]/10 rounded-xl py-2 px-4 text-sm text-[#1C2620] focus:outline-none focus:ring-2 focus:ring-[#33463C]/20"
                disabled={loading}
              >
                <option value="">Non attribué</option>
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
              disabled={!newItemName.trim() || loading}
              className="px-6 py-2 bg-[#1C2620] text-white rounded-xl text-xs font-semibold disabled:opacity-50"
            >
              Sauvegarder l'objet
            </button>
          </div>
        </form>
      )}
      
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[600px]">
          <thead>
            <tr className="border-b border-[#1C2620]/10">
              <th className="py-3 px-2 font-mono text-[10px] uppercase tracking-widest text-[#1C2620]/50 font-medium">Objet</th>
              <th className="py-3 px-2 font-mono text-[10px] uppercase tracking-widest text-[#1C2620]/50 font-medium w-1/4">Apporté par</th>
              <th className="py-3 px-2 font-mono text-[10px] uppercase tracking-widest text-[#1C2620]/50 font-medium w-24">Poids</th>
              <th className="py-3 px-2 font-mono text-[10px] uppercase tracking-widest text-[#1C2620]/50 font-medium w-32">Statut</th>
              <th className="py-3 px-2 w-10"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1C2620]/5">
            {equipment.length === 0 && (
              <tr>
                <td colSpan={5} className="py-4 text-center text-sm text-[#1C2620]/50">Aucun équipement partagé pour le moment.</td>
              </tr>
            )}
            {equipment.map((item) => (
              <tr key={item.id} className="group hover:bg-[#E7E3D6]/20 transition-colors">
                <td className="py-3 px-2">
                  <p className="font-sans font-medium text-sm text-[#1C2620]">{item.item}</p>
                  {item.notes && <p className="text-xs text-[#1C2620]/50">{item.notes}</p>}
                </td>
                <td className="py-3 px-2">
                  <span className={`text-sm ${item.assignee === 'Non attribué' ? 'text-[#1C2620]/40 italic' : 'text-[#1C2620]'}`}>
                    {item.assignee}
                  </span>
                </td>
                <td className="py-3 px-2">
                  <span className="font-mono text-sm text-[#1C2620]/80">{item.weight}</span>
                </td>
                <td className="py-3 px-2">
                  <span className={`inline-block px-2.5 py-1 rounded-sm font-mono text-[9px] uppercase tracking-widest ${item.statusColor}`}>
                    {item.status}
                  </span>
                </td>
                <td className="py-3 px-2 text-right">
                  <button 
                    onClick={() => handleDeleteItem(item.id)}
                    className="p-1.5 text-[#1C2620]/30 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                    title="Supprimer"
                  >
                    <Icon name="TrashIcon" size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      <div className="mt-6 pt-4 border-t border-[#1C2620]/10 flex items-center justify-between">
        <span className="text-sm text-[#1C2620]/60 font-sans">Poids total du matériel partagé</span>
        <div className="flex items-center gap-3">
          <span className="font-mono font-bold text-lg text-[#1C2620]">{totalKg} kg</span>
        </div>
      </div>
    </div>
  );
}
