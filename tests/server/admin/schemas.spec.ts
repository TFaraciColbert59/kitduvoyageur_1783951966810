import { describe, expect, it } from 'vitest';

import {
  auditQuerySchema,
  paginationSchema,
  rewardsActionSchema,
  roleGrantSchema,
  roleRevokeSchema,
} from '@/server/admin/schemas';
import { productCreateSchema, stockMoveSchema } from '@/server/admin/productSchemas';
import { sanitizeIlike } from '@/server/admin/sanitize';

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
  const PERIOD = '2026-09';

  it('accepte finalize_period complet', () => {
    const res = rewardsActionSchema.safeParse({
      action: 'finalize_period',
      period_id: PERIOD,
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
      period_id: PERIOD,
    });
    expect(res.success).toBe(false);
  });

  it('rejette un period_id non YYYY-MM (TEXT reward_periods.id)', () => {
    for (const bad of ['22222222-2222-4222-8222-222222222222', '2026-13', '09-2026', '']) {
      expect(
        rewardsActionSchema.safeParse({
          action: 'finalize_period',
          period_id: bad,
          eligible_revenue: 10,
        }).success
      ).toBe(false);
    }
  });

  it('rejette un montant négatif ou infini', () => {
    const base = {
      action: 'finalize_period',
      period_id: '2026-09',
    } as const;
    expect(rewardsActionSchema.safeParse({ ...base, eligible_revenue: -1 }).success).toBe(false);
    expect(
      rewardsActionSchema.safeParse({ ...base, eligible_revenue: Number.POSITIVE_INFINITY })
        .success
    ).toBe(false);
  });
});

describe('stockMoveSchema', () => {
  it('accepte un mouvement signé non nul', () => {
    expect(stockMoveSchema.safeParse({ quantity_change: -3 }).success).toBe(true);
  });

  it('rejette un mouvement nul', () => {
    expect(stockMoveSchema.safeParse({ quantity_change: 0 }).success).toBe(false);
  });

  it('rejette une quantité non entière', () => {
    expect(stockMoveSchema.safeParse({ quantity_change: 1.5 }).success).toBe(false);
  });
});

describe('productCreateSchema', () => {
  it('rejette un nom vide', () => {
    expect(productCreateSchema.safeParse({ name: '' }).success).toBe(false);
  });

  it('rejette un slug malformé', () => {
    expect(
      productCreateSchema.safeParse({ name: 'Sac', slug: 'Sac de Rando!' }).success
    ).toBe(false);
  });

  it("rejette un transaction_type hors enum DB (sans accent sur enchère)", () => {
    expect(
      productCreateSchema.safeParse({ name: 'Sac', transaction_type: 'enchère' }).success
    ).toBe(false);
    expect(
      productCreateSchema.safeParse({ name: 'Sac', transaction_type: 'enchere' }).success
    ).toBe(true);
  });

  it('rejette un prix négatif', () => {
    expect(productCreateSchema.safeParse({ name: 'Sac', price_eur: -5 }).success).toBe(false);
  });
});

describe('sanitizeIlike', () => {
  it('retire les caractères de découpe PostgREST', () => {
    expect(sanitizeIlike('Sac, Alpin (test) 100% "x"')).toBe('Sac Alpin test 100 x');
  });

  it('conserve une recherche simple intacte', () => {
    expect(sanitizeIlike('osprey farpoint')).toBe('osprey farpoint');
  });
});
