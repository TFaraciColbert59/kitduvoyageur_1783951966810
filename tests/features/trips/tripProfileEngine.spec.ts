import { describe, it, expect } from 'vitest';
import {
  deriveTripProfile,
  deriveScale,
  deriveParty,
  getProfileBadgeLabel,
} from '@/features/trips/engine/tripProfileEngine';
import type { TripFull } from '@/features/trips/types/trip.types';

/**
 * Y1.1 — Tests du moteur de profil (chantier Y), ÉCRITS AVANT L'IMPLÉMENTATION.
 * Source de vérité : docs/Y_HUB_SPEC.md §4 (matrice) + unification.md §2.3.
 * L'horloge est injectée (aucun Date.now dans le moteur).
 */

const NOW = new Date('2026-06-01T09:00:00Z');

/** Fabrique un TripFull minimal valide, surchargeable par test. */
function mkTrip(overrides: Partial<TripFull> = {}): TripFull {
  return {
    id: 't-1',
    slug: 't-1',
    title: 'Voyage test',
    description: null,
    destination_country_code: 'FR',
    destination_name: 'France',
    start_date: '2026-06-10',
    end_date: '2026-06-13',
    status: 'planned',
    visibility: 'private',
    difficulty: 'moderate',
    primary_activity: 'trekking',
    estimated_budget: 500,
    budget_currency: 'EUR',
    cover_image_url: null,
    user_id: 'u-1',
    group_id: null,
    share_token: null,
    metadata: {},
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    collaborators: [],
    steps: [],
    items: [],
    expenses: [],
    documents: [],
    pois: [],
    safety_checkpoints: [],
    notes: [],
    user_role: 'owner',
    permissions: {
      canEdit: true,
      canDelete: true,
      canInvite: true,
      canManageBudget: true,
      canViewDocuments: true,
    },
    ...overrides,
  } as TripFull;
}

/** Durée en jours calendaires d'un trip de test. */
function tripWithDuration(days: number): TripFull {
  const start = new Date('2026-06-10T00:00:00Z');
  const end = new Date(start.getTime() + (days - 1) * 86400000);
  return mkTrip({
    start_date: start.toISOString().slice(0, 10),
    end_date: end.toISOString().slice(0, 10),
  });
}

const S = {
  overview: 'overview',
  itinerary: 'itinerary',
  gear: 'gear',
  team: 'team',
  budget: 'budget',
  docs: 'docs',
  checklist: 'checklist',
  safety: 'safety',
  journal: 'journal',
  export: 'export',
} as const;

const BASE_SOLO_DAY = [S.overview, S.itinerary, S.gear, S.safety];

describe('Y1 — deriveTripProfile : échelles (bornes exactes)', () => {
  it('1 jour → day', () => {
    expect(tripWithDuration(1) && deriveTripProfile(tripWithDuration(1), NOW).scale).toBe('day');
  });
  it('2 jours → short', () => {
    expect(deriveTripProfile(tripWithDuration(2), NOW).scale).toBe('short');
  });
  it('4 jours → short (borne haute)', () => {
    expect(deriveTripProfile(tripWithDuration(4), NOW).scale).toBe('short');
  });
  it('5 jours → long (borne basse)', () => {
    expect(deriveTripProfile(tripWithDuration(5), NOW).scale).toBe('long');
  });
  it('14 jours → long (borne haute)', () => {
    expect(deriveTripProfile(tripWithDuration(14), NOW).scale).toBe('long');
  });
  it('15 jours → expedition (borne basse)', () => {
    expect(deriveTripProfile(tripWithDuration(15), NOW).scale).toBe('expedition');
  });
});

describe('Y1 — hasDates et cas limites de dates', () => {
  it('sans dates → hasDates false, échelle prudente short', () => {
    const p = deriveTripProfile(mkTrip({ start_date: null, end_date: null }), NOW);
    expect(p.hasDates).toBe(false);
    expect(p.scale).toBe('short');
  });
  it('start seule (sans end) → hasDates false', () => {
    const p = deriveTripProfile(mkTrip({ end_date: null }), NOW);
    expect(p.hasDates).toBe(false);
  });
  it('end seule (sans start) → hasDates false', () => {
    const p = deriveTripProfile(mkTrip({ start_date: null }), NOW);
    expect(p.hasDates).toBe(false);
  });
  it('end < start → dates invalides → hasDates false, échelle short', () => {
    const p = deriveTripProfile(
      mkTrip({ start_date: '2026-06-20', end_date: '2026-06-10' }),
      NOW
    );
    expect(p.hasDates).toBe(false);
    expect(p.scale).toBe('short');
  });
  it('sans dates → hasDates false (aucun impact rail : déroulé conditionné aux étapes)', () => {
    const p = deriveTripProfile(mkTrip({ start_date: null, end_date: null }), NOW);
    expect(p.widgets).toEqual([]);
  });
});

describe('Y1 — party et collaboration', () => {
  it('0 collaborateur → solo, isCollaborative false', () => {
    const p = deriveTripProfile(mkTrip(), NOW);
    expect(p.party).toBe('solo');
    expect(p.isCollaborative).toBe(false);
  });
  it('1 collaborateur → duo, isCollaborative true', () => {
    const trip = mkTrip({
      collaborators: [{ id: 'c1', trip_id: 't-1', user_id: 'u-2', role: 'editor', joined_at: '2026-01-01T00:00:00Z' }],
    } as Partial<TripFull>);
    const p = deriveTripProfile(trip, NOW);
    expect(p.party).toBe('duo');
    expect(p.isCollaborative).toBe(true);
  });
  it('2 collaborateurs → group', () => {
    const trip = mkTrip({
      collaborators: [
        { id: 'c1', trip_id: 't-1', user_id: 'u-2', role: 'editor', joined_at: '2026-01-01T00:00:00Z' },
        { id: 'c2', trip_id: 't-1', user_id: 'u-3', role: 'viewer', joined_at: '2026-01-01T00:00:00Z' },
      ],
    } as Partial<TripFull>);
    expect(deriveTripProfile(trip, NOW).party).toBe('group');
  });
  it('group_id présent sans collaborateur → isCollaborative true', () => {
    const trip = mkTrip({ group_id: 'g-1' } as Partial<TripFull>);
    const p = deriveTripProfile(trip, NOW);
    expect(p.isCollaborative).toBe(true);
    expect(p.party).toBe('solo'); // aucun participant réel
  });
});

describe('Y1 — autonomie (activité + difficulté)', () => {
  it('cultural → serviced', () => {
    expect(deriveTripProfile(mkTrip({ primary_activity: 'cultural' }), NOW).autonomy).toBe('serviced');
  });
  it('difficulty easy → serviced (quelle que soit l’activité)', () => {
    expect(deriveTripProfile(mkTrip({ difficulty: 'easy', primary_activity: 'hiking' }), NOW).autonomy).toBe('serviced');
  });
  it('bivouac → autonomous', () => {
    expect(deriveTripProfile(mkTrip({ primary_activity: 'bivouac', difficulty: 'moderate' }), NOW).autonomy).toBe('autonomous');
  });
  it('bushcraft → autonomous', () => {
    expect(deriveTripProfile(mkTrip({ primary_activity: 'bushcraft', difficulty: 'moderate' }), NOW).autonomy).toBe('autonomous');
  });
  it('trekking hard → autonomous', () => {
    expect(deriveTripProfile(mkTrip({ primary_activity: 'trekking', difficulty: 'hard' }), NOW).autonomy).toBe('autonomous');
  });
  it('trekking moderate → semi', () => {
    expect(deriveTripProfile(mkTrip({ primary_activity: 'trekking', difficulty: 'moderate' }), NOW).autonomy).toBe('semi');
  });
  it('roadtrip moderate → semi', () => {
    expect(deriveTripProfile(mkTrip({ primary_activity: 'roadtrip', difficulty: 'moderate' }), NOW).autonomy).toBe('semi');
  });
});

describe('Y1 — matrice profil × sections (8 combinaisons)', () => {
  /** Construit un trip pour une case de la matrice. */
  function matrixTrip(scale: string, party: 'solo' | 'group', activity = 'trekking') {
    const days = ({ day: 1, short: 3, long: 9, expedition: 18 } as Record<string, number>)[scale];
    const trip = tripWithDuration(days);
    return mkTrip({
      ...trip,
      slug: `y-${scale}-${party}`,
      primary_activity: activity as TripFull['primary_activity'],
      estimated_budget: party === 'group' ? 800 : null,
      collaborators:
        party === 'group'
          ? ([
              { id: 'c1', trip_id: 't-1', user_id: 'u-2', role: 'editor', joined_at: '2026-01-01T00:00:00Z' },
              { id: 'c2', trip_id: 't-1', user_id: 'u-3', role: 'viewer', joined_at: '2026-01-01T00:00:00Z' },
            ] as TripFull['collaborators'])
          : [],
    } as Partial<TripFull>);
  }

  const CASES: Array<[string, 'solo' | 'group', string[]]> = [
    ['day', 'solo', ['overview', 'itinerary', 'gear', 'safety']],
    ['day', 'group', ['overview', 'itinerary', 'gear', 'team', 'checklist', 'safety', 'export']],
    ['short', 'solo', ['overview', 'itinerary', 'gear', 'checklist', 'safety', 'export']],
    ['short', 'group', ['overview', 'itinerary', 'gear', 'team', 'budget', 'checklist', 'safety', 'export']],
    ['long', 'solo', ['overview', 'itinerary', 'gear', 'budget', 'docs', 'checklist', 'safety', 'journal', 'export']],
    ['long', 'group', ['overview', 'itinerary', 'gear', 'team', 'budget', 'docs', 'checklist', 'safety', 'journal', 'export']],
    ['expedition', 'solo', ['overview', 'itinerary', 'gear', 'budget', 'docs', 'checklist', 'safety', 'journal', 'export']],
    ['expedition', 'group', ['overview', 'itinerary', 'gear', 'team', 'budget', 'docs', 'checklist', 'safety', 'journal', 'export']],
  ];

  for (const [scale, party, expected] of CASES) {
    it(`matrice ${scale}/${party} → ${expected.length} sections dans l’ordre du registre`, () => {
      expect(deriveTripProfile(matrixTrip(scale, party), NOW).sections).toEqual(expected);
    });
  }

  it('safety est toujours affichée, y compris day/solo', () => {
    expect(deriveTripProfile(matrixTrip('day', 'solo'), NOW).sections).toContain('safety');
  });

  it('chaque décision de section porte sa raison (traçabilité)', () => {
    const p = deriveTripProfile(matrixTrip('day', 'solo'), NOW);
    for (const id of ['overview', 'itinerary', 'gear', 'safety'] as const) {
      expect(typeof p.reason[id]).toBe('string');
      expect(p.reason[id].length).toBeGreaterThan(0);
    }
    expect(typeof p.reason.budget).toBe('string'); // section masquée aussi tracée
  });
});

describe('Y1 — modulations par activité', () => {
  function withActivity(activity: TripFull['primary_activity'], scale = 'day', party: 'solo' | 'group' = 'solo') {
    const days = ({ day: 1, short: 3, long: 9, expedition: 18 } as Record<string, number>)[scale];
    const t = tripWithDuration(days);
    return mkTrip({
      ...t,
      slug: `y-${scale}-${party}`,
      primary_activity: activity,
      estimated_budget: party === 'group' ? 800 : null,
      collaborators:
        party === 'group'
          ? ([
              { id: 'c1', trip_id: 't-1', user_id: 'u-2', role: 'editor', joined_at: '2026-01-01T00:00:00Z' },
              { id: 'c2', trip_id: 't-1', user_id: 'u-3', role: 'viewer', joined_at: '2026-01-01T00:00:00Z' },
            ] as TripFull['collaborators'])
          : [],
    } as Partial<TripFull>);
  }

  it('roadtrip force la section budget (même day/solo)', () => {
    const p = deriveTripProfile(withActivity('roadtrip'), NOW);
    expect(p.sections).toContain('budget');
  });
  it('cultural : rail inchangé (déroulé du jour seul, indépendant de l’activité)', () => {
    const long = tripWithDuration(9);
    const p = deriveTripProfile(mkTrip({ ...long, primary_activity: 'cultural' }), NOW);
    expect(p.autonomy).toBe('serviced');
  });
  it('mixed suit sa matrice d’échelle (long/solo)', () => {
    const t = tripWithDuration(9);
    const p = deriveTripProfile(mkTrip({ ...t, primary_activity: 'mixed', estimated_budget: 300 }), NOW);
    expect(p.sections).toEqual([
      'overview', 'itinerary', 'gear', 'budget', 'docs', 'checklist', 'safety', 'journal', 'export',
    ]);
  });
  it('bushcraft : rail inchangé (déroulé du jour seul)', () => {
    const t = tripWithDuration(9);
    const p = deriveTripProfile(mkTrip({ ...t, primary_activity: 'bushcraft' }), NOW);
    expect(p.autonomy).toBe('autonomous');
  });
});

describe('Y1 — widgets (rail sortie = déroulé du jour uniquement)', () => {
  it('day/solo minimal sans étapes : rail vide', () => {
    const t = tripWithDuration(1);
    const p = deriveTripProfile(mkTrip({ ...t, estimated_budget: null }), NOW);
    expect(p.widgets).toEqual([]);
  });
  it('avec étapes → steps-timeline seul widget du rail', () => {
    const trip = mkTrip({ steps: [{ id: 's1' } as TripFull['steps'][number]] });
    const p = deriveTripProfile(trip, NOW);
    expect(p.widgets).toEqual(['steps-timeline']);
  });
  it('rail identique quel que soit le profil (day/long, solo/group)', () => {
    const step = { id: 's1' } as TripFull['steps'][number];
    const t = tripWithDuration(1);
    const day = deriveTripProfile(mkTrip({ ...t, estimated_budget: null, steps: [step] }), NOW);
    const long = deriveTripProfile(
      mkTrip({ ...tripWithDuration(9), estimated_budget: null, steps: [step] }),
      NOW
    );
    expect(day.widgets).toEqual(['steps-timeline']);
    expect(long.widgets).toEqual(['steps-timeline']);
  });
  it('sans étapes → steps-timeline absent', () => {
    const p = deriveTripProfile(mkTrip(), NOW);
    expect(p.widgets).not.toContain('steps-timeline');
  });
  it('sans pays → rail inchangé (pays ne pilote plus de widget)', () => {
    const p = deriveTripProfile(mkTrip({ destination_country_code: null }), NOW);
    expect(p.widgets).toEqual([]);
  });
  it('budget à 0 → hasBudget false', () => {
    const p = deriveTripProfile(mkTrip({ estimated_budget: 0 }), NOW);
    expect(p.hasBudget).toBe(false);
  });
});

describe('Y1 — cas limites divers', () => {
  it('toutes permissions fausses → sections de base inchangées (les permissions filtrent à l’affichage)', () => {
    const trip = mkTrip({
      ...tripWithDuration(1),
      permissions: { canEdit: false, canDelete: false, canInvite: false, canManageBudget: false, canViewDocuments: false },
    });
    const p = deriveTripProfile(trip, NOW);
    expect(p.sections).toEqual(BASE_SOLO_DAY);
  });
  it('status cancelled → sections réduites à overview', () => {
    const p = deriveTripProfile(mkTrip({ status: 'cancelled' }), NOW);
    expect(p.sections).toEqual(['overview']);
  });
  it('status cancelled → widgets réduits (rail vide)', () => {
    const p = deriveTripProfile(mkTrip({ status: 'cancelled' }), NOW);
    expect(p.widgets).toEqual([]);
  });
  it('density compact si day, comfortable sinon', () => {
    expect(deriveTripProfile(tripWithDuration(1), NOW).density).toBe('compact');
    expect(deriveTripProfile(tripWithDuration(3), NOW).density).toBe('comfortable');
  });
  it('hasDates true quand les dates sont valides', () => {
    expect(deriveTripProfile(tripWithDuration(3), NOW).hasDates).toBe(true);
  });
  it('activity reflète l’activité du voyage', () => {
    expect(deriveTripProfile(mkTrip({ primary_activity: 'bushcraft' }), NOW).activity).toBe('bushcraft');
  });
});

describe('Y5.1 — Aides de profil dérivé pour cartes et filtres', () => {
  it('deriveScale calcule correctement les 4 échelles', () => {
    expect(deriveScale('2026-06-01', '2026-06-01')).toBe('day');
    expect(deriveScale('2026-06-01', '2026-06-03')).toBe('short');
    expect(deriveScale('2026-06-01', '2026-06-09')).toBe('long');
    expect(deriveScale('2026-06-01', '2026-06-25')).toBe('expedition');
    expect(deriveScale(null, null)).toBe('short');
  });

  it('deriveParty calcule correctement solo, duo et groupe', () => {
    expect(deriveParty(0)).toBe('solo');
    expect(deriveParty(1)).toBe('solo');
    expect(deriveParty(2)).toBe('duo');
    expect(deriveParty(4)).toBe('group');
    expect(deriveParty(undefined)).toBe('solo');
  });

  it('getProfileBadgeLabel génère le libellé composé', () => {
    expect(getProfileBadgeLabel('day', 'solo')).toBe('Journée · Solo');
    expect(getProfileBadgeLabel('long', 'group')).toBe('Itinérance · Groupe');
    expect(getProfileBadgeLabel('expedition', 'solo')).toBe('Expédition · Solo');
    expect(getProfileBadgeLabel('short', 'duo')).toBe('Court séjour · Duo');
  });
});

describe('Y2.4 — TripSectionPicker : sections manuellement activées', () => {
  it('active une section masquée par le profil si présente dans metadata.enabled_sections', () => {
    const trip = mkTrip({
      start_date: '2026-06-01',
      end_date: '2026-06-01',
      collaborators: [],
      metadata: { enabled_sections: ['budget'] },
    });
    const p = deriveTripProfile(trip, NOW);
    expect(p.sections).toContain('budget');
    expect(p.reason.budget).toContain('activé manuellement (TripSectionPicker)');
  });

  it('ne réactive pas les sections si le voyage est annulé', () => {
    const trip = mkTrip({
      status: 'cancelled',
      metadata: { enabled_sections: ['budget', 'gear'] },
    });
    const p = deriveTripProfile(trip, NOW);
    expect(p.sections).toEqual(['overview']);
  });
});
