import { describe, it, expect } from 'vitest';
import {
  buildCollectifInfoChips,
  buildCollectifSectionTiles,
  buildPossessionInfoChips,
  buildPossessionSectionTiles,
  buildSortieInfoChips,
  buildSortieSectionTiles,
  formatEuro,
  formatKm,
  pluralize,
  poiCategoryMeta,
  selectSortieMoment,
  type SortieContext,
  type SortieMetrics,
} from '@/features/hub/mobile/mobileHubEngine';
import type {
  TripFull,
  TripPoi,
  TripSafetyCheckpoint,
  TripStats,
  TripStep,
} from '@/features/trips/types/trip.types';
import type { HubAdventureRef } from '@/features/hub/registry/hubSectionRegistry';
import type { MaterielSummary } from '@/features/materiel/services/getMaterielSummary';
import type { GroupeMenuSummary } from '@/features/hub/server/getGroupeMenu';

const REF: HubAdventureRef = { nature: 'sortie', slug: 'tour-mont-blanc' };
const NOW = new Date('2026-06-11T09:00:00');

function mkStep(overrides: Partial<TripStep> & { id: string; day_number: number }): TripStep {
  return {
    trip_id: 't-1',
    order_index: 0,
    title: `Étape ${overrides.day_number}`,
    description: null,
    location_name: null,
    latitude: null,
    longitude: null,
    accommodation_name: null,
    transport_mode: null,
    distance_km: null,
    elevation_gain_m: null,
    elevation_loss_m: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function mkTrip(overrides: Partial<TripFull> = {}): TripFull {
  return {
    id: 't-1',
    slug: 'tour-mont-blanc',
    title: 'Tour du Mont-Blanc',
    description: null,
    destination_country_code: 'FR',
    destination_name: 'Mont-Blanc',
    start_date: '2026-06-16',
    end_date: '2026-06-25',
    status: 'planned',
    visibility: 'private',
    difficulty: 'moderate',
    primary_activity: 'trekking',
    estimated_budget: 3200,
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

function mkStats(overrides: Partial<TripStats> = {}): TripStats {
  return {
    trip_id: 't-1',
    total_days: 10,
    total_distance_km: 170,
    total_elevation_gain_m: 9800,
    total_elevation_loss_m: 9700,
    items_packed: 12,
    items_total: 12,
    estimated_budget: 3200,
    total_spent: 486,
    participants_count: 2,
    ...overrides,
  };
}

const METRICS: SortieMetrics = {
  stepsCount: 10,
  totalKm: 170,
  dPlus: 9800,
  packedPct: 100,
  readyItems: 12,
  totalItems: 12,
};

function mkPoi(overrides: Partial<TripPoi> & { id: string }): TripPoi {
  return {
    trip_id: 't-1',
    step_id: null,
    name: 'POI',
    category: null,
    latitude: null,
    longitude: null,
    notes: null,
    visited: false,
    osm_id: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function mkCheckpoint(overrides: Partial<TripSafetyCheckpoint> & { id: string }): TripSafetyCheckpoint {
  return {
    trip_id: 't-1',
    label: 'Point de contrôle',
    scheduled_at: '2026-06-11T12:00:00Z',
    checked_at: null,
    contact_phone: null,
    contact_name: null,
    status: 'pending',
    notes: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('buildSortieSectionTiles', () => {
  it('prépare : sections de préparation, sans cockpit ni raconter, avec Contexte', () => {
    const tiles = buildSortieSectionTiles(REF, 'prepare', { steps: 10, packedPct: 100 });
    const keys = tiles.map((t) => t.key);
    expect(keys).toEqual(['itinerary', 'gear', 'budget', 'groupe', 'checklist', 'docs', 'safety', 'journal', 'context']);
    expect(keys).not.toContain('cockpit');
    expect(keys).not.toContain('raconter');
    expect(tiles[0].href).toBe('/hub/itineraire');
    expect(tiles.find((t) => t.key === 'gear')?.badge).toBe('100%');
  });

  it('live : cockpit en tête, accentué, avec lien phase', () => {
    const tiles = buildSortieSectionTiles(REF, 'live');
    expect(tiles[0].key).toBe('cockpit');
    expect(tiles[0].accent).toBe(true);
    expect(tiles[0].href).toBe('/hub?phase=live');
  });

  it('recount : raconter en tête', () => {
    const tiles = buildSortieSectionTiles(REF, 'recount');
    expect(tiles[0].key).toBe('raconter');
    expect(tiles[0].href).toBe('/hub?phase=recount');
  });
});

describe('buildSortieInfoChips', () => {
  const context: SortieContext = { phase: 'prepare', dayIndex: null, totalDays: 10, daysUntil: 5 };

  it('expose les infos clés et la météo réelle', () => {
    const chips = buildSortieInfoChips({
      trip: mkTrip(),
      ref: REF,
      stats: mkStats(),
      hiking: { current: null, days: [] } as never,
      context,
      metrics: METRICS,
    });
    const keys = chips.map((c) => c.key);
    expect(keys).toContain('weather');
    expect(keys).toContain('place');
    expect(keys).toContain('countdown');
    expect(keys).toContain('distance');
    expect(keys).toContain('kit');
    expect(chips.find((c) => c.key === 'countdown')?.value).toBe('J-5');
    expect(chips.find((c) => c.key === 'distance')?.value).toBe('170 km');
  });

  it('météo absente : chip honnête indisponible', () => {
    const chips = buildSortieInfoChips({
      trip: mkTrip(),
      ref: REF,
      stats: mkStats(),
      hiking: null,
      context,
      metrics: METRICS,
    });
    expect(chips.find((c) => c.key === 'weather')?.label).toBe('Météo indisponible');
  });

  it('live : chip jour courant', () => {
    const chips = buildSortieInfoChips({
      trip: mkTrip(),
      ref: REF,
      stats: mkStats(),
      hiking: null,
      context: { phase: 'live', dayIndex: 3, totalDays: 10, daysUntil: 0 },
      metrics: METRICS,
    });
    expect(chips.find((c) => c.key === 'countdown')?.value).toBe('Jour 3');
  });
});

describe('selectSortieMoment', () => {
  const steps: TripStep[] = [
    mkStep({ id: 's1', day_number: 1, order_index: 0, title: 'Les Houches', latitude: 45.89, longitude: 6.79, distance_km: 12, elevation_gain_m: 400, accommodation_name: 'Refuge du Mont-Blanc' }),
    mkStep({ id: 's2', day_number: 1, order_index: 1, title: 'Col de Voza', latitude: 45.86, longitude: 6.75, distance_km: 6, elevation_gain_m: 500 }),
    mkStep({ id: 's3', day_number: 2, order_index: 0, title: 'Contamines', latitude: 45.82, longitude: 6.72, distance_km: 18, elevation_gain_m: 900 }),
  ];

  it('live : étape du jour, POIs liés, checkpoint du jour, hébergement', () => {
    const trip = mkTrip({
      steps,
      pois: [
        mkPoi({ id: 'p1', step_id: 's1', name: "Point d'eau" }),
        mkPoi({ id: 'p2', step_id: 's3', name: 'Sommet du jour 2' }),
      ],
      safety_checkpoints: [
        mkCheckpoint({ id: 'c1', scheduled_at: '2026-06-13T12:00:00Z', label: 'Futur' }),
        mkCheckpoint({ id: 'c2', scheduled_at: '2026-06-11T18:00:00Z', label: 'Ce soir' }),
      ],
      notes: [
        { id: 'n1', trip_id: 't-1', author_id: 'u-1', title: 'Jour 1', content: 'Top', day_number: 1, is_pinned: false, created_at: '2026-06-11T20:00:00Z', updated_at: '2026-06-11T20:00:00Z' },
      ],
    });
    const moment = selectSortieMoment({
      trip,
      context: { phase: 'live', dayIndex: 1, totalDays: 10, daysUntil: 0 },
      now: NOW,
    });
    expect(moment.badge).toBe('Jour 1/10');
    expect(moment.highlightSteps).toHaveLength(2);
    expect(moment.highlightCoords).toHaveLength(2);
    expect(moment.routeCoords).toHaveLength(3);
    expect(moment.pois.map((p) => p.id)).toEqual(['p1']);
    expect(moment.checkpoint?.id).toBe('c2');
    expect(moment.accommodation).toBe('Refuge du Mont-Blanc');
    expect(moment.note?.id).toBe('n1');
    expect(moment.distanceKm).toBe(18);
    expect(moment.dPlus).toBe(900);
  });

  it('prépare : J-x, première étape mise en avant, trace complète', () => {
    const moment = selectSortieMoment({
      trip: mkTrip({ steps }),
      context: { phase: 'prepare', dayIndex: null, totalDays: 10, daysUntil: 5 },
      now: NOW,
    });
    expect(moment.badge).toBe('J-5');
    expect(moment.title).toBe('Les Houches');
    expect(moment.highlightCoords).toEqual([[45.89, 6.79]]);
    expect(moment.routeCoords).toHaveLength(3);
    expect(moment.distanceKm).toBe(36);
  });

  it('recount : bilan avec dernière note', () => {
    const trip = mkTrip({
      steps,
      notes: [
        { id: 'n1', trip_id: 't-1', author_id: 'u-1', title: null, content: 'Début', day_number: 1, is_pinned: false, created_at: '2026-06-11T20:00:00Z', updated_at: '2026-06-11T20:00:00Z' },
        { id: 'n2', trip_id: 't-1', author_id: 'u-1', title: null, content: 'Fin', day_number: 10, is_pinned: false, created_at: '2026-06-20T20:00:00Z', updated_at: '2026-06-20T20:00:00Z' },
      ],
    });
    const moment = selectSortieMoment({
      trip,
      context: { phase: 'recount', dayIndex: null, totalDays: 10, daysUntil: 0 },
      now: NOW,
    });
    expect(moment.badge).toBe('Bilan');
    expect(moment.note?.id).toBe('n2');
    expect(moment.highlightCoords).toHaveLength(0);
  });

  it('aucune coordonnée : trace vide (pas de tracé synthétique)', () => {
    const moment = selectSortieMoment({
      trip: mkTrip({ steps: [mkStep({ id: 's1', day_number: 1 })] }),
      context: { phase: 'prepare', dayIndex: null, totalDays: null, daysUntil: 3 },
      now: NOW,
    });
    expect(moment.routeCoords).toHaveLength(0);
    expect(moment.highlightCoords).toHaveLength(0);
  });

  it('un seul point géo : la trace reste exploitable', () => {
    const moment = selectSortieMoment({
      trip: mkTrip({
        steps: [mkStep({ id: 's1', day_number: 1, latitude: 45.9, longitude: 6.9 })],
      }),
      context: { phase: 'prepare', dayIndex: null, totalDays: null, daysUntil: 3 },
      now: NOW,
    });
    expect(moment.routeCoords).toEqual([[45.9, 6.9]]);
    expect(moment.highlightCoords).toEqual([[45.9, 6.9]]);
  });

  it('trace multi-jours : ordre jour puis index (jamais d’index intercalé)', () => {
    const moment = selectSortieMoment({
      trip: mkTrip({
        steps: [
          mkStep({ id: 'b', day_number: 1, order_index: 1, latitude: 45.9, longitude: 6.9 }),
          mkStep({ id: 'c', day_number: 2, order_index: 0, latitude: 45.8, longitude: 6.8 }),
          mkStep({ id: 'a', day_number: 1, order_index: 0, latitude: 45.95, longitude: 6.85 }),
        ],
      }),
      context: { phase: 'prepare', dayIndex: null, totalDays: 2, daysUntil: 3 },
      now: NOW,
    });
    expect(moment.routeCoords).toEqual([
      [45.95, 6.85],
      [45.9, 6.9],
      [45.8, 6.8],
    ]);
  });
});

function mkMaterielSummary(overrides: Partial<MaterielSummary> = {}): MaterielSummary {
  return {
    depart: {
      id: 'd1',
      destination: 'Vercors',
      startsAt: new Date(NOW.getTime() + 3 * 86400000).toISOString(),
      readinessPct: 80,
      status: 'ok',
      totalWeightKg: 8.2,
      itemsCount: 24,
    },
    forget: {
      forgetRemaining: 2,
      checkedItems: 10,
      totalItems: 12,
      nextDepartLabel: null,
      sampleItems: [],
    },
    kits: {
      count: 3,
      avgCompletionPct: 74,
      trashCount: 0,
      assignedKitName: null,
      totalWeightKg: 21.4,
      topKits: [],
    },
    inventaire: {
      count: 42,
      goodConditionPct: 95,
      orderedCount: 0,
      lastAddedLabel: null,
      goodCount: 40,
    },
    alertes: {
      count: 2,
      criticalCount: 1,
      warningCount: 1,
      reliabilityScore: 88,
      lastAlertLabel: null,
    },
    dispo: {
      unavailableCount: 1,
      total: 42,
      hasConflict: false,
      nextReturnLabel: null,
      availableCount: 41,
    },
    ...overrides,
  };
}

describe('buildPossessionSectionTiles / chips', () => {
  const ref: HubAdventureRef = { nature: 'possession' };

  it('7 sections dans l’ordre du registre', () => {
    const tiles = buildPossessionSectionTiles(ref, mkMaterielSummary(), NOW);
    expect(tiles.map((t) => t.key)).toEqual([
      'depart',
      'alertes',
      'inventaire',
      'kit',
      'preparation',
      'disponibilite',
      'oublis',
    ]);
    expect(tiles[0].href).toBe('/hub/depart');
    expect(tiles[0].badge).toBe('J-3');
  });

  it('chips : alerte critique en tone warn', () => {
    const chips = buildPossessionInfoChips(ref, mkMaterielSummary(), NOW);
    expect(chips.find((c) => c.key === 'depart')?.label).toBe('Vercors');
    expect(chips.find((c) => c.key === 'alertes')?.tone).toBe('warn');
    expect(chips.find((c) => c.key === 'oublis')?.tone).toBe('warn');
  });

  it('départ estimé (aucune date réelle) : jamais présenté comme une date ferme', () => {
    const summary = mkMaterielSummary();
    summary.depart.isEstimated = true;
    const tiles = buildPossessionSectionTiles(ref, summary, NOW);
    expect(tiles[0].badge).toBeNull();
    const chips = buildPossessionInfoChips(ref, summary, NOW);
    expect(chips.find((c) => c.key === 'depart')?.value).toBe('—');
    expect(chips.find((c) => c.key === 'depart')?.label).toBe('départ à planifier');
  });
});

function mkGroupeSummary(overrides: Partial<GroupeMenuSummary> = {}): GroupeMenuSummary {
  return {
    name: 'Les Sommets',
    members: 4,
    pendingInvites: 1,
    tasksOpen: 5,
    equipmentCount: 12,
    expensesTotal: 1240,
    pollsOpen: 2,
    lastMessage: 'On part quand ?',
    inviteCode: 'ABC123',
    progression: 45,
    linkedTrips: 1,
    departureLabel: 'J-20',
    ...overrides,
  };
}

describe('buildCollectifSectionTiles / chips', () => {
  const ref: HubAdventureRef = { nature: 'collectif' };

  it('groupe : onglets + voyage actif', () => {
    const tiles = buildCollectifSectionTiles(ref, mkGroupeSummary(), 'tour-mont-blanc');
    const keys = tiles.map((t) => t.key);
    expect(keys).toContain('tasks');
    expect(tiles.find((t) => t.key === 'tasks')?.href).toBe('/hub/groupe?onglet=tasks');
    expect(tiles.find((t) => t.key === 'voyage-actif')?.accent).toBe(true);
    expect(tiles.find((t) => t.key === 'expenses')?.badge).toBe(formatEuro(1240));
  });

  it('chips groupe : dépense par personne', () => {
    const chips = buildCollectifInfoChips(ref, mkGroupeSummary());
    expect(chips.find((c) => c.key === 'expenses')?.value).toBe(formatEuro(1240));
    expect(chips.find((c) => c.key === 'expenses')?.label).toBe(`≈ ${formatEuro(310)}/pers.`);
  });
});

describe('helpers', () => {
  it('formatKm compact', () => {
    expect(formatKm(300.9)).toBe('301');
    expect(formatKm(12.4)).toBe('12,4');
  });

  it('pluralize', () => {
    expect(pluralize(1, 'alerte critique', 'alertes critiques')).toBe('1 alerte critique');
    expect(pluralize(2, 'alerte critique', 'alertes critiques')).toBe('2 alertes critiques');
    expect(pluralize(0, 'kit')).toBe('0 kit');
  });

  it('poiCategoryMeta', () => {
    expect(poiCategoryMeta('water', 'Fontaine')).toMatchObject({ label: 'Point d’eau' });
    expect(poiCategoryMeta('refuge', 'Refuge des Mottets')).toMatchObject({ label: 'Refuge' });
    expect(poiCategoryMeta(null, 'Col de Balme')).toMatchObject({ label: 'Col' });
    expect(poiCategoryMeta(null, 'Belvédère')).toMatchObject({ label: 'Point de vue' });
    expect(poiCategoryMeta('autre', 'X')).toMatchObject({ label: 'autre' });
  });
});
