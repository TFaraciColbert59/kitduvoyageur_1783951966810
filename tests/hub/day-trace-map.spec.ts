import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  buildDayTraceMarkers,
  DayTraceMap,
} from '@/features/hub/components/mobile/itinerary/DayTraceMap';

const ROOT = process.cwd();
const DAY_TRACE_MAP = path.join(
  ROOT,
  'src/features/hub/components/mobile/itinerary/DayTraceMap.tsx'
);
const MOBILE_EXPERIENCE = path.join(
  ROOT,
  'src/features/hub/components/mobile/itinerary/ItineraryMobileExperience.tsx'
);

const read = (file: string) => fs.readFileSync(file, 'utf8');

describe('DayTraceMap — carte du jour (création de POI)', () => {
  it('buildDayTraceMarkers met en avant les étapes et le point en cours de création', () => {
    const steps = [
      { lat: 45, lng: 1 },
      { lat: 45.1, lng: 1.1 },
    ];
    const markers = buildDayTraceMarkers(steps, { lat: 45.05, lng: 1.05 });

    expect(markers).toHaveLength(3);
    expect(markers[0]).toMatchObject({ lat: 45, lon: 1, label: 'Étape du jour' });
    expect(markers[1]).toMatchObject({ lat: 45.1, lon: 1.1, label: 'Étape du jour' });
    expect(markers[2]).toMatchObject({ lat: 45.05, lon: 1.05, label: 'Nouveau point' });
  });

  it('buildDayTraceMarkers ignore les points invalides et l’absence de point temporaire', () => {
    expect(buildDayTraceMarkers(null, null)).toEqual([]);
    expect(buildDayTraceMarkers([], undefined)).toEqual([]);
    expect(
      buildDayTraceMarkers(
        [{ lat: Number.NaN, lng: 1 }],
        { lat: Number.POSITIVE_INFINITY, lng: 2 }
      )
    ).toEqual([]);
  });

  it('rend un squelette discret pendant le chargement, rien sans route_id', () => {
    const loading = renderToStaticMarkup(
      React.createElement(DayTraceMap, { routeId: '42', day: 1, days: 2 })
    );
    expect(loading).toContain('day-trace-map-skeleton');
    expect(loading).toContain('motion-reduce:animate-none');

    const empty = renderToStaticMarkup(
      React.createElement(DayTraceMap, { routeId: null, day: 1, days: 2 })
    );
    expect(empty).toBe('');
  });

  it('source : DayTraceMap transmet interactive/onMapClick/pickPoint à HubRouteMap', () => {
    const src = read(DAY_TRACE_MAP);

    expect(src).toContain('interactive={interactive}');
    expect(src).toMatch(/onMapClick=\{\(lat, lon\) => onMapClick\?\.\(\{ lat, lng: lon \}\)\}/);
    expect(src).toMatch(/buildDayTraceMarkers\(\s*validSteps,/);
    expect(src).toContain('pickPoint');
  });

  it('source : l’expérience mobile rebranche la création de POI via la carte du jour', () => {
    const src = read(MOBILE_EXPERIENCE);

    expect(src).toMatch(/<DayTraceMap[\s\S]*?interactive[\s\S]*?\/>/);
    expect(src).toMatch(
      /onMapClick=\{\(point\) => \{[\s\S]*?setMapPick\(\{ lat: point\.lat, lon: point\.lng \}\);[\s\S]*?setPoiFormOpen\(true\)/
    );
    expect(src).toContain('pickPoint={mapPick ? { lat: mapPick.lat, lng: mapPick.lon } : null}');
    expect(src).toContain('if (!canEdit) return;');
  });
});
