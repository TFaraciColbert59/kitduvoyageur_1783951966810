'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import Icon from '@/components/ui/Icon';
import { formatElevation, formatKm } from '@/features/carnet/detail/format';
import type { CarnetDetail } from '@/features/carnet/detail/types';

const CarnetTraceMap = dynamic(
  () => import('../CarnetTraceMap').then((mod) => mod.CarnetTraceMap),
  { ssr: false, loading: () => <div className="ckp-map-canvas" aria-hidden="true" /> },
);

export interface CarnetParcoursPaneProps {
  detail: CarnetDetail;
  onDownloadGpx: () => void;
}

export function CarnetParcoursPane({ detail, onDownloadGpx }: CarnetParcoursPaneProps) {
  const hasTrace =
    Array.isArray((detail.trace as any)?.coordinates) ||
    Array.isArray((detail.trace as any)?.geometry?.coordinates);
  const km = formatKm(detail.distanceKm);
  const elevation = formatElevation(detail.elevationM);

  return (
    <div className="ckp-pane">
      <div className="ckp-map-wrap">
        {hasTrace ? (
          <CarnetTraceMap trace={detail.trace} distanceKm={detail.distanceKm} elevationM={detail.elevationM} />
        ) : (
          <div className="ckp-empty" style={{ height: '100%', borderRadius: 18 }}>
            {/* Aucun texte : glyphe seul + placeholder, règle de contenu de la fiche. */}
            <Icon name="route" size={28} aria-hidden="true" />
            <span className="ckp-empty-dash" aria-label="Aucune trace enregistrée">—</span>
          </div>
        )}
      </div>

      <div className="ckp-pane-foot">
        <span className="ckp-day-meta" style={{ margin: 0 }}>
          {km ? <span>{km}</span> : null}
          {elevation ? <span>{elevation} D+</span> : null}
        </span>
        <button
          type="button"
          className="ckp-pill ckp-pill--primary"
          onClick={onDownloadGpx}
          disabled={!hasTrace}
        >
          <Icon name="download" size={16} aria-hidden="true" />
          Télécharger le GPX
        </button>
      </div>
    </div>
  );
}

export default CarnetParcoursPane;
