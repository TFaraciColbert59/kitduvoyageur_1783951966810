'use client';
import { lkvConfirm } from '@/components/ui/dialogs';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Card, Modal } from '@/components/ui';
import { Eyebrow } from '@/components/ui/Eyebrow';
import { useToast } from '@/contexts/ToastContext';
import type { KitListItem } from '@/features/materiel/services/getKits';
import type { InventoryItem } from '@/features/materiel/services/getInventory';

const SEASONS = ['printemps', 'ete', 'automne', 'hiver', 'toute_saison'];

const FIELD_CLASS =
  'min-h-[var(--control-height-md)] rounded-[var(--lkv-radius-control)] border border-[color:var(--lkv-border)] bg-[color:var(--lkv-field-bg)] px-[var(--space-3)] text-[length:var(--lkv-text-body-sm)] text-[var(--lkv-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--lkv-focus-ring)]';

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
    if (!(await lkvConfirm(`Supprimer le kit « ${k.name} » ?`))) return;
    const res = await fetch(`/api/materiel/kits/${k.id}`, { method: 'DELETE' });
    if (res.ok) { toast('Kit supprimé', 'success'); router.refresh(); }
    else toast('Erreur', 'error');
  };

  return (
    <Card tone="sage" className="p-4 sm:p-5" ariaLabelledBy="kit-manager-title">
      <div className="flex items-center justify-between">
        <Eyebrow>Gestion des kits</Eyebrow>
        <Button size="sm" onClick={openCreate}>
          + Nouveau kit
        </Button>
      </div>

      <Modal open={open} onOpenChange={setOpen} title={editing ? 'Modifier le kit' : 'Nouveau kit'}>
        <div className="flex flex-col gap-3.5">
          <label className="flex flex-col gap-1 text-xs sm:text-sm">
            <span className="font-semibold text-[var(--lkv-primary-soft)]">Nom *</span>
            <input className={FIELD_CLASS} value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-xs sm:text-sm">
            <span className="font-semibold text-[var(--lkv-primary-soft)]">Saison</span>
            <select className={FIELD_CLASS} value={season} onChange={(e) => setSeason(e.target.value)}>
              {SEASONS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs sm:text-sm">
            <span className="font-semibold text-[var(--lkv-primary-soft)]">Description</span>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} className={FIELD_CLASS} rows={2} />
          </label>
          <div>
            <p className="mb-1.5 text-xs font-semibold text-[var(--lkv-primary-soft)] sm:text-sm">Articles ({selectedItems.size})</p>
            <ul className="flex max-h-64 flex-col gap-1.5 overflow-y-auto">
              {inventory.map((i) => (
                <li key={i.id}>
                  <Card variant="compact" className="p-2">
                    <label className="flex cursor-pointer items-center gap-2 text-xs text-[var(--lkv-primary)] sm:text-sm">
                      <input className="rounded border-[color:var(--lkv-border)]" type="checkbox" checked={selectedItems.has(i.id)} onChange={() => toggleItem(i.id)} />
                      <span className="truncate">{i.name}</span>
                    </label>
                  </Card>
                </li>
              ))}
            </ul>
          </div>
          <Button onClick={save} loading={saving} fullWidth size="lg" className="mt-2">
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </Button>
        </div>
      </Modal>
    </Card>
  );
}
