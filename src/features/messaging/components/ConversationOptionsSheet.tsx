'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { AccountDrawerHost } from '@/design/account/AccountDrawerHost';
import type { Conversation } from '../types/messaging.types';
import { messagingService } from '../services/messagingService';
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
  const router = useRouter();
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

  const reportLabel = member?.full_name
    ? `Signaler ou bloquer ${member.full_name}`
    : 'Signaler ou bloquer';

  return (
    <AccountDrawerHost
      variant="card"
      open={isOpen}
      title={isPending ? 'Demande de message' : 'Options de conversation'}
      subtitle={member?.full_name || undefined}
      onClose={onClose}
      onBack={showMuteSubmenu ? () => setShowMuteSubmenu(false) : undefined}
    >
      {member ? (
        <div className="li">
          <span className="avi" style={{ overflow: 'hidden' }}>
            <Image
              src={member.avatar_url || '/assets/images/no_image.png'}
              alt=""
              fill
              sizes="30px"
              style={{ objectFit: 'cover' }}
              onError={(e) => {
                (e.target as HTMLImageElement).src = '/assets/images/no_image.png';
              }}
            />
          </span>
          <div>
            <div className="ttl">
              <span>{member.full_name || 'Voyageur LKDV'}</span>
            </div>
            <div className="s2">{isPending ? 'Souhaite vous écrire' : 'Conversation directe'}</div>
          </div>
          <span className={isPending ? 'tg pending' : 'tg'}>{isPending ? 'Demande' : 'Directe'}</span>
        </div>
      ) : null}

      {!isPending && member?.id ? (
        <div className="li nt">
          <div>
            <div className="ttl">Voir le profil</div>
            <div className="s2">{member.full_name || 'Voyageur LKDV'}</div>
          </div>
          <button
            type="button"
            className="mbtn"
            onClick={() => {
              haptic('light');
              onClose();
              router.push(`/profil/${member.id}`);
            }}
          >
            Ouvrir
          </button>
        </div>
      ) : null}

      {isPending ? (
        <div>
          <div className="li nt">
            <div>
              <div className="ttl">Accepter la demande</div>
              <div className="s2">La conversation s’ouvrira dans votre liste</div>
            </div>
            <button type="button" className="mbtn p" disabled={loading} onClick={handleAccept}>
              Accepter
            </button>
          </div>

          <div className="li nt">
            <div>
              <div className="ttl">Refuser la demande</div>
              <div className="s2">Elle disparaîtra de vos demandes</div>
            </div>
            <button type="button" className="mbtn" disabled={loading} onClick={handleDecline}>
              Refuser
            </button>
          </div>

          {onReport ? (
            <div className="li nt">
              <div>
                <div className="ttl">Signaler ou bloquer</div>
                <div className="s2">Contenu inapproprié</div>
              </div>
              <button
                type="button"
                className="mbtn"
                style={{ color: 'var(--bad)' }}
                onClick={() => {
                  onReport(conversation);
                  onClose();
                }}
              >
                Signaler
              </button>
            </div>
          ) : null}
        </div>
      ) : showMuteSubmenu ? (
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

          {onReport ? (
            <div className="li nt">
              <div>
                <div className="ttl">{reportLabel}</div>
                <div className="s2">Contenu inapproprié</div>
              </div>
              <button
                type="button"
                className="mbtn"
                style={{ color: 'var(--bad)' }}
                onClick={() => {
                  onReport(conversation);
                  onClose();
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
