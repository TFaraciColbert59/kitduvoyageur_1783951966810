'use client';

import React, { useState } from 'react';
import { AccountDrawerHost } from '@/design/account/AccountDrawerHost';
import type { Conversation } from '../types/messaging.types';
import { messagingService } from '../services/messagingService';
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
    <AccountDrawerHost
      open={isOpen}
      title="Options de conversation"
      subtitle={conversation.other_member?.full_name || conversation.title || undefined}
      onClose={onClose}
      onBack={showMuteSubmenu ? () => setShowMuteSubmenu(false) : undefined}
    >
      {showMuteSubmenu ? (
        <div>
          <div className="li nt">
            <div>
              <div className="ttl">Pendant 1 heure</div>
              <div className="s2">Les notifications reviennent ensuite</div>
            </div>
            <button
              type="button"
              className="mbtn"
              disabled={loading}
              onClick={() => handleMuteToggle(1)}
            >
              Muet
            </button>
          </div>

          <div className="li nt">
            <div>
              <div className="ttl">Pendant 8 heures</div>
              <div className="s2">Les notifications reviennent ensuite</div>
            </div>
            <button
              type="button"
              className="mbtn"
              disabled={loading}
              onClick={() => handleMuteToggle(8)}
            >
              Muet
            </button>
          </div>

          <div className="li nt">
            <div>
              <div className="ttl">Jusqu’à réactivation (Toujours)</div>
              <div className="s2">Reste muet jusqu’à ce que vous réactiviez</div>
            </div>
            <button
              type="button"
              className="mbtn"
              disabled={loading}
              onClick={() => handleMuteToggle(undefined)}
            >
              Muet
            </button>
          </div>
        </div>
      ) : (
        <div>
          <div className="li nt">
            <div>
              <div className="ttl">
                {isMuted ? 'Réactiver les notifications' : 'Masquer les notifications'}
              </div>
              <div className="s2">
                {isMuted ? 'Vous ne recevez plus d’alerte' : 'Choisir une durée de silence'}
              </div>
              {isMuted ? (
                <div className="tags">
                  <span className="tg p">Muet</span>
                </div>
              ) : null}
            </div>
            <button
              type="button"
              className="mbtn"
              disabled={loading}
              onClick={() => {
                if (isMuted) {
                  handleMuteToggle(0);
                } else {
                  setShowMuteSubmenu(true);
                }
              }}
            >
              {isMuted ? 'Réactiver' : 'Choisir'}
            </button>
          </div>

          <div className="li nt">
            <div>
              <div className="ttl">
                {isArchived ? 'Désarchiver la conversation' : 'Archiver la conversation'}
              </div>
              <div className="s2">
                {isArchived ? 'Revenir dans la liste principale' : 'Sortir de la liste principale'}
              </div>
              {isArchived ? (
                <div className="tags">
                  <span className="tg">Archivée</span>
                </div>
              ) : null}
            </div>
            <button
              type="button"
              className="mbtn"
              disabled={loading}
              onClick={handleArchiveToggle}
            >
              {isArchived ? 'Désarchiver' : 'Archiver'}
            </button>
          </div>

          {conversation.other_member ? (
            <div className="li nt">
              <div>
                <div className="ttl">{`Signaler ou bloquer ${conversation.other_member.full_name}`}</div>
                <div className="s2">Contenu inapproprié</div>
              </div>
              <button
                type="button"
                className="mbtn"
                style={{ color: 'var(--bad)' }}
                onClick={() => {
                  onClose();
                  onOpenReportBlock();
                }}
              >
                Signaler
              </button>
            </div>
          ) : null}
        </div>
      )}
    </AccountDrawerHost>
  );
};
