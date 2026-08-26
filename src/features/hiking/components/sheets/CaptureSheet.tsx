'use client';

import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';

export interface CaptureItem {
  id: string;
  type: 'PHOTO' | 'VIDEO' | 'NOTE' | 'MOMENT';
  text?: string;
  mediaUrl?: string;
  timestamp: string;
  lat?: number | null;
  lng?: number | null;
}

interface CaptureSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onCaptureAction?: (item: CaptureItem) => void;
  userLoc?: [number, number] | null;
}

export default function CaptureSheet({ isOpen, onClose, onCaptureAction, userLoc }: CaptureSheetProps) {
  const [captures, setCaptures] = useState<CaptureItem[]>([]);
  const [noteMode, setNoteMode] = useState<'NOTE' | 'MOMENT' | null>(null);
  const [noteText, setNoteText] = useState('');

  const photoInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const addCapture = (type: 'PHOTO' | 'VIDEO' | 'NOTE' | 'MOMENT', text?: string, mediaUrl?: string) => {
    const newItem: CaptureItem = {
      id: `cap-${Date.now()}`,
      type,
      text: text?.trim() || undefined,
      mediaUrl,
      timestamp: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      lat: userLoc ? userLoc[0] : null,
      lng: userLoc ? userLoc[1] : null,
    };
    setCaptures((prev) => [newItem, ...prev]);
    onCaptureAction?.(newItem);
    setNoteMode(null);
    setNoteText('');
  };

  const handleFileChange = (type: 'PHOTO' | 'VIDEO', e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    addCapture(type, file.name, url);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end justify-center select-none">
      {/* Hidden File Inputs for Native Camera / File Picker */}
      <input
        ref={photoInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => handleFileChange('PHOTO', e)}
      />
      <input
        ref={videoInputRef}
        type="file"
        accept="video/*"
        capture="environment"
        className="hidden"
        onChange={(e) => handleFileChange('VIDEO', e)}
      />

      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="w-full max-w-md bg-[#FBFAF6] text-[#17402C] rounded-t-[34px] pt-3 pb-10 px-4  max-h-[85vh] overflow-y-auto space-y-5"
      >
        {/* Grabber */}
        <div className="w-10 h-1 bg-[#17402C]/14 rounded-full mx-auto" />

        {/* Sheet Header */}
        <div className="flex items-center justify-between px-2">
          <div>
            <h2 className="text-2xl font-medium tracking-tight">
              Capturer <em className="font-serif italic text-[#17402C]">un souvenir</em>
            </h2>
            <p className="text-[11px] font-mono text-[#6B7A72] tracking-wider mt-0.5">
              AUTO-TAGGING GPS · REPO-CARD
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#E9E4D9] flex items-center justify-center text-[#6B7A72] hover:text-[#17402C]"
          >
            ✕
          </button>
        </div>

        {/* 4 Action Grid Buttons (PHOTO, VIDÉO, NOTE, MOMENT) */}
        <div className="grid grid-cols-4 gap-2">
          <button
            onClick={() => photoInputRef.current?.click()}
            className="aspect-square rounded-2xl flex flex-col items-center justify-center gap-1.5 p-1 transition-transform active:scale-95  bg-[#17402C] text-white"
          >
            <span className="text-xl leading-none">📸</span>
            <span className="text-[9px] font-mono font-semibold tracking-wider uppercase text-center leading-none">
              PHOTO
            </span>
          </button>

          <button
            onClick={() => videoInputRef.current?.click()}
            className="aspect-square rounded-2xl flex flex-col items-center justify-center gap-1.5 p-1 transition-transform active:scale-95  bg-[#F4F1EA] text-[#17402C]"
          >
            <span className="text-xl leading-none">🎥</span>
            <span className="text-[9px] font-mono font-semibold tracking-wider uppercase text-center leading-none">
              VIDÉO
            </span>
          </button>

          <button
            onClick={() => setNoteMode('NOTE')}
            className={`aspect-square rounded-2xl flex flex-col items-center justify-center gap-1.5 p-1 transition-transform active:scale-95  ${
              noteMode === 'NOTE' ? 'bg-[#17402C] text-white' : 'bg-[#F4F1EA] text-[#17402C]'
            }`}
          >
            <span className="text-xl leading-none">📝</span>
            <span className="text-[9px] font-mono font-semibold tracking-wider uppercase text-center leading-none">
              NOTE
            </span>
          </button>

          <button
            onClick={() => setNoteMode('MOMENT')}
            className={`aspect-square rounded-2xl flex flex-col items-center justify-center gap-1.5 p-1 transition-transform active:scale-95  ${
              noteMode === 'MOMENT' ? 'bg-[#17402C] text-white' : 'bg-gradient-to-br from-[#E8B87A] to-[#C89755] text-[#4A2E0E]'
            }`}
          >
            <span className="text-xl leading-none">✨</span>
            <span className="text-[9px] font-mono font-semibold tracking-wider uppercase text-center leading-none">
              MOMENT
            </span>
          </button>
        </div>

        {/* Note / Moment Dialog Form */}
        {noteMode && (
          <div className="p-3.5 bg-[#F4F1EA] rounded-2xl border border-[#E8E4D8] space-y-2.5 animate-in fade-in duration-200">
            <div className="flex justify-between items-center text-xs font-semibold text-[#17402C]">
              <span>{noteMode === 'NOTE' ? '📝 Ajouter une note terrain' : '✨ Enregistrer un moment fort'}</span>
              <button onClick={() => setNoteMode(null)} className="text-[#6B7A72] text-xs">Annuler</button>
            </div>
            <textarea
              rows={2}
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder={noteMode === 'NOTE' ? 'Saisissez votre note de terrain…' : 'Description du moment marquant…'}
              className="w-full p-2.5 bg-white rounded-xl text-xs text-[#17402C] border border-[#E8E4D8] focus:outline-none focus:border-[#17402C]"
            />
            <button
              onClick={() => {
                if (noteText.trim()) addCapture(noteMode, noteText);
              }}
              disabled={!noteText.trim()}
              className="w-full py-2 bg-[#17402C] text-white text-xs font-bold rounded-xl disabled:opacity-50 hover:bg-[#0E291B] transition-colors"
            >
              Enregistrer
            </button>
          </div>
        )}

        {/* Tag GPS Auto Banner */}
        <div className="p-3.5 bg-[#EAF1E5] border border-[#A8C8A0] rounded-2xl flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#17402C] text-[#C6DCBE] flex items-center justify-center text-lg flex-shrink-0">
            📌
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium text-[#17402C]">
              Horodatage & GPS <em className="font-serif italic text-[#17402C]">en direct</em>
            </div>
            <div className="text-[10px] font-mono text-[#205238] tracking-wider mt-0.5 truncate">
              {userLoc ? `Position: ${userLoc[0].toFixed(4)}°, ${userLoc[1].toFixed(4)}°` : 'Position GPS en attente…'}
            </div>
          </div>
        </div>

        {/* Captures récentes */}
        <div className="space-y-2">
          <h3 className="text-[10px] font-mono uppercase tracking-widest text-[#6B7A72]">
            Captures enregistrées ({captures.length})
          </h3>
          {captures.length === 0 ? (
            <div className="p-4 bg-[#FBFAF6] border border-[#17402C]/06 rounded-2xl text-center">
              <p className="text-xs text-[#6B7A72]">
                Aucune capture enregistrée pour le moment.
              </p>
            </div>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {captures.map((cap) => (
                <div key={cap.id} className="p-3 bg-white border border-[#E8E4D8] rounded-xl flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 truncate">
                    <span>{cap.type === 'PHOTO' ? '📸' : cap.type === 'VIDEO' ? '🎥' : cap.type === 'NOTE' ? '📝' : '✨'}</span>
                    <span className="font-medium text-[#17402C] truncate">{cap.text || cap.type}</span>
                  </div>
                  <span className="text-[10px] font-mono text-[#6B7A72] flex-shrink-0 ml-2">{cap.timestamp}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
