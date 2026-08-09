'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { GPSPosition, SafetyAlert } from '../types';
import { SafetyEngine } from '../safety/SafetyEngine';

interface SafetyCenterModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPos: GPSPosition | null;
  startPos?: GPSPosition | null;
  batteryLevel?: number | null;
  isOffline?: boolean;
  alerts?: SafetyAlert[];
  onReturnToStart?: () => void;
}

export default function SafetyCenterModal({
  isOpen,
  onClose,
  currentPos,
  startPos,
  batteryLevel,
  isOffline,
  alerts = [],
  onReturnToStart,
}: SafetyCenterModalProps) {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const formattedCoords = currentPos
    ? SafetyEngine.formatEmergencyCoordinates(currentPos.latitude, currentPos.longitude, currentPos.altitude)
    : 'Position GPS en recherche...';

  const handleSharePosition = async () => {
    if (!currentPos) return;

    const shareText = `[LKDV Randonnée - Ma Position GPS]\nCoordonnées : ${formattedCoords}\nLien Carte : https://maps.google.com/?q=${currentPos.latitude},${currentPos.longitude}`;

    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: 'Ma Position GPS - LKDV',
          text: shareText,
        });
        return;
      } catch {
        // Fallback to clipboard
      }
    }

    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] bg-black/85 backdrop-blur-xl flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-[#0d1a12] border border-[#2D5A27]/60 rounded-3xl p-5 max-w-sm w-full text-white shadow-2xl space-y-4 relative"
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-white/60 hover:text-white bg-white/10 w-8 h-8 rounded-full flex items-center justify-center text-sm"
        >
          ✕
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 border-b border-[#2D5A27]/40 pb-3">
          <span className="text-2xl p-2 rounded-2xl bg-red-950/80 text-red-400 border border-red-500/40">
            🛡️
          </span>
          <div>
            <h2 className="font-bold text-base text-white">Centre de Sécurité</h2>
            <p className="text-[11px] text-[#A3C4A3]">Assistance & Coordonnées GPS</p>
          </div>
        </div>

        {/* GPS Coordinates Display */}
        <div className="bg-[#17402C]/60 border border-[#2D5A27]/40 rounded-2xl p-3.5 space-y-1 text-center">
          <span className="text-[10px] text-[#A3C4A3] font-mono uppercase tracking-widest block">
            Coordonnées GPS WGS-84
          </span>
          <p className="font-mono font-bold text-sm text-emerald-300 select-all">
            {formattedCoords}
          </p>
          {currentPos?.timestamp && (
            <p className="text-[10px] text-[#A3C4A3]/70 font-mono">
              Dernier fix : {new Date(currentPos.timestamp).toLocaleTimeString('fr-FR')}
            </p>
          )}
        </div>

        {/* System Status Indicators */}
        <div className="grid grid-cols-2 gap-2 text-center text-xs font-mono">
          <div className="bg-[#17402C]/40 border border-[#2D5A27]/30 rounded-xl p-2">
            <span className="text-[#A3C4A3] text-[10px] block">RÉSEAU</span>
            <span className={isOffline ? 'text-amber-400 font-bold' : 'text-emerald-400 font-bold'}>
              {isOffline ? '🌐 Hors Ligne' : '📶 Connecté'}
            </span>
          </div>

          <div className="bg-[#17402C]/40 border border-[#2D5A27]/30 rounded-xl p-2">
            <span className="text-[#A3C4A3] text-[10px] block">BATTERIE</span>
            <span className={batteryLevel != null && batteryLevel <= 15 ? 'text-red-400 font-bold animate-pulse' : 'text-emerald-400 font-bold'}>
              🔋 {batteryLevel != null ? `${batteryLevel}%` : '—'}
            </span>
          </div>
        </div>

        {/* Active Alerts List */}
        {alerts.length > 0 && (
          <div className="space-y-1.5 max-h-28 overflow-y-auto pr-1">
            <span className="text-[10px] text-[#A3C4A3] font-mono uppercase">Alertes en cours</span>
            {alerts.map((alert) => (
              <div
                key={alert.id}
                className={`p-2 rounded-xl text-xs font-medium border flex items-center gap-2 ${
                  alert.severity === 'critical'
                    ? 'bg-red-950/80 border-red-500/50 text-red-200'
                    : alert.severity === 'warning'
                    ? 'bg-amber-950/80 border-amber-500/50 text-amber-200'
                    : 'bg-[#17402C] border-[#2D5A27]/40 text-white'
                }`}
              >
                <span>{alert.severity === 'critical' ? '🚨' : alert.severity === 'warning' ? '⚠️' : 'ℹ️'}</span>
                <span className="truncate">{alert.message}</span>
              </div>
            ))}
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-2 pt-1">
          <button
            onClick={handleSharePosition}
            disabled={!currentPos}
            className="w-full py-3 bg-[#2D6A4F] hover:bg-[#3D7A5F] text-white font-bold text-xs rounded-xl shadow-lg border border-[#4E9F3D]/40 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <span>📲</span>
            {copied ? '✓ Coordonnées copiées !' : 'Partager ma position GPS'}
          </button>

          {onReturnToStart && startPos && (
            <button
              onClick={() => {
                onReturnToStart();
                onClose();
              }}
              className="w-full py-3 bg-[#17402C] hover:bg-[#23563C] text-white font-bold text-xs rounded-xl border border-[#2D5A27]/50 flex items-center justify-center gap-2"
            >
              <span>↩️</span>
              Guider vers le point de départ
            </button>
          )}

          <a
            href="tel:112"
            className="w-full py-3.5 bg-gradient-to-r from-red-700 to-red-800 hover:from-red-800 hover:to-red-900 text-white font-bold text-xs rounded-xl shadow-xl flex flex-col items-center justify-center border border-red-500/50 text-center"
          >
            <div className="flex items-center gap-1.5">
              <span>📞</span>
              <span>Appeler les secours Européens (112)</span>
            </div>
            <span className="text-[9px] text-red-200/80 font-normal mt-0.5">
              Appel direct sur le réseau cellulaire le plus proche
            </span>
          </a>
        </div>
      </motion.div>
    </div>
  );
}
