// src/components/inventaire/QuickAddCard.tsx
'use client';

import React, { useState } from 'react';
import { GearItemData } from '@/lib/mock/inventaire-marceline';

interface QuickAddCardProps {
  onAddSuccess?: (newItem: Partial<GearItemData>) => void;
}

export default function QuickAddCard({ onAddSuccess }: QuickAddCardProps) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState<GearItemData['category']>('vêtement');
  const [brand, setBrand] = useState('');
  const [weightG, setWeightG] = useState('');
  const [price, setPrice] = useState('');
  const [purchaseDate, setPurchaseDate] = useState('');
  const [condition, setCondition] = useState<GearItemData['condition']>('neuf');
  const [selectedKits, setSelectedKits] = useState<string[]>(['k-1']);
  const [notes, setNotes] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const toggleKit = (kitId: string) => {
    setSelectedKits((prev) =>
      prev.includes(kitId) ? prev.filter((id) => id !== kitId) : [...prev, kitId]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const newItem: Partial<GearItemData> = {
      name,
      category,
      brand: brand || 'Marque',
      weight_g: Number(weightG) || 450,
      purchase_price: Number(price) || 0,
      purchase_date: purchaseDate || '2026-07-27',
      condition,
      notes,
      image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=800&q=80',
      quantity: 1,
      is_favorite: false,
    };

    setSubmitted(true);
    if (onAddSuccess) {
      onAddSuccess(newItem);
    }
    setTimeout(() => {
      setSubmitted(false);
      setName('');
      setBrand('');
      setWeightG('');
      setPrice('');
      setNotes('');
    }, 2500);
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
          Ajouter à <span className="italic font-serif font-normal text-[#82C39B]">l'inventaire</span>
        </h3>
        <p className="text-xs text-white/70 mt-1">
          Trois façons : scanner, chercher dans le catalogue, ou saisir à la main.
        </p>
      </div>

      {/* 2 Quick Action Buttons */}
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => alert('Ouverture du scanner QR / Code-barres...')}
          className="bg-[#23382B] hover:bg-[#2D4837] border border-white/10 rounded-2xl p-3 text-center transition-all group"
        >
          <svg className="w-5 h-5 mx-auto mb-1 text-[#82C39B]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M3 7V5a2 2 0 012-2h2M17 3h2a2 2 0 012 2v2M21 17v2a2 2 0 01-2 2h-2M7 21H5a2 2 0 01-2-2v-2" />
            <rect x="7" y="7" width="10" height="10" rx="1" />
          </svg>
          <span className="block text-xs font-bold text-white">Scanner</span>
          <span className="block text-[10px] text-white/60">Code-barres / QR</span>
        </button>

        <button
          type="button"
          onClick={() => alert('Recherche catalogue...')}
          className="bg-[#23382B] hover:bg-[#2D4837] border border-white/10 rounded-2xl p-3 text-center transition-all group"
        >
          <svg className="w-5 h-5 mx-auto mb-1 text-[#82C39B]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M4 6h16M4 12h16M4 18h7" />
          </svg>
          <span className="block text-xs font-bold text-white">Catalogue</span>
          <span className="block text-[10px] text-white/60">4 250 réf.</span>
        </button>
      </div>

      {/* Divider */}
      <div className="relative flex items-center justify-center my-2">
        <div className="border-t border-white/10 w-full" />
        <span className="absolute bg-[#132219] px-3 text-[10px] font-bold text-white/40 uppercase tracking-widest">
          OU SAISIR
        </span>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        <div>
          <label className="block text-[11px] font-semibold text-white/80 mb-1">
            Nom de l'article *
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
              placeholder="Arc'teryx"
              className="w-full bg-[#1C2E23] border border-white/10 rounded-xl px-3 py-2 text-white placeholder-white/40 focus:outline-none focus:border-[#82C39B]"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-white/80 mb-1">Poids (g) *</label>
            <input
              type="number"
              value={weightG}
              onChange={(e) => setWeightG(e.target.value)}
              placeholder="455"
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
              placeholder="219 €"
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

        {/* Kits checkboxes */}
        <div>
          <label className="block text-[11px] font-semibold text-white/80 mb-1.5">
            Ajouter à un ou plusieurs kits
          </label>
          <div className="grid grid-cols-2 gap-2">
            {[
              { id: 'k-1', label: 'C - Bivouac 3 saisons' },
              { id: 'k-2', label: 'B - Bivouac Hivernal' },
              { id: 'k-3', label: 'A - Randonnée journée' },
              { id: 'k-4', label: 'D - Trail compétition' },
            ].map((kit) => (
              <button
                key={kit.id}
                type="button"
                onClick={() => toggleKit(kit.id)}
                className={`p-2 rounded-xl text-left border text-[11px] transition-all flex items-center gap-2 ${
                  selectedKits.includes(kit.id)
                    ? 'bg-[#23382B] border-[#82C39B] text-white font-bold'
                    : 'bg-[#1C2E23] border-transparent text-white/60'
                }`}
              >
                <span
                  className={`w-3.5 h-3.5 rounded-md flex items-center justify-center text-[9px] font-extrabold ${
                    selectedKits.includes(kit.id) ? 'bg-[#82C39B] text-[#132219]' : 'border border-white/30'
                  }`}
                >
                  {selectedKits.includes(kit.id) ? '✓' : ''}
                </span>
                <span className="truncate">{kit.label}</span>
              </button>
            ))}
          </div>
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

        {/* Submit Button */}
        <button
          type="submit"
          className="w-full bg-white text-[#132219] font-extrabold text-xs py-3 rounded-2xl hover:bg-[#F5F2EA] transition-all shadow-lg flex items-center justify-center gap-2 mt-2"
        >
          {submitted ? (
            <span className="text-emerald-700 font-extrabold flex items-center gap-1">
              ✓ Article ajouté à l&apos;inventaire !
            </span>
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
