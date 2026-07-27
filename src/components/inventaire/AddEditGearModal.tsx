'use client';

import React, { useState, useEffect } from 'react';
import Icon from '@/components/ui/AppIcon';
import { GearItemData } from '@/lib/mock/inventaire-marceline';

interface AddEditGearModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialItem?: GearItemData | null;
  defaultCategory?: string;
  onSave: (itemData: Partial<GearItemData>) => Promise<void>;
}

export default function AddEditGearModal({
  isOpen,
  onClose,
  initialItem,
  defaultCategory,
  onSave,
}: AddEditGearModalProps) {
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [category, setCategory] = useState<GearItemData['category']>('couchage');
  const [condition, setCondition] = useState<GearItemData['condition']>('excellent');
  const [weightG, setWeightG] = useState<number>(500);
  const [price, setPrice] = useState<number>(0);
  const [quantity, setQuantity] = useState<number>(1);
  const [image, setImage] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (initialItem) {
      setName(initialItem.name || '');
      setBrand(initialItem.brand || '');
      setModel(initialItem.model || '');
      setCategory(initialItem.category || 'couchage');
      setCondition(initialItem.condition || 'excellent');
      setWeightG(initialItem.weight_g || 0);
      setPrice(initialItem.purchase_price || 0);
      setQuantity(initialItem.quantity || 1);
      setImage(initialItem.image || '');
      setNotes(initialItem.notes || '');
    } else {
      setName('');
      setBrand('');
      setModel('');
      setCategory((defaultCategory as GearItemData['category']) || 'couchage');
      setCondition('excellent');
      setWeightG(500);
      setPrice(0);
      setQuantity(1);
      setImage('https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?auto=format&fit=crop&w=800&q=80');
      setNotes('');
    }
  }, [initialItem, defaultCategory, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onSave({
        id: initialItem?.id,
        name,
        brand,
        model,
        category,
        condition,
        weight_g: Number(weightG) || 0,
        purchase_price: Number(price) || 0,
        quantity: Number(quantity) || 1,
        image: image || 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?auto=format&fit=crop&w=800&q=80',
        alt: name,
        notes,
      });
      setSaving(false);
      onClose();
    } catch {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fade-in font-sans">
      <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-slide-up flex flex-col max-h-[90vh]">
        
        {/* Modal Header */}
        <div className="p-6 border-b border-[#1C2620]/10 flex justify-between items-center bg-[#F5F3ED]">
          <div>
            <h3 className="font-display font-800 text-xl text-[#132219]">
              {initialItem ? 'Modifier l\'équipement' : 'Ajouter un article'}
            </h3>
            <p className="text-xs text-[#132219]/60 mt-0.5">
              Renseignez les détails pour calculer exactement le poids de vos kits.
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#132219]/10 hover:bg-[#132219]/20 flex items-center justify-center text-[#132219] transition-colors"
          >
            <Icon name="XMarkIcon" size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 flex-1">
          
          <div>
            <label className="block text-xs font-bold text-[#132219] mb-1">Nom de l&apos;article *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Tente MSR Hubba Hubba NX 2P"
              className="w-full bg-[#F5F3ED] border border-[#E8E4D8] rounded-xl px-4 py-2.5 text-xs sm:text-sm text-[#132219] font-semibold outline-none focus:ring-2 focus:ring-emerald-500"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-[#132219] mb-1">Marque *</label>
              <input
                type="text"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                placeholder="Ex: MSR"
                className="w-full bg-[#F5F3ED] border border-[#E8E4D8] rounded-xl px-3 py-2 text-xs text-[#132219] font-medium outline-none focus:ring-2 focus:ring-emerald-500"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#132219] mb-1">Modèle</label>
              <input
                type="text"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="Ex: Hubba Hubba NX"
                className="w-full bg-[#F5F3ED] border border-[#E8E4D8] rounded-xl px-3 py-2 text-xs text-[#132219] font-medium outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-[#132219] mb-1">Catégorie</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as GearItemData['category'])}
                className="w-full bg-[#F5F3ED] border border-[#E8E4D8] rounded-xl px-3 py-2 text-xs text-[#132219] font-semibold outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="couchage">🛏️ Couchage & abri</option>
                <option value="portage">🎒 Portage & sacs</option>
                <option value="cuisine">🍳 Cuisine & eau</option>
                <option value="vêtement">🧥 Vêtements</option>
                <option value="navigation">🧭 Navigation & élec</option>
                <option value="sécurité">🛡️ Sécurité</option>
                <option value="autre">📦 Autre</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#132219] mb-1">État du matériel</label>
              <select
                value={condition}
                onChange={(e) => setCondition(e.target.value as GearItemData['condition'])}
                className="w-full bg-[#F5F3ED] border border-[#E8E4D8] rounded-xl px-3 py-2 text-xs text-[#132219] font-semibold outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="neuf">✨ Neuf</option>
                <option value="excellent">🟢 Excellent état</option>
                <option value="bon">🔵 Bon état</option>
                <option value="usé">🟠 Usé moyen</option>
                <option value="à_réparer">⚠️ À réparer</option>
                <option value="à_remplacer">🔴 À remplacer</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-[#132219] mb-1">Poids (grammes)</label>
              <input
                type="number"
                min={0}
                value={weightG}
                onChange={(e) => setWeightG(Number(e.target.value))}
                className="w-full bg-[#F5F3ED] border border-[#E8E4D8] rounded-xl px-3 py-2 text-xs font-mono font-bold text-[#132219] outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#132219] mb-1">Prix d&apos;achat (€)</label>
              <input
                type="number"
                min={0}
                value={price}
                onChange={(e) => setPrice(Number(e.target.value))}
                className="w-full bg-[#F5F3ED] border border-[#E8E4D8] rounded-xl px-3 py-2 text-xs font-mono font-bold text-[#132219] outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#132219] mb-1">Quantité</label>
              <input
                type="number"
                min={1}
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
                className="w-full bg-[#F5F3ED] border border-[#E8E4D8] rounded-xl px-3 py-2 text-xs font-mono font-bold text-[#132219] outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-[#132219] mb-1">URL Photo de l&apos;équipement</label>
            <input
              type="text"
              value={image}
              onChange={(e) => setImage(e.target.value)}
              placeholder="https://..."
              className="w-full bg-[#F5F3ED] border border-[#E8E4D8] rounded-xl px-3 py-2 text-xs text-[#132219] font-medium outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[#132219] mb-1">Notes & Remarques</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Ex: Piquets de rechange inclus..."
              className="w-full bg-[#F5F3ED] border border-[#E8E4D8] rounded-xl p-3 text-xs text-[#132219] font-medium outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
            />
          </div>

          {/* Footer Actions */}
          <div className="pt-3 flex justify-end gap-3 border-t border-[#1C2620]/10">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-[#132219]/60 hover:text-[#132219] rounded-full"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 bg-[#132219] hover:bg-[#2D5A3D] text-white font-extrabold text-xs rounded-full shadow-lg transition-all flex items-center gap-2"
            >
              {saving ? 'Enregistrement...' : initialItem ? 'Valider les modifications' : 'Ajouter à mon inventaire'}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
}
