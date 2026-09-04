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

describe('signatureText — vocabulaire descriptif', () => {
  it('phrase descriptive : « seize sorties, cinq saisons, Écrins, Ariège, Vercors »', () => {
    const t = signatureText(overFloor, ['Écrins', 'Ariège', 'Vercors']);
    expect(t).toContain('seize sorties');
    expect(t).toContain('cinq saisons');
    expect(t).toContain('Écrins, Ariège et Vercors');
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

describe('Sceau — déterminisme, géométrie, absence d’ordre', () => {
  it('seed déterministe et distinct par utilisateur', () => {
    expect(fieldSealSeed('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')).toBe(fieldSealSeed('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'));
    expect(fieldSealSeed('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')).not.toBe(fieldSealSeed('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'));
    expect(fieldSealSeed('x')).toBe(fieldSealSeed('x'));
  });
  it('géométrie stable pour une même empreinte', () => {
    expect(sealGeometry(overFloor)).toEqual(sealGeometry(overFloor));
  });
  it('géométrie modulée par l’empreinte (plus de saisons → plus de branches)', () => {
    const few = sealGeometry({ total_outings: 3, distinct_months: 1, total_km: 20, total_dplus_m: 300 });
    const many = sealGeometry({ total_outings: 30, distinct_months: 8, total_km: 600, total_dplus_m: 12000 });
    expect(many.branches).toBeGreaterThanOrEqual(few.branches);
  });
  it('absence d’ordre : branches équilibrées (toujours 3..9, pas de dominance)', () => {
    for (const sig of [overFloor, { total_outings: 3 }, null]) {
      expect(sealIsBalanced(sealGeometry(sig))).toBe(true);
    }
  });
  it('ses empreintes distinctes ne diffèrent pas par un ordre de taille (différencie, ne hiérarchise pas)', () => {
    // Deux utilisateurs aux empreintes différentes doivent produire des seeds/géométries
    // non identiques (unicité perceptible) sans jamais introduire un axe « plus haut que ».
    const g1 = sealGeometry(overFloor);
    const g2 = sealGeometry({ total_outings: 30, distinct_months: 9, total_km: 4, total_dplus_m: 200 });
    expect(g1).not.toEqual(g2);
  });
});