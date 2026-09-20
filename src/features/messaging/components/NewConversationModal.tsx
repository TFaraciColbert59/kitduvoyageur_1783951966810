'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';
import { PUBLIC_PROFILES_VIEW } from '@/lib/queries/publicProfilesCore';
import { EmptyState, ListItem, SearchField, Skeleton } from '@/components/ui';
import { messagingService } from '../services/messagingService';
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
      // F1 — annuaire via la vue publique (username absent de la projection).
      let query = supabase
        .from(PUBLIC_PROFILES_VIEW)
        .select('id, full_name, avatar_url')
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
            username: undefined,
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
      <SearchField
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        onClear={() => setSearch('')}
        placeholder="Rechercher par nom..."
        aria-label="Rechercher un voyageur"
        inputMode="search"
        enterKeyHint="search"
      />

      <div className="mt-[var(--space-4)] space-y-[var(--space-2)]">
        {loading ? (
          <div className="space-y-[var(--space-2)]">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-14 w-full rounded-[var(--lkv-radius-md)]" />
            ))}
          </div>
        ) : travelers.length === 0 ? (
          <EmptyState
            compact
            title="Aucun voyageur trouvé"
            description="Essayez un autre nom ou une autre orthographe."
          />
        ) : (
          travelers.map((traveler) => (
            <ListItem
              key={traveler.id}
              as="div"
              disabled={starting}
              onClick={() => handleStartConversation(traveler.id)}
              className="min-h-[60px]"
              leading={
                <span className="relative size-10 shrink-0 overflow-hidden rounded-full ring-1 ring-[color:var(--glass-border)]">
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
                </span>
              }
              title={traveler.full_name}
              subtitle={traveler.username ? `@${traveler.username}` : 'Membre LKDV'}
            />
          ))
        )}
      </div>
    </MobileSheet>
  );
};
