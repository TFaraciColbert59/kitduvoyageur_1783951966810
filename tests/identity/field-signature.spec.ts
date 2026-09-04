import { describe, it, expect } from 'vitest';
import {
  FIELD_SIGNATURE_FLOOR,
  fieldSealSeed,
  hasFieldSignature,
  publicSignature,
  sealGeometry,
  sealIsBalanced,
  signatureText,
  youngLabel,
  type FieldSignatureRow,
} from '@/features/identity/fieldSignature';

const overFloor: FieldSignatureRow = {
  total_outings: 16,
  total_km: 312.4,
  total_dplus_m: 18400,
  max_altitude_gain_m: 2200,
  distinct_months: 5,
  distinct_regions: 3,
  max_autonomy_days: 4,
  off_trail_share: 0.12,
};

describe('Empreinte (Lot C) — plancher & shape publique', () => {
  it('plancher : sous 3 sorties → AUCUNE empreinte exposée', () => {
    expect(FIELD_SIGNATURE_FLOOR).toBe(3);
    expect(hasFieldSignature({ total_outings: 2 })).toBe(false);
    expect(publicSignature({ total_outings: 2 })).toBeNull();
    expect(publicSignature(null)).toBeNull();
  });
  it('3 sorties → empreinte visible', () => {
    expect(hasFieldSignature({ total_outings: 3 })).toBe(true);
    expect(publicSignature({ total_outings: 3 })).not.toBeNull();
  });
  it('label neutre sous le plancher — jamais un chiffre ni un rôle', () => {
    expect(youngLabel(false)).toBe('pas encore d’empreinte');
    expect(youngLabel(true)).toBe('lignée jeune');
  });
  it('AUCUNE coordonnée dans la shape publique', () => {
    const pub = publicSignature(overFloor);
    const json = JSON.stringify(pub).toLowerCase();
    for (const k of ['lat', 'lng', 'latitude', 'longitude', 'position', 'points', 'geojson', 'coord']) {
      expect(json).not.toContain(k);
    }
    expect(pub).toBeDefined();
  });
  it('AUCUN agrégat inter-utilisateurs (ni moyenne, ni percentile, ni classement)', () => {
    const json = JSON.stringify(publicSignature(overFloor)).toLowerCase();
    for (const k of ['average', 'moyenne', 'percentile', 'rang', 'range', 'mieux', 'top', 'rank', 'classement']) {
      expect(json).not.toContain(k);
    }
  });
});

describe('signatureText — vocabulaire descriptif & k-anonymat par agrégat', () => {
  it('phrase descriptive : « seize sorties, cinq saisons, Écrins, Ariège, Vercors »', () => {
    const t = signatureText(overFloor, ['Écrins', 'Ariège', 'Vercors']);
    expect(t).toContain('seize sorties');
    expect(t).toContain('cinq saisons');
    expect(t).toContain('Écrins, Ariège et Vercors');
  });
  it('k-anonymat O.4 : filtre les régions ayant moins de 3 sorties', () => {
    const aggregates = [
      { region: 'Écrins', count: 4 },
      { region: 'Vercors', count: 2 }, // Sous le plancher de 3 -> exclu
      { region: 'Ariège', count: 3 },
    ];
    const t = signatureText(overFloor, aggregates);
    expect(t).toContain('Écrins et Ariège');
    expect(t).not.toContain('Vercors');
  });
  it('k-anonymat O.4 : pas d’exposition de saison sous le plancher de 3', () => {
    const lowSeason: FieldSignatureRow = { ...overFloor, distinct_months: 2 };
    const t = signatureText(lowSeason, ['Écrins']);
    expect(t).not.toContain('saison');
  });
  it('jamais de nom de rôle / ordre / niveau', () => {
    const t = signatureText(overFloor).toLowerCase();
    for (const b of ['voyageur', 'explorateur', 'trakkeur', 'expert', 'niveau', 'premier', 'classé', ' top ']) {
      expect(t).not.toContain(b);
    }
  });
  it('sous le plancher → label neutre', () => {
    expect(signatureText({ total_outings: 2 }, ['Écrins'])).toBe('lignée jeune');
  });
});

describe('Sceau — déterminisme, géométrie, absence d’ordre (O.2)', () => {
  it('seed déterministe et distinct par utilisateur', () => {
    expect(fieldSealSeed('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')).toBe(fieldSealSeed('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'));
    expect(fieldSealSeed('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')).not.toBe(fieldSealSeed('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'));
    expect(fieldSealSeed('x')).toBe(fieldSealSeed('x'));
  });
  it('géométrie (branches, amplitude) dérive STRICTEMENT du user_id (O.2)', () => {
    const u1 = 'user-alpha-123';
    const u2 = 'user-beta-456';
    const fewSig = { total_outings: 3, distinct_months: 1, total_km: 10, total_dplus_m: 300 };
    const manySig = { total_outings: 50, distinct_months: 8, total_km: 1200, total_dplus_m: 25000 };

    const g1 = sealGeometry(u1, fewSig);
    const g2 = sealGeometry(u1, manySig);
    // Même utilisateur -> même structure géométrique discrète
    expect(g1.branches).toBe(g2.branches);
    expect(g1.amplitude).toBe(g2.amplitude);
    // L'activité module uniquement la variable continue density
    expect(g2.density).toBeGreaterThan(g1.density);

    // Utilisateurs différents -> géométries potentiellement distinctes
    const gU2 = sealGeometry(u2, fewSig);
    expect(gU2.branches >= 3 && gU2.branches <= 9).toBe(true);
  });
  it('absence d’ordre : branches équilibrées (toujours 3..9, amplitude 1..5)', () => {
    for (const u of ['alice', 'bob', 'charlie', 'dave']) {
      expect(sealIsBalanced(sealGeometry(u, overFloor))).toBe(true);
    }
  });
});