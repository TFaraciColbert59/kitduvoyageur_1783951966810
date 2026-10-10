/**
 * LKDV Social — Milestone 3 Challenger Stress Suite (M3.2)
 * File: tests/messaging/challenger-m3-cockpit-stress.spec.ts
 *
 * EMPIRICAL ADVERSARIAL STRESS TEST HARNESS:
 *
 * 1. formatEmergencyCoordinates Adversarial Fuzzing:
 *    - Null island (0, 0), North Pole (90, 0), South Pole (-90, 0).
 *    - Antimeridian (0, 180 and 0, -180).
 *    - Pathological inputs: NaN, null, undefined, extreme floats, negative zero (-0).
 *    - Monte Carlo fuzzing (1000 randomized coordinates in [-90, 90] x [-180, 180]).
 *    - Boundary checks & non-finite floating point handling.
 *
 * 2. Zero-Fetch Performance & Render Speed:
 *    - Mount RouteMiniMapPane and ExpeditionRoomCockpit in isolation.
 *    - Strictly 0 network fetches (global.fetch spy).
 *    - Benchmark rendering speed: cockpit with 50 items must execute in < 15ms.
 *    - Benchmark sustained multi-iteration execution times.
 *
 * 3. Design Invariants & Apple HIG Ergonomics:
 *    - Strictly ZERO orange #E4501C in any rendered HTML or CSS classes.
 *    - Strictly ZERO orange tailwind classes (text-orange, bg-orange, border-orange).
 *    - Verify touch targets >= 44px (h-[44px] and min-h-[44px]) across:
 *      * All 5 navigation tabs in ExpeditionRoomCockpit
 *      * All 4 check-in broadcast buttons in FieldCheckInsPane
 *      * MiniMap actions, weather refresh, and checklist items.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

// Production imports under adversarial review
import {
  formatEmergencyCoordinates,
  formatCheckInBroadcast,
  type ExpeditionRoom,
  type ExpeditionChecklistItem,
  type FieldCheckIn,
  type CheckInStatus,
  type ChecklistCategory,
} from '@/features/messaging/types/expeditionRooms.types';

import {
  type OutdoorRole,
  type ClubChannel,
} from '@/features/messaging/types/clubs.types';

import { ExpeditionRoomCockpit, type CockpitPane } from '@/features/messaging/components/expedition/ExpeditionRoomCockpit';
import { RouteMiniMapPane } from '@/features/messaging/components/expedition/RouteMiniMapPane';
import { WeatherPane } from '@/features/messaging/components/expedition/WeatherPane';
import { SharedChecklistPane } from '@/features/messaging/components/expedition/SharedChecklistPane';
import { FieldCheckInsPane } from '@/features/messaging/components/expedition/FieldCheckInsPane';
import { ClubChannelsList } from '@/features/messaging/components/clubs/ClubChannelsList';
import { ClubRoleBadge } from '@/features/messaging/components/clubs/ClubRoleBadge';

// Helper to generate N checklist items
function generateChecklistItems(count: number): ExpeditionChecklistItem[] {
  const categories: ChecklistCategory[] = [
    'gear',
    'safety',
    'food',
    'logistics',
    'navigation',
    'camp',
    'medical',
    'admin',
  ];
  return Array.from({ length: count }, (_, i) => ({
    id: `item-${i}`,
    label: `Élément de checklist ${i}`,
    category: categories[i % categories.length],
    isCompleted: i % 3 === 0,
    priority: (i % 2 === 0 ? 'high' : 'normal') as 'low' | 'normal' | 'high' | 'urgent',
    assignedTo: i % 2 === 0 ? `user-${i}` : null,
    assignedName: i % 2 === 0 ? `Participant ${i}` : null,
    createdBy: 'user-0',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }));
}

// Helper to generate N field check-ins
function generateCheckIns(count: number): FieldCheckIn[] {
  const statuses: CheckInStatus[] = ['ok', 'camp_set', 'delayed', 'sos'];
  return Array.from({ length: count }, (_, i) => ({
    id: `checkin-${i}`,
    roomId: 'room-1',
    authorId: `user-${i}`,
    authorName: `Grimpeur ${i}`,
    status: statuses[i % statuses.length],
    message: `Rapport terrain numéro ${i}`,
    location: {
      latitude: 45.8326 + i * 0.001,
      longitude: 6.8652 + i * 0.001,
      altitudeM: 3842 - i * 10,
      name: `Col ${i}`,
    },
    batteryPercent: Math.max(5, 100 - i * 4),
    timestamp: new Date(Date.now() - i * 600000).toISOString(),
  }));
}

describe('Challenger M3: Adversarial Cockpit Performance & Coordinate Formatting', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(global, 'fetch');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ===========================================================================
  // SUITE 1: ADVERSARIAL COORDINATE FORMATTING (formatEmergencyCoordinates)
  // ===========================================================================
  describe('1. Adversarial Coordinate Formatting', () => {
    it('COORD-01: Null Island (0, 0) formats unambiguously as North and East', () => {
      const formatted = formatEmergencyCoordinates(0, 0);
      expect(formatted).toBe('0.0000° N, 0.0000° E');
    });

    it('COORD-02: North Pole (90, 0) and South Pole (-90, 0) format accurately', () => {
      expect(formatEmergencyCoordinates(90, 0)).toBe('90.0000° N, 0.0000° E');
      expect(formatEmergencyCoordinates(-90, 0)).toBe('90.0000° S, 0.0000° E');
    });

    it('COORD-03: Antimeridian (+180 and -180) formats with correct hemisphere flags', () => {
      expect(formatEmergencyCoordinates(0, 180)).toBe('0.0000° N, 180.0000° E');
      expect(formatEmergencyCoordinates(0, -180)).toBe('0.0000° N, 180.0000° W');
      expect(formatEmergencyCoordinates(45.5, 180)).toBe('45.5000° N, 180.0000° E');
      expect(formatEmergencyCoordinates(-45.5, -180)).toBe('45.5000° S, 180.0000° W');
    });

    it('COORD-04: Negative zero (-0) does not produce negative signs or crash', () => {
      const resLat = formatEmergencyCoordinates(-0, 10);
      expect(resLat).toBe('0.0000° N, 10.0000° E');

      const resLng = formatEmergencyCoordinates(10, -0);
      expect(resLng).toBe('10.0000° N, 0.0000° E');

      const resBoth = formatEmergencyCoordinates(-0, -0);
      expect(resBoth).toBe('0.0000° N, 0.0000° E');
      expect(resBoth).not.toContain('-');
    });

    it('COORD-05: Missing, null, undefined, or NaN inputs return emergency rescue fallback', () => {
      const fallback =
        'Position non disponible — utilise l’application de ton téléphone pour communiquer ta position exacte au 112';

      expect(formatEmergencyCoordinates(null, null)).toBe(fallback);
      expect(formatEmergencyCoordinates(null, 10)).toBe(fallback);
      expect(formatEmergencyCoordinates(10, null)).toBe(fallback);
      expect(formatEmergencyCoordinates(undefined, undefined)).toBe(fallback);
      expect(formatEmergencyCoordinates(undefined, 10)).toBe(fallback);
      expect(formatEmergencyCoordinates(10, undefined)).toBe(fallback);
      expect(formatEmergencyCoordinates(NaN, NaN)).toBe(fallback);
      expect(formatEmergencyCoordinates(NaN, 10)).toBe(fallback);
      expect(formatEmergencyCoordinates(10, NaN)).toBe(fallback);
    });

    it('COORD-06: Extreme floating point decimals round strictly to 4 decimal places', () => {
      // 45.12345678912345 -> 45.1235
      // -73.98765432109876 -> 73.9877 W
      const formatted = formatEmergencyCoordinates(45.12345678912345, -73.98765432109876);
      expect(formatted).toBe('45.1235° N, 73.9877° W');

      // Rounding half up boundaries
      expect(formatEmergencyCoordinates(44.000049, 7.000049)).toBe('44.0000° N, 7.0000° E');
      expect(formatEmergencyCoordinates(44.00005, 7.00005)).toBe('44.0001° N, 7.0001° E');

      // Micro coordinates near zero
      expect(formatEmergencyCoordinates(0.00001, -0.00001)).toBe('0.0000° N, 0.0000° W');
    });

    it('COORD-07: Fuzzing 1000 randomized coordinates guarantees standard DD.DDDD format', () => {
      for (let i = 0; i < 1000; i++) {
        const randLat = Math.random() * 180 - 90;
        const randLng = Math.random() * 360 - 180;
        const result = formatEmergencyCoordinates(randLat, randLng);

        // Must match regex: N.NNNN° [N|S], M.MMMM° [E|W]
        const match = result.match(/^(\d+\.\d{4})° ([NS]), (\d+\.\d{4})° ([EW])$/);
        expect(match).not.toBeNull();
        if (match) {
          const latVal = parseFloat(match[1]);
          const lngVal = parseFloat(match[3]);
          expect(latVal).toBeGreaterThanOrEqual(0);
          expect(latVal).toBeLessThanOrEqual(90.0001); // with rounding
          expect(lngVal).toBeGreaterThanOrEqual(0);
          expect(lngVal).toBeLessThanOrEqual(180.0001); // with rounding
        }
      }
    });

    it('COORD-08: formatCheckInBroadcast integrates formatEmergencyCoordinates correctly', () => {
      const sosCheckin: FieldCheckIn = {
        id: 'sos-1',
        roomId: 'r1',
        authorId: 'u1',
        authorName: 'Jean Dupont',
        status: 'sos',
        location: { latitude: 45.8326, longitude: 6.8652, altitudeM: 4000 },
        timestamp: new Date().toISOString(),
      };

      const broadcast = formatCheckInBroadcast(sosCheckin);
      expect(broadcast.severity).toBe('critical');
      expect(broadcast.emergencyCoordinates).toBe('45.8326° N, 6.8652° E');
      expect(broadcast.title).toContain('DETRESSE SOS');
    });
  });

  // ===========================================================================
  // SUITE 2: ZERO-FETCH PERFORMANCE & RENDER BENCHMARKS
  // ===========================================================================
  describe('2. Zero-Fetch Performance & Render Speed', () => {
    it('PERF-01: RouteMiniMapPane mounts with strictly 0 network fetches', () => {
      const snapshot = {
        title: 'Tracé du Mont Blanc',
        distanceKm: 28.4,
        elevationGainM: 2350,
        svgPolylinePath: '10,80 30,60 70,75 120,40 180,20 230,10',
        estimatedDurationMinutes: 510,
      };

      const html = renderToStaticMarkup(
        React.createElement(RouteMiniMapPane, {
          snapshot,
          gpxTrackUrl: 'https://cdn.lkdv.fr/gpx/mont-blanc.gpx',
        })
      );

      expect(fetchSpy).not.toHaveBeenCalled();
      expect(html).toContain('Tracé du Mont Blanc');
      expect(html).toContain('polyline');
    });

    it('PERF-02: ExpeditionRoomCockpit mounts all 5 panes with strictly 0 network fetches', () => {
      const items = generateChecklistItems(50);
      const checkins = generateCheckIns(20);
      const room: ExpeditionRoom = {
        id: 'room-alps',
        conversationId: 'conv-alps',
        title: 'Expédition Écrins 2026',
        status: 'active',
      };
      const weatherData = {
        locationName: 'Massif des Écrins',
        tempC: -4,
        windKmH: 35,
        freezingLevelM: 2200,
        precipitationProbability: 20,
      };
      const gpxSnapshot = {
        title: 'Traversée des Écrins',
        distanceKm: 42.1,
        elevationGainM: 3400,
        svgPolylinePath: '0,90 50,70 100,50 150,30 200,10',
      };

      const panes: CockpitPane[] = ['chat', 'weather', 'route', 'checklist', 'checkins'];

      for (const pane of panes) {
        const html = renderToStaticMarkup(
          React.createElement(ExpeditionRoomCockpit, {
            room,
            activePane: pane,
            weatherData,
            gpxSnapshot,
            checklistItems: items,
            checkins,
            lastCheckIn: checkins[0],
          })
        );
        expect(html.length).toBeGreaterThan(0);
      }

      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('PERF-03: Benchmark: mounting ExpeditionRoomCockpit with 50 items executes in < 15ms', () => {
      const items = generateChecklistItems(50);
      const checkins = generateCheckIns(10);
      const room: ExpeditionRoom = {
        id: 'bench-room',
        conversationId: 'bench-conv',
        title: 'Traversée du Queyras',
        status: 'active',
      };

      // Measure isolated mount time with full 50 checklist items rendered in activePane
      const t0 = performance.now();
      const html = renderToStaticMarkup(
        React.createElement(ExpeditionRoomCockpit, {
          room,
          checklistItems: items,
          checkins,
          activePane: 'checklist',
        })
      );
      const executionTimeMs = performance.now() - t0;

      expect(html).toContain('Checklist Partagée');
      expect(executionTimeMs).toBeLessThan(15);
    });

    it('PERF-04: Sustained load benchmark: 20 consecutive cockpit mounts average < 5ms each', () => {
      const items = generateChecklistItems(50);
      const room: ExpeditionRoom = {
        id: 'bench-sustained',
        conversationId: 'bench-conv',
        title: 'Benchmark Sustained Load',
        status: 'active',
      };

      const times: number[] = [];
      for (let i = 0; i < 20; i++) {
        const t0 = performance.now();
        renderToStaticMarkup(
          React.createElement(ExpeditionRoomCockpit, {
            room,
            checklistItems: items,
            activePane: 'checklist',
          })
        );
        times.push(performance.now() - t0);
      }

      const totalTime = times.reduce((a, b) => a + b, 0);
      const averageTime = totalTime / times.length;
      const maxTime = Math.max(...times);

      expect(averageTime).toBeLessThan(5);
      expect(maxTime).toBeLessThan(15);
    });
  });

  // ===========================================================================
  // SUITE 3: DESIGN INVARIANTS (ZERO ORANGE & APPLE HIG TOUCH TARGETS >= 44PX)
  // ===========================================================================
  describe('3. Design Invariants (Zero Orange & Touch Targets >= 44px)', () => {
    it('DESIGN-01: Rendered HTML across all panes contains ZERO orange (#E4501C)', () => {
      const items = generateChecklistItems(10);
      const checkins = generateCheckIns(4);
      const room: ExpeditionRoom = {
        id: 'room-design',
        conversationId: 'conv-design',
        title: 'Design Invariants Audit',
        status: 'active',
      };

      const panes: CockpitPane[] = ['chat', 'weather', 'route', 'checklist', 'checkins'];
      const renderedOutputs: string[] = [];

      // 1. Cockpit in each pane
      for (const p of panes) {
        renderedOutputs.push(
          renderToStaticMarkup(
            React.createElement(ExpeditionRoomCockpit, {
              room,
              activePane: p,
              checklistItems: items,
              checkins,
            })
          )
        );
      }

      // 2. Individual sub-panes in isolation
      renderedOutputs.push(
        renderToStaticMarkup(
          React.createElement(RouteMiniMapPane, {
            snapshot: {
              title: 'Col de la Vanoise',
              distanceKm: 15,
              elevationGainM: 1100,
              svgPolylinePath: '0,50 100,20',
            },
          })
        )
      );
      renderedOutputs.push(
        renderToStaticMarkup(
          React.createElement(WeatherPane, {
            weatherData: {
              locationName: 'Refuge du Promontoire',
              tempC: -2,
              windKmH: 45,
              freezingLevelM: 2800,
              precipitationProbability: 60,
            },
          })
        )
      );
      renderedOutputs.push(
        renderToStaticMarkup(
          React.createElement(SharedChecklistPane, {
            items,
            currentUserId: 'user-0',
          })
        )
      );
      renderedOutputs.push(
        renderToStaticMarkup(
          React.createElement(FieldCheckInsPane, {
            checkins,
            lastCheckIn: checkins[3], // SOS status
            onBroadcastCheckin: vi.fn(),
          })
        )
      );

      // 3. Clubs components
      const mockChannels: ClubChannel[] = [
        {
          id: 'ch-1',
          clubId: 'club-1',
          conversationId: 'conv-1',
          name: 'général',
          channelType: 'general',
          minRoleToRead: 'member',
          minRoleToWrite: 'member',
        },
        {
          id: 'ch-2',
          clubId: 'club-1',
          conversationId: 'conv-2',
          name: 'annonces-officielles',
          channelType: 'announcements',
          minRoleToRead: 'member',
          minRoleToWrite: 'admin',
        },
      ];
      renderedOutputs.push(
        renderToStaticMarkup(
          React.createElement(ClubChannelsList, {
            channels: mockChannels,
            activeChannelId: 'ch-1',
            userRole: 'member',
          })
        )
      );

      const roles: OutdoorRole[] = ['owner', 'admin', 'guide', 'safety', 'member'];
      for (const r of roles) {
        renderedOutputs.push(
          renderToStaticMarkup(React.createElement(ClubRoleBadge, { role: r }))
        );
      }

      // Check all rendered outputs for #E4501C or tailwind orange classes
      for (const html of renderedOutputs) {
        expect(html.toLowerCase()).not.toContain('#e4501c');
        expect(html).not.toMatch(/text-orange-\d+/);
        expect(html).not.toMatch(/bg-orange-\d+/);
        expect(html).not.toMatch(/border-orange-\d+/);
      }
    });

    it('DESIGN-02: All 5 navigation tabs enforce touch target >= 44px (h-[44px] min-h-[44px])', () => {
      const room: ExpeditionRoom = {
        id: 'room-tabs',
        conversationId: 'conv-tabs',
        title: 'Tabs Touch Target Audit',
        status: 'active',
      };

      const html = renderToStaticMarkup(
        React.createElement(ExpeditionRoomCockpit, { room })
      );

      // Verify the 5 navigation tabs: chat, weather, route, checklist, checkins
      const tabKeywords = ['chat', 'weather', 'route', 'checklist', 'checkins'];
      for (const tab of tabKeywords) {
        expect(html).toContain(tab);
      }

      // Verify French localized interface labels
      const frenchLabels = ['Discussion', 'Météo', 'Tracé GPX', 'Checklist', 'Points de situation'];
      for (const label of frenchLabels) {
        expect(html).toContain(label);
      }

      // Find all buttons inside the navigation element
      const buttonMatches = html.match(/<button[^>]*class="([^"]*)"[^>]*>/g) || [];
      const navButtons = buttonMatches.filter((btn) =>
        tabKeywords.some((tab) => html.includes(tab))
      );

      expect(navButtons.length).toBeGreaterThanOrEqual(5);
      for (const btn of navButtons.slice(0, 5)) {
        expect(btn).toContain('h-[44px]');
        expect(btn).toContain('min-h-[44px]');
      }
    });

    it('DESIGN-03: All 4 check-in broadcast buttons enforce touch target >= 44px (h-[44px] min-h-[44px])', () => {
      const html = renderToStaticMarkup(
        React.createElement(FieldCheckInsPane, {
          onBroadcastCheckin: vi.fn(),
        })
      );

      // 4 buttons: OK, Bivouac, Retard, SOS
      expect(html).toContain('OK · Tout va bien');
      expect(html).toContain('Bivouac établi');
      expect(html).toContain('Retard signalé');
      expect(html).toContain('Alerte SOS');

      const broadcastButtonMatches = html.match(/<button[^>]*class="([^"]*)"[^>]*>/g) || [];
      expect(broadcastButtonMatches.length).toBe(4);

      for (const btn of broadcastButtonMatches) {
        expect(btn).toContain('h-[44px]');
        expect(btn).toContain('min-h-[44px]');
      }
    });

    it('DESIGN-04: Sub-pane interactive buttons (explorer, refresh, checklist) enforce touch target >= 44px', () => {
      // 1. RouteMiniMapPane explorer & download buttons
      const routeHtml = renderToStaticMarkup(
        React.createElement(RouteMiniMapPane, {
          snapshot: {
            title: 'Col',
            distanceKm: 10,
            elevationGainM: 500,
            svgPolylinePath: '0,0 10,10',
          },
          gpxTrackUrl: 'https://cdn.lkdv.fr/track.gpx',
          onOpenExplorer: vi.fn(),
        })
      );
      expect(routeHtml).toContain('h-[44px]');
      expect(routeHtml).toContain('min-h-[44px]');

      // 2. WeatherPane refresh button
      const weatherHtml = renderToStaticMarkup(
        React.createElement(WeatherPane, {
          weatherData: { tempC: 5 },
          onRefresh: vi.fn(),
        })
      );
      expect(weatherHtml).toContain('h-[44px]');
      expect(weatherHtml).toContain('min-h-[44px]');

      // 3. SharedChecklistPane checklist items
      const checklistHtml = renderToStaticMarkup(
        React.createElement(SharedChecklistPane, {
          items: generateChecklistItems(3),
          onToggleItem: vi.fn(),
        })
      );
      expect(checklistHtml).toContain('h-[44px]');
      expect(checklistHtml).toContain('min-h-[44px]');
      expect(checklistHtml).toContain('role="checkbox"');
      expect(checklistHtml).toContain('aria-checked=');
    });

    it('DESIGN-05: ExpeditionRoomCockpit renders true responsive desktop 2-column layout concurrently', () => {
      const room: ExpeditionRoom = {
        id: 'room-cols',
        conversationId: 'conv-cols',
        title: 'Desktop 2-Col Test',
        status: 'active',
      };
      const weatherData = {
        locationName: 'Massif du Mont-Blanc',
        tempC: -5,
        windKmH: 40,
      };

      const html = renderToStaticMarkup(
        React.createElement(
          ExpeditionRoomCockpit,
          {
            room,
            activePane: 'weather',
            weatherData,
          },
          React.createElement('div', { id: 'chat-stream-desktop' }, 'Flux de discussion desktop')
        )
      );

      // Desktop grid classes and column identifiers
      expect(html).toContain('md:grid-cols-2');
      expect(html).toContain('data-testid="cockpit-chat-column"');
      expect(html).toContain('data-testid="cockpit-tactical-column"');

      // Both chat stream and active tactical pane rendered concurrently
      expect(html).toContain('chat-stream-desktop');
      expect(html).toContain('Flux de discussion desktop');
      expect(html).toContain('Massif du Mont-Blanc');
      expect(html).toContain('-5°C');
    });
  });

  // ===========================================================================
  // SUITE 4: ADVERSARIAL RESILIENCE & PATHOLOGICAL BOUNDARY CONDITIONS
  // ===========================================================================
  describe('4. Adversarial Resilience & Pathological Boundary Conditions', () => {
    it('EDGE-01: Cockpit renders gracefully with completely empty / null data fields', () => {
      const emptyRoom: ExpeditionRoom = {
        id: 'empty-1',
        conversationId: 'empty-conv',
        title: '',
        status: 'planning',
      };

      expect(() => {
        renderToStaticMarkup(
          React.createElement(ExpeditionRoomCockpit, {
            room: emptyRoom,
            weatherData: null,
            gpxSnapshot: null,
            checklistItems: [],
            checkins: [],
            lastCheckIn: null,
          })
        );
      }).not.toThrow();
    });

    it('EDGE-02: RouteMiniMapPane handles null snapshot and malformed SVG points without crashing', () => {
      // Null snapshot
      const htmlNull = renderToStaticMarkup(React.createElement(RouteMiniMapPane, { snapshot: null }));
      expect(htmlNull).toContain('Aucun tracé associé');

      // Empty SVG path
      const htmlEmptySvg = renderToStaticMarkup(
        React.createElement(RouteMiniMapPane, {
          snapshot: { title: 'Trace vide', svgPolylinePath: '' },
        })
      );
      expect(htmlEmptySvg).not.toContain('polyline');
    });

    it('EDGE-03: FieldCheckInsPane displays critical SOS banner with emergency coordinates', () => {
      const sosCheckin: FieldCheckIn = {
        id: 'sos-edge',
        roomId: 'room-1',
        authorId: 'u-sos',
        authorName: 'Alexandre Guide',
        status: 'sos',
        message: 'Chute de sérac, jambe fracturée',
        location: {
          latitude: 45.9237,
          longitude: 6.8694,
          name: 'Glacier des Bossons',
        },
        batteryPercent: 12,
        timestamp: new Date().toISOString(),
      };

      const html = renderToStaticMarkup(
        React.createElement(FieldCheckInsPane, {
          lastCheckIn: sosCheckin,
        })
      );

      expect(html).toContain('ALERTE DETRESSE SOS EN COURS');
      expect(html).toContain('45.9237° N, 6.8694° E');
      expect(html).toContain('Chute de sérac, jambe fracturée');
      expect(html).toContain('Alexandre Guide');
      expect(html).toContain('12%');
    });
  });
});
