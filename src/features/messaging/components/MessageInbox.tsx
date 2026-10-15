'use client';

import Icon from '@/components/ui/Icon';
import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { Button, Card, ErrorState, SearchField } from '@/components/ui';
import type { UserProfileSummary, Conversation } from '../types/messaging.types';
import { useConversations } from '../hooks/useConversations';
import { useBackGuard } from '../hooks/useBackGuard';
import { ConversationList } from './ConversationList';
import { ConversationView } from './ConversationView';
import { NewConversationModal } from './NewConversationModal';
import ReportBlockModal, { ReportTarget } from '@/components/ui/ReportBlockModal';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { messagingService } from '../services/messagingService';
import { createClient } from '@/lib/supabase/client';
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
  const [deepLinkError, setDeepLinkError] = useState<string | null>(null);
  const deepLinkOpened = useRef(false);
  const recipientLinkHandled = useRef<string | null>(null);
  // /profil/[id] -> /messagerie?dest=UUID: treat this as an explicit request
  // to start/open a direct conversation, not a user search.
  useEffect(() => {
    const target = new URLSearchParams(window.location.search).get('dest');
    if (!target || recipientLinkHandled.current === target) return;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(target)
        || target === currentUserId) {
      setDeepLinkError('Destinataire invalide.');
      recipientLinkHandled.current = target;
      return;
    }
    recipientLinkHandled.current = target;
    let cancelled = false;
    const openRequestedConversation = async () => {
      try {
        // Public directory + block filtering mirror NewConversationModal.
        // The existing RPC enforces permissions again before any creation.
        const supabase = createClient();
        const [blockedByMe, blockedMe] = await Promise.all([
          supabase.from('user_blocks').select('blocked_id').eq('blocker_id', currentUserId).eq('blocked_id', target).maybeSingle(),
          supabase.from('user_blocks').select('blocker_id').eq('blocked_id', currentUserId).eq('blocker_id', target).maybeSingle(),
        ]);
        if (blockedByMe.error || blockedMe.error || blockedByMe.data || blockedMe.data) {
          throw new Error('Conversation indisponible pour ce profil.');
        }
        const id = await messagingService.getOrCreateDirectConversation(target, currentUserId);
        if (!id || cancelled) return;
        await refreshConversations();
        if (cancelled) return;
        setSelectedConvId(id);
        setDeepLinkError(null);
        onActiveConversationChange?.(true);
        // Do not relaunch a creation on refresh, remount or history navigation.
        const address = new URL(window.location.href);
        if (address.searchParams.get('dest') === target) {
          address.searchParams.delete('dest');
          window.history.replaceState(window.history.state, '', address.pathname + address.search + address.hash);
        }
      } catch {
        if (!cancelled) setDeepLinkError('Impossible d’ouvrir cette discussion. Vérifiez les autorisations et réessayez depuis le profil.');
      }
    };
    void openRequestedConversation();
    return () => {
      cancelled = true;
      // React StrictMode replays mount effects. Allow its second setup to
      // fulfill the deep link instead of treating the cancelled first as done.
      if (recipientLinkHandled.current === target) recipientLinkHandled.current = null;
    };
  }, [currentUserId, refreshConversations, onActiveConversationChange]);

  useEffect(() => {
    if (deepLinkOpened.current) return;
    const id = new URLSearchParams(window.location.search).get('conversation');
    if (
      id &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) &&
      conversations.some((c) => c.id === id)
    ) {
      deepLinkOpened.current = true;
      setSelectedConvId(id);
      onActiveConversationChange?.(true);
    }
  }, [conversations, onActiveConversationChange]);
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

  // A-084 : recherche locale (titre, interlocuteur, dernier message) — la
  // requête serveur bornée viendra avec la recherche plein-texte.
  const [searchQuery, setSearchQuery] = useState('');
  const visibleConversations = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return conversations;
    return conversations.filter((conv) => {
      const haystack = [
        conv.title,
        conv.other_member?.full_name,
        conv.last_message?.content,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [conversations, searchQuery]);

  const searchBarNode = (
    <div className="shrink-0 px-[var(--space-3)] pt-[var(--space-2)]">
      <SearchField
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        onClear={() => setSearchQuery('')}
        placeholder="Rechercher une discussion..."
        aria-label="Rechercher dans mes discussions"
        inputMode="search"
        enterKeyHint="search"
      />
    </div>
  );

  return (
    <div className="w-full h-full md:h-[740px] md:max-h-[calc(100vh-140px)] md:min-h-[500px] max-w-7xl mx-auto flex flex-col p-0 md:p-2 overflow-hidden relative">
      {deepLinkError && (
        <div role="alert" className="relative z-20 mx-3 mt-3 rounded-lg border border-[color:var(--lkv-danger)]/25 bg-[color:var(--lkv-danger-bg)] p-3 text-sm text-[color:var(--lkv-text-primary)]">
          {deepLinkError}
        </div>
      )}
      {/* ---------- MOBILE ---------- */}
      <div className="flex md:hidden w-full h-full relative z-10 flex-col overflow-hidden">
        {!error && searchBarNode}
        {error ? (
          errorState
        ) : (
          <ConversationList
            conversations={visibleConversations}
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
        <div className="w-80 lg:w-96 shrink-0 h-full overflow-hidden flex flex-col">
          {!error && searchBarNode}
          {error ? (
            errorState
          ) : (
            <ConversationList
              conversations={visibleConversations}
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
              <div className="mb-[var(--space-4)] flex size-20 items-center justify-center rounded-full bg-[color:var(--btn-tint)] border border-[color:var(--btn-glass-border)] backdrop-blur-[var(--btn-blur)] saturate-[var(--btn-saturate)] lkv-rim-btn text-[color:var(--lkv-text-primary)]">
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
