'use client';

import React from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';
import { IconButton } from '@/components/ui';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';

interface TeamMember {
  id: string;
  user_id?: string;
  role: string;
  user?: {
    full_name?: string;
    avatar_url?: string;
  };
}

interface ClubTeamCardProps {
  admins: TeamMember[];
  onViewAll?: () => void;
  onContact?: (name: string) => void;
}

export default function ClubTeamCard({
  admins,
  onViewAll,
  onContact,
}: ClubTeamCardProps) {
  const { triggerHaptic } = useHapticFeedback();

  return (
    <div className="glass bg-white/90 backdrop-blur-xl p-4 transition-all duration-300 space-y-3 rounded-3xl border border-white shadow-xs">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <span className="text-sm">🛡️</span>
          <h2 className="font-display font-bold text-xs text-[#17402C]">
            Équipe d'animation ({admins.length})
          </h2>
        </div>
        {onViewAll && (
          <button
            type="button"
            onClick={() => {
              triggerHaptic('light');
              onViewAll();
            }}
            className="glass-capsule-btn sm font-mono font-bold"
          >
            Tous les membres →
          </button>
        )}
      </div>

      <div className="space-y-2">
        {admins.length === 0 ? (
          <p className="text-xs text-[#5C6B5E] text-center py-3 font-mono">
            Aucun administrateur désigné.
          </p>
        ) : (
          admins.slice(0, 4).map((admin) => (
            <div
              key={admin.id}
              className="glass-sub-card flex items-center gap-3 p-2.5 rounded-2xl"
            >
              <Link
                href={admin.user_id ? `/profil/${admin.user_id}` : '#'}
                onClick={() => triggerHaptic('light')}
                className="relative shrink-0"
              >
                <div className="w-9 h-9 rounded-full bg-[#17402C] text-white flex items-center justify-center font-serif italic text-xs font-bold shadow-2xs overflow-hidden">
                  {admin.user?.avatar_url ? (
                    <img
                      src={admin.user.avatar_url}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    admin.user?.full_name?.charAt(0) || '👤'
                  )}
                </div>
              </Link>

              <div className="flex-1 min-w-0">
                <Link
                  href={admin.user_id ? `/profil/${admin.user_id}` : '/communaute'}
                  onClick={() => triggerHaptic('light')}
                  className="font-sans font-bold text-xs text-[#17402C] truncate block leading-tight hover:underline cursor-pointer"
                >
                  {admin.user?.full_name || 'Membre collectif'}
                </Link>
                <span className="text-[10px] font-mono text-[#5C6B5E]">
                  {admin.role === 'admin' ? '👑 Leader' : '🛡️ Modérateur'}
                </span>
              </div>

              {onContact && (
                <IconButton
                  size="sm"
                  onClick={() => {
                    triggerHaptic('selection');
                    onContact(admin.user?.full_name || "l'organisateur");
                  }}
                  title="Envoyer un message"
                  aria-label="Envoyer un message"
                >
                  <Icon name="ChatBubbleLeftIcon" size={12} />
                </IconButton>
              )}
            </div>
          ))
        )}

        {admins.length > 4 && onViewAll && (
          <button
            type="button"
            onClick={onViewAll}
            className="glass-capsule-btn sm w-full font-medium"
          >
            + {admins.length - 4} autre{admins.length - 4 > 1 ? 's' : ''} organisateur{admins.length - 4 > 1 ? 's' : ''}
          </button>
        )}
      </div>
    </div>
  );
}
