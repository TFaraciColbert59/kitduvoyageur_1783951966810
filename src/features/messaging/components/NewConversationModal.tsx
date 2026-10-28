'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';
import { PUBLIC_PROFILES_VIEW } from '@/lib/queries/publicProfilesCore';
import { AccountDrawerHost } from '@/design/account/AccountDrawerHost';
import { messagingService } from '../services/messagingService';

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

/** Défilement interne de l'annuaire : `.sh-b` ne défile pas. */
const SCROLL = {
  flex: '1 1 auto',
  minHeight: 0,
  overflowY: 'auto',
  overscrollBehavior: 'contain',
} as const;

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
        // A-064 : écarter les blocages (dans un sens ou l'autre) de l'annuaire.
        const [{ data: blockedByMe }, { data: blockedMe }] = await Promise.all([
          supabase.from('user_blocks').select('blocked_id').eq('blocker_id', currentUserId),
          supabase.from('user_blocks').select('blocker_id').eq('blocked_id', currentUserId),
        ]);
        const blockedIds = new Set<string>([
          ...(blockedByMe ?? []).map((row) => (row as { blocked_id: string }).blocked_id),
          ...(blockedMe ?? []).map((row) => (row as { blocker_id: string }).blocker_id),
        ]);

        setTravelers(
          data
            .filter((u) => !blockedIds.has(u.id))
            .map((u) => ({
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
    <AccountDrawerHost
      open={isOpen}
      title="Nouvelle discussion"
      subtitle="Annuaire des voyageurs"
      onClose={onClose}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <input
          className="mfield"
          style={{ borderRadius: 12, minHeight: 36 }}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher par nom…"
          aria-label="Rechercher un voyageur"
          inputMode="search"
          enterKeyHint="search"
        />
        {search ? (
          <button type="button" className="mbtn" onClick={() => setSearch('')}>
            Effacer
          </button>
        ) : null}
      </div>

      {loading ? (
        <div className="s2" style={{ padding: '10px 2px' }}>
          Chargement de l’annuaire…
        </div>
      ) : travelers.length === 0 ? (
        <div className="li nt">
          <div>
            <div className="ttl">Aucun voyageur trouvé</div>
            <div className="s2">Essayez un autre nom ou une autre orthographe.</div>
          </div>
          <button
            type="button"
            className="mbtn"
            onClick={() => (search ? setSearch('') : onClose())}
          >
            {search ? 'Effacer' : 'Fermer'}
          </button>
        </div>
      ) : (
        <div style={SCROLL}>
          {travelers.map((traveler) => (
            <div className="li" key={traveler.id}>
              <span className="avi" style={{ overflow: 'hidden' }}>
                <Image
                  src={traveler.avatar_url}
                  alt={traveler.full_name}
                  fill
                  sizes="30px"
                  style={{ objectFit: 'cover' }}
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = '/assets/images/no_image.png';
                  }}
                />
              </span>
              <div>
                <div className="ttl">
                  <span>{traveler.full_name}</span>
                </div>
                <div className="s2">
                  {traveler.username ? `@${traveler.username}` : 'Membre LKDV'}
                </div>
              </div>
              <button
                type="button"
                className="mbtn p"
                disabled={starting}
                onClick={() => handleStartConversation(traveler.id)}
              >
                Écrire
              </button>
            </div>
          ))}
        </div>
      )}
    </AccountDrawerHost>
  );
};
