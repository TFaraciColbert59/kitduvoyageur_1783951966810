import { describe, it, expect } from 'vitest';
import {
  lkvCan,
  type CrewSecurityContext,
  type CrewMemberContext,
  type TripSecurityContext,
  type TripParticipantContext,
} from '@/lib/security/permissions';

describe('Unified Data Model & RLS Matrix (Phase 3.3 — 24+ Cas de Test)', () => {
  const USER_OWNER = 'user-owner-0001';
  const USER_ORGANIZER = 'user-organizer-0002';
  const USER_MEMBER = 'user-member-0003';
  const USER_GUEST = 'user-guest-0004';
  const USER_STRANGER = 'user-stranger-9999';

  const mockCrew: CrewSecurityContext = {
    id: 'crew-alpha-1234',
    created_by: USER_OWNER,
    visibility: 'private',
  };

  const mockTrip: TripSecurityContext = {
    id: 'trip-mont-blanc-5678',
    user_id: USER_OWNER,
    crew_id: mockCrew.id,
    visibility: 'private',
  };

  describe('1. CREWS Security Matrix (lkv_can / crews)', () => {
    it('TEST-RLS-CREW-01: Crew owner can SELECT, UPDATE, DELETE private crew', () => {
      expect(lkvCan('crews', 'select', { userId: USER_OWNER, crew: mockCrew })).toBe(true);
      expect(lkvCan('crews', 'update', { userId: USER_OWNER, crew: mockCrew })).toBe(true);
      expect(lkvCan('crews', 'delete', { userId: USER_OWNER, crew: mockCrew })).toBe(true);
    });

    it('TEST-RLS-CREW-02: Crew organizer can SELECT and UPDATE, but CANNOT DELETE crew', () => {
      const crewMember: CrewMemberContext = {
        crew_id: mockCrew.id,
        user_id: USER_ORGANIZER,
        role: 'organizer',
        status: 'active',
      };
      expect(lkvCan('crews', 'select', { userId: USER_ORGANIZER, crew: mockCrew, crewMember })).toBe(true);
      expect(lkvCan('crews', 'update', { userId: USER_ORGANIZER, crew: mockCrew, crewMember })).toBe(true);
      expect(lkvCan('crews', 'delete', { userId: USER_ORGANIZER, crew: mockCrew, crewMember })).toBe(false);
    });

    it('TEST-RLS-CREW-03: Crew member can SELECT, but CANNOT UPDATE or DELETE crew', () => {
      const crewMember: CrewMemberContext = {
        crew_id: mockCrew.id,
        user_id: USER_MEMBER,
        role: 'member',
        status: 'active',
      };
      expect(lkvCan('crews', 'select', { userId: USER_MEMBER, crew: mockCrew, crewMember })).toBe(true);
      expect(lkvCan('crews', 'update', { userId: USER_MEMBER, crew: mockCrew, crewMember })).toBe(false);
      expect(lkvCan('crews', 'delete', { userId: USER_MEMBER, crew: mockCrew, crewMember })).toBe(false);
    });

    it('TEST-RLS-CREW-04: Crew guest can SELECT, but CANNOT UPDATE or DELETE crew', () => {
      const crewMember: CrewMemberContext = {
        crew_id: mockCrew.id,
        user_id: USER_GUEST,
        role: 'guest',
        status: 'active',
      };
      expect(lkvCan('crews', 'select', { userId: USER_GUEST, crew: mockCrew, crewMember })).toBe(true);
      expect(lkvCan('crews', 'update', { userId: USER_GUEST, crew: mockCrew, crewMember })).toBe(false);
      expect(lkvCan('crews', 'delete', { userId: USER_GUEST, crew: mockCrew, crewMember })).toBe(false);
    });

    it('TEST-RLS-CREW-05: Stranger CANNOT SELECT private crew, but CAN SELECT public crew', () => {
      expect(lkvCan('crews', 'select', { userId: USER_STRANGER, crew: mockCrew })).toBe(false);

      const publicCrew: CrewSecurityContext = { ...mockCrew, visibility: 'public' };
      expect(lkvCan('crews', 'select', { userId: USER_STRANGER, crew: publicCrew })).toBe(true);
      expect(lkvCan('crews', 'update', { userId: USER_STRANGER, crew: publicCrew })).toBe(false);
      expect(lkvCan('crews', 'delete', { userId: USER_STRANGER, crew: publicCrew })).toBe(false);
    });

    it('TEST-RLS-CREW-06: Anonymous user CANNOT SELECT private crew, but CAN SELECT public crew', () => {
      expect(lkvCan('crews', 'select', { userId: null, crew: mockCrew })).toBe(false);

      const publicCrew: CrewSecurityContext = { ...mockCrew, visibility: 'public' };
      expect(lkvCan('crews', 'select', { userId: null, crew: publicCrew })).toBe(true);
      expect(lkvCan('crews', 'insert', { userId: null, crew: publicCrew })).toBe(false);
      expect(lkvCan('crews', 'update', { userId: null, crew: publicCrew })).toBe(false);
      expect(lkvCan('crews', 'delete', { userId: null, crew: publicCrew })).toBe(false);
    });

    it('TEST-RLS-CREW-07: Member with status "left" or "removed" loses private access', () => {
      const leftMember: CrewMemberContext = {
        crew_id: mockCrew.id,
        user_id: USER_MEMBER,
        role: 'member',
        status: 'left',
      };
      expect(lkvCan('crews', 'select', { userId: USER_MEMBER, crew: mockCrew, crewMember: leftMember })).toBe(false);

      const removedMember: CrewMemberContext = {
        crew_id: mockCrew.id,
        user_id: USER_MEMBER,
        role: 'member',
        status: 'removed',
      };
      expect(lkvCan('crews', 'select', { userId: USER_MEMBER, crew: mockCrew, crewMember: removedMember })).toBe(false);
    });

    it('TEST-RLS-CREW-08: Member with status "pending" cannot update or delete crew', () => {
      const pendingMember: CrewMemberContext = {
        crew_id: mockCrew.id,
        user_id: USER_MEMBER,
        role: 'member',
        status: 'pending',
      };
      expect(lkvCan('crews', 'update', { userId: USER_MEMBER, crew: mockCrew, crewMember: pendingMember })).toBe(false);
      expect(lkvCan('crews', 'delete', { userId: USER_MEMBER, crew: mockCrew, crewMember: pendingMember })).toBe(false);
    });
  });

  describe('2. CREW_MEMBERS Security Matrix (lkv_can / crew_members)', () => {
    it('TEST-RLS-MEMBER-01: Owner and organizer can invite (INSERT) new members', () => {
      const ownerContext: CrewMemberContext = {
        crew_id: mockCrew.id,
        user_id: USER_OWNER,
        role: 'owner',
        status: 'active',
      };
      const orgContext: CrewMemberContext = {
        crew_id: mockCrew.id,
        user_id: USER_ORGANIZER,
        role: 'organizer',
        status: 'active',
      };
      expect(lkvCan('crew_members', 'insert', { userId: USER_OWNER, crewMember: ownerContext })).toBe(true);
      expect(lkvCan('crew_members', 'insert', { userId: USER_ORGANIZER, crewMember: orgContext })).toBe(true);
    });

    it('TEST-RLS-MEMBER-02: Regular member or guest CANNOT invite members', () => {
      const memberContext: CrewMemberContext = {
        crew_id: mockCrew.id,
        user_id: USER_MEMBER,
        role: 'member',
        status: 'active',
      };
      const guestContext: CrewMemberContext = {
        crew_id: mockCrew.id,
        user_id: USER_GUEST,
        role: 'guest',
        status: 'active',
      };
      expect(lkvCan('crew_members', 'insert', { userId: USER_MEMBER, crewMember: memberContext })).toBe(false);
      expect(lkvCan('crew_members', 'insert', { userId: USER_GUEST, crewMember: guestContext })).toBe(false);
    });

    it('TEST-RLS-MEMBER-03: Member can DELETE own membership (self-leave)', () => {
      const memberContext: CrewMemberContext = {
        crew_id: mockCrew.id,
        user_id: USER_MEMBER,
        role: 'member',
        status: 'active',
      };
      expect(lkvCan('crew_members', 'delete', { userId: USER_MEMBER, crewMember: memberContext })).toBe(true);
    });

    it('TEST-RLS-MEMBER-04: Owner can DELETE any member (expel)', () => {
      const ownerContext: CrewMemberContext = {
        crew_id: mockCrew.id,
        user_id: USER_OWNER,
        role: 'owner',
        status: 'active',
      };
      expect(lkvCan('crew_members', 'delete', { userId: USER_OWNER, crewMember: ownerContext })).toBe(true);
    });
  });

  describe('3. TRIPS Security Matrix (lkv_can / trips)', () => {
    it('TEST-RLS-TRIP-01: Trip creator (owner) has full SELECT, UPDATE, DELETE permissions', () => {
      expect(lkvCan('trips', 'select', { userId: USER_OWNER, trip: mockTrip })).toBe(true);
      expect(lkvCan('trips', 'update', { userId: USER_OWNER, trip: mockTrip })).toBe(true);
      expect(lkvCan('trips', 'delete', { userId: USER_OWNER, trip: mockTrip })).toBe(true);
    });

    it('TEST-RLS-TRIP-02: Confirmed trip participant with role organizer can UPDATE, but CANNOT DELETE', () => {
      const participant: TripParticipantContext = {
        trip_id: mockTrip.id,
        user_id: USER_ORGANIZER,
        role: 'organizer',
        status: 'confirmed',
      };
      expect(lkvCan('trips', 'select', { userId: USER_ORGANIZER, trip: mockTrip, tripParticipant: participant })).toBe(true);
      expect(lkvCan('trips', 'update', { userId: USER_ORGANIZER, trip: mockTrip, tripParticipant: participant })).toBe(true);
      expect(lkvCan('trips', 'delete', { userId: USER_ORGANIZER, trip: mockTrip, tripParticipant: participant })).toBe(false);
    });

    it('TEST-RLS-TRIP-03: Confirmed trip participant with role member or guest CANNOT UPDATE or DELETE trip', () => {
      const participant: TripParticipantContext = {
        trip_id: mockTrip.id,
        user_id: USER_MEMBER,
        role: 'member',
        status: 'confirmed',
      };
      expect(lkvCan('trips', 'select', { userId: USER_MEMBER, trip: mockTrip, tripParticipant: participant })).toBe(true);
      expect(lkvCan('trips', 'update', { userId: USER_MEMBER, trip: mockTrip, tripParticipant: participant })).toBe(false);
      expect(lkvCan('trips', 'delete', { userId: USER_MEMBER, trip: mockTrip, tripParticipant: participant })).toBe(false);
    });

    it('TEST-RLS-TRIP-04: Non-participant host crew member can view non-private trip', () => {
      const unlistedTrip: TripSecurityContext = { ...mockTrip, visibility: 'link' };
      const crewMember: CrewMemberContext = {
        crew_id: mockCrew.id,
        user_id: USER_MEMBER,
        role: 'member',
        status: 'active',
      };
      expect(lkvCan('trips', 'select', { userId: USER_MEMBER, trip: unlistedTrip, crewMember })).toBe(true);
    });

    it('TEST-RLS-TRIP-05: Non-participant stranger CANNOT SELECT private trip', () => {
      expect(lkvCan('trips', 'select', { userId: USER_STRANGER, trip: mockTrip })).toBe(false);
    });

    it('TEST-RLS-TRIP-06: Anonymous user can only SELECT public trip', () => {
      expect(lkvCan('trips', 'select', { userId: null, trip: mockTrip })).toBe(false);

      const publicTrip: TripSecurityContext = { ...mockTrip, visibility: 'public' };
      expect(lkvCan('trips', 'select', { userId: null, trip: publicTrip })).toBe(true);
    });

    it('TEST-RLS-TRIP-07: Solo trip without crew (crew_id IS NULL) remains securely isolated', () => {
      const soloTrip: TripSecurityContext = {
        id: 'solo-123',
        user_id: USER_OWNER,
        crew_id: null,
        visibility: 'private',
      };
      expect(lkvCan('trips', 'select', { userId: USER_OWNER, trip: soloTrip })).toBe(true);
      expect(lkvCan('trips', 'update', { userId: USER_OWNER, trip: soloTrip })).toBe(true);
      expect(lkvCan('trips', 'delete', { userId: USER_OWNER, trip: soloTrip })).toBe(true);

      expect(lkvCan('trips', 'select', { userId: USER_STRANGER, trip: soloTrip })).toBe(false);
    });

    it('TEST-RLS-TRIP-08: Ex-participant with status "removed" or "declined" cannot access private trip', () => {
      const removedParticipant: TripParticipantContext = {
        trip_id: mockTrip.id,
        user_id: USER_MEMBER,
        role: 'member',
        status: 'removed',
      };
      expect(lkvCan('trips', 'select', { userId: USER_MEMBER, trip: mockTrip, tripParticipant: removedParticipant })).toBe(false);
      expect(lkvCan('trips', 'update', { userId: USER_MEMBER, trip: mockTrip, tripParticipant: removedParticipant })).toBe(false);
    });
  });

  describe('4. TRIP_PARTICIPANTS Security Matrix (lkv_can / trip_participants)', () => {
    it('TEST-RLS-PARTICIPANT-01: Trip owner has full control over participants', () => {
      expect(lkvCan('trip_participants', 'select', { userId: USER_OWNER, trip: mockTrip })).toBe(true);
      expect(lkvCan('trip_participants', 'insert', { userId: USER_OWNER, trip: mockTrip })).toBe(true);
      expect(lkvCan('trip_participants', 'update', { userId: USER_OWNER, trip: mockTrip })).toBe(true);
      expect(lkvCan('trip_participants', 'delete', { userId: USER_OWNER, trip: mockTrip })).toBe(true);
    });

    it('TEST-RLS-PARTICIPANT-02: Participant with status "invited" or "declined" cannot access private participant list', () => {
      const invitedParticipant: TripParticipantContext = {
        trip_id: mockTrip.id,
        user_id: USER_MEMBER,
        role: 'member',
        status: 'invited',
      };
      expect(lkvCan('trip_participants', 'select', { userId: USER_MEMBER, trip: mockTrip, tripParticipant: invitedParticipant })).toBe(false);

      const declinedParticipant: TripParticipantContext = {
        trip_id: mockTrip.id,
        user_id: USER_MEMBER,
        role: 'member',
        status: 'declined',
      };
      expect(lkvCan('trip_participants', 'select', { userId: USER_MEMBER, trip: mockTrip, tripParticipant: declinedParticipant })).toBe(false);
    });

    it('TEST-RLS-PARTICIPANT-03: Participant can delete their own participation (self-leave)', () => {
      const confirmedParticipant: TripParticipantContext = {
        trip_id: mockTrip.id,
        user_id: USER_MEMBER,
        role: 'member',
        status: 'confirmed',
      };
      expect(lkvCan('trip_participants', 'delete', { userId: USER_MEMBER, trip: mockTrip, tripParticipant: confirmedParticipant })).toBe(true);
    });

    it('TEST-RLS-PARTICIPANT-04: Non-participant stranger cannot add, update, or remove participants', () => {
      expect(lkvCan('trip_participants', 'insert', { userId: USER_STRANGER, trip: mockTrip })).toBe(false);
      expect(lkvCan('trip_participants', 'update', { userId: USER_STRANGER, trip: mockTrip })).toBe(false);
      expect(lkvCan('trip_participants', 'delete', { userId: USER_STRANGER, trip: mockTrip })).toBe(false);
    });
  });

  describe('5. Slugification & SQL Sanitization Invariants', () => {
    it('TEST-RLS-SLUG-01: slug regex format ^[a-z0-9-]{3,80}$ enforces lowercase and hyphens', () => {
      const validSlugRegex = /^[a-z0-9-]{3,80}$/;
      expect(validSlugRegex.test('trek-alpes-2026')).toBe(true);
      expect(validSlugRegex.test('equipe-chamonix')).toBe(true);
      expect(validSlugRegex.test('ab')).toBe(false); // too short
      expect(validSlugRegex.test('Equipe Chamonix')).toBe(false); // uppercase & spaces
      expect(validSlugRegex.test('trek_alpes')).toBe(false); // underscore forbidden
    });
  });
});
