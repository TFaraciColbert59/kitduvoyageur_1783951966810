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
        <div className="h-12 w-56 bg-emerald-600/20 rounded-2xl rounded-tr-xs" />
        <div className="h-8 w-36 bg-emerald-600/15 rounded-2xl" />
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
  const bottomRef = useRef<HTMLDivElement>(null);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const [hasNewUnseenMessages, setHasNewUnseenMessages] = useState(false);
  const prevMessagesCountRef = useRef(messages.length);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    bottomRef.current?.scrollIntoView({ behavior });
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

  // Initial scroll on load
  useEffect(() => {
    if (messages.length > 0) {
      scrollToBottom('auto');
    }
  }, [loading, scrollToBottom]);

  const handleScrollToMessage = (messageId: string) => {
    const el = document.getElementById(`msg-bubble-${messageId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('ring-2', 'ring-emerald-400', 'ring-offset-2', 'rounded-2xl');
      setTimeout(() => {
        el.classList.remove('ring-2', 'ring-emerald-400', 'ring-offset-2', 'rounded-2xl');
      }, 1500);
    }
  };

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-0.5 custom-scrollbar relative"
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
            <MessageBubble
              key={msg.id}
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
            className="pointer-events-auto glass-capsule-btn primary py-2 px-4 text-xs font-bold shadow-lg flex items-center gap-1.5 active:scale-95 animate-bounce min-h-[36px]"
          >
            <ArrowDown className="w-4 h-4" />
            <span>Nouveaux messages</span>
          </button>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
};
