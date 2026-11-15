'use client';

/**
 * G01 — état de lecture vidéo d'une carte (S6.28).
 *
 * Le hook ne décide pas seul : il rassemble les faits (onglet actif, mouvement
 * réduit, économie de données) et délègue à `resolveVideoPlayback`. Le composant
 * ne démarre jamais la vidéo sans que la décision `shouldPlay` soit vraie.
 */

import { useCallback, useEffect, useState } from 'react';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import {
  resolveVideoPlayback,
  type VideoPlaybackDecision,
  type VideoPreferences,
} from './videoPlayback';

interface NetworkInformationLike {
  saveData?: boolean;
  effectiveType?: string;
}

interface NavigatorWithConnection extends Navigator {
  connection?: NetworkInformationLike;
}

export interface UseVideoPlaybackInput {
  preferences: VideoPreferences | unknown;
  audienceAllowed: boolean;
  visibleFraction: number;
}

export interface UseVideoPlaybackResult {
  decision: VideoPlaybackDecision;
  userInitiated: boolean;
  requestPlay: () => void;
  requestPause: () => void;
}

export function useVideoPlayback(input: UseVideoPlaybackInput): UseVideoPlaybackResult {
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const [documentVisible, setDocumentVisible] = useState(true);
  const [userInitiated, setUserInitiated] = useState(false);
  const [network, setNetwork] = useState<{ saveData: boolean; effectiveType: string | null }>({
    saveData: false,
    effectiveType: null,
  });

  useEffect(() => {
    const syncVisibility = () => setDocumentVisible(!document.hidden);
    syncVisibility();
    document.addEventListener('visibilitychange', syncVisibility);
    return () => document.removeEventListener('visibilitychange', syncVisibility);
  }, []);

  useEffect(() => {
    if (typeof navigator === 'undefined') return;
    const connection = (navigator as NavigatorWithConnection).connection;
    setNetwork({
      saveData: connection?.saveData === true,
      effectiveType:
        typeof connection?.effectiveType === 'string' ? connection.effectiveType : null,
    });
  }, []);

  const decision = resolveVideoPlayback({
    preferences: input.preferences,
    audienceAllowed: input.audienceAllowed,
    visibleFraction: input.visibleFraction,
    reducedMotion,
    saveData: network.saveData,
    connectionType: network.effectiveType,
    documentVisible,
    userInitiated,
  });

  const requestPlay = useCallback(() => setUserInitiated(true), []);
  const requestPause = useCallback(() => setUserInitiated(false), []);

  return {
    decision,
    userInitiated,
    requestPlay,
    requestPause,
  };
}
