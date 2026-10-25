import { describe, it, expect } from 'vitest';
import type { MapTrail } from '@/components/explorer/types';
import type { UnifiedPOI } from '@/lib/queries/pois';
import {
  mergeAndDeduplicateTrails,
  mergeAndDeduplicatePois,
  filterTrailsByViewport,
  filterPoisByViewport,
  resolveOsmErrorMessage,
  type ViewportBbox,
} from '@/features/explorer-osm/services/trailMergeService';

describe('Regression & Unification — Explorer OSM (Atlas & Legacy)', () => {
  // Coordonnées géographiques des zones de test

  const JAPAN_BBOX: ViewportBbox = {
    minLat: 33.5,
    maxLat: 34.5,
    minLng: 135.5,
    maxLng: 136.5,
  };

  const DOLOMITES_BBOX: ViewportBbox = {
    minLat: 46.4,
    maxLat: 46.7,
    minLng: 11.8,
    maxLng: 12.4,
  };

  const TOUR_DU_NORD: MapTrail = {
    id: 'local-nord-1',
    name: 'Tour du Nord',
    lat: 50.629,
    lng: 3.057,
    distance_km: 15.2,
    difficulty: 'Modérée',
  };

  const KUMANO_KODO: MapTrail = {
    id: 'osm:relation:98765',
    name: 'Kumano Kodo - Nakahechi',
    lat: 33.84,
    lng: 135.77,
    distance_km: 38.5,
    source: 'openstreetmap',
    ref: 'KK1',
  } as any as MapTrail;

  const TRE_CIME: MapTrail = {
    id: 'osm:relation:54321',
    name: 'Tre Cime di Lavaredo Loop',
    lat: 46.618,
    lng: 12.30,
    distance_km: 9.8,
    source: 'openstreetmap',
    ref: '101',
  } as any as MapTrail;

  describe('Bug #12 : Navigation Nord → Japon en mode Unified Map (Atlas)', () => {
    it('comportement AVANT correction : en unifiedMap, Tour du Nord était conservé et Kumano Kodo écrasé', () => {
      // Simulation du code buggé historique :
      // 1. if (unifiedMap && unifiedViewportData) return unifiedViewportData.trails;
      // 2. if (queriedBbox && !unifiedMap ...) filter skipped !
      const unifiedMap = true;
      const unifiedViewportData = { trails: [TOUR_DU_NORD], pois: [] };
      const osmTrails = [KUMANO_KODO];

      // Code buggé :
      const buggyTrails = unifiedMap && unifiedViewportData ? unifiedViewportData.trails : [...unifiedViewportData.trails, ...osmTrails];
      const buggyFiltered = buggyTrails.filter((t) => {
        // En mode unifiedMap historique, le filtre spatial était contourné par `!unifiedMap` !
        if (JAPAN_BBOX && !unifiedMap) {
          if (t.lat! < JAPAN_BBOX.minLat || t.lat! > JAPAN_BBOX.maxLat) return false;
        }
        return true;
      });

      // Le comportement buggé produisait Tour du Nord et oubliait Kumano Kodo !
      expect(buggyFiltered).toHaveLength(1);
      expect(buggyFiltered[0].name).toBe('Tour du Nord');
      expect(buggyFiltered.find((t) => t.name.includes('Kumano Kodo'))).toBeUndefined();
    });

    it('comportement APRÈS correction : Kumano Kodo est affiché et Tour du Nord est exclu du viewport Japon', () => {
      const baseTrails = [TOUR_DU_NORD];
      const osmTrails = [KUMANO_KODO];

      // 1. Fusion propre
      const merged = mergeAndDeduplicateTrails(baseTrails, osmTrails);
      expect(merged).toHaveLength(2);

      // 2. Filtrage spatial sur le viewport actif (Japon)
      const visibleInJapan = filterTrailsByViewport(merged, JAPAN_BBOX);

      // Le résultat DOIT contenir Kumano Kodo
      expect(visibleInJapan.some((t) => t.id === 'osm:relation:98765')).toBe(true);
      expect(visibleInJapan.some((t) => t.name === 'Kumano Kodo - Nakahechi')).toBe(true);

      // Tour du Nord DOIT être absent car il est en France (50.6°N vs 33.8°N)
      expect(visibleInJapan.some((t) => t.id === 'local-nord-1')).toBe(false);
      expect(visibleInJapan.some((t) => t.name === 'Tour du Nord')).toBe(false);
      expect(visibleInJapan).toHaveLength(1);
    });

    it('transition Japon → Dolomites : aucune randonnée japonaise persistante sur la carte italienne', () => {
      const trailsFromPreviousSearch = [KUMANO_KODO];
      const newlyDiscoveredOsm = [TRE_CIME];

      const merged = mergeAndDeduplicateTrails(trailsFromPreviousSearch, newlyDiscoveredOsm);
      const visibleInDolomites = filterTrailsByViewport(merged, DOLOMITES_BBOX);

      expect(visibleInDolomites.some((t) => t.name.includes('Tre Cime'))).toBe(true);
      expect(visibleInDolomites.some((t) => t.name.includes('Kumano'))).toBe(false);
      expect(visibleInDolomites).toHaveLength(1);
    });
  });

  describe('Déduplication intelligente — Règle #3', () => {
    it('déduplique une route locale déjà matérialisée avec son équivalent OSM par osm_relation_id', () => {
      const localMaterialized: MapTrail = {
        id: 'supabase-route-uuid-123',
        name: 'Tour du Mont Blanc (LKDV enrichi)',
        lat: 45.83,
        lng: 6.86,
        distance_km: 170,
        osm_relation_id: 123456, // ID OSM conservé en BDD Supabase
      } as any;

      const discoveredOsm: MapTrail = {
        id: 'osm:relation:123456',
        name: 'Tour du Mont-Blanc',
        lat: 45.83,
        lng: 6.86,
        distance_km: 170,
        source: 'openstreetmap',
      } as any as MapTrail;

      const result = mergeAndDeduplicateTrails([localMaterialized], [discoveredOsm]);
      // Le doublon est détecté via osm_relation_id, la version locale est conservée
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('supabase-route-uuid-123');
    });

    it('NE supprime JAMAIS deux randonnées distinctes simplement parce qu’elles portent le même nom', () => {
      const sentierCretesVosges: MapTrail = {
        id: 'route-vosges-1',
        name: 'Sentier des Crêtes',
        lat: 48.05,
        lng: 7.02,
        distance_km: 12.0,
      };

      const sentierCretesCassis: MapTrail = {
        id: 'osm:relation:777777',
        name: 'Sentier des Crêtes',
        lat: 43.21,
        lng: 5.54,
        distance_km: 14.5,
        source: 'openstreetmap',
      } as any as MapTrail;

      const result = mergeAndDeduplicateTrails([sentierCretesVosges], [sentierCretesCassis]);
      // Les deux existent en France à des endroits différents : AUCUNE suppression injustifiée !
      expect(result).toHaveLength(2);
      expect(result.map((t) => t.id)).toEqual(['route-vosges-1', 'osm:relation:777777']);
    });

    it('déduplique deux randonnées au même nom si leurs coordonnées sont coïncidentes (< 200m)', () => {
      const hikeA: MapTrail = {
        id: 'hike-a',
        name: 'Boucle du Belvédère',
        lat: 45.9230,
        lng: 6.8690,
        distance_km: 5.0,
      };

      const hikeB: MapTrail = {
        id: 'hike-b',
        name: 'Boucle du Belvédère',
        lat: 45.9235, // ~50m d'écart
        lng: 6.8692,
        distance_km: 5.1,
      };

      const result = mergeAndDeduplicateTrails([hikeA], [hikeB]);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('hike-a');
    });
  });

  describe('Déduplication des POIs — Règle #8', () => {
    it('fusionne et déduplique les POIs par ID strict et par proximité géographique', () => {
      const basePois: UnifiedPOI[] = [
        {
          id: 'poi-local-1',
          name: 'Refuge du Goûter',
          category: 'refuge',
          lat: 45.851,
          lng: 6.830,
          source: 'map_refuges',
        },
      ];

      const osmPois: UnifiedPOI[] = [
        // Doublon spatial (< 50m et même catégorie)
        {
          id: 'osm:node:111111',
          name: 'Refuge du Goûter',
          category: 'refuge',
          lat: 45.8511,
          lng: 6.8301,
          source: 'trail_pois',
        },
        // Nouveau POI distinct
        {
          id: 'osm:node:222222',
          name: 'Source des Rognes',
          category: 'water',
          lat: 45.860,
          lng: 6.820,
          source: 'trail_pois',
        },
      ];

      const merged = mergeAndDeduplicatePois(basePois, osmPois);
      expect(merged).toHaveLength(2);
      expect(merged[0].id).toBe('poi-local-1');
      expect(merged[1].id).toBe('osm:node:222222');
    });

    it('filtre les POIs hors du viewport lors d’un changement de zone (Nord → Japon)', () => {
      const pois: UnifiedPOI[] = [
        {
          id: 'poi-lille-1',
          name: 'Fontaine de Lille',
          category: 'water',
          lat: 50.63,
          lng: 3.06,
          source: 'trail_pois',
        },
        {
          id: 'osm:node:japan-poi-1',
          name: 'Kumano Shrine Fountain',
          category: 'water',
          lat: 33.84,
          lng: 135.77,
          source: 'trail_pois',
        },
      ];

      const inJapan = filterPoisByViewport(pois, JAPAN_BBOX);
      expect(inJapan).toHaveLength(1);
      expect(inJapan[0].id).toBe('osm:node:japan-poi-1');
      expect(inJapan.some((p) => p.name.includes('Lille'))).toBe(false);
    });
  });

  describe('Robustesse du filtrage spatial — Sentiers sans coordonnées ou avec geojson', () => {
    it('exclut rigoureusement un sentier dont lat et lng sont null / indéterminés', () => {
      const trailWithoutCoords: MapTrail = {
        id: 'corrupt-trail-1',
        name: 'Sentier Fantôme sans Coordonnées',
        lat: null,
        lng: null,
      };

      const filtered = filterTrailsByViewport([trailWithoutCoords], JAPAN_BBOX);
      expect(filtered).toHaveLength(0);
    });

    it('résout la position depuis t.geojson si lat/lng direct est null', () => {
      const trailWithGeojsonOnly: MapTrail = {
        id: 'osm:relation:geom-only',
        name: 'Sentier du Soleil Levant',
        lat: null,
        lng: null,
        geojson: {
          type: 'LineString',
          coordinates: [
            [135.75, 33.82],
            [135.78, 33.85],
          ],
        },
      };

      const inJapan = filterTrailsByViewport([trailWithGeojsonOnly], JAPAN_BBOX);
      expect(inJapan).toHaveLength(1);
      expect(inJapan[0].name).toBe('Sentier du Soleil Levant');

      const inDolomites = filterTrailsByViewport([trailWithGeojsonOnly], DOLOMITES_BBOX);
      expect(inDolomites).toHaveLength(0);
    });

    it('supporte camelCase osmRelationId et externalId pour la déduplication', () => {
      const localCamel: MapTrail = {
        id: 'camel-trail-1',
        name: 'Sentier CamelCase',
        lat: 45.8,
        lng: 6.8,
        osmRelationId: 998877,
      } as any;

      const discovered: MapTrail = {
        id: 'osm:relation:998877',
        name: 'Sentier CamelCase OSM',
        lat: 45.8,
        lng: 6.8,
        source: 'openstreetmap',
      } as any;

      const merged = mergeAndDeduplicateTrails([localCamel], [discovered]);
      expect(merged).toHaveLength(1);
      expect(merged[0].id).toBe('camel-trail-1');
    });
  });

  describe('Messages d’erreur explicites — Règle #10', () => {
    it('traduit VIEWPORT_TOO_LARGE en message clair demandant de zoomer', () => {
      const msg = resolveOsmErrorMessage({ code: 'VIEWPORT_TOO_LARGE' });
      expect(msg).toBe('Zoome davantage pour rechercher les randonnées de cette zone.');
    });

    it('traduit 429 et RATE_LIMITED en message de limitation temporaire', () => {
      const msg1 = resolveOsmErrorMessage({ status: 429 });
      const msg2 = resolveOsmErrorMessage({ code: 'RATE_LIMITED' });
      const msg3 = resolveOsmErrorMessage({ code: 'UPSTREAM_RATE_LIMITED' });
      expect(msg1).toBe('Recherche temporairement limitée. Réessaie dans quelques secondes.');
      expect(msg2).toBe('Recherche temporairement limitée. Réessaie dans quelques secondes.');
      expect(msg3).toBe('Recherche temporairement limitée. Réessaie dans quelques secondes.');
    });

    it('traduit 503 et SERVICE_UNAVAILABLE en message de service indisponible', () => {
      const msg1 = resolveOsmErrorMessage({ status: 503 });
      const msg2 = resolveOsmErrorMessage({ code: 'SERVICE_UNAVAILABLE' });
      expect(msg1).toBe('Les randonnées en ligne sont temporairement indisponibles.');
      expect(msg2).toBe('Les randonnées en ligne sont temporairement indisponibles.');
    });

    it('ne renvoie rien si aucune erreur n’est survenue', () => {
      expect(resolveOsmErrorMessage(null)).toBeNull();
      expect(resolveOsmErrorMessage(undefined)).toBeNull();
    });
  });
});
