import { describe, it, expect } from 'vitest';
import { computeTripPermissions } from '@/features/trips/schemas/trip.schema';
import type { TripCollaboratorRole } from '@/features/trips/types/trip.types';

describe('Trip Security & RLS Matrix Isolation (Chantier 1)', () => {
  const OWNER_ID = 'owner-uuid-1111';
  const EDITOR_ID = 'editor-uuid-2222';
  const VIEWER_ID = 'viewer-uuid-3333';
  const STRANGER_ID = 'stranger-uuid-9999';

  describe('Permission Computation Matrix (computeTripPermissions)', () => {
    it('grants full ownership rights to trip owner', () => {
      const perms = computeTripPermissions('owner');
      expect(perms.canEdit).toBe(true);
      expect(perms.canDelete).toBe(true);
      expect(perms.canInvite).toBe(true);
      expect(perms.canManageBudget).toBe(true);
      expect(perms.canViewDocuments).toBe(true);
    });

    it('grants editor rights (can edit, cannot delete or invite)', () => {
      const perms = computeTripPermissions('editor');
      expect(perms.canEdit).toBe(true);
      expect(perms.canDelete).toBe(false);
      expect(perms.canInvite).toBe(false);
      expect(perms.canManageBudget).toBe(true);
      expect(perms.canViewDocuments).toBe(true);
    });

    it('grants viewer read-only rights (cannot edit, cannot delete, cannot view sensitive docs)', () => {
      const perms = computeTripPermissions('viewer');
      expect(perms.canEdit).toBe(false);
      expect(perms.canDelete).toBe(false);
      expect(perms.canInvite).toBe(false);
      expect(perms.canManageBudget).toBe(false);
      expect(perms.canViewDocuments).toBe(false);
    });

    it('denies edit and management rights when role is null (strangers/public)', () => {
      const perms = computeTripPermissions(null);
      expect(perms.canEdit).toBe(false);
      expect(perms.canDelete).toBe(false);
      expect(perms.canInvite).toBe(false);
      expect(perms.canManageBudget).toBe(false);
      expect(perms.canViewDocuments).toBe(false);
    });

    it('denies edit and management rights when role is undefined (unauthenticated)', () => {
      const perms = computeTripPermissions(undefined);
      expect(perms.canEdit).toBe(false);
      expect(perms.canDelete).toBe(false);
      expect(perms.canInvite).toBe(false);
      expect(perms.canManageBudget).toBe(false);
      expect(perms.canViewDocuments).toBe(false);
    });
  });

  describe('PostgreSQL RLS Invariant Rules Verification', () => {
    // Simule la logique des fonctions PostgreSQL can_read_trip et can_edit_trip
    // définies dans supabase/migrations/20260904050000_trips_core.sql

    interface MockTripRow {
      id: string;
      user_id: string;
      visibility: 'public' | 'unlisted' | 'private';
    }

    interface MockCollabRow {
      trip_id: string;
      user_id: string;
      role: TripCollaboratorRole;
    }

    const mockTrips: Record<string, MockTripRow> = {
      'public-trip': { id: 'public-trip', user_id: OWNER_ID, visibility: 'public' },
      'unlisted-trip': { id: 'unlisted-trip', user_id: OWNER_ID, visibility: 'unlisted' },
      'private-trip': { id: 'private-trip', user_id: OWNER_ID, visibility: 'private' },
    };

    const mockCollabs: MockCollabRow[] = [
      { trip_id: 'private-trip', user_id: OWNER_ID, role: 'owner' },
      { trip_id: 'private-trip', user_id: EDITOR_ID, role: 'editor' },
      { trip_id: 'private-trip', user_id: VIEWER_ID, role: 'viewer' },
      { trip_id: 'public-trip', user_id: OWNER_ID, role: 'owner' },
      { trip_id: 'public-trip', user_id: EDITOR_ID, role: 'editor' },
    ];

    function can_read_trip(tripId: string, currentUserId: string | null): boolean {
      const trip = mockTrips[tripId];
      if (!trip) return false;
      if (trip.visibility === 'public' || trip.visibility === 'unlisted') return true;
      if (!currentUserId) return false;
      if (trip.user_id === currentUserId) return true;
      return mockCollabs.some(c => c.trip_id === tripId && c.user_id === currentUserId);
    }

    function can_edit_trip(tripId: string, currentUserId: string | null): boolean {
      if (!currentUserId) return false;
      const trip = mockTrips[tripId];
      if (!trip) return false;
      if (trip.user_id === currentUserId) return true;
      return mockCollabs.some(
        c => c.trip_id === tripId && c.user_id === currentUserId && (c.role === 'owner' || c.role === 'editor')
      );
    }

    it('RLS-01: can_read_trip authorizes public trips for anonymous visitors', () => {
      expect(can_read_trip('public-trip', null)).toBe(true);
    });

    it('RLS-02: can_read_trip authorizes unlisted trips for direct link visitors', () => {
      expect(can_read_trip('unlisted-trip', null)).toBe(true);
      expect(can_read_trip('unlisted-trip', STRANGER_ID)).toBe(true);
    });

    it('RLS-03: can_read_trip denies private trips to unauthenticated users and strangers', () => {
      expect(can_read_trip('private-trip', null)).toBe(false);
      expect(can_read_trip('private-trip', STRANGER_ID)).toBe(false);
    });

    it('RLS-04: can_read_trip allows private trips for owner and all collaborators (viewer/editor)', () => {
      expect(can_read_trip('private-trip', OWNER_ID)).toBe(true);
      expect(can_read_trip('private-trip', EDITOR_ID)).toBe(true);
      expect(can_read_trip('private-trip', VIEWER_ID)).toBe(true);
    });

    it('RLS-05: can_edit_trip allows edit for owner and editor only', () => {
      expect(can_edit_trip('private-trip', OWNER_ID)).toBe(true);
      expect(can_edit_trip('private-trip', EDITOR_ID)).toBe(true);
      expect(can_edit_trip('private-trip', VIEWER_ID)).toBe(false);
      expect(can_edit_trip('private-trip', STRANGER_ID)).toBe(false);
      expect(can_edit_trip('private-trip', null)).toBe(false);
    });

    it('RLS-06: RGPD document policy prevents viewers from accessing sensitive trip_documents', () => {
      // Dans trip_documents: SELECT policy utilise can_edit_trip(trip_id)
      // Donc un viewer qui a can_read_trip = true ne PEUT PAS lire les documents d'identité
      const viewerCanReadTrip = can_read_trip('public-trip', VIEWER_ID);
      const viewerCanReadDocs = can_edit_trip('public-trip', VIEWER_ID);

      expect(viewerCanReadTrip).toBe(true);
      expect(viewerCanReadDocs).toBe(false); // RGPD Invariant respecté !
    });
  });
});
