'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import Icon from '@/components/ui/Icon';
import { formatElevation, formatKm } from '@/features/carnet/detail/format';
import type { CarnetDetail } from '@/features/carnet/detail/types';
import { extractTraceSegments } from '../traceGeometry';

const CarnetTraceMap = dynamic(
  () => import('../CarnetTraceMap').then((mod) => mod.CarnetTraceMap),
  { ssr: false, loading: () => <div className="ckp-map-canvas" aria-hidden="true" /> },
);

export interface CarnetParcoursPaneProps {
  detail: CarnetDetail;
  onDownloadGpx: () => void;
}

export function CarnetParcoursPane({ detail, onDownloadGpx }: CarnetParcoursPaneProps) {
  const hasTrace = extractTraceSegments(detail.trace).some(
    (segment) => segment.length >= 2
  );
  const km = formatKm(detail.distanceKm);
  const elevation = formatElevation(detail.elevationM);

  /* Un état vide ne doit jamais affirmer « aucune trace » quand la trace
     existe mais a été masquée, jugée trop courte ou refusée par le projecteur. */
  const emptyState = detail.traceFullyMasked
    ? {
        title: 'Trace non partageable.',
        body: 'Cette sortie est privée : sa trace n’est pas exposée aux visiteurs.',
      }
    : detail.traceError
      ? {
          title: 'Trace non disponible.',
          body:
            detail.traceError === 'unpublishable_geometry'
              ? 'La trace est trop courte ou trop proche des extrémités masquées pour être publiée.'
              : 'La géométrie enregistrée n’a pas pu être publiée en sécurité.',
        }
      : {
          title: 'Aucune trace GPS.',
          body: 'Ce carnet n’a pas de trace enregistrée.',
        };

  return (
    <div className="ckp-pane">
      <div className="ckp-map-wrap">
        {hasTrace ? (
          <CarnetTraceMap trace={detail.trace} distanceKm={detail.distanceKm} elevationM={detail.elevationM} />
        ) : (
          <div className="ckp-empty" style={{ height: '100%', borderRadius: 18 }}>
            <Icon name="route" size={24} aria-hidden="true" />
            <b>{emptyState.title}</b>
            <p>{emptyState.body}</p>
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
