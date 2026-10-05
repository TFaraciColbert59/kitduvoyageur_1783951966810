import { describe, it, expect } from 'vitest';
import {
  classifyPoiCategory,
  normalizeOsmPoi,
  normalizeOsmRelationDetail,
  normalizeOsmRelationSummary,
  parseDeclaredDistance,
  parseOsmDuration,
  resolveOsmImage,
  calculateExperienceScores,
} from '@/features/explorer-osm/services/normalizationService';
import { estimateHikingDurationHours, getTrailImage } from '@/components/explorer/types';

describe('Normalization Service — Données OSM et POIs', () => {
  describe('parseDeclaredDistance', () => {
    it('parse correctement différentes unités et formats', () => {
      expect(parseDeclaredDistance('14 km')).toBe(14);
      expect(parseDeclaredDistance('14.2 km')).toBe(14.2);
      expect(parseDeclaredDistance('14,5 km')).toBe(14.5);
      expect(parseDeclaredDistance('15000 m')).toBe(15);
      expect(parseDeclaredDistance('2500m')).toBe(2.5);
      expect(parseDeclaredDistance('12km')).toBe(12);
    });

    it('retourne null pour les valeurs invalides ou absentes', () => {
      expect(parseDeclaredDistance(undefined)).toBeNull();
      expect(parseDeclaredDistance('')).toBeNull();
      expect(parseDeclaredDistance('unknown')).toBeNull();
      expect(parseDeclaredDistance('-5 km')).toBeNull();
    });
  });

  describe('normalizeOsmRelationSummary', () => {
    it('normalise les propriétés et la provenance ODbL', () => {
      const element = {
        type: 'relation',
        id: 12345,
        timestamp: '2026-06-15T10:00:00Z',
        version: 4,
        tags: {
          name: 'Tour du Mont Blanc',
          ref: 'TMB',
          network: 'iwn',
          distance: '170 km',
        },
        center: { lat: 45.9237, lon: 6.8694 },
      };

      const summary = normalizeOsmRelationSummary(element);
      expect(summary).not.toBeNull();
      expect(summary?.id).toBe('osm:relation:12345');
      expect(summary?.osmRelationId).toBe(12345);
      expect(summary?.name).toBe('Tour du Mont Blanc');
      expect(summary?.ref).toBe('TMB');
      expect(summary?.network).toBe('iwn');
      expect(summary?.declaredDistanceKm).toBe(170);
      expect(summary?.representativePoint).toEqual([6.8694, 45.9237]);
      expect(summary?.representativePointKind).toBe('bbox-center');
      expect(summary?.source.provider).toBe('openstreetmap');
      expect(summary?.source.license).toBe('ODbL-1.0');
      expect(summary?.source.sourceVersion).toBe(4);
    });

    it('gère l’absence de nom en utilisant ref ou un fallback', () => {
      const element = {
        type: 'relation',
        id: 67890,
        tags: { ref: 'GR 20' },
      };
      const summary = normalizeOsmRelationSummary(element);
      expect(summary?.name).toBe('Itinéraire GR 20');
      expect(summary?.ref).toBe('GR 20');
    });
  });

  describe('normalizeOsmRelationDetail', () => {
    it('normalise la relation détaillée avec dénivelé, difficulté et hiérarchie', () => {
      const element = {
        type: 'relation',
        id: 1111,
        tags: {
          name: 'Sentier des Crêtes',
          'ele:gain': '650',
          'ele:loss': '640',
          sac_scale: 'mountain_hiking',
          roundtrip: 'yes',
        },
        members: [
          {
            type: 'way',
            ref: 10,
            role: 'main',
            geometry: [
              { lat: 45.1, lon: 6.1 },
              { lat: 45.11, lon: 6.11 },
            ],
          },
        ],
      };

      const detail = normalizeOsmRelationDetail(element);
      expect(detail).not.toBeNull();
      expect(detail?.elevationGainM).toBe(650);
      expect(detail?.elevationLossM).toBe(640);
      expect(detail?.difficulty).toBe('mountain_hiking');
      expect(detail?.roundtrip).toBe(true);
      expect(detail?.geometryHierarchy.status).toBe('complete');
      expect(detail?.geojson).not.toBeNull();
    });
  });

  describe('POI Classification & Normalization', () => {
    it('classifie correctement les différents types de POI outdoor', () => {
      expect(classifyPoiCategory({ tourism: 'alpine_hut' })).toBe('refuge');
      expect(classifyPoiCategory({ tourism: 'wilderness_hut' })).toBe('refuge');
      expect(classifyPoiCategory({ amenity: 'shelter' })).toBe('shelter');
      expect(classifyPoiCategory({ amenity: 'drinking_water' })).toBe('water');
      expect(classifyPoiCategory({ natural: 'peak' })).toBe('summit');
      expect(classifyPoiCategory({ mountain_pass: 'yes' })).toBe('summit');
      expect(classifyPoiCategory({ tourism: 'camp_site' })).toBe('camp');
      expect(classifyPoiCategory({ camp_site: 'bivouac' })).toBe('camp');
      expect(classifyPoiCategory({ tourism: 'viewpoint' })).toBe('viewpoint');
      expect(classifyPoiCategory({ amenity: 'parking' })).toBe('parking');
      expect(classifyPoiCategory({ highway: 'bus_stop' })).toBe('transit');
      expect(classifyPoiCategory({ shop: 'bakery' })).toBeNull();
    });

    it('normalise un node POI complet avec altitude et attribution ODbL', () => {
      const node = {
        id: 998877,
        lat: 45.85,
        lon: 6.82,
        timestamp: '2026-05-10T12:00:00Z',
        tags: {
          tourism: 'alpine_hut',
          name: 'Refuge du Goûter',
          ele: '3835',
        },
      };

      const poi = normalizeOsmPoi(node);
      expect(poi).not.toBeNull();
      expect(poi?.id).toBe('osm:node:998877');
      expect(poi?.category).toBe('refuge');
      expect(poi?.name).toBe('Refuge du Goûter');
      expect(poi?.elevationM).toBe(3835);
      expect(poi?.coordinates).toEqual([6.82, 45.85]);
      expect(poi?.source.license).toBe('ODbL-1.0');
    });
  });

  describe('parseOsmDuration & estimateHikingDurationHours', () => {
    it('parse correctement divers formats de durée OSM', () => {
      expect(parseOsmDuration('02:30')).toBe(2.5);
      expect(parseOsmDuration('2h30')).toBe(2.5);
      expect(parseOsmDuration('3h')).toBe(3);
      expect(parseOsmDuration('45 min')).toBe(0.75);
      expect(parseOsmDuration('45m')).toBe(0.75);
      expect(parseOsmDuration('1.5')).toBe(1.5);
      expect(parseOsmDuration(undefined)).toBeNull();
      expect(parseOsmDuration('invalide')).toBeNull();
    });

    it('estime la durée de randonnée via la formule Tobler/Naismith', () => {
      // 10 km plat = 10 / 4 = 2.5h
      expect(estimateHikingDurationHours(10)).toBe(2.5);
      // 10 km avec 600m D+ = 2.5 + (600/300) = 4.5h
      expect(estimateHikingDurationHours(10, 600)).toBe(4.5);
      // retourne null si distance nulle ou négative
      expect(estimateHikingDurationHours(0)).toBeNull();
      expect(estimateHikingDurationHours(-5)).toBeNull();
    });
  });

  describe('resolveOsmImage & getTrailImage', () => {
    it('résout les tags d’image OSM ou wikimedia', () => {
      expect(resolveOsmImage({ image_url: 'https://example.com/photo.jpg' })).toBe('https://example.com/photo.jpg');
      expect(resolveOsmImage({ image: 'https://example.com/view.png' })).toBe('https://example.com/view.png');
      expect(resolveOsmImage({ wikimedia_commons: 'File:Mont_Blanc_vue.jpg' })).toContain('commons.wikimedia.org');
      expect(resolveOsmImage({})).toBeNull();
    });

    it('fournit une image thématique contextuelle via getTrailImage', () => {
      const mountainImg = getTrailImage('1', 'Sentier du Pic des Aiguilles');
      expect(mountainImg).toContain('unsplash.com');

      const lakeImg = getTrailImage('2', 'Boucle du Lac Bleu et Cascade');
      expect(lakeImg).toContain('unsplash.com');

      const forestImg = getTrailImage('3', 'Forêt de Fontainebleau');
      expect(forestImg).toContain('unsplash.com');
    });
  });

  describe('calculateExperienceScores', () => {
    it('calcule des scores dynamiques d’expérience selon la difficulté et le dénivelé', () => {
      const easyScores = calculateExperienceScores({
        sac_scale: 'hiking',
        name: 'Sentier du Bois des Écureuils',
      }, 4, 50, 'lwn');

      expect(easyScores.adventure).toBeGreaterThanOrEqual(15);
      expect(easyScores.adventure).toBeLessThan(70);
      expect(easyScores.nature).toBeGreaterThan(60);

      const alpineScores = calculateExperienceScores({
        sac_scale: 'alpine_hiking',
        name: 'Arête du Pic Sommet',
      }, 18, 1200, 'iwn');

      expect(alpineScores.adventure).toBeGreaterThan(80);
      expect(alpineScores.panorama).toBeGreaterThan(85);
    });
  });
});
