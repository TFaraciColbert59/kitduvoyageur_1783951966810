'use client';

import React, { useState } from 'react';
import type { FieldCheckIn, CheckInStatus } from '../../types/expeditionRooms.types';
import { formatEmergencyCoordinates, getCheckInSeverity } from '../../types/expeditionRooms.types';

export interface FieldCheckInsPaneProps {
  lastCheckIn?: FieldCheckIn | null;
  checkins?: FieldCheckIn[];
  onBroadcastCheckin?: (status: CheckInStatus, message?: string) => Promise<void> | void;
  currentUserId?: string;
  currentUserName?: string;
  isBroadcasting?: boolean;
  className?: string;
}

const BROADCAST_BUTTON_STYLES: Record<CheckInStatus, { label: string; style: string }> = {
  ok: {
    label: 'OK · Tout va bien',
    style: 'bg-forest-600/15 text-forest-800 dark:text-forest-200 border-forest-600/30 hover:bg-forest-600/25',
  },
  camp_set: {
    label: 'Bivouac établi',
    style: 'bg-sky-600/15 text-sky-800 dark:text-sky-200 border-sky-600/30 hover:bg-sky-600/25',
  },
  delayed: {
    label: 'Retard signalé',
    style: 'bg-sand-500/20 text-sand-800 dark:text-sand-200 border-sand-500/40 hover:bg-sand-500/30',
  },
  sos: {
    label: 'Alerte SOS',
    style: 'bg-rose-600/20 text-rose-800 dark:text-rose-200 border-rose-600/40 hover:bg-rose-600/30 animate-pulse',
  },
};

export const FieldCheckInsPane: React.FC<FieldCheckInsPaneProps> = ({
  lastCheckIn,
  checkins = [],
  onBroadcastCheckin,
  isBroadcasting = false,
  className = '',
}) => {
  const [customNote, setCustomNote] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<CheckInStatus | null>(null);

  const handleBroadcast = async (status: CheckInStatus) => {
    setSelectedStatus(status);
    await onBroadcastCheckin?.(status, customNote.trim() || undefined);
    setCustomNote('');
    setSelectedStatus(null);
  };

  const activeCheckin = lastCheckIn || (checkins.length > 0 ? checkins[0] : null);
  const severity = activeCheckin ? getCheckInSeverity(activeCheckin.status) : 'normal';

  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      {/* Active Safety Banner if SOS or Delayed */}
      {activeCheckin && (severity === 'critical' || severity === 'warning') && (
        <div
          role="alert"
          className={`flex flex-col gap-1 rounded-2xl border p-3.5 shadow-elevation-1 ${
            severity === 'critical'
              ? 'border-rose-600/50 bg-rose-500/15 text-rose-900 dark:text-rose-200'
              : 'border-sand-500/50 bg-sand-500/20 text-sand-900 dark:text-sand-100'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-bold">
            <span>
              {severity === 'critical' ? '🚨 ALERTE DETRESSE SOS EN COURS' : '⚠️ ATTENTION : RETARD SUR HORAIRE'}
            </span>
            <span className="font-mono text-[10px] uppercase">{activeCheckin.status}</span>
          </div>
          <p className="text-xs">
            {activeCheckin.message ||
              (severity === 'critical'
                ? 'Assistance requise immédiatement.'
                : 'Progression ralentie sur le terrain.')}
          </p>
          {activeCheckin.location && (
            <div className="mt-1 font-mono text-[11px] font-semibold opacity-90">
              Coordonnées :{' '}
              {formatEmergencyCoordinates(
                activeCheckin.location.latitude,
                activeCheckin.location.longitude
              )}
            </div>
          )}
        </div>
      )}

      {/* Latest Check-in Overview Card */}
      <div className="flex flex-col gap-1.5">
        <h3 className="text-xs font-semibold text-[color:var(--lkv-text-primary)]">
          Dernier Check-in Terrain
        </h3>

        {activeCheckin ? (
          <div className="rounded-2xl border border-[color:var(--glass-border)] bg-[color:var(--glass-bg-subtle)] p-3 text-xs shadow-sm">
            <div className="flex items-center justify-between">
              <div className="font-bold text-[color:var(--lkv-text-primary)]">
                {activeCheckin.authorName} ({activeCheckin.status.toUpperCase()})
              </div>
              <span className="text-[10px] text-[color:var(--lkv-text-secondary)]">
                {new Date(activeCheckin.timestamp).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>
            <div className="mt-1 text-[color:var(--lkv-text-primary)]">
              {activeCheckin.message || 'Position transmise'}
            </div>
            {activeCheckin.location && (
              <div className="mt-1.5 flex items-center gap-2 text-[10px] text-[color:var(--lkv-text-secondary)]">
                {activeCheckin.location.name && <span>📍 {activeCheckin.location.name}</span>}
                <span>
                  {formatEmergencyCoordinates(
                    activeCheckin.location.latitude,
                    activeCheckin.location.longitude
                  )}
                </span>
                {activeCheckin.batteryPercent != null && (
                  <span>🔋 {activeCheckin.batteryPercent}%</span>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-2xl border border-[color:var(--glass-border)] bg-[color:var(--glass-bg-subtle)] p-4 text-center text-xs text-[color:var(--lkv-text-secondary)]">
            Aucun check-in pour l&apos;instant
          </div>
        )}
      </div>

      {/* 4-Status Quick Broadcast Bar */}
      {onBroadcastCheckin && (
        <div className="flex flex-col gap-2 pt-1 border-t border-[color:var(--glass-border)]">
          <span className="text-xs font-semibold text-[color:var(--lkv-text-primary)]">
            Émettre un point de situation
          </span>

          <input
            type="text"
            value={customNote}
            onChange={(e) => setCustomNote(e.target.value)}
            placeholder="Note facultative (ex: Passage délicat, bivouac au col...)"
            className="h-[44px] min-h-[44px] w-full rounded-xl border border-[color:var(--glass-border)] bg-[color:var(--glass-bg-subtle)] px-3 text-xs text-[color:var(--lkv-text-primary)] placeholder:text-[color:var(--lkv-text-secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--lkv-primary)]"
          />

          <div className="grid grid-cols-2 gap-2">
            {(['ok', 'camp_set', 'delayed', 'sos'] as CheckInStatus[]).map((st) => {
              const meta = BROADCAST_BUTTON_STYLES[st];
              const isLoading = isBroadcasting && selectedStatus === st;

              return (
                <button
                  key={st}
                  type="button"
                  disabled={isBroadcasting}
                  onClick={() => handleBroadcast(st)}
                  className={`flex h-[44px] min-h-[44px] items-center justify-center rounded-xl border px-2.5 text-xs font-semibold transition-all active:scale-[0.98] disabled:opacity-50 ${meta.style}`}
                >
                  {isLoading ? 'Transmission...' : meta.label}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
