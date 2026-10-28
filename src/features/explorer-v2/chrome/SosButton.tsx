'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Bouton SOS (04_CARTE §4, 09_DESIGN §5).
 *
 * Maintien 1,5 s (anneau qui se remplit) → alerte armée → compte à rebours
 * de 5 s **annulable** → envoi. Aucun appel réel au 112 : le numéro local est
 * proposé après confirmation, et les tests restent en mode simulé.
 */
export interface SosButtonProps {
  /** Session d'activité en cours, si elle existe. */
  sessionId?: string | null;
  position?: { lat: number; lng: number } | null;
  onTick?: (second: number) => void;
  onArmed?: () => void;
  onSend: (payload: { lat: number; lng: number; sessionId: string | null }) => Promise<'sent' | 'queued' | 'unauthenticated'>;
  onResult?: (result: 'sent' | 'queued' | 'unauthenticated' | 'cancelled') => void;
  /** Mode recette : tout est simulé, aucun appel réseau. */
  simulate?: boolean;
}

const HOLD_MS = 1500;
const COUNTDOWN_S = 5;

export function SosButton({
  sessionId = null,
  position = null,
  onTick,
  onArmed,
  onSend,
  onResult,
  simulate = false,
}: SosButtonProps) {
  const [holding, setHolding] = useState(false);
  const [progress, setProgress] = useState(0);
  const [countdown, setCountdown] = useState<number | null>(null);
  const holdTimer = useRef<number | null>(null);
  const armTimer = useRef<number | null>(null);
  const startedAt = useRef(0);
  const armedAt = useRef(0);
  const countdownTimer = useRef<number | null>(null);

  const clearHold = useCallback(() => {
    if (holdTimer.current) window.clearInterval(holdTimer.current);
    if (armTimer.current) window.clearTimeout(armTimer.current);
    holdTimer.current = null;
    armTimer.current = null;
    setHolding(false);
    setProgress(0);
  }, []);

  const cancel = useCallback((force = false) => {
    // Le relâchement du maintien déclenche aussi un `click` : on l'ignore juste
    // après l'armement, sinon l'alerte s'annule elle-même. Une annulation
    // explicite (Échap, bouton) n'est jamais ignorée.
    if (!force && Date.now() - armedAt.current < 400) return;
    if (countdownTimer.current) window.clearInterval(countdownTimer.current);
    countdownTimer.current = null;
    setCountdown(null);
    onResult?.('cancelled');
  }, [onResult]);

  const arm = useCallback(() => {
    armedAt.current = Date.now();
    setCountdown(COUNTDOWN_S);
    onArmed?.();
    let remaining = COUNTDOWN_S;
    countdownTimer.current = window.setInterval(() => {
      remaining -= 1;
      onTick?.(remaining);
      if (remaining <= 0) {
        if (countdownTimer.current) window.clearInterval(countdownTimer.current);
        countdownTimer.current = null;
        setCountdown(null);
        const payload = {
          lat: position?.lat ?? 0,
          lng: position?.lng ?? 0,
          sessionId,
        };
        if (simulate) {
          onResult?.('queued');
          return;
        }
        void onSend(payload).then((result) => onResult?.(result));
      } else {
        setCountdown(remaining);
      }
    }, 1000);
  }, [onSend, onResult, onTick, position?.lat, position?.lng, sessionId, simulate]);

  const startHold = useCallback(() => {
    if (countdown !== null) return;
    setHolding(true);
    startedAt.current = Date.now();
    // L'armement est piloté par un minuteur dédié : l'anneau n'est qu'un
    // retour visuel, il ne doit jamais retarder le déclenchement.
    armTimer.current = window.setTimeout(() => {
      clearHold();
      arm();
    }, HOLD_MS);
    holdTimer.current = window.setInterval(() => {
      setProgress(Math.min(1, (Date.now() - startedAt.current) / HOLD_MS));
    }, 40);
  }, [arm, clearHold, countdown]);

  useEffect(
    () => () => {
      if (holdTimer.current) window.clearInterval(holdTimer.current);
      if (countdownTimer.current) window.clearInterval(countdownTimer.current);
    },
    [],
  );

  // Échap annule l'alerte armée (accessibilité clavier, 08_TESTS §5).
  useEffect(() => {
    if (countdown === null) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        cancel(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [cancel, countdown]);

  if (countdown !== null) {
    return (
      <button
        type="button"
        className="xp-sos xp-sos-counting"
        onClick={() => cancel()}
        aria-label={`SOS : envoi dans ${countdown} secondes, toucher pour annuler`}
        data-countdown={countdown}
      >
        {countdown}
      </button>
    );
  }

  return (
    <button
      type="button"
      className="xp-sos"
      onPointerDown={startHold}
      onPointerUp={clearHold}
      onPointerCancel={clearHold}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          arm();
        }
      }}
      aria-label="SOS : maintenir 1,5 seconde"
      data-holding={holding ? 'true' : 'false'}
      data-countdown={countdown ?? ''}
      data-progress={progress.toFixed(2)}
    >
      SOS
      <span className="xp-sos-ring" aria-hidden="true" style={{ '--p': progress } as React.CSSProperties} />
    </button>
  );
}
