'use client';

import React from 'react';

interface CommunityStoriesBarProps {
  currentUser?: any;
}

/**
 * Barre de stories en direct. Aucune story serveur n'existe encore : l'état
 * affiché est un vrai état vide, jamais un jeu de données de démonstration.
 */
export default function CommunityStoriesBar({ currentUser }: CommunityStoriesBarProps) {
  return (
    <div className="glass p-3.5 rounded-2xl border border-white/60 bg-white/80 shadow-xs">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-2 h-2 rounded-full bg-[#17402C]/30" />
          <span className="text-[11px] font-bold text-[#17402C] truncate">
            Stories en direct
          </span>
        </div>
        <span className="glass-pill text-[8.5px] font-mono font-bold text-[#5C6B5E]">
          0 EN DIRECT
        </span>
      </div>
      <p className="text-[10.5px] text-[#5C6B5E] leading-relaxed mt-1.5">
        {currentUser
          ? 'Aucune story partagée pour le moment.'
          : 'Connectez-vous pour suivre les stories du terrain.'}
      </p>
    </div>
  );
}
