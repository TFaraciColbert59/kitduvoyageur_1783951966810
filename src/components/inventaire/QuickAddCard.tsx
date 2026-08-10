// src/components/inventaire/QuickAddCard.tsx
'use client';

import React, { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { GearItemData } from '@/lib/mock/inventaire-marceline';

interface QuickAddCardProps {
  onAddSuccess?: (newItem: Partial<GearItemData>) => void;
}

export default function QuickAddCard({ onAddSuccess }: QuickAddCardProps) {
  const { user } = useAuth();
  const supabase = createClient();

  const [name, setName] = useState('');
  const [category, setCategory] = useState<GearItemData['category']>('vêtement');
  const [brand, setBrand] = useState('');
  const [weightG, setWeightG] = useState('');
  const [price, setPrice] = useState('');
  const [purchaseDate, setPurchaseDate] = useState('');
  const [condition, setCondition] = useState<GearItemData['condition']>('neuf');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    if (!user) {
      setErrorMsg('Connectez-vous pour ajouter un équipement.');
      return;
    }

    setSaving(true);
    setErrorMsg(null);

    const payload = {
      user_id: user.id,
      name,
      brand: brand || '',
      model: '',
      category,
      condition,
      weight_g: Number(weightG) || 0,
      purchase_price: Number(price) || 0,
      ...(purchaseDate ? { purchase_date: purchaseDate } : {}),
      quantity: 1,
      is_favorite: false,
      image: '/assets/images/no_image.png',
      alt: name,
      notes,
      source: 'manuel',
    };

    try {
      const { data: inserted, error } = await supabase
        .from('gear_items')
        .insert(payload)
        .select()
        .single();

      if (error) throw error;

      setSubmitted(true);
      if (onAddSuccess && inserted) {
        onAddSuccess({ ...payload, id: inserted.id });
      }
      setTimeout(() => {
        setSubmitted(false);
        setName('');
        setBrand('');
        setWeightG('');
        setPrice('');
        setPurchaseDate('');
        setNotes('');
      }, 2500);
    } catch (err) {
      console.error('Erreur ajout équipement (QuickAdd):', err);
      setErrorMsg("Impossible d'ajouter l'équipement. Réessayez.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-[#132219] text-white rounded-3xl p-6 shadow-xl border border-[#23382B] space-y-5">
      {/* Top Header Badge */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-extrabold tracking-widest text-[#82C39B] bg-[#23382B] px-3 py-1 rounded-full uppercase">
          NOUVEL ARTICLE
        </span>
      </div>

      <div>
        <h3 className="text-xl font-extrabold text-white font-display">
          Ajouter à <span className="italic font-serif font-normal text-[#82C39B]">l&apos;inventaire</span>
        </h3>
        <p className="text-xs text-white/70 mt-1">
          Saisissez manuellement un article pour le suivre dans votre inventaire.
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        <div>
          <label className="block text-[11px] font-semibold text-white/80 mb-1">
            Nom de l&apos;article *
          </label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex. Veste Arc'teryx Beta AR"
            className="w-full bg-[#1C2E23] border border-white/10 rounded-xl px-3 py-2.5 text-white placeholder-white/40 focus:outline-none focus:border-[#82C39B] transition-colors"
          />
        </div>

        {/* Category Pills */}
        <div>
          <label className="block text-[11px] font-semibold text-white/80 mb-1.5">
            Catégorie *
          </label>
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                { id: 'couchage', label: 'Couchage' },
                { id: 'portage', label: 'Portage' },
                { id: 'cuisine', label: 'Cuisine' },
                { id: 'vêtement', label: 'Vêtements' },
                { id: 'sécurité', label: 'Sécurité' },
                { id: 'navigation', label: 'Nav/Élec' },
              ] as const
            ).map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setCategory(cat.id)}
                className={`px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all ${
                  category === cat.id
                    ? 'bg-[#82C39B] text-[#132219] font-extrabold shadow-sm'
                    : 'bg-[#1C2E23] text-white/70 hover:bg-[#23382B]'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Brand & Weight */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-semibold text-white/80 mb-1">Marque</label>
            <input
              type="text"
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              placeholder="Optional"
              className="w-full bg-[#1C2E23] border border-white/10 rounded-xl px-3 py-2 text-white placeholder-white/40 focus:outline-none focus:border-[#82C39B]"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-white/80 mb-1">Poids (g)</label>
            <input
              type="number"
              value={weightG}
              onChange={(e) => setWeightG(e.target.value)}
              placeholder="0"
              className="w-full bg-[#1C2E23] border border-white/10 rounded-xl px-3 py-2 text-white placeholder-white/40 focus:outline-none focus:border-[#82C39B]"
            />
          </div>
        </div>

        {/* Price & Purchase Date */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-semibold text-white/80 mb-1">Prix d&apos;achat (€)</label>
            <input
              type="number"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="0"
              className="w-full bg-[#1C2E23] border border-white/10 rounded-xl px-3 py-2 text-white placeholder-white/40 focus:outline-none focus:border-[#82C39B]"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-white/80 mb-1">Date d&apos;achat</label>
            <input
              type="date"
              value={purchaseDate}
              onChange={(e) => setPurchaseDate(e.target.value)}
              className="w-full bg-[#1C2E23] border border-white/10 rounded-xl px-3 py-2 text-white/80 focus:outline-none focus:border-[#82C39B]"
            />
          </div>
        </div>

        {/* Condition Dropdown */}
        <div>
          <label className="block text-[11px] font-semibold text-white/80 mb-1">État initial</label>
          <select
            value={condition}
            onChange={(e) => setCondition(e.target.value as GearItemData['condition'])}
            className="w-full bg-[#1C2E23] border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#82C39B]"
          >
            <option value="neuf">Neuf - jamais utilisé</option>
            <option value="excellent">Excellent - très peu servi</option>
            <option value="bon">Bon état</option>
            <option value="usé">Usé - à surveiller</option>
            <option value="à_réparer">À réparer</option>
          </select>
        </div>

        {/* Personal Notes */}
        <div>
          <label className="block text-[11px] font-semibold text-white/80 mb-1">
            Notes personnelles
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Ex. Reçu de mon frère, ajusté après réparation..."
            rows={2}
            className="w-full bg-[#1C2E23] border border-white/10 rounded-xl p-2.5 text-white placeholder-white/40 focus:outline-none focus:border-[#82C39B] resize-none"
          />
        </div>

        {/* Error */}
        {errorMsg && (
          <p className="text-[11px] font-semibold text-red-300 bg-red-950/40 border border-red-800/40 rounded-lg px-3 py-2">
            {errorMsg}
          </p>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={saving}
          className="w-full bg-white text-[#132219] font-extrabold text-xs py-3 rounded-2xl hover:bg-[#F5F2EA] transition-all shadow-lg flex items-center justify-center gap-2 mt-2 disabled:opacity-60"
        >
          {submitted ? (
            <span className="text-emerald-700 font-extrabold flex items-center gap-1">
              ✓ Article ajouté à l&apos;inventaire !
            </span>
          ) : saving ? (
            <span>Ajout en cours…</span>
          ) : (
            <>
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              <span>Ajouter l&apos;article</span>
            </>
          )}
        </button>
      </form>
    </div>
  );
}