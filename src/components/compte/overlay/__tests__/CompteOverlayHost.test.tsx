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

async function openTrust() {
  render(<CompteOverlayHost />);
  await waitFor(() => expect((window as any).__lkdvCompteOverlay).toBeTruthy());
  await act(async () => {
    (window as any).__lkdvCompteOverlay.openTrust();
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

  it('rend l’Empreinte sur un payload valide et affiche 0 pour une liste réellement vide', async () => {
    answer = () => Promise.resolve(json(SUCCESS_PAYLOAD));

    await openSeal();

    expect(await screen.findByText('Empreinte')).toBeTruthy();
    const tribe = screen.getByText('Tribu');
    expect(tribe.parentElement?.textContent).toContain('0');
    expect(screen.queryByText('Liste de la tribu momentanément indisponible.')).toBeNull();
  });

  it('affiche « — » au lieu de zéro quand la liste sociale est indisponible', async () => {
    answer = () =>
      Promise.resolve(
        json({
          ...SUCCESS_PAYLOAD,
          followers: [],
          followersUnavailable: true,
          followListsUnavailable: true,
        })
      );

    await openSeal();

    const tribe = await screen.findByText('Tribu');
    expect(tribe.parentElement?.textContent).toContain('—');
    expect(screen.getByText('Liste de la tribu momentanément indisponible.')).toBeTruthy();
  });

  it.each([
    ['corps vide', {}],
    ['authentifié sans données', { authenticated: true }],
    ['profil nul et stats vides', { authenticated: true, profile: null, stats: {} }],
    ['profil vide et stats vides', { authenticated: true, profile: {}, stats: {} }],
  ])('refuse un payload 200 %s', async (_label, payload) => {
    answer = () => Promise.resolve(json(payload));

    await openSeal();

    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Réessayer' })).toBeTruthy();
  });

  it('refuse un HTTP 500 et un JSON invalide', async () => {
    answer = () => Promise.resolve(json({}, 500));
    await openSeal();
    expect(await screen.findByRole('alert')).toBeTruthy();
    cleanup();

    answer = () =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: async () => {
          throw new Error('json_invalide');
        },
      });
    await openSeal();
    expect(await screen.findByRole('alert')).toBeTruthy();
  });

  it('relit le bootstrap après une fermeture complète', async () => {
    answer = () => Promise.resolve(json(SUCCESS_PAYLOAD));

    await openSeal();
    await screen.findByText('Empreinte');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      (window as any).__lkdvCompteOverlay.close();
    });

    await act(async () => {
      (window as any).__lkdvCompteOverlay.openSeal();
    });

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(await screen.findByText('Empreinte')).toBeTruthy();
  });

  it('affiche « — » pour les compteurs non sociaux indisponibles', async () => {
    answer = () =>
      Promise.resolve(
        json({
          ...SUCCESS_PAYLOAD,
          gearItems: [],
          kits: [],
          gearItemsUnavailable: true,
          kitsUnavailable: true,
          statsUnavailable: true,
        })
      );

    await openSeal();

    expect(await screen.findByText('Empreinte')).toBeTruthy();
    expect(screen.getByText('Matériel').parentElement?.textContent).toContain('—');
    expect(screen.getByText('Kits').parentElement?.textContent).toContain('—');
    expect(screen.getByText('Sorties').parentElement?.textContent).toContain('—');
    expect(
      screen.getByText('Certaines données de l’Empreinte sont momentanément indisponibles.')
    ).toBeTruthy();
  });

  it('affiche « — » pour le score quand le profil est illisible', async () => {
    answer = () =>
      Promise.resolve(
        json({
          authenticated: true,
          profile: null,
          profileUnavailable: true,
          stats: { outings: 0, km: 0, dplus: 0 },
          gearItems: [],
          kits: [],
          followers: [],
          species: [],
          trust: { verified: true, active: 0, onTimeRate: null, rating: null },
        })
      );

    await openTrust();

    expect(await screen.findByText('Indice de confiance')).toBeTruthy();
    const score = screen.getByText('/100').closest('b');
    expect(score?.textContent).toContain('—');
    expect(score?.textContent).not.toContain('0/100');
    expect(screen.getByText('Indice momentanément indisponible.')).toBeTruthy();
  });

  it('affiche « — » pour les prêts quand leur lecture est indisponible', async () => {
    answer = () =>
      Promise.resolve(
        json({
          ...SUCCESS_PAYLOAD,
          profile: { handle: 'owner', name: 'Propriétaire', trustScore: 82 },
          trust: { verified: true, active: 3, onTimeRate: 90, rating: 4.5 },
          trustUnavailable: true,
        })
      );

    await openTrust();

    expect(await screen.findByText('Indice de confiance')).toBeTruthy();
    const score = screen.getByText('/100').closest('b');
    expect(score?.textContent).toContain('—');
    // Les trois agrégats suivent le même flag : aucun 3, 90 % ou 4.5 ne doit
    // subsister dans un écran marqué « Vérification indisponible ».
    expect(screen.getByText('Prêts actifs').parentElement?.textContent).toContain('—');
    expect(screen.getByText('Retours à temps').parentElement?.textContent).toContain('—');
    expect(screen.getByText('Note moyenne').parentElement?.textContent).toContain('—');
    expect(screen.queryByText('90 %')).toBeNull();
    expect(screen.queryByText('4.5')).toBeNull();
  });
});
