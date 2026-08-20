'use client';
import { useState } from 'react';
import { GlassCard } from '@/components/ui/GlassCard';
import { Eyebrow } from '@/components/ui/Eyebrow';
import { Metric } from '@/components/ui/Metric';
import { ForgetChecklistItem } from '@/features/materiel/components/forget/ForgetChecklistItem';

const DEFAULT_ITEMS = [
  'Tente & arceaux', 'Sac de couchage', 'Matelas isolant', 'Réchaud + gaz',
  'Trousse de secours', 'Lampe frontale', 'Filtre à eau', 'Veste imperméable',
  'Piles de rechange', 'Carte & boussole',
];

export function ForgetChecklist({ initialItems = DEFAULT_ITEMS }: { initialItems?: string[] }) {
  const [state, setState] = useState<Record<string, boolean>>({});
  const checkedCount = Object.values(state).filter(Boolean).length;

  return (
    <GlassCard className="p-4" aria-labelledby="forget-checklist">
      <div className="flex items-center justify-between mb-3">
        <Eyebrow>À ne pas oublier</Eyebrow>
        <Metric value={`${checkedCount}/${initialItems.length}`} size="md" />
      </div>
      <ul className="flex flex-col gap-2">
        {initialItems.map((label) => (
          <li key={label}>
            <ForgetChecklistItem
              label={label}
              checked={!!state[label]}
              onToggle={() => setState((s) => ({ ...s, [label]: !s[label] }))}
            />
          </li>
        ))}
      </ul>
    </GlassCard>
  );
}
