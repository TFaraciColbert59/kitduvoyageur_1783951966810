"use client";

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';
import { messagingService } from '../services/messagingService';
import { Search } from 'lucide-react';
import { MobileSheet } from './MobileSheet';

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
            avatar_url: u.avatar_url || '/assets/images/no_image.png',
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
    <MobileSheet isOpen={isOpen} onClose={onClose} title="Nouvelle Discussion">
      <div className="relative">
        <Search className="w-4 h-4 text-[#5A574E] absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="search"
          inputMode="search"
          enterKeyHint="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher par nom..."
          aria-label="Rechercher un voyageur"
          className="w-full py-2.5 text-[16px] glass-input font-medium"
          style={{ minHeight: 44, paddingLeft: 38, paddingRight: 14 }}
        />
      </div>

      <div className="space-y-2 mt-4">
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-14 bg-stone-100/80 rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : travelers.length === 0 ? (
          <p className="text-[15px] text-center text-[#5A574E] py-8">
            Aucun voyageur trouvé.
          </p>
        ) : (
          travelers.map((traveler) => (
            <button
              key={traveler.id}
              disabled={starting}
              onClick={() => handleStartConversation(traveler.id)}
              className="w-full text-left p-3.5 rounded-2xl bg-white/70 hover:bg-[#17402C]/10 border border-stone-200/60 hover:border-[#17402C]/30 transition-all flex items-center gap-3 group active:scale-[0.98] min-h-[60px]"
            >
              <div className="w-10 h-10 rounded-full overflow-hidden relative ring-1 ring-white/80 shrink-0">
                <Image
                  src={traveler.avatar_url}
                  alt={traveler.full_name}
                  fill
                  className="object-cover"
                  sizes="40px"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = '/assets/images/no_image.png';
                  }}
                />
              </div>
              <div className="flex-1 overflow-hidden">
                <p className="font-semibold text-[15px] text-[#17402C] group-hover:font-bold truncate">
                  {traveler.full_name}
                </p>
                <p className="text-[13px] text-[#5A574E] truncate">
                  {traveler.username ? `@${traveler.username}` : 'Membre LKDV'}
                </p>
              </div>
            </button>
          ))
        )}
      </div>
    </MobileSheet>
  );
};