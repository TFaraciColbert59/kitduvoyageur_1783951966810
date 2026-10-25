/**
 * Task 14 — Lignes budgétaires prévisionnelles catégorisées :
 * N catégories (`hébergement|nourriture|transport|activités|matériel|divers`),
 * chacune > 0, somme exacte = total de la couche budget, isPlanned = true,
 * déterministe pour des entrées identiques.
 */
import { describe, it, expect } from 'vitest';
import {
  BUDGET_LINE_CATEGORIES,
  buildBudgetLines,
  sumBudgetLines,
  type PreparationLayers,
} from '@/features/trips/engine/autogenPreparation';

const TOTAL_LAYERS: PreparationLayers = {
  budget: { value: { totalPerPersonEur: 612, currency: 'EUR' } },
};
const DAILY_LAYERS: PreparationLayers = {
  budget: { value: { dailyAverageEur: 87.4, currency: 'EUR' } },
};

const EXPECTED_CATEGORIES = [
  'hébergement',
  'nourriture',
  'transport',
  'activités',
  'matériel',
  'divers',
];

describe('buildBudgetLines — lignes prévisionnelles catégorisées (Task 14)', () => {
  it('T14-BUDGET-01: total/personne → 6 catégories, chacune > 0, somme = total', () => {
    const warnings: string[] = [];
    const lines = buildBudgetLines(TOTAL_LAYERS, 2, 7, warnings);

    expect(warnings).toEqual([]);
    expect(lines).toHaveLength(6);
    expect(lines.map((line) => line.category)).toEqual(EXPECTED_CATEGORIES);
    expect(lines.every((line) => line.amountEur > 0)).toBe(true);
    expect(lines.every((line) => line.isPlanned)).toBe(true);
    expect(lines.every((line) => line.provenance.rule === 'total_per_person')).toBe(true);
    expect(lines.every((line) => line.provenance.partySize === 2)).toBe(true);

    // 612 €/personne × 2 = 1224 €, réparti au centime.
    expect(sumBudgetLines(lines)).toBe(1224);
    expect(lines.map((line) => line.amountEur)).toEqual([
      204, 204, 204, 204, 204, 204,
    ]);
    // Chaque raison cite le total réel de la couche.
    expect(lines[0].reason).toContain('1224');
  });

  it('T14-BUDGET-02: daily_average → somme exacte au centime (reliquat sur les premières)', () => {
    const lines = buildBudgetLines(DAILY_LAYERS, 3, 7, []);

    // 87,4 €/jour/personne × 7 × 3 = 1835,4 → 1835 €.
    expect(sumBudgetLines(lines)).toBe(1835);
    expect(lines).toHaveLength(6);
    expect(lines.every((line) => line.amountEur > 0)).toBe(true);
    expect(Math.round(lines.reduce((sum, line) => sum + line.amountEur * 100, 0))).toBe(183500);
    expect(lines.every((line) => line.provenance.rule === 'daily_average')).toBe(true);
  });

  it('T14-BUDGET-03: déterministe et stable (mêmes entrées → mêmes lignes)', () => {
    const first = buildBudgetLines(TOTAL_LAYERS, 2, 7, []);
    const second = buildBudgetLines(TOTAL_LAYERS, 2, 7, []);

    expect(second).toEqual(first);
    expect(BUDGET_LINE_CATEGORIES.map((entry) => entry.category)).toEqual(EXPECTED_CATEGORIES);
  });

  it('T14-BUDGET-04: couche absente ou sans montant → aucune ligne (jamais inventée)', () => {
    const warnings: string[] = [];
    expect(buildBudgetLines({}, 2, 7, warnings)).toEqual([]);
    expect(warnings.some((warning) => warning.includes('Couche budget absente'))).toBe(true);

    const emptyWarnings: string[] = [];
    expect(buildBudgetLines({ budget: { value: {} } }, 2, 7, emptyWarnings)).toEqual([]);
    expect(emptyWarnings.some((warning) => warning.includes('Budget estimé indisponible'))).toBe(
      true
    );
    expect(sumBudgetLines([])).toBeNull();
  });

  it('T14-BUDGET-05: devise non EUR signalée sans casser la répartition', () => {
    const warnings: string[] = [];
    const lines = buildBudgetLines(
      { budget: { value: { totalPerPersonEur: 300, currency: 'USD' } } },
      1,
      3,
      warnings
    );

    expect(warnings.some((warning) => warning.includes('USD'))).toBe(true);
    expect(lines).toHaveLength(6);
    expect(sumBudgetLines(lines)).toBe(300);
  });
});
