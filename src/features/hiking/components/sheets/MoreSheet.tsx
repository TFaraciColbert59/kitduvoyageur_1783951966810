'use client';

import React from 'react';
import { motion } from 'framer-motion';

interface MoreSheetProps {
  isOpen: boolean;
  onClose: () => void;
  isNightMode: boolean;
  onToggleNightMode: () => void;
  onOpenSafety: () => void;
  onOpenWeather: () => void;
  onOpenARCompass: () => void;
  onOpen3DTerrain?: () => void;
  onOpenGPXModal?: () => void;
  onStopHike: () => void;
}

export default function MoreSheet({
  isOpen,
  onClose,
  isNightMode,
  onToggleNightMode,
  onOpenSafety,
  onOpenWeather,
  onOpenARCompass,
  onOpen3DTerrain,
  onOpenGPXModal,
  onStopHike,
}: MoreSheetProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end justify-center select-none">
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="w-full max-w-md bg-[color:var(--lkv-surface)] text-[color:var(--lkv-primary)] rounded-t-[34px] pt-3 pb-10 px-4  max-h-[85vh] overflow-y-auto space-y-4"
      >
        {/* Grabber */}
        <div className="w-10 h-1 bg-[color:var(--lkv-primary)]/14 rounded-full mx-auto" />

        {/* Sheet Header */}
        <div className="flex items-center justify-between px-2">
          <div>
            <h2 className="text-2xl font-medium tracking-tight">
              Menu <em className="font-serif italic text-[color:var(--lkv-primary)]">Cockpit</em>
            </h2>
            <p className="text-[11px] font-mono text-[color:var(--lkv-text-muted)] tracking-wider mt-0.5">
              OUTILS TERRAIN & RÉGLAGES
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[color:var(--stone-200)] flex items-center justify-center text-[color:var(--lkv-text-muted)] hover:text-[color:var(--lkv-primary)]"
          >
            ✕
          </button>
        </div>

        {/* Menu Grid */}
        <div className="grid grid-cols-2 gap-2.5">
          {/* Vue 3D Relief */}
          <button
            onClick={() => {
              onClose();
              if (onOpen3DTerrain) onOpen3DTerrain();
            }}
            className="p-3.5 bg-[color:var(--stone-100)] hover:bg-[color:var(--stone-200)] rounded-2xl flex items-center gap-3 text-left transition-colors active:scale-95 border border-[color:var(--lkv-primary)]/10"
          >
            <span className="text-2xl">🏔️</span>
            <div>
              <div className="text-xs font-bold text-[color:var(--lkv-primary)]">Vue 3D Relief</div>
              <div className="text-[10px] font-mono text-[color:var(--lkv-text-muted)]">Digital Twin terrain</div>
            </div>
          </button>

          {/* Fichiers GPX */}
          <button
            onClick={() => {
              onClose();
              if (onOpenGPXModal) onOpenGPXModal();
            }}
            className="p-3.5 bg-[color:var(--stone-100)] hover:bg-[color:var(--stone-200)] rounded-2xl flex items-center gap-3 text-left transition-colors active:scale-95 border border-[color:var(--lkv-primary)]/10"
          >
            <span className="text-2xl">📥</span>
            <div>
              <div className="text-xs font-bold text-[color:var(--lkv-primary)]">Fichiers GPX</div>
              <div className="text-[10px] font-mono text-[color:var(--lkv-text-muted)]">Import & Export</div>
            </div>
          </button>

          {/* Boussole AR */}
          <button
            onClick={() => {
              onClose();
              onOpenARCompass();
            }}
            className="p-3.5 bg-[color:var(--stone-100)] hover:bg-[color:var(--stone-200)] rounded-2xl flex items-center gap-3 text-left transition-colors active:scale-95"
          >
            <span className="text-2xl">🧭</span>
            <div>
              <div className="text-xs font-bold text-[color:var(--lkv-primary)]">Boussole AR</div>
              <div className="text-[10px] font-mono text-[color:var(--lkv-text-muted)]">Caméra directionnelle</div>
            </div>
          </button>

          {/* Centre de Sécurité */}
          <button
            onClick={() => {
              onClose();
              onOpenSafety();
            }}
            className="p-3.5 bg-red-950/10 hover:bg-red-950/20 border border-red-500/20 rounded-2xl flex items-center gap-3 text-left transition-colors active:scale-95"
          >
            <span className="text-2xl">🛡️</span>
            <div>
              <div className="text-xs font-bold text-red-900">Sécurité & 112</div>
              <div className="text-[10px] font-mono text-red-700">WGS-84 & Urgence</div>
            </div>
          </button>

          {/* Mode Nuit Toggle */}
          <button
            onClick={onToggleNightMode}
            className={`p-3.5 rounded-2xl flex items-center gap-3 text-left transition-colors active:scale-95 col-span-2 ${
              isNightMode ? 'bg-[color:var(--lkv-forest-950)] text-white' : 'bg-[color:var(--stone-100)] text-[color:var(--lkv-primary)]'
            }`}
          >
            <span className="text-2xl">{isNightMode ? '🌙' : '☀️'}</span>
            <div>
              <div className="text-xs font-bold">Mode Nuit Haute Visibilité</div>
              <div className="text-[10px] font-mono opacity-70">
                {isNightMode ? 'Actif (Palette Sombre)' : 'Inactif (Palette Claire)'}
              </div>
            </div>
          </button>
        </div>

        {/* Terminer la randonnée Button */}
        <button
          onClick={() => {
            onClose();
            onStopHike();
          }}
          className="w-full py-3.5 bg-red-900 hover:bg-red-950 text-white font-bold text-xs rounded-2xl  flex items-center justify-center gap-2 mt-2"
        >
          <span>⏹️</span>
          Terminer et sauvegarder la randonnée
        </button>
      </motion.div>
    </div>
  );
}
