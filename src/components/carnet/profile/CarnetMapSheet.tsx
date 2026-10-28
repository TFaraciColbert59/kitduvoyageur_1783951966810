'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import Icon from '@/components/ui/Icon';
import { OverlaySheet } from '@/components/compte/overlay/OverlaySheet';
import { formatElevation, formatKm } from '@/features/carnet/detail/format';
import type { CarnetDetail } from '@/features/carnet/detail/types';
import { useSheetEscape } from './useSheetEscape';

const CarnetTraceMap = dynamic(
  () => import('./CarnetTraceMap').then((mod) => mod.CarnetTraceMap),
  {
    ssr: false,
    loading: () => <div className="ckp-map-canvas" aria-hidden="true" />,
  },
);

export interface CarnetMapSheetProps {
  open: boolean;
  detail: CarnetDetail;
  onClose: () => void;
  onDownloadGpx: () => void;
}

/** Carte 92 dvh : trace, statistiques réelles, GPX. */
export function CarnetMapSheet({ open, detail, onClose, onDownloadGpx }: CarnetMapSheetProps) {
  useSheetEscape(open, onClose);
  if (!open) return null;
  const km = formatKm(detail.distanceKm);
  const elevation = formatElevation(detail.elevationM);
  const hasTrace =
    Array.isArray((detail.trace as any)?.coordinates) ||
    Array.isArray((detail.trace as any)?.geometry?.coordinates);

  return (
    <OverlaySheet
      title="Parcours"
      subtitle={detail.destination ?? detail.title}
      onClose={onClose}
      footer={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <span className="ckp-day-meta" style={{ margin: 0 }}>
            {km ? <span>{km}</span> : null}
            {elevation ? <span>{elevation} D+</span> : null}
          </span>
          <button
            type="button"
            className="lkdv-drawer-btn is-primary"
            onClick={onDownloadGpx}
            disabled={!hasTrace}
          >
            <Icon name="download" size={16} aria-hidden="true" />
            Télécharger le GPX
          </button>
        </div>
      }
    >
      <div className="ckp-map-wrap" style={{ aspectRatio: '4 / 5' }}>
        <CarnetTraceMap
          trace={detail.trace}
          dayTraces={detail.dayTraces}
          distanceKm={detail.distanceKm}
          elevationM={detail.elevationM}
        />
      </div>
    </OverlaySheet>
  );
}

export default CarnetMapSheet;
