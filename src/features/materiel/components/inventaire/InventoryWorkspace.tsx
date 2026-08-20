'use client';
import { useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { GlassCard } from '@/components/ui/GlassCard';
import { Eyebrow } from '@/components/ui/Eyebrow';
import { Badge } from '@/components/ui/Badge';
import { GlassDrawer } from '@/components/ui/GlassDrawer';
import { useToast } from '@/contexts/ToastContext';
import type { InventoryItem } from '@/features/materiel/services/getInventory';
import { InventoryVirtualGrid } from './InventoryVirtualGrid';

type View = 'grid' | 'table';

interface ItemFormState {
  name: string;
  brand: string;
  category: string;
  weight_g: string;
  price_cents: string;
  condition: string;
}

const CATEGORIES = ['Sacs & Portage', 'Couchage & Tentes', 'Vêtements & Vestes', 'Cuisine & Réchauds', 'Eau & Filtres', 'Lampes & Éclairage', 'Navigation & GPS', 'Sécurité & Soins', 'Accessoires & Outils', 'Autre'];
const CONDITIONS = ['neuf', 'bon', 'use', 'a_remplacer', 'pour_pieces'];

const EMPTY_FORM: ItemFormState = { name: '', brand: '', category: 'Autre', weight_g: '', price_cents: '', condition: 'bon' };

function toForm(i: InventoryItem): ItemFormState {
  return {
    name: i.name, brand: i.brand ?? '', category: i.category ?? 'Autre',
    weight_g: i.weight_g != null ? String(i.weight_g) : '', price_cents: i.price_cents != null ? String(i.price_cents) : '',
    condition: i.condition ?? 'bon',
  };
}

/** W-I-2..W-I-7 — workspace inventaire avec CRUD complet (connecté Supabase). */
export function InventoryWorkspace({ items }: { items: InventoryItem[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [lentOnly, setLentOnly] = useState(false);
  const [view, setView] = useState<View>('grid');
  const [sort, setSort] = useState<'recent' | 'weight' | 'price'>('recent');
  const [selected, setSelected] = useState<InventoryItem | null>(null);
  const [cmpA, setCmpA] = useState('');
  const [cmpB, setCmpB] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<InventoryItem | null>(null);
  const [form, setForm] = useState<ItemFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const categories = useMemo(() => Array.from(new Set(items.map((i) => i.category).filter(Boolean))) as string[], [items]);

  const filtered = useMemo(() => {
    let list = items.filter((i) => {
      if (lentOnly && !i.is_lent) return false;
      if (category !== 'all' && i.category !== category) return false;
      if (query && !`${i.name} ${i.brand ?? ''} ${i.category ?? ''}`.toLowerCase().includes(query.toLowerCase())) return false;
      return true;
    });
    if (sort === 'weight') list = [...list].sort((a, b) => (b.weight_g ?? 0) - (a.weight_g ?? 0));
    else if (sort === 'price') list = [...list].sort((a, b) => (b.price_cents ?? 0) - (a.price_cents ?? 0));
    return list;
  }, [items, query, category, lentOnly, sort]);

  const cmpAItem = items.find((i) => i.id === cmpA);
  const cmpBItem = items.find((i) => i.id === cmpB);

  const openCreate = () => { setEditing(null); setForm(EMPTY_FORM); setFormOpen(true); };
  const openEdit = (i: InventoryItem) => { setEditing(i); setForm(toForm(i)); setFormOpen(true); };

  const handleSave = async () => {
    if (!form.name.trim()) { toast('Le nom est requis', 'error'); return; }
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      brand: form.brand || null,
      category: form.category,
      weight_g: form.weight_g ? Number(form.weight_g) : 0,
      price_cents: form.price_cents ? Number(form.price_cents) : null,
      condition: form.condition,
    };
    try {
      const url = editing ? `/api/materiel/items/${editing.id}` : '/api/materiel/items';
      const res = await fetch(url, {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Erreur');
      toast(editing ? 'Objet modifié' : 'Objet ajouté', 'success');
      setFormOpen(false);
      router.refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Erreur', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item: InventoryItem) => {
    if (!confirm(`Supprimer « ${item.name} » ?`)) return;
    try {
      const res = await fetch(`/api/materiel/items/${item.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Erreur');
      toast('Objet supprimé', 'success');
      setSelected(null);
      router.refresh();
    } catch {
      toast('Erreur de suppression', 'error');
    }
  };

  const handleScan = async (file: File) => {
    setScanning(true); setScanError(null); setScanResult(null);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const res = await fetch('/api/materiel/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_data_url: dataUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Erreur scan');
      setScanResult(data.draft?.name ?? 'Article scanné');
      toast('Article scanné — ajouté à l’inventaire', 'success');
      router.refresh();
    } catch (e) {
      setScanError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setScanning(false);
    }
  };

  return (
    <>
      <GlassCard className="p-3" aria-labelledby="inv-toolbar">
        <h2 id="inv-toolbar" className="sr-only">Recherche et tri</h2>
        <div className="flex flex-wrap items-center gap-2">
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher un objet…" aria-label="Rechercher" className="glass-input flex-1 min-w-[160px]" />
          <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} aria-label="Trier" className="glass-input">
            <option value="recent">Récents</option>
            <option value="weight">Poids</option>
            <option value="price">Prix</option>
          </select>
          <div className="glass-segmented" role="group" aria-label="Vue">
            <button type="button" className={`glass-segmented-item ${view === 'grid' ? 'active' : ''}`} onClick={() => setView('grid')}>Cartes</button>
            <button type="button" className={`glass-segmented-item ${view === 'table' ? 'active' : ''}`} onClick={() => setView('table')}>Table</button>
          </div>
          <button type="button" onClick={openCreate} className="glass interactive h-10 px-4 rounded-full text-sm font-medium text-white bg-sage-800">+ Ajouter</button>
        </div>
      </GlassCard>

      <div className="grid grid-cols-12 gap-4">
        <GlassCard className="col-span-12 md:col-span-3 p-4 self-start" aria-labelledby="inv-filters">
          <h2 id="inv-filters" className="sr-only">Filtres</h2>
          <Eyebrow>Filtres</Eyebrow>
          <div className="mt-3 flex flex-col gap-2">
            <label className="flex items-center gap-2 text-sm text-[color:var(--label)]">
              <input type="checkbox" checked={lentOnly} onChange={(e) => setLentOnly(e.target.checked)} />
              En prêt uniquement
            </label>
            <select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Filtrer par catégorie" className="glass-input">
              <option value="all">Toutes catégories</option>
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </GlassCard>

        <div className="col-span-12 md:col-span-9">
          {view === 'grid' && (filtered.length > 0 ? <InventoryVirtualGrid items={filtered} onSelect={setSelected} /> : (
            <p className="text-sm text-[color:var(--label-secondary)]">Aucun objet ne correspond.</p>
          ))}
          {view === 'table' && (
            <GlassCard className="p-3 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[color:var(--label-tertiary)]">
                    <th className="py-2">Nom</th><th className="py-2">Catégorie</th><th className="py-2">Poids</th><th className="py-2">Prix</th><th className="py-2">État</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((i) => (
                    <tr key={i.id} className="border-t border-[var(--separator)] cursor-pointer" onClick={() => setSelected(i)}>
                      <td className="py-2 text-[color:var(--label)]">{i.name}</td>
                      <td className="py-2 text-[color:var(--label-secondary)]">{i.category ?? '—'}</td>
                      <td className="py-2">{i.weight_g ? `${(i.weight_g / 1000).toFixed(2)} kg` : '—'}</td>
                      <td className="py-2">{i.price_cents ? `${(i.price_cents / 100).toFixed(2)} €` : '—'}</td>
                      <td className="py-2">{i.is_lent ? <Badge tone="warn">Prêt</Badge> : <span className="text-[color:var(--label-secondary)]">{i.condition ?? '—'}</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </GlassCard>
          )}
        </div>
      </div>

      {/* W-I-7 Comparateur */}
      <GlassCard className="p-4" aria-labelledby="inv-comparator">
        <h3 id="inv-comparator" className="sr-only">Comparateur d'objets</h3>
        <Eyebrow>Comparateur</Eyebrow>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <select value={cmpA} onChange={(e) => setCmpA(e.target.value)} aria-label="Objet A" className="glass-input flex-1 min-w-[120px]">
            <option value="">— Objet A —</option>
            {items.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
          </select>
          <span className="text-sm text-[color:var(--label-tertiary)]">vs</span>
          <select value={cmpB} onChange={(e) => setCmpB(e.target.value)} aria-label="Objet B" className="glass-input flex-1 min-w-[120px]">
            <option value="">— Objet B —</option>
            {items.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
          </select>
        </div>
        {cmpAItem && cmpBItem && (
          <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
            {(['weight_g', 'price_cents', 'condition', 'brand'] as const).map((field) => (
              <div key={field} className="bg-white/60 rounded-[var(--r-sm)] p-2 flex flex-col gap-1">
                <span className="text-[10px] uppercase tracking-wider text-[color:var(--label-tertiary)]">{field}</span>
                <span className="flex justify-between">
                  <span className="text-[color:var(--label)]">{field === 'weight_g' ? `${(cmpAItem[field] ?? 0) / 1000} kg` : cmpAItem[field] ?? '—'}</span>
                  <span className="text-[color:var(--label)]">{field === 'weight_g' ? `${(cmpBItem[field] ?? 0) / 1000} kg` : cmpBItem[field] ?? '—'}</span>
                </span>
              </div>
            ))}
          </div>
        )}
      </GlassCard>

      {/* W-I-6 Scan */}
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleScan(f); e.target.value = ''; }} aria-label="Scanner un article" />
      <button type="button" onClick={() => fileRef.current?.click()} className="fixed bottom-24 right-5 z-30 h-14 w-14 rounded-full glass interactive flex items-center justify-center text-[color:var(--label)] shadow-[var(--elevation-4)]" aria-label="Scanner un article (OCR)">📷</button>
      {scanning && <p className="text-sm text-[color:var(--label-secondary)]">Analyse…</p>}
      {scanError && <p className="text-sm text-danger">{scanError}</p>}
      {scanResult && <p className="text-sm text-[color:var(--label-secondary)]">Ajouté : {scanResult}</p>}

      {/* Détail */}
      <GlassDrawer open={!!selected} onOpenChange={(v) => { if (!v) setSelected(null); }} title={selected?.name ?? 'Détail'}>
        {selected && (
          <div className="flex flex-col gap-3">
            <div className="flex gap-2">
              {selected.is_lent && <Badge tone="warn">En prêt</Badge>}
              {selected.condition && <Badge tone="stone">{selected.condition}</Badge>}
            </div>
            <dl className="flex flex-col gap-2 text-sm">
              <div className="flex justify-between"><dt className="text-[color:var(--label-tertiary)]">Marque</dt><dd className="text-[color:var(--label)]">{selected.brand ?? '—'}</dd></div>
              <div className="flex justify-between"><dt className="text-[color:var(--label-tertiary)]">Catégorie</dt><dd className="text-[color:var(--label)]">{selected.category ?? '—'}</dd></div>
              <div className="flex justify-between"><dt className="text-[color:var(--label-tertiary)]">Poids</dt><dd className="text-[color:var(--label)]">{selected.weight_g ? `${(selected.weight_g / 1000).toFixed(2)} kg` : '—'}</dd></div>
              <div className="flex justify-between"><dt className="text-[color:var(--label-tertiary)]">Prix</dt><dd className="text-[color:var(--label)]">{selected.price_cents ? `${(selected.price_cents / 100).toFixed(2)} €` : '—'}</dd></div>
            </dl>
            <div className="flex gap-2">
              <button type="button" onClick={() => { setSelected(null); openEdit(selected); }} className="glass interactive h-10 px-4 rounded-full text-sm font-medium">Modifier</button>
              <button type="button" onClick={() => handleDelete(selected)} className="glass interactive h-10 px-4 rounded-full text-sm font-medium text-danger">Supprimer</button>
            </div>
          </div>
        )}
      </GlassDrawer>

      {/* Formulaire Ajouter/Modifier */}
      <GlassDrawer open={formOpen} onOpenChange={setFormOpen} title={editing ? 'Modifier l’objet' : 'Ajouter un objet'}>
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-[color:var(--label-secondary)]">Nom *</span>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="glass-input" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-[color:var(--label-secondary)]">Marque</span>
            <input value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} className="glass-input" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-[color:var(--label-secondary)]">Catégorie</span>
            <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="glass-input">
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-[color:var(--label-secondary)]">Poids (g)</span>
            <input type="number" value={form.weight_g} onChange={(e) => setForm({ ...form, weight_g: e.target.value })} className="glass-input" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-[color:var(--label-secondary)]">Prix (centimes)</span>
            <input type="number" value={form.price_cents} onChange={(e) => setForm({ ...form, price_cents: e.target.value })} className="glass-input" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-[color:var(--label-secondary)]">État</span>
            <select value={form.condition} onChange={(e) => setForm({ ...form, condition: e.target.value })} className="glass-input">
              {CONDITIONS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <button type="button" onClick={handleSave} disabled={saving} className="glass interactive h-12 rounded-full text-sm font-medium text-white bg-sage-800 disabled:opacity-40">
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </GlassDrawer>
    </>
  );
}
