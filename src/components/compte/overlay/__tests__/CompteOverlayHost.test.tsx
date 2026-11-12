// @vitest-environment jsdom
/**
 * Le bootstrap du Compte a deux consommateurs. Contrairement à l'hôte
 * principal, l'overlay ne doit pas traiter un HTTP 200 porteur d'un payload
 * d'erreur comme une réussite : sinon les drawers Empreinte/Confiance
 * affichent des zéros au lieu d'une erreur, sans aucun retry.
 */
import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CompteOverlayHost } from '../CompteOverlayHost';

let fetchMock: ReturnType<typeof vi.fn>;
let answer: () => Promise<unknown>;

function json(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

const ERROR_PAYLOAD = { authenticated: false, error: 'bootstrap_unavailable' };
const SUCCESS_PAYLOAD = {
  authenticated: true,
  profile: { handle: 'owner', name: 'Propriétaire' },
  stats: { outings: 2, km: 12, dplus: 300 },
  badges: [],
  gearItems: [],
  kits: [],
  followers: [],
  species: [],
  trust: null,
};

beforeEach(() => {
  answer = () => Promise.resolve(json(ERROR_PAYLOAD));
  fetchMock = vi.fn(() => answer());
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  delete (window as any).__lkdvCompteOverlay;
});

async function openSeal() {
  render(<CompteOverlayHost />);
  await waitFor(() => expect((window as any).__lkdvCompteOverlay).toBeTruthy());
  await act(async () => {
    (window as any).__lkdvCompteOverlay.openSeal();
  });
}

describe('CompteOverlayHost — bootstrap privé', () => {
  it('traite un payload 200 d’erreur comme une erreur, sans cache, et permet de réessayer', async () => {
    await openSeal();

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('Impossible de charger les données.');
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/compte/bootstrap',
      expect.objectContaining({ cache: 'no-store', credentials: 'same-origin' })
    );

    answer = () => Promise.resolve(json(SUCCESS_PAYLOAD));
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(screen.queryByText('Impossible de charger les données.')).toBeNull()
    );
  });

  it('refuse aussi un payload non authentifié sans champ error', async () => {
    answer = () => Promise.resolve(json({ authenticated: false }));

    await openSeal();

    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Réessayer' })).toBeTruthy();
  });
});
