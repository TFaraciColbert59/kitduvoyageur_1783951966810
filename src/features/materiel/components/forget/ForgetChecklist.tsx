'use client';
import { useState } from 'react';
import { GlassCard } from '@/components/ui/GlassCard';
import { Eyebrow } from '@/components/ui/Eyebrow';
import { Metric } from '@/components/ui/Metric';
import { ForgetChecklistItem } from './ForgetChecklistItem';
import type { ForgetItem } from '@/features/materiel/services/getForgetChecklist';

/** ForgetChecklist — « à ne pas oublier » connecté à materiel_kit_items (is_checked). */
export function ForgetChecklist({ items, onToggle }: { items: ForgetItem[]; onToggle?: (item: ForgetItem) => void }) {
  const [state, setState] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(items.map((i) => [i.id, i.is_checked]))
  );
  const checkedCount = Object.values(state).filter(Boolean).length;

  const toggle = (item: ForgetItem) => {
    const next = !state[item.id];
    setState((s) => ({ ...s, [item.id]: next }));
    onToggle?.(item);
  };

  return (
    <GlassCard className="p-4" aria-labelledby="forget-checklist">
      <div className="flex items-center justify-between mb-3">
        <Eyebrow>À ne pas oublier</Eyebrow>
        <Metric value={`${checkedCount}/${items.length}`} size="md" />
      </div>
      <ul className="flex flex-col gap-2">
        {items.map((item) => (
          <li key={item.id}>
            <ForgetChecklistItem
              label={item.name}
              checked={!!state[item.id]}
              onToggle={() => toggle(item)}
            />
          </li>
        ))}
        {items.length === 0 && <li className="text-sm text-[color:var(--label-secondary)]">Aucun article dans votre kit actif.</li>}
      </ul>
    </GlassCard>
  );
}
