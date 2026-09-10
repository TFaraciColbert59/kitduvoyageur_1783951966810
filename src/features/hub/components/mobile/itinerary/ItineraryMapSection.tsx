'use client';

import { MapPin, MapPinPlus, X } from 'lucide-react';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import HubRouteMap, { type HubRoutePoint } from '../HubRouteMap';

export interface ItineraryMapSectionProps {
  routeCoords: Array<[number, number]>;
  highlightCoords: Array<[number, number]>;
  points: HubRoutePoint[];
  pendingPoint: { lat: number; lon: number } | null;
  canEdit: boolean;
  onMapClick: (lat: number, lon: number) => void;
  onConfirmPick: () => void;
  onClearPick: () => void;
}

/** Carte utilisable inline + POI du roadbook (clic pour poser un point). */
export function ItineraryMapSection({
  routeCoords,
  highlightCoords,
  points,
  pendingPoint,
  canEdit,
  onMapClick,
  onConfirmPick,
  onClearPick,
}: ItineraryMapSectionProps) {
  const { triggerHaptic } = useHapticFeedback();
  const allPoints: HubRoutePoint[] = pendingPoint
    ? [
        ...points,
        { lat: pendingPoint.lat, lon: pendingPoint.lon, label: 'Nouveau point', color: '#A8443A' },
      ]
    : points;

  return (
    <section className="glass rounded-[1.75rem] p-4" aria-label="Carte et points d'intérêt">
      <header className="flex items-start justify-between gap-2">
        <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--lkv-text-primary)]/70">
          Carte & POI
        </p>
        <span className="glass-pill shrink-0 uppercase tracking-[0.08em]">
          {points.length} point{points.length > 1 ? 's' : ''}
        </span>
      </header>

      <div className="relative mt-3 h-[16rem] overflow-hidden rounded-2xl border border-white/60">
        <HubRouteMap
          interactive
          routeCoords={routeCoords}
          highlightCoords={highlightCoords}
          points={allPoints}
          reserveBottom={0}
          emptyLabel="Ajoutez des étapes géolocalisées"
          onMapClick={(lat, lon) => {
            if (!canEdit) return;
            triggerHaptic('light');
            onMapClick(lat, lon);
          }}
        />
      </div>

      {pendingPoint ? (
        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              triggerHaptic('success');
              onConfirmPick();
            }}
            className="glass-capsule-btn primary inline-flex min-h-[44px] flex-1 items-center justify-center gap-1.5 !py-3 text-sm font-bold"
          >
            <MapPinPlus size={15} aria-hidden="true" />
            Ajouter un point ici
          </button>
          <button
            type="button"
            onClick={onClearPick}
            aria-label="Annuler le point choisi"
            className="glass-sub-card inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[var(--lkv-text-muted)]"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>
      ) : (
        <p className="mt-3 flex items-center gap-1.5 text-[10.5px] font-medium text-[var(--lkv-text-primary)]/65">
          <MapPin size={12} aria-hidden="true" />
          {canEdit
            ? 'Touchez la carte pour poser un point d’intérêt, ou un marqueur pour son nom.'
            : 'Touchez un marqueur pour son nom.'}
        </p>
      )}
    </section>
  );
}

export default ItineraryMapSection;
