'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { generateSosMessage } from '../services/prepScoreCalculator';

interface ActionSosWidgetProps {
  latitude: number | null;
  longitude: number | null;
  altitude: number | null;
  batteryLevel: number | null;
  isUltraSave: boolean;
}

export const ActionSosWidget: React.FC<ActionSosWidgetProps> = ({
  latitude,
  longitude,
  altitude,
  batteryLevel,
  isUltraSave,
}) => {
  const [holdingProgress, setHoldingProgress] = useState(0); // 0 to 1
  const [isHolding, setIsHolding] = useState(false);
  const [isTriggered, setIsTriggered] = useState(false);
  const [copied, setCopied] = useState(false);

  const holdIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const holdStartTimeRef = useRef<number | null>(null);
  const HOLD_DURATION_MS = 3000;

  const lat = latitude ?? 45.8326;
  const lon = longitude ?? 6.7589;
  const alt = altitude ?? 1840;
  const bat = batteryLevel ? batteryLevel * 100 : 85;

  const sosMessage = generateSosMessage({
    lat,
    lon,
    alt,
    batteryPercent: bat,
    userId: 'LKDV-USER',
  });

  const clearHold = useCallback(() => {
    if (holdIntervalRef.current) {
      clearInterval(holdIntervalRef.current);
      holdIntervalRef.current = null;
    }
    holdStartTimeRef.current = null;
    setIsHolding(false);
    setHoldingProgress(0);
  }, []);

  const handleHoldStart = () => {
    if (isTriggered) return;
    setIsHolding(true);
    holdStartTimeRef.current = Date.now();

    // Haptic feedback if available
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(40);
    }

    holdIntervalRef.current = setInterval(() => {
      if (!holdStartTimeRef.current) return;
      const elapsed = Date.now() - holdStartTimeRef.current;
      const progress = Math.min(1, elapsed / HOLD_DURATION_MS);
      setHoldingProgress(progress);

      if (progress >= 1) {
        clearHold();
        setIsTriggered(true);
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
          navigator.vibrate([100, 50, 100, 50, 300]);
        }
      }
    }, 50);
  };

  const handleHoldEnd = () => {
    if (holdingProgress < 1) {
      clearHold();
    }
  };

  useEffect(() => {
    return () => {
      if (holdIntervalRef.current) clearInterval(holdIntervalRef.current);
    };
  }, []);

  const handleCopy = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(sosMessage);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }
  };

  const radius = 32;
  const strokeWidth = 5;
  const normalizedRadius = radius - strokeWidth / 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset = circumference - holdingProgress * circumference;

  return (
    <>
      {/* SOS Button Widget */}
      <div
        className={`p-4 rounded-3xl transition-all ${
          isUltraSave
            ? 'bg-black border border-red-500/60 text-red-400'
            : 'bg-red-950/80 text-white backdrop-blur-xl border border-red-500/40 shadow-lg shadow-red-950/30'
        }`}
      >
        <div className="flex items-center justify-between mb-3">
          <span className="text-[10px] font-mono uppercase tracking-widest text-red-300">
            PROCÉDURE D'URGENCE
          </span>
          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-red-500/20 text-red-300">
            MAINTIEN 3 SEC
          </span>
        </div>

        <div className="flex items-center justify-between gap-4">
          <div className="text-xs text-red-200/90 leading-tight">
            Appui long de 3s pour diffuser vos coordonnées GPS aux secours.
          </div>

          <div className="relative flex items-center justify-center flex-shrink-0">
            <svg height={radius * 2} width={radius * 2} className="transform -rotate-90">
              <circle
                stroke="rgba(255, 255, 255, 0.15)"
                fill="transparent"
                strokeWidth={strokeWidth}
                r={normalizedRadius}
                cx={radius}
                cy={radius}
              />
              <circle
                stroke="#DC2626"
                fill="transparent"
                strokeWidth={strokeWidth}
                strokeDasharray={`${circumference} ${circumference}`}
                style={{ strokeDashoffset }}
                strokeLinecap="round"
                r={normalizedRadius}
                cx={radius}
                cy={radius}
              />
            </svg>

            <button
              onMouseDown={handleHoldStart}
              onMouseUp={handleHoldEnd}
              onMouseLeave={handleHoldEnd}
              onTouchStart={handleHoldStart}
              onTouchEnd={handleHoldEnd}
              className={`absolute inset-1.5 rounded-full flex flex-col items-center justify-center font-extrabold text-white text-xs select-none transition-transform active:scale-90 ${
                isHolding ? 'bg-red-700 scale-95' : 'bg-red-600 hover:bg-red-500'
              }`}
            >
              <span>🆘</span>
              <span className="text-[9px] font-mono">SOS</span>
            </button>
          </div>
        </div>
      </div>

      {/* SOS Activated Modal */}
      {isTriggered && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Alerte SOS Déclenchée"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
        >
          <div className="w-full max-w-sm rounded-3xl p-6 bg-[#17402C] text-[#E7E3D6] border-2 border-red-500 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-red-600 text-white flex items-center justify-center text-2xl animate-pulse">
                🆘
              </div>
              <div>
                <h3 className="text-lg font-bold text-white leading-tight">
                  Alerte SOS Déclenchée
                </h3>
                <p className="text-xs text-[#9AAD9E]">
                  Coordonnées GPS verrouillées pour les secours
                </p>
              </div>
            </div>

            {/* Formatted deterministic string */}
            <div className="p-3 rounded-xl bg-black/40 border border-white/10 font-mono text-xs text-[#4ADE80] break-all select-all">
              {sosMessage}
            </div>

            <div className="space-y-2 pt-2">
              <button
                onClick={handleCopy}
                className="w-full py-3 rounded-xl bg-white text-[#17402C] font-bold text-xs shadow-md active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                <span>{copied ? '✓ Message Copié !' : '📋 Copier le Message SOS'}</span>
              </button>

              <a
                href="tel:112"
                className="w-full py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs text-center block shadow-md active:scale-95 transition-all"
              >
                📞 Appeler les Secours (112)
              </a>

              <button
                onClick={() => setIsTriggered(false)}
                className="w-full py-2.5 rounded-xl bg-white/10 text-[#C5D0C7] text-xs font-semibold hover:bg-white/20 transition-all"
              >
                Annuler l'alerte
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
