import { describe, it, expect } from 'vitest';
import {
  checkSafetyRedLines,
  blurSensitiveCoordinates,
  type SafetyRedLineViolation,
} from '@/features/trips/safety/safetyRedLines';
import {
  lookupBivouacRegulation,
  lookupWaterSources,
  lookupMountainShelters,
} from '@/features/trips/connectors/realDataConnectors';
import { extractTripBrief } from '@/features/trips/engine/tripBriefExtractor';
import type { Proposal } from '@/features/trips/schemas/autoGen.schema';

describe('Phase E — Connecteurs Données Réelles & Lignes Rouges Infranchissables (U13)', () => {
  describe('E.1 : Lignes Rouges de Sécurité (checkSafetyRedLines)', () => {
    it('TEST-REDLINE-01: Bloque tout alpinisme glaciaire autonome et impose un guide UIAGM', () => {
      const brief = extractTripBrief('Traversée de la Vallée Blanche et arête des Bosses en autonomie');
      const proposals: Record<string, Proposal<any>> = {
        itinerary: {
          id: 'p-itin-glacier',
          layer: 'itinerary',
          slotId: 'slot-itin',
          value: { terrain: 'glacier_crevasse', requiresCramponsIceAxe: true },
          provenance: { source: 'official' },
          confidence: 'high',
          rationale: 'Itinéraire glaciaire',
          alternatives: [],
          locked: false,
          editedByUser: false,
          impacts: [],
        },
      };

      const result = checkSafetyRedLines(brief, proposals);

      expect(result.allowed).toBe(false);
      expect(result.violations.some((v: SafetyRedLineViolation) => v.code === 'GLACIAL_ALPINISM_RESTRICTED')).toBe(true);
      const violation = result.violations.find((v: SafetyRedLineViolation) => v.code === 'GLACIAL_ALPINISM_RESTRICTED');
      expect(violation?.remedy).toContain('guide de haute montagne UIAGM');
    });

    it('TEST-REDLINE-02: Bloque immédiatement les destinations en zone rouge MEAE', () => {
      const brief = extractTripBrief('Randonnée dans le désert au Sahel frontière Mali Niger');
      const proposals: Record<string, Proposal<any>> = {};

      const result = checkSafetyRedLines(brief, proposals);

      expect(result.allowed).toBe(false);
      expect(result.violations.some((v: SafetyRedLineViolation) => v.code === 'MEAE_RED_ZONE')).toBe(true);
    });

    it('TEST-REDLINE-03: Refuse catégoriquement toute posologie médicale ou prescription', () => {
      const brief = extractTripBrief('5 jours trek');
      const proposals: Record<string, Proposal<any>> = {
        safety: {
          id: 'p-safe-med',
          layer: 'safety',
          slotId: 'slot-safe',
          value: { recommendedDrugs: ['Diamox 250mg 2x par jour'] },
          provenance: { source: 'suggested' },
          confidence: 'low',
          rationale: 'Prévention MAM',
          alternatives: [],
          locked: false,
          editedByUser: false,
          impacts: [],
        },
      };

      const result = checkSafetyRedLines(brief, proposals);

      expect(result.violations.some((v: SafetyRedLineViolation) => v.code === 'NO_MEDICAL_PRESCRIPTION')).toBe(true);
    });

    it('TEST-REDLINE-04: Applique le floutage écologique de 1,5 km sur les zones de bivouac sensibles', () => {
      const preciseLat = 45.9237;
      const preciseLon = 6.8694;

      const blurred = blurSensitiveCoordinates(preciseLat, preciseLon, 1.5);

      expect(blurred.blurred).toBe(true);
      expect(blurred.radiusKm).toBe(1.5);
      // Les coordonnées doivent être décalées mais proches
      expect(Math.abs(blurred.latitude - preciseLat)).toBeGreaterThan(0);
      expect(Math.abs(blurred.latitude - preciseLat)).toBeLessThan(0.03); // < ~3 km max
    });

    it('TEST-REDLINE-05: Déclenche une alerte vitale si distance sans point d’eau dépasse 25 km ou 1200m D+', () => {
      const brief = extractTripBrief('Traversée aride 30 km sans point de ravitaillement');
      const proposals: Record<string, Proposal<any>> = {
        food_water: {
          id: 'p-water',
          layer: 'food_water',
          slotId: 'slot-water',
          value: { maxDistanceWithoutWaterKm: 28, waterCapacityLiters: 1.5 },
          provenance: { source: 'calculated' as any },
          confidence: 'high',
          rationale: 'Étape sèche',
          alternatives: [],
          locked: false,
          editedByUser: false,
          impacts: [],
        },
      };

      const result = checkSafetyRedLines(brief, proposals);

      expect(result.violations.some((v: SafetyRedLineViolation) => v.code === 'WATER_AUTONOMY_CRITICAL')).toBe(true);
    });
  });

  describe('E.2 : Connecteurs Données Réelles (Connectors)', () => {
    it('TEST-CONNECTOR-01: Fournit la réglementation bivouac certifiée avec provenance officielle', () => {
      const ruleVanoise = lookupBivouacRegulation('FR', 'Vanoise');

      expect(ruleVanoise).toBeDefined();
      expect(ruleVanoise.allowed).toBe(true);
      expect(ruleVanoise.conditions).toContain('uniquement à proximité des refuges gardés');
      expect(ruleVanoise.provenance.source).toBe('official');
      expect(ruleVanoise.provenance.sourceRef).toContain('Parc National');

      const ruleIceland = lookupBivouacRegulation('IS');
      expect(ruleIceland.allowed).toBe(true);
      expect(ruleIceland.conditions).toContain('campings désignés dans les réserves');
    });

    it('TEST-CONNECTOR-02: Retourne des points d’eau réels avec traçabilité et licence ODbL', async () => {
      const sources = await lookupWaterSources({
        minLat: 45.8,
        maxLat: 46.0,
        minLon: 6.7,
        maxLon: 7.0,
      });

      expect(sources.length).toBeGreaterThan(0);
      const first = sources[0];
      expect(first.name).toBeDefined();
      expect(first.potable).toBeDefined();
      expect(first.provenance.source).toBe('community');
      expect(first.provenance.sourceRef).toContain('OpenStreetMap ODbL');
    });

    it('TEST-CONNECTOR-03: Retourne les refuges certifiés avec capacité et contacts officiels', async () => {
      const shelters = await lookupMountainShelters({
        minLat: 45.8,
        maxLat: 46.0,
        minLon: 6.7,
        maxLon: 7.0,
      });

      expect(shelters.length).toBeGreaterThan(0);
      const shelter = shelters[0];
      expect(shelter.name).toBeDefined();
      expect(shelter.capacity).toBeGreaterThan(0);
      expect(shelter.provenance.source).toBe('estimated');
    });
  });
});
