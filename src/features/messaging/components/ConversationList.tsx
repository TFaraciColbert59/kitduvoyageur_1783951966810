"use client";

import React, { useState, useMemo, useEffect, useRef } from 'react';
import type { Conversation } from '../types/messaging.types';
import { ConversationRow } from './ConversationRow';
import { Plus, Search, MessageSquare, X } from 'lucide-react';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';

interface ConversationListProps {
  conversations: Conversation[];
  selectedId: string | null;
  onSelect: (conv: Conversation) => void;
  onNewConversation: () => void;
  loading: boolean;
}

const TABS = [
  { id: 'all', label: 'Toutes' },
  { id: 'direct', label: 'Directs' },
  { id: 'group', label: 'Groupes' },
  { id: 'requests', label: 'Demandes' },
] as const;

type TabId = (typeof TABS)[number]['id'];

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
  loading,
}) => {
  const { haptic } = useHapticFeedback();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [activeTab, setActiveTab] = useState<TabId>('all');
  const [condensed, setCondensed] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 150);
    return () => clearTimeout(t);
  }, [search]);

  // Header repliable : hystérésis pour éviter le clignotement.
  const handleScroll = () => {
    const y = scrollRef.current?.scrollTop ?? 0;
    setCondensed((c) => (c ? y > 12 : y > 48));
  };

  const pendingRequestsCount = useMemo(
    () => conversations.filter((c) => c.status === 'pending').length,
    [conversations]
  );

  const filteredConversations = useMemo(() => {
    return conversations.filter((c) => {
      // Requests tab
      if (activeTab === 'requests') {
        if (c.status !== 'pending') return false;
      } else {
        // Exclude pending/rejected from standard tabs
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
      {/* Chrome sticky — gère env(safe-area-inset-top) pour toute la vue liste */}
      <div className="msg-safe-top shrink-0 px-3 md:px-4 pb-3 border-b border-stone-200/60 bg-white/70 backdrop-blur-2xl">
        <div
          className="flex items-end justify-between overflow-hidden transition-[max-height,opacity] duration-200 ease-out"
          style={{
            maxHeight: condensed ? 0 : 64,
            opacity: condensed ? 0 : 1,
            marginBottom: condensed ? 0 : 12,
          }}
        >
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-[#17402C] leading-tight">
              Messages
            </h2>
            <p className="text-[13px] text-[#5A574E] font-medium">
              Discussions &amp; expéditions LKDV
            </p>
          </div>
        </div>

        <div className="relative">
          <Search className="w-4 h-4 text-[#5A574E] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            inputMode="search"
            enterKeyHint="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un voyageur, un groupe…"
            aria-label="Rechercher une conversation"
            className="w-full pl-9 pr-12 text-[16px] glass-input font-medium"
            style={{ minHeight: 44 }}
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

        {/* Segmented control — 44px de cible, libellés lisibles */}
        <div
          role="tablist"
          aria-label="Filtrer les conversations"
          className="flex items-center gap-1 mt-3 p-1 rounded-2xl bg-stone-100/90 border border-stone-200/60"
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
                className={`flex-1 min-h-[44px] px-1 rounded-xl text-[13px] font-semibold transition-all flex items-center justify-center gap-1 ${
                  isActive
                    ? 'bg-white text-[#17402C] shadow-xs border border-white/80'
                    : 'text-[#5A574E]'
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

      {/* Liste */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto overscroll-contain px-3 md:px-4 pt-3 space-y-2 custom-scrollbar"
        style={{ WebkitOverflowScrolling: 'touch', paddingBottom: 96 }}
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
            {!debouncedSearch && activeTab !== 'requests' && (
              <button
                type="button"
                onClick={() => {
                  haptic('light');
                  onNewConversation();
                }}
                className="glass-capsule-btn primary mt-5 px-5 min-h-[44px] text-[13px] font-bold"
              >
                Nouvelle discussion
              </button>
            )}
          </div>
        ) : (
          filteredConversations.map((conv) => (
            <ConversationRow
              key={conv.id}
              conversation={conv}
              isSelected={conv.id === selectedId}
              onSelect={onSelect}
            />
          ))
        )}
      </div>

      {/* FAB — zone du pouce, au-dessus de la BottomTabBar */}
      <button
        type="button"
        onClick={() => {
          haptic('medium');
          onNewConversation();
        }}
        aria-label="Nouvelle discussion"
        className="md:hidden glass-circle-btn primary absolute right-4 w-14 h-14 shadow-lg z-20"
        style={{ bottom: 'calc(16px + env(safe-area-inset-bottom, 0px))' }}
      >
        <Plus className="w-6 h-6" />
      </button>

      {/* Desktop conserve le + en tête de colonne */}
      <button
        type="button"
        onClick={() => {
          haptic('light');
          onNewConversation();
        }}
        aria-label="Nouvelle discussion"
        className="hidden md:flex glass-circle-btn primary absolute top-4 right-4 w-11 h-11 shadow-md items-center justify-center"
      >
        <Plus className="w-5 h-5" />
      </button>
    </div>
  );
};