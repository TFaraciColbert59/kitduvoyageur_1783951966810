'use client';

import Icon from '@/components/ui/Icon';
import React, { useState, useRef, useEffect } from 'react';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { useResolvedAttachmentUrl } from '../hooks/useAttachmentUrl';

interface AudioPlayerBubbleProps {
  audioUrl: string;
  isMine: boolean;
}

export const AudioPlayerBubble: React.FC<AudioPlayerBubbleProps> = ({ audioUrl, isMine }) => {
  const { haptic } = useHapticFeedback();
  const resolvedUrl = useResolvedAttachmentUrl(audioUrl) || audioUrl;
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const synthTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    if (!resolvedUrl) return;
    const audio = new Audio();
    audio.preload = 'auto';
    audio.src = resolvedUrl;
    audioRef.current = audio;

    const handleLoadedMetadata = () => {
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        setDuration(audio.duration);
      }
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime || 0);
    };

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('ended', handleEnded);

    // Initial check in case it loaded synchronously or from cache
    if (audio.readyState >= 1 && Number.isFinite(audio.duration)) {
      setDuration(audio.duration);
    }

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('ended', handleEnded);
      audio.pause();
      if (synthTimerRef.current) clearInterval(synthTimerRef.current);
    };
  }, [resolvedUrl]);

  // Fallback simulator for offline/mock voice notes
  const startSynthPlayback = (totalSec: number = 6) => {
    setDuration(totalSec);
    setIsPlaying(true);
    if (synthTimerRef.current) clearInterval(synthTimerRef.current);
    const stepMs = 200;
    synthTimerRef.current = setInterval(() => {
      setCurrentTime((prev) => {
        const next = prev + stepMs / 1000;
        if (next >= totalSec) {
          if (synthTimerRef.current) clearInterval(synthTimerRef.current);
          setIsPlaying(false);
          return 0;
        }
        return next;
      });
    }, stepMs);
  };

  const togglePlay = () => {
    haptic('light');
    if (!audioRef.current) {
      if (isPlaying) {
        if (synthTimerRef.current) clearInterval(synthTimerRef.current);
        setIsPlaying(false);
      } else {
        startSynthPlayback();
      }
      return;
    }

    if (isPlaying) {
      audioRef.current.pause();
      if (synthTimerRef.current) clearInterval(synthTimerRef.current);
      setIsPlaying(false);
    } else {
      const playPromise = audioRef.current.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            setIsPlaying(true);
          })
          .catch(() => {
            // Safari/WebKit playback blocked or file format unplayable -> use fallback timer
            startSynthPlayback(duration || 6);
          });
      } else {
        setIsPlaying(true);
      }
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
            const target = clickPct * (duration || 6);
            if (audioRef.current && Number.isFinite(audioRef.current.duration)) {
              audioRef.current.currentTime = target;
            }
            setCurrentTime(target);
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
          <span>{isPlaying ? formatTime(currentTime) : (duration > 0 ? formatTime(duration) : '0:06')}</span>
          <span className="flex items-center gap-0.5 opacity-65 text-[9px] uppercase tracking-wider">
            <Icon name="mic" className="size-2.5" aria-hidden="true" />
            Vocal
          </span>
        </div>
      </div>
    </div>
  );
};
