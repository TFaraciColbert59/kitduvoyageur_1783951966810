import { describe, it, expect } from 'vitest';
import { checkSeasonality, getSeasonalityAdvice } from '@/features/trips/engine/seasonality';

describe('seasonality — Détection des alertes météo et praticabilité saisonnière (TDD)', () => {
  it('TEST-SEASON-01: Népal en juillet déclenche un avertissement mousson', () => {
    const warnings = checkSeasonality('NP', 7); // Juillet
    expect(warnings.length).toBeGreaterThan(0);
    const monsoon = warnings.find((w) => w.code === 'NEPAL_MONSOON');
    expect(monsoon).toBeDefined();
    expect(monsoon?.severity).toBe('warning');
    expect(monsoon?.message).toContain('mousson');
  });

  it('TEST-SEASON-02: Népal en octobre ne déclenche aucun avertissement (saison trek idéale)', () => {
    const warnings = checkSeasonality('NP', 10); // Octobre
    expect(warnings).toHaveLength(0);
  });

  it('TEST-SEASON-03: Islande en janvier signale les routes intérieures (F) fermées et hiver polaire', () => {
    const warnings = checkSeasonality('IS', 1); // Janvier
    expect(warnings.length).toBeGreaterThan(0);
    const fRoads = warnings.find((w) => w.code === 'ICELAND_F_ROADS_CLOSED');
    expect(fRoads).toBeDefined();
    expect(fRoads?.severity).toBe('alert');
    expect(fRoads?.message).toContain('pistes F');
  });

  it('TEST-SEASON-04: Islande en juillet est en saison optimale', () => {
    const warnings = checkSeasonality('IS', 7); // Juillet
    expect(warnings).toHaveLength(0);
  });

  it('TEST-SEASON-05: Pérou en juin est en pleine saison sèche (idéal Andes)', () => {
    const warnings = checkSeasonality('PE', 6); // Juin
    expect(warnings).toHaveLength(0);
  });

  it('TEST-SEASON-06: Pérou en février signale la saison des pluies (Chemin de l’Inca fermé)', () => {
    const warnings = checkSeasonality('PE', 2); // Février
    expect(warnings.length).toBeGreaterThan(0);
    const rain = warnings.find((w) => w.code === 'PERU_RAINY_SEASON');
    expect(rain).toBeDefined();
    expect(rain?.message).toContain('pluies');
  });

  it('TEST-SEASON-07: Maroc en juillet/août signale de fortes chaleurs', () => {
    const warnings = checkSeasonality('MA', 8); // Août
    expect(warnings.length).toBeGreaterThan(0);
    const heat = warnings.find((w) => w.code === 'MOROCCO_EXTREME_HEAT');
    expect(heat).toBeDefined();
    expect(heat?.message).toMatch(/chaleur/i);
  });

  it('TEST-SEASON-08: getSeasonalityAdvice fournit un résumé clair pour l’interface', () => {
    const advice = getSeasonalityAdvice('NP');
    expect(advice.bestMonths).toContain(10);
    expect(advice.bestMonths).toContain(11);
    expect(advice.cautionMonths).toContain(7);
  });
});
