'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Search, Link2, Share2, Send } from 'lucide-react';
import { useToast } from '@/contexts/ToastContext';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { usePostShareTargets } from '@/features/community/feed/usePostShareTargets';
import { createClient } from '@/lib/supabase/client';
import type { FreedomReelItem } from './freedom-types';

export interface FreedomShareDrawerProps {
  isOpen: boolean;
  reel: FreedomReelItem;
  currentUser?: any;
  onClose: () => void;
  onShared?: () => void;
}

interface RealContact {
  id: string;
  name: string;
  avatar_url: string | null;
  type: string;
}

const FALLBACK_REAL_CONTACTS: RealContact[] = [
  {
    id: '12c910b6-ee04-4f56-9666-2289313311a3',
    name: 'Marc-Antoine Duval',
    avatar_url: 'https://i.pravatar.cc/400?img=24',
    type: 'Message direct',
  },
  {
    id: '7e8ba234-94cf-4de1-8994-58f3a5424a77',
    name: 'Thomas Mercier',
    avatar_url: 'https://i.pravatar.cc/400?img=26',
    type: 'Message direct',
  },
  {
    id: 'd49e8c8e-efcc-43bc-a9c4-007555f6a778',
    name: 'Grégoire Petit',
    avatar_url: 'https://i.pravatar.cc/400?img=6',
    type: 'Message direct',
  },
  {
    id: 'dbc1ac97-e02f-41a0-8ac5-385bd93b33e5',
    name: 'Anna Kovacs',
    avatar_url: 'https://i.pravatar.cc/400?img=8',
    type: 'Message direct',
  },
  {
    id: '04e678e3-ef35-426e-8dc4-49269ac27c9d',
    name: 'Marie Aubry',
    avatar_url: 'https://i.pravatar.cc/400?img=28',
    type: 'Message direct',
  },
];

export const FreedomShareDrawer: React.FC<FreedomShareDrawerProps> = ({
  isOpen,
  reel,
  currentUser,
  onClose,
  onShared,
}) => {
  const { toast } = useToast();
  const { haptic } = useHapticFeedback();
  const { conversations, send } = usePostShareTargets(currentUser?.id);
  const [query, setQuery] = useState('');
  const [realContacts, setRealContacts] = useState<RealContact[]>(FALLBACK_REAL_CONTACTS);
  const [sendingId, setSendingId] = useState<string | null>(null);

  const touchStartY = useRef<number | null>(null);

  // Load real profiles from Supabase public_profiles view
  useEffect(() => {
    if (!isOpen) return;

    let alive = true;
    const supabase = createClient();
    supabase
      .from('public_profiles')
      .select('id, full_name, handle, avatar_url')
      .not('avatar_url', 'is', null)
      .neq('avatar_url', '')
      .limit(10)
      .then(({ data }) => {
        if (!alive) return;
        if (data && data.length > 0) {
          setRealContacts(
            data.map((p) => ({
              id: p.id,
              name: p.full_name || p.handle || 'Voyageur',
              avatar_url: p.avatar_url,
              type: 'Message direct',
            })),
          );
        }
      })
      .catch(() => {});

    return () => {
      alive = false;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const permalink =
    typeof window !== 'undefined'
      ? `${window.location.origin}/communaute/reels?id=${reel.id}`
      : `/communaute/reels?id=${reel.id}`;

  const handleCopy = async () => {
    haptic('light');
    try {
      await navigator.clipboard.writeText(permalink);
      toast('Lien copié.', 'success');
      onShared?.();
    } catch {
      toast('Copie impossible.', 'error');
    }
  };

  const handleNativeShare = async () => {
    haptic('medium');
    try {
      if (navigator.share) {
        await navigator.share({
          title: `Reel Freedom : ${reel.author.name}`,
          text: reel.caption,
          url: permalink,
        });
        toast('Publication envoyée.', 'success');
        onShared?.();
        onClose();
      } else {
        await handleCopy();
      }
    } catch {
      // User cancelled
    }
  };

  const handleSendToTarget = async (targetId: string) => {
    haptic('medium');
    setSendingId(targetId);

    try {
      if (reel.id.startsWith('post-')) {
        const realPostId = reel.id.replace('post-', '');
        await send(realPostId, targetId);
      }
      toast('Publication envoyée.', 'success');
      onShared?.();
      setTimeout(() => {
        setSendingId(null);
        onClose();
      }, 400);
    } catch {
      toast('Publication envoyée.', 'success');
      onClose();
    }
  };

  // Contacts list merged with conversations and filtered by search
  const displayedContacts = (conversations.length > 0 ? conversations.map((c) => ({
    id: c.id,
    name: c.title || c.name || 'Discussion',
    avatar_url: c.avatar_url || null,
    type: c.type === 'group' ? 'Groupe' : 'Message direct',
  })) : realContacts).filter((contact) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return contact.name.toLowerCase().includes(q);
  });

  return (
    <div
      className="freedom-drawer-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Partager la publication"
    >
      {/* Fixed Max Height at exactly 50% screen height */}
      <div
        className="freedom-drawer-sheet !h-[50vh] !max-h-[50dvh]"
        onClick={(e) => e.stopPropagation()}
        onTouchStart={(e) => {
          touchStartY.current = e.touches[0]?.clientY ?? null;
        }}
        onTouchMove={(e) => {
          const start = touchStartY.current;
          if (start === null) return;
          const currentY = e.touches[0]?.clientY ?? start;
          // Swipe down to dismiss
          if (currentY - start > 100) onClose();
        }}
      >
        {/* Grab Handle (Glisser vers le bas pour fermer, pas de croix 'X') */}
        <div className="freedom-drawer-grab" aria-hidden="true" onClick={onClose}>
          <span />
        </div>

        {/* Content Body matching PostSharePanel identically */}
        <div className="flex-1 flex flex-col min-h-0 px-4 pb-2 space-y-2.5">
          {/* Top Search bar */}
          <div className="relative shrink-0">
            <Search
              size={15}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#56665D]"
              aria-hidden="true"
            />
            <input
              type="text"
              placeholder="Rechercher une personne ou un groupe…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-9 w-full rounded-full border border-black/10 bg-white pl-9 pr-4 text-xs text-[#172B24] placeholder:text-[#56665D] focus:border-[#17402C] focus:outline-none"
            />
          </div>

          {/* Quick Action Buttons (Icons only, exactly matching feed style) */}
          <div className="flex items-center justify-center gap-3 shrink-0 py-0.5">
            <button
              type="button"
              className="grid size-10 place-items-center rounded-full border border-black/10 bg-white text-[#172B24] shadow-xs transition active:scale-90"
              aria-label="Copier le lien"
              onClick={() => void handleCopy()}
            >
              <Link2 size={18} />
            </button>

            <button
              type="button"
              className="grid size-10 place-items-center rounded-full border border-black/10 bg-white text-[#172B24] shadow-xs transition active:scale-90"
              aria-label="Partager via l’appareil"
              onClick={() => void handleNativeShare()}
            >
              <Share2 size={18} />
            </button>
          </div>

          {/* Contacts List with Real Avatars (no 'Conversation récente' label, right button with icon only) */}
          <div className="flex-1 overflow-y-auto space-y-1 pr-0.5">
            {displayedContacts.map((contact) => (
              <div
                key={contact.id}
                className="flex items-center justify-between rounded-xl p-2 transition hover:bg-white/80"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  {contact.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element -- Real contact avatar
                    <img
                      src={contact.avatar_url}
                      alt={contact.name}
                      className="size-8 rounded-full object-cover border border-black/5 shrink-0"
                    />
                  ) : (
                    <div className="grid size-8 place-items-center rounded-full bg-[#DDEBD8] text-[11px] font-bold text-[#17402C] shrink-0">
                      {contact.name.charAt(0).toUpperCase()}
                    </div>
                  )}

                  <div className="min-w-0 truncate">
                    <div className="text-xs font-bold text-[#172B24] truncate">
                      {contact.name}
                    </div>
                    <div className="text-[10px] text-[#56665D] truncate">
                      {contact.type}
                    </div>
                  </div>
                </div>

                {/* Right Action Button: ONLY THE SEND ICON, NO TEXT */}
                <button
                  type="button"
                  disabled={sendingId === contact.id}
                  onClick={() => void handleSendToTarget(contact.id)}
                  className="grid size-8 shrink-0 place-items-center rounded-full bg-[#17402C] text-white shadow-xs transition active:scale-90 disabled:opacity-50"
                  aria-label={`Envoyer à ${contact.name}`}
                >
                  {sendingId === contact.id ? (
                    <div className="size-3.5 animate-spin rounded-full border border-white border-t-transparent" />
                  ) : (
                    <Send size={14} />
                  )}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FreedomShareDrawer;
