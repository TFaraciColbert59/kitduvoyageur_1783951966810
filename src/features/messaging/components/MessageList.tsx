"use client";

import React, { useRef, useEffect, useState, useCallback } from 'react';
import type { Message, ConversationMember } from '../types/messaging.types';
import { MessageBubble, type BubbleGroupPosition } from './MessageBubble';
import { TypingIndicator } from './TypingIndicator';
import { ArrowDown } from 'lucide-react';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';

interface MessageListProps {
  messages: Message[];
  currentUserId: string;
  isGroup: boolean;
  typingUserNames: string[];
  loading: boolean;
  members?: ConversationMember[];
  onReply?: (message: Message) => void;
  onToggleReaction?: (messageId: string, reactionValue: string) => void;
}

export const MessageListSkeleton = () => (
  <div className="flex-1 p-4 space-y-4 animate-pulse overflow-hidden" aria-busy="true" aria-label="Chargement des messages">
    <div className="flex items-end gap-2.5">
      <div className="w-8 h-8 rounded-full bg-stone-200/70 shrink-0" />
      <div className="space-y-1.5 max-w-[65%]">
        <div className="h-10 w-48 bg-stone-200/70 rounded-2xl rounded-tl-xs" />
        <div className="h-7 w-32 bg-stone-200/60 rounded-2xl" />
      </div>
    </div>
    <div className="flex items-end gap-2.5 justify-end">
      <div className="space-y-1.5 max-w-[65%] flex flex-col items-end">
        <div className="h-12 w-56 bg-[#5B7F55]/20 rounded-2xl rounded-tr-xs" />
        <div className="h-8 w-36 bg-[#5B7F55]/15 rounded-2xl" />
      </div>
    </div>
    <div className="flex items-end gap-2.5">
      <div className="w-8 h-8 rounded-full bg-stone-200/70 shrink-0" />
      <div className="space-y-1.5 max-w-[65%]">
        <div className="h-14 w-60 bg-stone-200/70 rounded-2xl rounded-tl-xs" />
      </div>
    </div>
  </div>
);

const dayKey = (iso: string) => new Date(iso).toDateString();

const dayLabel = (iso: string) => {
  const d = new Date(iso);
  const now = new Date();
  const y = new Date(now);
  y.setDate(now.getDate() - 1);
  if (d.toDateString() === now.toDateString()) return "Aujourd'hui";
  if (d.toDateString() === y.toDateString()) return 'Hier';
  return d.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: d.getFullYear() === now.getFullYear() ? undefined : 'numeric',
  });
};

export const MessageList: React.FC<MessageListProps> = ({
  messages,
  currentUserId,
  isGroup,
  typingUserNames,
  loading,
  members = [],
  onReply,
  onToggleReaction,
}) => {
  const { haptic } = useHapticFeedback();
  const containerRef = useRef<HTMLDivElement>(null);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const [hasNewUnseenMessages, setHasNewUnseenMessages] = useState(false);
  const prevMessagesCountRef = useRef(messages.length);
  const didInitialScroll = useRef(false);

  // Scroll sur le conteneur : scrollIntoView sur iOS remonte l'ancêtre
  // scrollable et faisait sauter toute la page (cf. audit 1.2/2.7).
  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    const el = containerRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
  }, []);

  const handleScroll = () => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    const distanceToBottom = scrollHeight - (scrollTop + clientHeight);
    const nearBottom = distanceToBottom < 120;
    setIsNearBottom(nearBottom);
    if (nearBottom) {
      setHasNewUnseenMessages(false);
    }
  };

  useEffect(() => {
    if (messages.length > prevMessagesCountRef.current) {
      const lastMsg = messages[messages.length - 1];
      const isSentByMe = lastMsg?.sender_id === currentUserId;

      if (isNearBottom || isSentByMe) {
        scrollToBottom('smooth');
        setHasNewUnseenMessages(false);
      } else {
        setHasNewUnseenMessages(true);
      }
    }
    prevMessagesCountRef.current = messages.length;
  }, [messages, currentUserId, isNearBottom, scrollToBottom]);

  useEffect(() => {
    if (typingUserNames.length > 0 && isNearBottom) {
      scrollToBottom('smooth');
    }
  }, [typingUserNames.length, isNearBottom, scrollToBottom]);

  // Ancre le fond dès que le contenu est peint (évite l'atterrissage en plein
  // historique sur réseau lent), sans animation au premier rendu. Le
  // `key={conversation.id}` posé sur <MessageList> par ConversationView
  // réinitialise ce ref à chaque changement de conversation.
  useEffect(() => {
    if (loading || messages.length === 0 || didInitialScroll.current) return;
    requestAnimationFrame(() => scrollToBottom('auto'));
    didInitialScroll.current = true;
  }, [loading, messages.length, scrollToBottom]);

  const handleScrollToMessage = (messageId: string) => {
    const el = document.getElementById(`msg-bubble-${messageId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('ring-2', 'ring-[#5B7F55]', 'ring-offset-2', 'rounded-2xl');
      setTimeout(() => {
        el.classList.remove('ring-2', 'ring-[#5B7F55]', 'ring-offset-2', 'rounded-2xl');
      }, 1500);
    }
  };

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      aria-label="Fil de discussion"
      className="flex-1 overflow-y-auto overscroll-contain p-3 sm:p-4 space-y-0.5 custom-scrollbar relative"
      style={{ WebkitOverflowScrolling: 'touch' }}
    >
      {loading && messages.length === 0 ? (
        <MessageListSkeleton />
      ) : messages.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full text-center p-6">
          <div className="w-16 h-16 rounded-full bg-[#17402C]/10 text-[#17402C] flex items-center justify-center mb-3 text-2xl">
            💬
          </div>
          <h3 className="text-base font-bold text-[#17402C]">C&apos;est le début de votre discussion</h3>
          <p className="text-xs text-[#5A574E] max-w-xs mt-1">
            Envoyez un premier message pour échanger vos conseils de voyage ou planifier votre expédition.
          </p>
        </div>
      ) : (
        messages.map((msg, index) => {
          const isMine = msg.sender_id === currentUserId;
          const prevMsg = messages[index - 1];
          const nextMsg = messages[index + 1];

          // Compute 2-minute grouping logic
          const msgTime = new Date(msg.created_at).getTime();
          const isSameSenderAsPrev =
            !!prevMsg &&
            prevMsg.sender_id === msg.sender_id &&
            Math.abs(msgTime - new Date(prevMsg.created_at).getTime()) < 120000;

          const isSameSenderAsNext =
            !!nextMsg &&
            nextMsg.sender_id === msg.sender_id &&
            Math.abs(new Date(nextMsg.created_at).getTime() - msgTime) < 120000;

          let groupPosition: BubbleGroupPosition = 'single';
          if (isSameSenderAsPrev && isSameSenderAsNext) {
            groupPosition = 'middle';
          } else if (!isSameSenderAsPrev && isSameSenderAsNext) {
            groupPosition = 'first';
          } else if (isSameSenderAsPrev && !isSameSenderAsNext) {
            groupPosition = 'last';
          } else {
            groupPosition = 'single';
          }

          const showSenderHeader = isGroup && !isSameSenderAsPrev;
          const showDaySeparator =
            !prevMsg || dayKey(prevMsg.created_at) !== dayKey(msg.created_at);

          // Compute read receipt status
          let isReadByRecipient = false;
          let readByCount = 0;
          const readByNames: string[] = [];

          if (isMine && members.length > 0) {
            const otherMembers = members.filter((m) => m.user_id !== currentUserId);

            otherMembers.forEach((m) => {
              const lastReadTime = m.last_read_at ? new Date(m.last_read_at).getTime() : 0;
              if (lastReadTime >= msgTime - 1000) {
                readByCount += 1;
                if (m.profile?.full_name) {
                  readByNames.push(m.profile.full_name);
                }
              }
            });

            if (!isGroup && otherMembers.length > 0) {
              isReadByRecipient = readByCount > 0;
            }
          }

          return (
            <React.Fragment key={msg.id}>
              {showDaySeparator && (
                <div className="flex justify-center my-4" role="separator">
                  <span className="px-3 py-1 rounded-full bg-white/70 backdrop-blur-md border border-white/60 text-[11px] font-semibold text-[#5A574E] uppercase tracking-[0.1em]">
                    {dayLabel(msg.created_at)}
                  </span>
                </div>
              )}
              <MessageBubble
                message={msg}
                isMine={isMine}
                currentUserId={currentUserId}
                showSenderHeader={showSenderHeader}
                groupPosition={groupPosition}
                isReadByRecipient={isReadByRecipient}
                readByCount={readByCount}
                readByNames={readByNames}
                onReply={onReply}
                onToggleReaction={onToggleReaction}
                onScrollToMessage={handleScrollToMessage}
              />
            </React.Fragment>
          );
        })
      )}

      <TypingIndicator userNames={typingUserNames} />

      {/* Floating "Nouveaux messages ↓" pill */}
      {hasNewUnseenMessages && !isNearBottom && (
        <div className="sticky bottom-3 inset-x-0 flex justify-center z-20 pointer-events-none">
          <button
            type="button"
            onClick={() => {
              haptic('light');
              scrollToBottom('smooth');
              setHasNewUnseenMessages(false);
            }}
            className="pointer-events-auto glass-capsule-btn primary py-2 px-4 text-[13px] font-bold shadow-lg flex items-center gap-1.5 active:scale-95 min-h-[44px] msg-pill-in"
          >
            <ArrowDown className="w-4 h-4" />
            <span>Nouveaux messages</span>
          </button>
        </div>
      )}
    </div>
  );
};