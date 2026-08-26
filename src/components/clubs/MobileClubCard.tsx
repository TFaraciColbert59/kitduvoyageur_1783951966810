'use client';

import React from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';
import GlassIconButton from '@/components/ui/GlassIconButton';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';

export interface ClubCardItem {
  id: string;
  slug?: string;
  name: string;
  type?: string;
  emoji?: string;
  description: string;
  cover_image?: string;
  cover_color?: string;
  category?: string;
  members_count: number;
  active_this_month?: number;
  is_verified?: boolean;
  is_member?: boolean;
}

interface MobileClubCardProps {
  club: ClubCardItem;
  isMember?: boolean;
  onJoin?: (clubId: string) => Promise<void> | void;
  joining?: boolean;
}

export default function MobileClubCard({
  club,
  isMember = false,
  onJoin,
  joining = false,
}: MobileClubCardProps) {
  const { triggerHaptic } = useHapticFeedback();
  const clubHref = `/clubs/${club.slug || club.id}`;

  return (
    <div className="glass rounded-3xl p-4 border border-white/60 shadow-xs flex flex-col justify-between space-y-3 relative transition-all active:scale-[0.99]">
      {/* Top Row: Avatar/Emoji + Title + Verified / Privacy Badge */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-12 h-12 rounded-2xl bg-[#17402C]/5 border border-[#17402C]/10 flex items-center justify-center text-2xl shrink-0 overflow-hidden relative shadow-2xs">
            {club.cover_image ? (
              <img
                src={club.cover_image}
                alt={club.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <span>{club.emoji || '🏕️'}</span>
            )}
          </div>

          <div className="min-w-0 space-y-0.5">
            <div className="flex items-center gap-1.5 flex-wrap">
              {club.category && (
                <span className="glass-pill text-[9px] font-mono font-bold text-[#17402C] shrink-0">
                  {club.category}
                </span>
              )}
              {club.type && (
                <span className="text-[9.5px] font-mono text-[#5C6B5E]">
                  {club.type === 'activite' ? '⚡ Activité' : '🌍 Pays'}
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              <h3 className="font-display font-bold text-sm text-[#17402C] leading-snug truncate">
                {club.name}
              </h3>
              {club.is_verified && (
                <span className="text-emerald-700 text-xs shrink-0" title="Club vérifié">
                  ✓
                </span>
              )}
            </div>
          </div>
        </div>

        {isMember ? (
          <span className="glass-pill text-[9px] font-mono font-bold text-emerald-900 bg-emerald-50 shrink-0">
            ✓ Membre
          </span>
        ) : (
          <span className="glass-pill text-[9px] font-mono text-[#5C6B5E] shrink-0">
            Collectif
          </span>
        )}
      </div>

      {/* Description */}
      {club.description && (
        <p className="text-xs text-[#5C6B5E] line-clamp-2 leading-relaxed pl-1">
          {club.description}
        </p>
      )}

      {/* Footer: Member stats & Liquid Glass Action buttons */}
      <div className="pt-2.5 border-t border-[#17402C]/10 flex items-center justify-between">
        <div className="flex items-center gap-3 text-[11px] font-mono text-[#5C6B5E]">
          <div className="flex items-center gap-1">
            <span>👥</span>
            <span className="font-bold text-[#17402C]">{club.members_count || 1}</span>
            <span className="text-[10px]">membres</span>
          </div>

          {club.active_this_month !== undefined && club.active_this_month > 0 && (
            <span className="text-[9.5px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-900 border border-emerald-200/50">
              🔥 {club.active_this_month} actifs/mois
            </span>
          )}
        </div>

        {isMember ? (
          <Link
            href={clubHref}
            onClick={() => triggerHaptic('light')}
            className="glass-capsule-btn !min-h-[34px] !py-1 !px-3.5 !text-xs !gap-1.5 !font-bold"
          >
            <span>Ouvrir</span>
            <Icon name="ArrowRightIcon" size={12} />
          </Link>
        ) : (
          <div className="flex items-center gap-2">
            <Link
              href={clubHref}
              onClick={() => triggerHaptic('light')}
              className="glass-capsule-btn !min-h-[34px] !py-1 !px-3 !text-xs !font-bold"
            >
              <span>Détails</span>
            </Link>
            <button
              type="button"
              disabled={joining}
              onClick={() => {
                triggerHaptic('selection');
                if (onJoin) onJoin(club.id);
              }}
              className="glass-capsule-btn primary !min-h-[34px] !py-1 !px-3.5 !text-xs !gap-1 !font-bold disabled:opacity-50"
            >
              <span>{joining ? '...' : '+ Rejoindre'}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
