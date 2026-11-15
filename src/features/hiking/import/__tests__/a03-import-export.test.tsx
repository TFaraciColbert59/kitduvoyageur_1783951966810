// @vitest-environment jsdom
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import {
  TraceImportError,
  buildTraceImportPreview,
  detectTraceFormat,
  parseGpx,
  parseTraceFile,
  snapTraceToTrails,
} from '@/features/hiking/import';
import {
  buildRouteGpx,
  buildRouteTcx,
  validateRouteImportInput,
} from '@/features/hiking/import/routeImport';
import { osmRouteDetailCache } from '@/features/explorer-osm/services/cacheService';
import { GET as exportOsmRoute } from '@/app/api/explorer/osm/route/[id]/export/route';
import { TraceImportDrawer } from '@/components/compte/drawer/sortie/TraceImportDrawer';

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: '33333333-3333-4333-8333-333333333333', email: 'test@lkdv.fr' },
    loading: false,
  }),
}));

const SAMPLE_GPX = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Garmin Edge" xmlns="http://www.topografix.com/GPX/1/1" xmlns:gpxtpx="http://www.garmin.com/xmlschemas/TrackPointExtension/v1">
  <metadata><name>Col de la Croix</name></metadata>
  <wpt lat="45.125" lon="5.525"><ele>1780</ele><name>Source du Col</name><type>water</type><desc>Eau potable toute saison</desc></wpt>
  <trk>
    <name>Col de la Croix</name>
    <type>hiking</type>
    <trkseg>
      <trkpt lat="45.1000" lon="5.5000"><ele>1100</ele><time>2026-08-12T08:00:00Z</time><extensions><gpxtpx:TrackPointExtension><gpxtpx:hr>138</gpxtpx:hr><gpxtpx:cad>56</gpxtpx:cad></gpxtpx:TrackPointExtension></extensions></trkpt>
      <trkpt lat="45.1100" lon="5.5100"><ele>1420</ele><time>2026-08-12T08:30:00Z</time><extensions><gpxtpx:TrackPointExtension><gpxtpx:hr>152</gpxtpx:hr></gpxtpx:TrackPointExtension></extensions></trkpt>
      <trkpt lat="45.1200" lon="5.5200"><ele>1750</ele><time>2026-08-12T09:00:00Z</time><extensions><gpxtpx:TrackPointExtension><gpxtpx:hr>161</gpxtpx:hr></gpxtpx:TrackPointExtension></extensions></trkpt>
    </trkseg>
  </trk>
</gpx>`;

const UNTIMED_ROUTE_GPX = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1">
  <wpt lat="45.205" lon="5.605"><ele>1600</ele><name>Refuge d'alpage</name></wpt>
  <rte>
    <name>Tour prévu</name>
    <rtept lat="45.200" lon="5.600"><ele>1200</ele></rtept>
    <rtept lat="45.210" lon="5.610"><ele>1600</ele></rtept>
  </rte>
</gpx>`;

describe('Lot A03 — Import et export des traces GPX / FIT / TCX (11 IDs)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('S1.14 / K6.02 / K6.04 : parse GPX 1.1 avec extensions capteurs et waypoints <wpt>, et bloque XXE', () => {
    expect(detectTraceFormat({ text: SAMPLE_GPX })).toBe('gpx');
    const trace = parseTraceFile({ text: SAMPLE_GPX, fileName: 'col-croix.gpx' });
    expect(trace.provenance.format).toBe('gpx');
    expect(trace.points).toHaveLength(3);
    expect(trace.points[0].heartRateBpm).toBe(138);
    expect(trace.points[0].cadenceRpm).toBe(56);
    expect(trace.waypoints).toHaveLength(1);
    expect(trace.waypoints![0].name).toBe('Source du Col');

    const preview = buildTraceImportPreview(trace);
    expect(preview.saveable).toBe(true);
    expect(preview.distanceM).toBeGreaterThan(2000);
    expect(preview.elevationGainM).toBe(650);
    expect(preview.waypoints).toHaveLength(1);

    // XXE interdit
    expect(() =>
      parseGpx('<?xml version="1.0"?><!DOCTYPE gpx [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><gpx>&xxe;</gpx>')
    ).toThrow(TraceImportError);
  });

  it('K6.01 : un GPX sans horodatage reste importable comme Parcours planifié sans inventer de temps', () => {
    const trace = parseTraceFile({ text: UNTIMED_ROUTE_GPX, fileName: 'tour-prevu.gpx' });
    const preview = buildTraceImportPreview(trace);
    expect(preview.saveable).toBe(false);
    expect(preview.routeSaveable).toBe(true);
    expect(preview.waypoints).toHaveLength(1);
  });

  it('K6.03 : snapTraceToTrails projette sur les corridors et conserve le tracé d’origine intact', () => {
    const original = [
      { lat: 45.0, lng: 5.0, altitudeM: 1000 },
      { lat: 45.0001, lng: 5.005, altitudeM: 1050 }, // ~11 m hors axe
      { lat: 45.0, lng: 5.01, altitudeM: 1100 },
    ];
    const corridor = [
      [
        { lat: 45.0, lng: 5.0 },
        { lat: 45.0, lng: 5.01 },
      ],
    ];
    const snapped = snapTraceToTrails(original, corridor, 35);
    expect(snapped.snappedPointCount).toBe(3);
    expect(snapped.points[1].lat).toBeCloseTo(45.0, 5);
    expect(original[1].lat).toBe(45.0001); // tracé original non muté
    expect(snapped.maxDeviationM).toBeGreaterThan(5);

    const validated = validateRouteImportInput({
      title: 'Parcours aligné',
      source: 'gpx',
      sourceFingerprint: 'a'.repeat(64),
      geometryMode: 'snapped',
      points: original,
      waypoints: [
        {
          lat: 45.0,
          lng: 5.005,
          elevationM: 1050,
          name: 'Belvédère',
          description: null,
          type: null,
          symbol: null,
          recordedAt: null,
        },
      ],
    });
    expect(validated.geometryMode).toBe('snapped');
    expect(validated.distanceKm).toBeGreaterThan(0);
    expect(validated.waypoints).toHaveLength(1);
  });

  it('K6.05 / S3.27 : exporte un parcours en GPX 1.1 et TCX v2 depuis /api/explorer/osm/route/[id]/export', async () => {
    osmRouteDetailCache.set('route-detail:998877', {
      route: {
        id: 'osm:relation:998877',
        name: 'Sentier des Balcons',
        geometry: {
          type: 'LineString',
          coordinates: [
            [5.5, 45.1, 1100],
            [5.51, 45.11, 1320],
          ],
        },
      },
    } as never);

    const gpxRes = await exportOsmRoute(
      new Request('http://localhost/api/explorer/osm/route/998877/export?format=gpx') as never,
      { params: Promise.resolve({ id: '998877' }) }
    );
    expect(gpxRes.status).toBe(200);
    const gpxText = await gpxRes.text();
    expect(gpxText).toContain('<gpx version="1.1"');
    expect(gpxText).toContain('Sentier des Balcons');

    const tcxRes = await exportOsmRoute(
      new Request('http://localhost/api/explorer/osm/route/998877/export?format=tcx') as never,
      { params: Promise.resolve({ id: '998877' }) }
    );
    expect(tcxRes.status).toBe(200);
    const tcxText = await tcxRes.text();
    expect(tcxText).toContain('<TrainingCenterDatabase');
    expect(tcxText).toContain('<Courses><Course>');

    // Vérification directe des helpers purs
    expect(buildRouteGpx({ id: 'r1', name: 'Test', points: [{ lat: 45, lng: 5 }] })).toContain('<trkpt');
    expect(buildRouteTcx({ id: 'r1', name: 'Test', points: [{ lat: 45, lng: 5 }] })).toContain('<Course>');
  });

  it('S1.16 / K6.01 / K6.03 / K6.04 : TraceImportDrawer gère l’import en lot multi-fichiers GPX + prévisualisation', async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url === '/api/routes/import') {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            route: { id: 'route-1', title: 'Tour prévu' },
            existing: false,
            waypointCount: 1,
          }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({
          sessionId: '44444444-4444-4444-8444-444444444444',
          existing: false,
          lapCount: 0,
          sampleCount: 3,
        }),
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<TraceImportDrawer />);
    const fileInput = screen.getByLabelText(/Choisir un ou plusieurs fichiers GPX, FIT ou TCX/i) as HTMLInputElement;
    expect(fileInput.multiple).toBe(true);

    const f1 = new File([SAMPLE_GPX], 'sortie.gpx', { type: 'application/gpx+xml' });
    const f2 = new File([UNTIMED_ROUTE_GPX], 'parcours.gpx', { type: 'application/gpx+xml' });
    Object.defineProperty(f1, 'arrayBuffer', {
      value: async () => new TextEncoder().encode(SAMPLE_GPX).buffer,
    });
    Object.defineProperty(f2, 'arrayBuffer', {
      value: async () => new TextEncoder().encode(UNTIMED_ROUTE_GPX).buffer,
    });

    fireEvent.change(fileInput, { target: { files: [f1, f2] } });

    await waitFor(() => expect(screen.getByTestId('bulk-import-results')).toBeTruthy());
    expect(screen.getByText(/Import en lot \(2 fichiers\)/i)).toBeTruthy();
    expect(screen.getByText('Activité enregistrée')).toBeTruthy();
    expect(screen.getByText('Parcours planifié enregistré')).toBeTruthy();

    vi.unstubAllGlobals();
  });
});
