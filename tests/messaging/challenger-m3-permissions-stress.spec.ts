/**
 * LKDV Social — Milestone 3: Adversarial Challenger Stress Test Suite
 * File: tests/messaging/challenger-m3-permissions-stress.spec.ts
 *
 * EMPIRICAL ADVERSARIAL CHALLENGER SUITE:
 * 1. Unknown, Spoofed & Malicious Roles Privilege Escalation Resistance
 * 2. Complete 5x5 Cartesian Product Role Hierarchy Boundary Verification (25 Role Pairs)
 * 3. Post Permission Validation Negative Rejection Reason Machine
 * 4. Concurrency & Immutability Stress on Checklist Operations (Deep Freeze Invariant)
 * 5. Pathological Emergency Coordinates & Field Check-In Safety Gate
 */

import { describe, it, expect } from 'vitest';
import {
  OUTDOOR_ROLE_HIERARCHY,
  hasRolePermission,
  canReadChannel,
  canWriteChannel,
  validateChannelPostPermission,
  type OutdoorRole,
  type ClubChannel,
} from '@/features/messaging/types/clubs.types';

import {
  toggleChecklistItem,
  assignChecklistItem,
  calculateChecklistProgress,
  computeChecklistSummary,
  formatEmergencyCoordinates,
  getCheckInSeverity,
  formatCheckInBroadcast,
  computeCheckinSummary,
  type ExpeditionChecklistItem,
  type FieldCheckIn,
} from '@/features/messaging/types/expeditionRooms.types';

describe('Challenger M3: Adversarial Permissions, Role Hierarchy & Immutability Stress Suite', () => {

  // ═══════════════════════════════════════════════════════════════════════════
  // SUITE 1: UNKNOWN, SPOOFED & MALICIOUS ROLES PRIVILEGE ESCALATION RESISTANCE
  // ═══════════════════════════════════════════════════════════════════════════
  describe('1. Unknown, Spoofed & Malicious Roles Privilege Escalation Resistance', () => {
    const validRoles: OutdoorRole[] = ['member', 'safety', 'guide', 'admin', 'owner'];

    const spoofedRoles = [
      'superadmin',
      'root',
      'sudo',
      'moderator',
      'sysadmin',
      'SYSTEM',
      'ADMIN',
      'OWNER',
      'member ',
      ' member',
      'owner\n',
      'guide\t',
      '',
      '   ',
      'null',
      'undefined',
      'false',
      'true',
      '0',
      '1',
      '9999',
      '__proto__',
      'constructor',
      'toString',
      'valueOf',
      'hasOwnProperty',
      'isPrototypeOf',
    ];

    const testChannel: ClubChannel = {
      id: 'chan-strict',
      clubId: 'club-1',
      conversationId: 'conv-strict',
      name: 'annonces-officielles',
      minRoleToRead: 'member',
      minRoleToWrite: 'guide',
    };

    it('CHALLENGE-SPOOF-01: Spoofed & unknown role strings never grant access to any valid role threshold', () => {
      for (const fakeRole of spoofedRoles) {
        for (const targetRole of validRoles) {
          const granted = hasRolePermission(fakeRole as any, targetRole);
          expect(
            granted,
            `Role escalation bug! Spoofed role '${fakeRole}' was granted '${targetRole}' permission!`
          ).toBe(false);
        }
      }
    });

    it('CHALLENGE-SPOOF-02: Non-string and type coercion attempts are safely rejected', () => {
      const nonStringInputs: any[] = [
        null,
        undefined,
        0,
        1,
        -1,
        false,
        true,
        NaN,
        Infinity,
        -Infinity,
        {},
        [],
        { role: 'owner' },
        () => 'owner',
      ];

      for (const input of nonStringInputs) {
        for (const targetRole of validRoles) {
          const granted = hasRolePermission(input, targetRole);
          expect(
            granted,
            `Type coercion escalation! Input ${String(input)} was granted '${targetRole}' permission!`
          ).toBe(false);
        }
      }
    });

    it('CHALLENGE-SPOOF-03: Prototype property injection does not pollute role rank resolution', () => {
      // Prototype methods have function types in JS which must not coerce into truthy numbers
      const protoKeys = ['toString', 'valueOf', 'constructor', '__proto__'];
      for (const key of protoKeys) {
        expect(hasRolePermission(key, 'member')).toBe(false);
        expect(hasRolePermission(key, 'owner')).toBe(false);
        expect(canReadChannel(key, testChannel)).toBe(false);
        expect(canWriteChannel(key, testChannel)).toBe(false);
      }
    });

    it('CHALLENGE-SPOOF-04: Non-existent required role threshold fails closed (never grants access)', () => {
      // If a channel or resource specifies a bogus required role, even an owner must not be silently approved
      const invalidRequiredRoles: any[] = ['superadmin', 'guest', 'mod', '', null, undefined, 'unknown'];
      for (const reqRole of invalidRequiredRoles) {
        expect(hasRolePermission('owner', reqRole)).toBe(false);
        expect(hasRolePermission('admin', reqRole)).toBe(false);
        expect(hasRolePermission('member', reqRole)).toBe(false);
      }
    });

    it('CHALLENGE-SPOOF-05: Case-sensitivity and whitespace tampering are rejected', () => {
      // Outdoor roles are strictly lowercase enum values
      expect(hasRolePermission('Owner', 'owner')).toBe(false);
      expect(hasRolePermission('OWNER', 'member')).toBe(false);
      expect(hasRolePermission('Admin', 'admin')).toBe(false);
      expect(hasRolePermission(' admin ', 'member')).toBe(false);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SUITE 2: COMPLETE 5x5 CARTESIAN PRODUCT ROLE HIERARCHY BOUNDARY VERIFICATION
  // ═══════════════════════════════════════════════════════════════════════════
  describe('2. Complete 5x5 Cartesian Product Role Hierarchy Boundary Verification (25 Role Pairs)', () => {
    const roles: OutdoorRole[] = ['owner', 'admin', 'guide', 'safety', 'member'];

    // Expected rank weights: owner=5, admin=4, guide=3, safety=2, member=1
    const expectedWeights: Record<OutdoorRole, number> = {
      owner: 5,
      admin: 4,
      guide: 3,
      safety: 2,
      member: 1,
    };

    it('CHALLENGE-CARTESIAN-01: Verifies all 25 exact role comparison pairs against weight inequalities', () => {
      let trueCount = 0;
      let falseCount = 0;

      for (const userRole of roles) {
        for (const requiredRole of roles) {
          const expected = expectedWeights[userRole] >= expectedWeights[requiredRole];
          const actual = hasRolePermission(userRole, requiredRole);

          expect(
            actual,
            `Mismatch for pair (${userRole} >= ${requiredRole}): expected ${expected}, got ${actual}`
          ).toBe(expected);

          if (actual) trueCount++;
          else falseCount++;
        }
      }

      // In a 5-element total order:
      // (5 + 4 + 3 + 2 + 1) = 15 pairs are true (including diagonal)
      // (25 - 15) = 10 pairs are false
      expect(trueCount).toBe(15);
      expect(falseCount).toBe(10);
    });

    it('CHALLENGE-CARTESIAN-02: Algebraic invariant — Reflexivity: every role satisfies its own requirement', () => {
      for (const role of roles) {
        expect(hasRolePermission(role, role)).toBe(true);
      }
    });

    it('CHALLENGE-CARTESIAN-03: Algebraic invariant — Antisymmetry: strictly higher roles cannot be satisfied by strictly lower roles', () => {
      for (let i = 0; i < roles.length; i++) {
        for (let j = 0; j < roles.length; j++) {
          if (i !== j) {
            const r1 = roles[i];
            const r2 = roles[j];
            const r1CanR2 = hasRolePermission(r1, r2);
            const r2CanR1 = hasRolePermission(r2, r1);

            // Exactly one must be true, the other false (total antisymmetric order)
            expect(r1CanR2 !== r2CanR1).toBe(true);
          }
        }
      }
    });

    it('CHALLENGE-CARTESIAN-04: Algebraic invariant — Transitivity holds across all triplets', () => {
      for (const a of roles) {
        for (const b of roles) {
          for (const c of roles) {
            if (hasRolePermission(a, b) && hasRolePermission(b, c)) {
              expect(
                hasRolePermission(a, c),
                `Transitivity violation: (${a} >= ${b}) and (${b} >= ${c}) but NOT (${a} >= ${c})`
              ).toBe(true);
            }
          }
        }
      }
    });

    it('CHALLENGE-CARTESIAN-05: Exact step-by-step role gap boundaries', () => {
      // Step: admin -> owner (gap of 1)
      expect(hasRolePermission('admin', 'owner')).toBe(false);
      // Step: guide -> admin (gap of 1)
      expect(hasRolePermission('guide', 'admin')).toBe(false);
      // Step: safety -> guide (gap of 1)
      expect(hasRolePermission('safety', 'guide')).toBe(false);
      // Step: member -> safety (gap of 1)
      expect(hasRolePermission('member', 'safety')).toBe(false);

      // Downward step (gap of 1)
      expect(hasRolePermission('owner', 'admin')).toBe(true);
      expect(hasRolePermission('admin', 'guide')).toBe(true);
      expect(hasRolePermission('guide', 'safety')).toBe(true);
      expect(hasRolePermission('safety', 'member')).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SUITE 3: POST PERMISSION VALIDATION NEGATIVE REJECTION REASON MACHINE
  // ═══════════════════════════════════════════════════════════════════════════
  describe('3. Post Permission Validation Negative Rejection Reason Machine', () => {
    const channelStaffOnly: ClubChannel = {
      id: 'c-staff',
      clubId: 'club-1',
      conversationId: 'conv-staff',
      name: 'staff-only',
      minRoleToRead: 'guide',
      minRoleToWrite: 'admin',
    };

    const channelMemberWrite: ClubChannel = {
      id: 'c-chat',
      clubId: 'club-1',
      conversationId: 'conv-chat',
      name: 'bavardages',
      minRoleToRead: 'member',
      minRoleToWrite: 'member',
    };

    it('CHALLENGE-REASON-01: Falsy roles (null, undefined, empty string) strictly yield USER_NOT_MEMBER', () => {
      const falsyRoles = [null, undefined, ''];

      for (const role of falsyRoles) {
        const resStaff = validateChannelPostPermission(role, channelStaffOnly);
        expect(resStaff.allowed).toBe(false);
        expect(resStaff.reason).toBe('USER_NOT_MEMBER');

        const resChat = validateChannelPostPermission(role, channelMemberWrite);
        expect(resChat.allowed).toBe(false);
        expect(resChat.reason).toBe('USER_NOT_MEMBER');
      }
    });

    it('CHALLENGE-REASON-02: Truthful members with insufficient rank strictly yield INSUFFICIENT_ROLE_PERMISSIONS', () => {
      // In channelStaffOnly, minRoleToWrite is 'admin'
      const insufficientRoles: OutdoorRole[] = ['member', 'safety', 'guide'];

      for (const role of insufficientRoles) {
        const res = validateChannelPostPermission(role, channelStaffOnly);
        expect(res.allowed).toBe(false);
        expect(res.reason).toBe('INSUFFICIENT_ROLE_PERMISSIONS');
      }
    });

    it('CHALLENGE-REASON-03: Unknown/spoofed truthy roles fail with INSUFFICIENT_ROLE_PERMISSIONS', () => {
      // Truthy string that is not recognized must be denied write
      const spoofed = ['intruder', 'guest', 'superadmin', 'vip'];

      for (const badRole of spoofed) {
        const res = validateChannelPostPermission(badRole, channelMemberWrite);
        expect(res.allowed).toBe(false);
        expect(res.reason).toBe('INSUFFICIENT_ROLE_PERMISSIONS');
      }
    });

    it('CHALLENGE-REASON-04: Authorized posts have allowed: true and undefined rejection reason', () => {
      const authorizedRoles: OutdoorRole[] = ['admin', 'owner'];

      for (const role of authorizedRoles) {
        const res = validateChannelPostPermission(role, channelStaffOnly);
        expect(res.allowed).toBe(true);
        expect(res.reason).toBeUndefined();
      }

      const allRoles: OutdoorRole[] = ['member', 'safety', 'guide', 'admin', 'owner'];
      for (const role of allRoles) {
        const res = validateChannelPostPermission(role, channelMemberWrite);
        expect(res.allowed).toBe(true);
        expect(res.reason).toBeUndefined();
      }
    });

    it('CHALLENGE-REASON-05: Comprehensive rejection matrix across all 5 write levels', () => {
      const allRoles: OutdoorRole[] = ['member', 'safety', 'guide', 'admin', 'owner'];

      for (const minRole of allRoles) {
        const ch: Pick<ClubChannel, 'minRoleToWrite'> = { minRoleToWrite: minRole };

        for (const userRole of allRoles) {
          const res = validateChannelPostPermission(userRole, ch);
          const hasPerm = hasRolePermission(userRole, minRole);

          if (hasPerm) {
            expect(res.allowed).toBe(true);
            expect(res.reason).toBeUndefined();
          } else {
            expect(res.allowed).toBe(false);
            expect(res.reason).toBe('INSUFFICIENT_ROLE_PERMISSIONS');
          }
        }
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SUITE 4: CONCURRENCY & IMMUTABILITY STRESS ON CHECKLIST OPERATIONS
  // ═══════════════════════════════════════════════════════════════════════════
  describe('4. Concurrency & Immutability Stress on Checklist Operations (Deep Freeze Invariant)', () => {
    function createSampleChecklist(): ExpeditionChecklistItem[] {
      return [
        {
          id: 'item-1',
          roomId: 'r-1',
          label: 'Crampons 12 pointes',
          isCompleted: false,
          category: 'gear',
          assignedTo: null,
          assignedName: null,
          updatedAt: '2026-06-01T08:00:00Z',
        },
        {
          id: 'item-2',
          roomId: 'r-1',
          label: 'Pharmacie collective',
          isCompleted: true,
          category: 'safety',
          assignedTo: 'user-guide',
          assignedName: 'Guide Marc',
          updatedAt: '2026-06-01T08:00:00Z',
        },
        {
          id: 'item-3',
          roomId: 'r-1',
          label: 'Rations lyophilisées 3j',
          isCompleted: false,
          category: 'food',
          assignedTo: 'user-member-1',
          assignedName: 'Alice',
          updatedAt: '2026-06-01T08:00:00Z',
        },
      ];
    }

    it('CHALLENGE-IMMUT-01: toggleChecklistItem succeeds without throwing on deep-frozen array and items', () => {
      const list = createSampleChecklist();

      // Deep freeze input data structure
      Object.freeze(list);
      for (const item of list) {
        Object.freeze(item);
      }

      // If implementation mutates in place, Object.freeze throws TypeError in strict mode
      expect(() => {
        const next = toggleChecklistItem(list, 'item-1', 'user-2', '2026-06-01T09:00:00Z');
        expect(next[0].isCompleted).toBe(true);
        expect(next[0].updatedBy).toBe('user-2');
      }).not.toThrow();

      // Verify the frozen original item remained false
      expect(list[0].isCompleted).toBe(false);
    });

    it('CHALLENGE-IMMUT-02: assignChecklistItem succeeds without throwing on deep-frozen array and items', () => {
      const list = createSampleChecklist();

      Object.freeze(list);
      for (const item of list) {
        Object.freeze(item);
      }

      expect(() => {
        const next = assignChecklistItem(list, 'item-1', 'user-safety', 'Docteur Claire');
        expect(next[0].assignedTo).toBe('user-safety');
        expect(next[0].assignedName).toBe('Docteur Claire');
      }).not.toThrow();

      // Verify frozen original was not mutated
      expect(list[0].assignedTo).toBeNull();
      expect(list[0].assignedName).toBeNull();
    });

    it('CHALLENGE-IMMUT-03: Referential integrity: modified item gets new reference, untouched items preserve reference', () => {
      const list = createSampleChecklist();
      const next = toggleChecklistItem(list, 'item-2', 'user-guide', '2026-06-01T09:30:00Z');

      // Array reference must be brand new
      expect(next).not.toBe(list);

      // Modified item (index 1) must be a new reference
      expect(next[1]).not.toBe(list[1]);
      expect(next[1].isCompleted).toBe(false); // was true, toggled to false
      expect(list[1].isCompleted).toBe(true); // original unchanged

      // Untouched items (index 0, index 2) preserve structural sharing
      expect(next[0]).toBe(list[0]);
      expect(next[2]).toBe(list[2]);
    });

    it('CHALLENGE-IMMUT-04: Non-existent itemId returns brand new array without modifying any items', () => {
      const list = createSampleChecklist();
      const nextToggle = toggleChecklistItem(list, 'ghost-item-999', 'user-anon');
      const nextAssign = assignChecklistItem(list, 'ghost-item-999', 'user-anon', 'Ghost');

      expect(nextToggle).not.toBe(list);
      expect(nextToggle.length).toBe(list.length);
      expect(nextToggle[0]).toBe(list[0]);
      expect(nextToggle[1]).toBe(list[1]);
      expect(nextToggle[2]).toBe(list[2]);

      expect(nextAssign).not.toBe(list);
      expect(nextAssign.length).toBe(list.length);
      expect(nextAssign[0]).toBe(list[0]);
    });

    it('CHALLENGE-IMMUT-05: Empty array returns empty array safely', () => {
      const empty: ExpeditionChecklistItem[] = [];
      const resToggle = toggleChecklistItem(empty, 'any-id', 'u1');
      const resAssign = assignChecklistItem(empty, 'any-id', 'u1', 'Name');

      expect(resToggle).toEqual([]);
      expect(resAssign).toEqual([]);
      expect(resToggle).not.toBe(empty);
      expect(resAssign).not.toBe(empty);
    });

    it('CHALLENGE-IMMUT-06: Concurrency stress: 100 rapid concurrent toggle operations preserve invariants', () => {
      let state = createSampleChecklist();
      const initialSnapshot = JSON.parse(JSON.stringify(state));

      // Simulate 100 toggles alternating between item-1 and item-3
      for (let i = 0; i < 100; i++) {
        const targetId = i % 2 === 0 ? 'item-1' : 'item-3';
        const userId = `user-worker-${i % 5}`;
        const ts = new Date(1770000000000 + i * 500).toISOString();
        state = toggleChecklistItem(state, targetId, userId, ts);
      }

      // item-1 toggled 50 times (even): false -> false
      expect(state.find((x) => x.id === 'item-1')?.isCompleted).toBe(false);
      // item-3 toggled 50 times (even): false -> false
      expect(state.find((x) => x.id === 'item-3')?.isCompleted).toBe(false);
      // item-2 never toggled: remains true
      expect(state.find((x) => x.id === 'item-2')?.isCompleted).toBe(true);

      // Verify item-2 untouched compared to initial snapshot
      expect(state.find((x) => x.id === 'item-2')?.updatedAt).toBe(initialSnapshot[1].updatedAt);
    });

    it('CHALLENGE-IMMUT-07: Branching tree history stress: 3 divergent branches never corrupt ancestor', () => {
      const baseState = createSampleChecklist();
      Object.freeze(baseState);
      baseState.forEach((item) => Object.freeze(item));

      // Branch A: Complete all items
      let branchA = baseState;
      branchA = toggleChecklistItem(branchA, 'item-1', 'user-a');
      branchA = toggleChecklistItem(branchA, 'item-3', 'user-a');

      // Branch B: Unassign all items
      let branchB = baseState;
      branchB = assignChecklistItem(branchB, 'item-2', null, null);
      branchB = assignChecklistItem(branchB, 'item-3', null, null);

      // Branch C: Reassign all to guide
      let branchC = baseState;
      branchC = assignChecklistItem(branchC, 'item-1', 'guide-id', 'Super Guide');
      branchC = assignChecklistItem(branchC, 'item-2', 'guide-id', 'Super Guide');
      branchC = assignChecklistItem(branchC, 'item-3', 'guide-id', 'Super Guide');

      // Verify Branch A progress is 100%
      const progA = calculateChecklistProgress(branchA);
      expect(progA.percentage).toBe(100);
      expect(progA.completed).toBe(3);

      // Verify Branch B has 0 assigned
      expect(branchB.every((i) => i.assignedTo === null)).toBe(true);

      // Verify Branch C has all assigned to guide
      expect(branchC.every((i) => i.assignedTo === 'guide-id')).toBe(true);

      // Verify baseState remained 100% untouched
      expect(baseState[0].isCompleted).toBe(false);
      expect(baseState[1].isCompleted).toBe(true);
      expect(baseState[2].isCompleted).toBe(false);
      expect(baseState[1].assignedTo).toBe('user-guide');
    });

    it('CHALLENGE-IMMUT-08: Large list performance and integrity (1,000 items)', () => {
      const largeList: ExpeditionChecklistItem[] = Array.from({ length: 1000 }, (_, idx) => ({
        id: `item-${idx}`,
        roomId: 'r-mega',
        label: `Equipment #${idx}`,
        isCompleted: idx % 2 === 0, // 500 completed
        category: 'gear',
        updatedAt: '2026-01-01T00:00:00Z',
      }));

      // Initial progress: 50%
      expect(calculateChecklistProgress(largeList).percentage).toBe(50);

      // Toggle first item (0: was true -> false)
      const t1 = toggleChecklistItem(largeList, 'item-0', 'stress-bot');
      expect(t1[0].isCompleted).toBe(false);

      // Toggle middle item (500: was true -> false)
      const t2 = toggleChecklistItem(t1, 'item-500', 'stress-bot');
      expect(t2[500].isCompleted).toBe(false);

      // Toggle last item (999: was false -> true)
      const t3 = toggleChecklistItem(t2, 'item-999', 'stress-bot');
      expect(t3[999].isCompleted).toBe(true);

      // Original list must remain exactly 500 completed
      expect(calculateChecklistProgress(largeList).completed).toBe(500);

      // t3 has 500 - 1 - 1 + 1 = 499 completed
      expect(calculateChecklistProgress(t3).completed).toBe(499);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SUITE 5: PATHOLOGICAL EMERGENCY COORDINATES & FIELD CHECK-IN SAFETY GATE
  // ═══════════════════════════════════════════════════════════════════════════
  describe('5. Pathological Emergency Coordinates & Field Check-In Safety Gate', () => {
    it('CHALLENGE-COORD-01: Cardinal boundary coordinates (Poles, Equator, Prime Meridian, Anti-Meridian)', () => {
      // North Pole
      expect(formatEmergencyCoordinates(90, 0)).toBe('90.0000° N, 0.0000° E');
      // South Pole
      expect(formatEmergencyCoordinates(-90, 0)).toBe('90.0000° S, 0.0000° E');
      // Equator + Anti-Meridian East
      expect(formatEmergencyCoordinates(0, 180)).toBe('0.0000° N, 180.0000° E');
      // Equator + Anti-Meridian West
      expect(formatEmergencyCoordinates(0, -180)).toBe('0.0000° N, 180.0000° W');
    });

    it('CHALLENGE-COORD-02: Micro-degree precision rounding behavior', () => {
      // 5th decimal digit rounding to 4 decimals
      expect(formatEmergencyCoordinates(44.12344, 6.12344)).toBe('44.1234° N, 6.1234° E');
      expect(formatEmergencyCoordinates(44.12345, 6.12345)).toBe('44.1235° N, 6.1235° E');
      expect(formatEmergencyCoordinates(-44.12345, -6.12345)).toBe('44.1235° S, 6.1235° W');
    });

    it('CHALLENGE-COORD-03: Falsy and pathological coordinates trigger emergency phone advice', () => {
      const invalidPairs = [
        [null, null],
        [undefined, undefined],
        [NaN, NaN],
        [NaN, 45.0],
        [45.0, NaN],
        [null, 45.0],
        [45.0, undefined],
      ];

      for (const [lat, lng] of invalidPairs) {
        const text = formatEmergencyCoordinates(lat as any, lng as any);
        expect(text).toContain('Position non disponible');
        expect(text).toContain('112');
      }
    });

    it('CHALLENGE-COORD-04: SOS checkin summary prioritizes active emergency alert', () => {
      const routineCheckIns: FieldCheckIn[] = [
        {
          id: 'ck-1',
          authorId: 'u-1',
          authorName: 'Jean',
          status: 'ok',
          location: { latitude: 44.0, longitude: 7.0 },
          timestamp: '2026-08-01T10:00:00Z',
        },
        {
          id: 'ck-2',
          authorId: 'u-2',
          authorName: 'Claire',
          status: 'camp_set',
          location: { latitude: 44.1, longitude: 7.1 },
          timestamp: '2026-08-01T12:00:00Z',
        },
      ];

      const sum1 = computeCheckinSummary(routineCheckIns);
      expect(sum1.hasActiveAlert).toBe(false);
      expect(sum1.totalCheckins).toBe(2);

      // Injects an SOS in between
      const withSos: FieldCheckIn[] = [
        ...routineCheckIns,
        {
          id: 'ck-sos',
          authorId: 'u-3',
          authorName: 'Marc',
          status: 'sos',
          location: { latitude: 44.2, longitude: 7.2 },
          timestamp: '2026-08-01T11:00:00Z',
        },
      ];

      const sum2 = computeCheckinSummary(withSos);
      expect(sum2.hasActiveAlert).toBe(true);
      expect(sum2.totalCheckins).toBe(3);
    });

    it('CHALLENGE-COORD-05: Critical severity dispatch on SOS check-in broadcasts coordinates', () => {
      const sosCheckIn: FieldCheckIn = {
        id: 'ck-sos-1',
        authorId: 'u-guide',
        authorName: 'Luc Guide',
        status: 'sos',
        location: { latitude: 45.8326, longitude: 6.8651 }, // Mont Blanc summit
        message: 'Tempête subite et chute en crevasse',
        timestamp: '2026-08-01T15:00:00Z',
      };

      const broadcast = formatCheckInBroadcast(sosCheckIn);
      expect(broadcast.severity).toBe('critical');
      expect(broadcast.title).toContain('ALERTE DETRESSE SOS');
      expect(broadcast.emergencyCoordinates).toBe('45.8326° N, 6.8651° E');
      expect(broadcast.content).toContain('45.8326° N, 6.8651° E');
      expect(broadcast.content).toContain('Tempête subite et chute en crevasse');
    });

    it('CHALLENGE-COORD-06: Severity rating covers all four field status variants', () => {
      expect(getCheckInSeverity('sos')).toBe('critical');
      expect(getCheckInSeverity('delayed')).toBe('warning');
      expect(getCheckInSeverity('camp_set')).toBe('info');
      expect(getCheckInSeverity('ok')).toBe('normal');
      // Fallback for unknown status
      expect(getCheckInSeverity('unknown' as any)).toBe('normal');
    });
  });
});
