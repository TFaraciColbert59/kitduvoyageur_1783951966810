"use client";

import React, { useState, useRef } from 'react';
import Image from 'next/image';
import type { Message } from '../types/messaging.types';
import { formatMessageDate } from '../lib/messagingUtils';
import { FileText, Check, CheckCheck, Reply, Smile } from 'lucide-react';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { OpenGraphCard } from './OpenGraphCard';
import { AudioPlayerBubble } from './AudioPlayerBubble';
import { GPXPreviewCard } from './GPXPreviewCard';

const REACTION_PALETTE = ['❤️', '👍', '🔥', '😮', '😂', '🙏'];
const URL_REGEX = /(https?:\/\/[^\s]+)/gi;

export type BubbleGroupPosition = 'single' | 'first' | 'middle' | 'last';

interface MessageBubbleProps {
  message: Message;
  isMine: boolean;
  currentUserId?: string;
  showSenderHeader?: boolean;
  groupPosition?: BubbleGroupPosition;
  isReadByRecipient?: boolean;
  readByCount?: number;
  readByNames?: string[];
  onReply?: (message: Message) => void;
  onToggleReaction?: (messageId: string, reactionValue: string) => void;
  onScrollToMessage?: (messageId: string) => void;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  isMine,
  currentUserId,
  showSenderHeader,
  groupPosition = 'single',
  isReadByRecipient,
  readByCount,
  readByNames,
  onReply,
  onToggleReaction,
  onScrollToMessage,
}) => {
  const { haptic } = useHapticFeedback();
  const [showActionMenu, setShowActionMenu] = useState(false);
  const lastTapRef = useRef<number>(0);
  const touchTimerRef = useRef<NodeJS.Timeout | null>(null);

  const senderName = message.sender_profile?.full_name || 'Voyageur';
  const avatarUrl = message.sender_profile?.avatar_url || '/assets/images/no_image.png';

  // Double-tap for ❤️
  const handleBubbleClick = () => {
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      haptic('light');
      if (onToggleReaction) {
        onToggleReaction(message.id, '❤️');
      }
      lastTapRef.current = 0;
    } else {
      lastTapRef.current = now;
    }
  };

  // Long press for action menu on touch devices
  const handleTouchStart = () => {
    touchTimerRef.current = setTimeout(() => {
      haptic('medium');
      setShowActionMenu(true);
    }, 450);
  };

  const handleTouchEnd = () => {
    if (touchTimerRef.current) {
      clearTimeout(touchTimerRef.current);
    }
  };

  // URL matching for OpenGraph
  const urls = message.content ? message.content.match(URL_REGEX) || [] : [];
  const firstUrl = urls[0] || null;

  // Group reactions by emoji
  const reactionsGrouped = React.useMemo(() => {
    if (!message.reactions || message.reactions.length === 0) return [];
    const map = new Map<string, { emoji: string; count: number; userReacted: boolean }>();

    message.reactions.forEach((r) => {
      const existing = map.get(r.reaction_value);
      const isMe = r.user_id === currentUserId;
      if (existing) {
        existing.count += 1;
        if (isMe) existing.userReacted = true;
      } else {
        map.set(r.reaction_value, {
          emoji: r.reaction_value,
          count: 1,
          userReacted: isMe,
        });
      }
    });

    return Array.from(map.values());
  }, [message.reactions, currentUserId]);

  const marginClass =
    groupPosition === 'first'
      ? 'mt-2 mb-0.5'
      : groupPosition === 'middle'
      ? 'my-0.5'
      : groupPosition === 'last'
      ? 'mt-0.5 mb-2'
      : 'my-1.5';

  const bubbleRadiusClass = isMine
    ? groupPosition === 'first'
      ? 'rounded-2xl rounded-tr-xs rounded-br-sm'
      : groupPosition === 'middle'
      ? 'rounded-2xl rounded-tr-sm rounded-br-sm'
      : groupPosition === 'last'
      ? 'rounded-2xl rounded-tr-sm rounded-br-xs'
      : 'rounded-2xl rounded-tr-xs'
    : groupPosition === 'first'
    ? 'rounded-2xl rounded-tl-xs rounded-bl-sm'
    : groupPosition === 'middle'
    ? 'rounded-2xl rounded-tl-sm rounded-bl-sm'
    : groupPosition === 'last'
    ? 'rounded-2xl rounded-tl-sm rounded-bl-xs'
    : 'rounded-2xl rounded-tl-xs';

  const showAvatar = !isMine && (groupPosition === 'last' || groupPosition === 'single');
  const showHeader = !isMine && showSenderHeader && (groupPosition === 'first' || groupPosition === 'single');

  return (
    <div
      id={`msg-bubble-${message.id}`}
      className={`group relative flex items-end gap-2.5 ${marginClass} transition-all ${
        isMine ? 'flex-row-reverse' : 'flex-row'
      }`}
    >
      {!isMine && (
        showAvatar ? (
          <div className="w-8 h-8 rounded-full overflow-hidden relative shrink-0 ring-1 ring-white/80 shadow-xs bg-stone-100 mb-0.5">
            <Image
              src={avatarUrl}
              alt={senderName}
              fill
              className="object-cover"
              sizes="32px"
              onError={(e) => {
                (e.target as HTMLImageElement).src = '/assets/images/no_image.png';
              }}
            />
          </div>
        ) : (
          <div className="w-8 shrink-0" aria-hidden="true" />
        )
      )}

      <div className={`max-w-[78%] sm:max-w-[70%] flex flex-col ${isMine ? 'items-end' : 'items-start'}`}>
        {showHeader && (
          <span className="text-[11px] font-semibold text-stone-500 ml-1 mb-1 block">
            {senderName}
          </span>
        )}

        {/* Action Menu overlay */}
        {showActionMenu && (
          <div
            className={`z-30 mb-2 p-1.5 glass rounded-2xl shadow-lg flex items-center gap-1 animate-scale-in ${
              isMine ? 'origin-bottom-right' : 'origin-bottom-left'
            }`}
          >
            {REACTION_PALETTE.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => {
                  haptic('light');
                  onToggleReaction?.(message.id, emoji);
                  setShowActionMenu(false);
                }}
                className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-stone-100/80 text-base active:scale-125 transition-transform"
              >
                {emoji}
              </button>
            ))}
            <div className="w-px h-5 bg-stone-200/80 mx-1" />
            <button
              type="button"
              onClick={() => {
                haptic('light');
                onReply?.(message);
                setShowActionMenu(false);
              }}
              className="glass-circle-btn w-7 h-7 text-[#17402C] text-xs font-semibold flex items-center justify-center shadow-xs"
              title="Répondre"
            >
              <Reply className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        <div className="relative group/bubble flex items-center gap-1.5">
          {/* Action trigger button on hover */}
          <div
            className={`opacity-0 group-hover/bubble:opacity-100 transition-opacity flex items-center gap-1 ${
              isMine ? 'flex-row-reverse' : 'flex-row'
            }`}
          >
            <button
              type="button"
              onClick={() => {
                haptic('light');
                setShowActionMenu(!showActionMenu);
              }}
              className="glass-circle-btn w-7 h-7 text-[#5A574E] hover:text-[#17402C] shadow-2xs"
              title="Réagir"
            >
              <Smile className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => {
                haptic('light');
                onReply?.(message);
              }}
              className="glass-circle-btn w-7 h-7 text-[#5A574E] hover:text-[#17402C] shadow-2xs"
              title="Répondre"
            >
              <Reply className="w-3.5 h-3.5" />
            </button>
          </div>

          <div
            onClick={handleBubbleClick}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            className={`relative px-4 py-3 shadow-xs transition-all select-none cursor-pointer ${bubbleRadiusClass} ${
              isMine
                ? 'bg-gradient-to-br from-[#17402C] to-[#0F2B1E] text-[#FAF8F5] border border-white/20'
                : 'bg-white/92 backdrop-blur-md text-[#14140F] border border-white/90 shadow-2xs'
            }`}
          >
            {/* Quoted Message */}
            {message.reply_to_message && (
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  if (message.reply_to_message?.id && onScrollToMessage) {
                    onScrollToMessage(message.reply_to_message.id);
                  }
                }}
                className={`text-xs px-3 py-1.5 rounded-lg mb-2 border-l-2 cursor-pointer transition-opacity hover:opacity-90 ${
                  isMine
                    ? 'bg-white/10 border-white/80 text-[#FAF8F5]/90'
                    : 'bg-stone-100/90 border-[#17402C] text-[#2B2A24]'
                }`}
              >
                <p className="font-bold text-[11px]">{message.reply_to_message.sender_name}</p>
                <p className="truncate text-[11px]">{message.reply_to_message.content}</p>
              </div>
            )}

            {/* Attachments */}
            {message.attachments && message.attachments.length > 0 && (
              <div className="space-y-2 mb-2">
                {message.attachments.map((att) => {
                  const isGpx = att.file_name?.endsWith('.gpx') || att.file_type?.includes('gpx');
                  const isAudio = att.file_type?.startsWith('audio/');

                  if (isAudio) {
                    return <AudioPlayerBubble key={att.id} audioUrl={att.file_url} isMine={isMine} />;
                  }

                  if (isGpx) {
                    return (
                      <GPXPreviewCard
                        key={att.id}
                        gpxUrl={att.file_url}
                        fileName={att.file_name}
                        isMine={isMine}
                      />
                    );
                  }

                  return (
                    <div key={att.id} className="rounded-xl overflow-hidden max-w-sm border border-black/10">
                      {att.file_type.startsWith('image/') ? (
                        <div className="relative w-64 h-48">
                          <Image
                            src={att.file_url}
                            alt={att.file_name || 'Image'}
                            fill
                            className="object-cover cursor-pointer hover:opacity-95 transition-opacity"
                          />
                        </div>
                      ) : (
                        <a
                          href={att.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 p-2 bg-black/5 hover:bg-black/10 rounded-lg text-xs"
                        >
                          <FileText className="w-4 h-4" />
                          <span className="truncate underline">{att.file_name || 'Télécharger le fichier'}</span>
                        </a>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Audio Message Type */}
            {message.message_type === 'audio' && (
              <AudioPlayerBubble audioUrl={message.content} isMine={isMine} />
            )}

            {/* GPX Message Type */}
            {message.message_type === 'gpx' && (
              <GPXPreviewCard gpxUrl={message.content} isMine={isMine} />
            )}

            {/* Message Content */}
            {message.message_type !== 'audio' && message.message_type !== 'gpx' && (
              <p className="text-xs sm:text-sm leading-relaxed whitespace-pre-wrap break-words font-medium">
                {message.content}
              </p>
            )}

            {/* OpenGraph Card Preview */}
            {firstUrl && message.message_type !== 'audio' && message.message_type !== 'gpx' && (
              <OpenGraphCard url={firstUrl} isMine={isMine} />
            )}

            {/* Footer timestamp & status / read receipts */}
            <div className="flex items-center justify-end gap-1.5 mt-1.5">
              <span
                className={`text-[10px] font-medium ${
                  isMine ? 'text-[#FAF8F5]/80' : 'text-[#5A574E]'
                }`}
              >
                {formatMessageDate(message.created_at)}
              </span>

              {isMine && (
                <span className="text-[#FAF8F5] flex items-center gap-1">
                  {message.status === 'sending' ? (
                    <span className="w-2.5 h-2.5 rounded-full border-2 border-[#FAF8F5] border-t-transparent animate-spin inline-block" />
                  ) : message.status === 'error' ? (
                    <span className="text-rose-200 text-[10px] font-bold">! Échec</span>
                  ) : isReadByRecipient || (readByCount && readByCount > 0) ? (
                    <span
                      className="flex items-center gap-0.5 text-[#C8DAC3] text-[10px] font-semibold"
                      title={
                        readByNames && readByNames.length > 0
                          ? `Lu par : ${readByNames.join(', ')}`
                          : 'Vu'
                      }
                    >
                      <CheckCheck className="w-3.5 h-3.5 inline text-[#C8DAC3]" />
                      <span>{readByCount && readByCount > 1 ? `Vu par ${readByCount}` : 'Vu'}</span>
                    </span>
                  ) : (
                    <Check className="w-3.5 h-3.5 inline" />
                  )}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Reaction Pills below bubble */}
        {reactionsGrouped.length > 0 && (
          <div className={`flex flex-wrap gap-1 mt-1 ${isMine ? 'justify-end' : 'justify-start'}`}>
            {reactionsGrouped.map((item) => (
              <button
                key={item.emoji}
                type="button"
                onClick={() => {
                  haptic('light');
                  onToggleReaction?.(message.id, item.emoji);
                }}
                className={`px-2 py-0.5 rounded-full text-[11px] font-bold flex items-center gap-1 border shadow-2xs transition-transform active:scale-90 ${
                  item.userReacted
                    ? 'bg-[#17402C]/10 text-[#17402C] border-[#17402C]/35 ring-1 ring-[#17402C]/20'
                    : 'bg-white/90 text-[#2B2A24] border-stone-200 hover:bg-stone-100'
                }`}
              >
                <span>{item.emoji}</span>
                {item.count > 1 && <span>{item.count}</span>}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
