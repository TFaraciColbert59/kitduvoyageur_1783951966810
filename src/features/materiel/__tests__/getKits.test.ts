import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  user: { id: 'usr-123' } as { id: string } | null,
  queryData: null as any,
  queryError: null as any,
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: {
      getUser: async () => ({ data: { user: mocks.user } }),
    },
    rpc: async () => ({ data: null, error: null }),
    from: () => ({
      select: () => ({
        eq: () => ({
          order: () => Promise.resolve({ data: mocks.queryData, error: mocks.queryError }),
          maybeSingle: () => Promise.resolve({ data: mocks.queryData, error: mocks.queryError }),
        }),
      }),
    }),
  }),
}));

import { getKits } from '@/features/materiel/services/getKits';

describe('L0-2: getKits segregation of showcase vs real kits', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.user = { id: 'usr-123' };
    mocks.queryData = [];
    mocks.queryError = null;
  });

  it('Utilisateur connecté sans kit : renvoie state: empty et kits: [] (ÉCHOUE SUR CODE ACTUEL)', async () => {
    mocks.user = { id: 'usr-123' };
    mocks.queryData = [];

    const result = await getKits();

    expect(result.state).toBe('empty');
    expect(result.kits).toEqual([]);
  });

  it('Erreur de lecture base de données : renvoie state: error (ÉCHOUE SUR CODE ACTUEL)', async () => {
    mocks.user = { id: 'usr-123' };
    mocks.queryError = { message: 'Connection terminated' };

    const result = await getKits();

    expect(result.state).toBe('error');
    expect(result.kits).toEqual([]);
    expect(result.error).toBe('Connection terminated');
  });

  it('Visiteur non connecté : reçoit les kits vitrines marqués isShowcase: true', async () => {
    mocks.user = null;

    const result = await getKits();

    expect(result.state).toBe('ok');
    expect(result.kits.length).toBeGreaterThan(0);
    expect(result.kits.every((k) => k.isShowcase === true)).toBe(true);
  });

  it('Utilisateur connecté avec kits : renvoie state: ok et kits marqués isShowcase: false', async () => {
    mocks.user = { id: 'usr-123' };
    mocks.queryData = [
      {
        id: 'real-kit-1',
        name: 'Mon Vrai Kit Bivouac',
        description: 'Vrai kit perso',
        season: 'ete',
        total_weight_g: 5000,
        is_favorite: true,
        is_trashed: false,
        updated_at: new Date().toISOString(),
        materiel_kit_items: [
          { name: 'Mon Réchaud', category: 'Cuisine', weight_g: 200, quantity: 1, is_checked: true, product_ownership_id: 'p-1' },
        ],
      },
    ];

    const result = await getKits();

    expect(result.state).toBe('ok');
    expect(result.kits).toHaveLength(1);
    expect(result.kits[0].name).toBe('Mon Vrai Kit Bivouac');
    expect(result.kits[0].isShowcase).toBe(false);
  });
});

describe('L0-2: GET /api/kits/[id]/sheet never fabricates fake kits on DB miss or error', () => {
  it('Kit éditorial vitrine : renvoie isShowcase: true et origin: souche_editoriale', async () => {
    const { GET } = await import('@/app/api/kits/[id]/sheet/route');
    const req = new Request('http://localhost:3000/api/kits/kit-trek-fast/sheet') as any;
    const res = await GET(req, { params: Promise.resolve({ id: 'kit-trek-fast' }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.kit.isShowcase).toBe(true);
    expect(body.kit.origin).toBe('souche_editoriale');
    expect(body.journal.birth.origin).toBe('souche_editoriale');
  });

  it('Kit inconnu en base : renvoie HTTP 404 sans fabriquer de kit outdoor-community', async () => {
    mocks.queryData = null;
    mocks.queryError = null;
    const { GET } = await import('@/app/api/kits/[id]/sheet/route');
    const req = new Request('http://localhost:3000/api/kits/unknown-uuid/sheet') as any;
    const res = await GET(req, { params: Promise.resolve({ id: 'unknown-uuid' }) });
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.kit).toBeUndefined();
    expect(body.error).toBeTruthy();
  });

  it('Erreur base de données : renvoie HTTP 500 sans retomber sur un faux kit', async () => {
    mocks.queryData = null;
    mocks.queryError = { message: 'DB timeout' };
    const { GET } = await import('@/app/api/kits/[id]/sheet/route');
    const req = new Request('http://localhost:3000/api/kits/err-uuid/sheet') as any;
    const res = await GET(req, { params: Promise.resolve({ id: 'err-uuid' }) });
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.kit).toBeUndefined();
    expect(body.error).toContain('DB timeout');
  });
});

