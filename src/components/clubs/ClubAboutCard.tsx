'use client';

import React, { useState } from 'react';
import Icon from '@/components/ui/AppIcon';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';

interface ClubAboutCardProps {
  club: {
    category?: string;
    location?: string;
    privacy?: string;
    members_count?: number;
    created_at?: string;
    rules?: string;
    description?: string;
  };
}

export default function ClubAboutCard({ club }: ClubAboutCardProps) {
  const { triggerHaptic } = useHapticFeedback();
  const [showRules, setShowRules] = useState(false);

  const createdYear = club.created_at
    ? new Date(club.created_at).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })
    : '2024';

  return (
    <div className="glass bg-white/90 backdrop-blur-xl p-4 text-[#17402C] space-y-3 transition-all duration-300 rounded-3xl border border-white shadow-xs">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm">ℹ️</span>
          <h2 className="font-display font-bold text-xs text-[#17402C]">
            Infos &amp; Charte du Collectif
          </h2>
        </div>
        <span className="glass-pill text-[9px] py-0.5 px-2 font-mono font-bold">
          {club.privacy === 'open' ? 'Public' : 'Privé'}
        </span>
      </div>

      {/* Paramètres clés */}
      <div className="grid grid-cols-2 gap-2 text-[10.5px]">
        <div className="p-2.5 rounded-2xl bg-white/70 border border-white/80 shadow-2xs">
          <span className="font-mono uppercase text-[#5C6B5E] block text-[8.5px] font-bold">Catégorie</span>
          <span className="font-bold text-[#17402C] truncate block mt-0.5">{club.category || 'Outdoor'}</span>
        </div>

        <div className="p-2.5 rounded-2xl bg-white/70 border border-white/80 shadow-2xs">
          <span className="font-mono uppercase text-[#5C6B5E] block text-[8.5px] font-bold">Localisation</span>
          <span className="font-bold text-[#17402C] truncate block mt-0.5">{club.location || 'France'}</span>
        </div>

        <div className="p-2.5 rounded-2xl bg-white/70 border border-white/80 shadow-2xs">
          <span className="font-mono uppercase text-[#5C6B5E] block text-[8.5px] font-bold">Membres</span>
          <span className="font-bold text-[#17402C] truncate block mt-0.5">{club.members_count || 1} inscrits</span>
        </div>

        <div className="p-2.5 rounded-2xl bg-white/70 border border-white/80 shadow-2xs">
          <span className="font-mono uppercase text-[#5C6B5E] block text-[8.5px] font-bold">Créé en</span>
          <span className="font-bold text-[#17402C] truncate block mt-0.5">{createdYear}</span>
        </div>
      </div>

      {/* Charte & Règles repliables */}
      {(club.rules || club.description) && (
        <div className="pt-2 border-t border-[#17402C]/10">
          <button
            type="button"
            onClick={() => {
              triggerHaptic('light');
              setShowRules(!showRules);
            }}
            className="w-full glass-capsule-btn !min-h-[36px] !py-1.5 !px-3 !justify-between !text-xs !font-bold"
          >
            <div className="flex items-center gap-2">
              <span className="text-xs">📜</span>
              <span>Charte d'engagement</span>
            </div>
            <span className="text-[10px] text-[#5C6B5E] font-mono">{showRules ? '▲ Fermer' : '▼ Lire'}</span>
          </button>

          {showRules && (
            <div className="mt-2 p-3 rounded-2xl bg-white/70 border border-white/80 text-xs text-[#17402C] leading-relaxed whitespace-pre-wrap">
              {club.rules || club.description}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
