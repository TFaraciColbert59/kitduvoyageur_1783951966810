'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

type Condition = 'neuf' | 'excellent' | 'bon' | 'usé' | 'à_remplacer';
type Category = 'sac' | 'abri' | 'couchage' | 'vêtement' | 'chaussure' | 'cuisine' | 'eau' | 'navigation' | 'sécurité' | 'électronique' | 'autre';

interface GearItem {
  id: string;
  user_id: string;
  name: string;
  brand: string;
  model: string;
  category: Category;
  condition: Condition;
  purchase_date: string;
  purchase_price: number;
  weight_g: number;
  expiry_date?: string;
  last_maintenance_date?: string;
  next_maintenance_date?: string;
  notes: string;
  serial_number?: string;
  usage_count: number;
  image: string;
  alt: string;
  tags: string[];
}

const CONDITION_CONFIG: Record<Condition, { label: string; color: string; bg: string }> = {
  neuf: { label: 'Neuf', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
  excellent: { label: 'Excellent', color: 'text-green-600', bg: 'bg-green-50 border-green-200' },
  bon: { label: 'Bon', color: 'text-blue-600', bg: 'bg-blue-50 border-blue-200' },
  usé: { label: 'Usé', color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200' },
  à_remplacer: { label: 'À remplacer', color: 'text-red-600', bg: 'bg-red-50 border-red-200' },
};

const CATEGORY_LABELS: Record<Category, string> = {
  sac: '🎒 Sac',
  abri: '⛺ Abri',
  couchage: '🛏️ Couchage',
  vêtement: '🧥 Vêtement',
  chaussure: '👟 Chaussure',
  cuisine: '🍳 Cuisine',
  eau: '💧 Eau',
  navigation: '🧭 Navigation',
  sécurité: '🛡️ Sécurité',
  électronique: '🔋 Électronique',
  autre: '📦 Autre',
};

type SortKey = 'name' | 'condition' | 'purchase_date' | 'usage_count' | 'weight_g';
type FilterCategory = Category | 'all';

const EMPTY_FORM = {
  name: '', brand: '', model: '', category: 'autre' as Category, condition: 'bon' as Condition,
  purchase_date: '', purchase_price: 0, weight_g: 0, notes: '', usage_count: 0,
  image: 'https://images.unsplash.com/photo-1572698846920-cb1e563bbb30',
  alt: 'Équipement de randonnée', tags: [] as string[],
  expiry_date: '', last_maintenance_date: '', next_maintenance_date: '', serial_number: '',
};

function getExpiryStatus(item: GearItem) {
  if (!item.expiry_date) return null;
  const now = new Date();
  const expiry = new Date(item.expiry_date);
  const daysLeft = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (daysLeft < 0) return { label: 'Expiré', color: 'text-red-600 bg-red-50 border-red-200', urgent: true };
  if (daysLeft <= 30) return { label: `Expire dans ${daysLeft}j`, color: 'text-red-500 bg-red-50 border-red-200', urgent: true };
  if (daysLeft <= 90) return { label: `Expire dans ${daysLeft}j`, color: 'text-amber-600 bg-amber-50 border-amber-200', urgent: false };
  return null;
}

function getMaintenanceStatus(item: GearItem) {
  if (!item.next_maintenance_date) return null;
  const now = new Date();
  const maint = new Date(item.next_maintenance_date);
  const daysLeft = Math.ceil((maint.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (daysLeft < 0) return { label: 'Entretien en retard', color: 'text-red-600 bg-red-50 border-red-200', urgent: true };
  if (daysLeft <= 30) return { label: `Entretien dans ${daysLeft}j`, color: 'text-amber-600 bg-amber-50 border-amber-200', urgent: true };
  return null;
}

function GearFormModal({
  initial, onSave, onClose, title, saving,
}: {
  initial: typeof EMPTY_FORM;
  onSave: (data: typeof EMPTY_FORM) => void;
  onClose: () => void;
  title: string;
  saving: boolean;
}) {
  const [form, setForm] = useState(initial);
  const [tagInput, setTagInput] = useState('');

  const set = (key: string, value: unknown) => setForm((prev) => ({ ...prev, [key]: value }));

  const addTag = () => {
    const t = tagInput.trim().toLowerCase();
    if (t && !form.tags.includes(t)) set('tags', [...form.tags, t]);
    setTagInput('');
  };

  const removeTag = (tag: string) => set('tags', form.tags.filter((t) => t !== tag));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.brand.trim()) return;
    onSave(form);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-card rounded-2xl border border-border w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-border sticky top-0 bg-card z-10">
          <h2 className="text-lg font-display font-700">{title}</h2>
          <button type="button" onClick={onClose} className="p-2 hover:bg-muted rounded-lg transition-colors">
            <Icon name="XMarkIcon" size={20} variant="outline" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-muted-foreground mb-1">Nom de l&apos;équipement *</label>
              <input required value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Ex: Sac Osprey Atmos 65" className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Marque *</label>
              <input required value={form.brand} onChange={(e) => set('brand', e.target.value)} placeholder="Ex: Osprey" className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Modèle</label>
              <input value={form.model} onChange={(e) => set('model', e.target.value)} placeholder="Ex: Atmos AG 65" className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Catégorie</label>
              <select value={form.category} onChange={(e) => set('category', e.target.value as Category)} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">État</label>
              <select value={form.condition} onChange={(e) => set('condition', e.target.value as Condition)} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                {Object.entries(CONDITION_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Prix d&apos;achat (€)</label>
              <input type="number" min={0} value={form.purchase_price} onChange={(e) => set('purchase_price', Number(e.target.value))} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Poids (grammes)</label>
              <input type="number" min={0} value={form.weight_g} onChange={(e) => set('weight_g', Number(e.target.value))} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Date d&apos;achat</label>
              <input type="date" value={form.purchase_date} onChange={(e) => set('purchase_date', e.target.value)} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Date d&apos;expiration</label>
              <input type="date" value={form.expiry_date} onChange={(e) => set('expiry_date', e.target.value)} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Prochain entretien</label>
              <input type="date" value={form.next_maintenance_date} onChange={(e) => set('next_maintenance_date', e.target.value)} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Utilisations</label>
              <input type="number" min={0} value={form.usage_count} onChange={(e) => set('usage_count', Number(e.target.value))} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">N° de série</label>
              <input value={form.serial_number} onChange={(e) => set('serial_number', e.target.value)} placeholder="Optionnel" className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-muted-foreground mb-1">URL Image</label>
              <input value={form.image} onChange={(e) => set('image', e.target.value)} placeholder="https://..." className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-muted-foreground mb-1">Notes</label>
              <textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} rows={2} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-muted-foreground mb-1">Tags</label>
              <div className="flex gap-2 mb-2">
                <input value={tagInput} onChange={(e) => setTagInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }} placeholder="Ajouter un tag..." className="flex-1 px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                <button type="button" onClick={addTag} className="px-3 py-2 bg-primary text-white rounded-lg text-sm">+</button>
              </div>
              <div className="flex flex-wrap gap-1">
                {form.tags.map((tag) => (
                  <span key={tag} className="flex items-center gap-1 text-xs px-2 py-0.5 bg-secondary/10 text-secondary rounded-full">
                    {tag}
                    <button type="button" onClick={() => removeTag(tag)} className="hover:text-red-500">×</button>
                  </span>
                ))}
              </div>
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Annuler</button>
            <button type="submit" disabled={saving} className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50">
              {saving ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function InventairePage() {
  const [gear, setGear] = useState<GearItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<GearItem | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingItem, setEditingItem] = useState<GearItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<FilterCategory>('all');
  const [filterCondition, setFilterCondition] = useState<Condition | 'all'>('all');
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [activeView, setActiveView] = useState<'grid' | 'list'>('grid');
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const { user } = useAuth();
  const supabase = useMemo(() => createClient(), []);

  const loadGear = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('gear_items')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (fetchError) throw fetchError;
      setGear(data ?? []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, [user, supabase]);

  useEffect(() => { loadGear(); }, [loadGear]);

  // Ensure user profile exists before any write operation
  const ensureProfile = useCallback(async () => {
    if (!user) return false;
    const { data: existing } = await supabase.from('user_profiles').select('id').eq('id', user.id).single();
    if (!existing) {
      await supabase.from('user_profiles').insert({
        id: user.id,
        email: user.email ?? '',
        full_name: user.user_metadata?.full_name ?? user.email?.split('@')[0] ?? '',
        loyalty_points: 100,
        trust_score: 50,
      });
    }
    return true;
  }, [user, supabase]);

  const handleAddItem = async (data: typeof EMPTY_FORM) => {
    if (!user) return;
    setSaving(true);
    setError(null);
    try {
      await ensureProfile();
      const { error: insertError } = await supabase.from('gear_items').insert({
        user_id: user.id,
        name: data.name,
        brand: data.brand,
        model: data.model,
        category: data.category,
        condition: data.condition,
        purchase_date: data.purchase_date || null,
        purchase_price: data.purchase_price,
        weight_g: data.weight_g,
        expiry_date: data.expiry_date || null,
        last_maintenance_date: data.last_maintenance_date || null,
        next_maintenance_date: data.next_maintenance_date || null,
        notes: data.notes,
        serial_number: data.serial_number || null,
        usage_count: data.usage_count,
        image: data.image || 'https://images.unsplash.com/photo-1572698846920-cb1e563bbb30',
        alt: data.alt || data.name,
        tags: data.tags,
      });
      if (insertError) throw insertError;
      setShowAddModal(false);
      setSuccessMsg('Équipement ajouté avec succès !');
      setTimeout(() => setSuccessMsg(null), 3000);
      await loadGear();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur lors de l\'ajout');
    } finally {
      setSaving(false);
    }
  };

  const handleEditItem = async (data: typeof EMPTY_FORM) => {
    if (!editingItem) return;
    setSaving(true);
    setError(null);
    try {
      const { error: updateError } = await supabase.from('gear_items').update({
        name: data.name,
        brand: data.brand,
        model: data.model,
        category: data.category,
        condition: data.condition,
        purchase_date: data.purchase_date || null,
        purchase_price: data.purchase_price,
        weight_g: data.weight_g,
        expiry_date: data.expiry_date || null,
        last_maintenance_date: data.last_maintenance_date || null,
        next_maintenance_date: data.next_maintenance_date || null,
        notes: data.notes,
        serial_number: data.serial_number || null,
        usage_count: data.usage_count,
        image: data.image,
        alt: data.alt || data.name,
        tags: data.tags,
        updated_at: new Date().toISOString(),
      }).eq('id', editingItem.id).eq('user_id', user!.id);
      if (updateError) throw updateError;
      setEditingItem(null);
      setSelectedItem(null);
      setSuccessMsg('Équipement modifié avec succès !');
      setTimeout(() => setSuccessMsg(null), 3000);
      await loadGear();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la modification');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteItem = async (id: string) => {
    if (!confirm('Supprimer cet équipement ?')) return;
    setError(null);
    try {
      const { error: deleteError } = await supabase.from('gear_items').delete().eq('id', id).eq('user_id', user!.id);
      if (deleteError) throw deleteError;
      setSelectedItem(null);
      await loadGear();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la suppression');
    }
  };

  const alerts = gear.filter((item) => {
    const expiry = getExpiryStatus(item);
    const maintenance = getMaintenanceStatus(item);
    return item.condition === 'à_remplacer' || expiry?.urgent || maintenance?.urgent;
  });

  const filteredGear = gear
    .filter((item) => {
      if (filterCategory !== 'all' && item.category !== filterCategory) return false;
      if (filterCondition !== 'all' && item.condition !== filterCondition) return false;
      if (searchQuery && !item.name.toLowerCase().includes(searchQuery.toLowerCase()) && !item.brand.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    })
    .sort((a, b) => {
      if (sortKey === 'name') return a.name.localeCompare(b.name);
      if (sortKey === 'condition') return a.condition.localeCompare(b.condition);
      if (sortKey === 'purchase_date') return new Date(b.purchase_date || 0).getTime() - new Date(a.purchase_date || 0).getTime();
      if (sortKey === 'usage_count') return b.usage_count - a.usage_count;
      if (sortKey === 'weight_g') return a.weight_g - b.weight_g;
      return 0;
    });

  const totalValue = gear.reduce((s, i) => s + i.purchase_price, 0);
  const totalWeight = gear.reduce((s, i) => s + i.weight_g, 0);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="pt-20">
        <section className="bg-dark-bg text-white py-10 px-4">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
                <Icon name="ArchiveBoxIcon" size={22} variant="outline" className="text-primary" />
              </div>
              <div>
                <p className="text-xs font-mono text-primary/80 tracking-widest uppercase">Phase 3 · Inventaire Actif</p>
                <h1 className="text-2xl font-display font-800 tracking-tight">Mon Inventaire Matériel</h1>
              </div>
            </div>
            <p className="text-white/60 text-sm max-w-xl">Gérez l&apos;intégralité de votre équipement : état, dates d&apos;achat, expiration, entretien et alertes.</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
              {[
                { label: 'Articles', value: gear.length, icon: 'CubeIcon' },
                { label: 'Valeur totale', value: `${totalValue.toLocaleString('fr-FR')} €`, icon: 'BanknotesIcon' },
                { label: 'Poids total', value: `${(totalWeight / 1000).toFixed(1)} kg`, icon: 'ScaleIcon' },
                { label: 'Alertes', value: alerts.length, icon: 'BellAlertIcon', urgent: alerts.length > 0 },
              ].map((stat) => (
                <div key={stat.label} className={`rounded-xl p-3 border ${stat.urgent && (stat.value as number) > 0 ? 'bg-red-900/30 border-red-500/30' : 'bg-white/5 border-white/10'}`}>
                  <p className="text-xs text-white/50 mb-1">{stat.label}</p>
                  <p className={`text-xl font-display font-700 ${stat.urgent && (stat.value as number) > 0 ? 'text-red-400' : 'text-white'}`}>{stat.value}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <div className="max-w-7xl mx-auto px-4 py-8">
          {successMsg && (
            <div className="mb-4 flex items-center gap-3 px-4 py-3 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm">
              <Icon name="CheckCircleIcon" size={16} className="text-green-600" />
              {successMsg}
            </div>
          )}
          {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">{error}</div>}

          {!user ? (
            <div className="text-center py-16 text-muted-foreground">
              <Icon name="ArchiveBoxIcon" size={40} className="mx-auto mb-3 opacity-30" />
              <p className="font-display font-700 text-foreground mb-1">Connectez-vous</p>
              <p className="text-sm">Connectez-vous pour gérer votre inventaire.</p>
            </div>
          ) : (
            <>
              {alerts.length > 0 && (
                <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <h3 className="text-sm font-semibold text-amber-800 mb-2 flex items-center gap-2">
                    <Icon name="BellAlertIcon" size={16} variant="outline" className="text-amber-600" />
                    {alerts.length} alerte{alerts.length > 1 ? 's' : ''} requérant votre attention
                  </h3>
                  <div className="space-y-1.5">
                    {alerts.map((item) => {
                      const expiry = getExpiryStatus(item);
                      const maintenance = getMaintenanceStatus(item);
                      return (
                        <div key={item.id} className="flex items-center gap-2 text-xs text-amber-700">
                          <span className="font-medium">{item.name}</span>
                          <span>—</span>
                          <span>{item.condition === 'à_remplacer' ? '⚠️ À remplacer' : expiry?.urgent ? `📅 ${expiry.label}` : maintenance?.urgent ? `🔧 ${maintenance.label}` : ''}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-3 mb-6">
                <div className="flex-1 min-w-48 relative">
                  <Icon name="MagnifyingGlassIcon" size={16} variant="outline" className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input type="text" placeholder="Rechercher..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-9 pr-3 py-2 rounded-lg border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
                <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value as FilterCategory)} className="px-3 py-2 rounded-lg border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                  <option value="all">Toutes catégories</option>
                  {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
                <select value={filterCondition} onChange={(e) => setFilterCondition(e.target.value as Condition | 'all')} className="px-3 py-2 rounded-lg border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                  <option value="all">Tous états</option>
                  {Object.entries(CONDITION_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
                <select value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)} className="px-3 py-2 rounded-lg border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                  <option value="name">Trier: Nom</option>
                  <option value="condition">Trier: État</option>
                  <option value="purchase_date">Trier: Date d&apos;achat</option>
                  <option value="usage_count">Trier: Utilisations</option>
                  <option value="weight_g">Trier: Poids</option>
                </select>
                <div className="flex gap-1 border border-border rounded-lg overflow-hidden">
                  <button onClick={() => setActiveView('grid')} className={`px-3 py-2 text-sm transition-colors ${activeView === 'grid' ? 'bg-primary text-white' : 'bg-card text-muted-foreground hover:text-foreground'}`}>
                    <Icon name="Squares2X2Icon" size={16} variant="outline" />
                  </button>
                  <button onClick={() => setActiveView('list')} className={`px-3 py-2 text-sm transition-colors ${activeView === 'list' ? 'bg-primary text-white' : 'bg-card text-muted-foreground hover:text-foreground'}`}>
                    <Icon name="ListBulletIcon" size={16} variant="outline" />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
                >
                  <Icon name="PlusIcon" size={16} variant="outline" />
                  Ajouter
                </button>
              </div>

              {loading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[1, 2, 3, 4, 5, 6].map((i) => <div key={i} className="h-48 rounded-xl bg-muted animate-pulse" />)}
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-2">
                    {activeView === 'grid' ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {filteredGear.map((item) => {
                          const expiry = getExpiryStatus(item);
                          const maintenance = getMaintenanceStatus(item);
                          const cond = CONDITION_CONFIG[item.condition];
                          return (
                            <div key={item.id} className={`bg-card rounded-xl border cursor-pointer transition-all hover:shadow-md ${selectedItem?.id === item.id ? 'border-primary shadow-md' : 'border-border hover:border-primary/40'}`} onClick={() => setSelectedItem(item)}>
                              <div className="relative h-36 rounded-t-xl overflow-hidden">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={item.image || 'https://images.unsplash.com/photo-1572698846920-cb1e563bbb30'} alt={item.alt || item.name} className="w-full h-full object-cover" />
                                <div className="absolute top-2 left-2">
                                  <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${cond.bg} ${cond.color}`}>{cond.label}</span>
                                </div>
                                {(expiry?.urgent || maintenance?.urgent) && (
                                  <div className="absolute top-2 right-2 w-5 h-5 bg-amber-500 rounded-full flex items-center justify-center">
                                    <Icon name="ExclamationTriangleIcon" size={12} variant="solid" className="text-white" />
                                  </div>
                                )}
                              </div>
                              <div className="p-3">
                                <p className="text-xs text-muted-foreground mb-0.5">{CATEGORY_LABELS[item.category as Category]}</p>
                                <h3 className="text-sm font-semibold leading-tight mb-1">{item.name}</h3>
                                <p className="text-xs text-muted-foreground">{item.brand} · {item.weight_g}g</p>
                                <div className="flex items-center justify-between mt-2">
                                  <span className="text-xs font-mono text-muted-foreground">{item.usage_count} utilisations</span>
                                  <span className="text-xs font-mono font-semibold">{item.purchase_price} €</span>
                                </div>
                                {expiry && <div className={`mt-2 text-xs px-2 py-1 rounded-lg border ${expiry.color}`}>📅 {expiry.label}</div>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {filteredGear.map((item) => {
                          const expiry = getExpiryStatus(item);
                          const cond = CONDITION_CONFIG[item.condition];
                          return (
                            <div key={item.id} className={`flex items-center gap-3 p-3 bg-card rounded-xl border cursor-pointer transition-all ${selectedItem?.id === item.id ? 'border-primary' : 'border-border hover:border-primary/40'}`} onClick={() => setSelectedItem(item)}>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={item.image || 'https://images.unsplash.com/photo-1572698846920-cb1e563bbb30'} alt={item.alt || item.name} className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-0.5">
                                  <p className="text-sm font-semibold truncate">{item.name}</p>
                                  <span className={`text-xs px-1.5 py-0.5 rounded border flex-shrink-0 ${cond.bg} ${cond.color}`}>{cond.label}</span>
                                </div>
                                <p className="text-xs text-muted-foreground">{item.brand} · {CATEGORY_LABELS[item.category as Category]}</p>
                                {expiry?.urgent && <p className={`text-xs mt-0.5 ${expiry.color.split(' ')[0]}`}>⚠️ {expiry.label}</p>}
                              </div>
                              <div className="text-right flex-shrink-0">
                                <p className="text-xs font-mono font-semibold">{item.purchase_price} €</p>
                                <p className="text-xs text-muted-foreground">{item.weight_g}g</p>
                                <p className="text-xs text-muted-foreground">{item.usage_count}x</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {filteredGear.length === 0 && !loading && (
                      <div className="text-center py-16 text-muted-foreground">
                        <Icon name="ArchiveBoxXMarkIcon" size={40} variant="outline" className="mx-auto mb-3 opacity-40" />
                        <p className="text-sm font-medium text-foreground mb-1">Aucun article trouvé</p>
                        <p className="text-sm">Ajoutez votre premier équipement !</p>
                      </div>
                    )}
                  </div>

                  <div className="space-y-4">
                    {selectedItem ? (
                      <div className="bg-card rounded-xl border border-border overflow-hidden sticky top-24">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={selectedItem.image || 'https://images.unsplash.com/photo-1572698846920-cb1e563bbb30'} alt={selectedItem.alt || selectedItem.name} className="w-full h-40 object-cover" />
                        <div className="p-4">
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <p className="text-xs text-muted-foreground">{CATEGORY_LABELS[selectedItem.category as Category]}</p>
                              <h3 className="text-base font-display font-700 leading-tight">{selectedItem.name}</h3>
                              <p className="text-sm text-muted-foreground">{selectedItem.brand} {selectedItem.model}</p>
                            </div>
                            <span className={`text-xs px-2 py-1 rounded-lg border font-medium ${CONDITION_CONFIG[selectedItem.condition].bg} ${CONDITION_CONFIG[selectedItem.condition].color}`}>
                              {CONDITION_CONFIG[selectedItem.condition].label}
                            </span>
                          </div>
                          <div className="space-y-2 text-xs border-t border-border pt-3">
                            {selectedItem.purchase_date && <div className="flex justify-between"><span className="text-muted-foreground">Acheté le</span><span>{new Date(selectedItem.purchase_date).toLocaleDateString('fr-FR')}</span></div>}
                            <div className="flex justify-between"><span className="text-muted-foreground">Prix d&apos;achat</span><span className="font-mono font-semibold">{selectedItem.purchase_price} €</span></div>
                            <div className="flex justify-between"><span className="text-muted-foreground">Poids</span><span className="font-mono">{selectedItem.weight_g} g</span></div>
                            <div className="flex justify-between"><span className="text-muted-foreground">Utilisations</span><span className="font-mono">{selectedItem.usage_count}×</span></div>
                            {selectedItem.serial_number && <div className="flex justify-between"><span className="text-muted-foreground">N° série</span><span className="font-mono text-xs">{selectedItem.serial_number}</span></div>}
                          </div>
                          {selectedItem.expiry_date && (
                            <div className={`mt-3 p-2 rounded-lg border text-xs ${getExpiryStatus(selectedItem)?.color || 'text-blue-600 bg-blue-50 border-blue-200'}`}>
                              📅 Expiration : {new Date(selectedItem.expiry_date).toLocaleDateString('fr-FR')}
                            </div>
                          )}
                          {selectedItem.next_maintenance_date && (
                            <div className={`mt-2 p-2 rounded-lg border text-xs ${getMaintenanceStatus(selectedItem)?.urgent ? 'text-amber-600 bg-amber-50 border-amber-200' : 'text-blue-600 bg-blue-50 border-blue-200'}`}>
                              🔧 Prochain entretien : {new Date(selectedItem.next_maintenance_date).toLocaleDateString('fr-FR')}
                            </div>
                          )}
                          {selectedItem.notes && <div className="mt-3 p-2 bg-muted rounded-lg"><p className="text-xs text-muted-foreground italic">{selectedItem.notes}</p></div>}
                          {selectedItem.tags && selectedItem.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-3">
                              {selectedItem.tags.map((tag) => <span key={tag} className="text-xs px-2 py-0.5 bg-secondary/10 text-secondary rounded-full">{tag}</span>)}
                            </div>
                          )}
                          <div className="flex gap-2 mt-4">
                            <button
                              type="button"
                              onClick={() => setEditingItem(selectedItem)}
                              className="flex-1 py-2 rounded-lg bg-secondary text-secondary-foreground text-xs font-medium hover:opacity-90 transition-opacity flex items-center justify-center gap-1"
                            >
                              <Icon name="PencilIcon" size={12} variant="outline" />
                              Modifier
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteItem(selectedItem.id)}
                              className="px-3 py-2 rounded-lg bg-red-50 text-red-600 border border-red-200 text-xs hover:bg-red-100 transition-colors"
                            >
                              <Icon name="TrashIcon" size={14} variant="outline" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-card rounded-xl border border-border p-8 text-center">
                        <Icon name="CursorArrowRaysIcon" size={32} variant="outline" className="mx-auto mb-3 text-muted-foreground opacity-50" />
                        <p className="text-sm text-muted-foreground">Sélectionnez un article pour voir ses détails</p>
                      </div>
                    )}
                    <div className="bg-card rounded-xl border border-border p-4">
                      <h3 className="text-sm font-semibold mb-3">Santé de l&apos;inventaire</h3>
                      <div className="space-y-2">
                        {Object.entries(CONDITION_CONFIG).map(([key, config]) => {
                          const count = gear.filter((g) => g.condition === key).length;
                          const pct = gear.length > 0 ? count / gear.length * 100 : 0;
                          return (
                            <div key={key} className="flex items-center gap-2">
                              <span className={`text-xs w-20 ${config.color}`}>{config.label}</span>
                              <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                                <div className={`h-full rounded-full transition-all ${config.color.replace('text-', 'bg-')}`} style={{ width: `${pct}%` }} />
                              </div>
                              <span className="text-xs font-mono text-muted-foreground w-4 text-right">{count}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {showAddModal && (
        <GearFormModal title="Ajouter un équipement" initial={EMPTY_FORM} onSave={handleAddItem} onClose={() => setShowAddModal(false)} saving={saving} />
      )}
      {editingItem && (
        <GearFormModal
          title="Modifier l'équipement"
          initial={{
            name: editingItem.name, brand: editingItem.brand, model: editingItem.model,
            category: editingItem.category, condition: editingItem.condition,
            purchase_date: editingItem.purchase_date || '', purchase_price: editingItem.purchase_price,
            weight_g: editingItem.weight_g, expiry_date: editingItem.expiry_date || '',
            last_maintenance_date: editingItem.last_maintenance_date || '',
            next_maintenance_date: editingItem.next_maintenance_date || '',
            notes: editingItem.notes, serial_number: editingItem.serial_number || '',
            usage_count: editingItem.usage_count, image: editingItem.image, alt: editingItem.alt,
            tags: editingItem.tags || [],
          }}
          onSave={handleEditItem}
          onClose={() => setEditingItem(null)}
          saving={saving}
        />
      )}
      <Footer />
    </div>
  );
}