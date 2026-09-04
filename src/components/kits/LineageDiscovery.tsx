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
          <div className="font-mono text-[10px] tracking-[0.18em] uppercase mb-2" style={{ color: '#17402C' }}>
            Ce qui revient du terrain
          </div>
          <div className="flex flex-wrap gap-2">
            {items.map((i) => {
              const rate = survivalRate(i.kept_count, i.dropped_count) ?? 0;
              return (
                <span
                  key={i.item_key}
                  className="px-3 py-1.5 rounded-full text-[12px]"
                  style={{ background: '#EDF3ED', border: '1px solid rgba(166,193,160,0.6)', color: '#17402C' }}
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
          <div className="font-mono text-[10px] tracking-[0.18em] uppercase mb-2" style={{ color: '#17402C' }}>
            Lignées endurantes
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {lineages.map((l) => (
              <button
                key={l.kit_id}
                type="button"
                onClick={() => openKit(l.kit_id, 'discovery')}
                className="text-left p-3.5 rounded-2xl border transition-colors hover:border-[#17402C]/40"
                style={{ background: '#FBFAF6', borderColor: 'rgba(166,193,160,0.5)' }}
              >
                <div className="text-[14px] font-medium truncate" style={{ color: '#17402C' }}>
                  {l.kit_name}
                </div>
                <div className="mt-1 flex items-center justify-between font-mono text-[11px]" style={{ color: '#6B7A72' }}>
                  <span>{l.sessions_count} sorties terrain</span>
                  <span style={{ color: '#17402C' }}>Endurance {l.endurance_score.toFixed(2)}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}