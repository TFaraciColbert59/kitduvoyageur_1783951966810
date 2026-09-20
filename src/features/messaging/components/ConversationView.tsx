'use client';

import Icon from '@/components/ui/Icon';
import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Button, HeaderBackButton, IconButton, PageHeader } from '@/components/ui';
import type {
  Conversation,
  UserProfileSummary,
  Message,
  ConversationMember,
  ProductMessageMeta,
  TrailMessageMeta,
  KitMessageMeta,
} from '../types/messaging.types';
import { useMessages } from '../hooks/useMessages';
import { useRealtimeMessaging } from '../hooks/useRealtimeMessaging';
import { messagingService } from '../services/messagingService';
import { MessageList } from './MessageList';
import { MessageComposer } from './MessageComposer';
import { ForwardMessageSheet } from './ForwardMessageSheet';
import { ConversationOptionsMenuModal } from './ConversationOptionsMenuModal';
import { GroupSettingsModal } from './GroupSettingsModal';
import ReportBlockModal, { ReportTarget } from '@/components/ui/ReportBlockModal';
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
  const router = useRouter();
  const isGroup = conversation.type === 'group';
  const title = conversation.title || (isGroup ? "Groupe d'expédition" : 'Voyageur LKDV');
  const avatarUrl = conversation.avatar_url || '/assets/images/no_image.png';
  // Convention app : photo de profil / nom -> fiche profil (/profil/<id>).
  const otherProfileId = conversation.other_member?.id || null;

  const [replyToMessage, setReplyToMessage] = useState<Message | null>(null);
  const [forwardMessage, setForwardMessage] = useState<Message | null>(null);
  const [showOptionsModal, setShowOptionsModal] = useState(false);
  const [showGroupSettingsModal, setShowGroupSettingsModal] = useState(false);
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);
  const [members, setMembers] = useState<ConversationMember[]>([]);
  const [convStatus, setConvStatus] = useState<'active' | 'pending' | 'rejected'>(
    conversation.status || 'active'
  );

  const openHeaderTarget = () => {
    if (isGroup) {
      haptic('light');
      setShowGroupSettingsModal(true);
    } else if (otherProfileId) {
      haptic('light');
      router.push(`/profil/${otherProfileId}`);
    }
  };

  useEffect(() => {
    let isMounted = true;
    messagingService.getGroupMembers(conversation.id).then((data) => {
      if (isMounted) setMembers(data);
    });
    return () => {
      isMounted = false;
    };
  }, [conversation.id]);

  const { messages, loading, sendMessage, toggleReaction, refreshMessages } = useMessages(
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
      // Les envois directs ne passent pas par le canal optimiste du hook :
      // sans refresh, le message n'apparait jamais (surtout en demo).
      await refreshMessages();
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
      await refreshMessages();
    }
  };

  const handleSendGpx = async (file: File) => {
    const fileUrl = await messagingService.uploadAttachment(conversation.id, file);
    if (fileUrl) {
      await messagingService.sendMessage(
        conversation.id,
        currentUserId,
        fileUrl,
        'gpx',
        replyToMessage?.id || undefined
      );
      setReplyToMessage(null);
      await refreshMessages();
    }
  };

  const handleSendProduct = async (meta: ProductMessageMeta) => {
    await messagingService.sendMessage(
      conversation.id,
      currentUserId,
      meta.name,
      'product',
      replyToMessage?.id || undefined,
      meta as unknown as Record<string, unknown>
    );
    setReplyToMessage(null);
    await refreshMessages();
  };

  const handleSendTrail = async (meta: TrailMessageMeta) => {
    await messagingService.sendMessage(
      conversation.id,
      currentUserId,
      meta.name,
      'trail',
      replyToMessage?.id || undefined,
      meta as unknown as Record<string, unknown>
    );
    setReplyToMessage(null);
    await refreshMessages();
  };

  const handleSendKit = async (meta: KitMessageMeta) => {
    await messagingService.sendMessage(
      conversation.id,
      currentUserId,
      meta.kit_name,
      'kit',
      replyToMessage?.id || undefined,
      meta as unknown as Record<string, unknown>
    );
    setReplyToMessage(null);
    await refreshMessages();
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

  const headerTargetLabel = isGroup ? 'Gérer le groupe' : `Voir le profil de ${title}`;

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden rounded-none bg-[color:var(--lkv-surface-card)] md:rounded-[var(--lkv-radius-lg)]">
      {/* Top Header avec safe-area iOS */}
      <PageHeader
        className="z-10 shrink-0 border-b border-[color:var(--lkv-border)] bg-[color:var(--lkv-surface)]/90 px-[var(--space-3)] pb-[var(--space-3)] pt-[calc(var(--safe-top)+8px)] shadow-elevation-1 backdrop-blur-[var(--blur-lg)] md:pt-[var(--space-3)]"
        back={
          <div className="flex items-center gap-[var(--space-2)]">
            {onBack && (
              <HeaderBackButton
                label="Retour aux conversations"
                title="Retour aux conversations"
                onClick={(event) => {
                  event.preventDefault();
                  haptic('light');
                  onBack();
                }}
              />
            )}
            <IconButton
              type="button"
              variant="ghost"
              onClick={openHeaderTarget}
              title={headerTargetLabel}
              aria-label={headerTargetLabel}
              className={`relative size-10 shrink-0 overflow-hidden p-0 ring-2 ring-[color:var(--glass-border)] shadow-elevation-1 ${
                isGroup || otherProfileId ? 'cursor-pointer' : 'cursor-default'
              }`}
            >
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
            </IconButton>
          </div>
        }
        title={
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={openHeaderTarget}
            className="max-w-full gap-[var(--space-1)] px-0 text-left"
            title={headerTargetLabel}
          >
            <span className="truncate">{title}</span>
            {isGroup && <Icon name="users" className="size-3.5 shrink-0 text-[color:var(--lkv-text-secondary)]" aria-hidden="true" />}
          </Button>
        }
        subtitle={isGroup ? 'Groupe de Voyage' : 'Membre LKDV'}
        actions={
          <>
            {isGroup && (
              <IconButton
                type="button"
                variant="glass"
                onClick={() => {
                  haptic('light');
                  setShowGroupSettingsModal(true);
                }}
                aria-label="Gérer le groupe"
                title="Gérer le groupe"
                className="shadow-elevation-1"
              >
                <Icon name="users" className="size-5" aria-hidden="true" />
              </IconButton>
            )}

            <IconButton
              type="button"
              variant="glass"
              onClick={() => {
                haptic('light');
                setShowOptionsModal(true);
              }}
              aria-label="Options de conversation"
              title="Options de conversation"
              className="shadow-elevation-1"
            >
              <Icon name="more-vertical" className="size-5" aria-hidden="true" />
            </IconButton>
          </>
        }
      />

      <MessageList
        key={conversation.id}
        messages={messages}
        currentUserId={currentUserId}
        isGroup={isGroup}
        typingUserNames={typingUserNames}
        loading={loading}
        members={members}
        onReply={(msg) => setReplyToMessage(msg)}
        onToggleReaction={toggleReaction}
        onForward={setForwardMessage}
      />

      {/* Message Request Action Bar (Pending status) */}
      {convStatus === 'pending' ? (
        <div className="animate-slide-up flex shrink-0 flex-col gap-[var(--space-3)] border-t border-[color:var(--lkv-border)] bg-[color:var(--lkv-surface)]/95 px-[var(--space-4)] pb-[calc(var(--safe-bottom)+var(--space-3))] pt-[var(--space-4)] backdrop-blur-[var(--blur-lg)]">
          <div className="flex items-center gap-[var(--space-2)]">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[color:var(--lkv-warning)]/15 text-[color:var(--lkv-warning)]">
              <Icon name="shield-alert" className="size-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-[length:var(--lkv-text-caption)] font-bold text-[color:var(--lkv-text-primary)]">
                Demande de message
              </p>
              <p className="text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-muted)]">
                Souhaitez-vous autoriser {conversation.other_member?.full_name || 'ce voyageur'} à
                échanger avec vous ?
              </p>
            </div>
          </div>

          {/* Sous 360px les trois actions ne tiennent pas sur une ligne :
              flex-wrap laisse « Bloquer » passer à la ligne suivante. */}
          <div className="flex flex-wrap items-center gap-[var(--space-2)] pt-[var(--space-1)]">
            <Button
              type="button"
              variant="primary"
              onClick={handleAcceptRequest}
              className="flex-1"
              icon={<Icon name="check" className="size-4" aria-hidden="true" />}
            >
              Accepter
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={handleDeclineRequest}
              className="flex-1"
              icon={<Icon name="x" className="size-4" aria-hidden="true" />}
            >
              Refuser
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={handleOpenReportBlock}
              className="border border-[color:var(--lkv-danger)]/35 text-[color:var(--lkv-danger)] hover:bg-[color:var(--lkv-danger-bg)]"
            >
              Bloquer
            </Button>
          </div>
        </div>
      ) : (
        <MessageComposer
          currentUserId={currentUserId}
          onSendMessage={handleSendMessage}
          onSendAttachment={handleSendAttachment}
          onSendVoiceNote={handleSendVoiceNote}
          onSendGpx={handleSendGpx}
          onSendProduct={handleSendProduct}
          onSendTrail={handleSendTrail}
          onSendKit={handleSendKit}
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

      {/* Transfert de message — ce sheet passe au-dessus du calque conversation
          (MobileSheet au-dessus du calque conversation). */}
      <ForwardMessageSheet
        isOpen={forwardMessage !== null}
        onClose={() => setForwardMessage(null)}
        message={forwardMessage}
        currentUserId={currentUserId}
        onForwarded={onRefreshConversations}
      />
    </div>
  );
};
