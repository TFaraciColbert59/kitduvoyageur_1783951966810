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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white/95 backdrop-blur-2xl border border-stone-200/80 rounded-3xl max-w-sm w-full p-5 text-stone-900 shadow-xl relative overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-stone-200/60 mb-4">
          <h3 className="font-bold text-base text-stone-900">Options de conversation</h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-stone-100 text-stone-500 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {showMuteSubmenu ? (
          <div className="space-y-2 animate-fadeIn">
            <h4 className="text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">
              Masquer les notifications
            </h4>
            <button
              onClick={() => handleMuteToggle(1)}
              disabled={loading}
              className="w-full text-left p-3 rounded-xl hover:bg-stone-100 font-medium text-xs text-stone-800 transition-colors"
            >
              Pendant 1 heure
            </button>
            <button
              onClick={() => handleMuteToggle(8)}
              disabled={loading}
              className="w-full text-left p-3 rounded-xl hover:bg-stone-100 font-medium text-xs text-stone-800 transition-colors"
            >
              Pendant 8 heures
            </button>
            <button
              onClick={() => handleMuteToggle(undefined)}
              disabled={loading}
              className="w-full text-left p-3 rounded-xl hover:bg-stone-100 font-medium text-xs text-stone-800 transition-colors"
            >
              Jusqu&apos;à réactivation (Toujours)
            </button>
            <button
              onClick={() => setShowMuteSubmenu(false)}
              className="w-full text-center mt-2 py-2 text-xs text-stone-400 font-semibold hover:text-stone-700"
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
              className="w-full p-3 rounded-xl hover:bg-stone-100 flex items-center justify-between text-xs font-semibold text-stone-800 transition-colors"
            >
              <div className="flex items-center gap-3">
                {isMuted ? (
                  <Bell className="w-4 h-4 text-emerald-600" />
                ) : (
                  <BellOff className="w-4 h-4 text-stone-500" />
                )}
                <span>{isMuted ? 'Réactiver les notifications' : 'Masquer les notifications (Mute)'}</span>
              </div>
              {isMuted && <Check className="w-4 h-4 text-emerald-600" />}
            </button>

            {/* Archive Button */}
            <button
              onClick={handleArchiveToggle}
              disabled={loading}
              className="w-full p-3 rounded-xl hover:bg-stone-100 flex items-center justify-between text-xs font-semibold text-stone-800 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Archive className="w-4 h-4 text-stone-500" />
                <span>{isArchived ? 'Désarchiver la conversation' : 'Archiver la conversation'}</span>
              </div>
              {isArchived && <Check className="w-4 h-4 text-emerald-600" />}
            </button>

            {/* Report & Block Button */}
            {conversation.other_member && (
              <button
                onClick={() => {
                  onClose();
                  onOpenReportBlock();
                }}
                className="w-full p-3 rounded-xl hover:bg-rose-50 flex items-center gap-3 text-xs font-semibold text-rose-700 transition-colors mt-2 border-t border-stone-100"
              >
                <ShieldAlert className="w-4 h-4 text-rose-600" />
                <span>Signaler ou Bloquer {conversation.other_member.full_name}</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
