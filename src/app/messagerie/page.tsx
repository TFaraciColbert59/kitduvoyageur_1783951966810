"use client";

import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { MessagesScreen } from '@/components/messaging/MessagesScreen';
import { useKeyboardInset } from '@/features/messaging/hooks/useKeyboardInset';

/**
 * `/messagerie` — écran de la grammaire Compte.
 *
 * Le shell, la carte, la zone basse et la barre basse viennent de
 * `MessagesScreen` (verre Liquid Glass v8). La page ne porte que l'état
 * d'authentification et l'encart clavier.
 */
export default function MessageriePage() {
  const { user, profile, loading } = useAuth();
  const keyboardInset = useKeyboardInset();

  return (
    <div style={{ ['--kb-inset' as string]: `${keyboardInset}px` }}>
      {loading ? (
        <div
          aria-busy="true"
          aria-label="Chargement de la messagerie"
          style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center' }}
        >
          Chargement de la messagerie…
        </div>
      ) : (
        <MessagesScreen
          currentUserId={user?.id ?? null}
          currentUserProfile={
            profile
              ? {
                  id: profile.id,
                  full_name: profile.full_name,
                  avatar_url: profile.avatar_url,
                  username: profile.username,
                }
              : null
          }
        />
      )}
    </div>
  );
}
