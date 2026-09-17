'use client';

import React from 'react';
import { GlassModal } from '@/components/ui/GlassModal';

interface StartDistanceModalProps {
  isOpen: boolean;
  distanceKm: number;
  startLat: number;
  startLng: number;
  routeName?: string;
  onConfirmStart: () => void;
  onClose: () => void;
}

export function StartDistanceModal({
  isOpen,
  distanceKm,
  startLat,
  startLng,
  routeName = 'Randonnée',
  onConfirmStart,
  onClose,
}: StartDistanceModalProps) {
  if (!isOpen) return null;

  const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${startLat},${startLng}`;

  const handleGetDirections = () => {
    window.open(googleMapsUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <GlassModal
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title="Éloigné du point de départ"
      variant="centered"
    >
      <div className="flex flex-col text-center select-none pt-2">
        {/* Top Icon Badge */}
        <div className="w-14 h-14 rounded-2xl bg-[var(--lkv-primary)]/10 text-[var(--lkv-primary)] mx-auto flex items-center justify-center mb-3 border border-[var(--lkv-primary)]/20">
          <svg width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
            <path d="M12 21s-6-5.333-6-10a6 6 0 0112 0c0 4.667-6 10-6 10z" />
            <circle cx="12" cy="11" r="2.5" fill="currentColor" />
          </svg>
        </div>

        <p className="text-xs text-[var(--lkv-text-secondary)] mt-1 leading-relaxed">
          Vous êtes actuellement à <strong className="text-[var(--lkv-primary)] font-mono text-sm">{distanceKm.toFixed(1)} km</strong> du départ de <span className="font-semibold text-[var(--lkv-primary)]">{routeName}</span>.
        </p>

        <p className="text-[11px] text-[var(--lkv-text-muted)] mt-1 italic">
          Souhaitez-vous vous rendre au point de départ via Google Maps ou lancer la randonnée immédiatement ?
        </p>

        {/* Actions */}
        <div className="flex flex-col gap-2.5 mt-5">
          <button
            onClick={handleGetDirections}
            className="w-full h-11 rounded-2xl bg-[var(--lkv-primary)] hover:bg-[#365233] text-white text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-95"
          >
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <polygon points="3 11 22 2 13 21 11 13 3 11" />
            </svg>
            <span>Obtenir l'itinéraire (Google Maps)</span>
          </button>

          <button
            onClick={onConfirmStart}
            className="w-full h-11 rounded-2xl bg-white border border-[var(--lkv-primary)]/20 hover:bg-[#F5F2EA] text-[var(--lkv-primary)] text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-95"
          >
            <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
            <span>Commencer maintenant</span>
          </button>

          <button
            onClick={onClose}
            className="mt-1 text-[11px] text-[var(--lkv-text-muted)] hover:text-[var(--lkv-primary)] transition-colors py-1 cursor-pointer"
          >
            Annuler
          </button>
        </div>
      </div>
    </GlassModal>
  );
}
