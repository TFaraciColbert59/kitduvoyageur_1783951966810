'use client';

/**
 * G01 — préférences de fil persistées localement (S6.28).
 *
 * Le hook ne fait aucune requête : les préférences sont un confort d'affichage
 * local. La visibilité réelle reste tenue par la RLS et la politique G01. Un
 * stockage inaccessible (navigation privée, quota) ne casse pas le fil.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  defaultFeedPreferences,
  feedPreferencesStorageKey,
  mergeFeedPreferences,
  readFeedPreferences,
  serializeFeedPreferences,
  type FeedPreferences,
  type FeedPreferencesPatch,
} from './feedPreferences';

function persist(key: string, preferences: FeedPreferences): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, serializeFeedPreferences(preferences));
  } catch {
    // quota / navigation privée : la préférence reste en mémoire pour la session.
  }
}

export interface UseFeedPreferencesResult {
  preferences: FeedPreferences;
  ready: boolean;
  update: (patch: FeedPreferencesPatch) => void;
  reset: () => void;
}

export function useFeedPreferences(userId?: string | null): UseFeedPreferencesResult {
  const key = feedPreferencesStorageKey(userId);
  const [preferences, setPreferences] = useState<FeedPreferences>(() => defaultFeedPreferences());
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setPreferences(readFeedPreferences(window.localStorage.getItem(key)));
    setReady(true);

    const onStorage = (event: StorageEvent) => {
      if (event.key !== key) return;
      setPreferences(readFeedPreferences(event.newValue));
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [key]);

  const update = useCallback(
    (patch: FeedPreferencesPatch) => {
      setPreferences((current) => {
        const next = mergeFeedPreferences(current, patch);
        persist(key, next);
        return next;
      });
    },
    [key]
  );

  const reset = useCallback(() => {
    const next = defaultFeedPreferences();
    setPreferences(next);
    persist(key, next);
  }, [key]);

  return { preferences, ready, update, reset };
}
