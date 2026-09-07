import { describe, it, expect } from 'vitest';
import { generateItinerary } from '@/features/trips/engine/buildItinerary';
import { getTripElevationProfile } from '@/features/trips/lib/elevation';
import { computeKitWeight } from '@/features/trips/engine/contextualKitEngine';
import { getTripPhase } from '@/features/trips/engine/temporalPhaseEngine';
import { formatCivilDateRange } from '@/lib/dates/tripDates';
import { simplifyDebts } from '@/features/trips/engine/budgetEngine';
import { lkvCan } from '@/lib/security/permissions';
import type { TripFull, TripItem } from '@/features/trips/types/trip.types';

function createMockTrip(overrides: Partial<TripFull> = {}): TripFull {
  return {
    id: 'test-trip-id',
    slug: 'voyage-test',
    title: 'Voyage Dégradé Test',
    description: null,
    destination_country_code: 'FR',
    destination_name: 'France',
    start_date: '2026-07-01',
    end_date: '2026-07-10',
    status: 'planned',
    visibility: 'private',
    difficulty: 'moderate',
    primary_activity: 'hiking',
    estimated_budget: 500,
    budget_currency: 'EUR',
    cover_image_url: null,
    user_id: 'user-1',
    group_id: null,
    share_token: null,
    metadata: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    user_role: 'owner',
    permissions: {
      canEdit: true,
      canDelete: true,
      canInvite: true,
      canManageBudget: true,
      canViewDocuments: true,
    },
    collaborators: [],
    steps: [],
    items: [],
    expenses: [],
    documents: [],
    pois: [],
    safety_checkpoints: [],
    notes: [],
    ...overrides,
  };
}

describe('Phase 11.1 — Matrice de Tests Unitaires : Cas Dégradés et Limites', () => {
  describe('generateItinerary — Cas Dégradés', () => {
    it('gère une durée de 0 ou négative sans crasher et retourne au moins 1 étape sécurisée', () => {
      const itin0 = generateItinerary({ country: 'FR', days: 0 });
      expect(itin0.steps.length).toBeGreaterThanOrEqual(1);

      const itinNeg = generateItinerary({ country: 'FR', days: -5 });
      expect(itinNeg.steps.length).toBeGreaterThanOrEqual(1);
    });

    it('gère une très longue expédition (90 jours) avec réindexation sans collision', () => {
      const itin90 = generateItinerary({ country: 'FR', days: 90 });
      expect(itin90.steps.length).toBe(90);
      expect(itin90.steps[0].day_number).toBe(1);
      expect(itin90.steps[89].day_number).toBe(90);
    });

    it('résiste aux codes pays inconnus ou vides avec un template universel', () => {
      const itinUnknown = generateItinerary({ country: 'ZZ', days: 5 });
      expect(itinUnknown.steps.length).toBe(5);
      expect(itinUnknown.steps[0].title).toBeDefined();
    });
  });

  describe('getTripElevationProfile — Cas Extrêmes & Altitudes Négatives', () => {
    it('gère les étapes sans altitude ou sous le niveau de la mer sans division par zéro', () => {
      const trip = createMockTrip({
        steps: [
          {
            id: 's1',
            trip_id: 'test-trip-id',
            day_number: 1,
            title: 'Étape 1',
            description: null,
            date: '2026-07-01',
            start_location: 'Point A',
            end_location: 'Point B',
            distance_km: 12,
            elevation_gain_m: 0,
            elevation_loss_m: 50,
            estimated_duration_hours: 4,
            accommodation_type: 'camp',
            accommodation_name: null,
            notes: null,
            created_at: new Date().toISOString(),
            latitude: null,
            longitude: null,
            altitude_max_m: 100,
          },
        ],
      });
      const profile = getTripElevationProfile(trip);
      expect(profile.minM).toBeDefined();
      expect(profile.maxM).toBeGreaterThanOrEqual(100);
      expect(profile.confidence).toBeDefined();
    });
  });

  describe('computeKitWeight — Valeurs Anormales', () => {
    it('gère un sac vide et ne donne pas de badge erroné', () => {
      const weight = computeKitWeight([]);
      expect(weight.totalWeightGrams).toBe(0);
      expect(weight.baseWeightGrams).toBe(0);
      expect(weight.weightCategory).toBe('none');
    });

    it('gère une expédition polaire de plusieurs centaines de kilos sans overflow', () => {
      const items: TripItem[] = [
        {
          id: '1',
          trip_id: 't1',
          item_name: 'Traîneau & vivres',
          category: 'safety',
          quantity: 2,
          weight_grams: 150000,
          is_packed: true,
          status: 'packed',
          packed_by: null,
          inventory_item_id: null,
          created_at: new Date().toISOString(),
        },
      ];
      const weight = computeKitWeight(items);
      expect(weight.totalWeightGrams).toBe(300000);
    });
  });

  describe('getTripPhase — Dates Extrêmes et Dégradées', () => {
    it('gère les dates du siècle passé ou lointain futur sans exception', () => {
      const pastTrip = createMockTrip({ start_date: '1980-01-01', end_date: '1980-01-10' });
      expect(getTripPhase(pastTrip)).toBe('recount');

      const futureTrip = createMockTrip({ start_date: '2099-01-01', end_date: '2099-01-10' });
      expect(getTripPhase(futureTrip)).toBe('prepare');
    });

    it('gère les chaînes de date invalides avec fallback sûr sur "prepare"', () => {
      const invalidTrip = createMockTrip({ start_date: 'invalid-date', end_date: 'not-a-date' });
      expect(getTripPhase(invalidTrip)).toBe('prepare');
    });
  });

  describe('formatCivilDateRange — Transitions DST & Fuseaux Extrêmes', () => {
    it('préserve exactement le jour civil lors de la bascule d’heure d’été', () => {
      const range = formatCivilDateRange('2026-03-28', '2026-03-30');
      expect(range).toContain('28');
      expect(range).toContain('30');
      expect(range).toContain('2026');
    });
  });

  describe('simplifyDebts — Cas Circulaires et Centimes', () => {
    it('résout une balance neutre avec 0 règlement', () => {
      const balances = [
        { userId: 'userA', paid: 30, share: 30, net: 0 },
        { userId: 'userB', paid: 30, share: 30, net: 0 },
      ];
      const settlements = simplifyDebts(balances as any);
      expect(settlements.length).toBe(0);
    });

    it('gère les arrondis au centime sans perte d’argent', () => {
      const balances = [
        { userId: 'userA', paid: 100, share: 33.33, net: 66.67 },
        { userId: 'userB', paid: 0, share: 33.33, net: -33.33 },
        { userId: 'userC', paid: 0, share: 33.34, net: -33.34 },
      ];
      const settlements = simplifyDebts(balances as any);
      const totalToPay = settlements.reduce((sum, s) => sum + s.amount, 0);
      expect(Math.round(totalToPay * 100) / 100).toBeCloseTo(66.67, 1);
    });
  });

  describe('lkvCan — Permissions Limites & Acteurs Inconnus', () => {
    it('refuse tout droit si l’utilisateur est null ou non défini sur ressource privée', () => {
      const mockCrew = { id: 'c-1', created_by: 'user-1', visibility: 'private' as const };
      expect(lkvCan('crews', 'update', { userId: null as any, crew: mockCrew })).toBe(false);
      expect(lkvCan('crews', 'delete', { userId: undefined as any, crew: mockCrew })).toBe(false);
    });

    it('refuse l’accès si le rôle dans l’équipage est inexistant ou altéré', () => {
      const mockCrew = { id: 'c-1', created_by: 'user-1', visibility: 'private' as const };
      const maliciousMember = { crew_id: 'c-1', user_id: 'hacker', role: 'malicious_role' as any, status: 'active' as const };
      expect(lkvCan('crews', 'update', { userId: 'hacker', crew: mockCrew, crewMember: maliciousMember })).toBe(false);
      expect(lkvCan('crews', 'delete', { userId: 'hacker', crew: mockCrew, crewMember: maliciousMember })).toBe(false);
    });
  });
});
