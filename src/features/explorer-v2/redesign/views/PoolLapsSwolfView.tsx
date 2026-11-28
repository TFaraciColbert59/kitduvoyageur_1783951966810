'use client';

import React, { useState } from 'react';
import { Plus, Waves } from 'lucide-react';

export interface PoolLapRecord {
  lapIndex: number;
  lengthM: 25 | 50;
  durationS: number;
  strokes: number;
  swolf: number;
}

export interface PoolLapsSwolfViewProps {
  onLapRecorded?: (lap: PoolLapRecord, totalDistanceM: number) => void;
}

/**
 * Lot 10 — Vue spécialisée Natation Piscine (25 m / 50 m + calcul SWOLF + allure /100m).
 * SWOLF = durée d'une longueur (s) + nombre de coups de bras sur cette longueur.
 */
export function PoolLapsSwolfView({ onLapRecorded }: PoolLapsSwolfViewProps) {
  const [poolLengthM, setPoolLengthM] = useState<25 | 50>(25);
  const [strokesPerLap, setStrokesPerLap] = useState(18);
  const [lapDurationS, setLapDurationS] = useState(24);
  const [laps, setLaps] = useState<PoolLapRecord[]>([]);

  const totalDistanceM = laps.reduce((acc, l) => acc + l.lengthM, 0);
  const totalTimeS = laps.reduce((acc, l) => acc + l.durationS, 0);
  const avgSwolf =
    laps.length > 0 ? Math.round(laps.reduce((acc, l) => acc + l.swolf, 0) / laps.length) : 0;
  const pace100mS = totalDistanceM > 0 ? Math.round((totalTimeS / totalDistanceM) * 100) : 0;

  const recordLap = () => {
    const lap: PoolLapRecord = {
      lapIndex: laps.length + 1,
      lengthM: poolLengthM,
      durationS: Math.max(5, lapDurationS),
      strokes: Math.max(1, strokesPerLap),
      swolf: Math.max(5, lapDurationS) + Math.max(1, strokesPerLap),
    };
    const next = [...laps, lap];
    setLaps(next);
    onLapRecorded?.(lap, next.reduce((acc, l) => acc + l.lengthM, 0));
  };

  return (
    <div data-testid="xp20-view-pool-swolf" className="flex flex-col gap-3">
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-2xl p-2.5" style={{ background: 'var(--lkv-surface-elevated, #ffffff)', border: '0.5px solid var(--xp-hud-border)' }}>
          <span className="block text-[10.5px] font-bold uppercase" style={{ color: 'var(--xp-hud-ink-muted)' }}>Distance</span>
          <strong className="text-[18px] font-black">{totalDistanceM} m</strong>
        </div>
        <div className="rounded-2xl p-2.5" style={{ background: 'var(--lkv-surface-elevated, #ffffff)', border: '0.5px solid var(--xp-hud-border)' }}>
          <span className="block text-[10.5px] font-bold uppercase" style={{ color: 'var(--xp-hud-ink-muted)' }}>SWOLF moy.</span>
          <strong className="text-[18px] font-black">{avgSwolf}</strong>
        </div>
        <div className="rounded-2xl p-2.5" style={{ background: 'var(--lkv-surface-elevated, #ffffff)', border: '0.5px solid var(--xp-hud-border)' }}>
          <span className="block text-[10.5px] font-bold uppercase" style={{ color: 'var(--xp-hud-ink-muted)' }}>Allure /100m</span>
          <strong className="text-[18px] font-black">
            {pace100mS > 0 ? `${Math.floor(pace100mS / 60)}:${String(pace100mS % 60).padStart(2, '0')}` : '0:00'}
          </strong>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {([25, 50] as const).map((len) => (
          <button
            key={len}
            type="button"
            aria-pressed={poolLengthM === len}
            onClick={() => setPoolLengthM(len)}
            className="xp20-hud-btn flex-1 text-[13px] font-bold"
            style={{
              background: poolLengthM === len ? 'var(--xp-hud-accent)' : 'var(--lkv-surface-muted, #edf1ea)',
              color: poolLengthM === len ? 'var(--xp-hud-accent-fg)' : 'var(--xp-hud-ink)',
            }}
          >
            Bassin {len} m
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col text-[11px] font-bold">
          <span>Durée longueur (s)</span>
          <input
            type="number"
            min={5}
            value={lapDurationS}
            onChange={(e) => setLapDurationS(Number(e.target.value))}
            className="mt-1 h-11 rounded-xl px-2 text-center text-[15px] font-black"
            style={{ background: 'var(--lkv-surface-muted, #edf1ea)' }}
          />
        </label>
        <label className="flex flex-col text-[11px] font-bold">
          <span>Coups de bras</span>
          <input
            type="number"
            min={1}
            value={strokesPerLap}
            onChange={(e) => setStrokesPerLap(Number(e.target.value))}
            className="mt-1 h-11 rounded-xl px-2 text-center text-[15px] font-black"
            style={{ background: 'var(--lkv-surface-muted, #edf1ea)' }}
          />
        </label>
      </div>

      <button
        type="button"
        onClick={recordLap}
        className="xp20-hud-btn inline-flex items-center justify-center gap-2 text-[14px] font-extrabold"
        style={{ background: 'var(--xp-hud-accent)', color: 'var(--xp-hud-accent-fg)' }}
      >
        <Waves size={16} aria-hidden="true" />
        <Plus size={15} aria-hidden="true" />
        <span>Ajouter 1 longueur ({poolLengthM} m · SWOLF {lapDurationS + strokesPerLap})</span>
      </button>
    </div>
  );
}
