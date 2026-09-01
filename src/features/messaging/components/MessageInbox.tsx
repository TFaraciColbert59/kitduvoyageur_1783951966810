"use client";

import React, { useState } from 'react';
import type { UserProfileSummary } from '../types/messaging.types';
import { useConversations } from '../hooks/useConversations';
import { ConversationList } from './ConversationList';
import { ConversationView } from './ConversationView';
import { NewConversationModal } from './NewConversationModal';
import { Send, Plus } from 'lucide-react';
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
  const { conversations, loading, refreshConversations } = useConversations(currentUserId);
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleSelectConversation = (convId: string | null) => {
    setSelectedConvId(convId);
    if (onActiveConversationChange) {
      onActiveConversationChange(convId !== null);
    }
  };

  const selectedConversation = conversations.find((c) => c.id === selectedConvId) || null;

  const handleConversationCreated = async (convId: string) => {
    await refreshConversations();
    handleSelectConversation(convId);
  };

  return (
    <div className="w-full h-full md:h-[740px] md:max-h-[calc(100vh-140px)] md:min-h-[500px] max-w-7xl mx-auto flex flex-col items-stretch justify-center p-0 md:p-2 overflow-hidden relative">
      {/* Layout Mobile (< md) avec transition par glissement (slide) GPU-safe */}
      <div className="flex md:hidden w-full h-full relative overflow-hidden">
        {/* Vue Liste Mobile */}
        <div
          className={`w-full h-full shrink-0 transition-transform duration-300 ease-out ${
            selectedConvId ? '-translate-x-full absolute inset-0 pointer-events-none' : 'translate-x-0'
          }`}
        >
          <ConversationList
            conversations={conversations}
            selectedId={selectedConvId}
            onSelect={(c) => handleSelectConversation(c.id)}
            onNewConversation={() => setIsModalOpen(true)}
            loading={loading}
          />
        </div>

        {/* Vue Conversation Mobile */}
        <div
          className={`w-full h-full shrink-0 transition-transform duration-300 ease-out ${
            selectedConvId ? 'translate-x-0' : 'translate-x-full absolute inset-0 pointer-events-none'
          }`}
        >
          {selectedConversation && (
            <ConversationView
              conversation={selectedConversation}
              currentUserId={currentUserId}
              currentUserProfile={currentUserProfile}
              onBack={() => {
                haptic('light');
                handleSelectConversation(null);
              }}
              onRefreshConversations={refreshConversations}
            />
          )}
        </div>
      </div>

      {/* Layout Desktop (≥ md) Double Colonne (Dual-Pane) */}
      <div className="hidden md:flex w-full h-full gap-4 items-stretch justify-center overflow-hidden">
        {/* Colonne Liste des Conversations (Taille fixe) */}
        <div className="w-80 lg:w-96 shrink-0 h-full overflow-hidden">
          <ConversationList
            conversations={conversations}
            selectedId={selectedConvId}
            onSelect={(c) => setSelectedConvId(c.id)}
            onNewConversation={() => setIsModalOpen(true)}
            loading={loading}
          />
        </div>

        {/* Colonne Vue Principale du Chat */}
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
              <h3 className="text-xl font-bold text-[#17402C]">Vos Messages</h3>
              <p className="text-xs md:text-sm text-[#5A574E] max-w-md mt-2 leading-relaxed">
                Sélectionnez une conversation ou lancez une nouvelle discussion avec un membre de la communauté LKDV.
              </p>
              <button
                onClick={() => {
                  haptic('light');
                  setIsModalOpen(true);
                }}
                className="glass-capsule-btn primary mt-6 px-6 py-3 text-xs font-semibold shadow-md active:scale-95 flex items-center gap-2 min-h-[44px]"
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
    </div>
  );
};
