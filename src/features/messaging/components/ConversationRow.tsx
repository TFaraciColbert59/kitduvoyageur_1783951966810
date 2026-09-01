"use client";

import React, { useRef, useState } from 'react';
import Image from 'next/image';
import type { Conversation } from '../types/messaging.types';
import { formatConversationTimestamp } from '../lib/messagingUtils';
import { Users, BellOff } from 'lucide-react';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';

interface ConversationRowProps {
  conversation: Conversation;
  isSelected: boolean;
  onSelect: (conversation: Conversation) => void;
}

export const ConversationRow: React.FC<ConversationRowProps> = ({
  conversation,
  isSelected,
  onSelect,
}) => {
  const { haptic } = useHapticFeedback();
  const [dx, setDx] = useState(0);
  const startX = useRef(0);
  const startY = useRef(0);
  const axis = useRef<'none' | 'x' | 'y'>('none');
  const didSwipeRef = useRef(false);

  const isGroup = conversation.type === 'group';
  const title = conversation.title || (isGroup ? "Groupe d'expédition" : 'Voyageur LKDV');
  const avatarUrl = conversation.avatar_url || '/assets/images/no_image.png';
  const lastMsg = conversation.last_message;
  const unreadCount = conversation.unread_count || 0;

  let lastMessageDisplay = 'Aucun message';
  if (lastMsg) {
    if (lastMsg.message_type === 'image') lastMessageDisplay = '📷 Image';
    else if (lastMsg.message_type === 'audio') lastMessageDisplay = '🎤 Note vocale';
    else if (lastMsg.message_type === 'gpx') lastMessageDisplay = '📍 Tracé GPX';
    else if (lastMsg.message_type === 'file') lastMessageDisplay = '📎 Fichier';
    else lastMessageDisplay = lastMsg.content;
  }

  // Résistance élastique : le swipe suggère l'action sans la déclencher tant
  // que les mutations (archive/mute) ne sont pas remontées ici en props.
  const onTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
    axis.current = 'none';
  };
  const onTouchMove = (e: React.TouchEvent) => {
    const ddx = e.touches[0].clientX - startX.current;
    const ddy = e.touches[0].clientY - startY.current;
    if (axis.current === 'none' && (Math.abs(ddx) > 8 || Math.abs(ddy) > 8)) {
      axis.current = Math.abs(ddx) > Math.abs(ddy) ? 'x' : 'y';
    }
    if (axis.current === 'x') setDx(Math.max(-72, Math.min(0, ddx)) * 0.6);
  };
  const onTouchEnd = () => {
    // On capture le geste AVANT de réinitialiser l'axe : onClick (qui suit
    // touchend) lira didSwipeRef pour ne pas ouvrir la conversation.
    didSwipeRef.current = axis.current === 'x';
    setDx(0);
    axis.current = 'none';
  };

  return (
    <button
      onClick={() => {
        if (didSwipeRef.current) {
          didSwipeRef.current = false;
          return;
        }
        haptic('light');
        onSelect(conversation);
      }}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      aria-label={`${title}${
        unreadCount > 0
          ? `, ${unreadCount} message${unreadCount > 1 ? 's' : ''} non lu${unreadCount > 1 ? 's' : ''}`
          : ''
      }`}
      className={`w-full min-h-[76px] shrink-0 text-left p-3.5 rounded-2xl flex items-center gap-3.5 relative border active:scale-[0.985] ${
        isSelected
          ? 'bg-[#17402C]/10 border-[#17402C]/30 shadow-xs ring-1 ring-[#17402C]/20'
          : 'bg-white/80 border-white/85 shadow-2xs'
      }`}
      style={{
        transform: `translate3d(${dx}px,0,0)`,
        transition: dx === 0 ? 'transform 220ms cubic-bezier(0.22,1,0.36,1)' : 'none',
      }}
    >
      <div className="relative shrink-0">
        <div className="w-12 h-12 rounded-full overflow-hidden relative ring-2 ring-white/90 shadow-xs bg-stone-100">
          <Image
            src={avatarUrl}
            alt=""
            fill
            className="object-cover"
            sizes="48px"
            onError={(e) => {
              (e.target as HTMLImageElement).src = '/assets/images/no_image.png';
            }}
          />
        </div>
        {/* Pastille groupe uniquement. La pastille « en ligne » a été retirée :
            elle était affichée en dur sans donnée de présence (cf. audit 1.6). */}
        {isGroup && (
          <span className="absolute -bottom-1 -right-1 bg-[#17402C] text-white rounded-full p-1 shadow-xs border border-white">
            <Users className="w-3 h-3" />
          </span>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2 mb-1">
          <h4
            className={`text-[15px] truncate text-[#17402C] ${
              unreadCount > 0 ? 'font-bold' : 'font-semibold'
            }`}
          >
            {title}
          </h4>
          <span className="text-[12px] text-[#5A574E] shrink-0 font-medium font-mono tabular-nums">
            {formatConversationTimestamp(conversation.last_message_at)}
          </span>
        </div>

        <div className="flex items-center justify-between gap-2">
          {/* Ellipsis CSS : plus de coupe JS à 34 caractères (cf. audit 1.5) */}
          <p
            className={`text-[13.5px] truncate leading-snug ${
              unreadCount > 0 ? 'text-[#14140F] font-semibold' : 'text-[#5A574E]'
            }`}
          >
            {isGroup && lastMsg?.sender_name ? `${lastMsg.sender_name.split(' ')[0]} : ` : ''}
            {lastMessageDisplay}
          </p>

          <span className="flex items-center gap-1.5 shrink-0">
            {conversation.is_muted && <BellOff className="w-3.5 h-3.5 text-[#8C8779]" />}
            {unreadCount > 0 && (
              <span className="min-w-5 h-5 px-1.5 rounded-full bg-[#17402C] text-white text-[11px] font-bold flex items-center justify-center shadow-xs tabular-nums">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </span>
        </div>
      </div>
    </button>
  );
};