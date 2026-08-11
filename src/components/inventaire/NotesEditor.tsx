// src/components/mon-materiel/NotesEditor.tsx
'use client';

import React, { useState } from 'react';

interface NotesEditorProps {
  notes: string;
  onSave: (value: string) => Promise<void>;
}

export default function NotesEditor({ notes, onSave }: NotesEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState(notes);
  const [saving, setSaving] = useState(false);

  const defaultNote =
    '« Confortables dès la première sortie, mais lacets trop courts pour nouer autour de la cheville en descente technique. Racheter des lacets 180 cm au prochain re-conditionnement. Faire attention à ne pas les mettre près du feu (la tige cuir tape sur la malléole en descente rapide)... »';

  const noteText = notes || defaultNote;

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await onSave(value);
      setIsEditing(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-3xl p-6 border border-[#E8E4D8] shadow-sm space-y-4">
      <div>
        <h3 className="text-lg font-extrabold text-[#132219] font-display">
          Notes <span className="italic font-serif font-normal text-[#2D5A3D]">personnelles</span>
        </h3>
        <p className="text-xs text-[#132219]/60 mt-0.5">
          Vos remarques d'usage sur cet article — visibles que par vous.
        </p>
      </div>

      {isEditing ? (
        <div className="space-y-3">
          <textarea
            className="w-full h-36 p-3 text-xs sm:text-sm border border-[#E8E4D8] rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#132219] bg-[#FAF8F5] resize-none"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Rédigez vos notes d'expérience..."
          />
          <div className="flex items-center justify-end gap-2">
            <button
              onClick={() => setIsEditing(false)}
              className="px-4 py-2 text-xs font-semibold text-[#132219]/70 hover:underline"
            >
              Annuler
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-[#132219] text-white text-xs font-semibold rounded-full hover:bg-[#23382B] transition-colors disabled:opacity-50"
            >
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="p-4 rounded-2xl bg-[#FAF8F5] border border-[#E8E4D8] text-xs sm:text-sm text-[#132219]/80 leading-relaxed font-serif italic relative">
            {noteText}
          </div>
          <button
            onClick={() => {
              setValue(noteText);
              setIsEditing(true);
            }}
            className="text-xs font-semibold text-[#2D5A3D] hover:underline flex items-center gap-1.5"
          >
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
            <span>Modifier la note</span>
          </button>
        </div>
      )}
    </div>
  );
}
