"use client";

import React, { useState, useMemo } from 'react';
import type { Conversation } from '../types/messaging.types';
import { ConversationRow } from './ConversationRow';
import { Plus, Search, MessageSquare } from 'lucide-react';

interface ConversationListProps {
  conversations: Conversation[];
  selectedId: string | null;
  onSelect: (conv: Conversation) => void;
  onNewConversation: () => void;
  loading: boolean;
}

export const ConversationList: React.FC<ConversationListProps> = ({
  conversations,
  selectedId,
  onSelect,
  onNewConversation,
  loading,
}) => {
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'direct' | 'group' | 'requests'>('all');

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

      if (!search.trim()) return true;
      const query = search.toLowerCase();
      const titleMatch = c.title?.toLowerCase().includes(query);
      const memberMatch = c.other_member?.full_name.toLowerCase().includes(query);
      const lastMsgMatch = c.last_message?.content.toLowerCase().includes(query);

      return titleMatch || memberMatch || lastMsgMatch;
    });
  }, [conversations, activeTab, search]);

  return (
    <div className="flex flex-col h-full bg-white/40 backdrop-blur-xl border border-white/60 rounded-3xl p-4 shadow-sm">
      <div className="flex items-center justify-between pb-3 border-b border-stone-200/50">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-stone-900">Messages</h2>
          <p className="text-xs text-stone-500 font-medium">Discussions & Expéditions LKDV</p>
        </div>
        <button
          onClick={onNewConversation}
          className="p-2.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white transition-transform active:scale-95 shadow-md flex items-center justify-center"
          title="Nouvelle conversation"
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>

      <div className="mt-3 relative">
        <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher un voyageur, groupe..."
          className="w-full pl-9 pr-4 py-2 text-xs rounded-xl bg-white/70 backdrop-blur-md border border-stone-200/60 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 text-stone-800 placeholder-stone-400 font-medium"
        />
      </div>

      <div className="flex items-center gap-1 mt-3 p-1 rounded-xl bg-stone-100/80 border border-stone-200/40 text-[11px]">
        <button
          onClick={() => setActiveTab('all')}
          className={`flex-1 py-1.5 font-semibold rounded-lg transition-all ${
            activeTab === 'all'
              ? 'bg-white text-stone-900 shadow-xs'
              : 'text-stone-500 hover:text-stone-800'
          }`}
        >
          Toutes
        </button>
        <button
          onClick={() => setActiveTab('direct')}
          className={`flex-1 py-1.5 font-semibold rounded-lg transition-all ${
            activeTab === 'direct'
              ? 'bg-white text-stone-900 shadow-xs'
              : 'text-stone-500 hover:text-stone-800'
          }`}
        >
          Directs
        </button>
        <button
          onClick={() => setActiveTab('group')}
          className={`flex-1 py-1.5 font-semibold rounded-lg transition-all ${
            activeTab === 'group'
              ? 'bg-white text-stone-900 shadow-xs'
              : 'text-stone-500 hover:text-stone-800'
          }`}
        >
          Groupes
        </button>
        <button
          onClick={() => setActiveTab('requests')}
          className={`flex-1 py-1.5 font-semibold rounded-lg transition-all relative ${
            activeTab === 'requests'
              ? 'bg-white text-stone-900 shadow-xs'
              : 'text-stone-500 hover:text-stone-800'
          }`}
        >
          Demandes
          {pendingRequestsCount > 0 && (
            <span className="ml-1 px-1.5 py-0.2 bg-amber-500 text-white rounded-full text-[9px] font-mono font-bold inline-block">
              {pendingRequestsCount}
            </span>
          )}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto mt-3 space-y-2 pr-1 custom-scrollbar">
        {loading ? (
          <div className="space-y-2 p-2">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-16 rounded-2xl bg-white/30 animate-pulse border border-white/40"
              />
            ))}
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className="text-center py-10 px-4">
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center mx-auto mb-3">
              <MessageSquare className="w-6 h-6" />
            </div>
            <p className="text-xs font-medium text-stone-500">
              {search
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
