import { describe, it, expect } from 'vitest';
import {
  deriveHubProfile,
  mergeEnabledSections,
  HUB_SECTION_ORDER,
  type HubAdventureInput,
} from '@/features/hub/engine/hubProfileEngine';
import type { TripFull } from '@/features/trips/types/trip.types';

/**
 * H1.1 — Tests du moteur de profil hub (chantier H), ÉCRITS AVANT L'IMPLÉMENTATION.
 * Source de vérité : docs/CHANTIER_H_HUB_VOYAGEUR.md §2.2.
 * Règle d'or : composition de deriveTripProfile pour sortie, jamais duplication.
 */

const NOW = new Date('2026-06-01T09:00:00Z');

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

function possession(overrides = {}): HubAdventureInput {
  return {
    kind: 'possession',
    itemsCount: 12,
    loansCount: 0,
    alertsCount: 0,
    hasDepartEnCours: false,
    ...overrides,
  };
}

describe('H1 — deriveHubProfile : nature possession', () => {
  it('POS-1: inventaire + kit toujours présents, scale null, party solo', () => {
    const p = deriveHubProfile(possession({ itemsCount: 0 }), NOW);
    expect(p.nature).toBe('possession');
    expect(p.sections).toEqual(['inventaire', 'kit']);
    expect(p.scale).toBeNull();
    expect(p.party).toBe('solo');
    expect(p.density).toBe('comfortable');
  });

  it('POS-2: preparation ajoutée si items présents', () => {
    const p = deriveHubProfile(possession({ itemsCount: 5 }), NOW);
    expect(p.sections).toEqual(['inventaire', 'kit', 'preparation', 'oublis']);
  });

  it('POS-3: depart ajouté si départ en cours', () => {
    const p = deriveHubProfile(possession({ hasDepartEnCours: true }), NOW);
    expect(p.sections).toContain('depart');
  });

  it('POS-4: disponibilite ajoutée si prêts en cours', () => {
    const p = deriveHubProfile(possession({ loansCount: 2 }), NOW);
    expect(p.sections).toContain('disponibilite');
  });

  it('POS-5: alertes ajoutées si alertes matériel', () => {
    const p = deriveHubProfile(possession({ alertsCount: 3 }), NOW);
    expect(p.sections).toContain('alertes');
  });

  it('POS-6: possession pure = aucun itinéraire ni budget', () => {
    const p = deriveHubProfile(
      possession({ itemsCount: 9, loansCount: 1, alertsCount: 1, hasDepartEnCours: true }),
      NOW,
    );
    expect(p.sections).not.toContain('itinerary');
    expect(p.sections).not.toContain('budget');
    expect(p.sections).toEqual(['inventaire', 'kit', 'preparation', 'depart', 'disponibilite', 'alertes', 'oublis']);
  });

  it('POS-7: widgets = stock toujours, alertes/dispo/depart sous condition', () => {
    const vide = deriveHubProfile(possession({ itemsCount: 0 }), NOW);
    expect(vide.widgets).toEqual(['stock-apercu']);
    const plein = deriveHubProfile(
      possession({ alertsCount: 1, loansCount: 1, hasDepartEnCours: true }),
      NOW,
    );
    expect(plein.widgets).toEqual(['alertes-materiel', 'prochain-depart', 'stock-apercu', 'dispo-apercu']);
  });

  it('POS-8: reason tracé pour chaque section (présence ET absence)', () => {
    const p = deriveHubProfile(possession({ itemsCount: 0 }), NOW);
    expect(Object.keys(p.reason).sort()).toEqual([...HUB_SECTION_ORDER].sort());
    expect(p.reason.inventaire).toMatch(/affiché/);
    expect(p.reason.alertes).toMatch(/masqué/);
    expect(p.reason.itinerary).toMatch(/possession/);
  });
});

describe('H1 — deriveHubProfile : nature sortie (composition)', () => {
  it('SOR-1: rando solo courte = kit + itinéraire + sécurité + groupe, pas de budget', () => {
    const p = deriveHubProfile(
      { kind: 'sortie', trip: mkTrip({ collaborators: [], estimated_budget: null }) },
      NOW,
    );
    expect(p.nature).toBe('sortie');
    expect(p.scale).toBe('short');
    expect(p.party).toBe('solo');
    expect(p.activityType).toBe('hiking');
    expect(p.sections).toContain('itinerary');
    expect(p.sections).toContain('gear');
    expect(p.sections).toContain('safety');
    expect(p.sections).not.toContain('budget');
    // Couche groupe universelle : onglet Groupe toujours visible.
    expect(p.sections).toContain('groupe');
    expect(p.reason.groupe).toMatch(/toujours visible/);
  });

  it('SOR-2: road trip multi-pays en groupe = budget + documents forcés', () => {
    const p = deriveHubProfile(
      {
        kind: 'sortie',
        trip: mkTrip({
          primary_activity: 'roadtrip',
          collaborators: [{ id: 'c1' }, { id: 'c2' }] as TripFull['collaborators'],
          start_date: '2026-06-10',
          end_date: '2026-06-25',
        }),
      },
      NOW,
    );
    expect(p.scale).toBe('expedition');
    expect(p.party).toBe('group');
    expect(p.sections).toContain('budget');
    expect(p.sections).toContain('docs');
    expect(p.sections).toContain('groupe');
  });

  it('SOR-3: sections identiques à deriveTripProfile (team fusionné en groupe)', () => {
    const trip = mkTrip({ collaborators: [{ id: 'c1' }] as TripFull['collaborators'] });
    const p = deriveHubProfile({ kind: 'sortie', trip }, NOW);
    // matrice Y short/duo->group : overview, itinerary, gear, team→groupe, budget, checklist, safety, export
    expect(p.sections).toEqual(['overview', 'itinerary', 'gear', 'groupe', 'budget', 'checklist', 'safety', 'export']);
  });

  it('SOR-4: widget repris du moteur Y (composition, pas recopie — déroulé du jour seul)', () => {
    const p = deriveHubProfile(
      { kind: 'sortie', trip: mkTrip({ steps: [{ id: 's1' } as TripFull['steps'][number]] }) },
      NOW,
    );
    expect(p.widgets).toEqual(['steps-timeline']);
  });

  it('SOR-5: voyage annulé = aperçu seul, widgets vides', () => {
    const p = deriveHubProfile(
      { kind: 'sortie', trip: mkTrip({ status: 'cancelled' }) },
      NOW,
    );
    expect(p.sections).toEqual(['overview']);
    expect(p.widgets).toEqual([]);
  });

  it('SOR-8: voyage annulé + sections manuelles = ignorées (miroir Y2.4)', () => {
    const p = deriveHubProfile(
      { kind: 'sortie', trip: mkTrip({ status: 'cancelled' }), enabledSections: ['docs', 'budget'] },
      NOW,
    );
    expect(p.sections).toEqual(['overview']);
    expect(p.reason.docs).toMatch(/annulé/);
  });

  it('SOR-6: reason overview mentionne la composition', () => {
    const p = deriveHubProfile({ kind: 'sortie', trip: mkTrip() }, NOW);
    expect(p.reason.overview).toMatch(/composition/);
    expect(Object.keys(p.reason).sort()).toEqual([...HUB_SECTION_ORDER].sort());
  });

  it('SOR-7: density day = compact (composition fidèle)', () => {
    const p = deriveHubProfile(
      { kind: 'sortie', trip: mkTrip({ start_date: '2026-06-10', end_date: '2026-06-10' }) },
      NOW,
    );
    expect(p.scale).toBe('day');
    expect(p.density).toBe('compact');
  });
});

describe('H1 — deriveHubProfile : nature collectif', () => {
  it('COL-1: groupe vide = section groupe seule', () => {
    const p = deriveHubProfile(
      { kind: 'collectif', membersCount: 3, pendingInvites: 0, linkedTripsCount: 0, hasLinkedTrip: false },
      NOW,
    );
    expect(p.nature).toBe('collectif');
    expect(p.sections).toEqual(['groupe']);
    expect(p.scale).toBeNull();
    expect(p.party).toBe('group');
  });

  it('COL-2: invitations en attente = section invitations', () => {
    const p = deriveHubProfile(
      { kind: 'collectif', membersCount: 2, pendingInvites: 2, linkedTripsCount: 0, hasLinkedTrip: false },
      NOW,
    );
    expect(p.sections).toEqual(['groupe', 'invitations']);
    expect(p.party).toBe('duo');
  });

  it('COL-3: voyages liés = section voyages-lies', () => {
    const p = deriveHubProfile(
      { kind: 'collectif', membersCount: 1, pendingInvites: 0, linkedTripsCount: 2, hasLinkedTrip: true },
      NOW,
    );
    expect(p.sections).toEqual(['groupe', 'voyages-lies']);
    expect(p.party).toBe('solo');
  });

  it('COL-4: widgets = présence toujours, invitations + entrer-voyage sous condition', () => {
    const p = deriveHubProfile(
      { kind: 'collectif', membersCount: 4, pendingInvites: 1, linkedTripsCount: 1, hasLinkedTrip: true },
      NOW,
    );
    expect(p.widgets).toEqual(['invitations-apercu', 'entrer-voyage', 'presence-groupe']);
  });

  it('COL-5: reason complet et traçable', () => {
    const p = deriveHubProfile(
      { kind: 'collectif', membersCount: 4, pendingInvites: 0, linkedTripsCount: 0, hasLinkedTrip: false },
      NOW,
    );
    expect(Object.keys(p.reason).sort()).toEqual([...HUB_SECTION_ORDER].sort());
    expect(p.reason.groupe).toMatch(/affiché/);
    expect(p.reason.invitations).toMatch(/masqué/);
  });
});

describe('H1 — deriveHubProfile : enabled_sections (jamais verrouillé)', () => {
  it('ENA-1: section masquée activable manuellement (possession -> docs impossible, sortie -> docs)', () => {
    const p = deriveHubProfile(
      { kind: 'sortie', trip: mkTrip({ collaborators: [], estimated_budget: null }), enabledSections: ['docs'] },
      NOW,
    );
    expect(p.sections).toContain('docs');
    expect(p.reason.docs).toMatch(/HubSectionPicker/);
  });

  it('ENA-2: ordre du registre respecté après activation manuelle', () => {
    const p = deriveHubProfile(
      { kind: 'sortie', trip: mkTrip({ collaborators: [], estimated_budget: null }), enabledSections: ['export', 'docs'] },
      NOW,
    );
    const order = (s: string) => HUB_SECTION_ORDER.indexOf(s as (typeof HUB_SECTION_ORDER)[number]);
    const idx = p.sections.map(order);
    expect([...idx].sort((a, b) => a - b)).toEqual(idx);
  });

  it('ENA-3: id inconnu ignoré silencieusement', () => {
    const p = deriveHubProfile(
      { kind: 'possession', itemsCount: 0, loansCount: 0, alertsCount: 0, hasDepartEnCours: false, enabledSections: ['nope' as never] },
      NOW,
    );
    expect(p.sections).toEqual(['inventaire', 'kit']);
  });
});

describe('H1 — deriveHubProfile : pureté et déterminisme', () => {
  it('PUR-1: deux appels = même résultat (aucune horloge interne)', () => {
    const input: HubAdventureInput = possession({ itemsCount: 4, alertsCount: 2 });
    expect(deriveHubProfile(input, NOW)).toEqual(deriveHubProfile(input, NOW));
  });

  it('PUR-2: natures disjointes (aucune section possession partagée avec le collectif)', () => {
    const pos = deriveHubProfile(possession({ itemsCount: 3, loansCount: 1, alertsCount: 1, hasDepartEnCours: true }), NOW);
    const col = deriveHubProfile(
      { kind: 'collectif', membersCount: 3, pendingInvites: 1, linkedTripsCount: 1, hasLinkedTrip: true },
      NOW,
    );
    const shared = pos.sections.filter((s) => (col.sections as string[]).includes(s));
    expect(shared).toEqual([]);
  });

  it('PUR-3: mergeEnabledSections fusionne base + customs dans l’ordre registre', () => {
    expect(mergeEnabledSections(['kit', 'inventaire'], ['alertes'])).toEqual(['inventaire', 'kit', 'alertes']);
  });

  it('PUR-4: mergeEnabledSections ignore les inconnus et déduplique', () => {
    expect(mergeEnabledSections(['kit'], ['kit', 'nope' as never])).toEqual(['kit']);
  });
});
