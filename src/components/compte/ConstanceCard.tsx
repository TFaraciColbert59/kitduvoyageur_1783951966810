'use client';

import React, { useState } from 'react';
import { Badge, Button } from '@/components/ui';
import { UserProfile } from '@/lib/mock/compte-marceline';

interface ConstanceCardProps {
  constance: UserProfile['stats'] & any;
}

export default function ConstanceCard({ constance }: ConstanceCardProps) {
  const [activeDayIndex, setActiveDayIndex] = useState<number | null>(6);

  const days = [
    { name: 'L', count: 1, label: 'Lundi' },
    { name: 'M', count: 0, label: 'Mardi' },
    { name: 'M', count: 2, label: 'Mercredi' },
    { name: 'J', count: 0, label: 'Jeudi' },
    { name: 'V', count: 1, label: 'Vendredi' },
    { name: 'S', count: 3, label: 'Samedi' },
    { name: 'D', count: 2, label: "Dimanche (Aujourd'hui)" },
  ];

  return (
    <div className="bg-[color:var(--card-tint-strong)] border border-[color:var(--glass-border)] shadow-elevation-1 backdrop-blur-[var(--blur-lg)] p-3.5 space-y-2.5 rounded-2xl text-[color:var(--lkv-primary)] font-sans">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <h3 className="font-display font-bold text-xs text-[color:var(--lkv-primary)]">Constance &amp; Rythme</h3>
        </div>
        <Badge tone="warn" className="text-[9px] font-mono font-bold">
          🔥 6 sem.
        </Badge>
      </div>

      {/* 7 Days in compact row */}
      <div className="grid grid-cols-7 gap-1 pt-0.5">
        {days.map((d, idx) => {
          const isSelected = activeDayIndex === idx;
          const hasActivity = d.count > 0;

          return (
            <Button
              key={d.name + idx}
              variant={isSelected ? 'primary' : 'secondary'}
              size="sm"
              aria-pressed={isSelected}
              onClick={() => setActiveDayIndex(idx)}
              title={`${d.label} : ${d.count} sortie(s)`}
              className="h-auto min-h-[var(--control-height-xs)] flex-col items-center justify-between gap-0 px-0.5 py-1.5"
            >
              <span className="text-[9.5px] font-mono font-bold">{d.name}</span>
              <div className="mt-1 flex items-center justify-center">
                {hasActivity ? (
                  <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-[color:var(--sage-300)]' : 'bg-[color:var(--lkv-secondary)]'}`} />
                ) : (
                  <span className="w-1 h-1 rounded-full bg-[color:var(--lkv-primary)]/15" />
                )}
              </div>
            </Button>
          );
        })}
      </div>

      {/* Info footer */}
      <div className="flex items-center justify-between text-[9.5px] font-mono pt-1 border-t border-[color:var(--lkv-primary)]/5">
        <span className="text-[color:var(--lkv-text-muted)]">
          {activeDayIndex !== null && days[activeDayIndex].count > 0
            ? `${days[activeDayIndex].label}: ${days[activeDayIndex].count} sortie(s)`
            : '3 sorties cette semaine'}
        </span>
        <span className="text-[color:var(--lkv-secondary)] font-bold">Objectif atteint ✓</span>
      </div>
    </div>
  );
}
