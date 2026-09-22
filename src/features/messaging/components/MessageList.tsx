'use client';

import Icon from '@/components/ui/Icon';
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Button, EmptyState, Skeleton } from '@/components/ui';
import type { Message, ConversationMember } from '../types/messaging.types';
import { MessageBubble, type BubbleGroupPosition } from './MessageBubble';
import { TypingIndicator } from './TypingIndicator';
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
  onForward?: (message: Message) => void;
}

export const MessageListSkeleton = () => (
  <div
    className="flex-1 space-y-[var(--space-4)] overflow-hidden p-[var(--space-4)]"
    aria-busy="true"
    aria-label="Chargement des messages"
  >
    <div className="flex items-end gap-[var(--space-2)]">
      <Skeleton className="size-8 shrink-0 rounded-full" />
      <div className="max-w-[65%] space-y-[var(--space-1)]">
        <Skeleton className="h-10 w-48 rounded-[var(--lkv-radius-md)]" />
        <Skeleton className="h-7 w-32 rounded-[var(--lkv-radius-md)]" />
      </div>
    </div>
    <div className="flex items-end justify-end gap-[var(--space-2)]">
      <div className="flex max-w-[65%] flex-col items-end space-y-[var(--space-1)]">
        <Skeleton className="h-12 w-56 rounded-[var(--lkv-radius-md)]" />
        <Skeleton className="h-8 w-36 rounded-[var(--lkv-radius-md)]" />
      </div>
    </div>
    <div className="flex items-end gap-[var(--space-2)]">
      <Skeleton className="size-8 shrink-0 rounded-full" />
      <div className="max-w-[65%] space-y-[var(--space-1)]">
        <Skeleton className="h-14 w-60 rounded-[var(--lkv-radius-md)]" />
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
  onForward,
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
      el.classList.add('ring-2', 'ring-[color:var(--lkv-secondary)]', 'ring-offset-2', 'rounded-[var(--lkv-radius-md)]');
      setTimeout(() => {
        el.classList.remove('ring-2', 'ring-[color:var(--lkv-secondary)]', 'ring-offset-2', 'rounded-[var(--lkv-radius-md)]');
      }, 1500);
    }
  };

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      aria-label="Fil de discussion"
      className="custom-scrollbar relative flex-1 space-y-0.5 overflow-y-auto overscroll-contain p-[var(--space-3)] [-webkit-overflow-scrolling:touch] sm:p-[var(--space-4)]"
    >
      {loading && messages.length === 0 ? (
        <MessageListSkeleton />
      ) : messages.length === 0 ? (
        <EmptyState
          className="h-full"
          icon={
            <span className="flex size-16 items-center justify-center rounded-full bg-[color:var(--btn-tint)] border border-[color:var(--btn-glass-border)] backdrop-blur-[var(--btn-blur)] saturate-[var(--btn-saturate)] lkv-rim-btn text-2xl text-[color:var(--lkv-primary)]">
              💬
            </span>
          }
          title="C'est le début de votre discussion"
          description="Envoyez un premier message pour échanger vos conseils de voyage ou planifier votre expédition."
        />
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
                <div className="my-[var(--space-4)] flex justify-center" role="separator">
                  <span className="rounded-full border border-[color:var(--glass-border)] bg-[color:var(--card-tint-strong)] px-[var(--space-3)] py-[var(--space-1)] text-[length:var(--lkv-text-caption-2)] font-semibold uppercase tracking-[0.1em] text-[color:var(--lkv-text-secondary)] backdrop-blur-[var(--blur-md)]">
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
                onForward={onForward}
              />
            </React.Fragment>
          );
        })
      )}

      <TypingIndicator userNames={typingUserNames} />

      {/* Floating "Nouveaux messages ↓" pill */}
      {hasNewUnseenMessages && !isNearBottom && (
        <div className="pointer-events-none sticky inset-x-0 bottom-3 z-[var(--z-sticky)] flex justify-center">
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={() => {
              haptic('light');
              scrollToBottom('smooth');
              setHasNewUnseenMessages(false);
            }}
            className="msg-pill-in pointer-events-auto shadow-elevation-3"
            icon={<Icon name="arrow-down" className="size-4" aria-hidden="true" />}
          >
            Nouveaux messages
          </Button>
        </div>
      )}
    </div>
  );
};
