'use client';

import React, { useState, useEffect, useRef } from 'react';
import { X, Search, Link2, Share2, Send, Check } from 'lucide-react';
import { useToast } from '@/contexts/ToastContext';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { usePostShareTargets } from '@/features/community/feed/usePostShareTargets';
import { messagingService } from '@/features/messaging/services/messagingService';
import type { FreedomReelItem } from './freedom-types';

export interface FreedomShareDrawerProps {
  isOpen: boolean;
  reel: FreedomReelItem;
  currentUser?: any;
  onClose: () => void;
  onShared?: () => void;
}

export const FreedomShareDrawer: React.FC<FreedomShareDrawerProps> = ({
  isOpen,
  reel,
  currentUser,
  onClose,
  onShared,
}) => {
  const { toast } = useToast();
  const { haptic } = useHapticFeedback();
  const { conversations, loading, sending, send } = usePostShareTargets(currentUser?.id);
  const [query, setQuery] = useState('');
  const [copied, setCopied] = useState(false);
  const touchStartY = useRef<number | null>(null);

  const filtered = conversations.filter((c) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return `${c.title || ''} ${c.name || ''}`.toLowerCase().includes(q);
  });

  const permalink = typeof window !== 'undefined'
    ? `${window.location.origin}/communaute/reels?id=${reel.id}`
    : `/communaute/reels?id=${reel.id}`;

  const handleCopy = async () => {
    haptic('light');
    try {
      await navigator.clipboard.writeText(permalink);
      setCopied(true);
      toast('Lien du reel Freedom copié.', 'success');
      onShared?.();
      setTimeout(() => setCopied(false), 2500);
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
        toast('Partagé avec succès.', 'success');
        onShared?.();
        onClose();
      } else {
        await handleCopy();
      }
    } catch {
      // User cancelled
    }
  };

  const handleSendToConv = async (convId: string) => {
    haptic('medium');
    let ok = false;
    try {
      if (reel.id.startsWith('post-')) {
        const realPostId = reel.id.replace('post-', '');
        ok = await send(realPostId, convId);
      } else if (currentUser?.id) {
        const msg = await messagingService.sendMessage(
          convId,
          currentUser.id,
          `Regarde ce reel Freedom de ${reel.author.name} : ${permalink}`,
          'post',
          undefined,
          {
            kind: 'post',
            post_id: reel.id,
            post_url: permalink,
            title: reel.caption,
            author_name: reel.author.name,
            author_avatar: reel.author.avatarUrl || null,
            image_url: reel.posterUrl || undefined,
          },
        );
        ok = Boolean(msg);
      } else {
        await handleCopy();
        ok = true;
      }
    } catch {
      ok = false;
    }

    if (ok) {
      toast('Envoyé dans la conversation.', 'success');
      onShared?.();
      onClose();
    } else {
      toast('Envoi impossible.', 'error');
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="freedom-drawer-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Partager ce reel Freedom"
    >
      <div
        className="freedom-drawer-sheet"
        onClick={(e) => e.stopPropagation()}
        onTouchStart={(e) => {
          touchStartY.current = e.touches[0]?.clientY ?? null;
        }}
        onTouchMove={(e) => {
          const start = touchStartY.current;
          if (start === null) return;
          const currentY = e.touches[0]?.clientY ?? start;
          if (currentY - start > 120) onClose();
        }}
      >
        {/* Grab Handle */}
        <div className="freedom-drawer-grab" aria-hidden="true" onClick={onClose}>
          <span />
        </div>

        {/* Header */}
        <div className="freedom-drawer-header">
          <span className="freedom-drawer-title">Partager la vidéo</span>
          <button
            type="button"
            className="freedom-drawer-close"
            onClick={onClose}
            aria-label="Fermer le partage"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        {/* Content */}
        <div className="freedom-drawer-content space-y-4">
          {/* Quick Actions Bar */}
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              className="flex items-center justify-center gap-2 rounded-2xl border border-black/10 bg-white p-3.5 text-xs font-bold text-[#172B24] shadow-sm transition active:scale-[0.98]"
              onClick={() => void handleCopy()}
            >
              {copied ? <Check size={18} className="text-[#17402C]" /> : <Link2 size={18} />}
              <span>{copied ? 'Lien copié !' : 'Copier le lien'}</span>
            </button>

            <button
              type="button"
              className="flex items-center justify-center gap-2 rounded-2xl border border-black/10 bg-white p-3.5 text-xs font-bold text-[#172B24] shadow-sm transition active:scale-[0.98]"
              onClick={() => void handleNativeShare()}
            >
              <Share2 size={18} />
              <span>Via l’appareil</span>
            </button>
          </div>

          {/* Search DM Destinations */}
          <div className="relative">
            <Search
              size={16}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#56665D]"
              aria-hidden="true"
            />
            <input
              type="text"
              placeholder="Envoyer à un voyageur ou un groupe…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-10 w-full rounded-xl border border-black/10 bg-white pl-10 pr-4 text-xs text-[#172B24] placeholder:text-[#56665D] focus:border-[#17402C] focus:outline-none"
            />
          </div>

          {/* Direct Message Conversations List */}
          <div className="space-y-1.5 pt-1">
            <div className="text-[11px] font-bold uppercase tracking-wider text-[#56665D]">
              Conversations récentes
            </div>

            {loading ? (
              <p className="py-6 text-center text-xs text-[#56665D]">Chargement des contacts…</p>
            ) : filtered.length === 0 ? (
              <p className="py-6 text-center text-xs text-[#56665D]">Aucune conversation trouvée.</p>
            ) : (
              filtered.map((conv) => (
                <div
                  key={conv.id}
                  className="flex items-center justify-between rounded-xl bg-white/70 p-2.5 transition hover:bg-white"
                >
                  <div className="flex items-center gap-3">
                    <div className="size-9 rounded-full bg-[#E8F0E6] grid place-items-center font-bold text-[#17402C] text-xs">
                      {(conv.title || conv.name || 'V').charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-[#172B24]">
                        {conv.title || conv.name || 'Discussion'}
                      </div>
                      <div className="text-[10px] text-[#56665D]">
                        {conv.type === 'group' ? 'Groupe outdoor' : 'Message direct'}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={Boolean(sending)}
                    onClick={() => void handleSendToConv(conv.id)}
                    className="flex items-center gap-1.5 rounded-full bg-[#17402C] px-3.5 py-1.5 text-xs font-bold text-white transition active:scale-95 disabled:opacity-50"
                  >
                    <Send size={12} />
                    <span>Envoyer</span>
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FreedomShareDrawer;
