"use client";

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import type { Conversation, UserProfileSummary, Message, ConversationMember } from '../types/messaging.types';
import { useMessages } from '../hooks/useMessages';
import { useRealtimeMessaging } from '../hooks/useRealtimeMessaging';
import { messagingService } from '../services/messagingService';
import { MessageList } from './MessageList';
import { MessageComposer } from './MessageComposer';
import { ConversationOptionsMenuModal } from './ConversationOptionsMenuModal';
import { GroupSettingsModal } from './GroupSettingsModal';
import ReportBlockModal, { ReportTarget } from '@/components/ui/ReportBlockModal';
import { ArrowLeft, MoreVertical, ShieldAlert, Check, X, Users } from 'lucide-react';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';

interface ConversationViewProps {
  conversation: Conversation;
  currentUserId: string;
  currentUserProfile?: UserProfileSummary | null;
  onBack?: () => void;
  onRefreshConversations?: () => void;
}

export const ConversationView: React.FC<ConversationViewProps> = ({
  conversation,
  currentUserId,
  currentUserProfile,
  onBack,
  onRefreshConversations,
}) => {
  const { haptic } = useHapticFeedback();
  const isGroup = conversation.type === 'group';
  const title = conversation.title || (isGroup ? 'Groupe d\'expédition' : 'Voyageur LKDV');
  const avatarUrl = conversation.avatar_url || '/assets/images/no_image.png';

  const [replyToMessage, setReplyToMessage] = useState<Message | null>(null);
  const [showOptionsModal, setShowOptionsModal] = useState(false);
  const [showGroupSettingsModal, setShowGroupSettingsModal] = useState(false);
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);
  const [members, setMembers] = useState<ConversationMember[]>([]);
  const [convStatus, setConvStatus] = useState<'active' | 'pending' | 'rejected'>(
    conversation.status || 'active'
  );

  useEffect(() => {
    let isMounted = true;
    messagingService.getGroupMembers(conversation.id).then((data) => {
      if (isMounted) setMembers(data);
    });
    return () => {
      isMounted = false;
    };
  }, [conversation.id]);

  const { messages, loading, sendMessage, toggleReaction } = useMessages(
    conversation.id,
    currentUserId,
    currentUserProfile
  );

  const { typingUserNames, sendTypingSignal } = useRealtimeMessaging(
    conversation.id,
    currentUserId,
    currentUserProfile?.full_name
  );

  const handleSendMessage = async (content: string) => {
    await sendMessage(content, replyToMessage?.id || undefined);
    setReplyToMessage(null);
  };

  const handleSendAttachment = async (file: File) => {
    const isGpx = file.name.endsWith('.gpx') || file.type.includes('gpx');
    const fileUrl = await messagingService.uploadAttachment(conversation.id, file);
    if (fileUrl) {
      const msgType = isGpx ? 'gpx' : file.type.startsWith('image/') ? 'image' : 'file';
      await messagingService.sendMessage(
        conversation.id,
        currentUserId,
        fileUrl,
        msgType,
        replyToMessage?.id || undefined
      );
      setReplyToMessage(null);
    }
  };

  const handleSendVoiceNote = async (audioBlob: Blob, durationSec: number) => {
    const file = new File([audioBlob], `voicenote_${Date.now()}.webm`, { type: audioBlob.type });
    const fileUrl = await messagingService.uploadAttachment(conversation.id, file);
    if (fileUrl) {
      await messagingService.sendMessage(
        conversation.id,
        currentUserId,
        fileUrl,
        'audio',
        replyToMessage?.id || undefined
      );
      setReplyToMessage(null);
    }
  };

  const handleAcceptRequest = async () => {
    haptic('light');
    setConvStatus('active');
    await messagingService.acceptMessageRequest(conversation.id, currentUserId);
    if (onRefreshConversations) onRefreshConversations();
  };

  const handleDeclineRequest = async () => {
    haptic('light');
    setConvStatus('rejected');
    await messagingService.declineMessageRequest(conversation.id, currentUserId);
    if (onRefreshConversations) onRefreshConversations();
    if (onBack) onBack();
  };

  const handleOpenReportBlock = () => {
    if (conversation.other_member) {
      setReportTarget({
        userId: conversation.other_member.id,
        userName: conversation.other_member.full_name,
      });
    } else {
      setReportTarget({
        userId: conversation.created_by || 'unknown',
        userName: conversation.title || 'Groupe',
        groupId: conversation.id,
        groupName: conversation.title || undefined,
      });
    }
  };

  return (
    <div className="flex flex-col h-full w-full glass rounded-none md:rounded-3xl overflow-hidden relative">
      {/* Top Header avec safe-area iOS */}
      <div className="pt-[calc(env(safe-area-inset-top,0px)+8px)] md:pt-3 p-3 bg-white/90 backdrop-blur-2xl border-b border-stone-200/60 flex items-center justify-between z-10 shrink-0 shadow-2xs">
        <div className="flex items-center gap-2 sm:gap-3 overflow-hidden">
          {onBack && (
            <button
              onClick={() => {
                haptic('light');
                onBack();
              }}
              className="glass-circle-btn w-10 h-10 text-[#17402C] shadow-xs active:scale-95 shrink-0"
              title="Retour aux conversations"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}

          <div className="relative cursor-pointer shrink-0" onClick={() => isGroup && setShowGroupSettingsModal(true)}>
            <div className="w-10 h-10 rounded-full overflow-hidden relative ring-2 ring-white/90 shadow-xs bg-stone-100">
              <Image
                src={avatarUrl}
                alt={title}
                fill
                className="object-cover"
                sizes="40px"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = '/assets/images/no_image.png';
                }}
              />
            </div>
            {!isGroup && (
              <span className="absolute bottom-0 right-0 w-3 h-3 bg-[#5B7F55] rounded-full border-2 border-white shadow-2xs" />
            )}
          </div>

          <div
            className="cursor-pointer overflow-hidden"
            onClick={() => {
              if (isGroup) {
                haptic('light');
                setShowGroupSettingsModal(true);
              }
            }}
          >
            <h3 className="text-sm font-bold text-[#17402C] leading-tight truncate flex items-center gap-1.5">
              <span className="truncate">{title}</span>
              {isGroup && <Users className="w-3.5 h-3.5 text-[#5A574E] shrink-0" />}
            </h3>
            <p className="text-[11px] text-[#486944] font-medium truncate">
              {isGroup ? 'Groupe de Voyage' : 'En ligne'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {isGroup && (
            <button
              type="button"
              onClick={() => {
                haptic('light');
                setShowGroupSettingsModal(true);
              }}
              className="glass-circle-btn w-10 h-10 text-[#17402C] shadow-xs active:scale-95"
              title="Gérer le groupe"
            >
              <Users className="w-5 h-5" />
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              haptic('light');
              setShowOptionsModal(true);
            }}
            className="glass-circle-btn w-10 h-10 text-[#17402C] shadow-xs active:scale-95"
            title="Options de conversation"
          >
            <MoreVertical className="w-5 h-5" />
          </button>
        </div>
      </div>

      <MessageList
        messages={messages}
        currentUserId={currentUserId}
        isGroup={isGroup}
        typingUserNames={typingUserNames}
        loading={loading}
        members={members}
        onReply={(msg) => setReplyToMessage(msg)}
        onToggleReaction={toggleReaction}
      />

      {/* Message Request Action Bar (Pending status) */}
      {convStatus === 'pending' ? (
        <div className="p-4 glass border-t border-white/40 flex flex-col gap-3 animate-slide-up shrink-0 pb-[calc(env(safe-area-inset-bottom,0px)+12px)]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-[#C89A3B]/15 text-[#C89A3B] flex items-center justify-center shrink-0">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-[#17402C]">Demande de message</p>
              <p className="text-[11px] text-[#5A7064]">
                Souhaitez-vous autoriser {conversation.other_member?.full_name || 'ce voyageur'} à échanger avec vous ?
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={handleAcceptRequest}
              className="flex-1 glass-capsule-btn primary text-xs font-bold min-h-[44px] flex items-center justify-center gap-1.5 active:scale-95"
            >
              <Check className="w-4 h-4" />
              Accepter
            </button>
            <button
              onClick={handleDeclineRequest}
              className="flex-1 glass-capsule-btn text-xs font-semibold min-h-[44px] flex items-center justify-center gap-1.5 active:scale-95"
            >
              <X className="w-4 h-4" />
              Refuser
            </button>
            <button
              onClick={handleOpenReportBlock}
              className="glass-capsule-btn px-4 text-xs font-semibold min-h-[44px] flex items-center justify-center gap-1.5 active:scale-95"
              style={{ background: 'color-mix(in oklab, var(--danger) 14%, transparent)', color: 'var(--danger)', borderColor: 'color-mix(in oklab, var(--danger) 35%, transparent)' }}
            >
              Bloquer
            </button>
          </div>
        </div>
      ) : (
        <MessageComposer
          onSendMessage={handleSendMessage}
          onSendAttachment={handleSendAttachment}
          onSendVoiceNote={handleSendVoiceNote}
          onTyping={sendTypingSignal}
          replyToMessage={replyToMessage}
          onCancelReply={() => setReplyToMessage(null)}
        />
      )}

      {/* Group Settings Modal */}
      {isGroup && (
        <GroupSettingsModal
          isOpen={showGroupSettingsModal}
          onClose={() => setShowGroupSettingsModal(false)}
          conversation={conversation}
          currentUserId={currentUserId}
          onRefreshConversations={onRefreshConversations}
          onLeaveSuccess={() => {
            if (onBack) onBack();
          }}
        />
      )}

      {/* Conversation Options Modal */}
      <ConversationOptionsMenuModal
        isOpen={showOptionsModal}
        onClose={() => setShowOptionsModal(false)}
        conversation={conversation}
        currentUserId={currentUserId}
        onOpenReportBlock={handleOpenReportBlock}
        onRefreshConversations={onRefreshConversations}
      />

      {/* Report & Block Modal */}
      <ReportBlockModal
        target={reportTarget}
        onClose={() => setReportTarget(null)}
        onSuccess={() => {
          setReportTarget(null);
          if (onRefreshConversations) onRefreshConversations();
          if (onBack) onBack();
        }}
      />
    </div>
  );
};
