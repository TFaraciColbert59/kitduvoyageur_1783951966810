import { beforeEach, describe, expect, it, vi } from 'vitest';

/** Retour d'e-mail (/auth/callback) : un chemin du site seulement, et « garder mon essai » ne casse pas. */
const h = vi.hoisted(() => ({ exchange: vi.fn(async (..._a: unknown[]) => ({ error: null as null | { message: string } })) }));
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { exchangeCodeForSession: h.exchange } }),
}));

import { GET } from '../callback/route';
import { safeNextPath } from '@/lib/supabase/safeNext';

const call = (qs: string) => GET(new Request(`https://lekitduvoyageur.fr/auth/callback?${qs}`));
const where = (res: Response) => res.headers.get('location');

beforeEach(() => h.exchange.mockClear().mockResolvedValue({ error: null }));

describe('safeNextPath', () => {
  it('garde un chemin du site, refuse tout ce qui en sortirait', () => {
    expect(safeNextPath('/compte/garder-mon-essai?lien=ok')).toBe('/compte/garder-mon-essai?lien=ok');
    expect(safeNextPath(null)).toBe('/compte');
    expect(safeNextPath('')).toBe('/compte');
    for (const bad of ['//evil.example', '/\\evil.example', 'https://evil.example', 'evil.example', '/ok\nSet-Cookie: x', '/' + 'a'.repeat(400)]) {
      expect(safeNextPath(bad)).toBe('/compte');
    }
    expect(safeNextPath('//evil.example', '/compas')).toBe('/compas');
  });
});

describe('GET /auth/callback', () => {
  it('code valide : retourne vers la page demandée, sur le site', async () => {
    const res = await call(`code=abc&next=${encodeURIComponent('/compte/garder-mon-essai?lien=ok')}`);
    expect(h.exchange).toHaveBeenCalledWith('abc');
    expect(where(res)).toBe('https://lekitduvoyageur.fr/compte/garder-mon-essai?lien=ok');
  });

  it('next hors du site : retombe sur /compte (pas de redirection ouverte)', async () => {
    const res = await call('code=abc&next=//evil.example/x');
    expect(where(res)).toBe('https://lekitduvoyageur.fr/compte');
  });

  it('échange impossible : connexion en erreur, sauf pour « garder mon essai » qui l’explique', async () => {
    h.exchange.mockResolvedValue({ error: { message: 'bad_code_verifier' } });
    expect(where(await call('code=abc'))).toBe('https://lekitduvoyageur.fr/connexion?error=callback_failed');
    expect(where(await call(`code=abc&next=${encodeURIComponent('/compte/garder-mon-essai?lien=ok')}`))).toBe(
      'https://lekitduvoyageur.fr/compte/garder-mon-essai?lien=echec'
    );
    expect(where(await call('next=/compte'))).toBe('https://lekitduvoyageur.fr/connexion?error=callback_failed');
  });
});
