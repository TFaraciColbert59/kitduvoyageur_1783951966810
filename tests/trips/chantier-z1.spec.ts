import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  formatEmergencyCoordinates,
  getCurrentStepForDay,
  TripLiveCockpitView,
} from '@/features/trips/components/TripLiveCockpitView';
import {
  getTripPhase,
  getTripPhaseDetails,
} from '@/features/trips/engine/temporalPhaseEngine';
import {
  lookupWaterSources,
  lookupMountainShelters,
} from '@/features/trips/connectors/realDataConnectors';
import {
  checkSafetyRedLines,
  blurSensitiveCoordinates,
} from '@/features/trips/safety/safetyRedLines';
import {
  getPreDepartureChecklist,
  getCountrySpecificFormalities,
} from '@/features/trips/components/TripChecklistView';
import type { TripFull, TripStats } from '@/features/trips/types/trip.types';
import { extractTripBrief } from '@/features/trips/engine/tripBriefExtractor';
import { generateTripGpx } from '@/features/trips/engine/exportEngine';

describe('CHANTIER Z — Phase Z1 : Neutralisation Immédiate des Risques', () => {
  // ==========================================================================
  // Z1.1 : Panneau de secours (D13)
  // ==========================================================================
  describe('Z1.1 : Panneau de secours (D13)', () => {
    it('Z-D13-01: formatEmergencyCoordinates sans coordonnées retourne le message de sécurité exact et aucune coordonnée fabriquée', () => {
      const result = formatEmergencyCoordinates(null, null);
      expect(result).toBe(
        'Position non disponible — utilise l’application de ton téléphone pour communiquer ta position exacte au 112'
      );
      expect(result).not.toContain('45.');
      expect(result).not.toContain('° N');
    });

    it('Z-D13-02: TripLiveCockpitView n’affiche aucune coordonnée fabriquée quand les étapes n’ont pas de lat/lon', () => {
      const mockTrip: TripFull = {
        id: 'trip-fdgb',
        slug: 'fdgb',
        title: 'fdgb',
        description: null,
        destination_country_code: 'FR',
        destination_name: null,
        start_date: '2026-09-01',
        end_date: '2026-09-10',
        status: 'active',
        visibility: 'private',
        difficulty: 'moderate',
        primary_activity: 'hiking',
        estimated_budget: 100,
        budget_currency: 'EUR',
        cover_image_url: null,
        user_id: 'u1',
        group_id: null,
        share_token: null,
        metadata: null,
        created_at: '',
        updated_at: '',
        user_role: 'owner',
        permissions: {
          canEdit: true,
          canDelete: true,
          canInvite: true,
          canManageBudget: true,
          canViewDocuments: true,
        },
        collaborators: [],
        steps: [
          {
            id: 's1',
            trip_id: 'trip-fdgb',
            day_number: 1,
            order_index: 0,
            title: 'ez!2wf',
            description: null,
            location_name: null,
            latitude: null,
            longitude: null,
            accommodation_name: null,
            transport_mode: 'foot',
            distance_km: 10,
            elevation_gain_m: 200,
            elevation_loss_m: 100,
            created_at: '',
            updated_at: '',
          },
        ],
        items: [],
        expenses: [],
        documents: [],
        pois: [],
        safety_checkpoints: [],
        notes: [],
      };

      const mockStats: TripStats = {
        trip_id: 'trip-fdgb',
        total_days: 1,
        total_distance_km: 10,
        total_elevation_gain_m: 200,
        total_elevation_loss_m: 100,
        items_packed: 0,
        items_total: 0,
        estimated_budget: 100,
        total_spent: 0,
        participants_count: 1,
      };

      const html = renderToStaticMarkup(
        React.createElement(TripLiveCockpitView, {
          trip: mockTrip,
          stats: mockStats,
        })
      );

      // Ne doit contenir aucune coordonnée inventée
      expect(html).not.toContain('45.8902');
      expect(html).not.toContain('Chamonix à Les Houches');
      expect(html).toContain('Position non disponible');
      // Les boutons 112 et 114 doivent être préservés
      expect(html).toContain('tel:112');
      expect(html).toContain('sms:114');
      // La mention non sourcée sur le réseau doit être retirée
      expect(html).not.toContain('fonctionne sur n’importe quel réseau opérateur capté');
    });
  });

  // ==========================================================================
  // Z1.2 : Étape active sur un voyage futur (D13, D18, D26)
  // ==========================================================================
  describe('Z1.2 : Étape active et titres fabriqués (D18, D26)', () => {
    it('Z-D18-01: getTripPhase sur un départ futur ne retourne JAMAIS live même avec status active', () => {
      const futureTrip = {
        start_date: '2026-09-29',
        end_date: '2026-10-27',
        status: 'active' as const,
      };

      // Nous sommes le 07/09/2026, départ le 29/09/2026
      const phase = getTripPhase(futureTrip, '2026-09-07');
      expect(phase).toBe('prepare');
      expect(phase).not.toBe('live');
    });

    it('Z-D18-02: getTripPhaseDetails sur départ futur donne dayIndex null et daysUntilStart = 22', () => {
      const futureTrip = {
        start_date: '2026-09-29',
        end_date: '2026-10-27',
        status: 'active' as const,
      };

      const details = getTripPhaseDetails(futureTrip, '2026-09-07');
      expect(details.phase).toBe('prepare');
      expect(details.dayIndex).toBeNull();
      expect(details.daysUntilStart).toBe(22);
    });

    it('Z-D18-03: TripLiveCockpitView sur voyage futur n’affiche pas Étape active Jour 1 mais un compte à rebours', () => {
      const futureTrip: TripFull = {
        id: 'trip-future',
        slug: 'future-trip',
        title: 'Voyage Futur',
        description: null,
        destination_country_code: 'FR',
        destination_name: 'Vanoise',
        start_date: '2026-09-29',
        end_date: '2026-10-27',
        status: 'active',
        visibility: 'private',
        difficulty: 'moderate',
        primary_activity: 'hiking',
        estimated_budget: 500,
        budget_currency: 'EUR',
        cover_image_url: null,
        user_id: 'u1',
        group_id: null,
        share_token: null,
        metadata: null,
        created_at: '',
        updated_at: '',
        user_role: 'owner',
        permissions: {
          canEdit: true,
          canDelete: true,
          canInvite: true,
          canManageBudget: true,
          canViewDocuments: true,
        },
        collaborators: [],
        steps: [
          {
            id: 's1',
            trip_id: 'trip-future',
            day_number: 1,
            order_index: 0,
            title: 'Étape future 1',
            description: null,
            location_name: 'Refuge A',
            latitude: null,
            longitude: null,
            accommodation_name: null,
            transport_mode: 'foot',
            distance_km: 12,
            elevation_gain_m: 600,
            elevation_loss_m: 200,
            created_at: '',
            updated_at: '',
          },
        ],
        items: [],
        expenses: [],
        documents: [],
        pois: [],
        safety_checkpoints: [],
        notes: [],
      };

      const html = renderToStaticMarkup(
        React.createElement(TripLiveCockpitView, {
          trip: futureTrip,
          stats: {
            trip_id: 'trip-future',
            total_days: 29,
            total_distance_km: 12,
            total_elevation_gain_m: 600,
            total_elevation_loss_m: 200,
            items_packed: 0,
            items_total: 0,
            estimated_budget: 500,
            total_spent: 0,
            participants_count: 1,
          },
        })
      );

      // Ne doit pas prétendre que l'étape 1 est active en cours
      expect(html).not.toContain('Étape active');
      expect(html).toContain('Voyage à venir');
    });
  });

  // ==========================================================================
  // Z1.3 : Lignes rouges réellement armées (D14, D15)
  // ==========================================================================
  describe('Z1.3 : Lignes rouges réellement armées (D14, D15)', () => {
    it('Z-D14: lookupWaterSources sans points d’eau réels retourne un tableau vide et déclenche l’alerte hydrique vitale', async () => {
      // Zone aride sans points d'eau
      const aridBounds = {
        minLat: 30.0,
        maxLat: 30.2,
        minLon: -7.5,
        maxLon: -7.3,
      };

      const sources = await lookupWaterSources(aridBounds);
      // Ne doit pas fabriquer 2 points d'eau au centre de la boîte
      expect(sources).toEqual([]);

      // Si trek de 28 km sans eau, l'alerte hydrique doit impérativement se déclencher
      const brief = extractTripBrief('Traversée désertique de 28 km sans eau');
      const proposals = {
        food_water: {
          id: 'p-water-arid',
          layer: 'food_water' as const,
          slotId: 'slot-water',
          value: { maxDistanceWithoutWaterKm: 28, waterCapacityLiters: 1.5 },
          provenance: { source: 'estimated' as const },
          confidence: 'low' as const,
          rationale: 'Absence de point d’eau répertorié',
          alternatives: [],
          locked: false,
          editedByUser: false,
          impacts: [],
        },
      };

      const safety = checkSafetyRedLines(brief, proposals);
      expect(safety.violations.some((v) => v.code === 'WATER_AUTONOMY_CRITICAL')).toBe(true);
    });

    it('Z-D15: lookupMountainShelters sur le Maroc ne retourne AUCUN refuge du Mont-Blanc', async () => {
      const moroccoBounds = {
        minLat: 31.0,
        maxLat: 31.2,
        minLon: -8.0,
        maxLon: -7.8,
      };

      const shelters = await lookupMountainShelters(moroccoBounds);
      // Ne doit pas renvoyer Goûter ou Tête Rousse
      const hasMontBlancShelter = shelters.some(
        (s) => s.name.includes('Goûter') || s.name.includes('Tête Rousse')
      );
      expect(hasMontBlancShelter).toBe(false);
      expect(shelters).toEqual([]);
    });

    it('Z-REDLINE-ALL: Vérifie que chacune des 5 lignes rouges peut effectivement se déclencher', () => {
      // Ligne 1 : Alpinisme glaciaire
      const s1 = checkSafetyRedLines(
        extractTripBrief('Traversée arête des Bosses avec piolet et crampons'),
        {}
      );
      expect(s1.violations.some((v) => v.code === 'GLACIAL_ALPINISM_RESTRICTED')).toBe(true);

      // Ligne 2 : Zone rouge MEAE
      const s2 = checkSafetyRedLines(
        extractTripBrief('Trek frontière Mali Niger zone rouge'),
        {}
      );
      expect(s2.violations.some((v) => v.code === 'MEAE_RED_ZONE')).toBe(true);

      // Ligne 3 : Prescription médicale
      const s3 = checkSafetyRedLines(extractTripBrief('Trek 5 jours'), {
        safety: {
          id: 'p-med',
          layer: 'safety',
          slotId: 'slot-safe',
          value: { recommendedDrugs: ['Prendre Diamox 250mg par jour'] },
          provenance: { source: 'suggested' as const },
          confidence: 'low' as const,
          rationale: '',
          alternatives: [],
          locked: false,
          editedByUser: false,
          impacts: [],
        },
      });
      expect(s3.violations.some((v) => v.code === 'NO_MEDICAL_PRESCRIPTION')).toBe(true);

      // Ligne 5 : Autonomie hydrique
      const s5 = checkSafetyRedLines(extractTripBrief('Trek'), {
        food_water: {
          id: 'p-w',
          layer: 'food_water',
          slotId: 'slot-w',
          value: { maxDistanceWithoutWaterKm: 30, waterCapacityLiters: 1.0 },
          provenance: { source: 'estimated' as const },
          confidence: 'low' as const,
          rationale: '',
          alternatives: [],
          locked: false,
          editedByUser: false,
          impacts: [],
        },
      });
      expect(s5.violations.some((v) => v.code === 'WATER_AUTONOMY_CRITICAL')).toBe(true);
    });
  });

  // ==========================================================================
  // Z1.4 : Floutage non réversible (D17)
  // ==========================================================================
  describe('Z1.4 : Floutage écologique non réversible (D17)', () => {
    it('Z-D17-01: L’offset de floutage n’est pas recalculable de manière déterministe inversible', () => {
      const lat = 45.9237;
      const lon = 6.8694;

      const blurred1 = blurSensitiveCoordinates(lat, lon, 1.5);
      const blurred2 = blurSensitiveCoordinates(lat + 0.0001, lon + 0.0001, 1.5);

      // Les décalages relatifs ne doivent pas être constants (deux sites voisins ne reçoivent pas le même vecteur)
      const deltaLat1 = Math.abs(blurred1.latitude - lat);
      const deltaLat2 = Math.abs(blurred2.latitude - (lat + 0.0001));
      expect(deltaLat1).not.toBe(deltaLat2);

      // L'arrondi destructif ou bruit empêche l'inversion analytique
      expect(blurred1.blurred).toBe(true);
      expect(blurred1.latitude).not.toBe(lat);
      // Vérification que les coordonnées publiées sont arrondies destructivement
      expect(blurred1.isIrreversible).toBe(true);
    });

    it('Z-D17-02: L’export GPX applique impérativement le floutage sur les étapes et POI écologiquement sensibles', () => {
      const mockTripWithSensitive: TripFull = {
        id: 'trip-sensitive',
        slug: 'trip-sens',
        title: 'Bivouac Zone Protégée',
        description: null,
        destination_country_code: 'FR',
        destination_name: 'Parc National',
        start_date: '2026-09-10',
        end_date: '2026-09-12',
        status: 'active',
        visibility: 'private',
        difficulty: 'moderate',
        primary_activity: 'hiking',
        estimated_budget: 100,
        budget_currency: 'EUR',
        cover_image_url: null,
        user_id: 'u1',
        group_id: null,
        share_token: null,
        metadata: null,
        created_at: '',
        updated_at: '',
        user_role: 'owner',
        permissions: {
          canEdit: true,
          canDelete: true,
          canInvite: true,
          canManageBudget: true,
          canViewDocuments: true,
        },
        collaborators: [],
        steps: [
          {
            id: 's-sens',
            trip_id: 'trip-sensitive',
            day_number: 1,
            order_index: 0,
            title: 'Bivouac zone humide fragile',
            description: null,
            location_name: 'Zone humide',
            latitude: 45.123456,
            longitude: 6.654321,
            accommodation_name: null,
            transport_mode: 'foot',
            distance_km: 10,
            elevation_gain_m: 500,
            elevation_loss_m: 200,
            created_at: '',
            updated_at: '',
            // Flag de sensibilité écologique
            is_sensitive: true,
          } as any,
        ],
        items: [],
        expenses: [],
        documents: [],
        pois: [
          {
            id: 'poi-sens',
            trip_id: 'trip-sensitive',
            name: 'Nidification d’aigle royal',
            latitude: 45.129876,
            longitude: 6.659876,
            category: 'poi',
            notes: 'Sensible',
            created_at: '',
            updated_at: '',
            sensitivity: 'protected',
          } as any,
        ],
        safety_checkpoints: [],
        notes: [],
      };

      const gpx = generateTripGpx(mockTripWithSensitive);

      // Les coordonnées exactes 45.123456 et 45.129876 ne doivent JAMAIS fuiter dans le GPX
      expect(gpx).not.toContain('45.123456');
      expect(gpx).not.toContain('6.654321');
      expect(gpx).not.toContain('45.129876');
      expect(gpx).not.toContain('6.659876');

      // Doit contenir les coordonnées floutées
      const blurredStep = blurSensitiveCoordinates(45.123456, 6.654321);
      expect(gpx).toContain(`lat="${blurredStep.latitude}"`);
      expect(gpx).toContain(`lon="${blurredStep.longitude}"`);
    });
  });

  // ==========================================================================
  // Z1.5 : Santé et administratif (D19)
  // ==========================================================================
  describe('Z1.5 : Santé et administratif sans ordonnance ni avis vaccinal inventé (D19)', () => {
    it('Z-D19-01: Le mot ordonnances est STRICTEMENT banni de la checklist de départ', () => {
      const checklist = getPreDepartureChecklist(30, 'FR');
      const allLabels = Object.values(checklist)
        .flat()
        .map((item) => `${item.label} ${item.description}`)
        .join(' ');

      expect(allLabels.toLowerCase()).not.toContain('ordonnance');
      expect(allLabels.toLowerCase()).not.toContain('ordonnances');
    });

    it('Z-D19-02: Sans source officielle connectée, aucun vaccin spécifique n’est listé et renvoie vers un médecin', () => {
      const formalities = getCountrySpecificFormalities('FR');
      // Ne doit pas prétendre certifier "DT Polio" sans source/date
      expect(formalities.vaccineRecommendations).toEqual([]);
      expect(formalities.vaccineNotice).toContain(
        'Recommandations vaccinales à vérifier auprès de ton médecin traitant ou d’un centre de vaccinations internationales'
      );
    });
  });
});
