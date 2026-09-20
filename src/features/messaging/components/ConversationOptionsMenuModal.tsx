'use client';

import Icon from '@/components/ui/Icon';
import React, { useState } from 'react';
import { Button, ListItem } from '@/components/ui';
import type { Conversation } from '../types/messaging.types';
import { messagingService } from '../services/messagingService';
import { MobileSheet } from './MobileSheet';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';

interface ConversationOptionsMenuModalProps {
  isOpen: boolean;
  onClose: () => void;
  conversation: Conversation;
  currentUserId: string;
  onOpenReportBlock: () => void;
  onRefreshConversations?: () => void;
}

export const ConversationOptionsMenuModal: React.FC<ConversationOptionsMenuModalProps> = ({
  isOpen,
  onClose,
  conversation,
  currentUserId,
  onOpenReportBlock,
  onRefreshConversations,
}) => {
  const { haptic } = useHapticFeedback();
  const [loading, setLoading] = useState(false);
  const [showMuteSubmenu, setShowMuteSubmenu] = useState(false);

  const isMuted = conversation.is_muted;
  const isArchived = conversation.is_archived;

  const handleMuteToggle = async (durationHours?: number) => {
    haptic('light');
    setLoading(true);

    let muteUntil: string | null = null;
    let shouldMute = true;

    if (durationHours === 0) {
      // Unmute
      shouldMute = false;
    } else if (durationHours) {
      muteUntil = new Date(Date.now() + durationHours * 3600 * 1000).toISOString();
    }

    await messagingService.updateMemberPreferences(conversation.id, currentUserId, {
      is_muted: shouldMute,
      mute_until: muteUntil,
    });

    setLoading(false);
    setShowMuteSubmenu(false);
    if (onRefreshConversations) onRefreshConversations();
    onClose();
  };

  const handleArchiveToggle = async () => {
    haptic('light');
    setLoading(true);

    await messagingService.updateMemberPreferences(conversation.id, currentUserId, {
      is_archived: !isArchived,
    });

    setLoading(false);
    if (onRefreshConversations) onRefreshConversations();
    onClose();
  };

  return (
    <MobileSheet isOpen={isOpen} onClose={onClose} title="Options de conversation">
      {showMuteSubmenu ? (
        <div className="animate-fade-in space-y-[var(--space-2)]">
          <h4 className="mb-[var(--space-2)] text-[length:var(--lkv-text-caption)] font-bold uppercase tracking-wider text-[color:var(--lkv-text-secondary)]">
            Masquer les notifications
          </h4>
          <ListItem
            as="div"
            disabled={loading}
            onClick={() => handleMuteToggle(1)}
            title="Pendant 1 heure"
            className="min-h-[52px]"
          />
          <ListItem
            as="div"
            disabled={loading}
            onClick={() => handleMuteToggle(8)}
            title="Pendant 8 heures"
            className="min-h-[52px]"
          />
          <ListItem
            as="div"
            disabled={loading}
            onClick={() => handleMuteToggle(undefined)}
            title="Jusqu'à réactivation (Toujours)"
            className="min-h-[52px]"
          />
          <Button type="button" variant="ghost" fullWidth onClick={() => setShowMuteSubmenu(false)}>
            Retour
          </Button>
        </div>
      ) : (
        <div className="space-y-[var(--space-2)]">
          {/* Mute Button */}
          <ListItem
            as="div"
            disabled={loading}
            onClick={() => {
              if (isMuted) {
                handleMuteToggle(0);
              } else {
                setShowMuteSubmenu(true);
              }
            }}
            className="min-h-[52px]"
            leading={
              isMuted ? (
                <Icon name="bell" className="size-4 text-[color:var(--lkv-secondary)]" aria-hidden="true" />
              ) : (
                <Icon name="bell-off" className="size-4 text-[color:var(--lkv-text-secondary)]" aria-hidden="true" />
              )
            }
            title={
              isMuted ? 'Réactiver les notifications' : 'Masquer les notifications (Mute)'
            }
            trailing={
              isMuted ? (
                <Icon name="check" className="size-4 text-[color:var(--lkv-secondary)]" aria-hidden="true" />
              ) : undefined
            }
          />

          {/* Archive Button */}
          <ListItem
            as="div"
            disabled={loading}
            onClick={handleArchiveToggle}
            className="min-h-[52px]"
            leading={<Icon name="archive" className="size-4 text-[color:var(--lkv-text-secondary)]" aria-hidden="true" />}
            title={isArchived ? 'Désarchiver la conversation' : 'Archiver la conversation'}
            trailing={
              isArchived ? (
                <Icon name="check" className="size-4 text-[color:var(--lkv-secondary)]" aria-hidden="true" />
              ) : undefined
            }
          />

          {/* Report & Block Button */}
          {conversation.other_member && (
            <ListItem
              as="div"
              onClick={() => {
                onClose();
                onOpenReportBlock();
              }}
              className="mt-[var(--space-2)] min-h-[52px] text-[color:var(--lkv-danger-dark)]"
              leading={<Icon name="shield-alert" className="size-4 text-[color:var(--lkv-danger)]" aria-hidden="true" />}
              title={
                <span className="text-[color:var(--lkv-danger-dark)]">
                  Signaler ou Bloquer {conversation.other_member.full_name}
                </span>
              }
            />
          )}
        </div>
      )}
    </MobileSheet>
  );
};
