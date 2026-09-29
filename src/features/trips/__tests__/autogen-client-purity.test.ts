/**
 * AUTOGEN-1 - un composant client ne doit pas commander le serveur en direct.
 *
 * Mesure, 2026-09-29 : `AutoGenTripCreateView.tsx` importait EN VALEUR
 * `features/trips/server/createTripFromAutogenIntent.ts`, qui atteint
 * `lib/ai/serviceClient.ts`. Ce module commence par `import 'server-only'`,
 * donc le bundle client le tirait et Next faisait tomber TOUTES les routes
 * en 500 - `/prepare`, `/` et `/hub` mesures a 500 le meme jour.
 *
 * Le test lit les DEUX fichiers plutot que la sortie de build : un build Next
 * demande plusieurs minutes et son echec ne dit pas quel import est fautif.
 * Ici, le morsant doit tomber sur le nom `AUTOGEN-1`, en une seconde.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createTripFromAutogenIntent } from '@/features/trips/server/createTripFromAutogenIntent';
import { enforceRateLimit } from '@/lib/rate-limit/routes';

vi.mock('@/features/trips/server/createTripFromAutogenIntent', () => ({
  createTripFromAutogenIntent: vi.fn(),
}));
vi.mock('@/lib/rate-limit/routes', () => ({ enforceRateLimit: vi.fn() }));
vi.mock('@/lib/rate-limit', () => ({ clientIpFromHeaders: vi.fn(() => 'ip') }));
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'u1' } } })) },
  })),
}));

const ROOT = join(process.cwd(), 'src');
const VIEW = join(ROOT, 'features/trips/components/autoGen/AutoGenTripCreateView.tsx');
const ROUTE = join(ROOT, 'app/api/trips/autogen/route.ts');

const read = (p: string) => readFileSync(p, 'utf8');

/** Les imports EN VALEUR seulement : `import type` est efface par SWC. */
function valueImports(source: string): string[] {
  return source
    .split('\n')
    .filter((l) => /^\s*import\s+(?!type\b)\{?\s*[A-Za-z_$]/.test(l))
    .map((l) => {
      const m = l.match(/from\s+'([^']+)'/);
      return m ? m[1] : '';
    })
    .filter(Boolean);
}

describe('AUTOGEN-1 - la commande autogen reste cote serveur', () => {
  it("AUTOGEN-1-01: la vue client n importe aucun module serveur en valeur", () => {
    const serverish = valueImports(read(VIEW)).filter(
      (m) => m.includes('/server/') || m.includes('lib/ai/serviceClient'),
    );
    expect(
      serverish,
      "un composant 'use client' ne doit pas importer un module serveur en valeur : cela entrainera server-only dans le bundle et fera tomber toutes les routes en 500.",
    ).toEqual([]);
  });

  it('AUTOGEN-1-02: la vue client appelle la Route Handler, pas la fonction', () => {
    expect(read(VIEW)).toContain("fetch('/api/trips/autogen'");
  });

  it('AUTOGEN-1-03: la Route Handler existe et appelle la commande canonique', () => {
    const route = read(ROUTE);
    expect(route).toContain('createTripFromAutogenIntent');
    expect(route).toContain("runtime = 'nodejs'");
  });
});

describe('AUTOGEN-2 - le contrat de la Route Handler', () => {
  const post = async (body: string) => {
    const { POST } = await import('@/app/api/trips/autogen/route');
    return POST(
      new Request('http://localhost/api/trips/autogen', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body,
      }) as never,
    );
  };

  beforeEach(() => {
    vi.mocked(enforceRateLimit).mockReset();
    vi.mocked(createTripFromAutogenIntent).mockReset();
  });

  it('AUTOGEN-2-01: un succes repond 200 avec le voyage cree', async () => {
    vi.mocked(enforceRateLimit).mockResolvedValue(null as never);
    vi.mocked(createTripFromAutogenIntent).mockResolvedValue({
      ok: true,
      tripId: 't1',
      slug: 'chamonix-2j',
      title: 'Chamonix',
      warnings: [],
    } as never);
    const res = await post(JSON.stringify({ rawInput: 'randonnee' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, slug: 'chamonix-2j' });
  });

  it('AUTOGEN-2-02: un echec garde le statut de la commande, jamais un 200', async () => {
    vi.mocked(enforceRateLimit).mockResolvedValue(null as never);
    vi.mocked(createTripFromAutogenIntent).mockResolvedValue({
      ok: false,
      status: 429,
      error: 'trop',
      retryAfterS: 30,
    } as never);
    const res = await post(JSON.stringify({ rawInput: 'randonnee' }));
    expect(res.status).toBe(429);
    expect(await res.json()).toMatchObject({ ok: false, retryAfterS: 30 });
  });

  it('AUTOGEN-2-03: la limite de debit est appliquee avant toute commande', async () => {
    vi.mocked(enforceRateLimit).mockResolvedValue(new Response('trop', { status: 429 }) as never);
    const res = await post('{}');
    expect(res.status).toBe(429);
    expect(createTripFromAutogenIntent).not.toHaveBeenCalled();
  });
});