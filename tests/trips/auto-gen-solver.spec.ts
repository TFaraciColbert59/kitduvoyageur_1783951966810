import { describe, it, expect } from 'vitest';
import { extractTripBrief } from '@/features/trips/engine/tripBriefExtractor';
import { solveCoherence } from '@/features/trips/engine/coherenceSolver';
import { runAutoGenPipeline } from '@/features/trips/engine/autoGenPipeline';
import type { TripBrief, Proposal } from '@/features/trips/schemas/autoGen.schema';

describe('Phase C — Moteur d’Extraction & Solveur de Cohérence Déterministe (U13)', () => {
  describe('C.1 : Parseur Déterministe d’Intention (extractTripBrief)', () => {
    it('TEST-EXTRACT-01: Extrait correctement un brief complexe (Maroc Toubkal)', () => {
      const raw = '10 jours au Maroc en octobre, budget serré, randonnée et bivouac, on est 3, sommet du Toubkal';
      const brief = extractTripBrief(raw);

      expect(brief.rawInput).toBe(raw);
      expect(brief.duration.value.days).toBe(10);
      expect(brief.duration.confidence).toBe('stated');

      expect(brief.destinations.value[0]?.country).toBe('MA');
      expect(brief.destinations.value[0]?.region).toContain('Toubkal');
      expect(brief.destinations.confidence).toBe('stated');

      expect(brief.party.value.adults).toBe(3);
      expect(brief.party.confidence).toBe('stated');

      expect(brief.window.value.month).toBe(10);
      expect(brief.window.confidence).toBe('stated');

      expect(brief.budget.value.tier).toBe('shoestring');
      expect(brief.budget.confidence).toBe('stated');

      expect(brief.style.value).toContain('bivouac');
      expect(brief.style.value).toContain('trekking');
    });

    it('TEST-EXTRACT-02: Applique des valeurs par défaut intelligentes pour un brief minimal (Loi 1)', () => {
      const raw = 'Islande cet été';
      const brief = extractTripBrief(raw);

      expect(brief.destinations.value[0]?.country).toBe('IS');
      expect(brief.duration.value.days).toBeGreaterThanOrEqual(7);
      expect(brief.duration.confidence).toBe('defaulted');
      expect(brief.party.value.adults).toBe(1);
      expect(brief.party.confidence).toBe('defaulted');
      expect(brief.budget.value.tier).toBe('moderate');
      expect(brief.budget.confidence).toBe('defaulted');
    });

    it('TEST-EXTRACT-03: Détecte les contraintes et mobilités (train, sans avion)', () => {
      const raw = '3 jours dans le Sancy en train, départ vendredi soir, budget 100€';
      const brief = extractTripBrief(raw);

      expect(brief.duration.value.days).toBe(3);
      expect(brief.destinations.value[0]?.country).toBe('FR');
      expect(brief.mobility.value.modes).toContain('train');
      expect(brief.budget.value.totalEur).toBe(100);
      expect(brief.budget.value.tier).toBe('shoestring');
    });
  });

  describe('C.2 : Solveur de Cohérence Déterministe (solveCoherence)', () => {
    it('TEST-SOLVER-01: Détecte et résout un dépassement budgétaire en dégradant l’hébergement', () => {
      const mockAccom: Proposal<any> = {
        id: 'p-accom',
        layer: 'accommodations',
        slotId: 'slot-night-d1',
        value: { name: 'Hôtel Luxe', priceEur: 180, type: 'hotel' },
        provenance: { source: 'official' },
        confidence: 'high',
        rationale: 'Hôtel en centre-ville',
        alternatives: [
          {
            id: 'p-accom-alt1',
            layer: 'accommodations',
            slotId: 'slot-night-d1',
            value: { name: 'Gîte d’étape', priceEur: 35, type: 'gite' },
            provenance: { source: 'official' },
            confidence: 'high',
            rationale: 'Alternative économique',
            alternatives: [],
            locked: false,
            editedByUser: false,
            impacts: ['slot-budget'],
          },
        ],
        locked: false,
        editedByUser: false,
        impacts: ['slot-budget'],
      };

      const result = solveCoherence({
        layers: {
          accommodations: mockAccom,
          budget: {
            id: 'p-budg',
            layer: 'budget',
            slotId: 'slot-budget',
            value: { totalPerPersonEur: 450, maxTargetEur: 300 },
            provenance: { source: 'computed' },
            confidence: 'high',
            rationale: 'Budget initial',
            alternatives: [],
            locked: false,
            editedByUser: false,
            impacts: [],
          },
        },
        maxBudgetEur: 300,
        userBodyWeightKg: 70,
      });

      expect(result.tradeoffsLog.length).toBeGreaterThan(0);
      expect(result.tradeoffsLog[0]).toContain('budget');
      // L’alternative économique a été retenue
      expect(result.resolvedLayers.accommodations.value.priceEur).toBe(35);
    });

    it('TEST-SOLVER-02: Respecte strictement les éléments verrouillés (Loi 3)', () => {
      const lockedAccom: Proposal<any> = {
        id: 'p-accom-locked',
        layer: 'accommodations',
        slotId: 'slot-night-d1',
        value: { name: 'Refuge Incontournable', priceEur: 150, type: 'refuge' },
        provenance: { source: 'official' },
        confidence: 'high',
        rationale: 'Validé par l’utilisateur',
        alternatives: [],
        locked: true, // VERROUILLÉ
        editedByUser: true,
        impacts: [],
      };

      const result = solveCoherence({
        layers: {
          accommodations: lockedAccom,
        },
        maxBudgetEur: 100,
        userBodyWeightKg: 70,
      });

      // L’élément verrouillé ne doit PAS avoir été modifié malgré le dépassement
      expect(result.resolvedLayers.accommodations.value.name).toBe('Refuge Incontournable');
      expect(result.resolvedLayers.accommodations.locked).toBe(true);
    });
  });

  describe('C.3 : Pipeline de Génération Intégral (runAutoGenPipeline)', () => {
    it('TEST-PIPELINE-01: Exécute les 6 étages et produit un voyage en 12 couches en < 1500 ms', async () => {
      const rawInput = '7 jours autour du Mont-Blanc début juillet, en couple, nuits en refuges demi-pension';
      
      const start = performance.now();
      const output = await runAutoGenPipeline(rawInput);
      const durationMs = performance.now() - start;

      expect(durationMs).toBeLessThan(1500); // Moins de 1,5 seconde
      expect(output).toBeDefined();
      expect(output.brief).toBeDefined();
      expect(output.blueprintId).toContain('tmb');
      expect(output.layers.skeleton).toBeDefined();
      expect(output.layers.itinerary).toBeDefined();
      expect(output.layers.accommodations).toBeDefined();
      expect(output.layers.food_water).toBeDefined();
      expect(output.layers.kit).toBeDefined();
      expect(output.layers.budget).toBeDefined();
      expect(output.layers.compliance).toBeDefined();
      expect(output.layers.safety).toBeDefined();
      expect(output.layers.know_how).toBeDefined();
      expect(output.tradeoffsLog).toBeDefined();
    });
  });
});
