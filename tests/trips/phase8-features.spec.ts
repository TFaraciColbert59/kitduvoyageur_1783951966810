import { describe, it, expect } from 'vitest';
import {
  parseTripGpx,
  generateTripGpx,
} from '@/features/trips/engine/exportEngine';
import {
  getPreDepartureChecklist,
  getCountrySpecificFormalities,
} from '@/features/trips/components/TripChecklistView';
import {
  getMonthlyClimateNormals,
  evaluateTripClimateRisk,
} from '@/features/trips/engine/seasonality';
import {
  simplifyDebts,
  calculateBudgetSummary,
} from '@/features/trips/engine/budgetEngine';
import {
  getReusableSegments,
  insertSegmentIntoTripSteps,
  type ReusableSegment,
} from '@/features/trips/engine/segmentEngine';
import type { TripFull, TripStep } from '@/features/trips/types/trip.types';

describe('Phase 8.1 — Export / Import GPX 1.1 certifié', () => {
  const sampleGpxXml = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Garmin Connect" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>Traversée des Fiz</name>
    <desc>Superbe boucle alpine face au Mont-Blanc</desc>
    <time>2026-07-15T08:00:00Z</time>
  </metadata>
  <wpt lat="45.9812" lon="6.7621">
    <name>Refuge de Sales</name>
    <desc>Hébergement en demi-pension</desc>
    <type>Refuge</type>
    <ele>1877</ele>
  </wpt>
  <wpt lat="46.0021" lon="6.7915">
    <name>Refuge d'Anterne</name>
    <desc>Bivouac autorisé à proximité</desc>
    <type>Refuge</type>
    <ele>1810</ele>
  </wpt>
  <trk>
    <name>Trace GPS Fiz - Jour 1</name>
    <trkseg>
      <trkpt lat="45.9600" lon="6.7300">
        <ele>1100</ele>
        <time>2026-07-15T08:00:00Z</time>
      </trkpt>
      <trkpt lat="45.9700" lon="6.7450">
        <ele>1450</ele>
        <time>2026-07-15T09:30:00Z</time>
      </trkpt>
      <trkpt lat="45.9812" lon="6.7621">
        <ele>1877</ele>
        <time>2026-07-15T11:45:00Z</time>
      </trkpt>
    </trkseg>
  </trk>
</gpx>`;

  it('TEST-P8-01: parseTripGpx extrait les métadonnées, waypoints et points de trace', () => {
    const parsed = parseTripGpx(sampleGpxXml);
    expect(parsed.title).toBe('Traversée des Fiz');
    expect(parsed.description).toContain('boucle alpine');
    expect(parsed.waypoints).toHaveLength(2);
    expect(parsed.waypoints[0].name).toBe('Refuge de Sales');
    expect(parsed.waypoints[0].lat).toBeCloseTo(45.9812, 4);
    expect(parsed.trackPoints).toHaveLength(3);
  });

  it('TEST-P8-02: parseTripGpx calcule distance totale (Haversine) et dénivelé D+/D-', () => {
    const parsed = parseTripGpx(sampleGpxXml);
    expect(parsed.totalDistanceKm).toBeGreaterThan(2);
    expect(parsed.totalElevationGainM).toBe(777); // 1877 - 1100
    expect(parsed.totalElevationLossM).toBe(0);
  });

  it('TEST-P8-03: parseTripGpx convertit le GPX en étapes de voyage exploitables', () => {
    const parsed = parseTripGpx(sampleGpxXml);
    expect(parsed.suggestedSteps.length).toBeGreaterThan(0);
    const step1 = parsed.suggestedSteps[0];
    expect(step1.latitude).toBeDefined();
    expect(step1.longitude).toBeDefined();
  });

  it('TEST-P8-04: parseTripGpx est résilient face à un fichier invalide ou corrompu', () => {
    const result = parseTripGpx('<not a valid gpx>');
    expect(result.isValid).toBe(false);
    expect(result.waypoints).toHaveLength(0);
    expect(result.trackPoints).toHaveLength(0);
  });
});

describe('Phase 8.2 — Checklist Pré-Départ Automatisée & Intelligence Pays', () => {
  it('TEST-P8-05: injecte les règles de formalités passeport (6 mois pour pays hors UE)', () => {
    const formalitiesNP = getCountrySpecificFormalities('NP'); // Népal
    expect(formalitiesNP.requiresPassport).toBe(true);
    expect(formalitiesNP.passportValidityMonths).toBe(6);
    expect(formalitiesNP.vaccineRecommendations.length).toBeGreaterThan(0);

    const checklist = getPreDepartureChecklist(45, 'NP');
    const passportItem = checklist.j30.find((i) => i.id.includes('passport'));
    expect(passportItem?.description).toContain('6 mois');
  });

  it('TEST-P8-06: adapte les exigences pour un pays UE/Schengen (CNI suffisante, CEAM)', () => {
    const formalitiesFR = getCountrySpecificFormalities('FR');
    expect(formalitiesFR.requiresPassport).toBe(false);
    expect(formalitiesFR.healthInsuranceCard).toContain('CEAM');
  });
});

describe('Phase 8.3 — Météo Saisonnière Déterministe & Normales Climatiques', () => {
  it('TEST-P8-07: getMonthlyClimateNormals fournit les normales mensuelles complètes', () => {
    // Islande en juillet (mois 7)
    const normals = getMonthlyClimateNormals('IS', 7);
    expect(normals).toBeDefined();
    expect(normals?.tempMinC).toBeGreaterThanOrEqual(5);
    expect(normals?.tempMaxC).toBeLessThanOrEqual(18);
    expect(normals?.precipitationMm).toBeGreaterThan(0);
    expect(normals?.suitabilityScore).toBeGreaterThanOrEqual(70);
  });

  it('TEST-P8-08: evaluateTripClimateRisk calcule le risque global sur la durée du séjour', () => {
    // Népal en juillet (mousson sévère)
    const riskJuly = evaluateTripClimateRisk('NP', '2026-07-10', '2026-07-25');
    expect(riskJuly.overallRisk).toBe('high');
    expect(riskJuly.primaryConcern?.toLowerCase()).toContain('mousson');

    // Népal en octobre (saison idéale)
    const riskOct = evaluateTripClimateRisk('NP', '2026-10-10', '2026-10-25');
    expect(riskOct.overallRisk).toBe('low');
  });
});

describe('Phase 8.5 — Règlements de Dépenses & Algorithme Split Équitable', () => {
  it('TEST-P8-09: simplifyDebts élimine les transactions redondantes', () => {
    // 3 participants : Alice a payé 300€, Bob 0€, Charlie 0€ pour une dépense partagée équitablement (100€ chacun)
    const balances = [
      { userId: 'u1', name: 'Alice', paid: 300, share: 100, net: 200 },
      { userId: 'u2', name: 'Bob', paid: 0, share: 100, net: -100 },
      { userId: 'u3', name: 'Charlie', paid: 0, share: 100, net: -100 },
    ];

    const settlements = simplifyDebts(balances);
    expect(settlements).toHaveLength(2);
    expect(settlements.find((s) => s.fromName === 'Bob')?.amount).toBe(100);
    expect(settlements.find((s) => s.fromName === 'Charlie')?.amount).toBe(100);
  });

  it('TEST-P8-10: calculateBudgetSummary agrège et détecte le dépassement', () => {
    const summary = calculateBudgetSummary(
      { estimated_budget: 500, budget_currency: 'EUR' },
      [
        {
          id: 'exp-1',
          trip_id: 't-1',
          payer_id: 'u1',
          title: 'Refuge',
          amount: 600,
          currency: 'EUR',
          category: 'hébergement',
          expense_date: '2026-07-01',
          split_type: 'equal',
          metadata: null,
          created_at: '',
          updated_at: '',
        },
      ],
      [{ user_id: 'u1', profile: { full_name: 'Alice' } }]
    );

    expect(summary.totalSpent).toBe(600);
    expect(summary.isOverBudget).toBe(true);
    expect(summary.spentPercentage).toBe(120);
  });
});

describe('Phase 8.6 — Bibliothèque de Segments Réutilisables & Insertion', () => {
  it('TEST-P8-11: getReusableSegments renvoie les tronçons certifiés du catalogue', () => {
    const segments = getReusableSegments();
    expect(segments.length).toBeGreaterThanOrEqual(3);
    const tmb = segments.find((s) => s.id.includes('tmb'));
    expect(tmb).toBeDefined();
    expect(tmb?.distanceKm).toBeGreaterThan(0);
    expect(tmb?.steps.length).toBeGreaterThan(0);
  });

  it('TEST-P8-12: insertSegmentIntoTripSteps insère un segment et réindexe les jours sans collision', () => {
    const initialSteps: TripStep[] = [
      {
        id: 'step-1',
        trip_id: 't-1',
        day_number: 1,
        order_index: 0,
        title: 'Jour 1 : Accueil Chamonix',
        description: '',
        location_name: 'Chamonix',
        latitude: 45.9237,
        longitude: 6.8694,
        accommodation_name: 'Gîte',
        transport_mode: 'foot',
        distance_km: 5,
        elevation_gain_m: 100,
        elevation_loss_m: 50,
        created_at: '',
        updated_at: '',
      },
      {
        id: 'step-2',
        trip_id: 't-1',
        day_number: 2,
        order_index: 0,
        title: 'Jour 2 : Repos',
        description: '',
        location_name: null,
        latitude: null,
        longitude: null,
        accommodation_name: null,
        transport_mode: null,
        distance_km: null,
        elevation_gain_m: null,
        elevation_loss_m: null,
        created_at: '',
        updated_at: '',
      },
    ];

    const segmentToInsert: ReusableSegment = {
      id: 'seg-fiz-1',
      title: 'Tronçon Fiz Dénivelé',
      countryCode: 'FR',
      difficulty: 'medium',
      distanceKm: 14,
      elevationGainM: 950,
      elevationLossM: 400,
      tags: ['alpin', 'refuge'],
      steps: [
        {
          title: 'Passage du Dérochoir',
          description: 'Passage sécurisé avec câbles',
          locationName: 'Dérochoir',
          latitude: 45.98,
          longitude: 6.75,
          distanceKm: 7,
          elevationGainM: 500,
          elevationLossM: 100,
        },
        {
          title: 'Arrivée Refuge Platé',
          description: 'Désert calcaire lapiaz',
          locationName: 'Platé',
          latitude: 45.99,
          longitude: 6.74,
          distanceKm: 7,
          elevationGainM: 450,
          elevationLossM: 300,
        },
      ],
    };

    // Insertion après le jour 1
    const updated = insertSegmentIntoTripSteps(initialSteps, segmentToInsert, 2);
    expect(updated.length).toBe(4);
    // Les deux nouvelles étapes s'insèrent au jour 2 et 3
    expect(updated[1].title).toBe('Passage du Dérochoir');
    expect(updated[1].day_number).toBe(2);
    expect(updated[2].title).toBe('Arrivée Refuge Platé');
    expect(updated[2].day_number).toBe(3);
    // L'ancienne étape du jour 2 passe au jour 4
    expect(updated[3].title).toBe('Jour 2 : Repos');
    expect(updated[3].day_number).toBe(4);
  });
});
