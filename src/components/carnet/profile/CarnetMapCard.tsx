'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import Icon from '@/components/ui/Icon';
import { formatElevation, formatKm } from '@/features/carnet/detail/format';
import type { CarnetDetail } from '@/features/carnet/detail/types';

const CarnetTraceMap = dynamic(
  () => import('./CarnetTraceMap').then((mod) => mod.CarnetTraceMap),
  { ssr: false, loading: () => <div className="ckp-map-canvas" aria-hidden="true" /> },
);

export interface CarnetMapCardProps {
  detail: CarnetDetail;
  onDownloadGpx: () => void;
}

/** Carte séparée sous la carte d'identité, comme le Compte. */
export function CarnetMapCard({ detail, onDownloadGpx }: CarnetMapCardProps) {
  const km = formatKm(detail.distanceKm);
  const elevation = formatElevation(detail.elevationM);
  const hasTrace =
    Array.isArray((detail.trace as any)?.coordinates) ||
    Array.isArray((detail.trace as any)?.geometry?.coordinates);

  return (
    <section className="ckp-card ckp-mapcard" aria-label="Carte du parcours">
      <div className="ckp-mapcard-canvas">
        {hasTrace ? (
          <CarnetTraceMap trace={detail.trace} distanceKm={detail.distanceKm} elevationM={detail.elevationM} />
        ) : (
          <div className="ckp-mapcard-empty">
            <Icon name="route" size={22} aria-hidden="true" />
            <b>Ta carte se dessine à la première trace.</b>
            <p>Ce carnet n’a pas de trace GPS enregistrée.</p>
          </div>
        )}
      </div>

      <div className="ckp-mapcard-chip">
        <span>{km ?? 'Parcours'}</span>
        {elevation ? <span>{elevation} D+</span> : null}
      </div>

      <div className="ckp-mapcard-stack" role="group" aria-label="Contrôles de la carte">
        <button type="button" aria-label="Télécharger le GPX" onClick={onDownloadGpx} disabled={!hasTrace}>
          <Icon name="download" size={16} aria-hidden="true" />
        </button>
        <button type="button" aria-label="Agrandir la carte" onClick={onDownloadGpx} disabled={!hasTrace}>
          <Icon name="external-link" size={16} aria-hidden="true" />
        </button>
      </div>

      <span className="ckp-mapcard-credit">Powered by Esri © OpenStreetMap</span>
    </section>
  );
}

export default CarnetMapCard;
