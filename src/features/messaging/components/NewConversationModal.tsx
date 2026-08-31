"use client";

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';
import { messagingService } from '../services/messagingService';
import { Search, X, ChevronRight } from 'lucide-react';

interface Traveler {
  id: string;
  full_name: string;
  avatar_url: string;
  username?: string;
}

interface NewConversationModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserId: string;
  onConversationCreated: (conversationId: string) => void;
}

export const NewConversationModal: React.FC<NewConversationModalProps> = ({
  isOpen,
  onClose,
  currentUserId,
  onConversationCreated,
}) => {
  const [search, setSearch] = useState('');
  const [travelers, setTravelers] = useState<Traveler[]>([]);
  const [loading, setLoading] = useState(false);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    const fetchTravelers = async () => {
      setLoading(true);
      const supabase = createClient();
      let query = supabase
        .from('user_profiles')
        .select('id, full_name, avatar_url, username')
        .neq('id', currentUserId)
        .limit(20);

      if (search.trim()) {
        query = query.ilike('full_name', `%${search.trim()}%`);
      }

      const { data, error } = await query;
      if (!error && data) {
        setTravelers(
          data.map((u) => ({
            id: u.id,
            full_name: u.full_name || 'Voyageur LKDV',
            avatar_url: u.avatar_url || '/images/default-avatar.png',
            username: u.username,
          }))
        );
      }
      setLoading(false);
    };

    const timer = setTimeout(() => {
      fetchTravelers();
    }, 300);

    return () => clearTimeout(timer);
  }, [isOpen, search, currentUserId]);

  if (!isOpen) return null;

  const handleStartConversation = async (targetUserId: string) => {
    setStarting(true);
    const convId = await messagingService.getOrCreateDirectConversation(
      targetUserId,
      currentUserId
    );
    setStarting(false);

    if (convId) {
      onConversationCreated(convId);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-stone-900/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white/90 backdrop-blur-2xl border border-white/80 rounded-3xl w-full max-w-md shadow-2xl p-5 flex flex-col max-h-[85vh] animate-in fade-in zoom-in duration-200">
        <div className="flex items-center justify-between pb-3 border-b border-stone-200/60">
          <h3 className="text-lg font-bold text-stone-900">Nouvelle Discussion</h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-stone-100 text-stone-400 hover:text-stone-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-4 relative">
          <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher par nom..."
            className="w-full pl-9 pr-4 py-2.5 text-sm rounded-xl bg-stone-100/80 border border-stone-200/60 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 text-stone-900 placeholder-stone-400 font-medium"
          />
        </div>

        <div className="flex-1 overflow-y-auto mt-4 space-y-2 pr-1 custom-scrollbar">
          {loading ? (
            <div className="space-y-2 p-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 bg-stone-100 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : travelers.length === 0 ? (
            <p className="text-xs text-center text-stone-500 py-8">
              Aucun voyageur trouvé.
            </p>
          ) : (
            travelers.map((traveler) => (
              <button
                key={traveler.id}
                disabled={starting}
                onClick={() => handleStartConversation(traveler.id)}
                className="w-full text-left p-3 rounded-2xl bg-white/50 hover:bg-emerald-500/10 border border-stone-200/50 hover:border-emerald-500/30 transition-all flex items-center gap-3 group"
              >
                <div className="w-10 h-10 rounded-full overflow-hidden relative ring-1 ring-white/80 shrink-0">
                  <Image
                    src={traveler.avatar_url}
                    alt={traveler.full_name}
                    fill
                    className="object-cover"
                    sizes="40px"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = '/images/default-avatar.png';
                    }}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-semibold text-stone-900 truncate group-hover:text-emerald-700">
                    {traveler.full_name}
                  </h4>
                  {traveler.username && (
                    <p className="text-xs text-stone-400 truncate">@{traveler.username}</p>
                  )}
                </div>
                <ChevronRight className="w-4 h-4 text-stone-400 group-hover:text-emerald-600 group-hover:translate-x-0.5 transition-all" />
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
