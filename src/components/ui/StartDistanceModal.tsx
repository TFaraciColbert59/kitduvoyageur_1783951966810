'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

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
    <AnimatePresence>
      <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="w-full max-w-sm bg-[#FBFAF6] border border-[#17402C]/15 rounded-[0.75rem] p-6 shadow-2xl flex flex-col text-center select-none"
        >
          {/* Top Icon Badge */}
          <div className="w-14 h-14 rounded-2xl bg-[#17402C]/10 text-[#17402C] mx-auto flex items-center justify-center mb-4 border border-[#17402C]/20 shadow-inner">
            <svg width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
              <path d="M12 21s-6-5.333-6-10a6 6 0 0112 0c0 4.667-6 10-6 10z" />
              <circle cx="12" cy="11" r="2.5" fill="currentColor" />
            </svg>
          </div>

          {/* Title & Description */}
          <h3 className="text-lg font-bold text-[#0B1F17] font-display tracking-tight leading-snug">
            Éloigné du point de départ
          </h3>

          <p className="text-xs text-[#5C6B5E] mt-2 leading-relaxed">
            Vous êtes actuellement à <strong className="text-[#17402C] font-mono text-sm">{distanceKm.toFixed(1)} km</strong> du départ de <span className="font-semibold text-[#0B1F17]">{routeName}</span>.
          </p>

          <p className="text-[11px] text-[#7A8A7D] mt-1 italic">
            Souhaitez-vous vous rendre au point de départ via Google Maps ou lancer la randonnée immédiatement ?
          </p>

          {/* Actions */}
          <div className="flex flex-col gap-2.5 mt-6">
            {/* Action 1: Get Directions */}
            <button
              onClick={handleGetDirections}
              className="w-full h-11 rounded-2xl bg-[#17402C] hover:bg-[#0B1F17] text-white text-xs font-bold shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-95"
            >
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <polygon points="3 11 22 2 13 21 11 13 3 11" />
              </svg>
              <span>Obtenir l'itinéraire (Google Maps)</span>
            </button>

            {/* Action 2: Start Now */}
            <button
              onClick={onConfirmStart}
              className="w-full h-11 rounded-2xl bg-white border border-[#17402C]/20 hover:bg-[#F5F2EA] text-[#17402C] text-xs font-bold shadow-sm flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-95"
            >
              <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
              <span>Commencer maintenant</span>
            </button>

            {/* Action 3: Cancel */}
            <button
              onClick={onClose}
              className="mt-1 text-[11px] text-[#7A8A7D] hover:text-[#0B1F17] transition-colors py-1 cursor-pointer"
            >
              Annuler
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
