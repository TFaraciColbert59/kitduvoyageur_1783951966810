"use client";

import React, { useState } from 'react';
import type { UserProfileSummary } from '../types/messaging.types';
import { useConversations } from '../hooks/useConversations';
import { ConversationList } from './ConversationList';
import { ConversationView } from './ConversationView';
import { NewConversationModal } from './NewConversationModal';
import { Send, Plus } from 'lucide-react';

interface MessageInboxProps {
  currentUserId: string;
  currentUserProfile?: UserProfileSummary | null;
}

export const MessageInbox: React.FC<MessageInboxProps> = ({
  currentUserId,
  currentUserProfile,
}) => {
  const { conversations, loading, refreshConversations } = useConversations(currentUserId);
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const selectedConversation = conversations.find((c) => c.id === selectedConvId) || null;

  const handleConversationCreated = async (convId: string) => {
    await refreshConversations();
    setSelectedConvId(convId);
  };

  return (
    <div className="w-full h-[740px] max-h-[calc(100vh-140px)] min-h-[500px] max-w-7xl mx-auto flex gap-4 items-center justify-center p-1 md:p-2 overflow-hidden">
      {/* Colonne Liste des Conversations (Taille fixe) */}
      <div
        className={`w-full md:w-80 lg:w-96 shrink-0 h-full overflow-hidden ${
          selectedConvId ? 'hidden md:block' : 'block'
        }`}
      >
        <ConversationList
          conversations={conversations}
          selectedId={selectedConvId}
          onSelect={(c) => setSelectedConvId(c.id)}
          onNewConversation={() => setIsModalOpen(true)}
          loading={loading}
        />
      </div>

      {/* Colonne Vue Principale du Chat (Taille fixe) */}
      <div
        className={`flex-1 h-full overflow-hidden ${
          !selectedConvId ? 'hidden md:flex' : 'flex'
        }`}
      >
        {selectedConversation ? (
          <ConversationView
            conversation={selectedConversation}
            currentUserId={currentUserId}
            currentUserProfile={currentUserProfile}
            onBack={() => setSelectedConvId(null)}
            onRefreshConversations={refreshConversations}
          />
        ) : (
          <div className="w-full h-full bg-white/40 backdrop-blur-2xl border border-white/60 rounded-3xl flex flex-col items-center justify-center text-center p-8 shadow-xs">
            <div className="w-20 h-20 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center mb-4">
              <Send className="w-10 h-10" />
            </div>
            <h3 className="text-xl font-bold text-stone-900">Vos Messages</h3>
            <p className="text-xs md:text-sm text-stone-500 max-w-md mt-2 leading-relaxed">
              Sélectionnez une conversation ou lancez une nouvelle discussion avec un membre de la communauté LKDV.
            </p>
            <button
              onClick={() => setIsModalOpen(true)}
              className="mt-6 px-5 py-2.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-md hover:shadow-lg transition-all active:scale-95 flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Nouvelle discussion
            </button>
          </div>
        )}
      </div>

      <NewConversationModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        currentUserId={currentUserId}
        onConversationCreated={handleConversationCreated}
      />
    </div>
  );
};
