'use client';
import { useMemo, useState } from 'react';
import { Badge, Card } from '@/components/ui';
import { Eyebrow } from '@/components/ui/Eyebrow';
import { compareKits } from '@/lib/materiel/comparator';
import type { KitListItem } from '@/features/materiel/services/getKits';

const FIELD_CLASS =
  'min-h-[var(--control-height-md)] min-w-[110px] flex-1 rounded-[var(--lkv-radius-control)] border border-[color:var(--lkv-border)] bg-[color:var(--lkv-field-bg)] px-[var(--space-3)] text-xs text-[var(--lkv-primary)] sm:text-sm';

/** W-K-6 KitComparator — compare 2 kits réels en Liquid Glass. */
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
    <Card as="article" tone="sage" ariaLabelledBy="comparator-title" className="p-4 sm:p-5">
      <Eyebrow>Comparateur de kits</Eyebrow>
      <h3 id="comparator-title" className="font-display font-bold text-[20px] text-[var(--lkv-primary)] mt-0.5 mb-3">Différentiel de poids</h3>
      <div className="flex items-center gap-2">
        <select
          value={aId}
          onChange={(e) => setAId(e.target.value)}
          aria-label="Kit A"
          className={FIELD_CLASS}
        >
          {active.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}
        </select>
        <span className="text-xs font-bold text-[var(--lkv-text-muted)]">VS</span>
        <select
          value={bId}
          onChange={(e) => setBId(e.target.value)}
          aria-label="Kit B"
          className={FIELD_CLASS}
        >
          {active.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}
        </select>
      </div>

      {result && (
        <Card variant="compact" className="mt-3.5 flex flex-col gap-3 p-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge tone="sage">A: {(result.aTotalG / 1000).toFixed(1)} kg</Badge>
            <Badge tone="info">B: {(result.bTotalG / 1000).toFixed(1)} kg</Badge>
            <span className="text-xs font-mono font-bold text-[var(--lkv-primary)]">
              Δ {(result.deltaG / 1000).toFixed(1)} kg ({result.deltaPct}%)
            </span>
          </div>
          <div>
            <p className="text-xs font-semibold text-[var(--lkv-primary-soft)] mb-1.5">Poids par catégorie</p>
            <ul tabIndex={0} className="flex flex-col gap-1 max-h-40 overflow-y-auto rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lkv-primary)]">
              {result.categories.map((c) => (
                <li key={c.category} className="flex items-center justify-between rounded-lg border border-[color:var(--lkv-border-subtle)] p-2 text-xs">
                  <span className="font-medium text-[var(--lkv-primary)]">{c.category}</span>
                  <span className="font-mono text-[var(--lkv-primary-soft)]">{(c.aG / 1000).toFixed(2)} vs {(c.bG / 1000).toFixed(2)} kg</span>
                </li>
              ))}
            </ul>
          </div>
        </Card>
      )}
      {!result && <p className="mt-3 text-xs text-[var(--lkv-text-muted)]">Sélectionnez deux kits distincts pour afficher la comparaison.</p>}
    </Card>
  );
}
