'use client';

import type { ReactNode } from 'react';
import { ArrowRight } from 'lucide-react';
import { HapticLink } from '../menu/HapticLink';
import HubGlobeMap from './HubGlobeMap';
import type { HubRoutePoint } from './HubRouteMap';

export interface MomentMapCardProps {
  eyebrow: string;
  badge: string;
  dateLabel?: string | null;
  routeCoords: Array<[number, number]>;
  highlightCoords?: Array<[number, number]>;
  points?: HubRoutePoint[];
  routeGeojson?: Record<string, unknown> | null;
  panel: ReactNode;
  sheetContent?: ReactNode;
  legend?: Array<{ label: string; color: string }>;
  cta: { href: string; label: string };
  sheetTitle: string;
  reserveFabSpace?: boolean;
  /** Plein écran vertical : carte jusqu'en bas, panneau juste au-dessus de la tab bar. */
  fillViewport?: boolean;
}

export function MomentMapCard({
  eyebrow,
  badge,
  dateLabel,
  routeCoords,
  highlightCoords = [],
  points = [],
  routeGeojson = null,
  panel,
  legend = [],
  cta,
  sheetTitle,
  reserveFabSpace = false,
  fillViewport = false,
}: MomentMapCardProps) {
  const heightClass = fillViewport ? 'h-full min-h-0' : 'min-h-[26rem] sm:min-h-[30rem]';

  return (
    <section
      aria-label={sheetTitle}
      className={`hub-map-card relative ${heightClass} overflow-hidden rounded-[var(--lkv-radius-card)] border border-white/50 shadow-sm`}
    >
      <div className="absolute inset-0 z-0">
        <HubGlobeMap
          name={sheetTitle}
          routeCoords={routeCoords}
          highlightCoords={highlightCoords}
          points={points}
          routeGeojson={routeGeojson}
        />
      </div>

      <div
        className={`pointer-events-none relative z-20 flex h-full ${heightClass} flex-col justify-between p-3.5 ${
          fillViewport ? 'pb-[calc(var(--bottom-nav-height,52px)+16px)]' : ''
        }`}
      >
        <header className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="hub-map-card__eyebrow">{eyebrow}</p>
            <p className="hub-map-card__badge">{badge}</p>
          </div>
          {dateLabel ? <p className="hub-map-card__date">{dateLabel}</p> : null}
        </header>

        <div className="hub-map-card__panel pointer-events-auto">
          {panel}
          {legend.length > 0 ? (
            <ul className="hub-map-card__legend" aria-label="Légende de l’itinéraire">
              {legend.map((item) => (
                <li key={item.label}>
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ background: item.color }}
                    aria-hidden="true"
                  />
                  {item.label}
                </li>
              ))}
            </ul>
          ) : null}
          <div
            className={`mt-3 flex items-center justify-end gap-2 ${reserveFabSpace ? 'pr-16' : ''}`}
          >
            <HapticLink
              href={cta.href}
              ariaLabel={cta.label}
              className="hub-map-card__cta"
            >
              <ArrowRight size={16} aria-hidden="true" />
            </HapticLink>
          </div>
        </div>
      </div>
    </section>
  );
}

export default MomentMapCard;
