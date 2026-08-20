'use client';
import { useMemo, useState } from 'react';
import { GlassCard } from '@/components/ui/GlassCard';
import { Eyebrow } from '@/components/ui/Eyebrow';
import { Badge } from '@/components/ui/Badge';
import { compareKits } from '@/lib/materiel/comparator';
import type { KitListItem } from '@/features/materiel/services/getKits';

/** W-K-6 KitComparator — compare 2 kits réels (lib/materiel/comparator). */
export function KitComparator({ kits }: { kits: KitListItem[] }) {
  const active = kits.filter((k) => !k.is_trashed);
  const [aId, setAId] = useState(active[0]?.id ?? '');
  const [bId, setBId] = useState(active[1]?.id ?? '');

  const result = useMemo(() => {
    const a = active.find((k) => k.id === aId);
    const b = active.find((k) => k.id === bId);
    if (!a || !b || a.id === b.id) return null;
    return compareKits(a.items, b.items);
  }, [active, aId, bId]);

  return (
    <GlassCard as="article" ariaLabelledBy="comparator-title" className="p-4">
      <Eyebrow>Comparateur</Eyebrow>
      <h3 id="comparator-title" className="sr-only">Comparer deux kits</h3>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <select value={aId} onChange={(e) => setAId(e.target.value)} aria-label="Kit A" className="glass-input flex-1 min-w-[120px]">
          {active.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}
        </select>
        <span className="text-sm text-[color:var(--label-tertiary)]">vs</span>
        <select value={bId} onChange={(e) => setBId(e.target.value)} aria-label="Kit B" className="glass-input flex-1 min-w-[120px]">
          {active.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}
        </select>
      </div>

      {result && (
        <div className="mt-3 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Badge tone="sage">A: {(result.aTotalG / 1000).toFixed(1)} kg</Badge>
            <Badge tone="info">B: {(result.bTotalG / 1000).toFixed(1)} kg</Badge>
            <span className="text-xs text-[color:var(--label-secondary)]">
              Δ {(result.deltaG / 1000).toFixed(1)} kg ({result.deltaPct}%)
            </span>
          </div>
          <div>
            <p className="text-xs text-[color:var(--label-tertiary)] mb-1">Poids par catégorie</p>
            <ul className="flex flex-col gap-1">
              {result.categories.map((c) => (
                <li key={c.category} className="flex items-center justify-between text-sm">
                  <span className="text-[color:var(--label)]">{c.category}</span>
                  <span className="text-xs text-[color:var(--label-secondary)]">{(c.aG / 1000).toFixed(2)} vs {(c.bG / 1000).toFixed(2)} kg</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
      {!result && <p className="mt-2 text-xs text-[color:var(--label-tertiary)]">Sélectionnez deux kits différents.</p>}
    </GlassCard>
  );
}
