"use client";

import React, { useState, useEffect, useMemo } from 'react';
import Image from 'next/image';
import type { Conversation, Message } from '../types/messaging.types';
import { messagingService } from '../services/messagingService';
import { MobileSheet } from './MobileSheet';
import { Search, Send } from 'lucide-react';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';

interface ForwardMessageSheetProps {
  isOpen: boolean;
  onClose: () => void;
  message: Message | null;
  currentUserId: string;
  onForwarded?: () => void;
}

export const ForwardMessageSheet: React.FC<ForwardMessageSheetProps> = ({
  isOpen,
  onClose,
  message,
  currentUserId,
  onForwarded,
}) => {
  const { haptic } = useHapticFeedback();
  const [search, setSearch] = useState('');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setSearch('');
    setErrorMsg(null);
    setLoading(true);
    messagingService
      .getConversations(currentUserId)
      .then((data) => setConversations(data))
      .catch(() => setConversations([]))
      .finally(() => setLoading(false));
  }, [isOpen, message?.id, currentUserId]);

  const candidates = useMemo(() => {
    return conversations.filter((c) => {
      if (message && c.id === message.conversation_id) return false;
      if (c.is_archived) return false;
      if (c.status === 'pending' || c.status === 'rejected') return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        !!c.title?.toLowerCase().includes(q) ||
        !!c.other_member?.full_name.toLowerCase().includes(q)
      );
    });
  }, [conversations, search, message]);

  const handleForward = async (target: Conversation) => {
    if (!message) return;
    haptic('light');
    setSendingId(target.id);
    setErrorMsg(null);
    const res = await messagingService.forwardMessage(message, target.id, currentUserId);
    setSendingId(null);
    if (res.ok) {
      haptic('medium');
      onForwarded?.();
      onClose();
    } else {
      setErrorMsg(res.error || 'Transfert impossible.');
    }
  };

  return (
    <MobileSheet
      isOpen={isOpen}
      onClose={onClose}
      title={message ? 'Transférer le message' : 'Transférer'}
    >
      <div className="relative">
        <Search className="w-4 h-4 text-[#5A574E] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="search"
          inputMode="search"
          enterKeyHint="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Chercher une conversation…"
          aria-label="Chercher une conversation"
          className="w-full py-2.5 text-[16px] glass-input font-medium"
          style={{ minHeight: 44, borderRadius: 14, paddingLeft: 38, paddingRight: 14 }}
        />
      </div>

      {errorMsg && (
        <p className="mt-3 px-3 py-2 rounded-xl bg-[#F5DDD9]/80 text-[#8A241B] text-[13px] font-semibold">
          {errorMsg}
        </p>
      )}

      <div className="space-y-2 mt-4">
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-14 bg-stone-100/80 rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : candidates.length === 0 ? (
          <p className="text-[15px] text-center text-[#5A574E] py-8">
            Aucune conversation disponible pour le transfert.
          </p>
        ) : (
          candidates.map((conv) => {
            const isGroup = conv.type === 'group';
            const title =
              conv.title || (isGroup ? "Groupe d'expédition" : 'Voyageur LKDV');
            return (
              <button
                key={conv.id}
                type="button"
                disabled={sendingId !== null}
                onClick={() => handleForward(conv)}
                className="w-full text-left p-3.5 rounded-2xl bg-white/70 hover:bg-[#17402C]/10 border border-stone-200/60 hover:border-[#17402C]/30 transition-all flex items-center gap-3 group active:scale-[0.98] min-h-[60px]"
              >
                <div className="w-10 h-10 rounded-full overflow-hidden relative ring-1 ring-white/80 shrink-0">
                  <Image
                    src={conv.avatar_url || '/assets/images/no_image.png'}
                    alt=""
                    fill
                    className="object-cover"
                    sizes="40px"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = '/assets/images/no_image.png';
                    }}
                  />
                </div>
                <div className="flex-1 min-w-0 overflow-hidden">
                  <p className="font-semibold text-[15px] text-[#17402C] truncate group-hover:font-bold">
                    {title}
                  </p>
                  <p className="text-[13px] text-[#5A574E] truncate">
                    {isGroup ? 'Groupe de voyage' : (conv.other_member?.full_name || 'Voyageur LKDV')}
                  </p>
                </div>
                <Send className="w-4 h-4 text-[#5A574E] group-hover:text-[#17402C] shrink-0" />
              </button>
            );
          })
        )}
      </div>
    </MobileSheet>
  );
};