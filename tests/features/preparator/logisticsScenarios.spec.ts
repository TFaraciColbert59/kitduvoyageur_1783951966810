import { describe, expect, it } from 'vitest';
import {
  LOGISTICS_VOLET_ORDER,
  activeLogisticsVolets,
  logisticsVoletsFor,
  type ActivityLogisticsScope,
  type LogisticsVolet,
} from '@/features/preparator/engine/activityCatalog';

/**
 * Les 4 scenarios de reference du chantier « 2 routes » (D-02, P2).
 *
 * Ils prouvent la REGLE METIER — `logistics_scope` ouvre exactement les bons
 * volets — par fixtures, conformement a D-13 : aucun seuil n'est abaisse pour
 * faire passer un scenario.
 */
interface Scenario {
  readonly id: string;
  readonly label: string;
  readonly scope: ActivityLogisticsScope;
  readonly expected: readonly LogisticsVolet[];
}

const SCENARIOS: readonly Scenario[] = [
  { id: 'footing', label: 'Footing court', scope: 'none', expected: [] },
  {
    id: 'hiking_day',
    label: 'Randonnee a la journee',
    scope: 'access',
    expected: ['access'],
  },
  {
    id: 'hiking_bivouac',
    label: 'Randonnee multi-jours en bivouac',
    scope: 'stages',
    expected: ['access', 'stages'],
  },
  {
    id: 'roadtrip_multi',
    label: 'Road trip multi-pays',
    scope: 'full',
    expected: ['access', 'stages', 'flights', 'vehicles', 'lodging', 'budget'],
  },
] as const;

function voletsOf(scenario: Scenario): LogisticsVolet[] {
  return LOGISTICS_VOLET_ORDER.filter((volet) => logisticsVoletsFor(scenario.scope)[volet]);
}

describe('scenarios logistics_scope', () => {
  it('couvre exactement les 4 scenarios de reference', () => {
    expect(SCENARIOS.map((scenario) => scenario.id)).toEqual([
      'footing',
      'hiking_day',
      'hiking_bivouac',
      'roadtrip_multi',
    ]);
  });

  it.each(SCENARIOS)('$id ouvre exactement les volets attendus', (scenario) => {
    expect(voletsOf(scenario)).toEqual([...scenario.expected]);
    expect(activeLogisticsVolets(scenario.scope)).toEqual([...scenario.expected]);
  });

  it('footing n ouvre aucun volet, et surtout aucun vol', () => {
    const footing = SCENARIOS[0];
    const volets = logisticsVoletsFor(footing.scope);
    expect(volets.flights).toBe(false);
    expect(volets.vehicles).toBe(false);
    expect(volets.lodging).toBe(false);
    expect(volets.budget).toBe(false);
    expect(activeLogisticsVolets(footing.scope)).toHaveLength(0);
  });

  it('roadtrip_multi ouvre vols, vehicules, hotellerie et budget', () => {
    const roadtrip = SCENARIOS[3];
    const volets = logisticsVoletsFor(roadtrip.scope);
    expect(volets.flights).toBe(true);
    expect(volets.vehicles).toBe(true);
    expect(volets.lodging).toBe(true);
    expect(volets.budget).toBe(true);
  });

  it('un bivouac n ouvre ni vol ni hotel : la nuit se fait sur place', () => {
    const bivouac = SCENARIOS[2];
    const volets = logisticsVoletsFor(bivouac.scope);
    expect(volets.stages).toBe(true);
    expect(volets.lodging).toBe(false);
    expect(volets.flights).toBe(false);
  });

  it('un scope inconnu retombe sur none : fail-closed, jamais sur full', () => {
    expect(activeLogisticsVolets('inconnu' as ActivityLogisticsScope)).toEqual([]);
    const fallback = logisticsVoletsFor('inconnu' as ActivityLogisticsScope);
    expect(fallback.flights).toBe(false);
    expect(fallback.budget).toBe(false);
  });

  it('chaque appel renvoie un objet neuf : la table de reference reste intacte', () => {
    const polluted: Record<string, boolean> = { ...logisticsVoletsFor('full') };
    polluted.flights = false;
    expect(logisticsVoletsFor('full').flights).toBe(true);
    expect(logisticsVoletsFor('full')).toEqual(logisticsVoletsFor('full'));
  });

  it('l ordre canonique est stable quel que soit l ordre de la table', () => {
    expect([...LOGISTICS_VOLET_ORDER]).toEqual([
      'access',
      'stages',
      'flights',
      'vehicles',
      'lodging',
      'budget',
    ]);
    expect(activeLogisticsVolets('full')).toEqual([...LOGISTICS_VOLET_ORDER]);
  });

  it('chaque scenario declare un scope coherent avec ses volets', () => {
    for (const scenario of SCENARIOS) {
      expect(scenario.expected.length).toBe(activeLogisticsVolets(scenario.scope).length);
      expect(scenario.label.length).toBeGreaterThan(0);
    }
  });
});
