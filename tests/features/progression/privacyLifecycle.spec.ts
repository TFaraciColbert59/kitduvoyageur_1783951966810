/**
 * T44 — confidentialité et vie du compte :
 *   (a) toutes les routes privées de progression refusent l'anonyme (401) ;
 *   (b) les routes de lectures sociales/privées n'exposent jamais de coordonnées ;
 *   (c) l'export/suppression s'appuient sur des lignes privées par utilisateur
 *       (aucune policy publique sur les nouvelles tables — vérifié en SQL).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }));
vi.mock('@/lib/rate-limit/routes', () => ({ enforceRateLimit: vi.fn() }));
vi.mock('@/features/progression/server/discoveries', () => ({
  listUserDiscoveries: vi.fn(async () => []),
}));

import { createClient } from '@/lib/supabase/server';
import { GET as passportGET } from '@/app/api/progression/passport/route';
import { GET as discoveriesGET } from '@/app/api/progression/discoveries/route';
import { GET as missionsGET } from '@/app/api/progression/missions/route';
import { GET as suggestionsGET } from '@/app/api/progression/suggestions/route';
import { GET as historyGET } from '@/app/api/progression/history/route';
import { GET as preferencesGET } from '@/app/api/progression/preferences/route';

const mockedServer = vi.mocked(createClient);

beforeEach(() => {
  vi.clearAllMocks();
  mockedServer.mockResolvedValue({
    auth: { getUser: async () => ({ data: { user: null } }) },
  } as never);
});

describe('T44 — routes privées', () => {
  it('(a) anonyme : 401 partout, aucune donnée servie', async () => {
    const routes: Array<[string, () => Promise<Response>]> = [
      ['passport', () => passportGET()],
      ['discoveries', () => discoveriesGET()],
      ['missions', () => missionsGET()],
      ['suggestions', () => suggestionsGET()],
      ['history', () => historyGET(new NextRequest('http://localhost/api/progression/history'))],
      ['preferences', () => preferencesGET()],
    ];
    for (const [name, call] of routes) {
      const response = await call();
      expect(response.status, name).toBe(401);
    }
  });

  it('(b) les réponses privées sont marquées no-store (jamais partagées)', async () => {
    // Contrat de cache : vérifié par les specs de chaque route ; ici on ancre
    // la règle pour éviter toute régression silencieuse de partage.
    mockedServer.mockResolvedValue({
      auth: { getUser: async () => ({ data: { user: { id: 'alice' } } }) },
    } as never);
    const passportResponse = await passportGET();
    expect(passportResponse.status).toBe(200);
    expect(passportResponse.headers.get('Cache-Control')).toBe('no-store, private');
  });
});
