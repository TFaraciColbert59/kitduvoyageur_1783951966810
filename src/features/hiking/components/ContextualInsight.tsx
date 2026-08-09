'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SafetyAlert, WeatherSnapshot, POI } from '../types';

interface ContextualInsightProps {
  isOffRoute?: boolean;
  deviationMeters?: number | null;
  nextPoi?: (POI & { distanceRemainingM: number }) | null;
  weather?: WeatherSnapshot | null;
  safetyAlerts?: SafetyAlert[];
  isPaused?: boolean;
  onDismissOffRoute?: () => void;
  onReturnToPath?: () => void;
  onViewShelter?: () => void;
}

export default function ContextualInsight({
  isOffRoute,
  deviationMeters = null,
  nextPoi,
  weather,
  isPaused,
  onDismissOffRoute,
  onReturnToPath,
  onViewShelter,
}: ContextualInsightProps) {
  // Determine primary high-priority insight
  let priorityType: 'off-route' | 'weather' | 'poi' | 'paused' | 'nominal' = 'nominal';

  if (isOffRoute) {
    priorityType = 'off-route';
  } else if (weather?.isAlert) {
    priorityType = 'weather';
  } else if (isPaused) {
    priorityType = 'paused';
  } else if (nextPoi && nextPoi.distanceRemainingM < 300) {
    priorityType = 'poi';
  }

  if (priorityType === 'nominal') return null;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={priorityType}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 10 }}
        className={`absolute left-3 right-3 bottom-[100px] z-20 p-3.5 rounded-3xl backdrop-blur-2xl border shadow-xl flex items-center gap-3 select-none ${
          priorityType === 'off-route'
            ? 'bg-[#E8B87A]/95 text-[#4A2E0E] border-[#7A4A15]/20 shadow-amber-900/20'
            : priorityType === 'weather'
            ? 'bg-[#3B5678]/95 text-white border-white/20 shadow-blue-950/30'
            : 'bg-[#17402C]/95 text-white border-[#C6DCBE]/20'
        }`}
      >
        {/* Icon Box */}
        <div
          className={`w-10 h-10 rounded-2xl flex items-center justify-center text-xl flex-shrink-0 ${
            priorityType === 'off-route'
              ? 'bg-[#7A4A15]/15 text-[#7A4A15]'
              : priorityType === 'weather'
              ? 'bg-white/15 text-white'
              : 'bg-[#C6DCBE]/20 text-[#C6DCBE]'
          }`}
        >
          {priorityType === 'off-route' ? '⚠️' : priorityType === 'weather' ? '🌧️' : priorityType === 'paused' ? '⏸️' : '📍'}
        </div>

        {/* Content Body */}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium tracking-tight leading-snug">
            {priorityType === 'off-route' ? (
              <>Vous avez quitté <em className="font-serif italic font-normal">le sentier</em></>
            ) : priorityType === 'weather' ? (
              <>Alerte <em className="font-serif italic font-normal">météo</em></>
            ) : priorityType === 'paused' ? (
              <>Randonnée <em className="font-serif italic font-normal">en pause</em></>
            ) : (
              <>{nextPoi?.name || 'Point d\'intérêt'} <em className="font-serif italic font-normal">à proximité</em></>
            )}
          </div>

          <div className="text-[11px] opacity-80 font-mono tracking-wide mt-0.5 truncate">
            {priorityType === 'off-route'
              ? deviationMeters != null
                ? `Rejoint à ${Math.round(deviationMeters)} m du tracé`
                : 'Hors du tracé · position GPS'
              : priorityType === 'weather'
              ? weather?.alertMessage || 'Alerte météo — consulte un bulletin à jour'
              : priorityType === 'paused'
              ? 'Appuyez sur Reprendre pour continuer le tracking'
              : nextPoi?.distanceRemainingM != null
              ? `${Math.round(nextPoi.distanceRemainingM)} m restants`
              : 'Prochain point à proximité'}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {priorityType === 'off-route' && (
            <>
              <button
                onClick={onReturnToPath}
                className="px-3 py-1.5 rounded-full text-xs font-semibold bg-[#7A4A15] text-white shadow-md active:scale-95 transition-transform"
              >
                REVENIR
              </button>
              <button
                onClick={onDismissOffRoute}
                className="px-3 py-1.5 rounded-full text-xs font-semibold bg-[#0B1F17]/14 text-inherit active:scale-95 transition-transform"
              >
                IGNORER
              </button>
            </>
          )}

          {priorityType === 'weather' && (
            <button
              onClick={onViewShelter}
              className="px-3 py-1.5 rounded-full text-xs font-semibold bg-white/20 text-white shadow-md active:scale-95 transition-transform"
            >
              VOIR ABRI
            </button>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
