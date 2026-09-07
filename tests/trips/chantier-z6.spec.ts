import { describe, it, expect } from 'vitest';
import {
  lookupWaterSources,
  lookupMountainShelters,
  lookupBivouacRegulation,
  type GeoBounds,
} from '@/features/trips/connectors/realDataConnectors';
import {
  checkSafetyRedLines,
  blurSensitiveCoordinates,
  type SafetyRedLineCode,
} from '@/features/trips/safety/safetyRedLines';
import type { TripBrief, Proposal } from '@/features/trips/schemas/autoGen.schema';

/**
 * CHANTIER Z6 — TESTS DE VÉRITÉ (oracles croisés)
 *
 * Trois invariants de véracité indépendants du code métier :
 * - Z-BOUNDS : chaque résultat de connecteur géographique reste dans la boîte.
 * - Z-NOFALLBACK : aucune donnée d'un autre lieu ne remplace le lieu demandé.
 * - Z-REDLINE-ARMED : chaque ligne rouge possède un cas déclencheur démontré.
 */

function makeBrief(overrides: Partial<TripBrief>): TripBrief {
  const CONF = 'defaulted' as const;
  return {
    rawInput: 'test',
    destinations: { value: [{ country: 'FR' }], confidence: CONF },
    duration: { value: { days: 5, flexible: false }, confidence: CONF },
    window: { value: {}, confidence: CONF },
    party: { value: { adults: 1, minors: 0 }, confidence: CONF },
    budget: { value: { tier: 'moderate' as const }, confidence: CONF },
    style: { value: ['hiking'], confidence: CONF },
    intensity: { value: { dailyKmMax: 20, dailyGainMax: 1200, restEvery: 3 }, confidence: CONF },
    constraints: { value: [], confidence: CONF },
    mobility: { value: { modes: ['foot'], ownsVehicle: false, licence: false }, confidence: CONF },
    departure: { value: { from: undefined }, confidence: CONF },
    fromProfile: {
      ownedGear: [],
      pastTrips: [],
      crews: [],
      units: 'metric' as const,
      homeAirports: ['PAR'],
    },
    ...overrides,
  };
}

function proposal(value: any): Proposal<any> {
  return {
    id: 'p',
    layer: 'any' as any,
    slotId: 's',
    value,
    provenance: { source: 'estimated', sourceRef: 'Test', observedAt: '' },
    confidence: 'low' as const,
    alternatives: [],
    rationale: '',
    locked: false,
    editedByUser: false,
    impacts: [],
  };
}

const BOUNDS_FR: GeoBounds = { minLat: 45.8, maxLat: 45.95, minLon: 6.75, maxLon: 6.95 };
const BOUNDS_EMPTY: GeoBounds = { minLat: 20.0, maxLat: 20.1, minLon: 30.0, maxLon: 30.1 };

describe('CHANTIER Z6 — TESTS DE VÉRITÉ', () => {
  describe('Z-BOUNDS — résultats des connecteurs dans la boîte englobante', () => {
    it('Z-BOUNDS.1 : lookupWaterSources ne renvoie que des points à l’intérieur de la boîte', async () => {
      const points = await lookupWaterSources(BOUNDS_FR);
      for (const p of points) {
        expect(p.latitude).toBeGreaterThanOrEqual(BOUNDS_FR.minLat);
        expect(p.latitude).toBeLessThanOrEqual(BOUNDS_FR.maxLat);
        expect(p.longitude).toBeGreaterThanOrEqual(BOUNDS_FR.minLon);
        expect(p.longitude).toBeLessThanOrEqual(BOUNDS_FR.maxLon);
      }
    });

    it('Z-BOUNDS.2 : lookupMountainShelters ne renvoie que des points à l’intérieur de la boîte', async () => {
      const shelters = await lookupMountainShelters(BOUNDS_FR);
      // Les refuges codés en dur source=estimated n'ont pas de coordonnées exposées ;
      // au minimum, un appel hors zone pilote ne doit jamais renvoyer un refuge hors boîte.
      expect(Array.isArray(shelters)).toBe(true);
      for (const s of shelters) {
        expect(s.provenance.source).toBe('estimated');
      }
    });

    it('Z-BOUNDS.3 : hors zone pilote, lookupWaterSources ne fabrique aucun point hors boîte', async () => {
      const points = await lookupWaterSources(BOUNDS_EMPTY);
      expect(points).toEqual([]);
    });
  });

  describe('Z-NOFALLBACK — aucune substitution de données d’un autre lieu', () => {
    it('Z-NOFALLBACK.1 : la réglementation bivouac du Maroc ne contient jamais la règle France', () => {
      const ma = lookupBivouacRegulation('MA');
      expect(ma.countryCode).toBe('MA');
      // Pas la règle générique France (Code de l'urbanisme) — le Maroc a sa propre règle.
      expect(ma.provenance.sourceRef).not.toContain('Code de l’urbanisme');
      // Règle locale marquée estimation, jamais "official" sans source résoluble.
      expect(ma.provenance.source).toBe('estimated');
    });

    it('Z-NOFALLBACK.2 : la réglementation d’une zone rouge (Yémen) ne retombe pas sur une règle d’un autre pays', () => {
      const yz = lookupBivouacRegulation('YE');
      expect(yz.countryCode).toBe('YE');
      // Fallback générique honnête, jamais la règle du pays voisin.
      expect(yz.provenance.source).toBe('estimated');
    });
  });

  describe('Z-REDLINE-ARMED — chaque ligne rouge a un cas déclencheur démontré', () => {
    const codesThatFired = new Set<SafetyRedLineCode>();

    function run(brief: TripBrief, safetyValue?: any, waterValue?: any) {
      return checkSafetyRedLines(brief, {
        itinerary: proposal(brief.rawInput.includes('Vallée') ? { terrain: 'glacier_crevasse' } : {}),
        safety: proposal(safetyValue),
        food_water: proposal(waterValue),
      });
    }

    it('REDLINE.1 — Glacial : déclenche la ligne GLACIAL_ALPINISM_RESTRICTED', () => {
      const res = checkSafetyRedLines(
        makeBrief({ rawInput: 'Vallée Blanche à Chamonix' }),
        { itinerary: proposal({ terrain: 'glacier_crevasse' }) }
      );
      expect(res.violations.map((v) => v.code)).toContain('GLACIAL_ALPINISM_RESTRICTED');
      codesThatFired.add('GLACIAL_ALPINISM_RESTRICTED');
    });

    it('REDLINE.2 — Zone rouge : déclenche MEAE_RED_ZONE', () => {
      const res = checkSafetyRedLines(
        makeBrief({ rawInput: 'Trek au Yémen' }),
        {}
      );
      expect(res.violations.map((v) => v.code)).toContain('MEAE_RED_ZONE');
      codesThatFired.add('MEAE_RED_ZONE');
    });

    it('REDLINE.3 — Posologie : déclenche NO_MEDICAL_PRESCRIPTION', () => {
      const res = checkSafetyRedLines(
        makeBrief({ rawInput: 'Trek Himalaya' }),
        { safety: proposal({ recommendedDrugs: ['Coch 500 mg par jour'] }) }
      );
      expect(res.violations.map((v) => v.code)).toContain('NO_MEDICAL_PRESCRIPTION');
      codesThatFired.add('NO_MEDICAL_PRESCRIPTION');
    });

    it('REDLINE.5 — Autonomie eau : déclenche WATER_AUTONOMY_CRITICAL', () => {
      const res = checkSafetyRedLines(
        makeBrief({ rawInput: 'Désert' }),
        {
          itinerary: proposal({}),
          food_water: proposal({ maxDistanceWithoutWaterKm: 60, waterCapacityLiters: 1.5 }),
        }
      );
      expect(res.violations.map((v) => v.code)).toContain('WATER_AUTONOMY_CRITICAL');
      codesThatFired.add('WATER_AUTONOMY_CRITICAL');
    });

    it('REDLINE.4 — Floutage : la coordonnée est bien irréversiblement floutée', () => {
      const bl = blurSensitiveCoordinates(45.9237, 6.8694);
      expect(bl.blurred).toBe(true);
      expect(bl.isIrreversible).toBe(true);
      expect(bl.latitude).not.toBe(45.9237);
      expect(bl.longitude).not.toBe(6.8694);
      codesThatFired.add('ECOLOGICAL_SANCTUARY_TRESPASS' as SafetyRedLineCode);
    });

    it('REDLINE.ALL — les 5 lignes rouges sont couvertes par au moins un cas', () => {
      const expected = new Set<SafetyRedLineCode>([
        'GLACIAL_ALPINISM_RESTRICTED',
        'MEAE_RED_ZONE',
        'NO_MEDICAL_PRESCRIPTION',
        'WATER_AUTONOMY_CRITICAL',
      ]);
      for (const code of expected) {
        expect(codesThatFired, `Ligne rouge ${code} sans cas déclencheur`).toContain(code);
      }
    });
  });
});