// src/components/mon-materiel/LendItemModal.tsx
'use client';

import React, { useState } from 'react';
import { GearItemData } from '@/lib/mock/mon-materiel-marceline';

interface LendItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: GearItemData | null;
  onSaveLoan: (borrowerName: string, returnDate?: string, notes?: string) => Promise<void>;
}

export default function LendItemModal({ isOpen, onClose, item, onSaveLoan }: LendItemModalProps) {
  // initialValue computed from item (may be null) — safe read prevents
  // "Cannot read properties of null (reading 'loan_to_name')" on mount
  const [borrowerName, setBorrowerName] = useState(item?.loan_to_name || '');
  const [returnDate, setReturnDate] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen || !item) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!borrowerName.trim()) return;
    setSubmitting(true);
    try {
      await onSaveLoan(borrowerName, returnDate, notes);
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fade-in font-sans">
      <div className="bg-white rounded-[0.75rem] w-full max-w-md shadow-2xl overflow-hidden p-6 space-y-5 active:scale-[0.98] active:opacity-95 transition-all duration-150 cursor-pointer">
        <div className="flex justify-between items-center border-b border-[#E8E4D8] pb-4">
          <div>
            <h3 className="font-extrabold text-[#132219] text-xl font-display">
              Prêter <span className="italic font-serif font-normal text-[#2D5A3D]">{item?.name}</span>
            </h3>
            <p className="text-xs text-[#132219]/60 mt-0.5">
              Enregistrez le prêt pour garder une trace de vos équipements.
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#FAF8F5] flex items-center justify-center text-[#132219]/60 hover:text-[#132219]"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs sm:text-sm">
          <div>
            <label className="block font-semibold text-[#132219] mb-1">
              Nom de l'emprunteur *
            </label>
            <input
              type="text"
              required
              value={borrowerName}
              onChange={(e) => setBorrowerName(e.target.value)}
              placeholder="Ex. Antoine Durand, Camille Roy"
              className="w-full bg-[#FAF8F5] border border-[#E8E4D8] rounded-xl px-3 py-2.5 text-[#132219] focus:outline-none focus:ring-2 focus:ring-[#132219]"
            />
          </div>

          <div>
            <label className="block font-semibold text-[#132219] mb-1">
              Date de retour estimée
            </label>
            <input
              type="date"
              value={returnDate}
              onChange={(e) => setReturnDate(e.target.value)}
              className="w-full bg-[#FAF8F5] border border-[#E8E4D8] rounded-xl px-3 py-2.5 text-[#132219] focus:outline-none focus:ring-2 focus:ring-[#132219]"
            />
          </div>

          <div>
            <label className="block font-semibold text-[#132219] mb-1">
              Note sur le prêt
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex. Prêté pour le bivouac dans le Vercors ce week-end..."
              rows={3}
              className="w-full bg-[#FAF8F5] border border-[#E8E4D8] rounded-xl p-3 text-[#132219] focus:outline-none focus:ring-2 focus:ring-[#132219] resize-none"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-[#132219]/70 hover:underline"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2.5 bg-[#132219] hover:bg-[#23382B] text-white font-extrabold text-xs rounded-full transition-colors disabled:opacity-50"
            >
              {submitting ? 'Enregistrement…' : 'Valider le prêt'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}