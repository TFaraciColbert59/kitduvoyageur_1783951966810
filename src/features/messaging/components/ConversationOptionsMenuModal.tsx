"use client";

import React, { useState } from 'react';
import { Bell, BellOff, Archive, ShieldAlert, X, Check } from 'lucide-react';
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

  if (!isOpen) return null;

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
      <div className="glass rounded-3xl max-w-sm w-full p-5 text-[#14140F] relative overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-stone-200/60 mb-4">
          <h3 className="font-bold text-base text-[#17402C]">Options de conversation</h3>
          <button
            onClick={onClose}
            className="glass-circle-btn w-11 h-11 text-[#5A574E] hover:text-[#17402C] shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {showMuteSubmenu ? (
          <div className="space-y-2 animate-fade-in">
            <h4 className="text-xs font-bold text-[#5A574E] uppercase tracking-wider mb-2">
              Masquer les notifications
            </h4>
            <button
              onClick={() => handleMuteToggle(1)}
              disabled={loading}
              className="w-full text-left p-3.5 rounded-2xl bg-white/70 hover:bg-[#17402C]/10 font-medium text-xs text-[#17402C] transition-colors min-h-[44px] flex items-center border border-stone-200/50"
            >
              Pendant 1 heure
            </button>
            <button
              onClick={() => handleMuteToggle(8)}
              disabled={loading}
              className="w-full text-left p-3.5 rounded-2xl bg-white/70 hover:bg-[#17402C]/10 font-medium text-xs text-[#17402C] transition-colors min-h-[44px] flex items-center border border-stone-200/50"
            >
              Pendant 8 heures
            </button>
            <button
              onClick={() => handleMuteToggle(undefined)}
              disabled={loading}
              className="w-full text-left p-3.5 rounded-2xl bg-white/70 hover:bg-[#17402C]/10 font-medium text-xs text-[#17402C] transition-colors min-h-[44px] flex items-center border border-stone-200/50"
            >
              Jusqu&apos;à réactivation (Toujours)
            </button>
            <button
              onClick={() => setShowMuteSubmenu(false)}
              className="w-full text-center mt-2 py-3 text-xs text-[#5A574E] font-semibold hover:text-[#17402C] min-h-[44px] flex items-center justify-center"
            >
              Retour
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {/* Mute Button */}
            <button
              onClick={() => {
                if (isMuted) {
                  handleMuteToggle(0);
                } else {
                  setShowMuteSubmenu(true);
                }
              }}
              disabled={loading}
              className="w-full p-3.5 rounded-2xl bg-white/70 hover:bg-[#17402C]/10 border border-stone-200/50 flex items-center justify-between text-xs font-semibold text-[#17402C] transition-colors min-h-[44px]"
            >
              <div className="flex items-center gap-3">
                {isMuted ? (
                  <Bell className="w-4 h-4 text-[#5B7F55]" />
                ) : (
                  <BellOff className="w-4 h-4 text-[#5A574E]" />
                )}
                <span>{isMuted ? 'Réactiver les notifications' : 'Masquer les notifications (Mute)'}</span>
              </div>
              {isMuted && <Check className="w-4 h-4 text-[#5B7F55]" />}
            </button>

            {/* Archive Button */}
            <button
              onClick={handleArchiveToggle}
              disabled={loading}
              className="w-full p-3.5 rounded-2xl bg-white/70 hover:bg-[#17402C]/10 border border-stone-200/50 flex items-center justify-between text-xs font-semibold text-[#17402C] transition-colors min-h-[44px]"
            >
              <div className="flex items-center gap-3">
                <Archive className="w-4 h-4 text-[#5A574E]" />
                <span>{isArchived ? 'Désarchiver la conversation' : 'Archiver la conversation'}</span>
              </div>
              {isArchived && <Check className="w-4 h-4 text-[#5B7F55]" />}
            </button>

            {/* Report & Block Button */}
            {conversation.other_member && (
              <button
                onClick={() => {
                  onClose();
                  onOpenReportBlock();
                }}
                className="w-full p-3.5 rounded-2xl bg-[#F5DDD9]/70 hover:bg-[#F5DDD9]/90 border border-[#A8443A]/30 flex items-center gap-3 text-xs font-semibold text-[#8A241B] transition-colors mt-2 min-h-[44px]"
              >
                <ShieldAlert className="w-4 h-4 text-[#8A241B]" />
                <span>Signaler ou Bloquer {conversation.other_member.full_name}</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
