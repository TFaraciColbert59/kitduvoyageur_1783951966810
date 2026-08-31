"use client";

import React from 'react';
import Image from 'next/image';
import type { Conversation } from '../types/messaging.types';
import { formatConversationTimestamp, truncateText } from '../lib/messagingUtils';
import { Users } from 'lucide-react';

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
  const isGroup = conversation.type === 'group';
  const title = conversation.title || (isGroup ? 'Groupe d\'expédition' : 'Voyageur LKDV');
  const avatarUrl = conversation.avatar_url || '/images/default-avatar.png';
  const lastMsg = conversation.last_message;
  const unreadCount = conversation.unread_count || 0;

  let lastMessageDisplay = 'Aucun message';
  if (lastMsg) {
    if (lastMsg.message_type === 'image') {
      lastMessageDisplay = '📷 Image reçue';
    } else if (lastMsg.message_type === 'file') {
      lastMessageDisplay = '📎 Pièce jointe';
    } else {
      lastMessageDisplay = lastMsg.content;
    }
  }

  return (
    <button
      onClick={() => onSelect(conversation)}
      className={`w-full h-[76px] shrink-0 text-left p-3.5 rounded-2xl transition-all duration-200 flex items-center gap-3.5 relative border ${
        isSelected
          ? 'bg-emerald-500/10 border-emerald-500/30 shadow-sm'
          : 'bg-white/40 hover:bg-white/70 border-white/60 hover:border-stone-200/80'
      }`}
    >
      <div className="relative shrink-0">
        <div className="w-12 h-12 rounded-full overflow-hidden relative ring-2 ring-white/80 shadow-xs bg-stone-100">
          <Image
            src={avatarUrl}
            alt={title}
            fill
            className="object-cover"
            sizes="48px"
            onError={(e) => {
              (e.target as HTMLImageElement).src = '/images/default-avatar.png';
            }}
          />
        </div>
        {isGroup ? (
          <span className="absolute -bottom-1 -right-1 bg-stone-900 text-white rounded-full p-1 shadow-xs border border-white">
            <Users className="w-3 h-3" />
          </span>
        ) : (
          <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-white shadow-xs" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-1">
          <h4
            className={`text-sm font-semibold truncate ${
              unreadCount > 0 ? 'text-stone-900 font-bold' : 'text-stone-800'
            }`}
          >
            {title}
          </h4>
          <span className="text-xs text-stone-400 shrink-0 font-medium">
            {formatConversationTimestamp(conversation.last_message_at)}
          </span>
        </div>

        <div className="flex items-center justify-between gap-2">
          <p
            className={`text-xs truncate ${
              unreadCount > 0 ? 'text-stone-900 font-semibold' : 'text-stone-500'
            }`}
          >
            {isGroup && lastMsg?.sender_name ? `${lastMsg.sender_name.split(' ')[0]}: ` : ''}
            {truncateText(lastMessageDisplay, 34)}
          </p>

          {unreadCount > 0 && (
            <span className="shrink-0 min-w-5 h-5 px-1.5 rounded-full bg-emerald-600 text-white text-[11px] font-bold flex items-center justify-center shadow-xs">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </div>
      </div>
    </button>
  );
};
