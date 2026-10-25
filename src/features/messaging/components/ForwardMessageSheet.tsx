'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Image from 'next/image';
import { AccountDrawerHost } from '@/design/account/AccountDrawerHost';
import type { Conversation, Message } from '../types/messaging.types';
import { messagingService } from '../services/messagingService';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';

interface ForwardMessageSheetProps {
  isOpen: boolean;
  onClose: () => void;
  message: Message | null;
  currentUserId: string;
  onForwarded?: () => void;
}

/** Défilement interne de la liste des conversations : `.sh-b` ne défile pas. */
const SCROLL = {
  flex: '1 1 auto',
  minHeight: 0,
  overflowY: 'auto',
  overscrollBehavior: 'contain',
} as const;

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
    <AccountDrawerHost
      open={isOpen}
      title={message ? 'Transférer le message' : 'Transférer'}
      subtitle="Choisissez une conversation"
      onClose={onClose}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <input
          className="mfield"
          style={{ borderRadius: 12, minHeight: 36 }}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Chercher une conversation…"
          aria-label="Chercher une conversation"
          inputMode="search"
          enterKeyHint="search"
        />
        {search ? (
          <button type="button" className="mbtn" onClick={() => setSearch('')}>
            Effacer
          </button>
        ) : null}
      </div>

      {errorMsg ? (
        <div className="s2" role="alert" style={{ color: 'var(--bad)', padding: '6px 2px' }}>
          {errorMsg}
        </div>
      ) : null}

      {loading ? (
        <div className="s2" style={{ padding: '10px 2px' }}>
          Chargement de vos conversations…
        </div>
      ) : candidates.length === 0 ? (
        <div className="li nt">
          <div>
            <div className="ttl">Aucune conversation disponible</div>
            <div className="s2">Aucune conversation disponible pour le transfert.</div>
          </div>
          <button
            type="button"
            className="mbtn"
            onClick={() => (search ? setSearch('') : onClose())}
          >
            {search ? 'Effacer' : 'Fermer'}
          </button>
        </div>
      ) : (
        <div style={SCROLL}>
          {candidates.map((conv) => {
            const isGroup = conv.type === 'group';
            const title = conv.title || (isGroup ? "Groupe d'expédition" : 'Voyageur LKDV');
            return (
              <div className="li" key={conv.id}>
                <span className="avi" style={{ overflow: 'hidden' }}>
                  <Image
                    src={conv.avatar_url || '/assets/images/no_image.png'}
                    alt=""
                    fill
                    sizes="30px"
                    style={{ objectFit: 'cover' }}
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = '/assets/images/no_image.png';
                    }}
                  />
                </span>
                <div>
                  <div className="ttl">
                    <span>{title}</span>
                  </div>
                  <div className="s2">
                    {isGroup ? 'Groupe de voyage' : conv.other_member?.full_name || 'Voyageur LKDV'}
                  </div>
                </div>
                <button
                  type="button"
                  className="mbtn p"
                  disabled={sendingId !== null}
                  onClick={() => handleForward(conv)}
                >
                  {sendingId === conv.id ? 'Envoi…' : 'Transférer'}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </AccountDrawerHost>
  );
};
