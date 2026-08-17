'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Icon from '@/components/ui/AppIcon';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';

interface EquipementItem {
  id: string;
  item: string;
  assigneeId?: string;
  assignee: string;
  weight: string;
  weightGrams?: number;
  quantity?: number;
  category?: string;
  is_shared?: boolean;
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

interface GearItem {
  id: string;
  name: string;
  brand?: string;
  category?: string;
  weight_g?: number;
  quantity?: number;
}

const CATEGORY_EMOJI: Record<string, string> = {
  'Bivouac': '⛺',
  'Cuisine': '🍳',
  'Sécurité': '🩹',
  'Orientation': '🧭',
  'Eau & Hydratation': '💧',
  'Électronique': '🔋',
  'Divers': '🎒',
};

export default function EquipementCard({ equipment, groupId, onRefresh, user, members }: EquipementCardProps) {
  const supabase = createClient();
  const router = useRouter();
  const { triggerHaptic } = useHapticFeedback();

  const [items, setItems] = useState<EquipementItem[]>(equipment);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Tout');
  const [isAdding, setIsAdding] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [newItemName, setNewItemName] = useState('');
  const [newItemWeight, setNewItemWeight] = useState('');
  const [newCategory, setNewCategory] = useState('Bivouac');
  const [newQuantity, setNewQuantity] = useState(1);
  const [assignedTo, setAssignedTo] = useState('');

  const [editForm, setEditForm] = useState({ name: '', weightGrams: '', category: '', quantity: 1, is_shared: true, notes: '', assigned_to: '' });

  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [personalItems, setPersonalItems] = useState<GearItem[]>([]);
  const [personalSearch, setPersonalSearch] = useState('');
  const [selectedGear, setSelectedGear] = useState<Record<string, boolean>>({});
  const [importingNow, setImportingNow] = useState(false);

  useEffect(() => { setItems(equipment); }, [equipment]);

  const showError = (msg: string) => { setError(msg); setTimeout(() => setError(null), 4000); };
  const showNotice = (msg: string) => { setNotice(msg); setTimeout(() => setNotice(null), 2500); };

  const runOp = async (op: any, onOk?: () => void, errPrefix = 'Erreur') => {
    const { error: e } = await op;
    if (e) { console.error(errPrefix, e); showError(`${errPrefix} : ${e.message}`); return false; }
    onOk?.();
    return true;
  };

  const refresh = () => { if (onRefresh) onRefresh(); };

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim() || !groupId || !user) { showError("Nom de l'objet requis"); return; }
    triggerHaptic('selection');
    setLoading(true);
    const weightGrams = parseInt(newItemWeight) || 0;
    const ok = await runOp(
      supabase.from('group_kit_items').insert({
        group_id: groupId,
        name: newItemName.trim(),
        weight_grams: weightGrams,
        assigned_to: assignedTo || null,
        category: newCategory,
        quantity: newQuantity,
        is_shared: true,
      }),
      () => {
        showNotice('Objet ajouté au kit partagé');
        setNewItemName('');
        setNewItemWeight('');
        setIsAdding(false);
        refresh();
      },
      'Ajout équipement'
    );
    setLoading(false);
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!confirm('Supprimer cet objet du sac partagé ?')) return;
    triggerHaptic('warning');
    setBusyId(itemId);
    await runOp(
      supabase.from('group_kit_items').delete().eq('id', itemId),
      () => { showNotice('Objet supprimé'); refresh(); },
      'Suppression équipement'
    );
    setBusyId(null);
  };

  const handleAssignToMe = async (item: EquipementItem) => {
    if (!user) { showError('Connectez-vous pour vous attribuer un objet'); return; }
    triggerHaptic('light');
    setBusyId(item.id);
    const newAssigned = item.assigneeId === user.id ? null : user.id;
    await runOp(
      supabase.from('group_kit_items').update({ assigned_to: newAssigned }).eq('id', item.id),
      () => {
        showNotice(newAssigned ? 'Objet pris en charge par vous' : 'Objet libéré');
        refresh();
      },
      'Affectation'
    );
    setBusyId(null);
  };

  const handleUpdateItem = async (itemId: string) => {
    if (!editForm.name.trim()) return;
    triggerHaptic('selection');
    setBusyId(itemId);
    const ok = await runOp(
      supabase.from('group_kit_items').update({
        name: editForm.name.trim(),
        weight_grams: parseInt(editForm.weightGrams) || 0,
        category: editForm.category || 'Divers',
        quantity: editForm.quantity,
        is_shared: editForm.is_shared,
        notes: editForm.notes || null,
        assigned_to: editForm.assigned_to || null,
      }).eq('id', itemId),
      () => {
        showNotice('Objet mis à jour');
        setEditingId(null);
        refresh();
      },
      'Mise à jour'
    );
    setBusyId(null);
  };

  const openImport = async () => {
    if (!user) { showError('Connectez-vous pour accéder à votre inventaire'); return; }
    setIsImporting(true);
    try {
      const { data, error: e } = await supabase
        .from('user_gear')
        .select('id, name, brand, category, weight_g, quantity')
        .eq('user_id', user.id)
        .order('name');
      if (e) throw e;
      setPersonalItems(data || []);
      const preselect: Record<string, boolean> = {};
      (data || []).forEach(g => {
        const already = items.some(i => i.item.toLowerCase() === g.name.toLowerCase());
        if (!already) preselect[g.id] = false;
      });
      setSelectedGear(preselect);
    } catch (err: any) {
      showError(`Impossible de charger votre inventaire : ${err.message}`);
    }
  };

  const executeImport = async () => {
    if (!groupId) return;
    const toImport = personalItems.filter(g => selectedGear[g.id]);
    if (toImport.length === 0) { showError('Aucun objet sélectionné'); return; }
    setImportingNow(true);
    let inserted = 0;
    for (const g of toImport) {
      const { error: e } = await supabase.from('group_kit_items').insert({
        group_id: groupId,
        name: g.brand ? `${g.brand} ${g.name}` : g.name,
        weight_grams: g.weight_g || 0,
        category: g.category || 'Divers',
        quantity: g.quantity || 1,
        assigned_to: user?.id || null,
        is_shared: true,
      });
      if (!e) inserted++;
    }
    setImportingNow(false);
    setIsImporting(false);
    showNotice(`${inserted} objet(s) importé(s) avec succès`);
    refresh();
  };

  const categories = ['Tout', 'Bivouac', 'Cuisine', 'Sécurité', 'Orientation', 'Eau & Hydratation', 'Électronique', 'Divers'];

  const filteredItems = items.filter(i => {
    const q = search.toLowerCase();
    const matchSearch = !search || i.item.toLowerCase().includes(q) || i.assignee.toLowerCase().includes(q) || (i.category || '').toLowerCase().includes(q);
    const matchCategory = selectedCategory === 'Tout' || (i.category || 'Divers') === selectedCategory;
    return matchSearch && matchCategory;
  });

  const unassignedCount = items.filter(e => !e.assigneeId || e.assignee === 'Non attribué').length;
  const totalGrams = items.reduce((acc, curr) => acc + ((curr.weightGrams || 0) * (curr.quantity || 1)), 0);
  const totalKg = (totalGrams / 1000).toFixed(2);

  const startEdit = (item: EquipementItem) => {
    setEditForm({
      name: item.item,
      weightGrams: String(item.weightGrams || 0),
      category: item.category || 'Divers',
      quantity: item.quantity || 1,
      is_shared: item.is_shared !== false,
      notes: item.notes || '',
      assigned_to: item.assigneeId || '',
    });
    setEditingId(item.id);
  };

  return (
    <div className="bg-white rounded-[24px] p-4 sm:p-6 border border-[#1C2620]/8 shadow-[0_2px_12px_rgba(11,31,23,0.04)] transition-all">
      <div className="flex flex-col gap-2 mb-4">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[10px] font-mono uppercase tracking-widest text-[#5C6B5E]">Kit collaboratif</span>
            <h2 className="font-display text-lg sm:text-xl text-[#1C2620] font-bold">
              Équipement <em className="font-serif italic font-normal text-[#17402C]">partagé</em>
            </h2>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="px-2.5 py-1 bg-[#F5F2E8] text-[#17402C] text-[10px] font-mono font-bold rounded-full border border-[#17402C]/10">
              {items.length} items
            </span>
            <span className="px-2.5 py-1 bg-[#FAF9F5] text-[#D97746] text-[10px] font-mono font-bold rounded-full border border-[#D97746]/20">
              {unassignedCount} libres
            </span>
          </div>
        </div>

        {groupId && (
          <Link
            href={`/ai-configurator?groupId=${groupId}`}
            className="w-full mt-1 p-2.5 rounded-2xl bg-gradient-to-r from-[#17402C] to-[#2D6B4A] text-white text-xs font-bold flex items-center justify-between shadow-sm active:scale-[0.98] transition-transform"
          >
            <span className="flex items-center gap-2">
              <span>🎒</span>
              <span>Optimiser le sac avec l'IA</span>
            </span>
            <span className="text-[#A8C4A2] text-xs">Configurer →</span>
          </Link>
        )}
      </div>

      <div className="flex items-center gap-2 mb-3">
        <div className="flex-1 relative flex items-center bg-[#FAF9F5] border border-[#1C2620]/10 rounded-2xl px-3 py-2">
          <Icon name="MagnifyingGlassIcon" size={14} className="text-[#5C6B5E] mr-2 shrink-0" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Chercher un objet, un porteur..."
            className="w-full bg-transparent border-none text-xs text-[#1C2620] focus:outline-none placeholder-[#5C6B5E]/60"
          />
          {search && (
            <button onClick={() => setSearch('')} className="text-xs text-[#5C6B5E] px-1">✕</button>
          )}
        </div>

        <button
          onClick={openImport}
          className="px-3 py-2 bg-[#F5F2E8] hover:bg-[#EAE6DF] text-[#17402C] rounded-2xl text-xs font-bold flex items-center gap-1 shrink-0 border border-[#17402C]/10 active:scale-95 transition-all"
          title="Importer depuis mon kit"
        >
          <Icon name="ArrowDownTrayIcon" size={12} />
          <span className="hidden sm:inline">Mon kit</span>
        </button>

        <button
          onClick={() => {
            triggerHaptic('light');
            setIsAdding(!isAdding);
          }}
          className="px-3.5 py-2 bg-[#17402C] text-white rounded-2xl text-xs font-bold flex items-center gap-1 shrink-0 shadow-sm hover:bg-[#122E20] active:scale-95 transition-all"
        >
          <span>{isAdding ? '✕' : '+'}</span>
          <span>{isAdding ? 'Fermer' : 'Ajouter'}</span>
        </button>
      </div>

      <div className="overflow-x-auto scrollbar-none flex items-center gap-1.5 pb-2 mb-3">
        {categories.map(cat => {
          const isSelected = selectedCategory === cat;
          return (
            <button
              key={cat}
              onClick={() => {
                triggerHaptic('light');
                setSelectedCategory(cat);
              }}
              className={`px-3 py-1 rounded-full text-[11px] font-medium whitespace-nowrap transition-all flex items-center gap-1 ${
                isSelected
                  ? 'bg-[#17402C] text-white font-bold shadow-sm'
                  : 'bg-[#FAF9F5] text-[#5C6B5E] border border-[#1C2620]/8 hover:bg-[#F5F2E8]'
              }`}
            >
              <span>{CATEGORY_EMOJI[cat] || '🎒'}</span>
              <span>{cat}</span>
            </button>
          );
        })}
      </div>

      {error && (
        <div className="mb-3 p-2.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
          <Icon name="ExclamationTriangleIcon" size={14} /> {error}
        </div>
      )}
      {notice && (
        <div className="mb-3 p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-700">
          {notice}
        </div>
      )}

      {isAdding && (
        <form onSubmit={handleAddItem} className="mb-4 bg-[#F5F2E8] p-4 rounded-2xl border border-[#17402C]/15 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-[#17402C]">Ajouter un équipement commun</h4>
            <span className="text-[10px] font-mono text-[#5C6B5E]">Kit partagé</span>
          </div>

          <div className="space-y-2">
            <input
              type="text"
              autoFocus
              value={newItemName}
              onChange={e => setNewItemName(e.target.value)}
              placeholder="Ex: Tente MSR Hubba Hubba 2P..."
              className="w-full bg-white border border-[#1C2620]/10 rounded-xl py-2 px-3 text-xs text-[#1C2620] focus:ring-2 focus:ring-[#17402C] outline-none"
            />

            <div className="grid grid-cols-3 gap-2">
              <input
                type="number"
                value={newItemWeight}
                onChange={e => setNewItemWeight(e.target.value)}
                placeholder="Poids (g)"
                className="bg-white border border-[#1C2620]/10 rounded-xl py-2 px-3 text-xs text-[#1C2620] outline-none"
              />
              <input
                type="number"
                min={1}
                value={newQuantity}
                onChange={e => setNewQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                placeholder="Qté"
                className="bg-white border border-[#1C2620]/10 rounded-xl py-2 px-3 text-xs text-[#1C2620] outline-none"
              />
              <select
                value={newCategory}
                onChange={e => setNewCategory(e.target.value)}
                className="bg-white border border-[#1C2620]/10 rounded-xl py-2 px-2 text-xs text-[#1C2620] outline-none"
              >
                {categories.filter(c => c !== 'Tout').map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <select
              value={assignedTo}
              onChange={e => setAssignedTo(e.target.value)}
              className="w-full bg-white border border-[#1C2620]/10 rounded-xl py-2 px-3 text-xs text-[#1C2620] outline-none"
            >
              <option value="">👤 Qui porte cet objet ? (Non attribué)</option>
              {members?.map(m => (
                <option key={m.user_id} value={m.user_id}>
                  {m.user_profiles?.full_name || 'Membre'}
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setIsAdding(false)}
              className="px-3 py-1.5 bg-transparent text-xs text-[#5C6B5E] font-medium"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={!newItemName.trim() || loading}
              className="px-4 py-1.5 bg-[#17402C] text-white rounded-xl text-xs font-bold disabled:opacity-50"
            >
              {loading ? 'Ajout...' : 'Sauvegarder'}
            </button>
          </div>
        </form>
      )}

      {editingId && (
        <div className="mb-4 bg-[#EAF0EB] p-4 rounded-2xl border border-[#2D5A3D]/20 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-[#17402C]">Modifier l'équipement</h4>
            <button onClick={() => setEditingId(null)} className="text-xs text-[#5C6B5E]">✕</button>
          </div>

          <input
            type="text"
            value={editForm.name}
            onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
            className="w-full bg-white border border-[#1C2620]/10 rounded-xl py-2 px-3 text-xs text-[#1C2620]"
          />

          <div className="grid grid-cols-3 gap-2">
            <input
              type="number"
              value={editForm.weightGrams}
              onChange={e => setEditForm(f => ({ ...f, weightGrams: e.target.value }))}
              placeholder="Poids (g)"
              className="bg-white border border-[#1C2620]/10 rounded-xl py-2 px-3 text-xs"
            />
            <input
              type="number"
              min={1}
              value={editForm.quantity}
              onChange={e => setEditForm(f => ({ ...f, quantity: Math.max(1, parseInt(e.target.value) || 1) }))}
              placeholder="Qté"
              className="bg-white border border-[#1C2620]/10 rounded-xl py-2 px-3 text-xs"
            />
            <select
              value={editForm.assigned_to}
              onChange={e => setEditForm(f => ({ ...f, assigned_to: e.target.value }))}
              className="bg-white border border-[#1C2620]/10 rounded-xl py-2 px-2 text-xs"
            >
              <option value="">Non attribué</option>
              {members?.map(m => (
                <option key={m.user_id} value={m.user_id}>{m.user_profiles?.full_name || 'Membre'}</option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-2">
            <button onClick={() => setEditingId(null)} className="px-3 py-1.5 text-xs text-[#5C6B5E]">Annuler</button>
            <button onClick={() => handleUpdateItem(editingId)} className="px-4 py-1.5 bg-[#17402C] text-white rounded-xl text-xs font-bold">
              Enregistrer
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2.5">
        {filteredItems.length === 0 ? (
          <div className="py-8 text-center bg-[#FAF9F5] rounded-2xl border border-[#1C2620]/6 p-4">
            <span className="text-3xl block mb-1">🎒</span>
            <p className="text-xs font-bold text-[#1C2620]">
              {search ? 'Aucun objet trouvé' : 'Aucun équipement dans cette catégorie'}
            </p>
            <p className="text-[11px] text-[#5C6B5E] mt-0.5">
              Ajoutez les éléments clés du bivouac pour équilibrer les sacs.
            </p>
            {!search && (
              <button
                onClick={() => setIsAdding(true)}
                className="mt-3 px-4 py-1.5 bg-[#17402C] text-white rounded-xl text-xs font-bold shadow-sm"
              >
                + Ajouter un objet
              </button>
            )}
          </div>
        ) : (
          filteredItems.map(item => {
            const isAssigned = !!item.assigneeId && item.assignee !== 'Non attribué';
            const isMyAssignment = isAssigned && item.assigneeId === user?.id;

            return (
              <div
                key={item.id}
                className="bg-[#FAF9F5] rounded-2xl p-3 border border-[#1C2620]/6 flex items-center justify-between gap-3 hover:bg-white hover:border-[#17402C]/20 transition-all shadow-[0_1px_4px_rgba(11,31,23,0.02)]"
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <div className="w-9 h-9 rounded-xl bg-white border border-[#1C2620]/10 flex items-center justify-center text-base shrink-0 shadow-sm">
                    {CATEGORY_EMOJI[item.category || 'Divers'] || '🎒'}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <h4 className="font-bold text-xs text-[#1C2620] truncate">
                        {item.item}
                      </h4>
                      {item.quantity && item.quantity > 1 && (
                        <span className="px-1.5 py-0.2 bg-[#17402C]/10 text-[#17402C] text-[10px] font-mono font-bold rounded-md">
                          ×{item.quantity}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-[10px] font-mono text-[#5C6B5E] mt-0.5">
                      <span className="font-bold text-[#17402C]">
                        {item.weightGrams ? `${item.weightGrams}g` : item.weight || '—'}
                      </span>
                      <span>·</span>
                      <button
                        onClick={() => handleAssignToMe(item)}
                        disabled={busyId === item.id}
                        className={`truncate underline decoration-dotted ${
                          isMyAssignment ? 'text-emerald-700 font-bold' : isAssigned ? 'text-[#1C2620]' : 'text-[#D97746] font-semibold'
                        }`}
                        title="Cliquer pour changer l'attribution"
                      >
                        {isMyAssignment ? '👤 Porté par vous' : isAssigned ? `👤 ${item.assignee}` : '⚠️ Non attribué'}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => startEdit(item)}
                    className="p-1.5 text-[#5C6B5E] hover:text-[#1C2620] rounded-lg hover:bg-white transition-colors"
                    title="Modifier"
                  >
                    <Icon name="PencilSquareIcon" size={14} />
                  </button>
                  <button
                    onClick={() => handleDeleteItem(item.id)}
                    disabled={busyId === item.id}
                    className="p-1.5 text-red-400 hover:text-red-600 rounded-lg hover:bg-white transition-colors"
                    title="Supprimer"
                  >
                    <Icon name="TrashIcon" size={14} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="mt-4 pt-3 border-t border-[#1C2620]/8 flex items-center justify-between">
        <span className="text-[11px] font-mono text-[#5C6B5E]">Poids total du matériel partagé</span>
        <span className="font-mono font-bold text-sm text-[#17402C]">{totalKg} kg</span>
      </div>

      {isImporting && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#FAF9F5] border border-[#C8C3B0] rounded-[24px] w-full max-w-lg p-5 shadow-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-[#1C2620]/10">
              <div>
                <h3 className="font-display font-bold text-base text-[#1C2620]">Importer depuis mon kit</h3>
                <p className="text-[11px] text-[#5C6B5E]">Sélectionnez les objets à partager avec l'équipe</p>
              </div>
              <button onClick={() => setIsImporting(false)} className="text-sm font-bold text-[#5C6B5E]">✕</button>
            </div>

            <div className="my-2.5">
              <input
                type="text"
                value={personalSearch}
                onChange={e => setPersonalSearch(e.target.value)}
                placeholder="Filtrer mes équipements..."
                className="w-full bg-white border border-[#1C2620]/10 rounded-xl px-3 py-2 text-xs outline-none"
              />
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1 my-1">
              {personalItems
                .filter(g => !personalSearch || g.name.toLowerCase().includes(personalSearch.toLowerCase()))
                .map(gear => {
                  const isChecked = !!selectedGear[gear.id];
                  return (
                    <div
                      key={gear.id}
                      onClick={() => setSelectedGear(s => ({ ...s, [gear.id]: !s[gear.id] }))}
                      className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-2 ${
                        isChecked ? 'bg-[#17402C] text-white border-[#17402C]' : 'bg-white text-[#1C2620] border-[#1C2620]/8'
                      }`}
                    >
                      <div>
                        <h5 className="font-bold text-xs truncate">{gear.name}</h5>
                        <p className={`text-[10px] font-mono ${isChecked ? 'text-white/80' : 'text-[#5C6B5E]'}`}>
                          {gear.weight_g ? `${gear.weight_g}g` : '—'} · {gear.category || 'Divers'}
                        </p>
                      </div>
                      <span className={`w-5 h-5 rounded-md flex items-center justify-center text-xs font-bold ${
                        isChecked ? 'bg-white text-[#17402C]' : 'border border-[#1C2620]/20'
                      }`}>
                        {isChecked ? '✓' : ''}
                      </span>
                    </div>
                  );
                })}
            </div>

            <div className="pt-3 border-t border-[#1C2620]/10 flex justify-end gap-2">
              <button onClick={() => setIsImporting(false)} className="px-3 py-1.5 text-xs text-[#5C6B5E]">Annuler</button>
              <button
                onClick={executeImport}
                disabled={importingNow}
                className="px-4 py-1.5 bg-[#17402C] text-white rounded-xl text-xs font-bold shadow-sm"
              >
                {importingNow ? 'Importation...' : 'Importer la sélection'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}