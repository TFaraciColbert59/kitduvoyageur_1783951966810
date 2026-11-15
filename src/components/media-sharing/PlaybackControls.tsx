'use client';

import React from 'react';
import styles from './media-sharing.module.css';
import { formatClock } from './format';
import { PauseIcon, PlayIcon, RestartIcon } from './icons';
import type { PlaybackState } from './usePlayback';

export function PlaybackControls({
  playback,
  label,
  durationSec,
}: {
  playback: PlaybackState;
  label: string;
  durationSec: number;
}) {
  const disabled = durationSec <= 0;
  return (
    <div className={styles.playback}>
      <button
        type="button"
        className={styles.playButton}
        aria-label={playback.playing ? `Mettre en pause ${label}` : `Lire ${label}`}
        aria-pressed={playback.playing}
        onClick={playback.toggle}
        disabled={disabled}
      >
        {playback.playing ? <PauseIcon size={18} /> : <PlayIcon size={18} />}
      </button>
      <button
        type="button"
        className={styles.iconButton}
        aria-label={`Revenir au début de ${label}`}
        onClick={playback.reset}
        disabled={disabled}
      >
        <RestartIcon size={18} />
      </button>
      <div className={styles.scrubber}>
        <input
          className={styles.range}
          type="range"
          min={0}
          max={Math.max(0.1, durationSec)}
          step={0.05}
          value={Math.min(playback.elapsedSec, Math.max(0.1, durationSec))}
          aria-label={`Position de ${label}`}
          onChange={(event) => playback.seek(Number(event.target.value))}
          disabled={disabled}
        />
        <div className={styles.scrubberMeta} aria-hidden="true">
          <span>{formatClock(playback.elapsedSec)}</span>
          <span>{formatClock(durationSec)}</span>
        </div>
      </div>
      <output className={styles.playbackOutput} aria-live="polite" aria-atomic="true">
        {Math.round(playback.progress * 100)} %
      </output>
    </div>
  );
}
