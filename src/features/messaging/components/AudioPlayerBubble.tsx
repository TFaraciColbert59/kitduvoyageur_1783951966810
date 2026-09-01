"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Mic } from 'lucide-react';
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
    <div className={`flex items-center gap-3 p-2.5 my-1 rounded-2xl max-w-xs ${
      isMine ? 'bg-white/10 text-[#FAF8F5] border border-white/20' : 'bg-stone-50/95 text-[#14140F] border border-stone-200/80 shadow-2xs'
    }`}>
      <button
        type="button"
        onClick={togglePlay}
        className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 shadow-xs transition-transform active:scale-95 ${
          isMine
            ? 'glass-circle-btn text-[#17402C]'
            : 'glass-circle-btn primary text-white'
        }`}
        title={isPlaying ? 'Pause' : 'Écouter la note vocale'}
      >
        {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
      </button>

      <div className="flex-1 flex flex-col gap-1">
        <div className="flex items-center justify-between text-[10px] font-semibold opacity-90">
          <span className="flex items-center gap-1">
            <Mic className="w-3 h-3 text-[#5B7F55]" />
            Note vocale
          </span>
          <span className="font-mono">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
        </div>

        <div className="relative w-full flex items-center">
          <input
            type="range"
            min={0}
            max={duration || 100}
            step={0.1}
            value={currentTime}
            onChange={handleSeek}
            className="w-full h-1.5 rounded-lg appearance-none cursor-pointer bg-black/20 accent-[#5B7F55] focus:outline-none"
          />
        </div>
      </div>
    </div>
  );
};
