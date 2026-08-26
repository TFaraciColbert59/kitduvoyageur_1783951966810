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
    <div className="glass p-4 sm:p-6 transition-all duration-300">
      <div className="flex flex-col gap-2 mb-4">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[10px] font-mono uppercase tracking-widest text-[#5C6B5E] font-bold">Kit collaboratif</span>
            <h2 className="font-display text-lg sm:text-xl text-[#17402C] font-bold">
              Équipement <em className="font-serif italic font-normal text-[#17402C]">partagé</em>
            </h2>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="glass-pill">{items.length} items</span>
            <span className="glass-pill pill-warn">{unassignedCount} libres</span>
          </div>
        </div>

        {groupId && (
          <Link
            href={`/ai-configurator?groupId=${groupId}`}
            className="w-full mt-1 p-3 rounded-2xl glass-sub-card text-[#17402C] text-xs font-bold flex items-center justify-between transition-transform"
          >
            <span className="flex items-center gap-2">
              <span>🎒</span>
              <span>Optimiser le sac avec l'IA</span>
            </span>
            <span className="text-[#17402C] text-xs">Configurer →</span>
          </Link>
        )}
      </div>

      <div className="flex items-center gap-2 mb-3">
        <div className="flex-1 relative flex items-center">
          <Icon name="MagnifyingGlassIcon" size={14} className="absolute left-3 text-[#5C6B5E] shrink-0 relative z-10" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Chercher un objet, un porteur..."
            className="glass-input w-full pl-9 pr-8 text-xs min-h-[36px]"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2 text-xs text-[#5C6B5E] px-1">✕</button>
          )}
        </div>

        <button
          onClick={openImport}
          className="glass-capsule-btn py-2 px-3 text-xs font-bold flex items-center gap-1 shrink-0"
          title="Importer depuis mon kit"
        >
          <Icon name="ArrowDownTrayIcon" size={12} className="relative z-10" />
          <span className="hidden sm:inline relative z-10">Mon kit</span>
        </button>

        <button
          onClick={() => {
            triggerHaptic('light');
            setIsAdding(!isAdding);
          }}
          className="glass-capsule-btn primary py-2 px-3 text-xs font-bold flex items-center gap-1 shrink-0"
        >
          <span className="relative z-10">{isAdding ? '✕' : '+'}</span>
          <span className="relative z-10">{isAdding ? 'Fermer' : 'Ajouter'}</span>
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
              className={`glass-pill cursor-pointer whitespace-nowrap ${isSelected ? 'bg-[#17402C] text-white' : ''}`}
            >
              <span>{CATEGORY_EMOJI[cat] || '🎒'}</span>
              <span>{cat}</span>
            </button>
          );
        })}
      </div>

      {error && (
        <div className="mb-3 p-2.5 glass-sub-card rounded-xl text-xs text-red-700 flex items-center gap-2">
          <Icon name="ExclamationTriangleIcon" size={14} className="relative z-10" /> {error}
        </div>
      )}
      {notice && (
        <div className="mb-3 p-2.5 glass-sub-card rounded-xl text-xs text-emerald-800 font-semibold">
          {notice}
        </div>
      )}

      {isAdding && (
        <form onSubmit={handleAddItem} className="mb-4 glass-sub-card p-4 rounded-2xl space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-[#17402C]">Ajouter un équipement commun</h4>
            <span className="text-[10px] font-mono text-[#5C6B5E] font-bold">Kit partagé</span>
          </div>

          <div className="space-y-2">
            <input
              type="text"
              autoFocus
              value={newItemName}
              onChange={e => setNewItemName(e.target.value)}
              placeholder="Ex: Tente MSR Hubba Hubba 2P..."
              className="glass-input w-full text-xs"
            />

            <div className="grid grid-cols-3 gap-2">
              <input
                type="number"
                value={newItemWeight}
                onChange={e => setNewItemWeight(e.target.value)}
                placeholder="Poids (g)"
                className="glass-input text-xs min-h-[36px]"
              />
              <input
                type="number"
                min={1}
                value={newQuantity}
                onChange={e => setNewQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                placeholder="Qté"
                className="glass-input text-xs min-h-[36px]"
              />
              <select
                value={newCategory}
                onChange={e => setNewCategory(e.target.value)}
                className="glass-input text-xs min-h-[36px]"
              >
                {categories.filter(c => c !== 'Tout').map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <select
              value={assignedTo}
              onChange={e => setAssignedTo(e.target.value)}
              className="glass-input w-full text-xs"
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
              className="glass-capsule-btn text-xs font-semibold py-1.5 px-3"
            >
              <span className="relative z-10">Annuler</span>
            </button>
            <button
              type="submit"
              disabled={!newItemName.trim() || loading}
              className="glass-capsule-btn primary text-xs font-bold py-1.5 px-4 disabled:opacity-50"
            >
              <span className="relative z-10">{loading ? 'Ajout...' : 'Sauvegarder'}</span>
            </button>
          </div>
        </form>
      )}

      {editingId && (
        <div className="mb-4 glass-sub-card p-4 rounded-2xl space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-[#17402C]">Modifier l'équipement</h4>
            <button onClick={() => setEditingId(null)} className="text-xs text-[#5C6B5E]">✕</button>
          </div>

          <input
            type="text"
            value={editForm.name}
            onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
            className="glass-input w-full text-xs"
          />

          <div className="grid grid-cols-3 gap-2">
            <input
              type="number"
              value={editForm.weightGrams}
              onChange={e => setEditForm(f => ({ ...f, weightGrams: e.target.value }))}
              placeholder="Poids (g)"
              className="glass-input text-xs min-h-[36px]"
            />
            <input
              type="number"
              min={1}
              value={editForm.quantity}
              onChange={e => setEditForm(f => ({ ...f, quantity: Math.max(1, parseInt(e.target.value) || 1) }))}
              placeholder="Qté"
              className="glass-input text-xs min-h-[36px]"
            />
            <select
              value={editForm.assigned_to}
              onChange={e => setEditForm(f => ({ ...f, assigned_to: e.target.value }))}
              className="glass-input text-xs min-h-[36px]"
            >
              <option value="">Non attribué</option>
              {members?.map(m => (
                <option key={m.user_id} value={m.user_id}>{m.user_profiles?.full_name || 'Membre'}</option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-2">
            <button onClick={() => setEditingId(null)} className="glass-capsule-btn py-1.5 px-3 text-xs font-semibold">
              <span className="relative z-10">Annuler</span>
            </button>
            <button onClick={() => handleUpdateItem(editingId)} className="glass-capsule-btn primary py-1.5 px-4 text-xs font-bold">
              <span className="relative z-10">Enregistrer</span>
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2.5">
        {filteredItems.length === 0 ? (
          <div className="py-8 text-center glass-sub-card rounded-2xl p-4">
            <span className="text-3xl block mb-1">🎒</span>
            <p className="text-xs font-bold text-[#17402C]">
              {search ? 'Aucun objet trouvé' : 'Aucun équipement dans cette catégorie'}
            </p>
            <p className="text-[11px] text-[#5C6B5E] mt-0.5">
              Ajoutez les éléments clés du bivouac pour équilibrer les sacs.
            </p>
            {!search && (
              <button
                onClick={() => setIsAdding(true)}
                className="mt-3 glass-capsule-btn primary py-1.5 px-4 text-xs font-bold"
              >
                <span className="relative z-10">+ Ajouter un objet</span>
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
                className="glass-sub-card rounded-2xl p-3 flex items-center justify-between gap-3 transition-all"
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <div className="w-9 h-9 rounded-xl glass-sub-card flex items-center justify-center text-base shrink-0">
                    {CATEGORY_EMOJI[item.category || 'Divers'] || '🎒'}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <h4 className="font-bold text-xs text-[#17402C] truncate">
                        {item.item}
                      </h4>
                      {item.quantity && item.quantity > 1 && (
                        <span className="glass-pill text-[10px]">
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
                          isMyAssignment ? 'text-emerald-700 font-bold' : isAssigned ? 'text-[#17402C]' : 'text-[#D97746] font-semibold'
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
                    className="glass-capsule-btn p-1.5"
                    title="Modifier"
                  >
                    <Icon name="PencilSquareIcon" size={14} className="relative z-10" />
                  </button>
                  <button
                    onClick={() => handleDeleteItem(item.id)}
                    disabled={busyId === item.id}
                    className="glass-capsule-btn p-1.5 text-red-600"
                    title="Supprimer"
                  >
                    <Icon name="TrashIcon" size={14} className="relative z-10" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="mt-4 pt-3 border-t border-[#17402C]/10 flex items-center justify-between">
        <span className="text-[11px] font-mono text-[#5C6B5E] font-bold">Poids total du matériel partagé</span>
        <span className="font-mono font-bold text-sm text-[#17402C]">{totalKg} kg</span>
      </div>

      {isImporting && (
        <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass w-full max-w-lg p-5 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-[#17402C]/10">
              <div>
                <h3 className="font-display font-bold text-base text-[#17402C]">Importer depuis mon kit</h3>
                <p className="text-[11px] text-[#5C6B5E]">Sélectionnez les objets à partager avec l'équipe</p>
              </div>
              <button onClick={() => setIsImporting(false)} className="glass-capsule-btn p-2 text-xs font-bold">
                <span className="relative z-10">✕</span>
              </button>
            </div>

            <div className="my-2.5">
              <input
                type="text"
                value={personalSearch}
                onChange={e => setPersonalSearch(e.target.value)}
                placeholder="Filtrer mes équipements..."
                className="glass-input w-full text-xs"
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
                        isChecked ? 'bg-[#17402C] text-white border-[#17402C]' : 'glass-sub-card text-[#17402C]'
                      }`}
                    >
                      <div>
                        <h5 className="font-bold text-xs truncate">{gear.name}</h5>
                        <p className={`text-[10px] font-mono ${isChecked ? 'text-white/80' : 'text-[#5C6B5E]'}`}>
                          {gear.weight_g ? `${gear.weight_g}g` : '—'} · {gear.category || 'Divers'}
                        </p>
                      </div>
                      <span className={`w-5 h-5 rounded-md flex items-center justify-center text-xs font-bold ${
                        isChecked ? 'bg-white text-[#17402C]' : 'border border-[#17402C]/20'
                      }`}>
                        {isChecked ? '✓' : ''}
                      </span>
                    </div>
                  );
                })}
            </div>

            <div className="pt-3 border-t border-[#17402C]/10 flex justify-end gap-2">
              <button onClick={() => setIsImporting(false)} className="glass-capsule-btn py-1.5 px-3 text-xs font-semibold">
                <span className="relative z-10">Annuler</span>
              </button>
              <button
                onClick={executeImport}
                disabled={importingNow}
                className="glass-capsule-btn primary py-1.5 px-4 text-xs font-bold"
              >
                <span className="relative z-10">{importingNow ? 'Importation...' : 'Importer la sélection'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
