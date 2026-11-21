import { describe, expect, it } from 'vitest';
import { deriveWeatherAlerts, weatherFreshnessLabel } from '@/features/hub/cockpit/weatherAdvice';
import { computeKitWeights, formatWeight } from '@/features/hub/cockpit/kitMath';
import { chunkMembersByThree, compareMemberProgress, formatRelativeDelta } from '@/features/hub/cockpit/groupProgress';
import { evaluateDocumentExpiry } from '@/features/hub/cockpit/paperasseStatus';

describe('cockpit widgets domain', () => {
  describe('weatherAdvice', () => {
    it('derives wind, rain, freeze and heat alerts strictly from real thresholds', () => {
      const alerts = deriveWeatherAlerts({
        date: '2026-11-21',
        day: 'sam.',
        low: -2,
        high: 34,
        condition: 'Pluie forte',
        wind: 58,
        rain: 14.5,
      });
      expect(alerts.map((a) => a.id)).toEqual(['wind', 'rain', 'freeze', 'heat']);
    });

    it('returns no alert when metrics are mild or missing', () => {
      expect(deriveWeatherAlerts({ date: '2026-11-21', day: 'sam.', low: 8, high: 20, condition: 'Clair', wind: 15, rain: 0 })).toEqual([]);
      expect(deriveWeatherAlerts(undefined)).toEqual([]);
    });

    it('computes honest freshness labels', () => {
      const now = Date.parse('2026-11-21T12:00:00Z');
      expect(weatherFreshnessLabel('2026-11-21T11:58:00Z', now)).toBe('À jour (< 5 min)');
      expect(weatherFreshnessLabel('2026-11-21T11:25:00Z', now)).toBe('Relevé il y a 35 min');
      expect(weatherFreshnessLabel('2026-11-21T08:00:00Z', now)).toBe('Relevé il y a 4 h');
    });
  });

  describe('kitMath', () => {
    it('separates base, worn and consumable weights accurately', () => {
      const breakdown = computeKitWeights([
        { id: '1', title: 'Tente', amount: 1, packed: true, weightGrams: 1200, shared: true },
        { id: '2', title: 'Chaussures', amount: 1, packed: true, weightGrams: 850, worn: true },
        { id: '3', title: 'Eau 1L', amount: 2, packed: false, weightGrams: 1000, consumable: true, vital: true },
      ]);
      expect(breakdown).toEqual({
        baseWeightGrams: 1200,
        wornWeightGrams: 850,
        consumableWeightGrams: 2000,
        totalWeightGrams: 4050,
        packedWeightGrams: 2050,
        vitalUnpackedCount: 1,
        sharedCount: 1,
      });
      expect(formatWeight(breakdown.totalWeightGrams)).toBe('4,05 kg');
      expect(formatWeight(450)).toBe('450 g');
    });
  });

  describe('groupProgress', () => {
    it('chunks 50 members into sliding groups of 3', () => {
      const members = Array.from({ length: 50 }, (_, i) => ({ id: `m-${i}` }));
      const chunks = chunkMembersByThree(members);
      expect(chunks).toHaveLength(17);
      expect(chunks[0]).toHaveLength(3);
      expect(chunks[16]).toHaveLength(2);
    });

    it('compares relative progress only on matching route revision', () => {
      const now = Date.parse('2026-11-21T10:00:00Z');
      const ahead = compareMemberProgress(
        { alongMeters: 3000, routeRevision: 2 },
        { alongMeters: 4450, routeRevision: 2, positionUpdatedAt: '2026-11-21T09:55:00Z' },
        now,
      );
      expect(ahead).toEqual({ relation: 'ahead', deltaMeters: 1450, stale: false });
      expect(formatRelativeDelta(ahead)).toBe('1,5 km devant');

      const mismatch = compareMemberProgress(
        { alongMeters: 3000, routeRevision: 2 },
        { alongMeters: 4450, routeRevision: 1, positionUpdatedAt: '2026-11-21T09:55:00Z' },
        now,
      );
      expect(mismatch.relation).toBe('unknown');
      expect(formatRelativeDelta(mismatch)).toBe('Position non partagée');
    });
  });

  describe('paperasseStatus', () => {
    it('classifies expired, expiring soon and valid documents', () => {
      expect(evaluateDocumentExpiry('2026-11-10', '2026-11-21').health).toBe('expired');
      expect(evaluateDocumentExpiry('2026-11-21', '2026-11-21').label).toBe('Expire aujourd’hui');
      expect(evaluateDocumentExpiry('2026-12-05', '2026-11-21').health).toBe('expiring_soon');
      expect(evaluateDocumentExpiry('2027-06-01', '2026-11-21').health).toBe('valid');
      expect(evaluateDocumentExpiry(null, '2026-11-21').health).toBe('no_expiry');
    });
  });
});
