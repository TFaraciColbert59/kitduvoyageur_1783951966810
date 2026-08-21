'use client';
import { Reorder } from 'framer-motion';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/contexts/ToastContext';
import type { InventoryItem } from '@/features/materiel/services/getInventory';

/** W-K-4 KitBuilder — drag & drop inventaire → kit en cours + enregistrement Supabase. */
export function KitBuilder({
  inventory, initialKitItems, onDrop,
}: { inventory: InventoryItem[]; initialKitItems: InventoryItem[]; onDrop?: (item: InventoryItem) => void }) {
  const router = useRouter();
  const { toast } = useToast();
  const [kitItems, setKitItems] = useState(initialKitItems);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  const handleDrop = (item: InventoryItem) => {
    onDrop?.(item);
    setKitItems((prev) => (prev.some((i) => i.id === item.id) ? prev : [...prev, item]));
  };

  const save = async () => {
    if (!name.trim()) { toast('Nom du kit requis', 'error'); return; }
    if (kitItems.length === 0) { toast('Ajoutez au moins un article', 'error'); return; }
    setSaving(true);
    try {
      const items = kitItems.map((i) => ({
        product_ownership_id: i.id,
        name: i.name,
        category: i.category ?? 'Autre',
        weight_g: i.weight_g ?? 0,
        quantity: 1,
        is_checked: false,
      }));
      const res = await fetch('/api/materiel/kits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), season: 'toute_saison', description: null, items }),
      });
      if (!res.ok) throw new Error('Erreur');
      toast('Kit créé ✓', 'success');
      setName(''); setKitItems([]);
      router.refresh();
    } catch {
      toast('Erreur de création', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="bg-white/20 rounded-[var(--r-md)] p-3">
        <p className="text-sm font-medium mb-2">Inventaire</p>
        <ul className="flex flex-col gap-1 max-h-[420px] overflow-y-auto">
          {inventory.map((item) => (
            <li
              key={item.id}
              draggable
              onDragStart={(e) => e.dataTransfer.setData('itemId', item.id)}
              className="bg-white/20 rounded-[var(--r-sm)] p-2 text-sm cursor-grab"
            >
              {item.name}
            </li>
          ))}
        </ul>
      </div>
      <div className="bg-white/20 rounded-[var(--r-md)] p-3">
        <p className="text-sm font-medium mb-2">Kit en cours ({kitItems.length})</p>
        <Reorder.Group axis="y" values={kitItems} onReorder={setKitItems} className="flex flex-col gap-1 min-h-[120px]">
          {kitItems.map((item) => (
            <Reorder.Item key={item.id} value={item} className="bg-white/20 rounded-[var(--r-sm)] p-2 text-sm">
              {item.name}
            </Reorder.Item>
          ))}
          {kitItems.length === 0 && (
            <li className="text-xs text-[color:var(--label-tertiary)] p-2">Glissez des articles de l’inventaire ici.</li>
          )}
        </Reorder.Group>
        <div className="mt-3 flex flex-col gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nom du kit (ex: Trek Alpes)"
            aria-label="Nom du kit"
            className="glass-input"
          />
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="glass interactive h-11 rounded-full text-sm font-medium text-white bg-sage-800 disabled:opacity-40"
          >
            {saving ? 'Enregistrement…' : 'Enregistrer ce kit'}
          </button>
        </div>
      </div>
    </div>
  );
}
