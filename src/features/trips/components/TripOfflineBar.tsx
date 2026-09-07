'use client';

import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff, HardDriveDownload, CheckCircle2 } from 'lucide-react';
import { saveTripOffline, isTripAvailableOffline } from '../offline/tripOfflineStorage';
import type { TripFull } from '../types/trip.types';

interface TripOfflineBarProps {
  trip: TripFull;
}

export function TripOfflineBar({ trip }: TripOfflineBarProps) {
  const [isOnline, setIsOnline] = useState(true);
  const [isSavedOffline, setIsSavedOffline] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsOnline(navigator.onLine);
      setIsSavedOffline(isTripAvailableOffline(trip.slug));

      const handleOnline = () => setIsOnline(true);
      const handleOffline = () => setIsOnline(false);

      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);

      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      };
    }
  }, [trip.slug]);

  const handleSaveOffline = () => {
    const ok = saveTripOffline(trip);
    if (ok) {
      setIsSavedOffline(true);
      setFeedback('Expédition synchronisée hors-ligne sur cet appareil.');
      setTimeout(() => setFeedback(null), 3000);
    }
  };

  return (
    <div className="w-full">
      {!isOnline && (
        <div className="mb-4 p-3 rounded-2xl bg-[var(--lkv-accent)]/10 border border-[var(--lkv-accent)]/20 text-forest-900 text-xs flex items-center justify-between gap-2 animate-in fade-in">
          <div className="flex items-center gap-2">
            <WifiOff size={16} className="text-[var(--lkv-accent)] shrink-0" />
            <span>
              <strong>Mode hors-ligne :</strong> Vous êtes déconnecté du réseau. Consultation des données locales actives.
            </span>
          </div>
          {isSavedOffline && (
            <span className="text-[10px] font-bold uppercase tracking-wider bg-[var(--lkv-accent)]/20 px-2 py-0.5 rounded-full text-forest-900">
              Synchronisé
            </span>
          )}
        </div>
      )}

      {feedback && (
        <div className="mb-4 p-3 rounded-2xl bg-sage-50 border border-sage-200 text-forest-800 text-xs flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 size={16} className="text-[var(--lkv-success)] shrink-0" />
          <span>{feedback}</span>
        </div>
      )}

      <div className="flex items-center justify-between text-xs text-lkv-secondary px-1">
        <div className="flex items-center gap-1.5">
          {isOnline ? (
            <span className="flex items-center gap-1 text-[var(--lkv-success)]">
              <Wifi size={13} />
              <span>Connecté</span>
            </span>
          ) : (
            <span className="flex items-center gap-1 text-[var(--lkv-accent)]">
              <WifiOff size={13} />
              <span>Hors-ligne</span>
            </span>
          )}
          <span>·</span>
          <span>
            {isSavedOffline ? 'Disponible hors-ligne' : 'Non synchronisé en local'}
          </span>
        </div>

        {!isSavedOffline && (
          <button
            onClick={handleSaveOffline}
            className="flex items-center gap-1 font-semibold text-lkv-primary hover:text-lkv-secondary transition-colors py-1 px-2 rounded-lg hover:bg-black/5"
          >
            <HardDriveDownload size={13} />
            <span>Garder hors-ligne</span>
          </button>
        )}
      </div>
    </div>
  );
}
