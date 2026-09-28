/**
 * USR-01 — Recherche d'utilisateur reelle pour le tiroir « Avec qui ».
 *
 * Deux questions distinctes, une seule source de verite :
 *  - `scope=friends` : les personnes que la personne suit REELLEMENT
 *    (`user_follows`, colonne `follower_id`) ;
 *  - `scope=all` : n'importe quel profil public, pour inviter une personne qui
 *    n'est pas encore suivie.
 *
 * Le contrat verifie ici est volontairement strict : aucune colonne hors
 * projection publique (`public_profiles`), aucune valeur inventee, aucune
 * erreur silencieuse (503 plutot qu'une liste vide qui ferait croire a un
 * « aucun resultat »), et un terme de recherche neutralise avant d'atteindre
 * la syntaxe PostgREST.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  enforceRateLimit: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.createClient }));
vi.mock('@/lib/rate-limit/routes', () => ({ enforceRateLimit: mocks.enforceRateLimit }));

import { GET } from '@/app/api/users/search/route';
// Les deux fonctions pures vivent HORS de la route : Next.js interdit a un
// `route.ts` d exporter autre chose que son handler. Ce bloc verifie donc
// qu elles restent justes apres le deplacement, pas seulement compilees.
import { sanitizeSearchTerm, toPublicUser } from '@/lib/users/publicUser';

const USER_ID = 'user-1';
const BASE = 'http://localhost/api/users/search';

/** Chaine PostgREST simulee : chaque methode s empile, l attente lit le resultat. */
interface QueryStub {
  calls: { method: string; args: unknown[] }[];
  then: (resolve: (value: unknown) => unknown) => Promise<unknown>;
}

function table(result: { data: unknown; error: unknown }): QueryStub {
  const calls: { method: string; args: unknown[] }[] = [];
  const chain = {
    then: (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve),
  } as QueryStub & Record<string, unknown>;
  chain.calls = calls;
  for (const method of ['select', 'eq', 'neq', 'in', 'or', 'order', 'limit']) {
    chain[method] = (...args: unknown[]) => {
      calls.push({ method, args });
      return chain;
    };
  }
  return chain;
}

function supabaseFor(tables: Record<string, QueryStub>, user: { id: string } | null = { id: USER_ID }) {
  return {
    auth: { getUser: vi.fn(async () => ({ data: { user } })) },
    from: vi.fn((name: string) => {
      const stub = tables[name];
      if (!stub) throw new Error(`table inattendue : ${name}`);
      return stub;
    }),
  };
}

/** Un seul client par defaut, surchargeable test par test. */
function useTables(tables: Record<string, QueryStub>, user: { id: string } | null = { id: USER_ID }): void {
  mocks.createClient.mockResolvedValue(supabaseFor(tables, user));
}

function get(query: string): Promise<Response> {
  return GET(new NextRequest(`${BASE}${query}`));
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.enforceRateLimit.mockResolvedValue(null);
  useTables({});
});

describe('USR-01 — garde-fous de la route', () => {
  it('USR-01-01: sans session, la route refuse (401) et n interroge aucune table', async () => {
    const from = vi.fn();
    mocks.createClient.mockResolvedValue({
      auth: { getUser: vi.fn(async () => ({ data: { user: null } })) },
      from,
    });
    const res = await get('?scope=friends');
    expect(res.status).toBe(401);
    expect(from).not.toHaveBeenCalled();
  });

  it('USR-01-02: le refus anti-rafale est relaie tel quel', async () => {
    const limited = new Response('{}', { status: 429 });
    mocks.enforceRateLimit.mockResolvedValue(limited);
    expect(await get('?scope=all')).toBe(limited);
  });

  it('USR-01-03: un scope inconnu est refuse (400)', async () => {
    expect((await get('?scope=nimporte')).status).toBe(400);
  });

  it('USR-01-04: un terme trop court est refuse (400), comme la recherche de lieu', async () => {
    expect((await get('?q=a')).status).toBe(400);
  });

  it('USR-01-05: un terme qui ne survit pas a la neutralisation est refuse (400)', async () => {
    // "%%" ne contient aucun caractere utile : on ne doit pas le transformer en
    // liste non filtree, ce qui reviendrait a exposer tous les profils.
    expect((await get(`?q=${encodeURIComponent('%%')}`)).status).toBe(400);
  });

  it('USR-01-06: une erreur de base remonte 503, jamais une liste vide silencieuse', async () => {
    useTables({ public_profiles: table({ data: null, error: { message: 'boom' } }) });
    expect((await get('?scope=all')).status).toBe(503);
  });
});

describe('USR-01 — scope=friends : la liste des abonnements reels', () => {
  it('USR-01-10: la liste passe par user_follows puis public_profiles', async () => {
    const follows = table({ data: [{ following_id: 'a' }, { following_id: 'b' }], error: null });
    const profiles = table({
      data: [
        { id: 'a', full_name: 'Camille', avatar_url: 'u1', location: 'Annecy', trust_score: 71 },
        { id: 'b', full_name: 'Karim', avatar_url: '', location: '', trust_score: null },
      ],
      error: null,
    });
    useTables({ user_follows: follows, public_profiles: profiles });

    const res = await get('?scope=friends');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { users: unknown[]; scope: string };
    expect(body.scope).toBe('friends');
    expect(body.users).toHaveLength(2);
    expect(follows.calls.find((c) => c.method === 'eq')?.args).toEqual(['follower_id', USER_ID]);
    expect(profiles.calls.find((c) => c.method === 'in')?.args).toEqual(['id', ['a', 'b']]);
  });

  it('USR-01-11: aucun abonnement => liste vide, et surtout aucune requete profils', async () => {
    const follows = table({ data: [], error: null });
    const profiles = table({ data: [{ id: 'z' }], error: null });
    useTables({ user_follows: follows, public_profiles: profiles });

    expect(await (await get('?scope=friends')).json()).toEqual({ users: [], scope: 'friends' });
    expect(profiles.calls).toHaveLength(0);
  });

  it('USR-01-12: une erreur sur user_follows remonte 503', async () => {
    useTables({ user_follows: table({ data: null, error: { message: 'rls' } }) });
    expect((await get('?scope=friends')).status).toBe(503);
  });

  it('USR-01-13: les doublons d abonnements ne creent pas de doublon d identifiant', async () => {
    const follows = table({ data: [{ following_id: 'a' }, { following_id: 'a' }], error: null });
    const profiles = table({ data: [], error: null });
    useTables({ user_follows: follows, public_profiles: profiles });
    await get('?scope=friends');
    expect(profiles.calls.find((c) => c.method === 'in')?.args).toEqual(['id', ['a']]);
  });
});

describe('USR-01 — scope=all : chercher n importe quel profil public', () => {
  it('USR-01-20: la projection est limitee aux colonnes publiques', async () => {
    const profiles = table({ data: [], error: null });
    useTables({ public_profiles: profiles });
    await get('?scope=all');
    expect(profiles.calls.find((c) => c.method === 'select')?.args[0]).toBe(
      'id, full_name, avatar_url, location, trust_score',
    );
  });

  it('USR-01-21: la personne ne peut pas se retrouver dans ses propres resultats', async () => {
    const profiles = table({ data: [], error: null });
    useTables({ public_profiles: profiles });
    await get('?scope=all');
    expect(profiles.calls.find((c) => c.method === 'neq')?.args).toEqual(['id', USER_ID]);
  });

  it('USR-01-22: le terme est neutralise avant d atteindre la syntaxe PostgREST', async () => {
    const profiles = table({ data: [], error: null });
    useTables({ public_profiles: profiles });
    await get(`?q=${encodeURIComponent('lu%_co')}`);
    const or = profiles.calls.find((c) => c.method === 'or');
    expect(or?.args[0]).toBe('full_name.ilike.*lu co*,location.ilike.*lu co*');
    expect(String(or?.args[0])).not.toContain('%');
    expect(String(or?.args[0])).not.toContain('(');
  });

  it('USR-01-23: le nombre de resultats est borne', async () => {
    useTables({ public_profiles: table({ data: [], error: null }) });
    expect((await get('?limit=500')).status).toBe(400);
  });
});

describe('USR-01 — mapping : aucune valeur inventee', () => {
  it('USR-01-30: un champ vide ou absent devient null, jamais une chaine vide', () => {
    expect(
      toPublicUser({ id: 'x', full_name: 'Iris', avatar_url: '', location: null, trust_score: null }),
    ).toEqual({ id: 'x', fullName: 'Iris', avatarUrl: null, location: null, trustScore: null });
  });

  it('USR-01-31: un score de confiance hors type est null, pas 0', () => {
    expect(
      toPublicUser({ id: 'y', full_name: 'Noé', avatar_url: null, location: 'Chamonix', trust_score: 'n/a' })
        .trustScore,
    ).toBeNull();
  });

  it('USR-01-32: le nom manquant reste une chaine vide, la ligne n est pas supprimee en silence', () => {
    expect(toPublicUser({ id: 'z', avatar_url: null, location: 'Bordeaux', trust_score: 50 }).fullName).toBe('');
  });
});

describe('USR-01 — neutralisation du terme de recherche', () => {
  it('USR-01-40: jokers et separateurs PostgREST disparaissent', () => {
    expect(sanitizeSearchTerm('lu%_co')).toBe('lu co');
  });

  it('USR-01-41: les accents, chiffres et degrees sont conserves', () => {
    expect(sanitizeSearchTerm('  eléa  n°3 ')).toBe('eléa n°3');
  });

  it('USR-01-42: un terme uniquement fait de jokers devient vide', () => {
    expect(sanitizeSearchTerm('%_()')).toBe('');
  });

  it('USR-01-43: la longueur est bornee pour ne pas abusive r du service', () => {
    expect(sanitizeSearchTerm('a'.repeat(200)).length).toBe(60);
  });

  it('USR-01-44: aucun caractere hostile a PostgREST ne survit au filtre', () => {
    // Piege de la classe de caracteres : ecrire `.-` dans `[...]` cree une
    // PLAGE (0x2E..0x2D invalide, mais `.°` couvre 0x2E..0xB0) qui laisse
    // repasser \ ] ^ _ @ A-Z. Chaque caractere de la syntaxe PostgREST est
    // donc verifie un par un, jamais par intuition.
    for (const char of ['_', '\\', '^', ']', '[', '@', '%', '(', ')', ',', '*', ';', '!']) {
      expect(sanitizeSearchTerm(char), `caractere non neutralise : ${char}`).toBe('');
    }
  });

  it('USR-01-45: le tiret de fin de classe reste un tiret, pas une plage', () => {
    expect(sanitizeSearchTerm('Saint-Jean-du-Bruyère')).toBe('Saint-Jean-du-Bruyère');
  });
});
