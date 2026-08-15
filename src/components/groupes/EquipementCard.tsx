'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Icon from '@/components/ui/AppIcon';

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

export default function EquipementCard({ equipment, groupId, onRefresh, user, members }: EquipementCardProps) {
  const supabase = createClient();
  const router = useRouter();

  const [items, setItems] = useState<EquipementItem[]>(equipment);
  const [search, setSearch] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [newItemName, setNewItemName] = useState('');
  const [newItemWeight, setNewItemWeight] = useState('');
  const [newCategory, setNewCategory] = useState('Divers');
  const [newQuantity, setNewQuantity] = useState(1);
  const [assignedTo, setAssignedTo] = useState('');

  const [editForm, setEditForm] = useState({ name: '', weightGrams: '', category: '', quantity: 1, is_shared: true, notes: '', assigned_to: '' });

  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Personal inventory import state
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
    if (!newItemName.trim() || !groupId || !user) { showError("Nom, groupe et connexion requis"); return; }
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
        setNewItemName(''); setNewItemWeight(''); setNewCategory('Divers'); setNewQuantity(1); setAssignedTo('');
        setIsAdding(false);
        refresh();
      },
      "Erreur lors de l'ajout"
    );
    if (!ok) setLoading(false); else setLoading(false);
  };

  const handleUpdateItem = async (id: string) => {
    if (!groupId) return;
    setBusyId(id);
    const weightGrams = parseInt(editForm.weightGrams) || 0;
    const ok = await runOp(
      supabase.from('group_kit_items').update({
        name: editForm.name.trim(),
        weight_grams: weightGrams,
        category: editForm.category,
        quantity: editForm.quantity,
        is_shared: editForm.is_shared,
        notes: editForm.notes,
        assigned_to: editForm.assigned_to || null,
      }).eq('id', id),
      () => { setEditingId(null); showNotice('Objet mis à jour'); refresh(); },
      "Erreur de modification"
    );
    setBusyId(null);
    if (!ok) return;
  };

  const handleDeleteItem = async (id: string) => {
    if (!confirm('Retirer cet objet du kit partagé ?')) return;
    setBusyId(id);
    await runOp(
      supabase.from('group_kit_items').delete().eq('id', id),
      () => { setItems(prev => prev.filter(i => i.id !== id)); showNotice('Objet supprimé'); refresh(); },
      "Erreur de suppression"
    );
    setBusyId(null);
  };

  const handleQuantity = async (id: string, delta: number) => {
    const item = items.find(i => i.id === id);
    if (!item) return;
    const next = Math.max(0, (item.quantity || 1) + delta);
    if (next === (item.quantity || 1)) return;
    setItems(prev => prev.map(i => i.id === id ? { ...i, quantity: next } : i));
    const { error: e } = await supabase.from('group_kit_items').update({ quantity: next }).eq('id', id);
    if (e) {
      console.error(e);
      setItems(prev => prev.map(i => i.id === id ? { ...i, quantity: item.quantity } : i));
      showError("Erreur de mise à jour de la quantité");
    }
  };

  const handleToggleShared = async (id: string) => {
    const item = items.find(i => i.id === id);
    if (!item) return;
    const next = !item.is_shared;
    setItems(prev => prev.map(i => i.id === id ? { ...i, is_shared: next, status: next ? 'Confirmé' : 'À affecter', statusColor: next ? 'bg-[#E7E3D6] text-[#5C6B5E]' : 'bg-amber-100 text-amber-700' } : i));
    await runOp(
      supabase.from('group_kit_items').update({ is_shared: next }).eq('id', id),
      () => { if (onRefresh) onRefresh(); },
      "Erreur de mise à jour"
    );
  };

  // Open import modal + load personal inventory
  const openImport = () => {
    setIsImporting(true);
    setSelectedGear({});
    setPersonalItems([]);
    setPersonalSearch('');
    if (!user) { showError('Connectez-vous pour importer votre inventaire'); return; }
    supabase.from('gear_items').select('id, name, brand, category, weight_g, quantity')
      .eq('user_id', user.id)
      .then(({ data, error: e }) => {
        if (e) { console.error(e); showError("Impossible de charger votre inventaire"); return; }
        setPersonalItems((data as GearItem[]) ?? []);
      });
  };

  const handleImportSelected = async () => {
    const selected = personalItems.filter(g => selectedGear[g.id]);
    if (!groupId || selected.length === 0) return;
    setImportingNow(true);
    const existing = new Set(items.map(i => i.item.toLowerCase()));
    let inserted = 0;
    let skipped = 0;
    for (const g of selected) {
      if (existing.has(g.name.toLowerCase())) { skipped++; continue; }
      const { error: e } = await supabase.from('group_kit_items').insert({
        group_id: groupId,
        name: g.name,
        weight_grams: g.weight_g || 0,
        category: g.category || 'Divers',
        quantity: g.quantity || 1,
        is_shared: true,
        notes: `Importé depuis l'inventaire de ${members?.find(m => m.user_id === user?.id)?.user_profiles?.full_name || 'moi'}`,
      });
      if (e) { console.error(e); showError(`Erreur d'import de « ${g.name} »`); }
      else { inserted++; existing.add(g.name.toLowerCase()); }
    }
    setImportingNow(false);
    setIsImporting(false);
    if (inserted > 0) showNotice(skipped > 0 ? `${inserted} objet(s) importé(s) · ${skipped} déjà présent(s)` : `${inserted} objet(s) importé(s)`);
    else if (skipped > 0) showNotice(`${skipped} objet(s) déjà présent(s) — ignoré(s)`);
    else showNotice('Aucun objet importé');
    refresh();
  };

  const filteredItems = items.filter(i => {
    if (!search) return true;
    const q = search.toLowerCase();
    return i.item.toLowerCase().includes(q) || i.assignee.toLowerCase().includes(q) || (i.category || '').toLowerCase().includes(q);
  });

  const filteredPersonal = personalItems.filter(g => {
    if (!personalSearch) return true;
    return g.name.toLowerCase().includes(personalSearch.toLowerCase());
  });

  const unassignedCount = items.filter(e => e.assignee === 'Non attribué').length;
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
    <div className="bg-white rounded-[2rem] p-6 border border-[#1C2620]/10 shadow-sm">
      <div className="flex justify-between items-start mb-2">
        <h2 className="font-display text-xl text-[#1C2620]">Équipement <span className="font-serif italic font-bold">partagé</span></h2>
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] uppercase tracking-widest text-[#1C2620]/60 bg-[#1C2620]/5 px-2 py-0.5 rounded-full">{items.length} items</span>
          <span className="font-mono text-[10px] uppercase tracking-widest text-[#1C2620]/60 bg-[#1C2620]/5 px-2 py-0.5 rounded-full">{unassignedCount} non-attribués</span>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h2 className="text-lg font-bold text-[#1C2620]">Matériel commun & Équipement</h2>
          <p className="text-xs text-[#6B7A6E]">Répartissez les charges et vérifiez la préparation du groupe.</p>
        </div>

        {groupId && (
          <Link
            href={`/ai-configurator?groupId=${groupId}`}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#1C3829] text-white text-xs font-bold hover:bg-[#152B1F] transition-all shadow-md"
          >
            🤖 Configurer le sac du groupe avec l’IA →
          </Link>
        )}
      </div>

      {/* Search + actions */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Icon name="MagnifyingGlassIcon" size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#1C2620]/40" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher un objet, une personne, une catégorie..."
            className="w-full bg-[#F5F2E8] border border-[#1C2620]/10 rounded-xl pl-9 pr-4 py-2.5 text-sm text-[#1C2620] placeholder-[#1C2620]/40 focus:outline-none focus:ring-2 focus:ring-[#33463C]/20"
          />
        </div>
        <div className="flex gap-2 w-full sm:w-auto justify-end">
          <button
            onClick={openImport}
            className="px-3 py-2 rounded-full bg-[#1C2620]/5 text-[#1C2620] font-sans font-medium text-xs hover:bg-[#1C2620]/10 transition-colors flex items-center gap-1"
            title="Importer depuis votre inventaire personnel"
          >
            <Icon name="ArrowDownTrayIcon" size={12} /> Import kit
          </button>
          <button
            onClick={() => setIsAdding(!isAdding)}
            className="px-3 py-2 rounded-full bg-[#33463C] text-white font-sans font-medium text-xs hover:bg-[#33463C]/90 transition-colors flex items-center gap-1"
          >
            <Icon name={isAdding ? "XMarkIcon" : "PlusIcon"} size={12} /> {isAdding ? 'Annuler' : 'Ajouter'}
          </button>
        </div>
      </div>

      {/* Feedback */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-center gap-2">
          <Icon name="ExclamationTriangleIcon" size={16} /> {error}
        </div>
      )}
      {notice && (
        <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-700">
          {notice}
        </div>
      )}

      {/* Add form */}
      {isAdding && (
        <form onSubmit={handleAddItem} className="mb-6 bg-[#E7E3D6]/20 p-4 rounded-2xl border border-[#1C2620]/10">
          <div className="flex flex-wrap gap-3 mb-3">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-[10px] font-mono text-[#1C2620]/60 uppercase tracking-widest mb-1.5">Nom de l'objet</label>
              <input
                type="text" autoFocus value={newItemName}
                onChange={e => setNewItemName(e.target.value)}
                placeholder="Ex: Tente MSR..."
                className="w-full bg-white border border-[#1C2620]/10 rounded-xl py-2 px-4 text-sm text-[#1C2620] focus:outline-none focus:ring-2 focus:ring-[#33463C]/20"
                disabled={loading}
              />
            </div>
            <div className="w-24">
              <label className="block text-[10px] font-mono text-[#1C2620]/60 uppercase tracking-widest mb-1.5">Poids (g)</label>
              <input
                type="number" value={newItemWeight}
                onChange={e => setNewItemWeight(e.target.value)}
                placeholder="Ex: 450"
                className="w-full bg-white border border-[#1C2620]/10 rounded-xl py-2 px-4 text-sm text-[#1C2620] focus:outline-none focus:ring-2 focus:ring-[#33463C]/20"
                disabled={loading}
              />
            </div>
            <div className="w-24">
              <label className="block text-[10px] font-mono text-[#1C2620]/60 uppercase tracking-widest mb-1.5">Qté</label>
              <input
                type="number" min={1} value={newQuantity}
                onChange={e => setNewQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full bg-white border border-[#1C2620]/10 rounded-xl py-2 px-4 text-sm text-[#1C2620] focus:outline-none focus:ring-2 focus:ring-[#33463C]/20"
                disabled={loading}
              />
            </div>
            <div className="w-full sm:w-40">
              <label className="block text-[10px] font-mono text-[#1C2620]/60 uppercase tracking-widest mb-1.5">Porteur</label>
              <select
                value={assignedTo} onChange={e => setAssignedTo(e.target.value)}
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
            <div className="w-full sm:w-32">
              <label className="block text-[10px] font-mono text-[#1C2620]/60 uppercase tracking-widest mb-1.5">Catégorie</label>
              <input
                type="text" value={newCategory}
                onChange={e => setNewCategory(e.target.value)}
                className="w-full bg-white border border-[#1C2620]/10 rounded-xl py-2 px-4 text-sm text-[#1C2620] focus:outline-none focus:ring-2 focus:ring-[#33463C]/20"
                disabled={loading}
              />
            </div>
          </div>
          <div className="flex justify-end mt-2">
            <button
              type="submit"
              disabled={!newItemName.trim() || loading}
              className="px-6 py-2 bg-[#1C2620] text-white rounded-xl text-xs font-semibold disabled:opacity-50"
            >
              {loading ? 'Enregistrement...' : 'Sauvegarder l\'objet'}
            </button>
          </div>
        </form>
      )}

      {/* Edit form */}
      {editingId && (
        <div className="mb-6 bg-[#EAF0EB] p-4 rounded-2xl border border-[#2D5A3D]/20">
          <div className="flex items-center justify-between mb-3">
            <label className="block text-[10px] font-mono text-[#1C2620]/60 uppercase tracking-widest">Modifier l'objet</label>
            <button onClick={() => setEditingId(null)} className="text-[#1C2620]/50 hover:text-[#1C2620]">
              <Icon name="XMarkIcon" size={16} />
            </button>
          </div>
          <div className="flex flex-wrap gap-3 mb-3">
            <input type="text" value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} placeholder="Nom" className="flex-1 min-w-[160px] bg-white border border-[#1C2620]/10 rounded-xl py-2 px-4 text-sm focus:outline-none" />
            <input type="number" value={editForm.weightGrams} onChange={e => setEditForm(f => ({ ...f, weightGrams: e.target.value }))} placeholder="Poids (g)" className="w-28 bg-white border border-[#1C2620]/10 rounded-xl py-2 px-4 text-sm focus:outline-none" />
            <input type="number" min={1} value={editForm.quantity} onChange={e => setEditForm(f => ({ ...f, quantity: Math.max(1, parseInt(e.target.value) || 1) }))} placeholder="Qté" className="w-20 bg-white border border-[#1C2620]/10 rounded-xl py-2 px-4 text-sm focus:outline-none" />
            <input type="text" value={editForm.category} onChange={e => setEditForm(f => ({ ...f, category: e.target.value }))} placeholder="Catégorie" className="w-32 bg-white border border-[#1C2620]/10 rounded-xl py-2 px-4 text-sm focus:outline-none" />
            <select value={editForm.assigned_to} onChange={e => setEditForm(f => ({ ...f, assigned_to: e.target.value }))} className="w-44 bg-white border border-[#1C2620]/10 rounded-xl py-2 px-4 text-sm focus:outline-none">
              <option value="">Non attribué</option>
              {members?.map(m => (
                <option key={m.user_id} value={m.user_id}>{m.user_profiles?.full_name || 'Membre'}</option>
              ))}
            </select>
          </div>
          <textarea value={editForm.notes} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} rows={1} placeholder="Notes (optionnel)" className="w-full mb-3 bg-white border border-[#1C2620]/10 rounded-xl py-2 px-4 text-sm focus:outline-none resize-none" />
          <div className="flex items-center justify-between">
            <button
              onClick={() => setEditForm(f => ({ ...f, is_shared: !f.is_shared }))}
              className={`flex items-center gap-2 text-xs font-semibold px-3 py-2 rounded-xl border transition-colors ${editForm.is_shared ? 'bg-[#33463C]/10 text-[#33463C] border-[#33463C]/30' : 'bg-[#1C2620]/5 text-[#1C2620]/60 border-[#1C2620]/10'}`}
            >
              <span className={`w-8 h-4 rounded-full relative transition-colors ${editForm.is_shared ? 'bg-[#33463C]' : 'bg-[#C8C3B0]'}`}>
                <span className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${editForm.is_shared ? 'left-4' : 'left-0.5'}`} />
              </span>
              {editForm.is_shared ? 'Confirmé / partagé' : 'À affecter'}
            </button>
            <button onClick={() => handleUpdateItem(editingId)} disabled={busyId === editingId || !editForm.name.trim()} className="px-5 py-2 bg-[#1C2620] text-white rounded-xl text-xs font-semibold disabled:opacity-50">
              {busyId === editingId ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[640px]">
          <thead>
            <tr className="border-b-2 border-[#1C2620]/15 bg-[#F5F2E8]/60">
              <th className="py-3 px-2 font-mono text-[10px] uppercase tracking-widest text-[#33463C] font-bold">Objet</th>
              <th className="py-3 px-2 font-mono text-[10px] uppercase tracking-widest text-[#33463C] font-bold">Qté</th>
              <th className="py-3 px-2 font-mono text-[10px] uppercase tracking-widest text-[#33463C] font-bold w-1/5">Apporté par</th>
              <th className="py-3 px-2 font-mono text-[10px] uppercase tracking-widest text-[#33463C] font-bold w-20">Poids</th>
              <th className="py-3 px-2 font-mono text-[10px] uppercase tracking-widest text-[#33463C] font-bold w-32">Statut</th>
              <th className="py-3 px-2 w-24"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1C2620]/10">
            {filteredItems.length === 0 && (
              <tr>
                <td colSpan={6} className="py-10 px-4">
                  <div className="flex flex-col items-center text-center gap-3">
                    <div className="w-16 h-16 rounded-full bg-[#EDEAE0] flex items-center justify-center text-3xl">
                      {search ? '🔍' : '🎒'}
                    </div>
                    <div>
                      <p className="font-display font-semibold text-[#1C2620]">
                        {search ? 'Aucun objet trouvé' : 'Aucun équipement partagé'}
                      </p>
                      <p className="text-xs text-[#6B7A72] mt-1">
                        {search
                          ? `Aucun objet ne correspond à « ${search} ».`
                          : 'Ajoutez le premier objet au kit partagé, ou importez depuis votre inventaire.'}
                      </p>
                    </div>
                    {!search && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setIsAdding(true)}
                          className="px-4 py-2 rounded-full bg-[#33463C] text-white text-xs font-semibold hover:bg-[#33463C]/90 transition-colors"
                        >
                          + Ajouter un objet
                        </button>
                        <button
                          onClick={openImport}
                          className="px-4 py-2 rounded-full border border-[#C8C3B0] text-[#1C2620] text-xs font-semibold hover:bg-[#EDEAE0] transition-colors"
                        >
                          Importer mon kit
                        </button>
                      </div>
                    )}
                  </div>
                </td>
              </tr>
            )}
            {filteredItems.map((item) => (
              <tr key={item.id} className="group hover:bg-[#E7E3D6]/20 transition-colors">
                <td className="py-3 px-2">
                  <p className="font-sans font-medium text-sm text-[#1C2620]">{item.item}</p>
                  {item.notes && <p className="text-xs text-[#1C2620]/50">{item.notes}</p>}
                  {item.category && item.category !== 'Divers' && (
                    <span className="text-[10px] font-mono text-[#1C2620]/40 uppercase tracking-widest">{item.category}</span>
                  )}
                </td>
                <td className="py-3 px-2">
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={() => handleQuantity(item.id, -1)} className="w-6 h-6 rounded-md bg-[#1C2620]/5 hover:bg-[#1C2620]/10 text-xs font-bold disabled:opacity-40" disabled={(item.quantity || 1) <= 0}>−</button>
                    <span className="w-8 text-center font-mono text-sm">{item.quantity || 1}</span>
                    <button type="button" onClick={() => handleQuantity(item.id, 1)} className="w-6 h-6 rounded-md bg-[#1C2620]/5 hover:bg-[#1C2620]/10 text-xs font-bold">+</button>
                  </div>
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
                  <button
                    type="button"
                    onClick={() => handleToggleShared(item.id)}
                    className={`inline-block px-2.5 py-1 rounded-sm font-mono text-[9px] uppercase tracking-widest ${item.statusColor} cursor-pointer hover:opacity-80`}
                    title="Basculer le statut"
                  >
                    {item.status}
                  </button>
                </td>
                <td className="py-3 px-2 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <button type="button" onClick={() => startEdit(item)} className="p-1.5 text-[#1C2620]/30 hover:text-[#17402C] transition-colors" title="Modifier">
                      <Icon name="PencilIcon" size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteItem(item.id)}
                      className="p-1.5 text-[#1C2620]/30 hover:text-red-500 transition-colors"
                      title="Supprimer"
                      disabled={busyId === item.id}
                    >
                      <Icon name="TrashIcon" size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-6 pt-4 border-t border-[#1C2620]/10 flex items-center justify-between">
        <span className="text-sm text-[#1C2620]/60 font-sans">Poids total du matériel partagé</span>
        <span className="font-mono font-bold text-lg text-[#1C2620]">{totalKg} kg</span>
      </div>

      {/* Import modal */}
      {isImporting && (
        <div className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] w-full max-w-lg max-h-[85vh] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-[#1C2620]/10">
              <h3 className="font-display text-lg text-[#1C2620]">Importer depuis mon <span className="font-serif italic font-bold">inventaire</span></h3>
              <button onClick={() => setIsImporting(false)} className="text-[#1C2620]/50 hover:text-[#1C2620]"><Icon name="XMarkIcon" size={20} /></button>
            </div>
            <div className="p-6 overflow-y-auto flex-1 space-y-3">
              <div className="relative">
                <Icon name="MagnifyingGlassIcon" size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#1C2620]/40" />
                <input
                  value={personalSearch}
                  onChange={e => setPersonalSearch(e.target.value)}
                  placeholder="Rechercher dans mon inventaire..."
                  className="w-full bg-[#F5F2E8] border border-[#1C2620]/10 rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none"
                />
              </div>
              {filteredPersonal.length === 0 ? (
                <p className="text-center text-sm text-[#1C2620]/50 py-8">
                  {personalItems.length === 0 ? 'Votre inventaire personnel est vide.' : 'Aucun élément ne correspond à votre recherche.'}
                </p>
              ) : (
                filteredPersonal.map(g => (
                  <label key={g.id} className="flex items-center gap-3 p-3 rounded-xl border border-[#1C2620]/10 hover:border-[#1C2620]/30 cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      checked={!!selectedGear[g.id]}
                      onChange={() => setSelectedGear(prev => ({ ...prev, [g.id]: !prev[g.id] }))}
                      className="w-4 h-4 accent-[#33463C]"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[#1C2620] truncate">{g.name}</p>
                      <p className="text-[11px] text-[#1C2620]/50">
                        {g.category || 'autre'} · {g.weight_g ? `${(g.weight_g / 1000).toFixed(2)} kg` : 'poids inconnu'} · qty {g.quantity ?? 1}
                      </p>
                    </div>
                  </label>
                ))
              )}
            </div>
            <div className="p-6 border-t border-[#1C2620]/10 flex gap-3">
              <button onClick={() => setIsImporting(false)} className="px-4 py-2.5 rounded-xl border border-[#1C2620]/10 text-sm font-medium text-[#1C2620]/70 hover:bg-[#1C2620]/5">
                Annuler
              </button>
              <button
                onClick={handleImportSelected}
                disabled={importingNow || Object.values(selectedGear).filter(Boolean).length === 0}
                className="flex-1 py-2.5 rounded-xl bg-[#1C2620] text-white text-sm font-semibold disabled:opacity-50"
              >
                {importingNow ? 'Import en cours...' : `Importer ${Object.values(selectedGear).filter(Boolean).length} objet(s)`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}