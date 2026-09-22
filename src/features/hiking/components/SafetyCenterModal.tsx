'use client';

import React, { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
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
    <Modal
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title="Centre de Sécurité"
    >
      <div className="space-y-4">
        {/* GPS Coordinates Display */}
        <div className="bg-[color:var(--btn-tint)] backdrop-blur-[var(--btn-blur)] saturate-[var(--btn-saturate)] lkv-rim-btn border border-white/10 rounded-2xl p-3.5 space-y-1 text-center">
          <span className="text-[10px] text-[color:var(--sage-400)] font-mono uppercase tracking-widest block">
            Coordonnées GPS WGS-84
          </span>
          <p className="font-mono font-bold text-sm text-forest-300 select-all">
            {formattedCoords}
          </p>
          {currentPos?.timestamp && (
            <p className="text-[10px] text-[color:var(--sage-400)]/70 font-mono">
              Dernier fix : {new Date(currentPos.timestamp).toLocaleTimeString('fr-FR')}
            </p>
          )}
        </div>

        {/* System Status Indicators */}
        <div className="grid grid-cols-2 gap-2 text-center text-xs font-mono">
          <div className="bg-[color:var(--btn-tint)] backdrop-blur-[var(--btn-blur)] saturate-[var(--btn-saturate)] lkv-rim-btn border border-white/10 rounded-xl p-2">
            <span className="text-[color:var(--sage-400)] text-[10px] block">RÉSEAU</span>
            <span className={isOffline ? 'text-amber-400 font-bold' : 'text-emerald-400 font-bold'}>
              {isOffline ? '🌐 Hors Ligne' : '📶 Connecté'}
            </span>
          </div>

          <div className="bg-[color:var(--btn-tint)] backdrop-blur-[var(--btn-blur)] saturate-[var(--btn-saturate)] lkv-rim-btn border border-white/10 rounded-xl p-2">
            <span className="text-[color:var(--sage-400)] text-[10px] block">BATTERIE</span>
            <span className={batteryLevel != null && batteryLevel <= 15 ? 'text-red-400 font-bold animate-pulse' : 'text-emerald-400 font-bold'}>
              🔋 {batteryLevel != null ? `${batteryLevel}%` : '—'}
            </span>
          </div>
        </div>

        {/* Active Alerts List */}
        {alerts.length > 0 && (
          <div className="space-y-1.5 max-h-28 overflow-y-auto pr-1">
            <span className="text-[10px] text-[color:var(--sage-400)] font-mono uppercase">Alertes en cours</span>
            {alerts.map((alert) => (
              <div
                key={alert.id}
                className={`p-2 rounded-xl text-xs font-medium border flex items-center gap-2 ${
                  alert.severity === 'critical'
                    ? 'bg-red-950/80 border-red-500/50 text-red-200'
                    : alert.severity === 'warning'
                    ? 'bg-amber-950/80 border-amber-500/50 text-amber-200'
                    : 'bg-[color:var(--btn-tint)] backdrop-blur-[var(--btn-blur)] saturate-[var(--btn-saturate)] lkv-rim-btn border-white/10 text-[color:var(--lkv-text-primary)]'
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
            className="w-full min-h-[44px] py-3 bg-[color:var(--lkv-primary-soft)] hover:bg-[color:var(--forest-500)] text-white font-bold text-xs rounded-xl border border-white/20 flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
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
              className="w-full min-h-[44px] py-3 bg-[color:var(--btn-tint)] backdrop-blur-[var(--btn-blur)] saturate-[var(--btn-saturate)] lkv-rim-btn hover:brightness-[1.05] text-[color:var(--lkv-text-primary)] font-bold text-xs rounded-xl border border-white/20 flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>↩️</span>
              Guider vers le point de départ
            </button>
          )}

          <a
            href="tel:112"
            className="w-full min-h-[48px] py-3.5 bg-gradient-to-r from-red-700 to-red-800 hover:from-red-800 hover:to-red-900 text-white font-bold text-xs rounded-xl flex flex-col items-center justify-center border border-red-500/50 text-center cursor-pointer"
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
      </div>
    </Modal>
  );
}
