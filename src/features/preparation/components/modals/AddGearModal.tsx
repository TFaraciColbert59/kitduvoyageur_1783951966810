'use client';

import React, { useState } from 'react';
import type { GearCategory, GearStatus } from '../../types/preparation.types';
import { usePreparationStore } from '../../stores/usePreparationStore';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';

interface AddGearModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AddGearModal: React.FC<AddGearModalProps> = ({ isOpen, onClose }) => {
  const { addItem, humans } = usePreparationStore();
  const { triggerHaptic } = useHapticFeedback();

  const [name, setName] = useState('');
  const [weight, setWeight] = useState(250);
  const [category, setCategory] = useState<GearCategory>('misc');
  const [status, setStatus] = useState<GearStatus>('packed');
  const [isWorn, setIsWorn] = useState(false);
  const [isConsumable, setIsConsumable] = useState(false);
  const [isVital, setIsVital] = useState(false);
  const [brand, setBrand] = useState('');
  const [assignedParticipantId, setAssignedParticipantId] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    triggerHaptic('success');
    addItem({
      name: name.trim(),
      weightGrams: Number(weight) || 0,
      category,
      status,
      isWorn,
      isConsumable,
      isVital,
      isPrivate: false,
      quantity: 1,
      brand: brand.trim() || undefined,
      assignedParticipantId: assignedParticipantId || undefined,
    });

    setName('');
    setWeight(250);
    setBrand('');
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-gear-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-200"
    >
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-3xl p-6 bg-[#17402C] text-[#E7E3D6] border border-white/20 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <h3 id="add-gear-title" className="text-lg font-bold text-white">
            Ajouter un équipement
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-white/60 hover:text-white"
          >
            ✕
          </button>
        </div>

        <div className="space-y-3 text-xs">
          <div>
            <label className="block text-[#A6C1A0] mb-1 font-mono">Nom de l'objet</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Tente Ultra-Light 2P"
              className="w-full p-2.5 rounded-xl bg-black/30 border border-white/20 text-white placeholder-white/40"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[#A6C1A0] mb-1 font-mono">Poids (grammes)</label>
              <input
                type="number"
                required
                min="0"
                value={weight}
                onChange={(e) => setWeight(Number(e.target.value))}
                className="w-full p-2.5 rounded-xl bg-black/30 border border-white/20 text-white font-mono"
              />
            </div>

            <div>
              <label className="block text-[#A6C1A0] mb-1 font-mono">Catégorie</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as any)}
                className="w-full p-2.5 rounded-xl bg-black/30 border border-white/20 text-white font-mono"
              >
                <option value="shelter">Abri / Bivouac</option>
                <option value="sleep">Couchage</option>
                <option value="cook">Cuisine / Popote</option>
                <option value="clothing">Vêtements</option>
                <option value="water">Eau & Filtre</option>
                <option value="safety">Sécurité & Soins</option>
                <option value="tech">Tech & Énergie</option>
                <option value="navigation">Navigation</option>
                <option value="misc">Divers</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[#A6C1A0] mb-1 font-mono">Statut initial</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="w-full p-2.5 rounded-xl bg-black/30 border border-white/20 text-white font-mono"
              >
                <option value="packed">Dans le sac</option>
                <option value="owned">Possédé (au camp)</option>
                <option value="to_buy">À acheter</option>
              </select>
            </div>

            <div>
              <label className="block text-[#A6C1A0] mb-1 font-mono">Marque / Modèle</label>
              <input
                type="text"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                placeholder="Ex: MSR, Petzl"
                className="w-full p-2.5 rounded-xl bg-black/30 border border-white/20 text-white placeholder-white/40"
              />
            </div>
          </div>

          {humans.length > 0 && (
            <div>
              <label className="block text-[#A6C1A0] mb-1 font-mono">Assigné au porteur</label>
              <select
                value={assignedParticipantId}
                onChange={(e) => setAssignedParticipantId(e.target.value)}
                className="w-full p-2.5 rounded-xl bg-black/30 border border-white/20 text-white font-mono"
              >
                <option value="">Non assigné (commun)</option>
                {humans.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.publicData.firstName}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Toggles fonctionnels */}
          <div className="space-y-2 pt-1 border-t border-white/10">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isWorn}
                onChange={(e) => setIsWorn(e.target.checked)}
                className="rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
              />
              <span className="text-white">Porté sur soi (exclu du Base Weight)</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isConsumable}
                onChange={(e) => setIsConsumable(e.target.checked)}
                className="rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
              />
              <span className="text-white">Consommable (eau, vivres, gaz)</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isVital}
                onChange={(e) => setIsVital(e.target.checked)}
                className="rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
              />
              <span className="text-red-300 font-semibold">Équipement vital de sécurité</span>
            </label>
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition-all"
          >
            Annuler
          </button>
          <button
            type="submit"
            className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md transition-all"
          >
            Enregistrer
          </button>
        </div>
      </form>
    </div>
  );
};
