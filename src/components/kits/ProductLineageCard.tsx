'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui';
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
  const actionable = Boolean(stats.lineage_root_id);

  return (
    <Card
      tone="sage"
      variant={actionable ? 'interactive' : 'standard'}
      onClick={
        actionable
          ? () => {
              if (stats.lineage_root_id) {
                openKit(stats.lineage_root_id, 'product');
              }
            }
          : undefined
      }
      className="mt-[var(--space-4)] p-[var(--space-4)] text-left"
    >
      <span className="font-mono text-[length:var(--lkv-text-caption-2)] uppercase tracking-[var(--tracking-caps)] text-[color:var(--lkv-text-primary)]">
        Éprouvé par les lignées
      </span>
      <span className="mt-[var(--space-1)] block text-[length:var(--lkv-text-footnote)] text-[color:var(--lkv-text-primary)]">
        Présent dans <strong>{stats.lineages_count}</strong> lignée{stats.lineages_count > 1 ? 's' : ''}
      </span>
      {totalPairs > 0 && (
        <span className="mt-0.5 block text-[length:var(--lkv-text-caption)] text-[color:var(--lkv-text-secondary)]">
          {phrase} {stats.lineage_root_id ? '· voir la lignée →' : ''}
        </span>
      )}
    </Card>
  );
}
