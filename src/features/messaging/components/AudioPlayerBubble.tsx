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

  const WAVE_BARS = [
    8, 14, 18, 10, 16, 22, 12, 20, 24, 14, 18, 22, 10, 16, 20, 14, 22, 18, 12, 16, 10, 14, 8, 6
  ];

  const handleBarClick = (index: number) => {
    if (!duration || !audioRef.current) return;
    const targetTime = (index / WAVE_BARS.length) * duration;
    audioRef.current.currentTime = targetTime;
    setCurrentTime(targetTime);
  };

  const currentProgress = duration > 0 ? currentTime / duration : 0;

  return (
    <div
      className={`my-1 flex items-center gap-3 rounded-2xl border px-3 py-2 max-w-[260px] ${
        isMine
          ? 'border-white/20 bg-[#17402C] text-white shadow-sm'
          : 'border-black/5 bg-white/75 backdrop-blur-md text-[#172B24] shadow-sm'
      }`}
      style={{ boxSizing: 'border-box' }}
    >
      <button
        type="button"
        onClick={togglePlay}
        className={`size-9 shrink-0 rounded-full flex items-center justify-center transition-transform active:scale-95 ${
          isMine
            ? 'bg-white/20 text-white hover:bg-white/30'
            : 'bg-[#17402C] text-white hover:bg-[#17402C]/90 shadow-sm'
        }`}
        title={isPlaying ? 'Pause' : 'Écouter'}
        aria-label={isPlaying ? 'Pause' : 'Écouter'}
      >
        {isPlaying ? (
          <Icon name="pause" className="size-4" aria-hidden="true" />
        ) : (
          <Icon name="play" className="ml-0.5 size-4" aria-hidden="true" />
        )}
      </button>

      <div className="flex flex-1 flex-col gap-1 min-w-0">
        <div
          className="flex items-center gap-[2.5px] h-6 cursor-pointer"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const clickPct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
            if (audioRef.current && duration) {
              const target = clickPct * duration;
              audioRef.current.currentTime = target;
              setCurrentTime(target);
            }
          }}
          role="slider"
          aria-valuenow={currentTime}
          aria-valuemin={0}
          aria-valuemax={duration || 100}
          aria-label="Progression du message vocal"
          tabIndex={0}
        >
          {WAVE_BARS.map((height, idx) => {
            const isFilled = idx / WAVE_BARS.length <= currentProgress;
            return (
              <span
                key={idx}
                style={{
                  height: `${height}px`,
                  width: '3px',
                  borderRadius: '999px',
                  backgroundColor: isMine
                    ? (isFilled ? '#ffffff' : 'rgba(255, 255, 255, 0.35)')
                    : (isFilled ? '#17402C' : 'rgba(23, 64, 44, 0.22)'),
                  transition: 'background-color 0.15s ease',
                  flexShrink: 0,
                }}
              />
            );
          })}
        </div>

        <div className="flex items-center justify-between text-[10px] font-semibold tracking-tight opacity-80">
          <span>{isPlaying ? formatTime(currentTime) : (duration > 0 ? formatTime(duration) : '0:00')}</span>
          <span className="flex items-center gap-0.5 opacity-65 text-[9px] uppercase tracking-wider">
            <Icon name="mic" className="size-2.5" aria-hidden="true" />
            Vocal
          </span>
        </div>
      </div>
    </div>
  );
};
