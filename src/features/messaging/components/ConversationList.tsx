"use client";

import React, { useState, useMemo, useEffect } from 'react';
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

export const ConversationListSkeleton = () => (
  <div className="space-y-2 p-1 animate-pulse" aria-busy="true" aria-label="Chargement des conversations">
    {[1, 2, 3, 4, 5].map((i) => (
      <div
        key={i}
        className="w-full h-[76px] p-3.5 rounded-2xl bg-white/40 border border-white/60 flex items-center gap-3.5"
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
  const [activeTab, setActiveTab] = useState<'all' | 'direct' | 'group' | 'requests'>('all');

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 150);
    return () => clearTimeout(timer);
  }, [search]);

  const pendingRequestsCount = useMemo(() => {
    return conversations.filter((c) => c.status === 'pending').length;
  }, [conversations]);

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
      const query = debouncedSearch.toLowerCase();
      const titleMatch = c.title?.toLowerCase().includes(query);
      const memberMatch = c.other_member?.full_name.toLowerCase().includes(query);
      const lastMsgMatch = c.last_message?.content.toLowerCase().includes(query);

      return titleMatch || memberMatch || lastMsgMatch;
    });
  }, [conversations, activeTab, debouncedSearch]);

  return (
    <div className="flex flex-col h-full glass rounded-none md:rounded-3xl p-3 md:p-4 pt-[calc(env(safe-area-inset-top,0px)+12px)] md:pt-4 overflow-hidden">
      <div className="flex items-center justify-between pb-3 border-b border-stone-200/60">
        <div>
          <h2 className="text-xl md:text-2xl font-bold tracking-tight text-[#17402C]">Messages</h2>
          <p className="text-xs text-[#5A574E] font-medium">Discussions & Expéditions LKDV</p>
        </div>
        <button
          onClick={() => {
            haptic('light');
            onNewConversation();
          }}
          className="glass-circle-btn primary w-10 h-10 shadow-md active:scale-95 flex items-center justify-center shrink-0"
          title="Nouvelle conversation"
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>

      <div className="mt-3 relative">
        <Search className="w-4 h-4 text-[#5A574E] absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher un voyageur, groupe..."
          className="w-full pl-9 pr-9 py-2.5 text-[16px] md:text-xs glass-input font-medium transition-colors"
        />
        {search && (
          <button
            onClick={() => {
              haptic('light');
              setSearch('');
              setDebouncedSearch('');
            }}
            className="glass-circle-btn absolute right-2.5 top-1/2 -translate-y-1/2 w-6 h-6 text-[#5A574E] hover:text-[#17402C]"
            title="Effacer la recherche"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>

      <div className="flex items-center gap-1 mt-3 p-1 rounded-2xl bg-stone-100/90 border border-stone-200/60 text-[11px]">
        <button
          onClick={() => {
            haptic('light');
            setActiveTab('all');
          }}
          className={`flex-1 py-1.5 font-bold rounded-xl transition-all min-h-[34px] ${
            activeTab === 'all'
              ? 'bg-white text-[#17402C] shadow-xs border border-white/80'
              : 'text-[#5A574E] hover:text-[#17402C]'
          }`}
        >
          Toutes
        </button>
        <button
          onClick={() => {
            haptic('light');
            setActiveTab('direct');
          }}
          className={`flex-1 py-1.5 font-bold rounded-xl transition-all min-h-[34px] ${
            activeTab === 'direct'
              ? 'bg-white text-[#17402C] shadow-xs border border-white/80'
              : 'text-[#5A574E] hover:text-[#17402C]'
          }`}
        >
          Directs
        </button>
        <button
          onClick={() => {
            haptic('light');
            setActiveTab('group');
          }}
          className={`flex-1 py-1.5 font-bold rounded-xl transition-all min-h-[34px] ${
            activeTab === 'group'
              ? 'bg-white text-[#17402C] shadow-xs border border-white/80'
              : 'text-[#5A574E] hover:text-[#17402C]'
          }`}
        >
          Groupes
        </button>
        <button
          onClick={() => {
            haptic('light');
            setActiveTab('requests');
          }}
          className={`flex-1 py-1.5 font-bold rounded-xl transition-all min-h-[34px] relative ${
            activeTab === 'requests'
              ? 'bg-white text-[#17402C] shadow-xs border border-white/80'
              : 'text-[#5A574E] hover:text-[#17402C]'
          }`}
        >
          Demandes
          {pendingRequestsCount > 0 && (
            <span className="ml-1 px-1.5 py-0.2 bg-[#C89A3B] text-white rounded-full text-[9px] font-mono font-bold inline-block shadow-2xs">
              {pendingRequestsCount}
            </span>
          )}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto mt-3 space-y-2 pr-1 custom-scrollbar">
        {loading ? (
          <ConversationListSkeleton />
        ) : filteredConversations.length === 0 ? (
          <div className="text-center py-10 px-4">
            <div className="w-12 h-12 rounded-full bg-[#17402C]/10 text-[#17402C] flex items-center justify-center mx-auto mb-3">
              <MessageSquare className="w-6 h-6" />
            </div>
            <p className="text-xs font-medium text-[#5A574E]">
              {debouncedSearch
                ? 'Aucune conversation ne correspond à votre recherche.'
                : activeTab === 'requests'
                ? 'Aucune demande de message en attente.'
                : 'Aucune discussion en cours.'}
            </p>
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
    </div>
  );
};
