'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { HikingState } from '../types';

interface HikingControlsProps {
  state: HikingState;
  isActive: boolean;
  isPaused: boolean;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
}

export default function HikingControls({
  state,
  isActive,
  isPaused,
  onStart,
  onPause,
  onResume,
  onStop,
}: HikingControlsProps) {
  return (
    <div className="flex items-center gap-3 px-4 pt-2 pb-1">
      {!isActive ? (
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={onStart}
          className="flex-1 min-h-[52px] py-3.5 bg-gradient-to-r from-[#2D6A4F] to-[#4E9F3D] text-white font-bold text-base rounded-2xl shadow-lg border border-[#4E9F3D]/40 flex items-center justify-center gap-2 active:opacity-90"
        >
          <span className="text-xl">🥾</span>
          Démarrer la randonnée
        </motion.button>
      ) : isPaused ? (
        <>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={onResume}
            className="flex-1 min-h-[52px] py-3.5 bg-gradient-to-r from-[#2D6A4F] to-[#4E9F3D] text-white font-bold text-sm rounded-2xl shadow-lg border border-[#4E9F3D]/40 flex items-center justify-center gap-2"
          >
            <span className="text-lg">▶️</span>
            Reprendre
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={onStop}
            className="flex-1 min-h-[52px] py-3.5 bg-red-950/80 text-red-200 border border-red-500/40 font-bold text-sm rounded-2xl shadow-lg flex items-center justify-center gap-2"
          >
            <span className="text-lg">⏹️</span>
            Terminer
          </motion.button>
        </>
      ) : (
        <>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={onPause}
            className="flex-1 min-h-[52px] py-3.5 bg-[#17402C]/90 text-white/90 border border-[#2D5A27]/40 font-bold text-sm rounded-2xl shadow-lg flex items-center justify-center gap-2"
          >
            <span className="text-lg">⏸️</span>
            Pause
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={onStop}
            className="flex-1 min-h-[52px] py-3.5 bg-red-950/80 text-red-200 border border-red-500/40 font-bold text-sm rounded-2xl shadow-lg flex items-center justify-center gap-2"
          >
            <span className="text-lg">⏹️</span>
            Terminer
          </motion.button>
        </>
      )}
    </div>
  );
}
