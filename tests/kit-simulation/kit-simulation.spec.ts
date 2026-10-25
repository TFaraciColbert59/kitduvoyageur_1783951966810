import { describe, expect, it } from 'vitest';
import {
  optimize,
  requirements,
  waterPlan,
  pandolfWatts,
  shareMass,
  type Conditions,
  type Limits,
  type Option,
  type Requirement,
  type Result,
  type WaterSegment,
} from '@/features/kit-simulation/core';
import { fingerprint } from '@/features/kit-simulation/idempotency';
import { simulationRequest } from '@/features/kit-simulation/schema';
import { readBoundedJson } from '@/features/kit-simulation/requestBody';
import { adaptCandidates } from '@/features/kit-simulation/catalogAdapter';

// Provenance : porté de LKDV-reference tests/kit-simulation.test.cjs (33 tests,
// 45/45 TAP au total, Dossier Technique Maître Annexe C). Sémantique inchangée ;
// imports directs depuis src/ (plus de build dist).

const now = '2026-10-18T12:00:00Z';

const c: Conditions = {
  accommodation: 'hotel',
  cooking: false,
  naturalWater: false,
  minTempC: null,
  minimumPadR: null,
  coldMarginC: 3,
};

const l: Limits = {
  mode: 'balanced',
  budgetCents: 10000,
  packWeightG: 10000,
  packedVolumeMl: 50000,
  beamWidth: 64,
  candidatesPerSlot: 16,
};

function option(id = 'a', overrides: Partial<Option> = {}): Option {
  return {
    id,
    spec: {
      productId: '00000000-0000-4000-8000-000000000001',
      slot: 'pack',
      name: 'Fixture de test',
      weightG: 1000,
      volumeMl: 1000,
      comfortC: null,
      rValue: null,
      verified: true,
    },
    source: 'owned',
    priceCents: 0,
    currency: 'EUR',
    availableUnits: 1,
    validUntil: '2026-10-19T12:00:00Z',
    measuredWeightG: null,
    worn: false,
    ...overrides,
  };
}

const run = (
  opts: readonly Option[],
  req: readonly Requirement[] = [{ slot: 'pack', quantity: 1 }],
  cond: Conditions = c,
  lim: Limits = l,
  cons: number | null = 0
): Result => optimize(opts, req, cond, lim, now, cons);

describe('noyau kit-simulation', () => {
  it('un objet detenu garde sa masse', () => {
    expect(run([option()]).packWeightG).toBe(1000);
  });

  it('un poids mesure remplace le poids catalogue', () => {
    expect(run([option('a', { measuredWeightG: 1234 })]).packWeightG).toBe(1234);
  });

  it('quantites appliquees masse et prix', () => {
    const o = option('a', { source: 'new', priceCents: 50, availableUnits: 3 });
    const r = run([o], [{ slot: 'pack', quantity: 3 }]);
    expect(r.packWeightG).toBe(3000);
    expect(r.costCents).toBe(150);
  });

  it('poids inconnu jamais assimile a zero exact', () => {
    const o = option();
    o.spec.weightG = null;
    expect(run([o]).packWeightG).toBeNull();
  });

  it('consommables inconnus gardes inconnus', () => {
    expect(run([option()], undefined, c, l, null).packWeightG).toBeNull();
  });

  it('porté distinct du dos', () => {
    const r = run([option('a', { worn: true })]);
    expect(r.packWeightG).toBe(0);
    expect(r.wornWeightG).toBe(1000);
  });

  it('offre expiree rejetee', () => {
    expect(run([option('a', { validUntil: now })]).missing[0]).toBe('pack');
  });

  it('offre non verifiee rejetee', () => {
    const o = option();
    o.spec.verified = false;
    expect(run([o]).coverage).toBe('incomplete');
  });

  it('slot absent explicite', () => {
    expect(run([]).missing).toEqual(['pack']);
  });

  it('quantite indisponible rejetee', () => {
    expect(run([option()], [{ slot: 'pack', quantity: 2 }]).coverage).toBe('incomplete');
  });

  it('temperature insuffisante exclue', () => {
    const o = option();
    o.spec.slot = 'bag';
    o.spec.comfortC = 5;
    expect(run([o], [{ slot: 'bag', quantity: 1 }], { ...c, minTempC: 0 }).coverage).toBe('incomplete');
  });

  it('matelas inadequate exclu', () => {
    const o = option();
    o.spec.slot = 'pad';
    o.spec.rValue = 2;
    expect(run([o], [{ slot: 'pad', quantity: 1 }], { ...c, minimumPadR: 4 }).coverage).toBe('incomplete');
  });

  it('ordre entree sans effet', () => {
    const a = option('a');
    const b = option('b');
    expect(run([a, b])).toEqual(run([b, a]));
  });

  it('depassement prefere non masque', () => {
    expect(run([option()], undefined, c, { ...l, packWeightG: 100 }).constraintStatus).toBe('exceeded');
  });

  it('les commissions ne sont pas une entree du schema', () => {
    expect(simulationRequest.safeParse({ commission: 99 }).success).toBe(false);
  });

  it('aucun calcul descente Pandolf', () => {
    expect(pandolfWatts(70, 10, 1, -5, 1)).toBeNull();
  });

  it('Pandolf cas plat connu 228.2653 watts', () => {
    expect(pandolfWatts(70, 10, 1, 0, 1)).toBeCloseTo(228.26530612244898, 9);
  });

  it('unites corporelles invalides refusees', () => {
    expect(() => pandolfWatts(0, 10, 1, 0, 1)).toThrow();
  });

  it('eau deux segments sans ravitaillement : conservation', () => {
    const r = waterPlan([
      { id: 'a', walkingHours: 2, litersPerHour: 0.5, cookingMl: 0, reserveMl: 300, reliableRefillAtEnd: false },
      { id: 'b', walkingHours: 2, litersPerHour: 0.5, cookingMl: 200, reserveMl: 300, reliableRefillAtEnd: true },
    ]);
    expect(r.departuresMl.a).toBe(2500);
    expect(r.departuresMl.b).toBe(1500);
  });

  it('eau apres ravitaillement distincte', () => {
    const s = (id: string): WaterSegment => ({
      id,
      walkingHours: 2,
      litersPerHour: 0.5,
      cookingMl: 0,
      reserveMl: 0,
      reliableRefillAtEnd: true,
    });
    expect(waterPlan([s('a'), s('b')]).maxCarriedMl).toBe(1000);
  });

  it('eau sans duree reste inconnue', () => {
    const r = waterPlan([
      { id: 'a', walkingHours: null, litersPerHour: 0.5, cookingMl: 0, reserveMl: 0, reliableRefillAtEnd: false },
    ]);
    expect(r.maxCarriedMl).toBeNull();
  });

  it('partage groupe conserve tous les grammes', () => {
    for (let mass = 0; mass < 1000; mass++) {
      expect(Object.values(shareMass(mass, ['b', 'a', 'c'])).reduce((x, y) => x + y, 0)).toBe(mass);
    }
  });

  it('partage stable par identite', () => {
    expect(shareMass(7, ['b', 'a'])).toEqual(shareMass(7, ['a', 'b']));
  });

  it('hash objet canonique', () => {
    expect(fingerprint({ a: 1, b: 2 })).toBe(fingerprint({ b: 2, a: 1 }));
  });

  it('hash varie quand contenu change', () => {
    expect(fingerprint({ a: 1 })).not.toBe(fingerprint({ a: 2 }));
  });

  it('requete JSON strictement bornee', async () => {
    await expect(
      readBoundedJson(
        new Request('https://local.test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '{"x":"long"}',
        }),
        3
      )
    ).rejects.toThrow();
  });

  it('media type obligatoire', async () => {
    await expect(
      readBoundedJson(new Request('https://local.test', { method: 'POST', body: '{}' }))
    ).rejects.toThrow();
  });

  it('lecture JSON correcte', async () => {
    expect(
      await readBoundedJson(
        new Request('https://local.test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '{"x":1}',
        })
      )
    ).toEqual({ x: 1 });
  });

  it('hotel sans abri ni matelas', () => {
    expect(requirements(c).some((r) => r.slot === 'shelter' || r.slot === 'pad')).toBe(false);
  });

  it('tarp inclut protection et matelas', () => {
    expect(requirements({ ...c, accommodation: 'tarp' }).some((r) => r.slot === 'pad')).toBe(true);
  });

  it('aucune offre dupliquee', () => {
    expect(() => run([option(), option()])).toThrow();
  });

  it('adaptateur refuse lignes mal formees', () => {
    expect(() => adaptCandidates([{ commission: 9 }])).toThrow();
  });

  it('recherche bornee', () => {
    expect(() => run([option()], undefined, c, { ...l, beamWidth: 5000 })).toThrow();
  });
});
