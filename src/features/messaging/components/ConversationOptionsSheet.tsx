"use client";

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { Bell, BellOff, Archive, ShieldAlert, Check, X } from 'lucide-react';
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

  const menuItemClass =
    'w-full p-3.5 rounded-2xl bg-white/70 hover:bg-[#17402C]/10 border border-stone-200/50 flex items-center gap-3 text-[15px] font-semibold text-[#17402C] transition-colors min-h-[52px]';

  return (
    <MobileSheet
      isOpen={isOpen}
      onClose={onClose}
      title={isPending ? 'Demande de message' : 'Options de conversation'}
    >
      {member && (
        <div className="flex items-center gap-3 mb-4 pt-1">
          <div className="w-12 h-12 rounded-full overflow-hidden relative ring-2 ring-white/90 shadow-xs bg-stone-100 shrink-0">
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
            <p className="font-bold text-[15px] text-[#17402C] truncate">
              {member.full_name || 'Voyageur LKDV'}
            </p>
            <p className="text-[13px] text-[#5A574E] truncate">
              {isPending ? 'Souhaite vous écrire' : 'Conversation directe'}
            </p>
          </div>
        </div>
      )}

      {isPending ? (
        <div className="space-y-2">
          <button
            type="button"
            onClick={handleAccept}
            disabled={loading}
            className={`${menuItemClass} bg-[#EDF3ED] border-[#A3C4A3]/40`}
          >
            <Check className="w-5 h-5 text-[#2D6B4A]" />
            Accepter la demande
          </button>
          <button
            type="button"
            onClick={handleDecline}
            disabled={loading}
            className={menuItemClass}
          >
            <X className="w-5 h-5 text-[#8A241B]" />
            Refuser la demande
          </button>
          {onReport && (
            <button
              type="button"
              onClick={() => {
                onReport(conversation);
                onClose();
              }}
              className="w-full p-3.5 rounded-2xl bg-[#F5DDD9]/70 hover:bg-[#F5DDD9]/90 border border-[#A8443A]/30 flex items-center gap-3 text-[15px] font-semibold text-[#8A241B] transition-colors min-h-[52px]"
            >
              <ShieldAlert className="w-5 h-5 text-[#8A241B]" />
              Signaler ou bloquer
            </button>
          )}
        </div>
      ) : showMuteSubmenu ? (
        <div className="space-y-2">
          <h4 className="text-xs font-bold text-[#5A574E] uppercase tracking-wider mb-2">
            Masquer les notifications
          </h4>
          <button
            type="button"
            onClick={() => handleMuteToggle(1)}
            disabled={loading}
            className={`${menuItemClass} text-[15px]`}
          >
            Pendant 1 heure
          </button>
          <button
            type="button"
            onClick={() => handleMuteToggle(8)}
            disabled={loading}
            className={`${menuItemClass} text-[15px]`}
          >
            Pendant 8 heures
          </button>
          <button
            type="button"
            onClick={() => handleMuteToggle(undefined)}
            disabled={loading}
            className={`${menuItemClass} text-[15px]`}
          >
            Jusqu&apos;à réactivation (Toujours)
          </button>
          <button
            type="button"
            onClick={() => setShowMuteSubmenu(false)}
            className="w-full text-center mt-2 py-3 text-[15px] text-[#5A574E] font-semibold hover:text-[#17402C] min-h-[52px] flex items-center justify-center"
          >
            Retour
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => {
              if (isMuted) {
                handleMuteToggle(0);
              } else {
                setShowMuteSubmenu(true);
              }
            }}
            disabled={loading}
            className={`${menuItemClass} justify-between`}
          >
            <span className="flex items-center gap-3">
              {isMuted ? (
                <Bell className="w-5 h-5 text-[#5B7F55]" />
              ) : (
                <BellOff className="w-5 h-5 text-[#5A574E]" />
              )}
              {isMuted ? 'Réactiver les notifications' : 'Masquer les notifications'}
            </span>
            {isMuted && <Check className="w-5 h-5 text-[#5B7F55]" />}
          </button>

          <button
            type="button"
            onClick={handleArchiveToggle}
            disabled={loading}
            className={`${menuItemClass} justify-between`}
          >
            <span className="flex items-center gap-3">
              <Archive className="w-5 h-5 text-[#5A574E]" />
              {isArchived ? 'Désarchiver la conversation' : 'Archiver la conversation'}
            </span>
            {isArchived && <Check className="w-5 h-5 text-[#5B7F55]" />}
          </button>

          {onReport && (
            <button
              type="button"
              onClick={() => {
                onReport(conversation);
                onClose();
              }}
              className="w-full p-3.5 rounded-2xl bg-[#F5DDD9]/70 hover:bg-[#F5DDD9]/90 border border-[#A8443A]/30 flex items-center gap-3 text-[15px] font-semibold text-[#8A241B] transition-colors min-h-[52px]"
            >
              <ShieldAlert className="w-5 h-5 text-[#8A241B]" />
              Signaler ou bloquer {member?.full_name || ''}
            </button>
          )}
        </div>
      )}
    </MobileSheet>
  );
};