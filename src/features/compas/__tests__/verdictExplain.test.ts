import { describe, expect, it } from 'vitest';
import { checkExplanation, numbersIn, verdictFacts } from '../engine/verdictExplain';
import type { DangerAssessment } from '../engine/danger';

const danger: DangerAssessment = {
  axes: {
    physique: { level: 'ok', note: '', partial: 'Non vérifié : dénivelé (J1, J2, J3).' },
    technique: {
      level: 'non_evalue',
      note: 'Cotation et pente du terrain non disponibles : axe non évalué.',
      partial: null,
    },
    conjoncturel: {
      level: 'vigilance',
      note: '',
      partial: null,
    },
  },
  signals: [
    {
      id: 'conjoncturel-gust-2',
      axis: 'conjoncturel',
      severity: 'warn',
      label: 'Jour 2 : rafales à 70 km/h',
      source: 'Open-Meteo',
      asOf: '2026-10-11',
      day: 2,
    },
  ],
};

const facts = verdictFacts({
  level: 'vigilance',
  reasons: [
    { label: 'Jour 2 : rafales à 70 km/h', severity: 'warn', source: 'Open-Meteo' },
    { label: '1 nuit sans hébergement', severity: 'warn', source: 'étapes' },
  ],
  danger,
});

describe('verdictFacts', () => {
  it('liste le niveau du moteur, chaque signal sourcé et daté, et ce qui n’est pas vérifié', () => {
    expect(facts).toContain('Niveau décidé par le moteur : Vigilance.');
    expect(facts).toContain('- Jour 2 : rafales à 70 km/h (source : Open-Meteo, 2026-10-11).');
    expect(facts).toContain('Axe Physique : rien de signalé. Non vérifié : dénivelé (J1, J2, J3).');
    expect(facts).toContain('Axe Technique : non évalué.');
  });
});

describe('numbersIn', () => {
  it('normalise espaces de milliers et virgules', () => {
    expect([...numbersIn('1 200 m, 2,5 km, 1\u202f500 m et le jour 2')]).toEqual(['1200|m', '2.5|km', '1500|m', '2']);
  });
});

describe('checkExplanation', () => {
  it('accepte un texte qui ne reprend que les faits', () => {
    const r = checkExplanation(
      'Vigilance : des rafales à 70 km/h sont annoncées le jour 2 et une nuit reste sans hébergement. Le dénivelé n’est pas connu.',
      facts
    );
    expect(r.ok).toBe(true);
  });

  it('CONTRE-EXEMPLE — refuse un nombre absent des signaux', () => {
    const r = checkExplanation('Prévoyez 3 litres d’eau : les rafales atteindront 90 km/h le jour 2.', facts);
    expect(r).toEqual({ ok: false, reason: 'nombre absent des signaux (3 l, 90 km/h)' });
  });

  it('CONTRE-EXEMPLE — refuse un score et une réassurance', () => {
    expect(checkExplanation('Score de sécurité : le voyage est globalement raisonnable ce jour 2.', facts)).toEqual({
      ok: false,
      reason: 'parle de score ou de note',
    });
    expect(
      checkExplanation('Le jour 2 est venteux mais le parcours reste sans danger pour le groupe.', facts)
    ).toEqual({ ok: false, reason: 'rassure au-delà des signaux' });
  });

  it('refuse une réponse vide ou trop longue', () => {
    expect(checkExplanation('  ', facts).ok).toBe(false);
    expect(checkExplanation('a'.repeat(1000), facts).ok).toBe(false);
  });
});
