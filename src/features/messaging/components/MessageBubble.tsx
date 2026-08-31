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

interface MessageBubbleProps {
  message: Message;
  isMine: boolean;
  currentUserId?: string;
  showSenderHeader?: boolean;
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
  const avatarUrl = message.sender_profile?.avatar_url || '/images/default-avatar.png';

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

  return (
    <div
      id={`msg-bubble-${message.id}`}
      className={`group relative flex items-end gap-2.5 my-1.5 transition-all ${
        isMine ? 'flex-row-reverse' : 'flex-row'
      }`}
    >
      {!isMine && (
        <div className="w-8 h-8 rounded-full overflow-hidden relative shrink-0 ring-1 ring-white/80 shadow-xs bg-stone-100 mb-0.5">
          <Image
            src={avatarUrl}
            alt={senderName}
            fill
            className="object-cover"
            sizes="32px"
            onError={(e) => {
              (e.target as HTMLImageElement).src = '/images/default-avatar.png';
            }}
          />
        </div>
      )}

      <div className={`max-w-[78%] sm:max-w-[70%] flex flex-col ${isMine ? 'items-end' : 'items-start'}`}>
        {!isMine && showSenderHeader && (
          <span className="text-[11px] font-semibold text-stone-500 ml-1 mb-1 block">
            {senderName}
          </span>
        )}

        {/* Action Menu overlay */}
        {showActionMenu && (
          <div
            className={`z-30 mb-2 p-1.5 bg-white/95 backdrop-blur-xl border border-stone-200/80 rounded-2xl shadow-lg flex items-center gap-1 animate-scaleIn ${
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
                className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-stone-100 text-base active:scale-125 transition-transform"
              >
                {emoji}
              </button>
            ))}
            <div className="w-px h-5 bg-stone-200 mx-1" />
            <button
              type="button"
              onClick={() => {
                haptic('light');
                onReply?.(message);
                setShowActionMenu(false);
              }}
              className="p-1.5 rounded-full hover:bg-stone-100 text-stone-600 text-xs font-semibold flex items-center gap-1"
              title="Répondre"
            >
              <Reply className="w-4 h-4 text-emerald-700" />
            </button>
          </div>
        )}

        <div className="relative group/bubble flex items-center gap-1">
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
              className="p-1 rounded-full text-stone-400 hover:text-stone-600 hover:bg-stone-100"
              title="Réagir"
            >
              <Smile className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                haptic('light');
                onReply?.(message);
              }}
              className="p-1 rounded-full text-stone-400 hover:text-emerald-700 hover:bg-stone-100"
              title="Répondre"
            >
              <Reply className="w-4 h-4" />
            </button>
          </div>

          <div
            onClick={handleBubbleClick}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            className={`relative px-4 py-3 shadow-xs transition-all select-none cursor-pointer ${
              isMine
                ? 'bg-gradient-to-br from-emerald-600 to-emerald-700 text-white rounded-2xl rounded-tr-xs'
                : 'bg-white/80 backdrop-blur-md text-stone-900 border border-stone-200/60 rounded-2xl rounded-tl-xs'
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
                    ? 'bg-black/15 border-white/80 text-white/90'
                    : 'bg-stone-100 border-emerald-600 text-stone-700'
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
                  isMine ? 'text-emerald-100/90' : 'text-stone-400'
                }`}
              >
                {formatMessageDate(message.created_at)}
              </span>

              {isMine && (
                <span className="text-emerald-100 flex items-center gap-1">
                  {message.status === 'sending' ? (
                    <span className="w-2.5 h-2.5 rounded-full border-2 border-emerald-200 border-t-transparent animate-spin inline-block" />
                  ) : message.status === 'error' ? (
                    <span className="text-rose-200 text-[10px] font-bold">! Échec</span>
                  ) : isReadByRecipient || (readByCount && readByCount > 0) ? (
                    <span
                      className="flex items-center gap-0.5 text-emerald-200 text-[10px] font-semibold"
                      title={
                        readByNames && readByNames.length > 0
                          ? `Lu par : ${readByNames.join(', ')}`
                          : 'Vu'
                      }
                    >
                      <CheckCheck className="w-3.5 h-3.5 inline text-emerald-200" />
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
                    ? 'bg-emerald-100 text-emerald-800 border-emerald-400 ring-1 ring-emerald-400/40'
                    : 'bg-white/90 text-stone-700 border-stone-200 hover:bg-stone-100'
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
