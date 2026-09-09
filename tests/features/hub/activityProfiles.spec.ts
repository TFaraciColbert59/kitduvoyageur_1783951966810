import { describe, it, expect } from 'vitest';
import { deriveHubProfile, type HubAdventureInput } from '@/features/hub/engine/hubProfileEngine';
import {
  applyActivityProfile,
  activitySectionLabel,
} from '@/features/hub/engine/activityProfiles';
import type { TripFull } from '@/features/trips/types/trip.types';

/**
 * H-ACT §3 — Couche de profils d'activité : randonnée ≠ voyage,
 * même coquille, même moteur de composition.
 */

const NOW = new Date('2026-06-01T09:00:00Z');

function mkTrip(overrides: Partial<TripFull> = {}): TripFull {
  return {
    id: 't-1',
    slug: 't-1',
    title: 'Aventure test',
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

function sortie(trip: TripFull): HubAdventureInput {
  return { kind: 'sortie', trip };
}

describe('H-ACT — profils d\'activité distincts (même coquille)', () => {
  it('PRF-1: randonnée -> activityType hiking, onglet Équipage toujours visible', () => {
    const p = deriveHubProfile(sortie(mkTrip()), NOW);
    expect(p.activityType).toBe('hiking');
    expect(p.sections).toContain('team');
    expect(p.reason.team).toMatch(/Équipage/);
  });

  it('PRF-2: voyage culturel -> activityType travel', () => {
    const p = deriveHubProfile(
      sortie(mkTrip({ primary_activity: 'cultural', collaborators: [{ id: 'c1' }] as TripFull['collaborators'] })),
      NOW,
    );
    expect(p.activityType).toBe('travel');
    expect(p.sections).toContain('team');
  });

  it('PRF-3: voyage annulé = aperçu seul (aucun delta, équipage non forcé)', () => {
    const p = deriveHubProfile(sortie(mkTrip({ status: 'cancelled' })), NOW);
    expect(p.activityType).toBe('hiking');
    expect(p.sections).toEqual(['overview']);
    expect(p.sections).not.toContain('team');
  });

  it('PRF-4: randonnée et voyage produisent des raisons distinctes', () => {
    const hiking = deriveHubProfile(sortie(mkTrip()), NOW);
    const travel = deriveHubProfile(
      sortie(mkTrip({ primary_activity: 'roadtrip', collaborators: [{ id: 'c1' }, { id: 'c2' }] as TripFull['collaborators'] })),
      NOW,
    );
    expect(hiking.activityType).toBe('hiking');
    expect(travel.activityType).toBe('travel');
    // La composition reste dans l'ordre du registre pour les deux.
    const orderIdx = (sections: string[]) =>
      sections.map((s) => s).join('|');
    expect(orderIdx(travel.sections)).not.toEqual(orderIdx(hiking.sections));
  });

  it('PRF-5: possession/collectif -> activityType null (absent)', () => {
    const pos = deriveHubProfile(
      { kind: 'possession', itemsCount: 2, loansCount: 0, alertsCount: 0, hasDepartEnCours: false },
      NOW,
    );
    expect(pos.activityType ?? null).toBeNull();
  });

  it('PRF-8: randonnée masque les widgets budget/pays/documents/contexte', () => {
    const p = deriveHubProfile(sortie(mkTrip()), NOW);
    expect(p.widgets).not.toContain('budget-burn');
    expect(p.widgets).not.toContain('country-card');
    expect(p.widgets).not.toContain('trip-context');
    expect(p.widgets).not.toContain('docs-expiry');
    expect(p.widgets).toContain('countdown');
    expect(p.widgets).toContain('safety-next');
  });

  it('PRF-9: voyage conserve budget/pays/documents', () => {
    const p = deriveHubProfile(
      sortie(mkTrip({ primary_activity: 'roadtrip', collaborators: [{ id: 'c1' }] as TripFull['collaborators'] })),
      NOW,
    );
    expect(p.widgets).toContain('budget-burn');
    expect(p.widgets).toContain('country-card');
    expect(p.widgets).toContain('trip-context');
  });
});

describe('H-ACT — applyActivityProfile (pure)', () => {
  const base = {
    nature: 'sortie' as const,
    scale: 'short' as const,
    party: 'solo' as const,
    density: 'comfortable' as const,
    sections: ['overview', 'itinerary', 'gear', 'safety', 'export'] as never,
    widgets: [] as never,
    reason: {} as never,
  };

  it('PRF-6: ajoute team au profil solo', () => {
    const p = applyActivityProfile(base as never, 'hiking', false);
    expect(p.sections).toContain('team');
  });

  it('PRF-7: annulé = profil inchangé (hormis activityType)', () => {
    const p = applyActivityProfile(base as never, 'hiking', true);
    expect(p.sections).toEqual(base.sections);
    expect(p.activityType).toBe('hiking');
  });
});

describe('H-ACT — libellés de sections par activité', () => {
  it('LBL-1: randonnée renomme Itinéraire -> Parcours, Équipement -> Matériel', () => {
    expect(activitySectionLabel('hiking', 'itinerary', 'Itinéraire')).toBe('Parcours');
    expect(activitySectionLabel('hiking', 'gear', 'Équipement')).toBe('Matériel');
  });

  it('LBL-2: voyage et défaut du registre', () => {
    expect(activitySectionLabel('travel', 'itinerary', 'Itinéraire')).toBe('Itinéraire');
    expect(activitySectionLabel('travel', 'gear', 'Équipement')).toBe('Matériel & bagages');
    expect(activitySectionLabel(null, 'gear', 'Équipement')).toBe('Équipement');
  });
});