// @vitest-environment jsdom

/**
 * Audit de robustesse du 13/11, points 3 et 4 : l'écran de départ du Compas (`V5Start`).
 *
 * 3. Une création rejetée (réseau coupé) ne remonte plus à l'écran d'erreur : un message local, la
 *    phrase reste dans le champ.
 * 4. Un visiteur non connecté garde sa phrase (sessionStorage, jamais dans l'URL) : elle revient dans
 *    le champ au retour sur /compas, une seule fois. Un stockage refusé ne casse rien.
 *
 * Les points serveur (1, 2, 5, 6, 7, 8) sont dans `auditRobustesse1311.test.ts`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

const h = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
  create: vi.fn(),
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: h.push, replace: h.replace, refresh: h.refresh }),
  usePathname: () => '/compas',
}));
vi.mock('../server/compasActions', () => ({ compasCreateTripAction: h.create }));

import { START_PHRASE_KEY, V5Start } from '../v5/V5Start';

const PHRASE = 'Trois jours dans le Vercors avec deux amis';
const field = () => screen.getByRole('textbox') as HTMLInputElement;
const submit = async () => {
  await act(async () => {
    fireEvent.submit(field().closest('form') as HTMLFormElement);
  });
};

beforeEach(() => {
  window.sessionStorage.clear();
  h.push.mockReset();
  h.replace.mockReset();
  h.refresh.mockReset();
  h.create.mockReset();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('3. création rejetée : message local, phrase gardée', () => {
  it('un rejet réseau ne lève rien et laisse la phrase dans le champ', async () => {
    h.create.mockRejectedValue(new Error('Failed to fetch'));
    render(<V5Start signedIn />);
    fireEvent.change(field(), { target: { value: PHRASE } });
    await submit();
    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
    expect(screen.getByRole('alert').textContent).toBe('Je n’ai pas pu créer l’aventure. Réessaie.');
    expect(field().value).toBe(PHRASE);
    expect(h.replace).not.toHaveBeenCalled();
  });

  it('un refus rendu par l’action reste affiché, phrase gardée (inchangé)', async () => {
    h.create.mockResolvedValue({ success: false, error: 'Trop de créations d’affilée : patiente une minute.' });
    render(<V5Start signedIn />);
    fireEvent.change(field(), { target: { value: PHRASE } });
    await submit();
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Trop de créations'));
    expect(field().value).toBe(PHRASE);
  });

  it('un succès ouvre le Compas', async () => {
    h.create.mockResolvedValue({ success: true });
    render(<V5Start signedIn />);
    fireEvent.change(field(), { target: { value: PHRASE } });
    await submit();
    await waitFor(() => expect(h.replace).toHaveBeenCalledWith('/compas'));
  });
});

describe('4. visiteur non connecté : la phrase survit à la connexion', () => {
  it('avant la redirection, la phrase est gardée en sessionStorage et absente de l’URL', async () => {
    render(<V5Start signedIn={false} />);
    fireEvent.change(field(), { target: { value: PHRASE } });
    await submit();
    expect(h.push).toHaveBeenCalledTimes(1);
    const url = String(h.push.mock.calls[0]?.[0]);
    expect(url).toBe('/connexion?next=%2Fcompas');
    expect(url).not.toContain('Vercors');
    expect(window.sessionStorage.getItem(START_PHRASE_KEY)).toBe(PHRASE);
    expect(h.create).not.toHaveBeenCalled();
  });

  it('au retour sur /compas, la phrase revient dans le champ puis est effacée', () => {
    window.sessionStorage.setItem(START_PHRASE_KEY, PHRASE);
    render(<V5Start signedIn />);
    expect(field().value).toBe(PHRASE);
    expect(window.sessionStorage.getItem(START_PHRASE_KEY)).toBeNull();
    cleanup();
    render(<V5Start signedIn />);
    expect(field().value).toBe('');
  });

  it('un sessionStorage qui refuse (écriture, lecture) ne casse ni la redirection ni l’affichage', async () => {
    const boom = () => {
      throw new DOMException('refusé', 'SecurityError');
    };
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(boom);
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(boom);
    render(<V5Start signedIn={false} />);
    expect(field().value).toBe('');
    fireEvent.change(field(), { target: { value: PHRASE } });
    await submit();
    expect(h.push).toHaveBeenCalledWith('/connexion?next=%2Fcompas');
  });
});
