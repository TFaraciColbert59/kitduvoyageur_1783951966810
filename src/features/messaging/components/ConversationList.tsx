"use client";

import React, { useState, useMemo, useEffect } from 'react';
import type { Conversation } from '../types/messaging.types';
import { ConversationRow, type SwipeAction } from './ConversationRow';
import { ConversationOptionsSheet } from './ConversationOptionsSheet';
import { messagingService } from '../services/messagingService';
import { Plus, Search, MessageSquare, X } from 'lucide-react';
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
  <div className="space-y-2 p-1 animate-pulse" aria-busy="true" aria-label="Chargement des conversations">
    {[1, 2, 3, 4, 5].map((i) => (
      <div
        key={i}
        className="w-full min-h-[76px] p-3.5 rounded-2xl bg-white/40 border border-white/60 flex items-center gap-3.5"
      >
        <div className="w-12 h-12 rounded-full bg-stone-200/70 shrink-0" />
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="h-3.5 bg-stone-200/80 rounded-md w-28" />
            <div className="h-2.5 bg-stone-200/60 rounded-md w-10" />
          </div>
          <div className="h-3 bg-stone-200/60 rounded-md w-44" />
        </div>
      </div>
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
    <div className="flex flex-col h-full w-full glass rounded-none md:rounded-3xl overflow-hidden relative">
      {/* Chrome haut — recherche + bouton « + » unique (gère le safe-area top) */}
      <div className="msg-safe-top shrink-0 px-3 md:px-4 pb-3 border-b border-stone-200/60 bg-white/70 backdrop-blur-2xl">
        <div className="flex items-center gap-2">
          <div className="relative flex-1 min-w-0">
            <Search className="w-4 h-4 text-[#5A574E] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              inputMode="search"
              enterKeyHint="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher un voyageur, un groupe…"
              aria-label="Rechercher une conversation"
              className="w-full text-[16px] glass-input font-medium"
              style={{
                minHeight: 44,
                borderRadius: 14,
                // Le padding Tailwind est écrasé par .glass-input (10px 14px) :
                // on force les marges inline pour dégager l'icône et le clear.
                paddingLeft: 38,
                paddingRight: 44,
              }}
            />
            {search && (
              <button
                type="button"
                onClick={() => {
                  haptic('light');
                  setSearch('');
                  setDebouncedSearch('');
                }}
                aria-label="Effacer la recherche"
                className="absolute right-1 top-1/2 -translate-y-1/2 w-11 h-11 flex items-center justify-center text-[#5A574E]"
              >
                <span className="glass-circle-btn w-7 h-7 flex items-center justify-center shadow-2xs">
                  <X className="w-3.5 h-3.5" />
                </span>
              </button>
            )}
          </div>

          {/* Bouton « + » unique — verre givré, comme les autres boutons ronds du site */}
          <button
            type="button"
            onClick={() => {
              haptic('medium');
              onNewConversation();
            }}
            aria-label="Nouvelle discussion"
            className="glass-circle-btn w-11 h-11 shadow-md active:scale-95 flex items-center justify-center shrink-0"
            title="Nouvelle discussion"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Liste */}
      <div
        className="flex-1 overflow-y-auto overscroll-contain px-3 md:px-4 pt-3 space-y-2 custom-scrollbar"
        style={{ WebkitOverflowScrolling: 'touch', paddingBottom: 12 }}
      >
        {loading ? (
          <ConversationListSkeleton />
        ) : filteredConversations.length === 0 ? (
          <div className="text-center py-12 px-6">
            <div className="w-14 h-14 rounded-full bg-[#17402C]/10 text-[#17402C] flex items-center justify-center mx-auto mb-3">
              <MessageSquare className="w-7 h-7" />
            </div>
            <p className="text-sm font-semibold text-[#17402C]">
              {debouncedSearch
                ? 'Aucun résultat'
                : activeTab === 'requests'
                ? 'Aucune demande en attente'
                : 'Aucune discussion'}
            </p>
            <p className="text-[13px] text-[#5A574E] mt-1 leading-relaxed max-w-[240px] mx-auto">
              {debouncedSearch
                ? 'Essayez un autre nom de voyageur ou de groupe.'
                : activeTab === 'requests'
                ? 'Les nouvelles demandes de message apparaîtront ici.'
                : 'Lancez une discussion avec un membre de la communauté.'}
            </p>
          </div>
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
      <div className="hidden md:block shrink-0 px-3 md:px-4 pt-2 pb-3 mt-1 border-t border-stone-200/60 bg-white/40 backdrop-blur-2xl">
        <div
          role="tablist"
          aria-label="Filtrer les conversations"
          className="glass-capsule-bar w-full justify-between gap-1"
        >
          {TABS.map((t) => {
            const isActive = activeTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => {
                  haptic('light');
                  setActiveTab(t.id);
                }}
                className={`glass-capsule-segment flex-1 !min-w-0 min-h-[36px] !px-1.5 text-[13px] flex items-center justify-center gap-1 ${
                  isActive ? 'active' : ''
                }`}
              >
                <span className="truncate">{t.label}</span>
                {t.id === 'requests' && pendingRequestsCount > 0 && (
                  <span className="px-1.5 min-w-[18px] h-[18px] bg-[#C89A3B] text-white rounded-full text-[10px] font-mono font-bold flex items-center justify-center">
                    {pendingRequestsCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};