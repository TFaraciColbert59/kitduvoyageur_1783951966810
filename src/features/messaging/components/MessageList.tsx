"use client";

import React, { useRef, useEffect } from 'react';
import type { Message, ConversationMember } from '../types/messaging.types';
import { MessageBubble } from './MessageBubble';
import { TypingIndicator } from './TypingIndicator';

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
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, typingUserNames.length]);

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
    <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
      {loading && messages.length === 0 ? (
        <div className="flex items-center justify-center h-full">
          <div className="w-8 h-8 rounded-full border-3 border-emerald-600 border-t-transparent animate-spin" />
        </div>
      ) : messages.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full text-center p-6">
          <div className="w-16 h-16 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center mb-3">
            💬
          </div>
          <h3 className="text-base font-bold text-stone-800">C&apos;est le début de votre discussion</h3>
          <p className="text-xs text-stone-500 max-w-xs mt-1">
            Envoyez un premier message pour échanger vos conseils de voyage ou planifier votre expédition.
          </p>
        </div>
      ) : (
        messages.map((msg, index) => {
          const isMine = msg.sender_id === currentUserId;
          const prevMsg = messages[index - 1];
          const showSenderHeader = isGroup && (!prevMsg || prevMsg.sender_id !== msg.sender_id);

          // Compute read receipt status
          let isReadByRecipient = false;
          let readByCount = 0;
          const readByNames: string[] = [];

          if (isMine && members.length > 0) {
            const msgTime = new Date(msg.created_at).getTime();
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
      <div ref={bottomRef} />
    </div>
  );
};
