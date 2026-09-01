"use client";

import React from 'react';
import Image from 'next/image';
import type { Conversation } from '../types/messaging.types';
import { formatConversationTimestamp, truncateText } from '../lib/messagingUtils';
import { Users } from 'lucide-react';
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
  const isGroup = conversation.type === 'group';
  const title = conversation.title || (isGroup ? 'Groupe d\'expédition' : 'Voyageur LKDV');
  const avatarUrl = conversation.avatar_url || '/assets/images/no_image.png';
  const lastMsg = conversation.last_message;
  const unreadCount = conversation.unread_count || 0;

  let lastMessageDisplay = 'Aucun message';
  if (lastMsg) {
    if (lastMsg.message_type === 'image') {
      lastMessageDisplay = '📷 Image';
    } else if (lastMsg.message_type === 'audio') {
      lastMessageDisplay = '🎤 Note vocale';
    } else if (lastMsg.message_type === 'gpx') {
      lastMessageDisplay = '📍 Tracé GPX';
    } else if (lastMsg.message_type === 'file') {
      lastMessageDisplay = '📎 Fichier';
    } else {
      lastMessageDisplay = lastMsg.content;
    }
  }

  return (
    <button
      onClick={() => {
        haptic('light');
        onSelect(conversation);
      }}
      className={`w-full h-[76px] shrink-0 text-left p-3.5 rounded-2xl transition-all duration-150 flex items-center gap-3.5 relative border active:scale-[0.98] ${
        isSelected
          ? 'bg-[#17402C]/10 border-[#17402C]/30 shadow-xs ring-1 ring-[#17402C]/20'
          : 'bg-white/80 hover:bg-white/95 border-white/85 hover:border-stone-200/80 shadow-2xs'
      }`}
    >
      <div className="relative shrink-0">
        <div className="w-12 h-12 rounded-full overflow-hidden relative ring-2 ring-white/90 shadow-xs bg-stone-100">
          <Image
            src={avatarUrl}
            alt={title}
            fill
            className="object-cover"
            sizes="48px"
            onError={(e) => {
              (e.target as HTMLImageElement).src = '/assets/images/no_image.png';
            }}
          />
        </div>
        {isGroup ? (
          <span className="absolute -bottom-1 -right-1 bg-[#17402C] text-white rounded-full p-1 shadow-xs border border-white">
            <Users className="w-3 h-3" />
          </span>
        ) : (
          <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-[#5B7F55] rounded-full border-2 border-white shadow-xs" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-1">
          <h4
            className={`text-sm truncate ${
              unreadCount > 0 ? 'text-[#17402C] font-bold' : 'text-[#17402C] font-semibold'
            }`}
          >
            {title}
          </h4>
          <span className="text-[11px] text-[#5A574E] shrink-0 font-medium font-mono">
            {formatConversationTimestamp(conversation.last_message_at)}
          </span>
        </div>

        <div className="flex items-center justify-between gap-2">
          <p
            className={`text-xs truncate ${
              unreadCount > 0 ? 'text-[#14140F] font-semibold' : 'text-[#5A574E]'
            }`}
          >
            {isGroup && lastMsg?.sender_name ? `${lastMsg.sender_name.split(' ')[0]}: ` : ''}
            {truncateText(lastMessageDisplay, 34)}
          </p>

          {unreadCount > 0 && (
            <span className="shrink-0 min-w-5 h-5 px-1.5 rounded-full bg-[#17402C] text-white text-[10px] font-bold flex items-center justify-center shadow-xs">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </div>
      </div>
    </button>
  );
};
