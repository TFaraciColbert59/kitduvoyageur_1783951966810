'use client';

import React, { useMemo } from 'react';
import dynamic from 'next/dynamic';
import Icon from '@/components/ui/Icon';
import type { CarnetDetail } from '@/features/carnet/detail/types';

const CarnetTraceMap = dynamic(
  () => import('./CarnetTraceMap').then((mod) => mod.CarnetTraceMap),
  {
    ssr: false,
    loading: () => <div className="ckp-map-canvas" aria-hidden="true" />,
  },
);

export type CarnetMediaMode = 'grid' | 'map';

export interface CarnetMediaBlockProps {
  detail: CarnetDetail;
  mode: CarnetMediaMode;
  onModeChange: (mode: CarnetMediaMode) => void;
  onOpenViewer: (index: number) => void;
  onOpenMap: () => void;
  onDownloadGpx: () => void;
}

const MAX_TILES = 9;

/** GPX réel : aucune trace, aucun fichier. */
export function downloadGpx(name: string, trace: unknown) {
  const raw = (trace as any)?.geometry?.coordinates ?? (trace as any)?.coordinates ?? [];
  if (!Array.isArray(raw) || raw.length === 0) return;
  const points = raw
    .map((point: any) => {
      const lng = Array.isArray(point) ? point[0] : point?.lng;
      const lat = Array.isArray(point) ? point[1] : point?.lat;
      const ele = Array.isArray(point) ? point[2] : point?.ele;
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return '';
      return `<trkpt lat="${lat}" lon="${lng}">${Number.isFinite(ele) ? `<ele>${ele}</ele>` : ''}</trkpt>`;
    })
    .join('');
  const gpx = `<?xml version="1.0" encoding="UTF-8"?><gpx version="1.1" creator="Le Kit du Voyageur"><metadata><name>${name}</name></metadata><trk><name>${name}</name><trkseg>${points}</trkseg></trk></gpx>`;
  const blob = new Blob([gpx], { type: 'application/gpx+xml' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${name.replace(/[^a-zA-Z0-9]/g, '_')}.gpx`;
  link.click();
  URL.revokeObjectURL(url);
}

/** Groupe grille / carte du carnet : la grille 3 colonnes du Compte, sans radius. */
export function CarnetMediaBlock({
  detail,
  mode,
  onModeChange,
  onOpenViewer,
  onOpenMap,
  onDownloadGpx,
}: CarnetMediaBlockProps) {
  const photos = useMemo(() => detail.photoMoments, [detail.photoMoments]);
  const visible = photos.slice(0, MAX_TILES);
  const hidden = photos.length - visible.length;
  const hasTrace =
    Array.isArray((detail.trace as any)?.coordinates) ||
    Array.isArray((detail.trace as any)?.geometry?.coordinates);
  const km = detail.distanceKm
    ? `${detail.distanceKm.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} km`
    : null;
  const elevation = detail.elevationM
    ? `${detail.elevationM.toLocaleString('fr-FR')} m D+`
    : null;

  return (
    <section className="ckp-media" id="ckp-parcours" aria-label="Moments et parcours">
      {mode === 'grid' ? (
        photos.length === 0 ? (
          <div className="ckp-empty">
            <Icon name="image-plus" size={24} aria-hidden="true" />
            <b>Aucun moment pour l’instant.</b>
            <p>
              {detail.isOwner
                ? 'Ajoutez un moment depuis votre carnet pour le voir ici.'
                : 'L’auteur n’a pas encore ajouté de photo.'}
            </p>
          </div>
        ) : (
          <div className="ckp-grid">
            {visible.map((moment, index) => (
              <button
                key={moment.id}
                type="button"
                className="ckp-tile"
                onClick={() => onOpenViewer(index)}
                aria-label={
                  moment.caption ? `Photo ${index + 1} : ${moment.caption}` : `Photo ${index + 1}`
                }
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- image distante du moment */}
                <img
                  src={moment.imageUrl ?? ''}
                  alt=""
                  loading={index < 3 ? 'eager' : 'lazy'}
                />
                {index === MAX_TILES - 1 && hidden > 0 ? (
                  <span className="ckp-tile-more">+{hidden}</span>
                ) : null}
              </button>
            ))}
          </div>
        )
      ) : (
        <div className="ckp-map-wrap">
          {hasTrace ? (
            <>
              <CarnetTraceMap
                trace={detail.trace}
                distanceKm={detail.distanceKm}
                elevationM={detail.elevationM}
              />
              <button
                type="button"
                className="gbtn ckp-map-expand"
                onClick={onOpenMap}
                aria-label="Agrandir la carte"
              >
                <Icon name="external-link" size={16} aria-hidden="true" />
              </button>
            </>
          ) : (
            <div className="ckp-empty" style={{ height: '100%', borderRadius: 18 }}>
              <Icon name="route" size={24} aria-hidden="true" />
              <b>Aucune trace GPS.</b>
              <p>
                {detail.isOwner
                  ? 'Ajoutez une trace depuis votre carnet.'
                  : 'Ce carnet n’a pas de trace enregistrée.'}
              </p>
            </div>
          )}
          <div className="ckp-map-foot">
            <span className="ckp-day-meta">
              {km ? <span>{km}</span> : null}
              {elevation ? <span>{elevation}</span> : null}
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
      )}

      <div className="ckp-toggle" role="group" aria-label="Affichage des médias">
        <button
          type="button"
          aria-pressed={mode === 'grid'}
          aria-label="Grille"
          onClick={() => onModeChange('grid')}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <rect x="3" y="3" width="7" height="7" rx="1.6" />
            <rect x="14" y="3" width="7" height="7" rx="1.6" />
            <rect x="3" y="14" width="7" height="7" rx="1.6" />
            <rect x="14" y="14" width="7" height="7" rx="1.6" />
          </svg>
        </button>
        <button
          type="button"
          aria-pressed={mode === 'map'}
          aria-label="Carte"
          onClick={() => onModeChange('map')}
        >
          <Icon name="map" size={14} aria-hidden="true" />
        </button>
      </div>
    </section>
  );
}

export default CarnetMediaBlock;
