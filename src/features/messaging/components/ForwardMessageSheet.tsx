'use client';

import Icon from '@/components/ui/Icon';
import React, { useState, useEffect, useMemo } from 'react';
import Image from 'next/image';
import { Card, EmptyState, ListItem, SearchField, Skeleton } from '@/components/ui';
import type { Conversation, Message } from '../types/messaging.types';
import { messagingService } from '../services/messagingService';
import { MobileSheet } from './MobileSheet';
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
      <SearchField
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        onClear={() => setSearch('')}
        placeholder="Chercher une conversation…"
        aria-label="Chercher une conversation"
        inputMode="search"
        enterKeyHint="search"
      />

      {errorMsg && (
        <Card tone="danger" variant="compact" className="mt-[var(--space-3)] text-[length:var(--lkv-text-footnote)] font-semibold">
          {errorMsg}
        </Card>
      )}

      <div className="mt-[var(--space-4)] space-y-[var(--space-2)]">
        {loading ? (
          <div className="space-y-[var(--space-2)]">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-14 w-full rounded-[var(--lkv-radius-md)]" />
            ))}
          </div>
        ) : candidates.length === 0 ? (
          <EmptyState
            compact
            title="Aucune conversation disponible"
            description="Aucune conversation disponible pour le transfert."
          />
        ) : (
          candidates.map((conv) => {
            const isGroup = conv.type === 'group';
            const title = conv.title || (isGroup ? "Groupe d'expédition" : 'Voyageur LKDV');
            return (
              <ListItem
                key={conv.id}
                as="div"
                disabled={sendingId !== null}
                onClick={() => handleForward(conv)}
                className="min-h-[60px]"
                leading={
                  <span className="relative size-10 shrink-0 overflow-hidden rounded-full ring-1 ring-[color:var(--glass-border)]">
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
                  </span>
                }
                title={title}
                subtitle={isGroup ? 'Groupe de voyage' : conv.other_member?.full_name || 'Voyageur LKDV'}
                trailing={<Icon name="send" className="size-4 text-[color:var(--lkv-text-muted)]" aria-hidden="true" />}
              />
            );
          })
        )}
      </div>
    </MobileSheet>
  );
};
