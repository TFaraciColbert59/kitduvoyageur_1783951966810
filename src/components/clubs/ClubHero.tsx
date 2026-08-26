'use client';

import React from 'react';
import Icon from '@/components/ui/AppIcon';

interface ClubHeroProps {
  club: {
    id: string;
    name: string;
    type?: string;
    emoji?: string;
    description?: string;
    category?: string;
    privacy?: string;
    is_verified?: boolean;
    members_count?: number;
    active_this_month?: number;
    cover_image?: string;
    location?: string;
  };
  eventsCount?: number;
  isMember?: boolean;
  joining?: boolean;
  onToggleMember?: () => void;
  onShare?: () => void;
}

export default function ClubHero({
  club,
  eventsCount = 0,
  isMember = false,
  joining = false,
  onToggleMember,
  onShare,
}: ClubHeroProps) {
  const membersCount = club.members_count || 1;
  const isOnline = club.active_this_month || 0;

  return (
    <div className="glass bg-gradient-to-br from-[#17402C]/95 via-[#17402C]/85 to-[#33463C]/90 rounded-[28px] p-8 sm:p-10 text-[#FAF8F5] relative overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border border-white/20">
      {/* Background Glow */}
      <div className="absolute top-0 right-0 w-[40rem] h-[40rem] bg-white opacity-5 blur-[100px] rounded-full pointer-events-none" />

      <div className="relative z-10 max-w-2xl">
        <div className="inline-flex items-center gap-2 px-3 py-1 glass-pill mb-6 text-white border-white/20">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="font-mono text-[10px] uppercase tracking-widest text-[#FAF8F5] font-bold">
            {club.type || 'CLUB'} · {membersCount} MEMBRES · {club.privacy === 'open' ? 'PUBLIC' : 'PRIVÉ'}
          </span>
        </div>

        <h1 className="text-4xl sm:text-5xl md:text-6xl mb-6 leading-[1.1] text-white">
          <span className="font-display font-bold block">{club.name}</span>
          <span className="font-serif italic font-normal text-[#A6C1A0]">{club.category || 'Collectif Outdoor'}</span>
        </h1>

        {club.description && (
          <p className="text-white/80 font-sans text-sm md:text-base leading-relaxed mb-8 max-w-xl">
            {club.description}
          </p>
        )}

        <div className="flex items-center gap-4 sm:gap-6 font-mono text-sm flex-wrap">
          <div className="flex flex-col">
            <span className="text-white/60 text-[10px] uppercase tracking-widest mb-1 font-bold">Membres</span>
            <span className="font-bold text-white">{membersCount}</span>
          </div>
          <div className="w-px h-8 bg-white/20" />
          <div className="flex flex-col">
            <span className="text-white/60 text-[10px] uppercase tracking-widest mb-1 font-bold">En ligne</span>
            <span className="font-bold text-emerald-400">{isOnline}</span>
          </div>
          <div className="w-px h-8 bg-white/20" />
          <div className="flex flex-col">
            <span className="text-white/60 text-[10px] uppercase tracking-widest mb-1 font-bold">Sorties</span>
            <span className="font-bold text-white">{eventsCount}</span>
          </div>
          <div className="w-px h-8 bg-white/20" />
          <div className="flex flex-col">
            <span className="text-white/60 text-[10px] uppercase tracking-widest mb-1 font-bold">Lieu</span>
            <span className="font-bold text-white truncate max-w-[120px]">{club.location || 'Monde'}</span>
          </div>
        </div>
      </div>

      <div className="relative z-10 flex flex-col items-end gap-3 w-full md:w-auto mt-6 md:mt-0">
        <div className="glass-sub-card rounded-2xl w-24 h-24 flex flex-col items-center justify-center mb-1 border-white/25">
          <span className="text-3xl mb-1">{club.emoji || '🏕️'}</span>
          <span className="font-mono text-[9px] uppercase tracking-widest text-white/70 text-center px-1 font-bold">
            {club.category?.slice(0, 10) || 'Club'}
          </span>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          {onShare && (
            <button
              type="button"
              onClick={onShare}
              className="glass-capsule-btn p-3 text-white border-white/30 hover:bg-white/20"
              title="Partager le club"
            >
              <Icon name="ShareIcon" size={16} className="relative z-10" />
            </button>
          )}
          <button
            type="button"
            onClick={onToggleMember}
            disabled={joining}
            className={`w-full md:w-auto glass-capsule-btn py-3 px-6 text-sm font-bold flex items-center justify-center gap-2 ${
              isMember ? '' : 'primary'
            }`}
          >
            <span className="relative z-10">
              {joining ? 'Patientez...' : isMember ? '✓ Membre du club' : '＋ Rejoindre le club'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
