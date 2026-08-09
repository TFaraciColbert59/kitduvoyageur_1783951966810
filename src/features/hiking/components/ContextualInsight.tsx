'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SafetyAlert, WeatherSnapshot, POI } from '../types';

interface ContextualInsightProps {
  isOffRoute?: boolean;
  deviationMeters?: number | null;
  bearingDeg?: number | null;
  nextPoi?: (POI & { distanceRemainingM: number }) | null;
  weather?: WeatherSnapshot | null;
  safetyAlerts?: SafetyAlert[];
  isPaused?: boolean;
  onDismissOffRoute?: () => void;
  onReturnToPath?: () => void;
}

export default function ContextualInsight({
  isOffRoute,
  deviationMeters,
  nextPoi,
  weather,
  safetyAlerts = [],
  isPaused,
  onDismissOffRoute,
  onReturnToPath,
}: ContextualInsightProps) {
  // Determine primary high-priority insight
  let priorityType: 'off-route' | 'weather' | 'poi' | 'paused' | 'nominal' = 'nominal';
  let message = '🟢 Tout va bien — Vous êtes sur le parcours';
  let icon = '🟢';
  let bannerStyle = 'bg-[#17402C]/90 text-white border-[#2D5A27]/40';

  if (isOffRoute && deviationMeters) {
    priorityType = 'off-route';
    icon = '⚠️';
    message = `Sortie du parcours (${Math.round(deviationMeters)} m)`;
    bannerStyle = 'bg-amber-950/95 text-amber-100 border-amber-500/50 shadow-amber-900/40';
  } else if (weather?.isAlert) {
    priorityType = 'weather';
    icon = '🌧️';
    message = weather.alertMessage || 'Alerte météo en cours';
    bannerStyle = 'bg-blue-950/95 text-blue-100 border-blue-500/50 shadow-blue-900/40';
  } else if (isPaused) {
    priorityType = 'paused';
    icon = '⏸️';
    message = 'Randonnée en pause';
    bannerStyle = 'bg-[#1F2E25]/90 text-white/80 border-white/20';
  } else if (nextPoi && nextPoi.distanceRemainingM < 200) {
    priorityType = 'poi';
    icon = nextPoi.category === 'viewpoint' ? '📸' : '📍';
    message = `${nextPoi.name} à ${Math.round(nextPoi.distanceRemainingM)} m`;
    bannerStyle = 'bg-[#17402C]/95 text-white border-[#4E9F3D]/50';
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={`${priorityType}-${message}`}
        initial={{ opacity: 0, y: -10, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -10, scale: 0.98 }}
        transition={{ duration: 0.25 }}
        className={`mx-4 mt-3 px-4 py-2.5 rounded-2xl border backdrop-blur-xl shadow-lg flex items-center justify-between gap-3 ${bannerStyle}`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="text-lg flex-shrink-0">{icon}</span>
          <p className="font-semibold text-xs sm:text-sm truncate leading-tight">
            {message}
          </p>
        </div>

        {/* Priority Actions */}
        {priorityType === 'off-route' && (
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {onReturnToPath && (
              <button
                onClick={onReturnToPath}
                className="px-2.5 py-1 bg-amber-500/30 text-amber-200 border border-amber-400/40 rounded-xl text-[11px] font-bold hover:bg-amber-500/40 transition-colors"
              >
                Guide
              </button>
            )}
            {onDismissOffRoute && (
              <button
                onClick={onDismissOffRoute}
                className="px-2.5 py-1 bg-white/10 text-white/80 rounded-xl text-[11px] font-medium hover:bg-white/20 transition-colors"
              >
                Ignorer
              </button>
            )}
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
