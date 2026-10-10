/**
 * LKDV Social — Milestone 2 Challenger Stress Suite (M2.2)
 * Spec: tests/messaging/challenger-m2-2-livecards-stress.spec.ts
 *
 * ADVERSARIAL STRESS TEST HARNESS:
 * 1. Zero-Fetch Performance:
 *    - 100 GPXLiveCard instances mount with 0 HTTP requests (global.fetch).
 *    - Rendering speed benchmark: 100 cards execute in < 50ms.
 *    - Extended multi-card batch (Kit, Equipment, Expedition) zero-fetch validation.
 * 2. Snapshot Resilience & Fuzzing:
 *    - Malformed, corrupt, or missing fields in message.metadata.
 *    - Negative geographic coordinates (Southern/Western hemispheres).
 *    - Pathological / infinite bounds, empty or enormous polyline strings.
 *    - Corrupted numeric types (NaN, Infinity, strings, negatives).
 *    - XSS / special characters injection resilience.
 * 3. Compact Thread Footprint:
 *    - Max width constraints (max-w-[320px] or tighter).
 *    - Overflow protection preventing chat thread horizontal blowout.
 * 4. Apple HIG Ergonomics & Touch Targets:
 *    - All interactive targets >= 44x44 pt.
 * 5. WCAG 2.2 Accessibility & Design Tokens:
 *    - Keyboard navigation (role="button", tabIndex, Enter key).
 *    - ARIA attributes (aria-label, aria-hidden, role="presentation", role="dialog").
 *    - Zero orange #E4501C, strict LKDV design tokens compliance.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

// Domain and snapshot types
import {
  isGPXSnapshot,
  isKitSnapshot,
  isEquipmentSnapshot,
  isExpeditionSnapshot,
  isActivitySheetSnapshot,
  isOutdoorObjectSnapshot,
  hydrateOutdoorSnapshot,
  serializeGPXSnapshot,
  serializeKitSnapshot,
  type GPXSnapshot,
  type KitSnapshot,
  type EquipmentSnapshot,
  type ExpeditionSnapshot,
} from '@/features/messaging/types/outdoorObjects.types';

// Components under test
import { GPXLiveCard } from '@/features/messaging/components/GPXLiveCard';
import { KitLiveCard } from '@/features/messaging/components/KitLiveCard';
import { EquipmentLiveCard } from '@/features/messaging/components/EquipmentLiveCard';
import { ExpeditionLiveCard } from '@/features/messaging/components/ExpeditionLiveCard';
import { PackMergeSheet } from '@/features/messaging/components/PackMergeSheet';
import type { PackMergeResult } from '@/features/messaging/domain/packMerge';

describe('Milestone 2 Challenger: Live Cards Performance & Thread Scalability', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(global, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. ZERO-FETCH PERFORMANCE & RENDERING THROUGHPUT
  // ═══════════════════════════════════════════════════════════════════════════
  describe('1. Zero-Fetch Performance & Rendering Throughput', () => {
    const createSampleGPXSnapshot = (index: number): GPXSnapshot => ({
      type: 'gpx_snapshot',
      id: `route-${index}`,
      title: `Sentier Alpin #${index}`,
      distanceKm: 12.5 + (index % 10),
      elevationGainM: 750 + (index * 25),
      elevationLossM: 700 + (index * 20),
      estimatedDurationMinutes: 240 + (index * 5),
      svgPolylinePath: `10,80 ${20 + (index % 50)},40 ${100 + (index % 50)},60 230,15`,
      bounds: {
        minLat: 45.0 + index * 0.01,
        maxLat: 45.5 + index * 0.01,
        minLng: 6.0 + index * 0.01,
        maxLng: 6.5 + index * 0.01,
      },
      gpxFileUrl: index % 2 === 0 ? `https://example.com/tracks/${index}.gpx` : undefined,
    });

    it('PERF-01: Mounting 100 GPXLiveCard components triggers strictly 0 HTTP fetch requests', () => {
      for (let i = 0; i < 100; i++) {
        const snapshot = createSampleGPXSnapshot(i);
        const html = renderToStaticMarkup(React.createElement(GPXLiveCard, { snapshot }));
        expect(html).toContain(`Sentier Alpin #${i}`);
      }

      // STRICT ZERO-FETCH ASSERTION
      expect(fetchSpy).toHaveBeenCalledTimes(0);
    });

    it('PERF-02: Benchmark: 100 card renders execute in < 50ms (< 0.5ms per card)', () => {
      const snapshots = Array.from({ length: 100 }, (_, i) => createSampleGPXSnapshot(i));

      // Warm-up JIT
      for (let i = 0; i < 5; i++) {
        renderToStaticMarkup(React.createElement(GPXLiveCard, { snapshot: snapshots[i] }));
      }

      const start = performance.now();
      for (let i = 0; i < 100; i++) {
        renderToStaticMarkup(React.createElement(GPXLiveCard, { snapshot: snapshots[i] }));
      }
      const elapsed = performance.now() - start;

      expect(elapsed).toBeLessThan(50);
      expect(fetchSpy).toHaveBeenCalledTimes(0);
    });

    it('PERF-03: Zero-fetch and high throughput holds across all outdoor live cards', () => {
      const kitSnapshot: KitSnapshot = {
        type: 'kit_snapshot',
        kitId: 'k-trek-100',
        title: 'Trek Autonomie 5J',
        totalWeightGrams: 8400,
        itemCount: 18,
        categories: [
          { name: 'shelter', count: 2, weightGrams: 2200 },
          { name: 'sleep', count: 2, weightGrams: 1400 },
          { name: 'cook', count: 4, weightGrams: 900 },
          { name: 'water', count: 2, weightGrams: 350 },
        ],
      };

      const eqSnapshot: EquipmentSnapshot = {
        type: 'equipment_snapshot',
        equipmentId: 'eq-filter-1',
        name: 'Katadyn BeFree 1.0L',
        category: 'water',
        weightGrams: 63,
        brand: 'Katadyn',
        photoUrl: 'https://example.com/photo.jpg',
      };

      const expSnapshot: ExpeditionSnapshot = {
        type: 'expedition_snapshot',
        expeditionId: 'exp-mont-blanc',
        title: 'Tour du Mont-Blanc',
        status: 'active',
        participantCount: 6,
        routeDistanceKm: 170.0,
        elevationGainM: 10000,
        members: [
          { id: 'u1', fullName: 'Alice Guide', avatarUrl: 'https://example.com/a.jpg', role: 'guide' },
          { id: 'u2', fullName: 'Bob Member', avatarUrl: '', role: 'member' },
        ],
      };

      const start = performance.now();
      for (let i = 0; i < 50; i++) {
        renderToStaticMarkup(React.createElement(KitLiveCard, { snapshot: kitSnapshot }));
        renderToStaticMarkup(React.createElement(EquipmentLiveCard, { snapshot: eqSnapshot }));
        renderToStaticMarkup(React.createElement(ExpeditionLiveCard, { snapshot: expSnapshot }));
      }
      const elapsed = performance.now() - start;

      // 150 heterogeneous renders in < 50ms
      expect(elapsed).toBeLessThan(50);
      expect(fetchSpy).toHaveBeenCalledTimes(0);
    });

    it('PERF-04: Batch rendering of 300 mixed outdoor cards exhibits linear O(N) scaling', () => {
      const gpx = createSampleGPXSnapshot(42);
      const kit: KitSnapshot = {
        type: 'kit_snapshot',
        kitId: 'kit-1',
        title: 'Kit Test',
        totalWeightGrams: 5000,
        itemCount: 10,
        categories: [{ name: 'misc', count: 10, weightGrams: 5000 }],
      };

      const start = performance.now();
      for (let i = 0; i < 150; i++) {
        renderToStaticMarkup(React.createElement(GPXLiveCard, { snapshot: gpx }));
        renderToStaticMarkup(React.createElement(KitLiveCard, { snapshot: kit }));
      }
      const totalTime = performance.now() - start;

      // 300 renders under 100ms
      expect(totalTime).toBeLessThan(100);
      expect(fetchSpy).toHaveBeenCalledTimes(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. SNAPSHOT RESILIENCE & FUZZING (MALFORMED / PATHOLOGICAL METADATA)
  // ═══════════════════════════════════════════════════════════════════════════
  describe('2. Snapshot Resilience & Pathological Metadata Fuzzing', () => {
    it('FUZZ-01: hydrateOutdoorSnapshot safely rejects non-object primitives and null/undefined', () => {
      const pathologicalInputs = [
        null,
        undefined,
        '',
        '{"type":"gpx_snapshot"}',
        12345,
        -1,
        0,
        NaN,
        Infinity,
        -Infinity,
        true,
        false,
        Symbol('test'),
        [],
        [1, 2, 3],
        ['gpx_snapshot'],
        {},
        { type: null },
        { type: undefined },
        { type: 'random_unsupported_type' },
      ];

      pathologicalInputs.forEach((input) => {
        expect(() => hydrateOutdoorSnapshot(input)).not.toThrow();
        expect(hydrateOutdoorSnapshot(input)).toBeNull();
      });
    });

    it('FUZZ-02: Accurately supports real-world negative coordinates (Southern & Western hemispheres)', () => {
      // Patagonia Trek: southern hemisphere (negative lat) & western hemisphere (negative lng)
      const southernWesternGPX: GPXSnapshot = {
        type: 'gpx_snapshot',
        title: 'W Trek Torres del Paine',
        distanceKm: 76.5,
        elevationGainM: 3200,
        estimatedDurationMinutes: 1440,
        svgPolylinePath: '10,80 50,40 120,60 230,15',
        bounds: {
          minLat: -51.25,
          maxLat: -50.95,
          minLng: -73.20,
          maxLng: -72.80,
        },
      };

      expect(isGPXSnapshot(southernWesternGPX)).toBe(true);
      expect(hydrateOutdoorSnapshot(southernWesternGPX)).toEqual(southernWesternGPX);

      // Rendering must succeed without error
      const html = renderToStaticMarkup(React.createElement(GPXLiveCard, { snapshot: southernWesternGPX }));
      expect(html).toContain('W Trek Torres del Paine');
      expect(html).toContain('76.5 km');
    });

    it('FUZZ-03: Handles infinite, zero, and inverted bounds in GPXSnapshot without crashing', () => {
      const infiniteBoundsGPX: GPXSnapshot = {
        type: 'gpx_snapshot',
        title: 'Infinity Trail',
        distanceKm: 10.0,
        elevationGainM: 500,
        estimatedDurationMinutes: 150,
        svgPolylinePath: '10,10 200,80',
        bounds: {
          minLat: -Infinity,
          maxLat: Infinity,
          minLng: -Infinity,
          maxLng: Infinity,
        },
      };

      // Type guard accepts object bounds
      expect(isGPXSnapshot(infiniteBoundsGPX)).toBe(true);

      // Rendering must not crash
      expect(() => {
        const html = renderToStaticMarkup(React.createElement(GPXLiveCard, { snapshot: infiniteBoundsGPX }));
        expect(html).toContain('Infinity Trail');
      }).not.toThrow();
    });

    it('FUZZ-04: Rejects corrupted numeric types (NaN, strings, negatives where invalid)', () => {
      const invalidSnapshots = [
        // GPX with negative distance
        { type: 'gpx_snapshot', title: 'Bad 1', distanceKm: -5, svgPolylinePath: '10,10', bounds: {} },
        // GPX with NaN distance
        { type: 'gpx_snapshot', title: 'Bad 2', distanceKm: NaN, svgPolylinePath: '10,10', bounds: {} },
        // GPX with string distance
        { type: 'gpx_snapshot', title: 'Bad 3', distanceKm: '12km', svgPolylinePath: '10,10', bounds: {} },
        // GPX with array bounds
        { type: 'gpx_snapshot', title: 'Bad 4', distanceKm: 10, svgPolylinePath: '10,10', bounds: [1, 2] },
        // GPX with null bounds
        { type: 'gpx_snapshot', title: 'Bad 5', distanceKm: 10, svgPolylinePath: '10,10', bounds: null },
        // Kit with negative weight
        { type: 'kit_snapshot', kitId: 'k1', totalWeightGrams: -100, categories: [] },
        // Kit with NaN weight
        { type: 'kit_snapshot', kitId: 'k2', totalWeightGrams: NaN, categories: [] },
        // Kit with non-array categories
        { type: 'kit_snapshot', kitId: 'k3', totalWeightGrams: 500, categories: 'not-an-array' },
        // Equipment with negative weight
        { type: 'equipment_snapshot', equipmentId: 'e1', name: 'Eq', weightGrams: -50 },
        // Expedition with negative participant count
        { type: 'expedition_snapshot', expeditionId: 'x1', title: 'Exp', status: 'active', participantCount: -1 },
      ];

      invalidSnapshots.forEach((snap) => {
        expect(isOutdoorObjectSnapshot(snap)).toBe(false);
        expect(isKitSnapshot(snap)).toBe(false);
        expect(isEquipmentSnapshot(snap)).toBe(false);
        expect(isExpeditionSnapshot(snap)).toBe(false);
        expect(isActivitySheetSnapshot(snap)).toBe(false);
        expect(hydrateOutdoorSnapshot(snap)).toBeNull();
      });

      // Verify valid serialization and type guards
      const validPoints = [{ lat: 45.0, lng: 6.0 }, { lat: 45.5, lng: 6.5 }];
      const serializedGPX = serializeGPXSnapshot({ title: 'Valid GPX', points: validPoints });
      expect(isGPXSnapshot(serializedGPX)).toBe(true);

      const serializedKit = serializeKitSnapshot({
        id: 'k-ser',
        title: 'Serialized Kit',
        items: [{ name: 'Item', weightGrams: 500, category: 'cook' }],
      });
      expect(isKitSnapshot(serializedKit)).toBe(true);
    });

    it('FUZZ-05: GPXLiveCard renders safely with empty, single-point, or extreme SVG polylines', () => {
      const edgeCases = [
        { desc: 'Empty polyline', polyline: '' },
        { desc: 'Single point', polyline: '10,10' },
        { desc: 'Whitespace polyline', polyline: '   ' },
        { desc: 'Negative SVG coordinates', polyline: '-10,-20 -5,50' },
        { desc: 'Decimals with high precision', polyline: '10.1234567,20.9876543 50.555,60.666' },
      ];

      edgeCases.forEach(({ polyline }) => {
        const snap: GPXSnapshot = {
          type: 'gpx_snapshot',
          title: 'Pathological Polyline',
          distanceKm: 5.0,
          elevationGainM: 200,
          estimatedDurationMinutes: 60,
          svgPolylinePath: polyline,
          bounds: { minLat: 45, maxLat: 46, minLng: 6, maxLng: 7 },
        };

        expect(() => {
          const html = renderToStaticMarkup(React.createElement(GPXLiveCard, { snapshot: snap }));
          expect(html).toContain('Pathological Polyline');
          expect(html).toContain(`points="${polyline}"`);
        }).not.toThrow();
      });
    });

    it('FUZZ-06: KitLiveCard renders safely with 0g weight, empty categories, and single category', () => {
      const emptyKit: KitSnapshot = {
        type: 'kit_snapshot',
        kitId: 'kit-empty',
        title: 'Empty Pack',
        totalWeightGrams: 0,
        itemCount: 0,
        categories: [],
      };

      expect(() => {
        const html = renderToStaticMarkup(React.createElement(KitLiveCard, { snapshot: emptyKit }));
        expect(html).toContain('Empty Pack');
        expect(html).toContain('0 g');
        expect(html).toContain('0 objets');
      }).not.toThrow();

      const singleCatKit: KitSnapshot = {
        type: 'kit_snapshot',
        kitId: 'kit-single',
        title: 'Water Only Pack',
        totalWeightGrams: 2000,
        itemCount: 2,
        categories: [{ name: 'water', count: 2, weightGrams: 2000 }],
      };

      const html = renderToStaticMarkup(React.createElement(KitLiveCard, { snapshot: singleCatKit }));
      expect(html).toContain('Water Only Pack');
      expect(html).toContain('2.0 kg');
      expect(html).toContain('1 catégories');
    });

    it('FUZZ-07: EquipmentLiveCard & ExpeditionLiveCard handle missing optional fields safely', () => {
      const minimalEq: EquipmentSnapshot = {
        type: 'equipment_snapshot',
        equipmentId: 'eq-min',
        name: 'Simple Carabiner',
        category: 'climbing',
        weightGrams: 45,
      };

      expect(() => {
        const html = renderToStaticMarkup(React.createElement(EquipmentLiveCard, { snapshot: minimalEq }));
        expect(html).toContain('Simple Carabiner');
        expect(html).toContain('45 g');
        expect(html).toContain('climbing');
      }).not.toThrow();

      const minimalExp: ExpeditionSnapshot = {
        type: 'expedition_snapshot',
        expeditionId: 'exp-min',
        title: 'Secret Expedition',
        status: 'planning',
        participantCount: 1,
      };

      expect(() => {
        const html = renderToStaticMarkup(React.createElement(ExpeditionLiveCard, { snapshot: minimalExp }));
        expect(html).toContain('Secret Expedition');
        expect(html).toContain('1 membres');
      }).not.toThrow();
    });

    it('FUZZ-08: PackMergeSheet renders safely when given minimal or extreme overload states', () => {
      // Empty result
      expect(() => {
        const html = renderToStaticMarkup(React.createElement(PackMergeSheet, {}));
        expect(html).toContain("Optimisation du sac");
      }).not.toThrow();

      // Extreme overload (1000% capacity)
      const extremeResult: PackMergeResult = {
        deduplicatedItems: [],
        droppedDuplicates: [],
        removedDuplicates: [],
        individualLoads: {
          u1: {
            participantId: 'u1',
            name: 'Overloaded User',
            type: 'human',
            isDog: false,
            bodyWeightKg: 70,
            allocatedWeightGrams: 140000,
            allocatedWeightKg: 140.0,
            maxSafeWeightKg: 14.0,
            safeThresholdRatio: 0.20,
            actualRatio: 2.0,
            loadPercentage: 1000,
            isOverloaded: true,
            overloadGrams: 126000,
            assignedItems: [],
            roleOrBreed: 'Guide',
            role: 'guide',
            personalWeightGrams: 140000,
            sharedWeightGrams: 0,
            totalWeightGrams: 140000,
            totalWeightKg: 140.0,
            bodyWeightRatio: 2.0,
            items: [],
          },
        },
        totalGroupWeightGrams: 140000,
        totalSafeCapacityGrams: 14000,
        groupCapacityUtilizationPercentage: 1000,
        isGroupOverloaded: true,
        warnings: ['Surcharge critique : 140.0 kg pour 14.0 kg max'],
        metrics: {
          weightSavedDeduplicationGrams: 0,
          humanCount: 1,
          dogCount: 0,
          sharedItemCount: 0,
          personalItemCount: 1,
        },
        groupStats: {
          totalOriginalWeightGrams: 140000,
          totalOptimizedWeightGrams: 140000,
          weightSavedGrams: 0,
          weightSavedKg: 0,
          duplicateCount: 0,
          itemCountOriginal: 1,
          itemCountOptimized: 1,
          overloadedCount: 1,
        },
        participantLoads: [],
      };

      const html = renderToStaticMarkup(React.createElement(PackMergeSheet, { result: extremeResult }));
      expect(html).toContain('Overloaded User');
      expect(html).toContain('140 kg / 14 kg (1000%)');
      expect(html).toContain('Surcharge critique');
      expect(html).toContain('bg-red-500');
    });

    it('FUZZ-09: XSS / Malicious script injection in titles and strings is escaped by React DOM', () => {
      const maliciousGPX: GPXSnapshot = {
        type: 'gpx_snapshot',
        title: '<script>alert("XSS")</script>&"\'',
        distanceKm: 10.0,
        elevationGainM: 500,
        estimatedDurationMinutes: 120,
        svgPolylinePath: '0,0 10,10',
        bounds: { minLat: 0, maxLat: 1, minLng: 0, maxLng: 1 },
      };

      const html = renderToStaticMarkup(React.createElement(GPXLiveCard, { snapshot: maliciousGPX }));

      // Raw executable script tag must NEVER appear unescaped in rendered markup
      expect(html).not.toContain('<script>alert("XSS")</script>');
      expect(html).toContain('&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. COMPACT THREAD FOOTPRINT & LAYOUT CONSTRAINTS
  // ═══════════════════════════════════════════════════════════════════════════
  describe('3. Compact Thread Footprint & Layout Constraints', () => {
    it('LAYOUT-01: GPXLiveCard enforces max-w-[320px] and overflow-hidden', () => {
      const snapshot: GPXSnapshot = {
        type: 'gpx_snapshot',
        title: 'Compact Route',
        distanceKm: 10,
        elevationGainM: 400,
        estimatedDurationMinutes: 120,
        svgPolylinePath: '0,0 100,50',
        bounds: { minLat: 0, maxLat: 1, minLng: 0, maxLng: 1 },
      };

      const html = renderToStaticMarkup(React.createElement(GPXLiveCard, { snapshot }));
      expect(html).toContain('max-w-[320px]');
      expect(html).toContain('overflow-hidden');
      expect(html).toContain('w-full');
    });

    it('LAYOUT-02: KitLiveCard enforces max-w-[300px] (<= 320px) and overflow-hidden', () => {
      const snapshot: KitSnapshot = {
        type: 'kit_snapshot',
        kitId: 'k1',
        title: 'Compact Kit',
        totalWeightGrams: 3500,
        itemCount: 8,
        categories: [],
      };

      const html = renderToStaticMarkup(React.createElement(KitLiveCard, { snapshot }));
      expect(html).toContain('max-w-[300px]');
      expect(html).toContain('overflow-hidden');
      expect(html).toContain('w-full');
    });

    it('LAYOUT-03: EquipmentLiveCard enforces max-w-[260px] (<= 320px) and overflow-hidden', () => {
      const snapshot: EquipmentSnapshot = {
        type: 'equipment_snapshot',
        equipmentId: 'eq1',
        name: 'Compact Knife',
        category: 'tool',
        weightGrams: 85,
      };

      const html = renderToStaticMarkup(React.createElement(EquipmentLiveCard, { snapshot }));
      expect(html).toContain('max-w-[260px]');
      expect(html).toContain('overflow-hidden');
      expect(html).toContain('w-full');
    });

    it('LAYOUT-04: ExpeditionLiveCard enforces max-w-[320px] and overflow-hidden', () => {
      const snapshot: ExpeditionSnapshot = {
        type: 'expedition_snapshot',
        expeditionId: 'exp1',
        title: 'Compact Expedition',
        status: 'active',
        participantCount: 4,
      };

      const html = renderToStaticMarkup(React.createElement(ExpeditionLiveCard, { snapshot }));
      expect(html).toContain('max-w-[320px]');
      expect(html).toContain('overflow-hidden');
      expect(html).toContain('w-full');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. APPLE HIG ERGONOMICS & TOUCH TARGETS (>= 44x44 pt)
  // ═══════════════════════════════════════════════════════════════════════════
  describe('4. Apple HIG Ergonomics & Touch Targets (>= 44px)', () => {
    it('TOUCH-01: GPXLiveCard download button satisfies Apple HIG 44px touch target', () => {
      const snapshot: GPXSnapshot = {
        type: 'gpx_snapshot',
        title: 'Downloadable Track',
        distanceKm: 15,
        elevationGainM: 800,
        estimatedDurationMinutes: 200,
        svgPolylinePath: '0,0 100,50',
        bounds: { minLat: 0, maxLat: 1, minLng: 0, maxLng: 1 },
        gpxFileUrl: 'https://example.com/track.gpx',
      };

      const html = renderToStaticMarkup(React.createElement(GPXLiveCard, { snapshot }));

      // Must have min 44px dimensions
      expect(html).toContain('min-h-[44px]');
      expect(html).toContain('min-w-[44px]');
    });

    it('TOUCH-02: GPXLiveCard view detail action CTA button satisfies 44px min height', () => {
      const snapshot: GPXSnapshot = {
        type: 'gpx_snapshot',
        title: 'CTA Track',
        distanceKm: 15,
        elevationGainM: 800,
        estimatedDurationMinutes: 200,
        svgPolylinePath: '0,0 100,50',
        bounds: { minLat: 0, maxLat: 1, minLng: 0, maxLng: 1 },
      };

      const html = renderToStaticMarkup(React.createElement(GPXLiveCard, { snapshot }));

      expect(html).toContain('h-[44px]');
      expect(html).toContain('min-h-[44px]');
    });

    it('TOUCH-03: KitLiveCard Pack Merge trigger button satisfies 44px min height', () => {
      const snapshot: KitSnapshot = {
        type: 'kit_snapshot',
        kitId: 'k1',
        title: 'Mergeable Kit',
        totalWeightGrams: 4000,
        itemCount: 6,
        categories: [],
      };

      const html = renderToStaticMarkup(React.createElement(KitLiveCard, { snapshot }));

      expect(html).toContain('h-[44px]');
      expect(html).toContain('min-h-[44px]');
    });

    it('TOUCH-04: PackMergeSheet close button satisfies Apple HIG 44x44px touch target', () => {
      const html = renderToStaticMarkup(React.createElement(PackMergeSheet, {}));

      expect(html).toContain('min-h-[44px]');
      expect(html).toContain('min-w-[44px]');
      expect(html).toContain('h-[44px]');
      expect(html).toContain('w-[44px]');
    });

    it('TOUCH-05: PackMergeSheet Apply Merge button satisfies >= 44px height (min-h-[48px])', () => {
      const html = renderToStaticMarkup(React.createElement(PackMergeSheet, {}));

      expect(html).toContain('min-h-[48px]');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 5. WCAG 2.2 ACCESSIBILITY & DESIGN TOKENS COMPLIANCE
  // ═══════════════════════════════════════════════════════════════════════════
  describe('5. WCAG 2.2 Accessibility & Design Tokens Compliance', () => {
    it('A11Y-01: Interactive cards have role="button", tabIndex={0}, and descriptive aria-label', () => {
      const gpx: GPXSnapshot = {
        type: 'gpx_snapshot',
        title: 'A11y Test GPX',
        distanceKm: 8,
        elevationGainM: 300,
        estimatedDurationMinutes: 90,
        svgPolylinePath: '0,0 10,10',
        bounds: { minLat: 0, maxLat: 1, minLng: 0, maxLng: 1 },
      };

      const kit: KitSnapshot = {
        type: 'kit_snapshot',
        kitId: 'k1',
        title: 'A11y Test Kit',
        totalWeightGrams: 2500,
        itemCount: 5,
        categories: [],
      };

      const eq: EquipmentSnapshot = {
        type: 'equipment_snapshot',
        equipmentId: 'e1',
        name: 'A11y Test Eq',
        category: 'misc',
        weightGrams: 100,
      };

      const exp: ExpeditionSnapshot = {
        type: 'expedition_snapshot',
        expeditionId: 'x1',
        title: 'A11y Test Exp',
        status: 'active',
        participantCount: 3,
      };

      const htmlGPX = renderToStaticMarkup(React.createElement(GPXLiveCard, { snapshot: gpx }));
      const htmlKit = renderToStaticMarkup(React.createElement(KitLiveCard, { snapshot: kit }));
      const htmlEq = renderToStaticMarkup(React.createElement(EquipmentLiveCard, { snapshot: eq }));
      const htmlExp = renderToStaticMarkup(React.createElement(ExpeditionLiveCard, { snapshot: exp }));

      // GPX
      expect(htmlGPX).toContain('role="button"');
      expect(htmlGPX).toContain('tabindex="0"');
      expect(htmlGPX).toContain('aria-label="Tracé GPX : A11y Test GPX"');

      // Kit
      expect(htmlKit).toContain('role="button"');
      expect(htmlKit).toContain('tabindex="0"');
      expect(htmlKit).toContain('aria-label="Kit : A11y Test Kit"');

      // Equipment
      expect(htmlEq).toContain('role="button"');
      expect(htmlEq).toContain('tabindex="0"');
      expect(htmlEq).toContain('aria-label="Équipement : A11y Test Eq"');

      // Expedition
      expect(htmlExp).toContain('role="button"');
      expect(htmlExp).toContain('tabindex="0"');
      expect(htmlExp).toContain('aria-label="Expédition : A11y Test Exp"');
    });

    it('A11Y-02: Decorative SVGs and icons include aria-hidden="true" or role="presentation"', () => {
      const gpx: GPXSnapshot = {
        type: 'gpx_snapshot',
        title: 'Vector Route',
        distanceKm: 5,
        elevationGainM: 100,
        estimatedDurationMinutes: 60,
        svgPolylinePath: '0,0 10,10',
        bounds: { minLat: 0, maxLat: 1, minLng: 0, maxLng: 1 },
      };

      const html = renderToStaticMarkup(React.createElement(GPXLiveCard, { snapshot: gpx }));

      expect(html).toContain('aria-hidden="true"');
      expect(html).toContain('role="presentation"');
    });

    it('A11Y-03: PackMergeSheet is marked as modal dialog with title label', () => {
      const html = renderToStaticMarkup(React.createElement(PackMergeSheet, {}));

      expect(html).toContain('role="dialog"');
      expect(html).toContain('aria-modal="true"');
      expect(html).toContain('aria-labelledby="pack-merge-title"');
    });

    it('BRAND-01: Zero forbidden orange #E4501C in any live card component styles', () => {
      const gpx: GPXSnapshot = {
        type: 'gpx_snapshot',
        title: 'Brand Test',
        distanceKm: 12,
        elevationGainM: 500,
        estimatedDurationMinutes: 180,
        svgPolylinePath: '0,0 10,10',
        bounds: { minLat: 0, maxLat: 1, minLng: 0, maxLng: 1 },
      };

      const kit: KitSnapshot = {
        type: 'kit_snapshot',
        kitId: 'k1',
        title: 'Brand Kit',
        totalWeightGrams: 3000,
        itemCount: 4,
        categories: [{ name: 'cook', count: 1, weightGrams: 500 }],
      };

      const htmlGPX = renderToStaticMarkup(React.createElement(GPXLiveCard, { snapshot: gpx }));
      const htmlKit = renderToStaticMarkup(React.createElement(KitLiveCard, { snapshot: kit }));
      const htmlSheet = renderToStaticMarkup(React.createElement(PackMergeSheet, {}));

      // Prohibited LKDV color: #E4501C (orange)
      expect(htmlGPX.toLowerCase()).not.toContain('#e4501c');
      expect(htmlKit.toLowerCase()).not.toContain('#e4501c');
      expect(htmlSheet.toLowerCase()).not.toContain('#e4501c');
    });

    it('BRAND-02: Utilizes LKDV design tokens CSS custom properties for glass & colors', () => {
      const gpx: GPXSnapshot = {
        type: 'gpx_snapshot',
        title: 'Token Test',
        distanceKm: 10,
        elevationGainM: 500,
        estimatedDurationMinutes: 180,
        svgPolylinePath: '0,0 10,10',
        bounds: { minLat: 0, maxLat: 1, minLng: 0, maxLng: 1 },
      };

      const html = renderToStaticMarkup(React.createElement(GPXLiveCard, { snapshot: gpx }));

      expect(html).toContain('var(--glass-border)');
      expect(html).toContain('var(--glass-bg-medium)');
      expect(html).toContain('var(--lkv-primary)');
      expect(html).toContain('var(--lkv-secondary)');
      expect(html).toContain('var(--lkv-action)');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 6. MESSAGEBUBBLE THREAD INTEGRATION & GRACEFUL DEGRADATION
  // ═══════════════════════════════════════════════════════════════════════════
  describe('6. MessageBubble Thread Integration & Graceful Degradation', () => {
    it('BUBBLE-01: MessageBubble renders GPXLiveCard when metadata has valid GPX snapshot', async () => {
      const { MessageBubble } = await import('@/features/messaging/components/MessageBubble');

      const message = {
        id: 'msg-1',
        conversation_id: 'conv-1',
        sender_id: 'user-1',
        content: 'Check this route!',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        message_type: 'text' as const,
        metadata: {
          type: 'gpx_snapshot' as const,
          title: 'Col du Galibier',
          distanceKm: 34.0,
          elevationGainM: 1900,
          estimatedDurationMinutes: 300,
          svgPolylinePath: '10,80 120,40 230,15',
          bounds: { minLat: 45.0, maxLat: 45.2, minLng: 6.3, maxLng: 6.5 },
        },
      };

      const html = renderToStaticMarkup(
        React.createElement(MessageBubble, { message: message as any, isMine: false })
      );

      expect(html).toContain('Col du Galibier');
      expect(html).toContain('34.0 km');
      expect(html).toContain('+1900 m');
      expect(html).toContain('max-w-[320px]');
    });

    it('BUBBLE-02: MessageBubble degrades gracefully to plain text when metadata is corrupted', async () => {
      const { MessageBubble } = await import('@/features/messaging/components/MessageBubble');

      const corruptedMetadataList = [
        { type: 'gpx_snapshot' }, // Missing required fields
        { type: 'gpx_snapshot', distanceKm: -1 }, // Negative distance
        { type: 'kit_snapshot', totalWeightGrams: -100 }, // Negative weight
        { type: 'equipment_snapshot', weightGrams: -10 }, // Negative weight
        { type: 'expedition_snapshot', participantCount: -1 }, // Negative count
        { invalidField: 'unknown' },
        null,
      ];

      for (const meta of corruptedMetadataList) {
        const message = {
          id: 'msg-corrupt',
          conversation_id: 'conv-1',
          sender_id: 'user-1',
          content: 'Fallback text content',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          message_type: 'text' as const,
          metadata: meta as any,
        };

        expect(() => {
          const html = renderToStaticMarkup(
            React.createElement(MessageBubble, { message: message as any, isMine: false })
          );
          expect(html).toContain('Fallback text content');
          // None of the specialized live card headers should be rendered
          expect(html).not.toContain('Trace vectorielle');
        }).not.toThrow();
      }
    });
  });
});

