'use client';

import { useEffect, useState } from 'react';
import { useKitSheet } from '@/features/kits/KitSheetContext';
import { conservationPhrase, survivalRate } from '@/features/kits/trust';

interface DiscoveryItem {
  item_key: string;
  product_id: string | null;
  kept_count: number;
  dropped_count: number;
}

interface DiscoveryLineage {
  kit_id: string;
  kit_name: string;
  propagation_score: number;
  endurance_score: number;
  sessions_count: number;
}

interface DiscoveryData {
  items: DiscoveryItem[];
  lineages: DiscoveryLineage[];
}

/**
 * Découverte (Lot 7) — deux entrées, jamais un palmarès :
 *   • « Ce qui revient du terrain » : items à forte conservation (éprouvés).
 *   • « Lignées endurantes » : kits stables, beaucoup emportés.
 * Aucun compteur de partages. Clic sur une lignée → KitSheet.
 */
export default function LineageDiscovery() {
  const [data, setData] = useState<DiscoveryData | null>(null);
  const { openKit } = useKitSheet();

  useEffect(() => {
    let active = true;
    fetch('/api/kits/discovery')
      .then((r) => (r.ok ? r.json() : null))
      .then((d: DiscoveryData | null) => {
        if (active) setData(d);
      })
      .catch(() => {
        if (active) setData(null);
      });
    return () => {
      active = false;
    };
  }, []);

  if (!data) return null;
  const items = (data.items ?? []).filter((i) => (survivalRate(i.kept_count, i.dropped_count) ?? 0) >= 0.5).slice(0, 8);
  const lineages = (data.lineages ?? []).slice(0, 8);

  if (items.length === 0 && lineages.length === 0) return null;

  return (
    <section className="flex flex-col gap-5">
      {items.length > 0 && (
        <div>
          <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.18em] text-[color:var(--lkv-primary)]">
            Ce qui revient du terrain
          </div>
          <div className="flex flex-wrap gap-2">
            {items.map((i) => {
              const rate = survivalRate(i.kept_count, i.dropped_count) ?? 0;
              return (
                <span
                  key={i.item_key}
                  className="rounded-full border border-[color:var(--lkv-border)] bg-[color:var(--lkv-surface-muted)] px-3 py-1.5 text-[12px] text-[color:var(--lkv-primary)]"
                  title={i.item_key}
                >
                  {conservationPhrase(rate)} · {i.item_key.slice(0, 24)}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {lineages.length > 0 && (
        <div>
          <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.18em] text-[color:var(--lkv-primary)]">
            Lignées endurantes
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {lineages.map((l) => (
              <button
                key={l.kit_id}
                type="button"
                onClick={() => openKit(l.kit_id, 'discovery')}
                className="rounded-2xl border border-[color:var(--lkv-border)] bg-[color:var(--lkv-surface)] p-3.5 text-left transition-colors hover:border-[color:var(--lkv-primary)]/40"
              >
                <div className="truncate text-[14px] font-medium text-[color:var(--lkv-primary)]">
                  {l.kit_name}
                </div>
                <div className="mt-1 flex items-center justify-between font-mono text-[11px] text-[color:var(--lkv-text-muted)]">
                  <span>{l.sessions_count} sorties terrain</span>
                  <span className="text-[color:var(--lkv-primary)]">Endurance {l.endurance_score.toFixed(2)}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}