'use client';

import React from 'react';
import { motion } from 'framer-motion';

interface CaptureSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onCaptureAction: (type: 'PHOTO' | 'VIDEO' | 'VOICE' | 'NOTE' | 'MOMENT') => void;
}

export default function CaptureSheet({ isOpen, onClose, onCaptureAction }: CaptureSheetProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end justify-center select-none">
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="w-full max-w-md bg-[#FBFAF6] text-[#0B1F17] rounded-t-[34px] pt-3 pb-10 px-4 shadow-2xl max-h-[85vh] overflow-y-auto space-y-5"
      >
        {/* Grabber */}
        <div className="w-10 h-1 bg-[#0B1F17]/14 rounded-full mx-auto" />

        {/* Sheet Header */}
        <div className="flex items-center justify-between px-2">
          <div>
            <h2 className="text-2xl font-medium tracking-tight">
              Capturer <em className="font-serif italic text-[#17402C]">un souvenir</em>
            </h2>
            <p className="text-[11px] font-mono text-[#6B7A72] tracking-wider mt-0.5">
              AUTO-TAGGING GPS · ALTITUDE · MÉTÉO
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#E9E4D9] flex items-center justify-center text-[#6B7A72] hover:text-[#0B1F17]"
          >
            ✕
          </button>
        </div>

        {/* 5 Action Grid Buttons */}
        <div className="grid grid-cols-5 gap-2">
          {[
            { id: 'PHOTO', label: 'PHOTO', icon: '📸', style: 'bg-[#17402C] text-white' },
            { id: 'VIDEO', label: 'VIDÉO', icon: '🎥', style: 'bg-[#F4F1EA] text-[#0B1F17]' },
            { id: 'VOICE', label: 'VOIX', icon: '🎙️', style: 'bg-[#F4F1EA] text-[#0B1F17]' },
            { id: 'NOTE', label: 'NOTE', icon: '📝', style: 'bg-[#F4F1EA] text-[#0B1F17]' },
            { id: 'MOMENT', label: 'MOMENT', icon: '✨', style: 'bg-gradient-to-br from-[#E8B87A] to-[#C89755] text-[#4A2E0E]' },
          ].map((btn) => (
            <button
              key={btn.id}
              onClick={() => onCaptureAction(btn.id as any)}
              className={`aspect-square rounded-2xl flex flex-col items-center justify-center gap-1.5 p-1 transition-transform active:scale-95 shadow-sm ${btn.style}`}
            >
              <span className="text-xl leading-none">{btn.icon}</span>
              <span className="text-[9px] font-mono font-semibold tracking-wider uppercase text-center leading-none">
                {btn.label}
              </span>
            </button>
          ))}
        </div>

        {/* Auto Log Banner — promesse honnête, pas de valeur inventée */}
        <div className="p-3.5 bg-[#EAF1E5] border border-[#A8C8A0] rounded-2xl flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#17402C] text-[#C6DCBE] flex items-center justify-center text-lg flex-shrink-0">
            📌
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium text-[#0B1F17]">
              Posé en <em className="font-serif italic text-[#17402C]">automatique</em>
            </div>
            <div className="text-[10px] font-mono text-[#205238] tracking-wider mt-0.5 truncate">
              Coordonnées GPS, altitude et météo seront enregistrées si disponibles sur l'appareil.
            </div>
          </div>
        </div>

        {/* Captures récentes — aucune donnée inventée */}
        <div className="space-y-2">
          <h3 className="text-[10px] font-mono uppercase tracking-widest text-[#6B7A72]">
            Captures récentes
          </h3>
          <div className="p-4 bg-[#FBFAF6] border border-[#0B1F17]/06 rounded-2xl text-center">
            <p className="text-xs text-[#6B7A72]">
              Aucune capture enregistrée pour cette randonnée.
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
