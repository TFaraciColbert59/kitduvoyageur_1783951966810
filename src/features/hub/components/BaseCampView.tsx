'use client';

import React from 'react';
import Link from 'next/link';
import { BaseCampState } from '../types/hub.types';
import { PrepScoreGauge } from './PrepScoreGauge';
import { SmartPromptsList } from './SmartPromptsList';

interface BaseCampViewProps {
  state: BaseCampState;
  onStartTrek: () => void;
  onDismissAlert: (id: string) => void;
}

export const BaseCampView: React.FC<BaseCampViewProps> = ({
  state,
  onStartTrek,
  onDismissAlert,
}) => {
  const { countdown, prepScore, prepBreakdown, activeAlerts, trekName, destination } = state;

  return (
    <div className="space-y-6 pb-24 animate-in fade-in duration-300">
      {/* Trek Header Card */}
      <div className="p-6 rounded-3xl bg-gradient-to-br from-[#17402C] to-[#2D5A40] text-white shadow-xl shadow-[#17402C]/10 relative overflow-hidden">
        {/* Subtle glass reflection */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#A6C1A0]">
              PROCHAIN DÉPART PLANIFIÉ
            </span>
            {countdown && (
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-semibold bg-white/15 text-white backdrop-blur-md">
                J-{countdown.daysRemaining} ({countdown.hoursRemaining}h {countdown.minutesRemaining}m)
              </span>
            )}
          </div>

          <h2 className="text-2xl font-extrabold tracking-tight font-display leading-tight mb-1">
            {trekName}
          </h2>
          <p className="text-sm text-[#C5D0C7] flex items-center gap-1.5">
            📍 {destination}
          </p>

          {/* Action Row */}
          <div className="mt-6 pt-4 border-t border-white/10 flex flex-wrap items-center justify-between gap-3">
            <Link
              href="/preparer-randonnee"
              className="text-xs font-semibold text-[#E7E3D6] hover:text-white flex items-center gap-1 transition-colors"
            >
              Éditer les paramètres du trek →
            </Link>

            <button
              onClick={onStartTrek}
              className="w-full sm:w-auto px-6 py-3.5 rounded-2xl bg-white text-[#17402C] font-bold text-sm shadow-lg shadow-black/10 hover:bg-white/90 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
            >
              <span>🧭 Démarrer le Trek</span>
              <span aria-hidden="true">→</span>
            </button>
          </div>
        </div>
      </div>

      {/* PrepScore Gauge */}
      <PrepScoreGauge score={prepScore} breakdown={prepBreakdown} />

      {/* Smart Prompts & Alerts */}
      <SmartPromptsList alerts={activeAlerts} onDismiss={onDismissAlert} />

      {/* Tactical Quick Links */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Link
          href="/materiel"
          className="p-4 rounded-2xl bg-white/60 dark:bg-white/5 backdrop-blur-lg border border-black/5 dark:border-white/10 hover:border-emerald-500/40 transition-all flex flex-col items-center text-center group"
        >
          <span className="text-2xl mb-1.5 group-hover:scale-110 transition-transform">🎒</span>
          <span className="text-xs font-bold text-[#17402C] dark:text-[#E7E3D6]">Mon Sac</span>
          <span className="text-[10px] text-[#5A7064] dark:text-[#9AAD9E]">Shakedown</span>
        </Link>

        <Link
          href="/carte-interactive"
          className="p-4 rounded-2xl bg-white/60 dark:bg-white/5 backdrop-blur-lg border border-black/5 dark:border-white/10 hover:border-emerald-500/40 transition-all flex flex-col items-center text-center group"
        >
          <span className="text-2xl mb-1.5 group-hover:scale-110 transition-transform">🗺️</span>
          <span className="text-xs font-bold text-[#17402C] dark:text-[#E7E3D6]">Carte & Trace</span>
          <span className="text-[10px] text-[#5A7064] dark:text-[#9AAD9E]">Offline cache</span>
        </Link>

        <Link
          href="/preparer-randonnee"
          className="p-4 rounded-2xl bg-white/60 dark:bg-white/5 backdrop-blur-lg border border-black/5 dark:border-white/10 hover:border-emerald-500/40 transition-all flex flex-col items-center text-center group"
        >
          <span className="text-2xl mb-1.5 group-hover:scale-110 transition-transform">🌤️</span>
          <span className="text-xs font-bold text-[#17402C] dark:text-[#E7E3D6]">Météo Waypoints</span>
          <span className="text-[10px] text-[#5A7064] dark:text-[#9AAD9E]">Windchill</span>
        </Link>

        <Link
          href="/profil"
          className="p-4 rounded-2xl bg-white/60 dark:bg-white/5 backdrop-blur-lg border border-black/5 dark:border-white/10 hover:border-emerald-500/40 transition-all flex flex-col items-center text-center group"
        >
          <span className="text-2xl mb-1.5 group-hover:scale-110 transition-transform">🛡️</span>
          <span className="text-xs font-bold text-[#17402C] dark:text-[#E7E3D6]">Urgence & ICE</span>
          <span className="text-[10px] text-[#5A7064] dark:text-[#9AAD9E]">Matrice privée</span>
        </Link>
      </div>
    </div>
  );
};
