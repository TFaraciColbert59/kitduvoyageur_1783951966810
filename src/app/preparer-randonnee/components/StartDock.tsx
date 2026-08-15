'use client';

import React from 'react';
import { Icon } from './PreparationIcons';

interface StartDockProps {
  score: number;
  totalOk: number;
  totalNeeds: number;
  missingCount: number;
  anyEssentialMissing: boolean;
  onStart: () => void;
}

export const StartDock: React.FC<StartDockProps> = ({
  score,
  totalOk,
  totalNeeds,
  missingCount,
  anyEssentialMissing,
  onStart,
}) => {
  const dotColor = anyEssentialMissing ? 'bg-[#B85838]' : missingCount > 0 ? 'bg-[#E8B87A]' : 'bg-[#22c55e]';

  return (
    <div
      className="fixed left-3 right-3 z-[70] bg-white/85 backdrop-blur-xl border border-white/70 rounded-full p-1 pl-4 shadow-xl flex items-center justify-between gap-2 pointer-events-auto"
      style={{ bottom: 'calc(env(safe-area-inset-bottom) + 62px + 8px)' }}
    >
      {/* Left compact status */}
      <div className="flex items-center gap-2 min-w-0">
        <span className={`w-2 h-2 rounded-full shrink-0 ${dotColor}`} />
        <div className="flex flex-col min-w-0">
          <span className="text-[10px] font-bold text-[#1C2620] truncate font-display">
            {anyEssentialMissing ? 'Essentiels manquants' : missingCount > 0 ? `${missingCount} à compléter` : 'Prêt à partir'}
          </span>
          <span className="text-[8px] font-mono text-[#5C6B5E] truncate">
            {score}% · {totalOk}/{totalNeeds} équipés
          </span>
        </div>
      </div>

      {/* Right compact CTA button */}
      <button
        onClick={onStart}
        className="h-9 px-4 rounded-full bg-[#17402C] hover:bg-[#0B1F17] text-white text-xs font-bold shadow-md flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 shrink-0"
      >
        <span>Démarrer</span>
        <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
          <path d="M5 12h14M12 5l7 7-7 7" />
        </svg>
      </button>
    </div>
  );
};
