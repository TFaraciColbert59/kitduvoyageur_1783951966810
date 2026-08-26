'use client';

import React from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';
import GlassIconButton from '@/components/ui/GlassIconButton';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';

export interface TravelGroupItem {
  id: string;
  name: string;
  description: string;
  destination: string;
  theme: string;
  visibility: string;
  invite_code?: string;
  max_members: number;
  departure_date?: string | null;
  return_date?: string | null;
  budget_target?: number;
  member_count?: number;
  my_role?: string;
  owner?: { full_name: string; avatar_url?: string } | null;
}

const THEME_EMOJI: Record<string, string> = {
  Tout: '🏕️', Trek: '🏔️', 'Van Life': '🚐', Randonnée: '🥾', Bivouac: '⛺', Photo: '📷',
  Expédition: '🧭', Ski: '⛷️', Vélo: '🚴', Moto: '🏍️', Autre: '🎒',
};

interface MobileGroupCardProps {
  group: TravelGroupItem;
  isMember: boolean;
  onJoin?: (groupId: string) => Promise<void> | void;
  joining?: boolean;
}

export default function MobileGroupCard({
  group,
  isMember,
  onJoin,
  joining = false,
}: MobileGroupCardProps) {
  const { triggerHaptic } = useHapticFeedback();

  const formatDate = (dStr?: string | null) => {
    if (!dStr) return null;
    const d = new Date(dStr);
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  };

  const departure = formatDate(group.departure_date);
  const returnD = formatDate(group.return_date);

  return (
    <div className="glass rounded-2xl p-4 border border-white/60 shadow-xs flex flex-col justify-between space-y-3 relative transition-all active:scale-[0.99]">
      {/* Top Header: Pictogram, Destination, Status Badge */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-11 h-11 rounded-2xl bg-[#17402C]/5 border border-[#17402C]/10 flex items-center justify-center text-xl shrink-0">
            {THEME_EMOJI[group.theme] || '🎒'}
          </div>

          <div className="min-w-0 space-y-0.5">
            <div className="flex items-center gap-1.5 flex-wrap">
              {group.destination && (
                <span className="glass-pill text-[9px] font-mono font-bold text-[#17402C] shrink-0">
                  📍 {group.destination}
                </span>
              )}
              <span className="text-[10px] font-mono text-[#5C6B5E]">
                {group.theme || 'Aventure'}
              </span>
            </div>

            <h3 className="font-display font-bold text-sm text-[#17402C] leading-snug truncate">
              {group.name}
            </h3>
          </div>
        </div>

        {group.my_role ? (
          <span className="glass-pill text-[9px] font-mono font-bold text-emerald-900 bg-emerald-50 shrink-0">
            {group.my_role === 'organizer' ? '👑 Leader' : 'Membre'}
          </span>
        ) : (
          <span className="glass-pill text-[9px] font-mono text-[#5C6B5E] shrink-0">
            {group.visibility === 'private' ? '🔒 Privé' : '🌍 Public'}
          </span>
        )}
      </div>

      {/* Description */}
      {group.description && (
        <p className="text-xs text-[#5C6B5E] line-clamp-2 leading-relaxed pl-1">
          {group.description}
        </p>
      )}

      {/* Dates Banner if available */}
      {(departure || group.budget_target) && (
        <div className="flex items-center gap-3 text-[10.5px] font-mono text-[#5C6B5E] bg-[#17402C]/5 px-3 py-1.5 rounded-xl">
          {departure && (
            <span className="flex items-center gap-1">
              <span>📅</span>
              <span>{departure}{returnD ? ` → ${returnD}` : ''}</span>
            </span>
          )}
          {group.budget_target && group.budget_target > 0 && (
            <span className="flex items-center gap-1">
              <span>💶</span>
              <span>{group.budget_target}€ / pers.</span>
            </span>
          )}
        </div>
      )}

      {/* Footer: Member count gauge & Image 3 Action button */}
      <div className="pt-2.5 border-t border-[#17402C]/10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 text-[11px] font-mono text-[#5C6B5E]">
            <span>👥</span>
            <span className="font-bold text-[#17402C]">{group.member_count || 1}</span>
            <span className="text-[10px]">/ {group.max_members || 12}</span>
          </div>

          {/* Spots remaining badge */}
          {group.max_members && (
            <span className="text-[9.5px] font-mono font-bold px-1.5 py-0.2 rounded-full bg-[#17402C]/10 text-[#17402C]">
              {Math.max(0, group.max_members - (group.member_count || 1))} places libres
            </span>
          )}
        </div>

        {isMember ? (
          <Link
            href={`/groupes/${group.id}`}
            onClick={() => triggerHaptic('light')}
            className="flex items-center gap-1 text-xs font-bold text-[#17402C] hover:opacity-80"
          >
            <span className="text-[11px] font-bold">Cockpit</span>
            <GlassIconButton
              size="sm"
              title="Accéder au Cockpit de groupe"
              icon={<Icon name="ArrowRightIcon" size={12} />}
            />
          </Link>
        ) : (
          <button
            type="button"
            disabled={joining}
            onClick={() => {
              triggerHaptic('selection');
              if (onJoin) onJoin(group.id);
            }}
            className="flex items-center gap-1.5 text-xs font-bold text-[#17402C] disabled:opacity-50"
          >
            <span className="text-[11px] font-bold">{joining ? 'Inscription...' : 'Rejoindre'}</span>
            <GlassIconButton
              size="sm"
              title="Rejoindre l'expédition"
              icon={<Icon name="PlusIcon" size={12} />}
            />
          </button>
        )}
      </div>
    </div>
  );
}
