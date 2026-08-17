'use client';

import React from 'react';
import AppImage from '@/components/ui/AppImage';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { CompteUserProfile } from '@/lib/supabase/queries-compte';

interface ProfileHeaderProps {
  profile: CompteUserProfile | null;
  onEdit: () => void;
  onShare: () => void;
  onSettings: () => void;
  className?: string;
}

export default function ProfileHeader({
  profile,
  onEdit,
  onShare,
  onSettings,
  className = '',
}: ProfileHeaderProps) {
  const { triggerHaptic } = useHapticFeedback();

  const fullName = profile
    ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'Voyageur'
    : 'Voyageur';
  const username = profile?.first_name
    ? `@${profile.first_name.toLowerCase().replace(/\s+/g, '')}${profile.last_name ? profile.last_name.toLowerCase().replace(/\./g, '') : ''}`
    : '@voyageur';

  return (
    <div className={`bg-white rounded-3xl p-5 sm:p-6 border border-black/[0.06] shadow-2xs ${className}`}>
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 sm:gap-6">
        {/* Avatar & Infos Principales */}
        <div className="flex items-start gap-4 sm:gap-5 min-w-0">
          {/* Avatar Container */}
          <div className="relative shrink-0">
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden border-2 border-white shadow-md bg-[#F4F1EB]">
              <AppImage
                src={profile?.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80'}
                alt={fullName}
                fill
                sizes="96px"
                className="object-cover"
              />
            </div>
            {/* Online Indicator */}
            <span
              className="absolute -bottom-1 -right-1 w-5 h-5 bg-[#17402C] border-2 border-white rounded-full flex items-center justify-center text-[9px] text-white font-bold"
              title="En ligne"
            >
              ✓
            </span>
          </div>

          {/* Text Details */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#0B1F17] truncate leading-tight">
                {fullName}
              </h1>
              {profile?.level && (
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#E1EBDD] text-[#17402C] border border-[#A9C6B0]/40">
                  Niv. {profile.level.number} · {profile.level.title}
                </span>
              )}
            </div>

            <p className="text-xs font-mono text-[#5C6B63] mt-0.5 truncate">
              {username}
            </p>

            {profile?.bio && (
              <p className="text-xs sm:text-sm text-[#2C3A33] mt-2 line-clamp-2 leading-relaxed">
                {profile.bio}
              </p>
            )}

            <div className="flex items-center gap-3 mt-2.5 text-xs text-[#5C6B63] flex-wrap">
              {profile?.location && (
                <span className="flex items-center gap-1">
                  <span>📍</span>
                  <span>{profile.location}</span>
                </span>
              )}
              {profile?.member_since && (
                <span className="flex items-center gap-1">
                  <span>🌱</span>
                  <span>{profile.member_since}</span>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Actions Rapides : Modifier · Partager · Paramètres */}
        <div className="flex items-center gap-2 shrink-0 pt-2 sm:pt-0 self-stretch sm:self-auto border-t sm:border-t-0 border-black/[0.04]">
          <button
            onClick={() => {
              triggerHaptic('light');
              onEdit();
            }}
            className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl bg-[#F4F1EB] hover:bg-[#EBE7DF] text-[#0B1F17] font-semibold text-xs transition-colors flex items-center justify-center gap-1.5 active:scale-95"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
            <span>Modifier</span>
          </button>

          <button
            onClick={() => {
              triggerHaptic('light');
              onShare();
            }}
            className="p-2.5 rounded-xl bg-[#F4F1EB] hover:bg-[#EBE7DF] text-[#0B1F17] transition-colors flex items-center justify-center active:scale-95"
            title="Partager mon profil"
            aria-label="Partager"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="18" cy="5" r="3" />
              <circle cx="6" cy="12" r="3" />
              <circle cx="18" cy="19" r="3" />
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
            </svg>
          </button>

          <button
            onClick={() => {
              triggerHaptic('light');
              onSettings();
            }}
            className="p-2.5 rounded-xl bg-[#F4F1EB] hover:bg-[#EBE7DF] text-[#0B1F17] transition-colors flex items-center justify-center active:scale-95"
            title="Paramètres"
            aria-label="Paramètres"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
