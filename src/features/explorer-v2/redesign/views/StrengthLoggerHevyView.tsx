'use client';

import React, { useMemo, useState } from 'react';
import { Check, Dumbbell, Plus, Timer } from 'lucide-react';

export interface StrengthSetEntry {
  id: string;
  exercise: string;
  weightKg: number;
  reps: number;
  rpe: number;
  done: boolean;
}

export interface StrengthLoggerHevyViewProps {
  initialExercise?: string;
  onLogSet?: (entry: StrengthSetEntry, totalTonnageKg: number) => void;
}

/**
 * Lot 10 — Vue spécialisée Musculation / Force style Hevy (lazy-loaded).
 * Saisie ultra-rapide séries × reps × charge kg + calcul tonnage cumulé + chrono repos.
 */
export function StrengthLoggerHevyView({
  initialExercise = 'Squat barre',
  onLogSet,
}: StrengthLoggerHevyViewProps) {
  const [exercise, setExercise] = useState(initialExercise);
  const [weightKg, setWeightKg] = useState(60);
  const [reps, setReps] = useState(8);
  const [rpe, setRpe] = useState(7);
  const [sets, setSets] = useState<StrengthSetEntry[]>([]);
  const [restSeconds, setRestSeconds] = useState(90);

  const totalTonnageKg = useMemo(
    () => sets.reduce((sum, s) => sum + (s.done ? s.weightKg * s.reps : 0), 0),
    [sets],
  );

  const addSet = () => {
    const entry: StrengthSetEntry = {
      id: `set-${Date.now()}-${sets.length + 1}`,
      exercise: exercise.trim() || 'Exercice',
      weightKg: Math.max(0, weightKg),
      reps: Math.max(1, reps),
      rpe: Math.max(1, Math.min(10, rpe)),
      done: true,
    };
    const next = [...sets, entry];
    setSets(next);
    const nextTonnage = next.reduce((sum, s) => sum + (s.done ? s.weightKg * s.reps : 0), 0);
    onLogSet?.(entry, nextTonnage);
  };

  return (
    <div data-testid="xp20-view-strength-hevy" className="flex flex-col gap-3">
      <div className="flex items-center justify-between rounded-2xl p-3" style={{ background: 'var(--lkv-surface-elevated, #ffffff)', border: '0.5px solid var(--xp-hud-border)' }}>
        <div className="flex items-center gap-2">
          <Dumbbell size={18} aria-hidden="true" />
          <div>
            <div className="text-[11px] font-bold uppercase" style={{ color: 'var(--xp-hud-ink-muted)' }}>Tonnage cumulé</div>
            <strong className="text-[20px] font-black" style={{ fontVariantNumeric: 'tabular-nums' }}>{totalTonnageKg} kg</strong>
          </div>
        </div>
        <div className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-bold" style={{ background: 'var(--lkv-surface-muted, #edf1ea)' }}>
          <Timer size={14} aria-hidden="true" />
          <span>Repos {restSeconds} s</span>
          <button type="button" onClick={() => setRestSeconds((v) => (v >= 180 ? 60 : v + 30))} className="ml-1 underline">
            +30 s
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-2 rounded-2xl p-3" style={{ background: 'var(--lkv-surface-elevated, #ffffff)', border: '0.5px solid var(--xp-hud-border)' }}>
        <input
          type="text"
          aria-label="Nom de l'exercice"
          value={exercise}
          onChange={(e) => setExercise(e.target.value)}
          className="h-11 rounded-xl px-3 text-[14px] font-bold"
          style={{ background: 'var(--lkv-surface-muted, #edf1ea)' }}
        />
        <div className="grid grid-cols-3 gap-2">
          <label className="flex flex-col text-[11px] font-bold">
            <span>Charge (kg)</span>
            <input
              type="number"
              min={0}
              step={2.5}
              value={weightKg}
              onChange={(e) => setWeightKg(Number(e.target.value))}
              className="mt-1 h-11 rounded-xl px-2 text-center text-[15px] font-black"
              style={{ background: 'var(--lkv-surface-muted, #edf1ea)' }}
            />
          </label>
          <label className="flex flex-col text-[11px] font-bold">
            <span>Répétitions</span>
            <input
              type="number"
              min={1}
              value={reps}
              onChange={(e) => setReps(Number(e.target.value))}
              className="mt-1 h-11 rounded-xl px-2 text-center text-[15px] font-black"
              style={{ background: 'var(--lkv-surface-muted, #edf1ea)' }}
            />
          </label>
          <label className="flex flex-col text-[11px] font-bold">
            <span>RPE (1–10)</span>
            <input
              type="number"
              min={1}
              max={10}
              value={rpe}
              onChange={(e) => setRpe(Number(e.target.value))}
              className="mt-1 h-11 rounded-xl px-2 text-center text-[15px] font-black"
              style={{ background: 'var(--lkv-surface-muted, #edf1ea)' }}
            />
          </label>
        </div>

        <button
          type="button"
          onClick={addSet}
          className="xp20-hud-btn inline-flex items-center justify-center gap-2 text-[14px] font-extrabold"
          style={{ background: 'var(--xp-hud-accent)', color: 'var(--xp-hud-accent-fg)' }}
        >
          <Plus size={16} aria-hidden="true" />
          <span>Valider la série ({weightKg * reps} kg)</span>
        </button>
      </div>

      {sets.length > 0 ? (
        <ul className="flex flex-col gap-1.5">
          {sets.map((s, idx) => (
            <li
              key={s.id}
              className="flex items-center justify-between rounded-xl px-3 py-2 text-[12.5px] font-bold"
              style={{ background: 'var(--lkv-surface-muted, #edf1ea)' }}
            >
              <span className="inline-flex items-center gap-1.5">
                <Check size={14} aria-hidden="true" />
                #{idx + 1} · {s.exercise}
              </span>
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                {s.weightKg} kg × {s.reps} (RPE {s.rpe})
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
