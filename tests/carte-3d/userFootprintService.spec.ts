import { describe, it, expect, beforeEach } from 'vitest';
import {
  userFootprintService,
  resolveActiveUserId,
} from '@/features/carte-3d/services/userFootprintService';

describe('Carte 3D — Scalable User Footprint Service (Millions d Utilisateurs)', () => {
  beforeEach(() => {
    userFootprintService.clearCache();
  });

  it('resolveActiveUserId : résout l utilisateur explicit ou replie sur @tony_frc', () => {
    expect(resolveActiveUserId('user_alpinist_42')).toBe('user_alpinist_42');
    expect(resolveActiveUserId()).toBe('tony_frc');
    expect(resolveActiveUserId('')).toBe('tony_frc');
  });

  it('fetchUserFootprintSummary : retourne un payload pyramidal ultra-léger (< 5 Ko) à l échelle globe', async () => {
    const summary = await userFootprintService.fetchUserFootprintSummary('tony_frc');

    expect(summary).toBeDefined();
    expect(summary.userId).toBe('tony_frc');
    expect(summary.handle).toBe('@tony_frc');

    // Vérification de la contrainte stricte de taille de payload (< 5 Ko pour millions d'utilisateurs)
    const jsonBytes = new TextEncoder().encode(JSON.stringify(summary)).length;
    expect(jsonBytes).toBeLessThan(5120);

    // Statistiques de vie de l'utilisateur
    expect(summary.lifetimeStats.totalDistanceKm).toBeGreaterThan(100);
    expect(summary.lifetimeStats.totalDPlusM).toBeGreaterThan(1000);
    expect(summary.lifetimeStats.totalMassifsCount).toBeGreaterThanOrEqual(3);
    expect(summary.lifetimeStats.summitsConqueredCount).toBeGreaterThanOrEqual(10);
    expect(summary.lifetimeStats.certifiedTracksPercent).toBeGreaterThanOrEqual(90);

    // Massifs foulés par le compte
    expect(summary.massifs.length).toBeGreaterThanOrEqual(3);
    const montBlanc = summary.massifs.find((m) => m.id === 'mont-blanc');
    expect(montBlanc).toBeDefined();
    expect(montBlanc?.center).toEqual([6.8694, 45.9237]);
  });

  it('fetchUserFootprintSummary : utilise le cache mémoire pour éviter les requêtes redondantes', async () => {
    const call1 = await userFootprintService.fetchUserFootprintSummary('tony_frc');
    const call2 = await userFootprintService.fetchUserFootprintSummary('tony_frc');

    expect(call1).toBe(call2); // Même référence mémoire en cache
  });

  it('fetchUserMassifDetails : charge les détails d un massif spécifique (Z7-Z11, ~35 Ko)', async () => {
    const details = await userFootprintService.fetchUserMassifDetails('tony_frc', 'mont-blanc');

    expect(details).toBeDefined();
    expect(details.massifId).toBe('mont-blanc');
    expect(details.outings.length).toBeGreaterThan(0);
    expect(details.summitsConquered.length).toBeGreaterThan(0);
    expect(details.refugesAndBivouacs.length).toBeGreaterThan(0);

    const jsonBytes = new TextEncoder().encode(JSON.stringify(details)).length;
    expect(jsonBytes).toBeLessThan(40000); // Reste léger
  });

  it('fetchUserPhotos : retourne les photos géolocalisées de l aventurier', async () => {
    const photos = await userFootprintService.fetchUserPhotos('tony_frc');

    expect(photos.length).toBeGreaterThan(0);
    photos.forEach((photo) => {
      expect(typeof photo.lat).toBe('number');
      expect(typeof photo.lng).toBe('number');
      expect(typeof photo.url).toBe('string');
      expect(photo.title).toBeDefined();
    });
  });

  it('fetchUserFieldNotes : retourne les notes de terrain et observations faune/flore', async () => {
    const notes = await userFootprintService.fetchUserFieldNotes('tony_frc');

    expect(notes.length).toBeGreaterThan(0);
    notes.forEach((note) => {
      expect(typeof note.lat).toBe('number');
      expect(typeof note.lng).toBe('number');
      expect(['source', 'delicate_passage', 'wildlife', 'camp']).toContain(note.category);
    });
  });

  it('generateGlobeFootprintGeoJSON : produit un FeatureCollection valide pour MapLibre', async () => {
    const summary = await userFootprintService.fetchUserFootprintSummary('tony_frc');
    const geojson = userFootprintService.generateGlobeFootprintGeoJSON(summary);

    expect(geojson.type).toBe('FeatureCollection');
    expect(geojson.features.length).toBe(summary.massifs.length);
    geojson.features.forEach((feature) => {
      expect(feature.geometry.type).toBe('Point');
      expect(feature.properties?.name).toBeDefined();
      expect(feature.properties?.outingsCount).toBeDefined();
    });
  });

  it('generateUserPhotosGeoJSON : produit des points avec métadonnées d image', async () => {
    const photos = await userFootprintService.fetchUserPhotos('tony_frc');
    const geojson = userFootprintService.generateUserPhotosGeoJSON(photos);

    expect(geojson.type).toBe('FeatureCollection');
    expect(geojson.features.length).toBe(photos.length);
    expect(geojson.features[0].properties?.photoUrl).toBeDefined();
  });

  it('isolation multi-tenant : un nouvel utilisateur a une empreinte vierge sans fuite des données de @tony_frc', async () => {
    const newUserSummary = await userFootprintService.fetchUserFootprintSummary('user_explorer_99');

    expect(newUserSummary.userId).toBe('user_explorer_99');
    expect(newUserSummary.handle).toBe('@user_explorer_99');
    expect(newUserSummary.massifs).toEqual([]);
    expect(newUserSummary.lifetimeStats.totalDistanceKm).toBe(0);
    expect(newUserSummary.lifetimeStats.totalDPlusM).toBe(0);
    expect(newUserSummary.lifetimeStats.totalMassifsCount).toBe(0);
    expect(newUserSummary.lifetimeStats.summitsConqueredCount).toBe(0);

    const photos = await userFootprintService.fetchUserPhotos('user_explorer_99');
    expect(photos).toEqual([]);

    const notes = await userFootprintService.fetchUserFieldNotes('user_explorer_99');
    expect(notes).toEqual([]);

    const massifDetails = await userFootprintService.fetchUserMassifDetails('user_explorer_99', 'unknown_massif');
    expect(massifDetails.outings).toEqual([]);
    expect(massifDetails.summitsConquered).toEqual([]);
  });

  it('registerUserFootprint : supporte l enregistrement de profils dédiés pour des millions d utilisateurs', async () => {
    userFootprintService.registerUserFootprint({
      userId: 'user_alpes_pro',
      handle: '@alpes_pro',
      displayName: 'Guide Alpin',
      lifetimeStats: {
        totalDistanceKm: 5400,
        totalDPlusM: 320000,
        totalMassifsCount: 12,
        summitsConqueredCount: 95,
        certifiedTracksPercent: 100,
        bivouacNightsCount: 150,
      },
      massifs: [
        {
          id: 'ecrins',
          name: 'Massif des Écrins',
          country: 'France',
          region: 'Hautes-Alpes / Isère',
          center: [6.35, 44.95],
          peakElevationM: 4102,
          outingsCount: 25,
          totalDistanceKm: 780,
          totalDPlusM: 65000,
          summitsConquered: 14,
          lastExploredDate: '2026-09-01',
        },
      ],
      activeMassifId: 'ecrins',
    });

    const summary = await userFootprintService.fetchUserFootprintSummary('user_alpes_pro');
    expect(summary.handle).toBe('@alpes_pro');
    expect(summary.lifetimeStats.totalDistanceKm).toBe(5400);
    expect(summary.massifs.length).toBe(1);
    expect(summary.massifs[0].id).toBe('ecrins');
  });
});
