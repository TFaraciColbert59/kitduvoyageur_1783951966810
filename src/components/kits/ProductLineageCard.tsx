'use client';

import { useEffect, useState } from 'react';
import { useKitSheet } from '@/features/kits/KitSheetContext';

interface LineageStats {
  lineages_count: number;
  lineage_root_id: string | null;
  kept_count: number;
  dropped_count: number;
}

/**
 * Encart produit « Présent dans N lignées, gardé par X sur 10 » (Lot 5.3).
 * Clic → ouvre le KitSheet de la lignée (le kit n'habite pas une adresse).
 * Disparaît entièrement si le produit n'est présent dans aucune lignée.
 */
export default function ProductLineageCard({ productId }: { productId: string }) {
  const [stats, setStats] = useState<LineageStats | null>(null);
  const { openKit } = useKitSheet();

  useEffect(() => {
    let active = true;
    fetch(`/api/kits/discovery?productId=${productId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: LineageStats | null) => {
        if (active) setStats(d);
      })
      .catch(() => {
        if (active) setStats(null);
      });
    return () => {
      active = false;
    };
  }, [productId]);

  if (!stats || stats.lineages_count === 0) return null;

  const totalPairs = stats.kept_count + stats.dropped_count;
  const rate = totalPairs > 0 ? Math.round((stats.kept_count / totalPairs) * 10) : 0;
  const phrase = `gardé par ${rate} voyageur${rate > 1 ? 's' : ''} sur 10`;

  return (
    <button
      type="button"
      onClick={() => {
        if (stats.lineage_root_id) {
          openKit(stats.lineage_root_id, 'product');
        }
      }}
      disabled={!stats.lineage_root_id}
      className="block w-full mt-4 rounded-2xl px-4 py-3 border transition-colors hover:border-[#17402C]/40 disabled:opacity-80 disabled:cursor-default text-left"
      style={{ background: '#EDF3ED', borderColor: 'rgba(166,193,160,0.6)' }}
    >
      <span className="font-mono text-[10px] tracking-[0.16em] uppercase" style={{ color: '#17402C' }}>
        Éprouvé par les lignées
      </span>
      <span className="block mt-1 text-[13px]" style={{ color: '#17402C' }}>
        Présent dans <strong>{stats.lineages_count}</strong> lignée{stats.lineages_count > 1 ? 's' : ''}
      </span>
      {totalPairs > 0 && (
        <span className="block mt-0.5 text-[12px]" style={{ color: '#6B7A72' }}>
          {phrase} {stats.lineage_root_id ? '· voir la lignée →' : ''}
        </span>
      )}
    </button>
  );
}