import { describe, expect, it } from 'vitest';

import {
  auditQuerySchema,
  paginationSchema,
  rewardsActionSchema,
  roleGrantSchema,
  roleRevokeSchema,
} from '@/server/admin/schemas';

describe('roleGrantSchema', () => {
  it('accepte un octroi avec expiration future', () => {
    const res = roleGrantSchema.safeParse({
      role: 'admin',
      expires_at: '2030-01-01T00:00:00.000Z',
    });
    expect(res.success).toBe(true);
  });

  it('accepte un octroi sans expiration', () => {
    const res = roleGrantSchema.safeParse({ role: 'moderateur' });
    expect(res.success).toBe(true);
  });

  it('rejette un rôle inconnu', () => {
    const res = roleGrantSchema.safeParse({ role: 'superuser' });
    expect(res.success).toBe(false);
  });

  it('rejette une date non ISO', () => {
    const res = roleGrantSchema.safeParse({ role: 'admin', expires_at: 'demain' });
    expect(res.success).toBe(false);
  });
});

describe('roleRevokeSchema', () => {
  it('rejette un corps vide', () => {
    expect(roleRevokeSchema.safeParse({}).success).toBe(false);
  });
});

describe('paginationSchema', () => {
  it('applique les défauts et coerce les strings de query', () => {
    const res = paginationSchema.safeParse({ page: '2', pageSize: '10', q: 'marie' });
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.page).toBe(2);
      expect(res.data.pageSize).toBe(10);
      expect(res.data.q).toBe('marie');
    }
  });

  it('rejette pageSize hors borne', () => {
    expect(paginationSchema.safeParse({ pageSize: 500 }).success).toBe(false);
  });
});

describe('auditQuerySchema', () => {
  it('rejette un actor_id non-uuid', () => {
    expect(auditQuerySchema.safeParse({ actor_id: 'not-an-uuid' }).success).toBe(false);
  });
});

describe('rewardsActionSchema', () => {
  it('accepte finalize_period complet', () => {
    const res = rewardsActionSchema.safeParse({
      action: 'finalize_period',
      period_id: '22222222-2222-4222-8222-222222222222',
      eligible_revenue: 1500,
    });
    expect(res.success).toBe(true);
  });

  it('rejette une action inconnue au lieu de la laisser passer', () => {
    const res = rewardsActionSchema.safeParse({ action: 'drop_tables', period_id: 'x' });
    expect(res.success).toBe(false);
  });

  it('rejette finalize_period sans eligible_revenue', () => {
    const res = rewardsActionSchema.safeParse({
      action: 'finalize_period',
      period_id: '22222222-2222-4222-8222-222222222222',
    });
    expect(res.success).toBe(false);
  });

  it('rejette un montant négatif ou infini', () => {
    const base = {
      action: 'finalize_period',
      period_id: '22222222-2222-4222-8222-222222222222',
    } as const;
    expect(rewardsActionSchema.safeParse({ ...base, eligible_revenue: -1 }).success).toBe(false);
    expect(
      rewardsActionSchema.safeParse({ ...base, eligible_revenue: Number.POSITIVE_INFINITY })
        .success
    ).toBe(false);
  });
});
