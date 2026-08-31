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
  const avatarUrl = conversation.avatar_url || '/images/default-avatar.png';

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
    <div className="flex flex-col h-full bg-white/40 backdrop-blur-2xl border border-white/60 rounded-3xl overflow-hidden shadow-xs relative">
      {/* Top Header */}
      <div className="p-3.5 bg-white/80 backdrop-blur-xl border-b border-stone-200/50 flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="p-1.5 rounded-full hover:bg-stone-100 text-stone-600 md:hidden"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}

          <div className="relative cursor-pointer" onClick={() => isGroup && setShowGroupSettingsModal(true)}>
            <div className="w-10 h-10 rounded-full overflow-hidden relative ring-2 ring-white shadow-xs bg-stone-100">
              <Image
                src={avatarUrl}
                alt={title}
                fill
                className="object-cover"
                sizes="40px"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = '/images/default-avatar.png';
                }}
              />
            </div>
            {!isGroup && (
              <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white" />
            )}
          </div>

          <div
            className="cursor-pointer"
            onClick={() => {
              if (isGroup) {
                haptic('light');
                setShowGroupSettingsModal(true);
              }
            }}
          >
            <h3 className="text-sm font-bold text-stone-900 leading-tight flex items-center gap-1.5">
              <span>{title}</span>
              {isGroup && <Users className="w-3.5 h-3.5 text-stone-400" />}
            </h3>
            <p className="text-[11px] text-emerald-600 font-medium">
              {isGroup ? 'Groupe de Voyage' : 'En ligne'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {isGroup && (
            <button
              type="button"
              onClick={() => {
                haptic('light');
                setShowGroupSettingsModal(true);
              }}
              className="p-2 rounded-full hover:bg-stone-100 text-stone-600 transition-colors"
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
            className="p-2 rounded-full hover:bg-stone-100 text-stone-600 transition-colors"
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
        <div className="p-4 bg-stone-900 text-white border-t border-stone-800 flex flex-col gap-3 animate-slideUp">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0" />
            <div>
              <p className="text-xs font-bold text-white">Demande de message</p>
              <p className="text-[11px] text-stone-400">
                Souhaitez-vous autoriser {conversation.other_member?.full_name || 'ce voyageur'} à échanger avec vous ?
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={handleAcceptRequest}
              className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 flex items-center justify-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              Accepter
            </button>
            <button
              onClick={handleDeclineRequest}
              className="flex-1 py-2 px-3 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5"
            >
              <X className="w-4 h-4" />
              Refuser
            </button>
            <button
              onClick={handleOpenReportBlock}
              className="py-2 px-3 bg-rose-950/60 hover:bg-rose-900 text-rose-300 rounded-xl text-xs font-semibold transition-all"
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
