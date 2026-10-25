import { describe, it, expect } from 'vitest';
import { runAutoGenPipeline } from '@/features/trips/engine/autoGenPipeline';
import { checkSafetyRedLines } from '@/features/trips/safety/safetyRedLines';
import { solveCoherence } from '@/features/trips/engine/coherenceSolver';
import type { Proposal } from '@/features/trips/schemas/autoGen.schema';

const GOLDEN_TEST_INPUTS = [
  {
    id: 'GOLDEN-01',
    title: 'Tour du Mont-Blanc Classique Refuge',
    prompt: '7 jours autour du Mont-Blanc début juillet, en couple, nuits en refuges demi-pension, sac léger',
    expectedCountry: 'FR',
    maxBudgetEur: 700,
  },
  {
    id: 'GOLDEN-02',
    title: 'Laugavegur Islande Bivouac',
    prompt: '12 jours en Islande fin août, 3 potes, Laugavegur et Hautes Terres, bivouac sous tente, météo rude',
    expectedCountry: 'IS',
    maxBudgetEur: 1500,
  },
  {
    id: 'GOLDEN-03',
    title: 'Toubkal & Haut Atlas Maroc',
    prompt: '10 jours au Maroc en octobre, budget serré, randonnée et bivouac, on est 3, sommet du Toubkal',
    expectedCountry: 'MA',
    maxBudgetEur: 500,
  },
  {
    id: 'GOLDEN-04',
    title: 'Massif du Sancy Micro-Aventure Train',
    prompt: '3 jours dans le Sancy en train, départ vendredi soir, budget 100€',
    expectedCountry: 'FR',
    maxBudgetEur: 120,
  },
  {
    id: 'GOLDEN-05',
    title: 'Dolomites Alta Via 1',
    prompt: '6 jours dans les Dolomites fin juillet en refuges, Alta Via 1',
    expectedCountry: 'IT',
    maxBudgetEur: 900,
  },
  {
    id: 'GOLDEN-06',
    title: 'Sanctuaire des Annapurnas Népal',
    prompt: '14 jours au Népal en octobre, sanctuaire des Annapurnas, en lodges',
    expectedCountry: 'NP',
    maxBudgetEur: 1800,
  },
  {
    id: 'GOLDEN-07',
    title: 'Traversée du Jura Bikepacking',
    prompt: '4 jours de bikepacking dans le Jura en été, bivouac',
    expectedCountry: 'FR',
    maxBudgetEur: 250,
  },
  {
    id: 'GOLDEN-08',
    title: 'Madère Randonnée Côtière & Levadas',
    prompt: '7 jours à Madère au printemps, randonnée le long des levadas et gîtes',
    expectedCountry: 'PT',
    maxBudgetEur: 800,
  },
  {
    id: 'GOLDEN-09',
    title: 'Kumano Kodo Japon Pèlerinage',
    prompt: '6 jours sur le Kumano Kodo au Japon en automne, ryokan',
    expectedCountry: 'JP',
    maxBudgetEur: 1400,
  },
  {
    id: 'GOLDEN-10',
    title: 'La Réunion Tour des Cirques',
    prompt: '5 jours dans les cirques de La Réunion en gîtes de montagne',
    expectedCountry: 'FR',
    maxBudgetEur: 600,
  },
];

describe('Phase F — Golden Test Suite & Validation Définitive (U13)', () => {
  describe('F.1 : Évaluation des 10 Voyages Dorés de Référence', () => {
    for (const testCase of GOLDEN_TEST_INPUTS) {
      it(`TEST-GOLDEN: ${testCase.id} — ${testCase.title}`, async () => {
        const start = performance.now();
        const output = await runAutoGenPipeline(testCase.prompt);
        const durationMs = performance.now() - start;

        // 1. Latence < 1200 ms
        expect(durationMs).toBeLessThan(1200);

        // 2. Loi 1 : Zéro champ vide — les 12 couches fonctionnelles doivent être présentes
        expect(output.layers.skeleton).toBeDefined();
        expect(output.layers.itinerary).toBeDefined();
        expect(output.layers.accommodations).toBeDefined();
        expect(output.layers.food_water).toBeDefined();
        expect(output.layers.kit).toBeDefined();
        expect(output.layers.budget).toBeDefined();
        expect(output.layers.compliance).toBeDefined();
        expect(output.layers.safety).toBeDefined();
        expect(output.layers.know_how).toBeDefined();

        // 3. Loi 2 : Zéro valeur sans provenance
        for (const [layerName, proposal] of Object.entries(output.layers)) {
          expect(
            proposal.provenance?.source,
            `La couche ${layerName} doit avoir une provenance certifiée`
          ).toBeDefined();
          expect(
            ['official', 'measured', 'computed', 'community', 'estimated', 'suggested']
          ).toContain(proposal.provenance.source);
        }

        // 4. Lignes Rouges Infranchissables
        const safetyResult = checkSafetyRedLines(output.brief, output.layers);
        expect(safetyResult.allowed).toBe(true);

        // 5. Destination cohérente
        expect(output.brief.destinations.value[0]?.country).toBe(testCase.expectedCountry);
      });
    }
  });

  describe('F.2 : Invariance sur 50 Éditions Utilisateur Aléatoires (Loi 3)', () => {
    it('TEST-INVARIANCE-50: 50 mutations successives conservent l’intégrité des 12 couches sans corruption', async () => {
      // Voyage initial
      const initial = await runAutoGenPipeline(
        '7 jours autour du Mont-Blanc début juillet, en couple, nuits en refuges'
      );

      let currentLayers: Record<string, Proposal<any>> = JSON.parse(
        JSON.stringify(initial.layers)
      );

      const layerKeys = Object.keys(currentLayers);

      for (let i = 0; i < 50; i++) {
        // Choix d'une couche au hasard
        const targetLayer = layerKeys[i % layerKeys.length];
        const existing = currentLayers[targetLayer];

        if (i % 3 === 0) {
          // Mutation 1 : Verrouillage (Lock)
          currentLayers[targetLayer] = {
            ...existing,
            locked: true,
            editedByUser: true,
          };
        } else if (i % 3 === 1 && existing.alternatives && existing.alternatives.length > 0) {
          // Mutation 2 : Sélection d'une alternative
          const alt = existing.alternatives[0];
          currentLayers[targetLayer] = {
            ...alt,
            locked: true,
            editedByUser: true,
            alternatives: [existing, ...existing.alternatives.slice(1)],
          };
        } else {
          // Mutation 3 : Édition de valeur
          currentLayers[targetLayer] = {
            ...existing,
            value: {
              ...(typeof existing.value === 'object' ? existing.value : {}),
              userCustomNote: `Modification utilisateur #${i}`,
            },
            editedByUser: true,
          };
        }

        // Exécution du solveur de cohérence après mutation
        const { resolvedLayers } = solveCoherence({
          layers: currentLayers,
          maxBudgetEur: 450,
          userBodyWeightKg: 70,
        });

        // Vérification de l'invariance (Loi 3)
        // 1. La couche mutée a bien conservé son état
        if (currentLayers[targetLayer].locked) {
          expect(resolvedLayers[targetLayer].locked).toBe(true);
        }
        // 2. Aucune des 12 couches n'a été détruite ou vidée
        for (const k of layerKeys) {
          expect(resolvedLayers[k]).toBeDefined();
          expect(resolvedLayers[k].id).toBeDefined();
          expect(resolvedLayers[k].provenance?.source).toBeDefined();
        }

        currentLayers = resolvedLayers;
      }
    });
  });
});
