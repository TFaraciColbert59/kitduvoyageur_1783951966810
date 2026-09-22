'use client';

import Icon from '@/components/ui/Icon';
import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { Button, ListItem } from '@/components/ui';
import type { Conversation } from '../types/messaging.types';
import { messagingService } from '../services/messagingService';
import { MobileSheet } from './MobileSheet';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';

interface ConversationOptionsSheetProps {
  isOpen: boolean;
  onClose: () => void;
  conversation: Conversation | null;
  currentUserId: string;
  onRefreshConversations?: () => void;
  onReport?: (conversation: Conversation) => void;
}

/**
 * ConversationOptionsSheet — menu d'options ouvert par appui long sur une
 * conversation de la liste. Sur une demande en attente : accepter / refuser /
 * bloquer. Sur une conversation active : archiver, muter, signaler/bloquer.
 */
export const ConversationOptionsSheet: React.FC<ConversationOptionsSheetProps> = ({
  isOpen,
  onClose,
  conversation,
  currentUserId,
  onRefreshConversations,
  onReport,
}) => {
  const { haptic } = useHapticFeedback();
  const [loading, setLoading] = useState(false);
  const [showMuteSubmenu, setShowMuteSubmenu] = useState(false);

  // Réinitialise le sous-menu quand la conversation cible change.
  useEffect(() => {
    setShowMuteSubmenu(false);
  }, [conversation?.id]);

  if (!conversation) return null;

  const isPending = conversation.status === 'pending';
  const isMuted = conversation.is_muted;
  const isArchived = conversation.is_archived;
  const member = conversation.other_member;

  const closeAndRefresh = () => {
    onRefreshConversations?.();
    onClose();
  };

  const handleAccept = async () => {
    haptic('light');
    setLoading(true);
    await messagingService.acceptMessageRequest(conversation.id, currentUserId);
    setLoading(false);
    closeAndRefresh();
  };

  const handleDecline = async () => {
    haptic('light');
    setLoading(true);
    await messagingService.declineMessageRequest(conversation.id, currentUserId);
    setLoading(false);
    closeAndRefresh();
  };

  const handleMuteToggle = async (durationHours?: number) => {
    haptic('light');
    setLoading(true);

    let muteUntil: string | null = null;
    let shouldMute = true;

    if (durationHours === 0) {
      shouldMute = false; // unmute
    } else if (durationHours) {
      muteUntil = new Date(Date.now() + durationHours * 3600 * 1000).toISOString();
    }

    await messagingService.updateMemberPreferences(conversation.id, currentUserId, {
      is_muted: shouldMute,
      mute_until: muteUntil,
    });

    setLoading(false);
    setShowMuteSubmenu(false);
    closeAndRefresh();
  };

  const handleArchiveToggle = async () => {
    haptic('light');
    setLoading(true);
    await messagingService.updateMemberPreferences(conversation.id, currentUserId, {
      is_archived: !isArchived,
    });
    setLoading(false);
    closeAndRefresh();
  };

  return (
    <MobileSheet
      isOpen={isOpen}
      onClose={onClose}
      title={isPending ? 'Demande de message' : 'Options de conversation'}
    >
      {member && (
        <div className="mb-[var(--space-4)] flex items-center gap-[var(--space-3)] pt-[var(--space-1)]">
          <div className="relative size-12 shrink-0 overflow-hidden rounded-full bg-[color:var(--btn-tint)] shadow-elevation-1 ring-2 ring-[color:var(--glass-border)]">
            <Image
              src={member.avatar_url || '/assets/images/no_image.png'}
              alt=""
              fill
              className="object-cover"
              sizes="48px"
              onError={(e) => {
                (e.target as HTMLImageElement).src = '/assets/images/no_image.png';
              }}
            />
          </div>
          <div className="min-w-0">
            <p className="truncate text-[length:var(--lkv-text-subheadline)] font-bold text-[color:var(--lkv-text-primary)]">
              {member.full_name || 'Voyageur LKDV'}
            </p>
            <p className="truncate text-[length:var(--lkv-text-footnote)] text-[color:var(--lkv-text-secondary)]">
              {isPending ? 'Souhaite vous écrire' : 'Conversation directe'}
            </p>
          </div>
        </div>
      )}

      {isPending ? (
        <div className="space-y-[var(--space-2)]">
          <ListItem
            as="div"
            disabled={loading}
            onClick={handleAccept}
            className="min-h-[52px] border border-[color:var(--lkv-secondary)]/40 bg-[color:var(--lkv-secondary)]/10"
            leading={<Icon name="check" className="size-5 text-[color:var(--lkv-forest-700)]" aria-hidden="true" />}
            title="Accepter la demande"
          />
          <ListItem
            as="div"
            disabled={loading}
            onClick={handleDecline}
            className="min-h-[52px]"
            leading={<Icon name="x" className="size-5 text-[color:var(--lkv-danger-dark)]" aria-hidden="true" />}
            title="Refuser la demande"
          />
          {onReport && (
            <ListItem
              as="div"
              onClick={() => {
                onReport(conversation);
                onClose();
              }}
              className="min-h-[52px] border border-[color:var(--lkv-danger)]/30 bg-[color:var(--lkv-danger-bg)]"
              leading={<Icon name="shield-alert" className="size-5 text-[color:var(--lkv-danger-dark)]" aria-hidden="true" />}
              title={<span className="text-[color:var(--lkv-danger-dark)]">Signaler ou bloquer</span>}
            />
          )}
        </div>
      ) : showMuteSubmenu ? (
        <div className="space-y-[var(--space-2)]">
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
                <Icon name="bell" className="size-5 text-[color:var(--lkv-secondary)]" aria-hidden="true" />
              ) : (
                <Icon name="bell-off" className="size-5 text-[color:var(--lkv-text-secondary)]" aria-hidden="true" />
              )
            }
            title={isMuted ? 'Réactiver les notifications' : 'Masquer les notifications'}
            trailing={
              isMuted ? (
                <Icon name="check" className="size-5 text-[color:var(--lkv-secondary)]" aria-hidden="true" />
              ) : undefined
            }
          />

          <ListItem
            as="div"
            disabled={loading}
            onClick={handleArchiveToggle}
            className="min-h-[52px]"
            leading={<Icon name="archive" className="size-5 text-[color:var(--lkv-text-secondary)]" aria-hidden="true" />}
            title={isArchived ? 'Désarchiver la conversation' : 'Archiver la conversation'}
            trailing={
              isArchived ? (
                <Icon name="check" className="size-5 text-[color:var(--lkv-secondary)]" aria-hidden="true" />
              ) : undefined
            }
          />

          {onReport && (
            <ListItem
              as="div"
              onClick={() => {
                onReport(conversation);
                onClose();
              }}
              className="min-h-[52px] border border-[color:var(--lkv-danger)]/30 bg-[color:var(--lkv-danger-bg)]"
              leading={<Icon name="shield-alert" className="size-5 text-[color:var(--lkv-danger-dark)]" aria-hidden="true" />}
              title={
                <span className="text-[color:var(--lkv-danger-dark)]">
                  Signaler ou bloquer {member?.full_name || ''}
                </span>
              }
            />
          )}
        </div>
      )}
    </MobileSheet>
  );
};
