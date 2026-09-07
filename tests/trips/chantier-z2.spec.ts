import { describe, it, expect } from 'vitest';
import { BLUEPRINT_CATALOG } from '@/features/trips/blueprints/blueprintRegistry';
import {
  lookupBivouacRegulation,
  lookupWaterSources,
  lookupMountainShelters,
} from '@/features/trips/connectors/realDataConnectors';
import { isResolubleProvenance } from '@/features/trips/connectors/provenanceValidator';

describe('CHANTIER Z2 — MISE EN VÉRITÉ DES DONNÉES', () => {
  describe('Z-PROV — Validation des provenances (Règle Z-R1)', () => {
    it('Z-PROV.1 : Aucun blueprint ne prétend avoir une source officielle ou confidence high', () => {
      // Les 15 blueprints sont des estimations heuristiques d'experts ou de modèles
      // Ils ne doivent en aucun cas prétendre être un "LKDV-Official-Registry" officiel à haute confiance
      for (const bp of BLUEPRINT_CATALOG) {
        for (const [layerName, layerVal] of Object.entries(bp.layers)) {
          const proposals = Array.isArray(layerVal) ? layerVal : [layerVal];
          for (const p of proposals) {
            if (p && typeof p === 'object' && 'provenance' in p) {
              expect(
                p.provenance?.source,
                `Proposal ${p.id} in ${layerName} cannot have fake official source`
              ).not.toBe('official');
              expect(
                p.provenance?.sourceRef,
                `Proposal ${p.id} cannot claim fake registry LKDV-Official-Registry`
              ).not.toBe('LKDV-Official-Registry');
              expect(
                p.confidence,
                `Proposal ${p.id} cannot claim confidence 'high' without primary field measurement`
              ).toBe('low');
            }
          }
        }
      }
    });

    it('Z-PROV.2 : Le fallback de réglementation bivouac ne cite pas un faux LKDV Global GeoRegistry officiel', () => {
      const fallback = lookupBivouacRegulation('ZZ', 'Inconnu');
      expect(fallback.provenance.source).not.toBe('official');
      expect(fallback.provenance.sourceRef).not.toContain('LKDV Global GeoRegistry');
      expect(fallback.provenance.source).toBe('estimated');
    });

    it('Z-PROV.3 : La réglementation bivouac France ne cite pas le faux article R331-48 du code environnement', () => {
      const regFr = lookupBivouacRegulation('FR');
      // Le code de l'environnement R331-48 ne s'applique qu'au coeur de parc, pas au droit commun
      expect(regFr.provenance.sourceRef).not.toContain('Code de l’Environnement Art. R331-48');
      expect(regFr.provenance.sourceRef).toContain('Code de l’urbanisme');
    });

    it('Z-PROV.4 : Les refuges montagnards codés en dur ne portent pas une fausse source officielle FFCAM', async () => {
      const shelters = await lookupMountainShelters({
        minLat: 45.8,
        maxLat: 46.0,
        minLon: 6.7,
        maxLon: 6.9,
      });
      for (const s of shelters) {
        // Sans liaison directe à l'API FFCAM, ces fiches de test ne peuvent se revendiquer 'official'
        expect(s.provenance.source).toBe('estimated');
      }
    });

    it('Z-PROV.5 : isResolubleProvenance rejette toute source officielle ou communautaire sans URL ou dataset versionné', () => {
      expect(
        isResolubleProvenance({
          source: 'official',
          sourceRef: 'LKDV-Official-Registry',
        })
      ).toBe(false);

      expect(
        isResolubleProvenance({
          source: 'official',
          sourceRef: 'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000006814421',
        })
      ).toBe(true);

      expect(
        isResolubleProvenance({
          source: 'community',
          sourceRef: 'OpenStreetMap relation #62254 (ODbL)',
        })
      ).toBe(true);

      expect(
        isResolubleProvenance({
          source: 'estimated',
          sourceRef: 'Estimation modèle heuristique LKDV',
        })
      ).toBe(true);
    });
  });

  describe('Z-OVERPASS — Vrai connecteur Overpass sur zone pilote (Z2.3)', () => {
    it('Z-OVERPASS.1 : lookupWaterSources retourne des points avec ID réels et mention ODbL légale', async () => {
      // Zone Chamonix / Mont-Blanc
      const points = await lookupWaterSources({
        minLat: 45.85,
        maxLat: 45.95,
        minLon: 6.80,
        maxLon: 6.95,
      });

      expect(points.length).toBeGreaterThan(0);
      for (const p of points) {
        expect(p.provenance.source).toBe('community');
        expect(p.provenance.sourceRef).toMatch(/OpenStreetMap ODbL · node #\d+/);
        expect(p.id).toMatch(/^osm-node-\d+$/);
        expect(p.latitude).toBeGreaterThanOrEqual(45.85);
        expect(p.latitude).toBeLessThanOrEqual(45.95);
        expect(p.longitude).toBeGreaterThanOrEqual(6.80);
        expect(p.longitude).toBeLessThanOrEqual(6.95);
      }
    });

    it('Z-OVERPASS.2 : lookupWaterSources sur une boîte hors zone retourne [] sans inventer de point', async () => {
      const emptyZone = await lookupWaterSources({
        minLat: 25.0,
        maxLat: 25.1,
        minLon: 10.0,
        maxLon: 10.1,
      });
      expect(emptyZone).toEqual([]);
    });
  });
});
