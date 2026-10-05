'use client';

import React from 'react';
import type { RoutePoiSummary } from '@/features/explorer-osm/domain/types';
import { Badge, Button, Card, Sheet } from '@/components/ui';
import Icon from '@/components/ui/Icon';

interface OsmPoiSheetProps {
  poi: RoutePoiSummary | null;
  open: boolean;
  onClose: () => void;
}

const CATEGORY_META: Record<
  string,
  { label: string; icon: string; color: string }
> = {
  refuge: { label: 'Refuge / Cabane', icon: 'home', color: 'var(--lkv-primary)' },
  shelter: { label: 'Abri', icon: 'shield', color: 'var(--lkv-primary)' },
  water: { label: 'Eau potable', icon: 'droplet', color: '#0284c7' },
  summit: { label: 'Sommet / Col', icon: 'mountain', color: '#e11d48' },
  camp: { label: 'Bivouac / Camping', icon: 'tent', color: '#16a34a' },
  viewpoint: { label: 'Point de vue', icon: 'eye', color: '#d97706' },
  parking: { label: 'Parking', icon: 'navigation', color: '#64748b' },
  transit: { label: 'Transport', icon: 'compass', color: '#7c3aed' },
};

export default function OsmPoiSheet({ poi, open, onClose }: OsmPoiSheetProps) {
  if (!poi) return null;

  const meta = CATEGORY_META[poi.category] || {
    label: poi.category,
    icon: 'map-pin',
    color: 'var(--lkv-text-primary)',
  };

  const displayName = poi.name || `${meta.label} (sans nom référencé)`;
  const rawTags = Object.entries(poi.tags || {}).filter(
    ([k]) => !['name', 'source', 'type', 'created_by'].includes(k)
  );

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <div className="flex flex-col gap-4 p-4 text-[color:var(--lkv-text-primary)]">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-full text-white shadow-xs"
              style={{ backgroundColor: meta.color }}
            >
              <Icon name={meta.icon as any} size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <Badge tone="sage" className="text-[length:var(--lkv-text-caption-2)]">
                  {meta.label}
                </Badge>
                {poi.elevationM != null && (
                  <Badge tone="stone" className="font-mono text-[length:var(--lkv-text-caption-2)]">
                    {poi.elevationM} m
                  </Badge>
                )}
              </div>
              <h2 className="mt-1 font-display text-[length:var(--lkv-text-callout)] font-bold">
                {displayName}
              </h2>
            </div>
          </div>
        </div>

        {/* Coordonnées & Source ODbL */}
        <Card variant="compact" className="flex flex-col gap-1.5 p-3">
          <div className="flex items-center justify-between font-mono text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-muted)]">
            <span>Coordonnées GPS</span>
            <span>
              {poi.coordinates[1].toFixed(5)}, {poi.coordinates[0].toFixed(5)}
            </span>
          </div>
          <div className="flex items-center justify-between text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-secondary)]">
            <span>Source</span>
            <span className="font-semibold">OpenStreetMap contributors (ODbL 1.0)</span>
          </div>
        </Card>

        {/* Détails et tags OSM */}
        {rawTags.length > 0 && (
          <div className="flex flex-col gap-2">
            <h3 className="text-[length:var(--lkv-text-caption)] font-bold text-[color:var(--lkv-text-secondary)]">
              Informations complémentaires
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {rawTags.slice(0, 8).map(([key, value]) => (
                <div
                  key={key}
                  className="rounded-[var(--lkv-radius-sm)] border border-[color:var(--glass-border)] bg-[color:var(--card-tint-strong)] p-2"
                >
                  <span className="block text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-muted)]">
                    {key}
                  </span>
                  <span className="block truncate font-mono text-[length:var(--lkv-text-caption)] font-semibold">
                    {String(value)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="mt-2 flex items-center gap-2">
          <Button variant="secondary" fullWidth onClick={onClose}>
            Fermer
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
