'use client';

import React, { useMemo, useState } from 'react';
import type { EditorialGuide, ParkPerimeter, RouteRef } from '@/features/highlights';
import { searchParkRoutes } from '@/features/highlights';
import { DrawerFrame } from './DrawerFrame';
import {
  bodyStyle,
  buttonStyle,
  chipStyle,
  helperStyle,
  inputStyle,
  labelStyle,
  rowStyle,
  sectionGapStyle,
} from './styles';

export interface GuideDrawerProps {
  guide: EditorialGuide;
  onClose: () => void;
  onOpenRoute?: (routeId: string) => void;
  onOpenPoi?: (poiId: string) => void;
  onOpenHighlight?: (highlightId: string) => void;
  park?: ParkPerimeter;
  parkRoutes?: RouteRef[];
  onOpenParkRoute?: (routeId: string) => void;
}

/**
 * K1.11 / K1.12 / K5.17 — guide thématique et recherche limitée au parc.
 * Aucun panneau de filtres standard : la recherche du parc suffit.
 */
export function GuideDrawer({
  guide,
  onClose,
  onOpenRoute,
  onOpenPoi,
  onOpenHighlight,
  park,
  parkRoutes = [],
  onOpenParkRoute,
}: GuideDrawerProps) {
  const [query, setQuery] = useState('');
  const parkHits = useMemo(
    () => (park ? searchParkRoutes(park, parkRoutes, query) : []),
    [park, parkRoutes, query]
  );

  return (
    <DrawerFrame
      eyebrow={guide.partner ? `Guide partenaire · ${guide.partner}` : 'Guide éditorial'}
      title={guide.title}
      subtitle={[guide.theme, guide.region].filter(Boolean).join(' · ') || undefined}
      onClose={onClose}
      testId="guide-drawer"
    >
      <div style={sectionGapStyle}>
        {guide.description ? <p style={bodyStyle}>{guide.description}</p> : null}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <span style={chipStyle}>{guide.routeCount} parcours</span>
          <span style={chipStyle}>{guide.poiCount} lieux</span>
          <span style={chipStyle}>{guide.highlightCount} highlights</span>
        </div>

        {guide.sections.length === 0 ? (
          <p style={helperStyle}>Ce guide n’a pas encore de contenu publié.</p>
        ) : (
          guide.sections.map((section) => (
            <section key={section.id} aria-label={section.title}>
              <p style={labelStyle}>{section.title}</p>
              <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {section.routes.map((route) => (
                  <li key={`route-${route.id}`} style={rowStyle}>
                    <div>
                      <p style={{ ...bodyStyle, fontWeight: 600 }}>{route.title}</p>
                      <p style={helperStyle}>{route.region ?? 'Sans région'}</p>
                    </div>
                    <button
                      type="button"
                      style={buttonStyle}
                      onClick={() => onOpenRoute?.(route.id)}
                    >
                      Ouvrir
                    </button>
                  </li>
                ))}
                {section.pois.map((poi) => (
                  <li key={`poi-${poi.id}`} style={rowStyle}>
                    <div>
                      <p style={{ ...bodyStyle, fontWeight: 600 }}>{poi.name}</p>
                      <p style={helperStyle}>{poi.category}</p>
                    </div>
                    <button type="button" style={buttonStyle} onClick={() => onOpenPoi?.(poi.id)}>
                      Ouvrir
                    </button>
                  </li>
                ))}
                {section.highlights.map((highlight) => (
                  <li key={`highlight-${highlight.id}`} style={rowStyle}>
                    <div>
                      <p style={{ ...bodyStyle, fontWeight: 600 }}>{highlight.title}</p>
                      <p style={helperStyle}>{highlight.areaLabel}</p>
                    </div>
                    <button
                      type="button"
                      style={buttonStyle}
                      onClick={() => onOpenHighlight?.(highlight.id)}
                    >
                      Ouvrir
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}

        {park ? (
          <section aria-label={`Recherche dans ${park.name}`}>
            <p style={labelStyle}>Parcours dans {park.name}</p>
            <input
              type="search"
              style={inputStyle}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Nom du parcours…"
              aria-label={`Rechercher un parcours dans ${park.name}`}
            />
            {parkHits.length === 0 ? (
              <p style={helperStyle}>Aucun parcours public dans ce périmètre.</p>
            ) : (
              <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {parkHits.map((route) => (
                  <li key={route.id} style={rowStyle}>
                    <div>
                      <p style={{ ...bodyStyle, fontWeight: 600 }}>{route.title}</p>
                      <p style={helperStyle}>{route.region ?? park.name}</p>
                    </div>
                    <button
                      type="button"
                      style={buttonStyle}
                      onClick={() => onOpenParkRoute?.(route.id)}
                    >
                      Ouvrir
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ) : null}
      </div>
    </DrawerFrame>
  );
}
