import { afterEach, describe, expect, it, vi } from 'vitest';
import { followErrorMessage, ReseauFollowError, setFollow } from '../followClient';

const TARGET = '00000000-0000-4000-8000-000000000002';

function mockFetch(response: Response) {
  const fetchMock = vi.fn().mockResolvedValue(response);
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('followClient — contrat HTTP du suivi', () => {
  it('suit une cible avec un POST qui ne transmet que son identifiant', async () => {
    const fetchMock = mockFetch(json({ status: 'following' }));

    await expect(setFollow(TARGET, 'follow')).resolves.toBe('following');
    expect(fetchMock).toHaveBeenCalledWith('/api/compte/reseau/follow', {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ userId: TARGET }),
    });
  });

  it('remonte l’état "requested" d’un profil privé sans le confondre avec un suivi', async () => {
    mockFetch(json({ status: 'requested' }));

    await expect(setFollow(TARGET, 'follow')).resolves.toBe('requested');
  });

  it('annule un suivi ou une demande avec un DELETE', async () => {
    const fetchMock = mockFetch(json({ status: 'unfollowed' }));

    await expect(setFollow(TARGET, 'unfollow')).resolves.toBe('unfollowed');
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      method: 'DELETE',
      body: JSON.stringify({ userId: TARGET }),
    });
  });

  it('relaie le message borné et le code de la route', async () => {
    mockFetch(json({ error: 'Ce profil n’est pas disponible.', code: 'blocked' }, 409));

    const error = await setFollow(TARGET, 'follow').catch((reason: unknown) => reason);
    expect(error).toBeInstanceOf(ReseauFollowError);
    expect(error).toMatchObject({
      message: 'Ce profil n’est pas disponible.',
      code: 'blocked',
      httpStatus: 409,
    });
    expect(followErrorMessage(error)).toBe('Ce profil n’est pas disponible.');
  });

  it('refuse une réponse de succès sans statut exploitable', async () => {
    mockFetch(json({ status: 'pending' }));

    await expect(setFollow(TARGET, 'follow')).rejects.toMatchObject({
      name: 'ReseauFollowError',
      code: 'invalid_response',
    });
  });

  it('donne un repli lisible quand le corps d’erreur n’est pas du JSON', async () => {
    mockFetch(new Response('gateway', { status: 502 }));

    const error = await setFollow(TARGET, 'follow').catch((reason: unknown) => reason);
    expect(followErrorMessage(error)).toBe('Impossible de mettre à jour cet abonnement.');
  });
});
