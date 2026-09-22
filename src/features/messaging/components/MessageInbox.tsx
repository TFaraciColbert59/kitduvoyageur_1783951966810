'use client';

import Icon from '@/components/ui/Icon';
import React, { useState, useCallback } from 'react';
import { Button, Card, ErrorState } from '@/components/ui';
import type { UserProfileSummary, Conversation } from '../types/messaging.types';
import { useConversations } from '../hooks/useConversations';
import { useBackGuard } from '../hooks/useBackGuard';
import { ConversationList } from './ConversationList';
import { ConversationView } from './ConversationView';
import { NewConversationModal } from './NewConversationModal';
import ReportBlockModal, { ReportTarget } from '@/components/ui/ReportBlockModal';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { zIndex } from '@/lib/ui/zIndex';

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
  const { conversations, loading, error, refreshConversations } = useConversations(currentUserId);
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

  const selectedConversation = conversations.find((c) => c.id === selectedConvId) || null;

  const handleConversationCreated = async (convId: string) => {
    await refreshConversations();
    open(convId);
  };

  const errorState = (
    <ErrorState
      className="h-full"
      title="Discussions indisponibles"
      message={error || undefined}
      onRetry={() => {
        haptic('light');
        refreshConversations();
      }}
    />
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
        M04 — couche `sheet` de l'échelle partagée : au-dessus de la
        BottomTabBar (nav), sous les modales/sheets Radix portées au body
        (Modal/Sheet = layer modal), qui doivent rester visibles par-dessus.
      */}
      {selectedConversation && (
        <div
          className={`fixed inset-0 h-[calc(100dvh-var(--kb-inset,0px))] bg-[color:var(--glass-bg-medium)] border border-[color:var(--glass-border)] saturate-[var(--glass-sat)] lkv-rim-inset pl-[var(--safe-left)] pr-[var(--safe-right)] backdrop-blur-[var(--glass-blur-sm)] md:hidden ${
            isClosing ? 'msg-sheet-out' : 'msg-sheet-in'
          }`}
          style={{
            zIndex: zIndex.sheet,
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
            <Card className="flex h-full w-full flex-col items-center justify-center p-[var(--space-8)] text-center">
              <div className="mb-[var(--space-4)] flex size-20 items-center justify-center rounded-full bg-[color:var(--btn-tint)] border border-[color:var(--btn-glass-border)] backdrop-blur-[var(--btn-blur)] saturate-[var(--btn-saturate)] lkv-rim-btn text-[color:var(--lkv-primary)]">
                <Icon name="send" className="size-10" aria-hidden="true" />
              </div>
              <h3 className="text-[length:var(--lkv-text-title-sm)] font-bold text-[color:var(--lkv-text-primary)]">
                Vos messages
              </h3>
              <p className="mt-[var(--space-2)] max-w-md text-[length:var(--lkv-text-footnote)] leading-relaxed text-[color:var(--lkv-text-secondary)]">
                Sélectionnez une conversation ou lancez une nouvelle discussion avec un membre de la
                communauté LKDV.
              </p>
              <Button
                type="button"
                variant="primary"
                onClick={() => {
                  haptic('light');
                  setIsModalOpen(true);
                }}
                className="mt-[var(--space-6)] shadow-elevation-2"
                icon={<Icon name="plus" className="size-4" aria-hidden="true" />}
              >
                Nouvelle discussion
              </Button>
            </Card>
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
