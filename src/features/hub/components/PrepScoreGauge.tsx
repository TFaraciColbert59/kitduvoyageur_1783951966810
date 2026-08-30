'use client';

import React from 'react';
import { PrepBreakdown } from '../types/hub.types';

interface PrepScoreGaugeProps {
  score: number;
  breakdown: PrepBreakdown;
  onClickDetails?: () => void;
}

export const PrepScoreGauge: React.FC<PrepScoreGaugeProps> = ({
  score,
  breakdown,
  onClickDetails,
}) => {
  const radius = 48;
  const strokeWidth = 8;
  const normalizedRadius = radius - strokeWidth / 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  const getScoreColor = (val: number) => {
    if (val >= 80) return '#16A34A'; // emerald
    if (val >= 50) return '#D97706'; // amber
    return '#DC2626'; // red
  };

  return (
    <div
      className="relative flex flex-col items-center justify-center p-6 rounded-3xl bg-white/70 dark:bg-white/5 backdrop-blur-xl border border-white/40 dark:border-white/10 shadow-sm transition-all duration-300"
      style={{
        boxShadow: '0 8px 32px rgba(23, 64, 44, 0.04)',
      }}
    >
      <div className="flex items-center justify-between w-full mb-4">
        <div>
          <span className="text-[11px] font-mono uppercase tracking-widest text-[#5A7064] dark:text-[#9AAD9E]">
            Indice de Préparation
          </span>
          <h3 className="text-lg font-bold text-[#17402C] dark:text-[#E7E3D6] tracking-tight">
            Prêt pour le départ ?
          </h3>
        </div>
        <div
          className="px-2.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wider"
          style={{
            backgroundColor: `${getScoreColor(score)}15`,
            color: getScoreColor(score),
          }}
        >
          {score >= 80 ? 'Optimal' : score >= 50 ? 'Incomplet' : 'Critique'}
        </div>
      </div>

      {/* SVG Circular Gauge */}
      <div className="relative flex items-center justify-center my-2">
        <svg height={radius * 2} width={radius * 2} className="transform -rotate-90">
          <circle
            stroke="rgba(23, 64, 44, 0.08)"
            fill="transparent"
            strokeWidth={strokeWidth}
            r={normalizedRadius}
            cx={radius}
            cy={radius}
          />
          <circle
            stroke={getScoreColor(score)}
            fill="transparent"
            strokeWidth={strokeWidth}
            strokeDasharray={`${circumference} ${circumference}`}
            style={{ strokeDashoffset, transition: 'stroke-dashoffset 0.8s cubic-bezier(0.16, 1, 0.3, 1)' }}
            strokeLinecap="round"
            r={normalizedRadius}
            cx={radius}
            cy={radius}
          />
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-3xl font-extrabold text-[#17402C] dark:text-[#E7E3D6] tracking-tighter">
            {score}
          </span>
          <span className="text-[10px] font-medium text-[#5A7064] dark:text-[#9AAD9E]">
            / 100
          </span>
        </div>
      </div>

      {/* 4 Pillars Mini-Grid */}
      <div className="grid grid-cols-2 gap-2 w-full mt-4 pt-3 border-t border-black/5 dark:border-white/5">
        <div className="flex items-center justify-between p-2 rounded-xl bg-black/[0.02] dark:bg-white/[0.02]">
          <span className="text-xs text-[#5A7064] dark:text-[#9AAD9E]">🎒 Sac</span>
          <span className="text-xs font-semibold text-[#17402C] dark:text-[#E7E3D6]">
            {breakdown.gearScore}/35
          </span>
        </div>
        <div className="flex items-center justify-between p-2 rounded-xl bg-black/[0.02] dark:bg-white/[0.02]">
          <span className="text-xs text-[#5A7064] dark:text-[#9AAD9E]">🌤️ Météo</span>
          <span className="text-xs font-semibold text-[#17402C] dark:text-[#E7E3D6]">
            {breakdown.weatherScore}/25
          </span>
        </div>
        <div className="flex items-center justify-between p-2 rounded-xl bg-black/[0.02] dark:bg-white/[0.02]">
          <span className="text-xs text-[#5A7064] dark:text-[#9AAD9E]">🛡️ Sécurité</span>
          <span className="text-xs font-semibold text-[#17402C] dark:text-[#E7E3D6]">
            {breakdown.safetyScore}/25
          </span>
        </div>
        <div className="flex items-center justify-between p-2 rounded-xl bg-black/[0.02] dark:bg-white/[0.02]">
          <span className="text-xs text-[#5A7064] dark:text-[#9AAD9E]">🗺️ Offline</span>
          <span className="text-xs font-semibold text-[#17402C] dark:text-[#E7E3D6]">
            {breakdown.routeOfflineScore}/15
          </span>
        </div>
      </div>
    </div>
  );
};
