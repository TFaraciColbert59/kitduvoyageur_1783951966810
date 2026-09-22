'use client';

import Icon from '@/components/ui/Icon';
import React, { useState, useRef, useEffect } from 'react';
import { IconButton } from '@/components/ui';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';

interface AudioPlayerBubbleProps {
  audioUrl: string;
  isMine: boolean;
}

export const AudioPlayerBubble: React.FC<AudioPlayerBubbleProps> = ({ audioUrl, isMine }) => {
  const { haptic } = useHapticFeedback();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const audio = new Audio(audioUrl);
    audioRef.current = audio;

    const handleLoadedMetadata = () => {
      setDuration(audio.duration || 0);
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime || 0);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
      audio.pause();
    };
  }, [audioUrl]);

  const togglePlay = () => {
    haptic('light');
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().catch(() => {});
      setIsPlaying(true);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    setCurrentTime(time);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
    }
  };

  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs < 0) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      className={`my-[var(--space-1)] flex max-w-xs items-center gap-[var(--space-3)] rounded-[var(--lkv-radius-md)] border p-[var(--space-2)] ${
        isMine
          ? 'border-[color:var(--glass-border)] bg-[color:var(--card-tint-strong)] text-[color:var(--lkv-text-primary)]'
          : 'border-[color:var(--glass-border)] bg-[color:var(--glass-bg-medium)] backdrop-blur-[var(--glass-blur-sm)] saturate-[var(--glass-sat)] text-[color:var(--lkv-text-primary)] shadow-elevation-1'
      }`}
    >
      <IconButton
        type="button"
        variant={isMine ? 'glass' : 'solid'}
        onClick={togglePlay}
        className="shrink-0 shadow-elevation-1"
        title={isPlaying ? 'Pause' : 'Écouter la note vocale'}
        aria-label={isPlaying ? 'Pause' : 'Écouter la note vocale'}
      >
        {isPlaying ? (
          <Icon name="pause" className="size-4" aria-hidden="true" />
        ) : (
          <Icon name="play" className="ml-0.5 size-4" aria-hidden="true" />
        )}
      </IconButton>

      <div className="flex flex-1 flex-col gap-[var(--space-1)]">
        <div className="flex items-center justify-between text-[length:var(--lkv-text-caption-2)] font-semibold opacity-90">
          <span className="flex items-center gap-[var(--space-1)]">
            <Icon name="mic" className="size-3 text-[color:var(--lkv-secondary)]" aria-hidden="true" />
            Note vocale
          </span>
          <span className="font-mono">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
        </div>

        <div className="relative flex w-full items-center">
          <input
            type="range"
            min={0}
            max={duration || 100}
            step={0.1}
            value={currentTime}
            onChange={handleSeek}
            aria-label="Position de lecture"
            className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-[color:var(--lkv-primary)]/15 accent-[var(--lkv-secondary)] focus:outline-none"
          />
        </div>
      </div>
    </div>
  );
};
