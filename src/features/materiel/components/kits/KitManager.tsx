'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { GlassCard } from '@/components/ui/GlassCard';
import { Eyebrow } from '@/components/ui/Eyebrow';
import { GlassDrawer } from '@/components/ui/GlassDrawer';
import { useToast } from '@/contexts/ToastContext';
import type { KitListItem } from '@/features/materiel/services/getKits';
import type { InventoryItem } from '@/features/materiel/services/getInventory';

const SEASONS = ['printemps', 'ete', 'automne', 'hiver', 'toute_saison'];

/** W-K — gestion CRUD des kits (créer / éditer / supprimer), connecté Supabase en Liquid Glass. */
export function KitManager({ kits, inventory }: { kits: KitListItem[]; inventory: InventoryItem[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<KitListItem | null>(null);
  const [name, setName] = useState('');
  const [season, setSeason] = useState('toute_saison');
  const [description, setDescription] = useState('');
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const openCreate = () => {
    setEditing(null); setName(''); setSeason('toute_saison'); setDescription(''); setSelectedItems(new Set()); setOpen(true);
  };
  const openEdit = (k: KitListItem) => {
    setEditing(k); setName(k.name); setSeason(k.season ?? 'toute_saison'); setDescription(k.description ?? '');
    setSelectedItems(new Set());
    setOpen(true);
  };

  const toggleItem = (id: string) => {
    setSelectedItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const save = async () => {
    if (!name.trim()) { toast('Nom requis', 'error'); return; }
    setSaving(true);
    const selected = inventory.filter((i) => selectedItems.has(i.id));
    const items = selected.map((i) => ({
      product_ownership_id: i.id,
      name: i.name,
      category: i.category ?? 'Autre',
      weight_g: i.weight_g ?? 0,
      quantity: 1,
      is_checked: false,
    }));
    const payload = { name: name.trim(), season, description: description || null, items };
    try {
      const url = editing ? `/api/materiel/kits/${editing.id}` : '/api/materiel/kits';
      const res = await fetch(url, {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Erreur');
      toast(editing ? 'Kit modifié' : 'Kit créé', 'success');
      setOpen(false);
      router.refresh();
    } catch {
      toast('Erreur', 'error');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (k: KitListItem) => {
    if (!confirm(`Supprimer le kit « ${k.name} » ?`)) return;
    const res = await fetch(`/api/materiel/kits/${k.id}`, { method: 'DELETE' });
    if (res.ok) { toast('Kit supprimé', 'success'); router.refresh(); }
    else toast('Erreur', 'error');
  };

  return (
    <GlassCard tone="sage" className="p-4 sm:p-5" aria-labelledby="kit-manager-title">
      <div className="flex items-center justify-between">
        <Eyebrow>Gestion des kits</Eyebrow>
        <button
          type="button"
          onClick={openCreate}
          className="glass-capsule-btn primary"
        >
          + Nouveau kit
        </button>
      </div>

      <GlassDrawer open={open} onOpenChange={setOpen} title={editing ? 'Modifier le kit' : 'Nouveau kit'}>
        <div className="flex flex-col gap-3.5">
          <label className="flex flex-col gap-1 text-xs sm:text-sm">
            <span className="font-semibold text-[#365233]">Nom *</span>
            <input value={name} onChange={(e) => setName(e.target.value)} className="glass-input text-[#17402C]" />
          </label>
          <label className="flex flex-col gap-1 text-xs sm:text-sm">
            <span className="font-semibold text-[#365233]">Saison</span>
            <select value={season} onChange={(e) => setSeason(e.target.value)} className="glass-input text-[#17402C]">
              {SEASONS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs sm:text-sm">
            <span className="font-semibold text-[#365233]">Description</span>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="glass-input text-[#17402C]" rows={2} />
          </label>
          <div>
            <p className="text-xs sm:text-sm font-semibold text-[#365233] mb-1.5">Articles ({selectedItems.size})</p>
            <ul className="max-h-64 overflow-y-auto flex flex-col gap-1.5">
              {inventory.map((i) => (
                <li key={i.id} className="glass-sub-card p-2 rounded-xl">
                  <label className="flex items-center gap-2 text-xs sm:text-sm text-[#17402C] cursor-pointer">
                    <input type="checkbox" checked={selectedItems.has(i.id)} onChange={() => toggleItem(i.id)} className="rounded border-white/40" />
                    <span className="truncate">{i.name}</span>
                  </label>
                </li>
              ))}
            </ul>
          </div>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="glass-capsule-btn primary w-full justify-center h-11 mt-2"
          >
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </GlassDrawer>
    </GlassCard>
  );
}
