'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export interface PlaybackState {
  playing: boolean;
  elapsedSec: number;
  progress: number;
  play: () => void;
  pause: () => void;
  toggle: () => void;
  seek: (seconds: number) => void;
  reset: () => void;
}

/**
 * Lecteur déterministe pour Flyover / Replay.
 * Une seule boucle requestAnimationFrame, annulée au démontage et à la pause.
 * Aucune animation de layout : la position est lue par les composants puis
 * rendue via transform/opacity.
 */
export function usePlayback(durationSec: number, autoPlay = false): PlaybackState {
  const safeDuration =
    Number.isFinite(durationSec) && durationSec > 0 ? durationSec : 0;
  const [playing, setPlaying] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const elapsedRef = useRef(0);
  const frameRef = useRef<number | null>(null);
  const lastTimestampRef = useRef<number | null>(null);

  useEffect(() => {
    elapsedRef.current = 0;
    setElapsedSec(0);
    setPlaying(false);
  }, [safeDuration]);

  useEffect(() => {
    if (!autoPlay || safeDuration <= 0) return;
    if (
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      return;
    }
    setPlaying(true);
  }, [autoPlay, safeDuration]);

  useEffect(() => {
    if (!playing || safeDuration <= 0) {
      lastTimestampRef.current = null;
      return;
    }

    const tick = (timestamp: number) => {
      if (lastTimestampRef.current === null) {
        lastTimestampRef.current = timestamp;
      }
      const deltaSec = Math.min(0.25, (timestamp - lastTimestampRef.current) / 1000);
      lastTimestampRef.current = timestamp;
      const next = Math.min(safeDuration, elapsedRef.current + deltaSec);
      elapsedRef.current = next;
      setElapsedSec(next);
      if (next >= safeDuration) {
        setPlaying(false);
        return;
      }
      frameRef.current = window.requestAnimationFrame(tick);
    };

    frameRef.current = window.requestAnimationFrame(tick);
    return () => {
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
      lastTimestampRef.current = null;
    };
  }, [playing, safeDuration]);

  const seek = useCallback(
    (seconds: number) => {
      const next = Math.min(safeDuration, Math.max(0, seconds));
      elapsedRef.current = next;
      setElapsedSec(next);
      if (next >= safeDuration && safeDuration > 0) {
        setPlaying(false);
      }
    },
    [safeDuration],
  );

  const play = useCallback(() => {
    if (safeDuration <= 0) return;
    if (elapsedRef.current >= safeDuration) {
      elapsedRef.current = 0;
      setElapsedSec(0);
    }
    setPlaying(true);
  }, [safeDuration]);

  const pause = useCallback(() => setPlaying(false), []);

  const toggle = useCallback(() => {
    setPlaying((current) => {
      if (!current && elapsedRef.current >= safeDuration) {
        elapsedRef.current = 0;
        setElapsedSec(0);
      }
      return !current;
    });
  }, [safeDuration]);

  const reset = useCallback(() => {
    setPlaying(false);
    elapsedRef.current = 0;
    setElapsedSec(0);
  }, []);

  return {
    playing,
    elapsedSec,
    progress: safeDuration > 0 ? Math.min(1, elapsedSec / safeDuration) : 0,
    play,
    pause,
    toggle,
    seek,
    reset,
  };
}
