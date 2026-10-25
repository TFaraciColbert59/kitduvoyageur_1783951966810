import { describe, it, expect } from 'vitest';
import {
  createTripSchema,
  updateTripSchema,
  tripStepSchema,
  tripItemSchema,
  tripExpenseSchema,
  tripFiltersSchema,
  tripDocumentSchema,
  tripPoiSchema,
  tripSafetyCheckpointSchema,
  tripNoteSchema,
  computeTripPermissions,
} from '@/features/trips';

describe('Trip Zod Schemas & Validation', () => {
  describe('createTripSchema', () => {
    it('validates a correct minimal trip payload', () => {
      const validPayload = {
        title: 'Trek dans les Alpes',
        difficulty: 'moderate',
        primary_activity: 'hiking',
        budget_currency: 'EUR',
        visibility: 'private',
      };
      const result = createTripSchema.safeParse(validPayload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.title).toBe('Trek dans les Alpes');
        expect(result.data.difficulty).toBe('moderate');
      }
    });

    it('validates a complete trip payload with valid dates and budget', () => {
      const completePayload = {
        title: 'Tour du Mont Blanc',
        description: 'Magnifique boucle de 7 jours en autonomie',
        destination_country_code: 'FR',
        destination_name: 'Chamonix, France',
        start_date: '2026-07-10',
        end_date: '2026-07-17',
        difficulty: 'hard',
        primary_activity: 'trekking',
        estimated_budget: 450.5,
        budget_currency: 'EUR',
        visibility: 'public',
      };
      const result = createTripSchema.safeParse(completePayload);
      expect(result.success).toBe(true);
    });

    it('rejects title shorter than 3 characters', () => {
      const payload = {
        title: 'Al',
        difficulty: 'easy',
        primary_activity: 'hiking',
        visibility: 'private',
      };
      const result = createTripSchema.safeParse(payload);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('title');
      }
    });

    it('rejects invalid end_date earlier than start_date', () => {
      const payload = {
        title: 'Voyage incohérent',
        start_date: '2026-08-15',
        end_date: '2026-08-10',
      };
      const result = createTripSchema.safeParse(payload);
      expect(result.success).toBe(false);
      if (!result.success) {
        const hasDateError = result.error.issues.some(issue =>
          issue.message.toLowerCase().includes('date')
        );
        expect(hasDateError).toBe(true);
      }
    });

    it('rejects negative estimated_budget', () => {
      const payload = {
        title: 'Voyage budget négatif',
        estimated_budget: -50,
      };
      const result = createTripSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });

    it('rejects invalid destination country code format', () => {
      const payload = {
        title: 'Voyage code invalide',
        destination_country_code: 'FRA', // should be 2 characters ISO A2
      };
      const result = createTripSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });
  });

  describe('updateTripSchema', () => {
    it('accepts partial update payload with valid status', () => {
      const updatePayload = {
        status: 'active',
        description: 'Départ confirmé !',
      };
      const result = updateTripSchema.safeParse(updatePayload);
      expect(result.success).toBe(true);
    });

    it('rejects invalid status', () => {
      const updatePayload = {
        status: 'unknown_status',
      };
      const result = updateTripSchema.safeParse(updatePayload);
      expect(result.success).toBe(false);
    });
  });

  describe('tripStepSchema', () => {
    it('validates a step with correct order and coordinates', () => {
      const step = {
        trip_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        day_number: 1,
        order_index: 0,
        title: 'Col de Voza',
        latitude: 45.856,
        longitude: 6.782,
        distance_km: 12.5,
        elevation_gain_m: 850,
        transport_mode: 'foot',
      };
      const result = tripStepSchema.safeParse(step);
      expect(result.success).toBe(true);
    });

    it('rejects negative day_number', () => {
      const step = {
        trip_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        day_number: 0,
        order_index: 0,
        title: 'Étape invalide',
      };
      const result = tripStepSchema.safeParse(step);
      expect(result.success).toBe(false);
    });
  });

  describe('tripItemSchema', () => {
    it('validates an item with category and weight', () => {
      const item = {
        trip_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        item_name: 'Tente 2 places ultralight',
        category: 'Abri',
        quantity: 1,
        weight_grams: 1250,
        status: 'packed',
        is_packed: true,
      };
      const result = tripItemSchema.safeParse(item);
      expect(result.success).toBe(true);
    });

    it('rejects negative weight or zero quantity', () => {
      const item = {
        trip_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        item_name: 'Item invalide',
        quantity: 0,
        weight_grams: -10,
      };
      const result = tripItemSchema.safeParse(item);
      expect(result.success).toBe(false);
    });
  });

  describe('tripExpenseSchema', () => {
    it('validates expense with positive amount', () => {
      const expense = {
        trip_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        payer_id: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
        title: 'Refuge de Plan Glacier',
        amount: 65,
        currency: 'EUR',
        category: 'Hébergement',
        expense_date: '2026-07-12',
        split_type: 'equal',
      };
      const result = tripExpenseSchema.safeParse(expense);
      expect(result.success).toBe(true);
    });

    it('rejects 0 or negative expense amount', () => {
      const expense = {
        trip_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        payer_id: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
        title: 'Gratuit',
        amount: 0,
      };
      const result = tripExpenseSchema.safeParse(expense);
      expect(result.success).toBe(false);
    });
  });

  describe('tripFiltersSchema', () => {
    it('parses valid search query params', () => {
      const query = {
        search: 'Corse',
        status: 'planned',
        difficulty: 'hard',
        activity: 'trekking',
        destination: 'FR',
      };
      const result = tripFiltersSchema.safeParse(query);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.search).toBe('Corse');
        expect(result.data.status).toBe('planned');
      }
    });

    it('handles empty query parameters cleanly', () => {
      const result = tripFiltersSchema.safeParse({});
      expect(result.success).toBe(true);
    });
  });

  describe('Permissions helper', () => {
    it('grants full permissions to owner', () => {
      const perms = computeTripPermissions('owner');
      expect(perms.canEdit).toBe(true);
      expect(perms.canDelete).toBe(true);
      expect(perms.canInvite).toBe(true);
      expect(perms.canManageBudget).toBe(true);
      expect(perms.canViewDocuments).toBe(true);
    });

    it('grants edit permissions to editor without delete rights', () => {
      const perms = computeTripPermissions('editor');
      expect(perms.canEdit).toBe(true);
      expect(perms.canDelete).toBe(false);
      expect(perms.canInvite).toBe(false);
      expect(perms.canManageBudget).toBe(true);
      expect(perms.canViewDocuments).toBe(true);
    });

    it('restricts viewer permissions (read-only, no documents)', () => {
      const perms = computeTripPermissions('viewer');
      expect(perms.canEdit).toBe(false);
      expect(perms.canDelete).toBe(false);
      expect(perms.canInvite).toBe(false);
      expect(perms.canManageBudget).toBe(false);
      expect(perms.canViewDocuments).toBe(false);
    });

    it('handles null/anonymous user', () => {
      const perms = computeTripPermissions(null);
      expect(perms.canEdit).toBe(false);
      expect(perms.canDelete).toBe(false);
      expect(perms.canInvite).toBe(false);
      expect(perms.canManageBudget).toBe(false);
      expect(perms.canViewDocuments).toBe(false);
    });
  });
});
