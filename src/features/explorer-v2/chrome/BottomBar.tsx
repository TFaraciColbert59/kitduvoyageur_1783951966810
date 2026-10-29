'use client';

import React, { useCallback, useRef, useState } from 'react';
import { XpIcon } from '../ui/XpIcon';

/**
 * Arrêt de sortie par maintien 0,8 s (04_CARTE §4) : un simple toucher n'arrête
 * rien, l'anneau se remplit et se vide au relâchement.
 */
function StopHoldButton({ onStop }: { onStop: () => void }) {
  const [progress, setProgress] = useState(0);
  const timer = useRef<number | null>(null);
  const startedAt = useRef(0);

  const clear = useCallback(() => {
    if (timer.current) window.clearInterval(timer.current);
    timer.current = null;
    setProgress(0);
  }, []);

  const start = useCallback(() => {
    clear();
    startedAt.current = Date.now();
    timer.current = window.setInterval(() => {
      const ratio = Math.min(1, (Date.now() - startedAt.current) / 800);
      setProgress(ratio);
      if (ratio >= 1) {
        clear();
        onStop();
      }
    }, 40);
  }, [clear, onStop]);

  return (
    <button
      type="button"
      className="xp-pill-btn xp-stop-hold"
      data-tone="bad"
      onPointerDown={start}
      onPointerUp={clear}
      onPointerCancel={clear}
      aria-label="Arrêter la sortie : maintenir 0,8 seconde"
      data-progress={progress.toFixed(2)}
    >
      <XpIcon name="stop" size={15} />
      <span className="xp-stop-ring" aria-hidden="true" style={{ '--p': progress } as React.CSSProperties} />
    </button>
  );
}

export function ActivityPill({
  sportLabel,
  elapsed,
  distanceLabel,
  paused,
  onPause,
  onFlag,
  onStop,
}: {
  sportLabel: string;
  elapsed: string;
  distanceLabel: string;
  paused: boolean;
  onPause: () => void;
  onFlag: () => void;
  onStop: () => void;
}) {
  return (
    <div className="xp-activity-pill" role="group" aria-label="Commandes d'activité">
      <span className="xp-pill-sport">{sportLabel}</span>
      <span className="xp-pill-timer" aria-live="off">
        {elapsed}
      </span>
      <span className="xp-pill-dist">{distanceLabel}</span>
      <span style={{ flex: 1 }} />
      <button
        type="button"
        className="xp-pill-btn"
        onClick={onPause}
        aria-label={paused ? 'Reprendre' : 'Pause'}
      >
        <XpIcon name={paused ? 'play' : 'pause'} size={15} />
      </button>
      <button type="button" className="xp-pill-btn" onClick={onFlag} aria-label="Poser un repère">
        <XpIcon name="flag" size={15} />
      </button>
      <StopHoldButton onStop={onStop} />
    </div>
  );
}
