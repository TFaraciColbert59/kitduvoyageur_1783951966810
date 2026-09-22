'use client';

import Icon from '@/components/ui/Icon';
import React, { useState, useMemo, useEffect } from 'react';
import { Card, EmptyState, IconButton, SearchField, Skeleton, Tabs } from '@/components/ui';
import type { Conversation } from '../types/messaging.types';
import { ConversationRow, type SwipeAction } from './ConversationRow';
import { ConversationOptionsSheet } from './ConversationOptionsSheet';
import { messagingService } from '../services/messagingService';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';

interface ConversationListProps {
  conversations: Conversation[];
  selectedId: string | null;
  onSelect: (conv: Conversation) => void;
  onNewConversation: () => void;
  onRefresh?: () => void;
  onReportConversation?: (conv: Conversation) => void;
  currentUserId?: string;
  loading: boolean;
}

const TABS = [
  { id: 'all', label: 'Toutes' },
  { id: 'direct', label: 'Directs' },
  { id: 'group', label: 'Groupes' },
  { id: 'requests', label: 'Demandes' },
] as const;

type TabId = (typeof TABS)[number]['id'];

// Mobile : les onglets vivent dans le tray d'extension de la BottomTabBar
// (pattern canonique du site, cf. BottomTabBar.getUpperTabs). Sync par events :
//  - 'messagerie-tab-state'  (liste -> barre) : onglet actif + nb demandes
//  - 'messagerie-tab-change' (barre -> liste) : tap utilisateur sur le tray
const MESSAGERIE_TAB_STATE = 'messagerie-tab-state';
const MESSAGERIE_TAB_CHANGE = 'messagerie-tab-change';

export const ConversationListSkeleton = () => (
  <div
    className="space-y-[var(--space-2)] p-[var(--space-1)]"
    aria-busy="true"
    aria-label="Chargement des conversations"
  >
    {[1, 2, 3, 4, 5].map((i) => (
      <Card key={i} variant="compact" className="flex min-h-[76px] items-center gap-[var(--space-3)]">
        <Skeleton className="size-12 shrink-0 rounded-full" />
        <div className="min-w-0 flex-1 space-y-[var(--space-2)]">
          <div className="flex items-center justify-between gap-[var(--space-2)]">
            <Skeleton className="h-3.5 w-28 rounded-[var(--lkv-radius-xs)]" />
            <Skeleton className="h-2.5 w-10 rounded-[var(--lkv-radius-xs)]" />
          </div>
          <Skeleton className="h-3 w-44 rounded-[var(--lkv-radius-xs)]" />
        </div>
      </Card>
    ))}
  </div>
);

export const ConversationList: React.FC<ConversationListProps> = ({
  conversations,
  selectedId,
  onSelect,
  onNewConversation,
  onRefresh,
  onReportConversation,
  currentUserId,
  loading,
}) => {
  const { haptic } = useHapticFeedback();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [activeTab, setActiveTab] = useState<TabId>('all');
  const [longPressConv, setLongPressConv] = useState<Conversation | null>(null);

  // Action rapide via glissement (swipe) d'une conversation.
  const handleSwipeAction = async (conv: Conversation, action: SwipeAction) => {
    if (!currentUserId) return;
    if (action === 'accept') {
      await messagingService.acceptMessageRequest(conv.id, currentUserId);
    } else if (action === 'decline') {
      await messagingService.declineMessageRequest(conv.id, currentUserId);
    } else if (action === 'archive') {
      await messagingService.updateMemberPreferences(conv.id, currentUserId, {
        is_archived: !conv.is_archived,
      });
    } else if (action === 'mute') {
      await messagingService.updateMemberPreferences(conv.id, currentUserId, {
        is_muted: !conv.is_muted,
        mute_until: conv.is_muted ? null : new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
      });
    }
    onRefresh?.();
  };

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 150);
    return () => clearTimeout(t);
  }, [search]);

  const pendingRequestsCount = useMemo(
    () => conversations.filter((c) => c.status === 'pending').length,
    [conversations]
  );

  // Publie l'etat du filtre vers le tray de la BottomTabBar.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(
      new CustomEvent(MESSAGERIE_TAB_STATE, {
        detail: { tab: activeTab, count: pendingRequestsCount },
      })
    );
  }, [activeTab, pendingRequestsCount]);

  // Ecoute les taps sur le tray (mobile).
  useEffect(() => {
    const handler = (e: Event) => {
      const tab = (e as CustomEvent).detail;
      if (tab) setActiveTab(tab);
    };
    window.addEventListener(MESSAGERIE_TAB_CHANGE, handler);
    return () => window.removeEventListener(MESSAGERIE_TAB_CHANGE, handler);
  }, []);

  const filteredConversations = useMemo(() => {
    return conversations.filter((c) => {
      if (activeTab === 'requests') {
        if (c.status !== 'pending') return false;
      } else {
        if (c.status === 'pending' || c.status === 'rejected') return false;
        if (activeTab === 'direct' && c.type !== 'direct') return false;
        if (activeTab === 'group' && c.type !== 'group') return false;
      }

      if (!debouncedSearch.trim()) return true;
      const q = debouncedSearch.toLowerCase();
      return (
        !!c.title?.toLowerCase().includes(q) ||
        !!c.other_member?.full_name.toLowerCase().includes(q) ||
        !!c.last_message?.content.toLowerCase().includes(q)
      );
    });
  }, [conversations, activeTab, debouncedSearch]);

  return (
    <Card className="relative flex h-full w-full flex-col overflow-hidden rounded-none bg-[color:var(--glass-bg-medium)] border border-[color:var(--glass-border)] backdrop-blur-[var(--glass-blur-sm)] saturate-[var(--glass-sat)] lkv-rim-inset p-0 md:rounded-[var(--lkv-radius-lg)]">
      {/* Chrome haut — recherche + bouton « + » unique (gère le safe-area top) */}
      <div className="msg-safe-top shrink-0 border-b border-[color:var(--glass-border)] bg-[color:var(--glass-bg-medium)] saturate-[var(--glass-sat)] lkv-rim-inset px-[var(--space-3)] pb-[var(--space-3)] backdrop-blur-[var(--glass-blur-sm)] md:px-[var(--space-4)]">
        <div className="flex items-center gap-[var(--space-2)]">
          <SearchField
            containerClassName="flex-1 min-w-0"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onClear={() => {
              haptic('light');
              setSearch('');
              setDebouncedSearch('');
            }}
            placeholder="Rechercher un voyageur, un groupe…"
            aria-label="Rechercher une conversation"
            inputMode="search"
            enterKeyHint="search"
          />

          {/* Bouton « + » unique — verre givré, comme les autres boutons ronds du site */}
          <IconButton
            type="button"
            variant="solid"
            onClick={() => {
              haptic('medium');
              onNewConversation();
            }}
            aria-label="Nouvelle discussion"
            className="shrink-0 shadow-elevation-2"
            title="Nouvelle discussion"
          >
            <Icon name="plus" className="size-5" aria-hidden="true" />
          </IconButton>
        </div>
      </div>

      {/* Liste */}
      <div className="custom-scrollbar flex-1 space-y-[var(--space-2)] overflow-y-auto overscroll-contain px-[var(--space-3)] pb-[var(--space-3)] pt-[var(--space-3)] [-webkit-overflow-scrolling:touch] md:px-[var(--space-4)]">
        {loading ? (
          <ConversationListSkeleton />
        ) : filteredConversations.length === 0 ? (
          <EmptyState
            compact
            icon={<Icon name="message-square" size={28} aria-hidden="true" />}
            title={
              debouncedSearch
                ? 'Aucun résultat'
                : activeTab === 'requests'
                  ? 'Aucune demande en attente'
                  : 'Aucune discussion'
            }
            description={
              debouncedSearch
                ? 'Essayez un autre nom de voyageur ou de groupe.'
                : activeTab === 'requests'
                  ? 'Les nouvelles demandes de message apparaîtront ici.'
                  : 'Lancez une discussion avec un membre de la communauté.'
            }
          />
        ) : (
          filteredConversations.map((conv) => (
            <ConversationRow
              key={conv.id}
              conversation={conv}
              isSelected={conv.id === selectedId}
              onSelect={onSelect}
              onLongPress={currentUserId ? setLongPressConv : undefined}
              onSwipeAction={currentUserId ? handleSwipeAction : undefined}
            />
          ))
        )}
      </div>

      {/* Menu appui long — gestion des demandes et options de conversation */}
      {currentUserId && (
        <ConversationOptionsSheet
          isOpen={longPressConv !== null}
          onClose={() => setLongPressConv(null)}
          conversation={longPressConv}
          currentUserId={currentUserId}
          onRefreshConversations={onRefresh}
          onReport={onReportConversation}
        />
      )}

      {/* Onglets — DESKTOP uniquement (sidebar dual-pane). Sur mobile le
          filtre vit dans le tray d'extension de la BottomTabBar (canonique). */}
      <div className="mt-[var(--space-1)] hidden shrink-0 border-t border-[color:var(--glass-border)] bg-[color:var(--glass-bg-medium)] saturate-[var(--glass-sat)] lkv-rim-inset px-[var(--space-3)] pb-[var(--space-3)] pt-[var(--space-2)] backdrop-blur-[var(--glass-blur-sm)] md:block md:px-[var(--space-4)]">
        <Tabs
          ariaLabel="Filtrer les conversations"
          value={activeTab}
          onChange={(id) => {
            haptic('light');
            setActiveTab(id as TabId);
          }}
          options={TABS.map((t) => ({
            id: t.id,
            label: t.label,
            badge:
              t.id === 'requests' && pendingRequestsCount > 0 ? (
                <span className="ml-[var(--space-1)] flex size-[18px] min-w-[18px] items-center justify-center rounded-full bg-[color:var(--lkv-warning)] px-1.5 font-mono text-[length:var(--lkv-text-caption-2)] font-bold text-[color:var(--lkv-text-inverted)]">
                  {pendingRequestsCount}
                </span>
              ) : undefined,
          }))}
        />
      </div>
    </Card>
  );
};
