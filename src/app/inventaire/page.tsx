'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

// ─── Types ────────────────────────────────────────────────────────────────────

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
  source?: string;
  is_listed_for_sale?: boolean;
  product_id?: string;
}

interface ShopProduct {
  id: string;
  slug: string;
  name: string;
  brand: string;
  category: string;
  price_eur: number;
  stock: number;
  is_active: boolean;
  transaction_type: string;
  image: string;
  image_alt: string;
}

interface Order {
  id: string;
  order_number: string;
  status: string;
  payment_method: string;
  total_eur: number;
  items: Array<{ name: string; quantity: number; unit_price_eur: number }>;
  created_at: string;
}

interface StockMovement {
  id: string;
  product_name: string;
  product_slug: string;
  movement_type: string;
  quantity_change: number;
  quantity_before: number;
  quantity_after: number;
  reference_type: string | null;
  reference_id: string | null;
  notes: string;
  created_at: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CONDITION_CONFIG: Record<Condition, { label: string; color: string; bg: string }> = {
  neuf: { label: 'Neuf', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
  excellent: { label: 'Excellent', color: 'text-green-600', bg: 'bg-green-50 border-green-200' },
  bon: { label: 'Bon', color: 'text-blue-600', bg: 'bg-blue-50 border-blue-200' },
  usé: { label: 'Usé', color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200' },
  à_remplacer: { label: 'À remplacer', color: 'text-red-600', bg: 'bg-red-50 border-red-200' },
};

const CATEGORY_LABELS: Record<Category, string> = {
  sac: '🎒 Sac', abri: '⛺ Abri', couchage: '🛏️ Couchage', vêtement: '🧥 Vêtement',
  chaussure: '👟 Chaussure', cuisine: '🍳 Cuisine', eau: '💧 Eau',
  navigation: '🧭 Navigation', sécurité: '🛡️ Sécurité', électronique: '🔋 Électronique', autre: '📦 Autre',
};

const MOVEMENT_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  sale: { label: 'Vente', color: 'text-red-600 bg-red-50', icon: '🛒' },
  purchase: { label: 'Achat', color: 'text-emerald-600 bg-emerald-50', icon: '📦' },
  restock: { label: 'Réappro', color: 'text-blue-600 bg-blue-50', icon: '🔄' },
  rental: { label: 'Location', color: 'text-purple-600 bg-purple-50', icon: '🔑' },
  adjustment: { label: 'Ajustement', color: 'text-gray-600 bg-gray-50', icon: '⚙️' },
  return: { label: 'Retour', color: 'text-teal-600 bg-teal-50', icon: '↩️' },
};

const ORDER_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending: { label: 'En attente', color: 'text-amber-600 bg-amber-50 border-amber-200' },
  confirmed: { label: 'Confirmée', color: 'text-blue-600 bg-blue-50 border-blue-200' },
  shipped: { label: 'Expédiée', color: 'text-purple-600 bg-purple-50 border-purple-200' },
  delivered: { label: 'Livrée', color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
  cancelled: { label: 'Annulée', color: 'text-red-600 bg-red-50 border-red-200' },
};

const EMPTY_FORM = {
  name: '', brand: '', model: '', category: 'autre' as Category, condition: 'bon' as Condition,
  purchase_date: '', purchase_price: 0, weight_g: 0, notes: '', usage_count: 0,
  image: 'https://images.unsplash.com/photo-1572698846920-cb1e563bbb30',
  alt: 'Équipement de randonnée', tags: [] as string[],
  expiry_date: '', last_maintenance_date: '', next_maintenance_date: '', serial_number: '',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getExpiryStatus(item: GearItem) {
  if (!item.expiry_date) return null;
  const daysLeft = Math.ceil((new Date(item.expiry_date).getTime() - Date.now()) / 86400000);
  if (daysLeft < 0) return { label: 'Expiré', color: 'text-red-600 bg-red-50 border-red-200', urgent: true };
  if (daysLeft <= 30) return { label: `Expire dans ${daysLeft}j`, color: 'text-red-500 bg-red-50 border-red-200', urgent: true };
  if (daysLeft <= 90) return { label: `Expire dans ${daysLeft}j`, color: 'text-amber-600 bg-amber-50 border-amber-200', urgent: false };
  return null;
}

function getMaintenanceStatus(item: GearItem) {
  if (!item.next_maintenance_date) return null;
  const daysLeft = Math.ceil((new Date(item.next_maintenance_date).getTime() - Date.now()) / 86400000);
  if (daysLeft < 0) return { label: 'Entretien en retard', color: 'text-red-600 bg-red-50 border-red-200', urgent: true };
  if (daysLeft <= 30) return { label: `Entretien dans ${daysLeft}j`, color: 'text-amber-600 bg-amber-50 border-amber-200', urgent: true };
  return null;
}

// ─── Toast ────────────────────────────────────────────────────────────────────

function Toast({ message, onDone }: { message: string; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3000);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3 rounded-xl shadow-2xl text-white text-sm font-medium"
      style={{ background: 'var(--secondary)', maxWidth: '90vw' }}
      role="alert" aria-live="polite">
      <Icon name="CheckCircleIcon" size={18} variant="outline" className="text-white flex-shrink-0" />
      {message}
    </div>
  );
}

// ─── Photo Recognition Modal ──────────────────────────────────────────────────

function PhotoRecognitionModal({ onClose, onAdd }: {
  onClose: () => void;
  onAdd: (data: typeof EMPTY_FORM) => Promise<void>;
}) {
  const [step, setStep] = useState<'upload' | 'preview' | 'confirm' | 'saving'>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [recognized, setRecognized] = useState<Partial<typeof EMPTY_FORM>>({});
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (f: File) => {
    setFile(f);
    const url = URL.createObjectURL(f);
    setPreviewUrl(url);
    setStep('preview');
  };

  const handleRecognize = async () => {
    if (!file) return;
    setStep('confirm');
    setError(null);
    try {
      const supabase = createClient();
      // Upload to gear-photos bucket
      const ext = file.name.split('.').pop() ?? 'jpg';
      const path = `recognition/${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage.from('gear-photos').upload(path, file, { upsert: true });
      if (uploadErr) throw uploadErr;
      const { data: urlData } = supabase.storage.from('gear-photos').getPublicUrl(path);
      const publicUrl = urlData.publicUrl;

      // Call AI recognition via chat-completion
      const res = await fetch('/api/ai/chat-completion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: 'GEMINI',
          model: 'gemini/gemini-2.5-flash',
          messages: [{
            role: 'user',
            content: `Analyse cette image d'équipement outdoor et réponds UNIQUEMENT avec un JSON valide (sans markdown) : {"name":"string","category":"string","estimated_weight_grams":number}. Catégories possibles: sac, abri, couchage, vêtement, chaussure, cuisine, eau, navigation, sécurité, électronique, autre. Image: ${publicUrl}`,
          }],
          parameters: { temperature: 0.3, max_tokens: 200 },
        }),
      });
      const data = await res.json();
      const content = data.content ?? data.choices?.[0]?.message?.content ?? '{}';
      const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      try {
        const parsed = JSON.parse(cleaned);
        setRecognized({
          name: parsed.name ?? '',
          category: (parsed.category as Category) ?? 'autre',
          weight_g: parsed.estimated_weight_grams ?? 0,
          image: publicUrl,
          alt: parsed.name ?? 'Équipement reconnu par IA',
        });
      } catch {
        setRecognized({ image: publicUrl, alt: 'Équipement' });
      }
    } catch {
      setError('Reconnaissance impossible. Remplissez manuellement.');
      setRecognized({});
    }
  };

  const [form, setForm] = useState<typeof EMPTY_FORM>(EMPTY_FORM);
  useEffect(() => {
    if (step === 'confirm') {
      setForm({ ...EMPTY_FORM, ...recognized });
    }
  }, [step, recognized]);

  const handleSave = async () => {
    setStep('saving');
    await onAdd(form);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-card rounded-2xl border border-border w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-border sticky top-0 bg-card z-10">
          <h2 className="text-lg font-display font-700">Ajouter par photo</h2>
          <button type="button" onClick={onClose} className="p-2 hover:bg-muted rounded-lg transition-colors">
            <Icon name="XMarkIcon" size={20} variant="outline" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          {step === 'upload' && (
            <>
              <div
                className="border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => fileRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
              >
                <Icon name="CameraIcon" size={32} variant="outline" className="mx-auto mb-3 text-muted-foreground" />
                <p className="text-sm font-medium text-foreground mb-1">Prendre ou importer une photo</p>
                <p className="text-xs text-muted-foreground">L&apos;IA identifiera l&apos;équipement automatiquement</p>
                <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
              </div>
              <button type="button" onClick={onClose} className="w-full py-2.5 rounded-xl border border-border text-sm text-muted-foreground">
                Annuler
              </button>
            </>
          )}
          {step === 'preview' && previewUrl && (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={previewUrl} alt="Aperçu" className="w-full rounded-xl object-cover max-h-64" />
              <div className="flex gap-3">
                <button type="button" onClick={() => setStep('upload')} className="flex-1 py-2.5 rounded-xl border border-border text-sm text-muted-foreground">
                  Changer
                </button>
                <button type="button" onClick={handleRecognize} className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-medium">
                  Analyser avec l&apos;IA
                </button>
              </div>
            </>
          )}
          {step === 'confirm' && (
            <>
              {error && <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg p-3">{error}</p>}
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Nom *</label>
                  <input value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Catégorie</label>
                    <select value={form.category} onChange={(e) => setForm(f => ({ ...f, category: e.target.value as Category }))}
                      className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                      {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Poids (g)</label>
                    <input type="number" min={0} value={form.weight_g} onChange={(e) => setForm(f => ({ ...f, weight_g: Number(e.target.value) }))}
                      className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">État</label>
                  <select value={form.condition} onChange={(e) => setForm(f => ({ ...f, condition: e.target.value as Condition }))}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                    {Object.entries(CONDITION_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setStep('preview')} className="flex-1 py-2.5 rounded-xl border border-border text-sm text-muted-foreground">Retour</button>
                <button type="button" onClick={handleSave} disabled={!form.name.trim()} className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-medium disabled:opacity-50">
                  Ajouter à l&apos;inventaire
                </button>
              </div>
            </>
          )}
          {step === 'saving' && (
            <div className="text-center py-8">
              <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Enregistrement en cours…</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Sell from Inventory Modal ────────────────────────────────────────────────

function SellFromInventoryModal({ item, onClose, onSold }: {
  item: GearItem;
  onClose: () => void;
  onSold: () => void;
}) {
  const conditionDecote: Record<string, number> = { neuf: 0.9, excellent: 0.75, bon: 0.7, usé: 0.5, à_remplacer: 0.3 };
  const suggestedPrice = item.purchase_price > 0
    ? Math.round(item.purchase_price * (conditionDecote[item.condition] ?? 0.7))
    : 0;

  const [price, setPrice] = useState(suggestedPrice > 0 ? String(suggestedPrice) : '');
  const [description, setDescription] = useState(`${item.name} en état ${CONDITION_CONFIG[item.condition]?.label ?? item.condition}. ${item.notes || ''}`.trim());
  const [negotiable, setNegotiable] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  const handlePublish = async () => {
    if (!user || !price) return;
    setSaving(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data: occ, error: occErr } = await supabase.from('occasion_items').insert({
        seller_id: user.id,
        title: item.name,
        description,
        price: Number(price),
        original_price: item.purchase_price || null,
        condition: item.condition === 'à_remplacer' ? 'acceptable' : item.condition === 'usé' ? 'bon' : item.condition,
        image: item.image || null,
        alt: item.alt || item.name,
        negotiable,
        shipping: true,
        status: 'active',
        gear_item_id: item.id,
      }).select('id').single();
      if (occErr) throw occErr;
      // Mark gear item as listed
      await supabase.from('gear_items').update({ is_listed_for_sale: true }).eq('id', item.id);
      onSold();
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erreur lors de la publication');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-card rounded-2xl border border-border w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h2 className="text-lg font-display font-700">Vendre cet article</h2>
          <button type="button" onClick={onClose} className="p-2 hover:bg-muted rounded-lg transition-colors">
            <Icon name="XMarkIcon" size={20} variant="outline" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div className="flex items-center gap-3 p-3 bg-muted rounded-xl">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={item.image || 'https://images.unsplash.com/photo-1572698846920-cb1e563bbb30'} alt={item.alt || item.name} className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold">{item.name}</p>
              <p className="text-xs text-muted-foreground">{CONDITION_CONFIG[item.condition]?.label} · {item.weight_g}g</p>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-muted-foreground">Prix de vente (€) *</label>
              {suggestedPrice > 0 && (
                <span className="text-xs text-primary cursor-pointer hover:underline" onClick={() => setPrice(String(suggestedPrice))}>
                  Suggestion IA : {suggestedPrice} €
                </span>
              )}
            </div>
            <input
              type="number" min={1} value={price} onChange={(e) => setPrice(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              placeholder="Ex: 45"
            />
            {item.purchase_price > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                Prix d&apos;achat : {item.purchase_price} € · Décote {CONDITION_CONFIG[item.condition]?.label} appliquée
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
          </div>

          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={negotiable} onChange={(e) => setNegotiable(e.target.checked)} className="w-4 h-4 rounded accent-primary" />
            <span className="text-sm text-foreground">Prix négociable (activer les offres)</span>
          </label>

          {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-border text-sm text-muted-foreground">Annuler</button>
            <button type="button" onClick={handlePublish} disabled={saving || !price} className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-medium disabled:opacity-50">
              {saving ? 'Publication…' : 'Publier l\'annonce'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── GearFormModal ────────────────────────────────────────────────────────────

function GearFormModal({ initial, onSave, onClose, title, saving }: {
  initial: typeof EMPTY_FORM; onSave: (data: typeof EMPTY_FORM) => void;
  onClose: () => void; title: string; saving: boolean;
}) {
  const [form, setForm] = useState(initial);
  const [tagInput, setTagInput] = useState('');
  const set = (key: string, value: unknown) => setForm((prev) => ({ ...prev, [key]: value }));
  const addTag = () => {
    const t = tagInput.trim().toLowerCase();
    if (t && !form.tags.includes(t)) set('tags', [...form.tags, t]);
    setTagInput('');
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
        <form onSubmit={(e) => { e.preventDefault(); if (!form.name.trim() || !form.brand.trim()) return; onSave(form); }} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-muted-foreground mb-1">Nom *</label>
              <input required value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Ex: Sac Osprey Atmos 65" className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Marque *</label>
              <input required value={form.brand} onChange={(e) => set('brand', e.target.value)} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Modèle</label>
              <input value={form.model} onChange={(e) => set('model', e.target.value)} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
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
              <label className="block text-xs font-medium text-muted-foreground mb-1">Poids (g)</label>
              <input type="number" min={0} value={form.weight_g} onChange={(e) => set('weight_g', Number(e.target.value))} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Date d&apos;achat</label>
              <input type="date" value={form.purchase_date} onChange={(e) => set('purchase_date', e.target.value)} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Expiration</label>
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
              <input value={form.serial_number} onChange={(e) => set('serial_number', e.target.value)} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-muted-foreground mb-1">URL Image</label>
              <input value={form.image} onChange={(e) => set('image', e.target.value)} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
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
                    {tag}<button type="button" onClick={() => set('tags', form.tags.filter((t) => t !== tag))} className="hover:text-red-500">×</button>
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

// ─── StockAdjustModal ─────────────────────────────────────────────────────────

function StockAdjustModal({ product, onClose, onSave }: {
  product: ShopProduct; onClose: () => void;
  onSave: (productId: string, delta: number, type: string, notes: string) => Promise<void>;
}) {
  const [delta, setDelta] = useState(0);
  const [type, setType] = useState('restock');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (delta === 0) return;
    setSaving(true);
    await onSave(product.id, delta, type, notes);
    setSaving(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-card rounded-2xl border border-border w-full max-w-sm shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h2 className="text-base font-display font-700">Ajuster le stock</h2>
          <button type="button" onClick={onClose} className="p-2 hover:bg-muted rounded-lg transition-colors">
            <Icon name="XMarkIcon" size={18} variant="outline" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="p-3 bg-muted rounded-xl">
            <p className="text-xs text-muted-foreground mb-0.5">{product.brand}</p>
            <p className="text-sm font-semibold">{product.name}</p>
            <p className="text-xs text-muted-foreground mt-1">Stock actuel : <span className="font-mono font-semibold text-foreground">{product.stock}</span></p>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Type de mouvement</label>
            <select value={type} onChange={(e) => setType(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
              <option value="restock">📦 Réapprovisionnement (+)</option>
              <option value="adjustment">⚙️ Ajustement manuel</option>
              <option value="return">↩️ Retour client (+)</option>
              <option value="sale">🛒 Vente manuelle (-)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Quantité {delta > 0 ? `(+${delta})` : delta < 0 ? `(${delta})` : ''}
            </label>
            <input
              type="number"
              value={delta}
              onChange={(e) => setDelta(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              placeholder="Ex: 5 ou -2"
            />
            {delta !== 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                Nouveau stock : <span className="font-mono font-semibold text-foreground">{Math.max(0, product.stock + delta)}</span>
              </p>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Notes</label>
            <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optionnel" className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium text-muted-foreground">Annuler</button>
            <button type="submit" disabled={saving || delta === 0} className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-medium hover:opacity-90 disabled:opacity-50">
              {saving ? 'Enregistrement...' : 'Confirmer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function InventairePage() {
  const [activeTab, setActiveTab] = useState<'gear' | 'stock' | 'orders' | 'movements'>('gear');

  // Gear state
  const [gear, setGear] = useState<GearItem[]>([]);
  const [gearLoading, setGearLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<GearItem | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [editingItem, setEditingItem] = useState<GearItem | null>(null);
  const [sellingItem, setSellingItem] = useState<GearItem | null>(null);
  const [gearSaving, setGearSaving] = useState(false);
  const [gearSearch, setGearSearch] = useState('');
  const [gearFilterCat, setGearFilterCat] = useState<Category | 'all'>('all');
  const [gearFilterCond, setGearFilterCond] = useState<Condition | 'all'>('all');
  const [gearSort, setGearSort] = useState<'name' | 'condition' | 'purchase_date' | 'usage_count' | 'weight_g'>('name');
  const [gearView, setGearView] = useState<'grid' | 'list'>('grid');

  // Stock state
  const [products, setProducts] = useState<ShopProduct[]>([]);
  const [stockLoading, setStockLoading] = useState(false);
  const [stockSearch, setStockSearch] = useState('');
  const [adjustingProduct, setAdjustingProduct] = useState<ShopProduct | null>(null);

  // Orders state
  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);

  // Movements state
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [movementsLoading, setMovementsLoading] = useState(false);
  const [movementsFilter, setMovementsFilter] = useState<string>('all');

  // Global
  const [error, setError] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const { user } = useAuth();
  const supabase = useMemo(() => createClient(), []);

  const showToast = (msg: string) => setToastMsg(msg);

  // ─── Gear CRUD ──────────────────────────────────────────────────────────────

  const loadGear = useCallback(async () => {
    if (!user) { setGearLoading(false); return; }
    setGearLoading(true);
    try {
      const { data, error: e } = await supabase.from('gear_items').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
      if (e) throw e;
      setGear(data ?? []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur chargement équipements');
    } finally { setGearLoading(false); }
  }, [user, supabase]);

  const ensureProfile = useCallback(async () => {
    if (!user) return false;
    const { data } = await supabase.from('user_profiles').select('id').eq('id', user.id).single();
    if (!data) {
      await supabase.from('user_profiles').insert({
        id: user.id, email: user.email ?? '',
        full_name: user.user_metadata?.full_name ?? user.email?.split('@')[0] ?? '',
        loyalty_points: 100, trust_score: 50,
      });
    }
    return true;
  }, [user, supabase]);

  const handleAddItem = async (data: typeof EMPTY_FORM) => {
    if (!user) return;
    setGearSaving(true); setError(null);
    try {
      await ensureProfile();
      const { error: e } = await supabase.from('gear_items').insert({
        user_id: user.id, name: data.name, brand: data.brand, model: data.model,
        category: data.category, condition: data.condition,
        purchase_date: data.purchase_date || null, purchase_price: data.purchase_price,
        weight_g: data.weight_g, expiry_date: data.expiry_date || null,
        last_maintenance_date: data.last_maintenance_date || null,
        next_maintenance_date: data.next_maintenance_date || null,
        notes: data.notes, serial_number: data.serial_number || null,
        usage_count: data.usage_count,
        image: data.image || 'https://images.unsplash.com/photo-1572698846920-cb1e563bbb30',
        alt: data.alt || data.name, tags: data.tags,
        source: 'manuel',
      });
      if (e) throw e;
      setShowAddModal(false);
      showToast('Équipement ajouté !');
      await loadGear();
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Erreur ajout'); }
    finally { setGearSaving(false); }
  };

  const handleEditItem = async (data: typeof EMPTY_FORM) => {
    if (!editingItem) return;
    setGearSaving(true); setError(null);
    try {
      const { error: e } = await supabase.from('gear_items').update({
        name: data.name, brand: data.brand, model: data.model, category: data.category,
        condition: data.condition, purchase_date: data.purchase_date || null,
        purchase_price: data.purchase_price, weight_g: data.weight_g,
        expiry_date: data.expiry_date || null, last_maintenance_date: data.last_maintenance_date || null,
        next_maintenance_date: data.next_maintenance_date || null, notes: data.notes,
        serial_number: data.serial_number || null, usage_count: data.usage_count,
        image: data.image, alt: data.alt || data.name, tags: data.tags,
      }).eq('id', editingItem.id).eq('user_id', user!.id);
      if (e) throw e;
      setEditingItem(null); setSelectedItem(null);
      showToast('Équipement modifié !');
      await loadGear();
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Erreur modification'); }
    finally { setGearSaving(false); }
  };

  const handleDeleteItem = async (id: string) => {
    if (!confirm('Supprimer cet équipement ?')) return;
    try {
      const { error: e } = await supabase.from('gear_items').delete().eq('id', id).eq('user_id', user!.id);
      if (e) throw e;
      setSelectedItem(null);
      await loadGear();
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Erreur suppression'); }
  };

  // ─── B1: Auto-fill from confirmed orders ────────────────────────────────────

  const autoFillFromOrders = useCallback(async () => {
    if (!user) return;
    try {
      // Get confirmed/delivered orders that haven't been imported yet
      const { data: ordersData } = await supabase
        .from('orders')
        .select('id, items')
        .eq('user_id', user.id)
        .in('status', ['confirmed', 'delivered', 'shipped']);

      if (!ordersData || ordersData.length === 0) return;

      // Get already imported order IDs
      const { data: existingImports } = await supabase
        .from('gear_items')
        .select('origin_order_id')
        .eq('user_id', user.id)
        .not('origin_order_id', 'is', null);

      const importedOrderIds = new Set((existingImports ?? []).map(e => e.origin_order_id));

      let totalAdded = 0;
      for (const order of ordersData) {
        if (importedOrderIds.has(order.id)) continue;
        const items = Array.isArray(order.items) ? order.items : [];
        for (const item of items) {
          if (!item.name) continue;
          await supabase.from('gear_items').insert({
            user_id: user.id,
            name: item.name,
            category: 'autre',
            condition: 'neuf',
            source: 'achat',
            origin_order_id: order.id,
            purchase_price: item.unit_price_eur ?? 0,
            weight_g: 0,
            brand: '',
            model: '',
            notes: `Importé automatiquement depuis la commande`,
            image: 'https://images.unsplash.com/photo-1572698846920-cb1e563bbb30',
            alt: item.name,
            tags: [],
            acquired_at: new Date().toISOString().split('T')[0],
          });
          totalAdded++;
        }
      }
      if (totalAdded > 0) {
        showToast(`+ ${totalAdded} objet${totalAdded > 1 ? 's' : ''} ajouté${totalAdded > 1 ? 's' : ''} à ton inventaire depuis tes commandes`);
        await loadGear();
      }
    } catch {
      // Silent fail — auto-fill is best-effort
    }
  }, [user, supabase, loadGear]);

  // ─── Stock ──────────────────────────────────────────────────────────────────

  const loadProducts = useCallback(async () => {
    setStockLoading(true);
    try {
      const { data, error: e } = await supabase
        .from('shop_products')
        .select('id, slug, name, brand, category, price_eur, stock, is_active, transaction_type, image, image_alt')
        .is('deleted_at', null)
        .order('name');
      if (e) throw e;
      setProducts(data ?? []);
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Erreur chargement stock'); }
    finally { setStockLoading(false); }
  }, [supabase]);

  const handleStockAdjust = async (productId: string, delta: number, type: string, notes: string) => {
    try {
      const product = products.find((p) => p.id === productId);
      if (!product) return;
      const newStock = Math.max(0, product.stock + delta);
      const { error: e1 } = await supabase.from('shop_products').update({ stock: newStock, updated_at: new Date().toISOString() }).eq('id', productId);
      if (e1) throw e1;
      const { error: e2 } = await supabase.from('stock_movements').insert({
        product_id: productId, product_slug: product.slug, product_name: product.name,
        movement_type: type, quantity_change: delta,
        quantity_before: product.stock, quantity_after: newStock,
        reference_type: 'manual', reference_id: null,
        user_id: user?.id ?? null, notes: notes || 'Ajustement manuel',
      });
      if (e2) throw e2;
      showToast('Stock mis à jour !');
      await loadProducts();
      if (activeTab === 'movements') await loadMovements();
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Erreur ajustement stock'); }
  };

  // ─── Orders ─────────────────────────────────────────────────────────────────

  const loadOrders = useCallback(async () => {
    if (!user) return;
    setOrdersLoading(true);
    try {
      const { data, error: e } = await supabase
        .from('orders')
        .select('id, order_number, status, payment_method, total_eur, items, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);
      if (e) throw e;
      setOrders(data ?? []);
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Erreur chargement commandes'); }
    finally { setOrdersLoading(false); }
  }, [user, supabase]);

  // ─── Movements ──────────────────────────────────────────────────────────────

  const loadMovements = useCallback(async () => {
    setMovementsLoading(true);
    try {
      const { data, error: e } = await supabase
        .from('stock_movements')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      if (e) throw e;
      setMovements(data ?? []);
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Erreur chargement mouvements'); }
    finally { setMovementsLoading(false); }
  }, [supabase]);

  // ─── Effects ─────────────────────────────────────────────────────────────────

  useEffect(() => { loadGear(); }, [loadGear]);

  useEffect(() => {
    if (activeTab === 'stock') loadProducts();
    if (activeTab === 'orders') loadOrders();
    if (activeTab === 'movements') loadMovements();
  }, [activeTab, loadProducts, loadOrders, loadMovements]);

  // Auto-fill from orders when gear tab is active and user is logged in
  useEffect(() => {
    if (activeTab === 'gear' && user) {
      autoFillFromOrders();
    }
  }, [activeTab, user, autoFillFromOrders]);

  // ─── Derived ─────────────────────────────────────────────────────────────────

  const alerts = gear.filter((item) => {
    const expiry = getExpiryStatus(item);
    const maintenance = getMaintenanceStatus(item);
    return item.condition === 'à_remplacer' || expiry?.urgent || maintenance?.urgent;
  });

  const filteredGear = gear
    .filter((item) => {
      if (gearFilterCat !== 'all' && item.category !== gearFilterCat) return false;
      if (gearFilterCond !== 'all' && item.condition !== gearFilterCond) return false;
      if (gearSearch && !item.name.toLowerCase().includes(gearSearch.toLowerCase()) && !(item.brand ?? '').toLowerCase().includes(gearSearch.toLowerCase())) return false;
      return true;
    })
    .sort((a, b) => {
      if (gearSort === 'name') return a.name.localeCompare(b.name);
      if (gearSort === 'condition') return a.condition.localeCompare(b.condition);
      if (gearSort === 'purchase_date') return new Date(b.purchase_date || 0).getTime() - new Date(a.purchase_date || 0).getTime();
      if (gearSort === 'usage_count') return b.usage_count - a.usage_count;
      if (gearSort === 'weight_g') return a.weight_g - b.weight_g;
      return 0;
    });

  const filteredProducts = products.filter((p) =>
    !stockSearch || p.name.toLowerCase().includes(stockSearch.toLowerCase()) || p.brand.toLowerCase().includes(stockSearch.toLowerCase())
  );

  const filteredMovements = movements.filter((m) =>
    movementsFilter === 'all' || m.movement_type === movementsFilter
  );

  const totalGearValue = gear.reduce((s, i) => s + (i.purchase_price ?? 0), 0);
  const totalGearWeight = gear.reduce((s, i) => s + (i.weight_g ?? 0), 0);
  const lowStockCount = products.filter((p) => p.stock <= 3 && p.is_active).length;
  const totalStockValue = products.reduce((s, p) => s + p.price_eur * p.stock, 0);

  const TABS = [
    { id: 'gear' as const, label: 'Mon Équipement', icon: 'ArchiveBoxIcon', badge: gear.length },
    { id: 'stock' as const, label: 'Stock Boutique', icon: 'CubeIcon', badge: lowStockCount > 0 ? `⚠️ ${lowStockCount}` : products.length },
    { id: 'orders' as const, label: 'Commandes', icon: 'ShoppingBagIcon', badge: orders.length },
    { id: 'movements' as const, label: 'Mouvements', icon: 'ArrowsRightLeftIcon', badge: movements.length },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="pt-20">
        {/* Hero */}
        <section className="bg-dark-bg text-white py-10 px-4">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
                <Icon name="ArchiveBoxIcon" size={22} variant="outline" className="text-primary" />
              </div>
              <div>
                <p className="text-xs font-mono text-primary/80 tracking-widest uppercase">Inventaire Complet</p>
                <h1 className="text-2xl font-display font-800 tracking-tight">Gestion de l&apos;Inventaire</h1>
              </div>
            </div>
            <p className="text-white/60 text-sm max-w-xl mb-6">Équipements personnels, stock boutique, commandes et mouvements — tout en temps réel.</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Mes articles', value: gear.length, icon: 'ArchiveBoxIcon' },
                { label: 'Valeur équip.', value: `${totalGearValue.toLocaleString('fr-FR')} €`, icon: 'BanknotesIcon' },
                { label: 'Stock boutique', value: products.reduce((s, p) => s + p.stock, 0), icon: 'CubeIcon' },
                { label: 'Valeur stock', value: `${totalStockValue.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} €`, icon: 'ChartBarIcon' },
              ].map((stat) => (
                <div key={stat.label} className="rounded-xl p-3 border bg-white/5 border-white/10">
                  <p className="text-xs text-white/50 mb-1">{stat.label}</p>
                  <p className="text-xl font-display font-700 text-white">{stat.value}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <div className="max-w-7xl mx-auto px-4 py-6">
          {/* Tabs */}
          <div className="flex gap-1 mb-6 bg-muted p-1 rounded-xl overflow-x-auto">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap flex-shrink-0 ${activeTab === tab.id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              >
                <Icon name={tab.icon as Parameters<typeof Icon>[0]['name']} size={15} variant="outline" />
                {tab.label}
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-mono ${activeTab === tab.id ? 'bg-primary/10 text-primary' : 'bg-muted-foreground/20 text-muted-foreground'}`}>
                  {tab.badge}
                </span>
              </button>
            ))}
          </div>

          {/* Notifications */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-center justify-between">
              <span>{error}</span>
              <button type="button" onClick={() => setError(null)} className="text-red-400 hover:text-red-600">×</button>
            </div>
          )}

          {/* ── TAB: GEAR ── */}
          {activeTab === 'gear' && (
            <>
              {!user ? (
                <div className="text-center py-16 text-muted-foreground">
                  <Icon name="ArchiveBoxIcon" size={40} className="mx-auto mb-3 opacity-30" />
                  <p className="font-display font-700 text-foreground mb-1">Connectez-vous</p>
                  <p className="text-sm">Connectez-vous pour gérer votre inventaire personnel.</p>
                </div>
              ) : (
                <>
                  {alerts.length > 0 && (
                    <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl p-4">
                      <h3 className="text-sm font-semibold text-amber-800 mb-2 flex items-center gap-2">
                        <Icon name="BellAlertIcon" size={16} variant="outline" className="text-amber-600" />
                        {alerts.length} alerte{alerts.length > 1 ? 's' : ''}
                      </h3>
                      <div className="space-y-1">
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

                  {/* Filters */}
                  <div className="flex flex-wrap gap-3 mb-6">
                    <div className="flex-1 min-w-48 relative">
                      <Icon name="MagnifyingGlassIcon" size={16} variant="outline" className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <input type="text" placeholder="Rechercher..." value={gearSearch} onChange={(e) => setGearSearch(e.target.value)} className="w-full pl-9 pr-3 py-2 rounded-lg border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                    </div>
                    <select value={gearFilterCat} onChange={(e) => setGearFilterCat(e.target.value as Category | 'all')} className="px-3 py-2 rounded-lg border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                      <option value="all">Toutes catégories</option>
                      {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                    <select value={gearFilterCond} onChange={(e) => setGearFilterCond(e.target.value as Condition | 'all')} className="px-3 py-2 rounded-lg border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                      <option value="all">Tous états</option>
                      {Object.entries(CONDITION_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                    </select>
                    <select value={gearSort} onChange={(e) => setGearSort(e.target.value as typeof gearSort)} className="px-3 py-2 rounded-lg border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                      <option value="name">Nom</option>
                      <option value="condition">État</option>
                      <option value="purchase_date">Date d&apos;achat</option>
                      <option value="usage_count">Utilisations</option>
                      <option value="weight_g">Poids</option>
                    </select>
                    <div className="flex gap-1 border border-border rounded-lg overflow-hidden">
                      <button onClick={() => setGearView('grid')} className={`px-3 py-2 text-sm transition-colors ${gearView === 'grid' ? 'bg-primary text-white' : 'bg-card text-muted-foreground'}`}>
                        <Icon name="Squares2X2Icon" size={16} variant="outline" />
                      </button>
                      <button onClick={() => setGearView('list')} className={`px-3 py-2 text-sm transition-colors ${gearView === 'list' ? 'bg-primary text-white' : 'bg-card text-muted-foreground'}`}>
                        <Icon name="ListBulletIcon" size={16} variant="outline" />
                      </button>
                    </div>
                    {/* Add buttons */}
                    <button type="button" onClick={() => setShowPhotoModal(true)} className="flex items-center gap-2 px-4 py-2 bg-secondary text-secondary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity">
                      <Icon name="CameraIcon" size={16} variant="outline" />
                      Par photo
                    </button>
                    <button type="button" onClick={() => setShowAddModal(true)} className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity">
                      <Icon name="PlusIcon" size={16} variant="outline" />
                      Ajouter
                    </button>
                  </div>

                  {gearLoading ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {[1, 2, 3, 4, 5, 6].map((i) => <div key={i} className="h-48 rounded-xl bg-muted animate-pulse" />)}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                      <div className="lg:col-span-2">
                        {gearView === 'grid' ? (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {filteredGear.map((item) => {
                              const expiry = getExpiryStatus(item);
                              const cond = CONDITION_CONFIG[item.condition];
                              return (
                                <div key={item.id} className={`bg-card rounded-xl border cursor-pointer transition-all hover:shadow-md ${selectedItem?.id === item.id ? 'border-primary shadow-md' : 'border-border hover:border-primary/40'}`} onClick={() => setSelectedItem(item)}>
                                  <div className="relative h-36 rounded-t-xl overflow-hidden">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={item.image || 'https://images.unsplash.com/photo-1572698846920-cb1e563bbb30'} alt={item.alt || item.name} className="w-full h-full object-cover" />
                                    <div className="absolute top-2 left-2 flex gap-1 flex-wrap">
                                      <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${cond.bg} ${cond.color}`}>{cond.label}</span>
                                      {item.source === 'achat' && <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700 font-medium">Acheté</span>}
                                      {item.source === 'kit' && <span className="text-xs px-2 py-0.5 rounded-full bg-purple-50 border border-purple-200 text-purple-700 font-medium">Kit</span>}
                                    </div>
                                    {(expiry?.urgent || getMaintenanceStatus(item)?.urgent) && (
                                      <div className="absolute top-2 right-2 w-5 h-5 bg-amber-500 rounded-full flex items-center justify-center">
                                        <Icon name="ExclamationTriangleIcon" size={12} variant="solid" className="text-white" />
                                      </div>
                                    )}
                                    {item.is_listed_for_sale && (
                                      <div className="absolute bottom-2 right-2 px-2 py-0.5 bg-emerald-500 rounded-full text-white text-xs font-medium">En vente</div>
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
                                    {/* Sell button */}
                                    {!item.is_listed_for_sale && (
                                      <button
                                        type="button"
                                        onClick={(e) => { e.stopPropagation(); setSellingItem(item); }}
                                        className="mt-2 w-full py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-xs font-medium hover:bg-amber-100 transition-colors flex items-center justify-center gap-1"
                                      >
                                        <Icon name="TagIcon" size={12} variant="outline" />
                                        Vendre
                                      </button>
                                    )}
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
                                  <div className="text-right flex-shrink-0 flex flex-col items-end gap-1">
                                    <p className="text-xs font-mono font-semibold">{item.purchase_price} €</p>
                                    <p className="text-xs text-muted-foreground">{item.weight_g}g</p>
                                    {!item.is_listed_for_sale && (
                                      <button
                                        type="button"
                                        onClick={(e) => { e.stopPropagation(); setSellingItem(item); }}
                                        className="px-2 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-xs font-medium hover:bg-amber-100 transition-colors"
                                      >
                                        Vendre
                                      </button>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                        {filteredGear.length === 0 && !gearLoading && (
                          <div className="text-center py-16 text-muted-foreground">
                            <Icon name="ArchiveBoxXMarkIcon" size={40} variant="outline" className="mx-auto mb-3 opacity-40" />
                            <p className="text-sm font-medium text-foreground mb-1">Aucun article trouvé</p>
                            <p className="text-sm">Ajoutez votre premier équipement !</p>
                          </div>
                        )}
                      </div>

                      {/* Detail panel */}
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
                              {selectedItem.source && (
                                <div className="mb-3 flex items-center gap-2">
                                  {selectedItem.source === 'achat' && <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700">🛒 Acheté sur LKDV</span>}
                                  {selectedItem.source === 'kit' && <span className="text-xs px-2 py-0.5 rounded-full bg-purple-50 border border-purple-200 text-purple-700">📦 Depuis un kit</span>}
                                  {selectedItem.source === 'occasion' && <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700">♻️ Occasion</span>}
                                </div>
                              )}
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
                              {selectedItem.tags?.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-3">
                                  {selectedItem.tags.map((tag) => <span key={tag} className="text-xs px-2 py-0.5 bg-secondary/10 text-secondary rounded-full">{tag}</span>)}
                                </div>
                              )}
                              <div className="flex gap-2 mt-4">
                                <button type="button" onClick={() => setEditingItem(selectedItem)} className="flex-1 py-2 rounded-lg bg-secondary text-secondary-foreground text-xs font-medium hover:opacity-90 transition-opacity flex items-center justify-center gap-1">
                                  <Icon name="PencilIcon" size={12} variant="outline" />Modifier
                                </button>
                                <button type="button" onClick={() => handleDeleteItem(selectedItem.id)} className="px-3 py-2 rounded-lg bg-red-50 text-red-600 border border-red-200 text-xs hover:bg-red-100 transition-colors">
                                  <Icon name="TrashIcon" size={14} variant="outline" />
                                </button>
                              </div>
                              {!selectedItem.is_listed_for_sale && (
                                <button
                                  type="button"
                                  onClick={() => setSellingItem(selectedItem)}
                                  className="mt-2 w-full py-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-xs font-medium hover:bg-amber-100 transition-colors flex items-center justify-center gap-1"
                                >
                                  <Icon name="TagIcon" size={12} variant="outline" />
                                  Vendre cet article
                                </button>
                              )}
                              {selectedItem.is_listed_for_sale && (
                                <div className="mt-2 py-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-medium text-center">
                                  ✓ Annonce active sur la marketplace
                                </div>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div className="bg-card rounded-xl border border-border p-8 text-center">
                            <Icon name="CursorArrowRaysIcon" size={32} variant="outline" className="mx-auto mb-3 text-muted-foreground opacity-50" />
                            <p className="text-sm text-muted-foreground">Sélectionnez un article pour voir ses détails</p>
                          </div>
                        )}
                        {/* Health chart */}
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
                          <div className="mt-3 pt-3 border-t border-border grid grid-cols-2 gap-2 text-xs">
                            <div><span className="text-muted-foreground">Valeur totale</span><p className="font-mono font-semibold">{totalGearValue.toLocaleString('fr-FR')} €</p></div>
                            <div><span className="text-muted-foreground">Poids total</span><p className="font-mono font-semibold">{(totalGearWeight / 1000).toFixed(1)} kg</p></div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </>
          )}

          {/* ── TAB: STOCK ── */}
          {activeTab === 'stock' && (
            <div>
              <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Icon name="MagnifyingGlassIcon" size={16} variant="outline" className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input type="text" placeholder="Rechercher un produit..." value={stockSearch} onChange={(e) => setStockSearch(e.target.value)} className="pl-9 pr-3 py-2 rounded-lg border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 w-64" />
                  </div>
                </div>
                <div className="flex gap-3 text-sm">
                  <div className="px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-700 font-mono">
                    {products.filter((p) => p.stock > 10).length} en stock
                  </div>
                  <div className="px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 font-mono">
                    {products.filter((p) => p.stock > 0 && p.stock <= 10).length} faible
                  </div>
                  <div className="px-3 py-1.5 bg-red-50 border border-red-200 rounded-lg text-red-700 font-mono">
                    {products.filter((p) => p.stock === 0).length} rupture
                  </div>
                </div>
              </div>

              {stockLoading ? (
                <div className="space-y-2">{[1, 2, 3, 4, 5].map((i) => <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />)}</div>
              ) : (
                <div className="bg-card rounded-xl border border-border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 border-b border-border">
                      <tr>
                        <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Produit</th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground hidden sm:table-cell">Catégorie</th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground hidden md:table-cell">Type</th>
                        <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Prix</th>
                        <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Stock</th>
                        <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {filteredProducts.map((product) => (
                        <tr key={product.id} className="hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={product.image || 'https://images.unsplash.com/photo-1572698846920-cb1e563bbb30'} alt={product.image_alt || product.name} className="w-9 h-9 rounded-lg object-cover flex-shrink-0" />
                              <div>
                                <p className="font-medium text-sm leading-tight">{product.name}</p>
                                <p className="text-xs text-muted-foreground">{product.brand}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground hidden sm:table-cell">{product.category}</td>
                          <td className="px-4 py-3 hidden md:table-cell">
                            <span className="text-xs px-2 py-0.5 rounded-full bg-secondary/10 text-secondary">{product.transaction_type}</span>
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-sm">{product.price_eur} €</td>
                          <td className="px-4 py-3 text-right">
                            <span className={`inline-block font-mono font-semibold text-sm px-2 py-0.5 rounded-lg ${
                              product.stock === 0 ? 'bg-red-50 text-red-600 border border-red-200' :
                              product.stock <= 3 ? 'bg-amber-50 text-amber-600 border border-amber-200': 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                            }`}>
                              {product.stock}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              type="button"
                              onClick={() => setAdjustingProduct(product)}
                              className="px-3 py-1.5 text-xs bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-colors font-medium"
                            >
                              Ajuster
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {filteredProducts.length === 0 && (
                    <div className="text-center py-12 text-muted-foreground">
                      <Icon name="CubeIcon" size={32} variant="outline" className="mx-auto mb-3 opacity-40" />
                      <p className="text-sm">Aucun produit trouvé</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── TAB: ORDERS ── */}
          {activeTab === 'orders' && (
            <div>
              {!user ? (
                <div className="text-center py-16 text-muted-foreground">
                  <Icon name="ShoppingBagIcon" size={40} className="mx-auto mb-3 opacity-30" />
                  <p className="font-display font-700 text-foreground mb-1">Connectez-vous</p>
                  <p className="text-sm">Connectez-vous pour voir vos commandes.</p>
                </div>
              ) : ordersLoading ? (
                <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />)}</div>
              ) : orders.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground">
                  <Icon name="ShoppingBagIcon" size={40} variant="outline" className="mx-auto mb-3 opacity-40" />
                  <p className="text-sm font-medium text-foreground mb-1">Aucune commande</p>
                  <p className="text-sm">Vos commandes apparaîtront ici après un achat.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {orders.map((order) => {
                    const statusCfg = ORDER_STATUS_CONFIG[order.status] ?? ORDER_STATUS_CONFIG.pending;
                    const itemsList = Array.isArray(order.items) ? order.items : [];
                    return (
                      <div key={order.id} className="bg-card rounded-xl border border-border p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <p className="font-mono text-sm font-semibold text-primary">{order.order_number}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {new Date(order.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`text-xs px-2 py-1 rounded-lg border font-medium ${statusCfg.color}`}>{statusCfg.label}</span>
                            <span className="text-sm font-mono font-semibold">{Number(order.total_eur).toFixed(2)} €</span>
                          </div>
                        </div>
                        {itemsList.length > 0 && (
                          <div className="border-t border-border pt-3 space-y-1">
                            {itemsList.slice(0, 3).map((item, idx) => (
                              <div key={idx} className="flex items-center justify-between text-xs text-muted-foreground">
                                <span>{item.name} × {item.quantity}</span>
                                <span className="font-mono">{(item.unit_price_eur * item.quantity).toFixed(2)} €</span>
                              </div>
                            ))}
                            {itemsList.length > 3 && <p className="text-xs text-muted-foreground">+{itemsList.length - 3} autre(s) article(s)</p>}
                          </div>
                        )}
                        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border text-xs text-muted-foreground">
                          <Icon name="CreditCardIcon" size={12} variant="outline" />
                          <span>{order.payment_method}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── TAB: MOVEMENTS ── */}
          {activeTab === 'movements' && (
            <div>
              <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
                <div className="flex gap-2 flex-wrap">
                  {['all', 'sale', 'restock', 'purchase', 'rental', 'adjustment', 'return'].map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setMovementsFilter(type)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${movementsFilter === type ? 'bg-primary text-white' : 'bg-muted text-muted-foreground hover:text-foreground'}`}
                    >
                      {type === 'all' ? 'Tous' : (MOVEMENT_CONFIG[type]?.label ?? type)}
                    </button>
                  ))}
                </div>
                <button type="button" onClick={loadMovements} className="flex items-center gap-2 px-3 py-1.5 text-xs bg-muted text-muted-foreground rounded-lg hover:text-foreground transition-colors">
                  <Icon name="ArrowPathIcon" size={14} variant="outline" />
                  Actualiser
                </button>
              </div>

              {movementsLoading ? (
                <div className="space-y-2">{[1, 2, 3, 4, 5].map((i) => <div key={i} className="h-14 rounded-xl bg-muted animate-pulse" />)}</div>
              ) : filteredMovements.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground">
                  <Icon name="ArrowsRightLeftIcon" size={40} variant="outline" className="mx-auto mb-3 opacity-40" />
                  <p className="text-sm font-medium text-foreground mb-1">Aucun mouvement</p>
                  <p className="text-sm">Les mouvements de stock apparaîtront ici.</p>
                </div>
              ) : (
                <div className="bg-card rounded-xl border border-border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 border-b border-border">
                      <tr>
                        <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Produit</th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground hidden sm:table-cell">Type</th>
                        <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Qté</th>
                        <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground hidden md:table-cell">Avant → Après</th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground hidden lg:table-cell">Notes</th>
                        <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {filteredMovements.map((mv) => {
                        const cfg = MOVEMENT_CONFIG[mv.movement_type] ?? { label: mv.movement_type, color: 'text-gray-600 bg-gray-50', icon: '📋' };
                        return (
                          <tr key={mv.id} className="hover:bg-muted/30 transition-colors">
                            <td className="px-4 py-3">
                              <p className="font-medium text-sm leading-tight">{mv.product_name}</p>
                              <p className="text-xs text-muted-foreground font-mono">{mv.product_slug}</p>
                            </td>
                            <td className="px-4 py-3 hidden sm:table-cell">
                              <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${cfg.color}`}>
                                {cfg.icon} {cfg.label}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <span className={`font-mono font-semibold text-sm ${mv.quantity_change > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                {mv.quantity_change > 0 ? '+' : ''}{mv.quantity_change}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right hidden md:table-cell">
                              <span className="font-mono text-xs text-muted-foreground">{mv.quantity_before} → {mv.quantity_after}</span>
                            </td>
                            <td className="px-4 py-3 hidden lg:table-cell">
                              <p className="text-xs text-muted-foreground truncate max-w-xs">{mv.notes || '—'}</p>
                            </td>
                            <td className="px-4 py-3 text-right text-xs text-muted-foreground whitespace-nowrap">
                              {new Date(mv.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Modals */}
      {showAddModal && (
        <GearFormModal title="Ajouter un équipement" initial={EMPTY_FORM} onSave={handleAddItem} onClose={() => setShowAddModal(false)} saving={gearSaving} />
      )}
      {showPhotoModal && (
        <PhotoRecognitionModal onClose={() => setShowPhotoModal(false)} onAdd={handleAddItem} />
      )}
      {editingItem && (
        <GearFormModal
          title="Modifier l'équipement"
          initial={{
            name: editingItem.name, brand: editingItem.brand ?? '', model: editingItem.model ?? '',
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
          saving={gearSaving}
        />
      )}
      {adjustingProduct && (
        <StockAdjustModal
          product={adjustingProduct}
          onClose={() => setAdjustingProduct(null)}
          onSave={handleStockAdjust}
        />
      )}
      {sellingItem && (
        <SellFromInventoryModal
          item={sellingItem}
          onClose={() => setSellingItem(null)}
          onSold={() => { showToast('Annonce publiée sur la marketplace !'); loadGear(); }}
        />
      )}

      {/* Toast */}
      {toastMsg && <Toast message={toastMsg} onDone={() => setToastMsg(null)} />}

      <Footer />
    </div>
  );
}