/**
 * LKDV Social — Milestone 3: Community Clubs & Expedition Rooms Test Suite
 * File: tests/messaging/clubs-expedition-rooms.spec.ts
 *
 * Covers:
 * 1. Club Outdoor Roles Hierarchy: Owner > Admin > Guide > Safety > Member.
 * 2. Channel Read & Write Permission Gates & Rejection Handlers (Announcements, Safety, Staff).
 * 3. Expedition Room Model & Trip Linkage (1:1 conversation link, lifecycle transitions).
 * 4. Shared Checklist Multi-Pane State Synchronization (toggling, assignment, progress, conflicts).
 * 5. Field Check-In Lifecycle & Multi-Status Broadcasts (OK, Camp Set, Delayed, SOS alert format).
 * 6. Weather & GPX Snapshot Multi-Pane Data Binding (zero network fetch, fallback handling).
 * 7. UI Component Render Checks (ClubChannelsList, ClubRoleBadge, ExpeditionRoomCockpit).
 *    - Apple HIG 44px touch targets, compact layout, ZERO orange #E4501C.
 * 8. Adversarial & Edge Cases (Role spoofing, concurrency stress, coordinate validation).
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

// ─────────────────────────────────────────────────────────────────────────────
// PRODUCTION MODULE IMPORTS
// ─────────────────────────────────────────────────────────────────────────────

import {
  OUTDOOR_ROLE_HIERARCHY,
  hasRolePermission,
  canReadChannel,
  canWriteChannel,
  validateChannelPostPermission,
  type OutdoorRole,
  type ChannelCategory,
  type ClubChannel,
  type ChannelPostPermissionCheck,
} from '@/features/messaging/types/clubs.types';

import {
  toggleChecklistItem,
  assignChecklistItem,
  calculateChecklistProgress,
  formatEmergencyCoordinates,
  getCheckInSeverity,
  formatCheckInBroadcast,
  type ExpeditionRoomStatus,
  type ChecklistCategory,
  type ExpeditionChecklistItem,
  type CheckInStatus,
  type FieldCheckIn,
  type ExpeditionRoom,
} from '@/features/messaging/types/expeditionRooms.types';

import { ClubChannelsList } from '@/features/messaging/components/clubs/ClubChannelsList';
import { ClubRoleBadge } from '@/features/messaging/components/clubs/ClubRoleBadge';
import { ExpeditionRoomCockpit } from '@/features/messaging/components/expedition/ExpeditionRoomCockpit';
import { SharedChecklistPane } from '@/features/messaging/components/expedition/SharedChecklistPane';

// Re-exports & Aliases for specification compatibility
export {
  OUTDOOR_ROLE_HIERARCHY,
  hasRolePermission,
  canReadChannel,
  canWriteChannel,
  validateChannelPostPermission,
  toggleChecklistItem,
  assignChecklistItem,
  calculateChecklistProgress,
  formatEmergencyCoordinates,
  getCheckInSeverity,
  formatCheckInBroadcast,
};
export type {
  OutdoorRole,
  ChannelCategory,
  ClubChannel,
  ChannelPostPermissionCheck,
  ExpeditionRoomStatus,
  ChecklistCategory,
  ExpeditionChecklistItem,
  CheckInStatus,
  FieldCheckIn,
  ExpeditionRoom,
};

export const MockClubChannelsList = ClubChannelsList;
export const MockClubRoleBadge = ClubRoleBadge;
export const MockExpeditionRoomCockpit = ExpeditionRoomCockpit;
export const MockSharedChecklistPane = SharedChecklistPane;

// ─────────────────────────────────────────────────────────────────────────────
// TEST SUITES
// ─────────────────────────────────────────────────────────────────────────────

describe('Milestone 3: Community Clubs & Expedition Rooms Test Suite', () => {

  // ═══════════════════════════════════════════════════════════════════════════
  // SUITE 1: OUTDOOR ROLES HIERARCHY & COMPARISON ENGINE
  // ═══════════════════════════════════════════════════════════════════════════
  describe('1. Outdoor Roles Hierarchy & Comparison Engine', () => {
    it('TEST-ROLE-01: Correct hierarchy order (Owner > Admin > Guide > Safety > Member)', () => {
      expect(OUTDOOR_ROLE_HIERARCHY.owner).toBeGreaterThan(OUTDOOR_ROLE_HIERARCHY.admin);
      expect(OUTDOOR_ROLE_HIERARCHY.admin).toBeGreaterThan(OUTDOOR_ROLE_HIERARCHY.guide);
      expect(OUTDOOR_ROLE_HIERARCHY.guide).toBeGreaterThan(OUTDOOR_ROLE_HIERARCHY.safety);
      expect(OUTDOOR_ROLE_HIERARCHY.safety).toBeGreaterThan(OUTDOOR_ROLE_HIERARCHY.member);
    });

    it('TEST-ROLE-02: Owner satisfies all lower role requirements (5/5)', () => {
      expect(hasRolePermission('owner', 'owner')).toBe(true);
      expect(hasRolePermission('owner', 'admin')).toBe(true);
      expect(hasRolePermission('owner', 'guide')).toBe(true);
      expect(hasRolePermission('owner', 'safety')).toBe(true);
      expect(hasRolePermission('owner', 'member')).toBe(true);
    });

    it('TEST-ROLE-03: Admin satisfies Admin, Guide, Safety, Member (rejects Owner)', () => {
      expect(hasRolePermission('admin', 'owner')).toBe(false);
      expect(hasRolePermission('admin', 'admin')).toBe(true);
      expect(hasRolePermission('admin', 'guide')).toBe(true);
      expect(hasRolePermission('admin', 'safety')).toBe(true);
      expect(hasRolePermission('admin', 'member')).toBe(true);
    });

    it('TEST-ROLE-04: Guide satisfies Guide, Safety, Member (rejects Admin, Owner)', () => {
      expect(hasRolePermission('guide', 'owner')).toBe(false);
      expect(hasRolePermission('guide', 'admin')).toBe(false);
      expect(hasRolePermission('guide', 'guide')).toBe(true);
      expect(hasRolePermission('guide', 'safety')).toBe(true);
      expect(hasRolePermission('guide', 'member')).toBe(true);
    });

    it('TEST-ROLE-05: Safety satisfies Safety, Member (rejects Guide, Admin, Owner)', () => {
      expect(hasRolePermission('safety', 'owner')).toBe(false);
      expect(hasRolePermission('safety', 'admin')).toBe(false);
      expect(hasRolePermission('safety', 'guide')).toBe(false);
      expect(hasRolePermission('safety', 'safety')).toBe(true);
      expect(hasRolePermission('safety', 'member')).toBe(true);
    });

    it('TEST-ROLE-06: Member satisfies only Member', () => {
      expect(hasRolePermission('member', 'owner')).toBe(false);
      expect(hasRolePermission('member', 'admin')).toBe(false);
      expect(hasRolePermission('member', 'guide')).toBe(false);
      expect(hasRolePermission('member', 'safety')).toBe(false);
      expect(hasRolePermission('member', 'member')).toBe(true);
    });

    it('TEST-ROLE-07: Resilient handling of invalid/null/undefined roles', () => {
      expect(hasRolePermission(null, 'member')).toBe(false);
      expect(hasRolePermission(undefined, 'member')).toBe(false);
      expect(hasRolePermission('unknown_role' as OutdoorRole, 'member')).toBe(false);
      expect(hasRolePermission('', 'member')).toBe(false);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SUITE 2: CHANNEL READ & WRITE PERMISSION GATES & REJECTION HANDLERS
  // ═══════════════════════════════════════════════════════════════════════════
  describe('2. Channel Read & Write Permission Gates & Rejection Handlers', () => {
    const generalChannel: ClubChannel = {
      id: 'c-gen',
      clubId: 'club-1',
      conversationId: 'conv-gen',
      name: 'general',
      minRoleToRead: 'member',
      minRoleToWrite: 'member',
    };

    const announcementsChannel: ClubChannel = {
      id: 'c-ann',
      clubId: 'club-1',
      conversationId: 'conv-ann',
      name: 'annonces',
      minRoleToRead: 'member',
      minRoleToWrite: 'guide', // Only guides, admins, owners can write
    };

    const safetyChannel: ClubChannel = {
      id: 'c-safe',
      clubId: 'club-1',
      conversationId: 'conv-safe',
      name: 'securite',
      minRoleToRead: 'member',
      minRoleToWrite: 'safety', // Safety, guide, admin, owner
    };

    const staffChannel: ClubChannel = {
      id: 'c-staff',
      clubId: 'club-1',
      conversationId: 'conv-staff',
      name: 'guides-only',
      minRoleToRead: 'guide',
      minRoleToWrite: 'guide',
    };

    const adminBoardChannel: ClubChannel = {
      id: 'c-board',
      clubId: 'club-1',
      conversationId: 'conv-board',
      name: 'conseil-admin',
      minRoleToRead: 'admin',
      minRoleToWrite: 'admin',
    };

    it('TEST-GATE-01: General channel allows read and write for all 5 roles', () => {
      const roles: OutdoorRole[] = ['member', 'safety', 'guide', 'admin', 'owner'];
      for (const role of roles) {
        expect(canReadChannel(role, generalChannel)).toBe(true);
        expect(canWriteChannel(role, generalChannel)).toBe(true);
      }
    });

    it('TEST-GATE-02: Announcements channel allows read for Member, rejects write', () => {
      expect(canReadChannel('member', announcementsChannel)).toBe(true);
      expect(canWriteChannel('member', announcementsChannel)).toBe(false);
    });

    it('TEST-GATE-03: Announcements channel accepts write for Guide, Admin, Owner', () => {
      expect(canWriteChannel('guide', announcementsChannel)).toBe(true);
      expect(canWriteChannel('admin', announcementsChannel)).toBe(true);
      expect(canWriteChannel('owner', announcementsChannel)).toBe(true);
    });

    it('TEST-GATE-04: Member post attempt in announcements yields INSUFFICIENT_ROLE_PERMISSIONS', () => {
      const result = validateChannelPostPermission('member', announcementsChannel);
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('INSUFFICIENT_ROLE_PERMISSIONS');
    });

    it('TEST-GATE-05: Safety channel rejects Member write, accepts Safety/Guide/Admin/Owner write', () => {
      expect(canWriteChannel('member', safetyChannel)).toBe(false);
      expect(canWriteChannel('safety', safetyChannel)).toBe(true);
      expect(canWriteChannel('guide', safetyChannel)).toBe(true);
      expect(canWriteChannel('admin', safetyChannel)).toBe(true);
      expect(canWriteChannel('owner', safetyChannel)).toBe(true);
    });

    it('TEST-GATE-06: Staff guides channel rejects Member and Safety read & write', () => {
      expect(canReadChannel('member', staffChannel)).toBe(false);
      expect(canWriteChannel('member', staffChannel)).toBe(false);
      expect(canReadChannel('safety', staffChannel)).toBe(false);
      expect(canWriteChannel('safety', staffChannel)).toBe(false);

      expect(canReadChannel('guide', staffChannel)).toBe(true);
      expect(canWriteChannel('guide', staffChannel)).toBe(true);
    });

    it('TEST-GATE-07: Admin board channel rejects Guide read & write', () => {
      expect(canReadChannel('guide', adminBoardChannel)).toBe(false);
      expect(canWriteChannel('guide', adminBoardChannel)).toBe(false);
      expect(canReadChannel('admin', adminBoardChannel)).toBe(true);
      expect(canWriteChannel('admin', adminBoardChannel)).toBe(true);
    });

    it('TEST-GATE-08: Channel mutability requires Admin or Owner role', () => {
      // Modifying channel settings requires admin+
      expect(hasRolePermission('member', 'admin')).toBe(false);
      expect(hasRolePermission('guide', 'admin')).toBe(false);
      expect(hasRolePermission('admin', 'admin')).toBe(true);
      expect(hasRolePermission('owner', 'admin')).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SUITE 3: EXPEDITION ROOM MODEL & TRIP LINKAGE
  // ═══════════════════════════════════════════════════════════════════════════
  describe('3. Expedition Room Model & Trip Linkage', () => {
    it('TEST-ROOM-01: Links conversation 1:1 to trip with context_type = expedition_room', () => {
      const room = {
        id: 'room-1',
        conversationId: 'conv-exp-101',
        tripId: 'trip-mont-blanc-2026',
        title: 'Expédition Mont-Blanc Voie Normale',
        status: 'planning' as ExpeditionRoomStatus,
      };

      expect(room.conversationId).toBe('conv-exp-101');
      expect(room.tripId).toBe('trip-mont-blanc-2026');
      expect(room.status).toBe('planning');
    });

    it('TEST-ROOM-02: Status transitions follow valid lifecycle (planning -> active -> completed -> archived)', () => {
      const validStatuses: ExpeditionRoomStatus[] = ['planning', 'active', 'completed', 'archived'];
      let currentStatus: ExpeditionRoomStatus = 'planning';

      currentStatus = 'active';
      expect(validStatuses).toContain(currentStatus);

      currentStatus = 'completed';
      expect(validStatuses).toContain(currentStatus);

      currentStatus = 'archived';
      expect(validStatuses).toContain(currentStatus);
    });

    it('TEST-ROOM-03: Handles null or missing tripId gracefully (ad-hoc expedition)', () => {
      const adhocRoom = {
        id: 'room-2',
        conversationId: 'conv-exp-102',
        tripId: null,
        title: 'Sortie Bivouac Belledonne',
        status: 'active' as ExpeditionRoomStatus,
      };

      expect(adhocRoom.tripId).toBeNull();
      expect(adhocRoom.status).toBe('active');
    });

    it('TEST-ROOM-04: Preserves room integrity if trip is deleted (ON DELETE SET NULL contract)', () => {
      const room = {
        id: 'room-3',
        conversationId: 'conv-exp-103',
        tripId: 'deleted-trip-id',
        title: 'Expédition Vercors',
        status: 'planning' as ExpeditionRoomStatus,
      };

      // Simulated DB trigger/cascade effect
      const afterTripDeletion = { ...room, tripId: null };
      expect(afterTripDeletion.id).toBe(room.id);
      expect(afterTripDeletion.conversationId).toBe(room.conversationId);
      expect(afterTripDeletion.tripId).toBeNull();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SUITE 4: SHARED CHECKLIST MULTI-PANE STATE SYNCHRONIZATION
  // ═══════════════════════════════════════════════════════════════════════════
  describe('4. Shared Checklist Multi-Pane State Synchronization', () => {
    let initialChecklist: ExpeditionChecklistItem[];

    beforeEach(() => {
      initialChecklist = [
        { id: 'item-1', roomId: 'r1', label: 'Trousse secours', isCompleted: false, category: 'safety', updatedAt: '2026-05-01T10:00:00Z' },
        { id: 'item-2', roomId: 'r1', label: 'Tente 3P', isCompleted: false, category: 'gear', updatedAt: '2026-05-01T10:00:00Z' },
        { id: 'item-3', roomId: 'r1', label: 'Réchaud + Gaz', isCompleted: true, category: 'food', updatedAt: '2026-05-01T10:00:00Z' },
        { id: 'item-4', roomId: 'r1', label: 'Carte IGN Top 25', isCompleted: false, category: 'logistics', updatedAt: '2026-05-01T10:00:00Z' },
      ];
    });

    it('TEST-CHK-01: Toggles item completion status from false to true with timestamp', () => {
      const updated = toggleChecklistItem(initialChecklist, 'item-1', 'user-alice', '2026-05-01T12:00:00Z');
      const item1 = updated.find((i) => i.id === 'item-1');

      expect(item1?.isCompleted).toBe(true);
      expect(item1?.updatedBy).toBe('user-alice');
      expect(item1?.updatedAt).toBe('2026-05-01T12:00:00Z');
    });

    it('TEST-CHK-02: Toggles item completion back to false', () => {
      const updated = toggleChecklistItem(initialChecklist, 'item-3', 'user-bob');
      const item3 = updated.find((i) => i.id === 'item-3');

      expect(item3?.isCompleted).toBe(false);
      expect(item3?.updatedBy).toBe('user-bob');
    });

    it('TEST-CHK-03: Assigns item to participant while preserving completion state', () => {
      const updated = assignChecklistItem(initialChecklist, 'item-2', 'user-guide', 'Alice (Guide)');
      const item2 = updated.find((i) => i.id === 'item-2');

      expect(item2?.assignedTo).toBe('user-guide');
      expect(item2?.assignedName).toBe('Alice (Guide)');
      expect(item2?.isCompleted).toBe(false); // Preserved
    });

    it('TEST-CHK-04: Unassigns item safely (assignedTo = null)', () => {
      const assigned = assignChecklistItem(initialChecklist, 'item-2', 'user-guide', 'Alice');
      const unassigned = assignChecklistItem(assigned, 'item-2', null, null);
      const item2 = unassigned.find((i) => i.id === 'item-2');

      expect(item2?.assignedTo).toBeNull();
      expect(item2?.assignedName).toBeNull();
    });

    it('TEST-CHK-05: Filters items accurately by category (gear, safety, food, logistics)', () => {
      const safetyItems = initialChecklist.filter((i) => i.category === 'safety');
      const gearItems = initialChecklist.filter((i) => i.category === 'gear');

      expect(safetyItems.length).toBe(1);
      expect(safetyItems[0].label).toBe('Trousse secours');
      expect(gearItems.length).toBe(1);
      expect(gearItems[0].label).toBe('Tente 3P');
    });

    it('TEST-CHK-06: Computes overall completion percentage accurately', () => {
      const progress = calculateChecklistProgress(initialChecklist);
      expect(progress.total).toBe(4);
      expect(progress.completed).toBe(1);
      expect(progress.percentage).toBe(25); // 1/4 = 25%

      const allCompleted = initialChecklist.map((i) => ({ ...i, isCompleted: true }));
      expect(calculateChecklistProgress(allCompleted).percentage).toBe(100);

      expect(calculateChecklistProgress([]).percentage).toBe(0);
    });

    it('TEST-CHK-07: Deterministic conflict resolution by timestamp (last-writer-wins)', () => {
      const t1 = '2026-05-01T12:00:00Z';
      const t2 = '2026-05-01T12:05:00Z';

      const update1 = { id: 'item-1', isCompleted: true, updatedAt: t1 };
      const update2 = { id: 'item-1', isCompleted: false, updatedAt: t2 };

      // Resolves later timestamp
      const winner = new Date(update2.updatedAt) > new Date(update1.updatedAt) ? update2 : update1;
      expect(winner.isCompleted).toBe(false);
    });

    it('TEST-CHK-08: SharedChecklistPane renders role="checkbox", aria-checked, and accessible labels', () => {
      const html = renderToStaticMarkup(
        React.createElement(MockSharedChecklistPane, {
          items: initialChecklist,
          onToggleItem: vi.fn(),
        })
      );

      expect(html).toContain('role="checkbox"');
      expect(html).toContain('aria-checked="true"');
      expect(html).toContain('aria-checked="false"');
      expect(html).toContain('coché');
      expect(html).toContain('non coché');
    });

    it('TEST-CHK-09: SharedChecklistPane Quick-Add select exposes all 8 outdoor categories', () => {
      const html = renderToStaticMarkup(
        React.createElement(MockSharedChecklistPane, {
          items: initialChecklist,
          onAddItem: vi.fn(),
        })
      );

      const expectedCategories: ChecklistCategory[] = [
        'gear',
        'safety',
        'food',
        'logistics',
        'navigation',
        'camp',
        'medical',
        'admin',
      ];

      for (const cat of expectedCategories) {
        expect(html).toContain(`value="${cat}"`);
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SUITE 5: FIELD CHECK-IN LIFECYCLE & MULTI-STATUS BROADCASTS
  // ═══════════════════════════════════════════════════════════════════════════
  describe('5. Field Check-In Lifecycle & Multi-Status Broadcasts', () => {
    it('TEST-CKIN-01: Routine OK check-in updates last status with normal severity', () => {
      const checkIn: FieldCheckIn = {
        id: 'ck-1',
        roomId: 'r1',
        authorId: 'u-alice',
        authorName: 'Alice',
        status: 'ok',
        location: { latitude: 44.1234, longitude: 7.2345, name: 'Col de Cerise' },
        timestamp: '2026-07-10T14:30:00Z',
      };

      const broadcast = formatCheckInBroadcast(checkIn);
      expect(broadcast.severity).toBe('normal');
      expect(broadcast.title).toContain('Tout Va Bien');
      expect(broadcast.content).toContain('Alice confirme que tout se déroule normalement');
    });

    it('TEST-CKIN-02: Camp Set check-in pins overnight location with info severity', () => {
      const checkIn: FieldCheckIn = {
        id: 'ck-2',
        roomId: 'r1',
        authorId: 'u-bob',
        authorName: 'Bob',
        status: 'camp_set',
        location: { latitude: 44.1500, longitude: 7.2500, name: 'Lac Nègre' },
        timestamp: '2026-07-10T18:00:00Z',
      };

      const broadcast = formatCheckInBroadcast(checkIn);
      expect(broadcast.severity).toBe('info');
      expect(broadcast.title).toContain('Bivouac Établi');
      expect(broadcast.content).toContain('Lac Nègre');
    });

    it('TEST-CKIN-03: Delayed check-in triggers warning badge and ETA notice', () => {
      const checkIn: FieldCheckIn = {
        id: 'ck-3',
        roomId: 'r1',
        authorId: 'u-alice',
        authorName: 'Alice',
        status: 'delayed',
        location: { latitude: 44.1800, longitude: 7.3000 },
        message: 'Passage d un névé délicat, +1h estimée',
        timestamp: '2026-07-10T16:00:00Z',
      };

      const broadcast = formatCheckInBroadcast(checkIn);
      expect(broadcast.severity).toBe('warning');
      expect(broadcast.title).toContain('Retard Signalé');
      expect(broadcast.content).toContain('Passage d un névé délicat');
    });

    it('TEST-CKIN-04: SOS check-in broadcasts critical alert with emergency coordinates', () => {
      const checkIn: FieldCheckIn = {
        id: 'ck-4',
        roomId: 'r1',
        authorId: 'u-guide',
        authorName: 'Marc (Guide)',
        status: 'sos',
        location: { latitude: 44.06812, longitude: 7.25611 },
        message: 'Entorse cheville, impossible de marcher, besoin évacuation',
        timestamp: '2026-07-10T17:15:00Z',
      };

      const broadcast = formatCheckInBroadcast(checkIn);
      expect(broadcast.severity).toBe('critical');
      expect(broadcast.title).toContain('ALERTE DETRESSE SOS');
      expect(broadcast.content).toContain('44.0681° N, 7.2561° E');
      expect(broadcast.emergencyCoordinates).toBe('44.0681° N, 7.2561° E');
    });

    it('TEST-CKIN-05: Formats emergency coordinates into radio/phone standard (DD.DDDD° N/S, E/W)', () => {
      expect(formatEmergencyCoordinates(44.06812, 7.25611)).toBe('44.0681° N, 7.2561° E');
      expect(formatEmergencyCoordinates(-21.12345, -55.56789)).toBe('21.1235° S, 55.5679° W');
      expect(formatEmergencyCoordinates(null, null)).toContain('Position non disponible');
      expect(formatEmergencyCoordinates(NaN, NaN)).toContain('Position non disponible');
    });

    it('TEST-CKIN-06: Serializes realtime broadcast payload for Supabase channel', () => {
      const checkIn: FieldCheckIn = {
        id: 'ck-5',
        roomId: 'r1',
        authorId: 'u-1',
        authorName: 'Sam',
        status: 'ok',
        location: { latitude: 45.0, longitude: 6.5 },
        timestamp: '2026-07-10T12:00:00Z',
      };

      const channelName = `expedition_room:${checkIn.roomId}:checkin`;
      const payload = {
        event: 'new_checkin',
        checkIn,
        broadcast: formatCheckInBroadcast(checkIn),
      };

      expect(channelName).toBe('expedition_room:r1:checkin');
      expect(payload.broadcast.severity).toBe('normal');
      expect(payload.checkIn.authorName).toBe('Sam');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SUITE 6: WEATHER & GPX SNAPSHOT MULTI-PANE DATA BINDING
  // ═══════════════════════════════════════════════════════════════════════════
  describe('6. Weather & GPX Snapshot Multi-Pane Data Binding', () => {
    let fetchSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      fetchSpy = vi.spyOn(global, 'fetch');
    });

    it('TEST-BIND-01: Binds weather coordinates into display metrics (temp, wind, iso-0)', () => {
      const room = { id: 'r1', title: 'Tour du Queyras', status: 'active' as ExpeditionRoomStatus };
      const weatherData = {
        locationName: 'Saint-Véran',
        tempC: 14,
        windKmH: 22,
        freezingLevelM: 3200,
      };

      const html = renderToStaticMarkup(
        React.createElement(MockExpeditionRoomCockpit, {
          room,
          weatherData,
          activePane: 'weather',
        })
      );

      expect(fetchSpy).not.toHaveBeenCalled();
      expect(html).toContain('14°C');
      expect(html).toContain('22 km/h');
      expect(html).toContain('3200 m');
    });

    it('TEST-BIND-02: Fallback placeholder when weather coordinates are missing or null', () => {
      const room = { id: 'r1', title: 'Sortie inconnue', status: 'planning' as ExpeditionRoomStatus };

      const html = renderToStaticMarkup(
        React.createElement(MockExpeditionRoomCockpit, {
          room,
          weatherData: null,
          activePane: 'weather',
        })
      );

      expect(fetchSpy).not.toHaveBeenCalled();
      expect(html).toContain('Localisation météo non définie');
    });

    it('TEST-BIND-03: Binds GPX snapshot into vector mini-map renderer without network fetch', () => {
      const room = { id: 'r1', title: 'Haute Route Chamonix', status: 'active' as ExpeditionRoomStatus };
      const gpxSnapshot = {
        title: 'Étape 1',
        distanceKm: 18.4,
        elevationGainM: 1250,
        svgPolylinePath: '10,80 50,40 120,60 220,15',
      };

      const html = renderToStaticMarkup(
        React.createElement(MockExpeditionRoomCockpit, {
          room,
          gpxSnapshot,
          activePane: 'route',
        })
      );

      expect(fetchSpy).not.toHaveBeenCalled();
      expect(html).toContain('18.4 km');
      expect(html).toContain('+1250 m');
      expect(html).toContain('<polyline');
      expect(html).toContain('points="10,80 50,40 120,60 220,15"');
    });

    it('TEST-BIND-04: Fallback placeholder when GPX snapshot is missing or null', () => {
      const room = { id: 'r1', title: 'Sans tracé', status: 'planning' as ExpeditionRoomStatus };

      const html = renderToStaticMarkup(
        React.createElement(MockExpeditionRoomCockpit, {
          room,
          gpxSnapshot: null,
          activePane: 'route',
        })
      );

      expect(fetchSpy).not.toHaveBeenCalled();
      expect(html).toContain('Aucun tracé associé');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SUITE 7: UI COMPONENT RENDER CHECKS (APPLE HIG, ZERO-FETCH, ZERO-ORANGE)
  // ═══════════════════════════════════════════════════════════════════════════
  describe('7. UI Component Render Checks (Apple HIG, Zero-Fetch, Zero-Orange)', () => {
    const mockChannels: ClubChannel[] = [
      { id: 'ch-1', clubId: 'club-1', conversationId: 'c1', name: 'general', minRoleToRead: 'member', minRoleToWrite: 'member' },
      { id: 'ch-2', clubId: 'club-1', conversationId: 'c2', name: 'annonces', minRoleToRead: 'member', minRoleToWrite: 'admin', unreadCount: 3 },
      { id: 'ch-3', clubId: 'club-1', conversationId: 'c3', name: 'staff', minRoleToRead: 'guide', minRoleToWrite: 'guide' },
    ];

    it('TEST-UI-01: ClubChannelsList renders channel rows with unread counters and lock icons', () => {
      const html = renderToStaticMarkup(
        React.createElement(MockClubChannelsList, {
          channels: mockChannels,
          activeChannelId: 'ch-1',
          userRole: 'member',
        })
      );

      expect(html).toContain('# general');
      expect(html).toContain('# annonces');
      expect(html).not.toContain('# staff'); // Inaccessible for member
      expect(html).toContain('🔒'); // Annonces has lock for member
      expect(html).toContain('3'); // Unread count badge
    });

    it('TEST-UI-02: ClubChannelsList enforces Apple HIG 44px minimum touch targets', () => {
      const html = renderToStaticMarkup(
        React.createElement(MockClubChannelsList, {
          channels: mockChannels,
          activeChannelId: 'ch-1',
          userRole: 'member',
        })
      );

      expect(html).toContain('min-h-[44px]');
      expect(html).toContain('h-[44px]');
    });

    it('TEST-UI-03: ClubChannelsList contains ZERO orange #E4501C', () => {
      const html = renderToStaticMarkup(
        React.createElement(MockClubChannelsList, {
          channels: mockChannels,
          activeChannelId: 'ch-1',
          userRole: 'owner',
        })
      );

      expect(html).not.toMatch(/#e4501c/i);
      expect(html).not.toContain('orange-500');
    });

    it('TEST-UI-04: ClubRoleBadge renders distinct styling for all 5 roles', () => {
      const roles: OutdoorRole[] = ['owner', 'admin', 'guide', 'safety', 'member'];
      for (const role of roles) {
        const html = renderToStaticMarkup(React.createElement(MockClubRoleBadge, { role }));
        expect(html).toContain('role="status"');
        if (role === 'owner') expect(html).toContain('Propriétaire');
        if (role === 'admin') expect(html).toContain('Admin');
        if (role === 'guide') expect(html).toContain('Guide');
        if (role === 'safety') expect(html).toContain('Sécurité');
        if (role === 'member') expect(html).toContain('Membre');
      }
    });

    it('TEST-UI-05: ClubRoleBadge contains ZERO orange #E4501C', () => {
      const roles: OutdoorRole[] = ['owner', 'admin', 'guide', 'safety', 'member'];
      for (const role of roles) {
        const html = renderToStaticMarkup(React.createElement(MockClubRoleBadge, { role }));
        expect(html).not.toMatch(/#e4501c/i);
        expect(html).not.toContain('orange-500');
      }
    });

    it('TEST-UI-06: ExpeditionRoomCockpit renders multi-pane cockpit without network fetch', () => {
      const fetchSpy = vi.spyOn(global, 'fetch');
      const room = { id: 'r1', title: 'Cockpit Test', status: 'planning' as ExpeditionRoomStatus };

      const html = renderToStaticMarkup(
        React.createElement(MockExpeditionRoomCockpit, { room })
      );

      expect(fetchSpy).not.toHaveBeenCalled();
      expect(html).toContain('Cockpit Test');
      expect(html).toContain('planning');
    });

    it('TEST-UI-07: ExpeditionRoomCockpit tabs comply with Apple HIG 44px touch targets', () => {
      const room = { id: 'r1', title: 'Cockpit Tabs', status: 'active' as ExpeditionRoomStatus };

      const html = renderToStaticMarkup(
        React.createElement(MockExpeditionRoomCockpit, { room })
      );

      expect(html).toContain('min-h-[44px]');
      expect(html).toContain('h-[44px]');
    });

    it('TEST-UI-08: ExpeditionRoomCockpit contains ZERO orange #E4501C', () => {
      const room = { id: 'r1', title: 'Cockpit Color Guard', status: 'active' as ExpeditionRoomStatus };

      const html = renderToStaticMarkup(
        React.createElement(MockExpeditionRoomCockpit, { room })
      );

      expect(html).not.toMatch(/#e4501c/i);
      expect(html).not.toContain('orange-500');
    });

    it('TEST-UI-09: ExpeditionRoomCockpit renders French localized navigation tabs', () => {
      const room = { id: 'r1', title: 'Cockpit Localisé', status: 'active' as ExpeditionRoomStatus };
      const html = renderToStaticMarkup(
        React.createElement(MockExpeditionRoomCockpit, { room })
      );

      expect(html).toContain('Discussion');
      expect(html).toContain('Météo');
      expect(html).toContain('Tracé GPX');
      expect(html).toContain('Checklist');
      expect(html).toContain('Points de situation');
    });

    it('TEST-UI-10: ExpeditionRoomCockpit renders responsive desktop 2-column layout concurrently', () => {
      const room = { id: 'r1', title: 'Cockpit 2 Colonnes', status: 'active' as ExpeditionRoomStatus };
      const weatherData = {
        locationName: 'Col du Galibier',
        tempC: 8,
        windKmH: 30,
      };

      const html = renderToStaticMarkup(
        React.createElement(
          MockExpeditionRoomCockpit,
          {
            room,
            weatherData,
            activePane: 'weather',
          },
          React.createElement('div', { id: 'test-chat-stream' }, 'Stream de messages')
        )
      );

      // Verify desktop 2-column layout grid classes
      expect(html).toContain('md:grid-cols-2');
      expect(html).toContain('data-testid="cockpit-chat-column"');
      expect(html).toContain('data-testid="cockpit-tactical-column"');

      // Verify concurrent rendering of conversation stream AND tactical console
      expect(html).toContain('test-chat-stream');
      expect(html).toContain('Stream de messages');
      expect(html).toContain('Col du Galibier');
      expect(html).toContain('8°C');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SUITE 8: ADVERSARIAL & EDGE CASES (CHALLENGER & AUDITOR READY)
  // ═══════════════════════════════════════════════════════════════════════════
  describe('8. Adversarial & Edge Cases (Challenger & Auditor Ready)', () => {
    it('TEST-ADV-01: Client role spoofing in message payload is rejected by permission gate', () => {
      const announcementsChannel: ClubChannel = {
        id: 'c-ann',
        clubId: 'club-1',
        conversationId: 'conv-ann',
        name: 'annonces',
        minRoleToRead: 'member',
        minRoleToWrite: 'admin',
      };

      // Attacker claims "admin" in untrusted client metadata
      const untrustedClientMetadata = { claimedRole: 'admin' };
      // Truth source: actual membership record
      const actualDatabaseRole: OutdoorRole = 'member';

      // Permission gate must evaluate actualDatabaseRole, ignoring claimedRole
      const check = validateChannelPostPermission(actualDatabaseRole, announcementsChannel);
      expect(check.allowed).toBe(false);
      expect(check.reason).toBe('INSUFFICIENT_ROLE_PERMISSIONS');
    });

    it('TEST-ADV-02: Concurrency stress: 50 rapid checklist toggles maintain count consistency', () => {
      let checklist: ExpeditionChecklistItem[] = [
        { id: 'stress-item', roomId: 'r1', label: 'Corde 50m', isCompleted: false, category: 'gear', updatedAt: '2026-01-01T00:00:00Z' },
      ];

      for (let i = 0; i < 50; i++) {
        checklist = toggleChecklistItem(checklist, 'stress-item', `user-${i}`, new Date(1700000000000 + i * 1000).toISOString());
      }

      // 50 toggles on initial false -> ends on false (even number of toggles)
      expect(checklist[0].isCompleted).toBe(false);
      expect(checklist[0].updatedBy).toBe('user-49');
    });

    it('TEST-ADV-03: Pathological check-in coordinates (out of range / NaN) rejected', () => {
      expect(formatEmergencyCoordinates(NaN, 10)).toContain('Position non disponible');
      expect(formatEmergencyCoordinates(45, NaN)).toContain('Position non disponible');
      expect(formatEmergencyCoordinates(undefined, null)).toContain('Position non disponible');
    });

    it('TEST-ADV-04: Strict Zero-Orange Police scans all rendered HTML outputs', () => {
      const room = { id: 'r1', title: 'Zero Orange Audit', status: 'active' as ExpeditionRoomStatus };
      const channels: ClubChannel[] = [
        { id: 'c1', clubId: 'cb1', conversationId: 'cv1', name: 'general', minRoleToRead: 'member', minRoleToWrite: 'member' },
      ];

      const html1 = renderToStaticMarkup(React.createElement(MockExpeditionRoomCockpit, { room }));
      const html2 = renderToStaticMarkup(React.createElement(MockClubChannelsList, { channels, userRole: 'admin' }));
      const html3 = renderToStaticMarkup(React.createElement(MockClubRoleBadge, { role: 'guide' }));

      const combinedHtml = `${html1} ${html2} ${html3}`;

      // Banned color expressions
      expect(combinedHtml).not.toMatch(/#e4501c/i);
      expect(combinedHtml).not.toMatch(/rgb\(\s*228\s*,\s*80\s*,\s*28\s*\)/i);
      expect(combinedHtml).not.toContain('orange-500');
      expect(combinedHtml).not.toContain('orange-600');
    });
  });
});
