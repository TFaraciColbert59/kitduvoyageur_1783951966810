import { describe, it, expect } from 'vitest';
import {
  createCrewSchema,
  updateCrewSchema,
  joinCrewCodeSchema,
  inviteCrewMemberSchema,
} from '@/features/crews/schemas/crew.schema';

describe('Crew Schemas Validation (TDD - Phase 4)', () => {
  it('validates a valid crew creation payload', () => {
    const valid = {
      name: 'Les Alpinistes du Mont-Blanc',
      slug: 'alpinistes-mont-blanc',
      description: 'Collectif pour les courses en haute montagne.',
      theme: 'Trek',
      visibility: 'private',
      max_members: 15,
    };
    const result = createCrewSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('rejects invalid crew names (too short or too long)', () => {
    const tooShort = { name: 'A', max_members: 10 };
    const tooLong = { name: 'A'.repeat(85), max_members: 10 };
    expect(createCrewSchema.safeParse(tooShort).success).toBe(false);
    expect(createCrewSchema.safeParse(tooLong).success).toBe(false);
  });

  it('rejects invalid crew slugs (uppercase or special characters)', () => {
    const invalidSlug = {
      name: 'Mon Equipe',
      slug: 'Mon_Equipe!!',
    };
    expect(createCrewSchema.safeParse(invalidSlug).success).toBe(false);
  });

  it('validates join by code requiring uppercase 6-8 chars', () => {
    expect(joinCrewCodeSchema.safeParse({ code: 'ABCD12' }).success).toBe(true);
    expect(joinCrewCodeSchema.safeParse({ code: 'LKDV-2026' }).success).toBe(true);
    expect(joinCrewCodeSchema.safeParse({ code: 'ab' }).success).toBe(false);
  });

  it('validates invitation schema requiring email or userId with consent', () => {
    const validEmail = { email: 'coequipier@example.com', role: 'member' };
    expect(inviteCrewMemberSchema.safeParse(validEmail).success).toBe(true);

    const invalidRole = { email: 'coequipier@example.com', role: 'superadmin' };
    expect(inviteCrewMemberSchema.safeParse(invalidRole).success).toBe(false);
  });
});
