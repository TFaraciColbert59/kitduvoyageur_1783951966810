import { describe, it, expect } from 'vitest';
import { buildItinerary } from '@/features/trips/engine/buildItinerary';
import type { PlannerInput, CandidateStep, CandidateItem } from '@/features/trips/engine/types';

describe('buildItinerary — Orchestrateur déterministe d’itinéraire (TDD)', () => {
  const mockCandidatesFR: CandidateStep[] = [
    {
      id: 'fr-step-1',
      country_code: 'FR',
      title: 'Arrivée Chamonix & Balcon Sud',
      location_name: 'Chamonix-Mont-Blanc',
      latitude: 45.9237,
      longitude: 6.8694,
      distance_km: 8,
      elevation_gain_m: 400,
      elevation_loss_m: 400,
      is_demanding: false,
    },
    {
      id: 'fr-step-2',
      country_code: 'FR',
      title: 'Lac Blanc & Aiguilles Rouges',
      location_name: 'Lac Blanc',
      latitude: 45.9817,
      longitude: 6.8867,
      distance_km: 19,
      elevation_gain_m: 1100,
      elevation_loss_m: 1100,
      is_demanding: true,
    },
    {
      id: 'fr-step-3',
      country_code: 'FR',
      title: 'Descente vers Vallorcine & Récupération',
      location_name: 'Vallorcine',
      latitude: 46.0308,
      longitude: 6.9328,
      distance_km: 9,
      elevation_gain_m: 200,
      elevation_loss_m: 600,
      is_demanding: false,
    },
    {
      id: 'fr-step-4',
      country_code: 'FR',
      title: 'Traversée du Col de Balme',
      location_name: 'Col de Balme',
      latitude: 46.0272,
      longitude: 6.9697,
      distance_km: 17,
      elevation_gain_m: 1050,
      elevation_loss_m: 800,
      is_demanding: true,
    },
    {
      id: 'fr-step-5',
      country_code: 'FR',
      title: 'Retour Chamonix & Départ',
      location_name: 'Chamonix-Mont-Blanc',
      latitude: 45.9237,
      longitude: 6.8694,
      distance_km: 5,
      elevation_gain_m: 100,
      elevation_loss_m: 200,
      is_demanding: false,
    },
  ];

  const mockCandidatesCH: CandidateStep[] = [
    {
      id: 'ch-step-1',
      country_code: 'CH',
      title: 'Trient - Champex',
      location_name: 'Champex-Lac',
      latitude: 46.0298,
      longitude: 7.1165,
      distance_km: 14,
      elevation_gain_m: 750,
      elevation_loss_m: 600,
      is_demanding: false,
    },
    {
      id: 'ch-step-2',
      country_code: 'CH',
      title: 'Grand Col Ferret vers Val Ferret',
      location_name: 'La Fouly',
      latitude: 45.9328,
      longitude: 7.0984,
      distance_km: 20,
      elevation_gain_m: 1200,
      elevation_loss_m: 1100,
      is_demanding: true,
    },
  ];

  const mockCandidateItems: CandidateItem[] = [
    {
      id: 'item-tent',
      name: 'Tente ultra-légère 2 places',
      category: 'Bivouac & Abri',
      weight_grams: 1200,
      ref_type: 'gear',
      ref_id: 'gear-101',
      is_essential: true,
    },
    {
      id: 'item-shoes',
      name: 'Chaussures de trek tiges hautes',
      category: 'Équipement personnel',
      weight_grams: 950,
      ref_type: 'gear',
      ref_id: 'gear-102',
      is_essential: true,
    },
  ];

  it('TEST-BUILD-01: Génère un itinéraire multi-pays avec nombre exact de jours et chaînage complet', () => {
    const input: PlannerInput = {
      countries: [{ country_code: 'FR' }, { country_code: 'CH' }],
      duration_days: 7,
      start_date: '2026-07-15',
      end_date: '2026-07-21',
      styles: ['hiking', 'bivouac'],
      pace: 'standard',
      travelers_count: 2,
    };

    const output = buildItinerary(input, {
      candidateSteps: [...mockCandidatesFR, ...mockCandidatesCH],
      candidateItems: mockCandidateItems,
    });

    expect(output.total_days).toBe(7);
    expect(output.allocations).toHaveLength(2);
    expect(output.allocations[0].allocated_days + output.allocations[1].allocated_days).toBe(7);
    expect(output.steps.length).toBeGreaterThan(0);
    expect(output.items.length).toBeGreaterThan(0);
  });

  it('TEST-BUILD-02: Jour 1 et dernier jour allégés (aucun effort extrême à l’arrivée ou départ)', () => {
    const input: PlannerInput = {
      countries: [{ country_code: 'FR' }],
      duration_days: 5,
      start_date: '2026-08-01',
      styles: ['hiking'],
      pace: 'standard',
      travelers_count: 1,
    };

    const output = buildItinerary(input, {
      candidateSteps: mockCandidatesFR,
      candidateItems: mockCandidateItems,
    });

    const day1Steps = output.steps.filter((s) => s.day_number === 1);
    const day5Steps = output.steps.filter((s) => s.day_number === 5);

    expect(day1Steps.length).toBeGreaterThan(0);
    expect(day5Steps.length).toBeGreaterThan(0);

    // Ni le J1 ni le J5 ne doivent comporter une étape extrême (> 1000m D+ ou > 18km)
    expect((day1Steps[0].elevation_gain_m || 0)).toBeLessThanOrEqual(900);
    expect((day5Steps[0].elevation_gain_m || 0)).toBeLessThanOrEqual(900);
  });

  it('TEST-BUILD-03: Jamais deux journées consécutives exigeantes (is_demanding)', () => {
    const input: PlannerInput = {
      countries: [{ country_code: 'FR' }],
      duration_days: 5,
      start_date: '2026-08-01',
      styles: ['hiking'],
      pace: 'standard',
      travelers_count: 1,
    };

    const output = buildItinerary(input, {
      candidateSteps: mockCandidatesFR,
      candidateItems: mockCandidateItems,
    });

    // Parcourt les jours successifs
    for (let d = 1; d < 5; d++) {
      const stepToday = output.steps.find((s) => s.day_number === d);
      const stepTomorrow = output.steps.find((s) => s.day_number === d + 1);

      const todayDemanding = (stepToday?.elevation_gain_m || 0) > 900 || (stepToday?.distance_km || 0) > 18;
      const tomorrowDemanding = (stepTomorrow?.elevation_gain_m || 0) > 900 || (stepTomorrow?.distance_km || 0) > 18;

      expect(todayDemanding && tomorrowDemanding).toBe(false);
    }
  });

  it('TEST-BUILD-04: Une étape n’est jamais coupée en deux par un changement de pays', () => {
    const input: PlannerInput = {
      countries: [{ country_code: 'FR' }, { country_code: 'CH' }],
      duration_days: 6,
      start_date: '2026-08-01',
      styles: ['hiking'],
      pace: 'standard',
      travelers_count: 2,
    };

    const output = buildItinerary(input, {
      candidateSteps: [...mockCandidatesFR, ...mockCandidatesCH],
      candidateItems: mockCandidateItems,
    });

    const frAlloc = output.allocations.find((a) => a.country_code === 'FR');
    const chAlloc = output.allocations.find((a) => a.country_code === 'CH');

    expect(frAlloc).toBeDefined();
    expect(chAlloc).toBeDefined();

    // Vérifie que chaque étape appartient strictement au pays de son jour
    for (const step of output.steps) {
      if (step.day_number <= frAlloc!.end_day) {
        expect(step.country_code).toBe('FR');
      } else {
        expect(step.country_code).toBe('CH');
      }
    }
  });

  it('TEST-BUILD-05: Si aucune donnée candidate n’est fournie pour un pays, produit zéro placeholder et un avertissement explicite', () => {
    const input: PlannerInput = {
      countries: [{ country_code: 'IS' }], // Islande, 0 candidates
      duration_days: 5,
      start_date: '2026-07-01',
      styles: ['roadtrip'],
      pace: 'standard',
      travelers_count: 2,
    };

    const output = buildItinerary(input, {
      candidateSteps: [], // Base vide pour IS
      candidateItems: [],
    });

    expect(output.steps).toHaveLength(0);
    const noDataWarning = output.warnings.find((w) => w.code === 'NO_STEPS_AVAILABLE');
    expect(noDataWarning).toBeDefined();
    expect(noDataWarning?.country_code).toBe('IS');
  });

  it('TEST-BUILD-06: Déterminisme absolu — 100 exécutions produisent une sortie bit pour bit identique', () => {
    const input: PlannerInput = {
      countries: [{ country_code: 'FR' }, { country_code: 'CH' }],
      duration_days: 7,
      start_date: '2026-08-10',
      styles: ['hiking', 'bivouac'],
      pace: 'standard',
      travelers_count: 2,
      reference_date: '2026-09-05',
    };

    const run1 = JSON.stringify(
      buildItinerary(input, {
        candidateSteps: [...mockCandidatesFR, ...mockCandidatesCH],
        candidateItems: mockCandidateItems,
      })
    );

    for (let i = 0; i < 100; i++) {
      const runN = JSON.stringify(
        buildItinerary(input, {
          candidateSteps: [...mockCandidatesFR, ...mockCandidatesCH],
          candidateItems: mockCandidateItems,
        })
      );
      expect(runN).toBe(run1);
    }
  });
});
