'use client';

import React, { useState } from 'react';
import { ArrowRightLeft, Check } from 'lucide-react';

export interface MultisportLeg {
  index: number;
  label: string;
  sportSlug: string;
  startedAtMs: number;
  endedAtMs: number | null;
}

export interface MultisportLegsViewProps {
  presetLegs?: ReadonlyArray<{ label: string; sportSlug: string }>;
  onTransition?: (nextLegIndex: number, legs: MultisportLeg[]) => void;
}

const DEFAULT_TRIATHLON_LEGS = [
  { label: 'Natation', sportSlug: 'swim_open_water' },
  { label: 'Transition T1', sportSlug: 'multisport_enchainement' },
  { label: 'Vélo Route', sportSlug: 'road_cycling' },
  { label: 'Transition T2', sportSlug: 'multisport_enchainement' },
  { label: 'Course à pied', sportSlug: 'running' },
] as const;

/**
 * Lot 10 — Vue spécialisée Multisport / Triathlon / Raid (gestion enchaînements & transitions T1/T2).
 */
export function MultisportLegsView({
  presetLegs = DEFAULT_TRIATHLON_LEGS,
  onTransition,
}: MultisportLegsViewProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [legs, setLegs] = useState<MultisportLeg[]>(() =>
    presetLegs.map((l, index) => ({
      index,
      label: l.label,
      sportSlug: l.sportSlug,
      startedAtMs: index === 0 ? Date.now() : 0,
      endedAtMs: null,
    })),
  );

  const advanceLeg = () => {
    if (activeIndex >= legs.length - 1) return;
    const now = Date.now();
    const nextIdx = activeIndex + 1;
    const updated = legs.map((leg, i) => {
      if (i === activeIndex) return { ...leg, endedAtMs: now };
      if (i === nextIdx) return { ...leg, startedAtMs: now };
      return leg;
    });
    setLegs(updated);
    setActiveIndex(nextIdx);
    onTransition?.(nextIdx, updated);
  };

  return (
    <div data-testid="xp20-view-multisport-legs" className="flex flex-col gap-2.5">
      <div className="flex flex-col gap-1.5">
        {legs.map((leg, idx) => {
          const isCurrent = idx === activeIndex;
          const isDone = leg.endedAtMs !== null;
          return (
            <div
              key={leg.index}
              className="flex items-center justify-between rounded-xl px-3 py-2 text-[13px] font-bold"
              style={{
                background: isCurrent
                  ? 'var(--xp-hud-accent)'
                  : 'var(--lkv-surface-muted, #edf1ea)',
                color: isCurrent ? 'var(--xp-hud-accent-fg)' : 'var(--xp-hud-ink)',
              }}
            >
              <span className="inline-flex items-center gap-1.5">
                {isDone ? <Check size={14} aria-hidden="true" /> : null}
                <span>
                  #{idx + 1} · {leg.label}
                </span>
              </span>
              <span className="text-[11px] uppercase">
                {isCurrent ? 'En cours' : isDone ? 'Terminé' : 'À venir'}
              </span>
            </div>
          );
        })}
      </div>

      <button
        type="button"
        disabled={activeIndex >= legs.length - 1}
        onClick={advanceLeg}
        className="xp20-hud-btn inline-flex items-center justify-center gap-2 text-[14px] font-extrabold"
        style={{
          background: 'var(--xp-hud-accent)',
          color: 'var(--xp-hud-accent-fg)',
          opacity: activeIndex >= legs.length - 1 ? 0.5 : 1,
        }}
      >
        <ArrowRightLeft size={15} aria-hidden="true" />
        <span>
          {activeIndex < legs.length - 1
            ? `Passer à : ${legs[activeIndex + 1]?.label}`
            : 'Dernier segment en cours'}
        </span>
      </button>
    </div>
  );
}
