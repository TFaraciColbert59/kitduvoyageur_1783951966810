'use client';

import React from 'react';
import Icon from '@/components/ui/AppIcon';
import GlassIconButton from '@/components/ui/GlassIconButton';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';

interface ClubFeaturedEventCardProps {
  event: {
    id: string;
    title: string;
    description?: string | null;
    event_date?: string | null;
    location?: string | null;
    participants_count?: number;
    max_participants?: number;
  };
  isRegistered?: boolean;
  onRegister?: () => void;
  onViewParticipants?: () => void;
}

export default function ClubFeaturedEventCard({
  event,
  isRegistered = false,
  onRegister,
  onViewParticipants,
}: ClubFeaturedEventCardProps) {
  const { triggerHaptic } = useHapticFeedback();
  const dateObj = event.event_date ? new Date(event.event_date) : null;
  const monthStr = dateObj
    ? dateObj.toLocaleDateString('fr-FR', { month: 'short' }).toUpperCase()
    : 'TBD';
  const dayStr = dateObj ? dateObj.getDate() : '-';

  const maxParticipants = event.max_participants || 20;
  const currentParticipants = event.participants_count || 0;
  const progressPercent = Math.min(100, Math.round((currentParticipants / maxParticipants) * 100));

  return (
    <div className="glass bg-white/90 backdrop-blur-xl p-4 text-[#17402C] relative overflow-hidden transition-all duration-300 space-y-3 rounded-3xl border border-white shadow-xs">
      <div className="flex items-start gap-3">
        {/* Calendar Badge */}
        <div className="w-12 h-12 rounded-2xl bg-[#17402C] text-white flex flex-col items-center justify-center shrink-0 shadow-2xs">
          <span className="text-[8.5px] font-bold uppercase tracking-wider text-[#A6C1A0] leading-none">
            {monthStr}
          </span>
          <span className="text-base font-display font-extrabold leading-none mt-0.5">
            {dayStr}
          </span>
        </div>

        {/* Title & Location */}
        <div className="min-w-0 flex-1 space-y-0.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono text-emerald-800 font-bold uppercase tracking-wide">
              🏕️ Sortie Collective
            </span>
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" title="Sortie active" />
          </div>
          <h3 className="font-display font-bold text-sm text-[#17402C] truncate">
            {event.title}
          </h3>
          <p className="text-[11px] text-[#5C6B5E] font-mono flex items-center gap-1 truncate">
            <span>📍</span>
            <span>{event.location || 'Lieu à définir'}</span>
          </p>
        </div>
      </div>

      {event.description && (
        <p className="text-xs text-[#5C6B5E] line-clamp-2 leading-relaxed pl-1">
          {event.description}
        </p>
      )}

      {/* Participants gauge */}
      <div className="space-y-1.5 pt-1">
        <div className="flex items-center justify-between text-[10.5px] font-mono text-[#5C6B5E]">
          <span>Places réservées</span>
          <span className="font-bold text-[#17402C]">
            {currentParticipants} / {maxParticipants}
          </span>
        </div>
        <div className="w-full h-1.5 bg-[#17402C]/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-emerald-600 rounded-full transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Action Button */}
      <div className="pt-2 border-t border-[#17402C]/10 flex items-center justify-between gap-2">
        {onViewParticipants ? (
          <button
            type="button"
            onClick={onViewParticipants}
            className="text-[11px] text-[#5C6B5E] font-medium hover:text-[#17402C]"
          >
            Participants ({currentParticipants})
          </button>
        ) : (
          <span className="text-[11px] font-mono text-[#5C6B5E]">
            {maxParticipants - currentParticipants} places restantes
          </span>
        )}

        <button
          type="button"
          onClick={() => {
            triggerHaptic('selection');
            if (onRegister) onRegister();
          }}
          className={`glass-capsule-btn !min-h-[36px] !py-1.5 !px-4 !text-xs !font-bold ${
            isRegistered ? '' : 'primary'
          }`}
        >
          <span>{isRegistered ? '✓ Inscrit(e)' : "S'inscrire"}</span>
        </button>
      </div>
    </div>
  );
}
