"use client";

import React, { useState, useCallback } from 'react';
import type { UserProfileSummary, Conversation } from '../types/messaging.types';
import { useConversations } from '../hooks/useConversations';
import { useBackGuard } from '../hooks/useBackGuard';
import { ConversationList } from './ConversationList';
import { ConversationView } from './ConversationView';
import { NewConversationModal } from './NewConversationModal';
import ReportBlockModal, { ReportTarget } from '@/components/ui/ReportBlockModal';
import { Send, Plus, AlertTriangle } from 'lucide-react';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';

interface MessageInboxProps {
  currentUserId: string;
  currentUserProfile?: UserProfileSummary | null;
  onActiveConversationChange?: (hasActiveConv: boolean) => void;
}

export const MessageInbox: React.FC<MessageInboxProps> = ({
  currentUserId,
  currentUserProfile,
  onActiveConversationChange,
}) => {
  const { haptic } = useHapticFeedback();
  const { conversations, loading, error, refreshConversations } =
    useConversations(currentUserId);
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);

  const handleReportConversation = (conv: Conversation) => {
    setReportTarget({
      userId: conv.other_member?.id || conv.created_by || 'unknown',
      userName: conv.other_member?.full_name || conv.title || 'Voyageur LKDV',
      groupId: conv.type === 'group' ? conv.id : undefined,
      groupName: conv.type === 'group' ? conv.title || undefined : undefined,
    });
  };

  const open = (convId: string) => {
    setSelectedConvId(convId);
    onActiveConversationChange?.(true);
  };

  const close = useCallback(() => {
    setIsClosing(true);
    // Laisse jouer la sortie (180ms) avant de démonter.
    window.setTimeout(() => {
      setSelectedConvId(null);
      setIsClosing(false);
      onActiveConversationChange?.(false);
    }, 180);
  }, [onActiveConversationChange]);

  const requestClose = useBackGuard(selectedConvId !== null, close);

  const selectedConversation =
    conversations.find((c) => c.id === selectedConvId) || null;

  const handleConversationCreated = async (convId: string) => {
    await refreshConversations();
    open(convId);
  };

  const errorState = (
    <div className="w-full h-full flex flex-col items-center justify-center text-center px-8">
      <div className="w-14 h-14 rounded-full bg-[#F5DDD9] text-[#A8443A] flex items-center justify-center mb-4">
        <AlertTriangle className="w-7 h-7" />
      </div>
      <h3 className="text-base font-bold text-[#17402C]">Discussions indisponibles</h3>
      <p className="text-sm text-[#5A574E] mt-1.5 max-w-xs leading-relaxed">{error}</p>
      <button
        type="button"
        onClick={() => {
          haptic('light');
          refreshConversations();
        }}
        className="glass-capsule-btn primary mt-5 px-6 min-h-[48px] text-sm font-bold"
      >
        Réessayer
      </button>
    </div>
  );

  return (
    <div className="w-full h-full md:h-[740px] md:max-h-[calc(100vh-140px)] md:min-h-[500px] max-w-7xl mx-auto flex flex-col p-0 md:p-2 overflow-hidden relative">
      {/* ---------- MOBILE ---------- */}
      <div className="flex md:hidden w-full h-full relative z-10 overflow-hidden">
        {error ? (
          errorState
        ) : (
          <ConversationList
            conversations={conversations}
            selectedId={selectedConvId}
            onSelect={(c) => open(c.id)}
            onNewConversation={() => setIsModalOpen(true)}
            onRefresh={refreshConversations}
            onReportConversation={handleReportConversation}
            currentUserId={currentUserId}
            loading={loading}
          />
        )}
      </div>

      {/*
        Calque conversation : hors flux du shell, safe-areas gérées en interne.
        z-[10000] passe au-dessus de la BottomTabBar (z-9999) — la descendance
        (sheets, modales) est englobée dans ce stacking context.
      */}
      {selectedConversation && (
        <div
          className={`md:hidden fixed inset-0 z-[10000] bg-[#FAF8F5] ${
            isClosing ? 'msg-sheet-out' : 'msg-sheet-in'
          }`}
          style={{
            height: 'calc(100dvh - var(--kb-inset, 0px))',
            paddingLeft: 'env(safe-area-inset-left, 0px)',
            paddingRight: 'env(safe-area-inset-right, 0px)',
          }}
          role="region"
          aria-label={`Conversation avec ${
            selectedConversation.title ||
            selectedConversation.other_member?.full_name ||
            'un voyageur'
          }`}
        >
          <ConversationView
            conversation={selectedConversation}
            currentUserId={currentUserId}
            currentUserProfile={currentUserProfile}
            onBack={() => {
              haptic('light');
              requestClose();
            }}
            onRefreshConversations={refreshConversations}
          />
        </div>
      )}

      {/* ---------- DESKTOP (dual-pane inchangé structurellement) ---------- */}
      <div className="hidden md:flex w-full h-full gap-4 items-stretch justify-center overflow-hidden relative z-10">
        <div className="w-80 lg:w-96 shrink-0 h-full overflow-hidden">
          {error ? (
            errorState
          ) : (
            <ConversationList
              conversations={conversations}
              selectedId={selectedConvId}
              onSelect={(c) => setSelectedConvId(c.id)}
              onNewConversation={() => setIsModalOpen(true)}
              onRefresh={refreshConversations}
              onReportConversation={handleReportConversation}
              currentUserId={currentUserId}
              loading={loading}
            />
          )}
        </div>

        <div className="flex-1 h-full overflow-hidden">
          {selectedConversation ? (
            <ConversationView
              conversation={selectedConversation}
              currentUserId={currentUserId}
              currentUserProfile={currentUserProfile}
              onRefreshConversations={refreshConversations}
            />
          ) : (
            <div className="w-full h-full glass rounded-3xl flex flex-col items-center justify-center text-center p-8 shadow-xs">
              <div className="w-20 h-20 rounded-full bg-[#17402C]/10 text-[#17402C] flex items-center justify-center mb-4">
                <Send className="w-10 h-10" />
              </div>
              <h3 className="text-xl font-bold text-[#17402C]">Vos messages</h3>
              <p className="text-sm text-[#5A574E] max-w-md mt-2 leading-relaxed">
                Sélectionnez une conversation ou lancez une nouvelle discussion avec un
                membre de la communauté LKDV.
              </p>
              <button
                type="button"
                onClick={() => {
                  haptic('light');
                  setIsModalOpen(true);
                }}
                className="glass-capsule-btn primary mt-6 px-6 text-sm font-semibold shadow-md flex items-center gap-2 min-h-[48px]"
              >
                <Plus className="w-4 h-4" />
                Nouvelle discussion
              </button>
            </div>
          )}
        </div>
      </div>

      <NewConversationModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        currentUserId={currentUserId}
        onConversationCreated={handleConversationCreated}
      />

      {/* Signalement / blocage depuis le menu appui long (liste) */}
      <ReportBlockModal
        target={reportTarget}
        onClose={() => setReportTarget(null)}
        onSuccess={() => {
          setReportTarget(null);
          refreshConversations();
        }}
      />
    </div>
  );
};