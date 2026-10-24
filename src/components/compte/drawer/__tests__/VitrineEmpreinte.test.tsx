// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Le runtime réel expose `resolveSetVis` (`'public'` → 2, `'prive'` → 0).
 * Le mock permet de couvrir le repli `cyclevis` d'un runtime plus ancien.
 */
const runtimeCapability = vi.hoisted(() => ({ exact: true }));

vi.mock('../../compte-liquid-glass-v8-runtime', () => ({
  resolveSetVis: (value: unknown) => {
    if (!runtimeCapability.exact) return null;
    if (value === 'public') return 2;
    if (value === 'prive') return 0;
    if (value === 0 || value === 1 || value === 2) return value;
    return null;
  },
}));

import { VitrineSlot, SIGNATURE_VISIBILITY_EVENT } from '../slots/VitrineSlot';

type RuntimeState = { vis: number };
type RuntimeWindow = Window & {
  __lkdvCompteAct?: (action: string, value?: unknown, meta?: unknown) => void;
  __lkdvGetState?: () => { S: RuntimeState };
  __lkdvOnMutate?: (key: string, value: unknown, state?: unknown, meta?: unknown) => unknown;
};

const runtimeWindow = () => window as unknown as RuntimeWindow;

function installRuntime(vis: number, act = vi.fn()) {
  const state: RuntimeState = { vis };
  runtimeWindow().__lkdvCompteAct = act;
  runtimeWindow().__lkdvGetState = () => ({ S: state });
  runtimeWindow().__lkdvOnMutate = vi.fn();
  return { act, state };
}

function emitSignatureVisibility(detail: {
  value: 'private' | 'communaute' | 'public';
  persisted: boolean;
  revertedTo?: 'private' | 'communaute' | 'public';
  requestId?: number;
}) {
  fireEvent(window, new CustomEvent(SIGNATURE_VISIBILITY_EVENT, { detail }));
}

function signatureRequestId(act: ReturnType<typeof vi.fn>): number | undefined {
  const meta = act.mock.calls[0]?.[2] as { signatureRequestId?: number } | undefined;
  return meta?.signatureRequestId;
}

afterEach(() => {
  cleanup();
  const win = runtimeWindow();
  delete win.__lkdvCompteAct;
  delete win.__lkdvGetState;
  delete win.__lkdvOnMutate;
  runtimeCapability.exact = true;
});

beforeEach(() => {
  runtimeCapability.exact = true;
});

const STATS = {
  km: 351,
  dplus: 20200,
  outings: 10,
  nights: 4,
  massifs: 3,
  countries: 2,
  yearMonths: [],
  bestMonth: 'Août',
  longestOuting: 58,
};

const STAMPS = [
  { id: 's1', name: 'Néouvielle', kind: 'massif', outings: 2, verified: true },
  { id: 's2', name: 'Vercors', kind: 'massif', outings: 1, verified: false },
];

describe('Vitrine — Empreinte par massif', () => {
  it('affiche les massifs réels et applique la visibilité exacte avec setvis', async () => {
    const { act, state } = installRuntime(
      2,
      vi.fn((action: string, value?: unknown) => {
        if (action === 'setvis' && value === 'prive') state.vis = 0;
        if (action === 'setvis' && value === 'public') state.vis = 2;
      })
    );

    render(
      <VitrineSlot
        lens="stats"
        viewer="owner"
        payload={{ stats: STATS, stamps: STAMPS, visibility: { profile: 'public' } }}
      />
    );

    expect(screen.getByRole('heading', { name: 'Empreinte' })).toBeTruthy();
    expect(screen.getByText('Néouvielle')).toBeTruthy();
    expect(screen.getByText('2 sorties')).toBeTruthy();
    expect(screen.getAllByText('Vérifié')).toHaveLength(1);
    expect(screen.getByText('Vercors')).toBeTruthy();
    expect(screen.getByText('1 sortie')).toBeTruthy();

    const group = screen.getByRole('group', { name: 'Visibilité de l’empreinte' });
    const publicButton = within(group).getByRole('button', { name: 'Public' });
    const privateButton = within(group).getByRole('button', { name: 'Privé' });
    expect(publicButton.getAttribute('aria-pressed')).toBe('true');
    expect(privateButton.getAttribute('aria-pressed')).toBe('false');

    fireEvent.click(privateButton);

    // Cible exacte : jamais le cycle à trois états, et aucun état pressé
    // avant la confirmation de persistance.
    await waitFor(() =>
      expect(act).toHaveBeenCalledWith(
        'setvis',
        'prive',
        expect.objectContaining({
          preserveSlot: true,
          signatureRequestId: expect.any(Number),
        })
      )
    );
    expect(act).not.toHaveBeenCalledWith('cyclevis');
    expect(publicButton.getAttribute('aria-pressed')).toBe('true');
    expect(privateButton.getAttribute('aria-pressed')).toBe('false');

    emitSignatureVisibility({
      value: 'private',
      persisted: true,
      requestId: signatureRequestId(act),
    });
    await waitFor(() =>
      expect(privateButton.getAttribute('aria-pressed')).toBe('true')
    );
    expect(publicButton.getAttribute('aria-pressed')).toBe('false');
  });

  it('rétablit l’état confirmé et affiche une erreur si la persistance échoue', async () => {
    const { act, state } = installRuntime(
      2,
      vi.fn((action: string, value?: unknown) => {
        if (action === 'setvis' && value === 'prive') state.vis = 0;
      })
    );

    render(
      <VitrineSlot
        lens="stats"
        viewer="owner"
        payload={{ stats: STATS, stamps: STAMPS, visibility: { profile: 'public' } }}
      />
    );

    const group = screen.getByRole('group', { name: 'Visibilité de l’empreinte' });
    const publicButton = within(group).getByRole('button', { name: 'Public' });
    const privateButton = within(group).getByRole('button', { name: 'Privé' });

    fireEvent.click(privateButton);
    await waitFor(() => expect(act).toHaveBeenCalled());
    expect(privateButton.hasAttribute('disabled')).toBe(true);
    expect(publicButton.hasAttribute('disabled')).toBe(true);

    emitSignatureVisibility({
      value: 'private',
      persisted: false,
      revertedTo: 'public',
      requestId: signatureRequestId(act),
    });

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toMatch(/n’a pas pu être enregistrée/);
    await waitFor(() =>
      expect(publicButton.getAttribute('aria-pressed')).toBe('true')
    );
    expect(privateButton.getAttribute('aria-pressed')).toBe('false');
    expect(privateButton.hasAttribute('disabled')).toBe(false);
    expect(privateButton.getAttribute('aria-busy')).toBeNull();
  });

  it('ignore un événement obsolète et bloque un second clic pendant la persistance', async () => {
    const { act, state } = installRuntime(
      2,
      vi.fn((action: string, value?: unknown) => {
        if (action === 'setvis' && value === 'prive') state.vis = 0;
        if (action === 'setvis' && value === 'public') state.vis = 2;
      })
    );

    render(
      <VitrineSlot
        lens="stats"
        viewer="owner"
        payload={{ stats: STATS, stamps: STAMPS, visibility: { profile: 'public' } }}
      />
    );

    const group = screen.getByRole('group', { name: 'Visibilité de l’empreinte' });
    const publicButton = within(group).getByRole('button', { name: 'Public' });
    const privateButton = within(group).getByRole('button', { name: 'Privé' });

    fireEvent.click(privateButton);
    await waitFor(() => expect(act).toHaveBeenCalledTimes(1));
    const requestId = signatureRequestId(act);

    // Les deux boutons sont gelés : un clic opposé ne déclenche pas d'écriture.
    fireEvent.click(publicButton);
    fireEvent.click(privateButton);
    expect(act).toHaveBeenCalledTimes(1);

    // Un événement d'une autre requête ne confirme rien.
    emitSignatureVisibility({
      value: 'private',
      persisted: true,
      requestId: (requestId ?? 0) + 100,
    });
    await Promise.resolve();
    expect(privateButton.getAttribute('aria-pressed')).toBe('false');
    expect(privateButton.hasAttribute('disabled')).toBe(true);

    emitSignatureVisibility({
      value: 'private',
      persisted: true,
      requestId,
    });
    await waitFor(() =>
      expect(privateButton.getAttribute('aria-pressed')).toBe('true')
    );
    expect(privateButton.hasAttribute('disabled')).toBe(false);

    // Une fois la confirmation reçue, la cible opposée est de nouveau possible.
    fireEvent.click(publicButton);
    await waitFor(() => expect(act).toHaveBeenCalledTimes(2));
    expect(act.mock.calls[1]?.[1]).toBe('public');
  });

  it('aligne l’état pressé initial sur le runtime malgré un payload désaligné', () => {
    // Profil public mais empreinte Communauté (S.vis = 1) : aucun bouton.
    installRuntime(1);

    render(
      <VitrineSlot
        lens="stats"
        viewer="owner"
        payload={{ stats: STATS, stamps: STAMPS, visibility: { profile: 'public' } }}
      />
    );

    const group = screen.getByRole('group', { name: 'Visibilité de l’empreinte' });
    expect(
      within(group).getByRole('button', { name: 'Public' }).getAttribute('aria-pressed')
    ).toBe('false');
    expect(
      within(group).getByRole('button', { name: 'Privé' }).getAttribute('aria-pressed')
    ).toBe('false');
  });

  it('affiche Public quand le profil est privé mais que le runtime est public', () => {
    // Profil privé mais empreinte publique (S.vis = 2) : Public est pressé.
    installRuntime(2);

    render(
      <VitrineSlot
        lens="stats"
        viewer="owner"
        payload={{ stats: STATS, stamps: STAMPS, visibility: { profile: 'prive' } }}
      />
    );

    const group = screen.getByRole('group', { name: 'Visibilité de l’empreinte' });
    expect(
      within(group).getByRole('button', { name: 'Public' }).getAttribute('aria-pressed')
    ).toBe('true');
    expect(
      within(group).getByRole('button', { name: 'Privé' }).getAttribute('aria-pressed')
    ).toBe('false');
  });

  it('ne revendique aucune cible quand l’état runtime est illisible', async () => {
    const act = vi.fn();
    runtimeWindow().__lkdvCompteAct = act;
    runtimeWindow().__lkdvOnMutate = vi.fn();
    // Pas de __lkdvGetState : l'action ne peut pas être vérifiée.

    render(
      <VitrineSlot
        lens="stats"
        viewer="owner"
        payload={{ stats: STATS, stamps: STAMPS, visibility: { profile: 'public' } }}
      />
    );

    const group = screen.getByRole('group', { name: 'Visibilité de l’empreinte' });
    fireEvent.click(within(group).getByRole('button', { name: 'Privé' }));

    await waitFor(() => expect(act).toHaveBeenCalledWith('setvis', 'prive', expect.anything()));
    // Le payload reste le seul état connu : pas de « appliqué » inventé.
    expect(
      within(group).getByRole('button', { name: 'Public' }).getAttribute('aria-pressed')
    ).toBe('true');
    expect(
      within(group).getByRole('button', { name: 'Privé' }).getAttribute('aria-pressed')
    ).toBe('false');
  });

  it('conserve la cible confirmée après un remontage du slot', async () => {
    const { act, state } = installRuntime(
      2,
      vi.fn((action: string, value?: unknown) => {
        if (action === 'setvis' && value === 'prive') state.vis = 0;
      })
    );
    // Le runtime reconstruit le portail à chaque mutation : le payload, lui,
    // reste stable. La cible confirmée doit survivre à ce remontage.
    const payload = {
      stats: STATS,
      stamps: STAMPS,
      visibility: { profile: 'public' },
    };

    const first = render(
      <VitrineSlot lens="stats" viewer="owner" payload={payload} />
    );
    const group = screen.getByRole('group', { name: 'Visibilité de l’empreinte' });
    fireEvent.click(within(group).getByRole('button', { name: 'Privé' }));
    await waitFor(() => expect(act).toHaveBeenCalled());
    emitSignatureVisibility({
      value: 'private',
      persisted: true,
      requestId: signatureRequestId(act),
    });
    await waitFor(() =>
      expect(
        within(group).getByRole('button', { name: 'Privé' }).getAttribute('aria-pressed')
      ).toBe('true')
    );

    first.unmount();
    render(<VitrineSlot lens="stats" viewer="owner" payload={payload} />);

    const remounted = screen.getByRole('group', { name: 'Visibilité de l’empreinte' });
    expect(within(remounted).getByRole('button', { name: 'Privé' }).getAttribute('aria-pressed')).toBe(
      'true'
    );
    expect(
      within(remounted).getByRole('button', { name: 'Public' }).getAttribute('aria-pressed')
    ).toBe('false');
  });

  it('replie sur cyclevis quand setvis est absent et reflète l’état réel', async () => {
    runtimeCapability.exact = false;
    const { act, state } = installRuntime(
      2,
      vi.fn((action: string) => {
        if (action === 'cyclevis') state.vis = (state.vis + 1) % 3;
      })
    );

    render(
      <VitrineSlot
        lens="stats"
        viewer="owner"
        payload={{ stats: STATS, stamps: STAMPS, visibility: { profile: 'public' } }}
      />
    );

    const group = screen.getByRole('group', { name: 'Visibilité de l’empreinte' });
    fireEvent.click(within(group).getByRole('button', { name: 'Privé' }));

    await waitFor(() => expect(act).toHaveBeenCalledWith('cyclevis'));
    expect(act).not.toHaveBeenCalledWith('setvis', expect.anything());
    await waitFor(() =>
      expect(
        within(group).getByRole('button', { name: 'Privé' }).getAttribute('aria-pressed')
      ).toBe('true')
    );
  });

  it('ne prétend ni public ni privé quand le cycle réel tombe sur Communauté', async () => {
    runtimeCapability.exact = false;
    const { state } = installRuntime(
      0,
      vi.fn((action: string) => {
        if (action === 'cyclevis') state.vis = (state.vis + 1) % 3;
      })
    );

    render(
      <VitrineSlot
        lens="stats"
        viewer="owner"
        payload={{ stats: STATS, stamps: STAMPS, visibility: { profile: 'prive' } }}
      />
    );

    const group = screen.getByRole('group', { name: 'Visibilité de l’empreinte' });
    fireEvent.click(within(group).getByRole('button', { name: 'Public' }));

    // Le cycle réel tombe sur Communauté : aucun des deux boutons ne ment.
    await waitFor(() =>
      expect(
        within(group).getByRole('button', { name: 'Privé' }).getAttribute('aria-pressed')
      ).toBe('false')
    );
    expect(
      within(group).getByRole('button', { name: 'Public' }).getAttribute('aria-pressed')
    ).toBe('false');
  });

  it('masque le bloc Empreinte et son contrôle au visiteur', () => {
    render(
      <VitrineSlot
        lens="stats"
        viewer="visitor"
        payload={{ stats: STATS, stamps: STAMPS, visibility: { profile: 'public' } }}
      />
    );

    expect(screen.queryByRole('heading', { name: 'Empreinte' })).toBeNull();
    expect(screen.queryByRole('group', { name: 'Visibilité de l’empreinte' })).toBeNull();
    expect(screen.queryByText('Néouvielle')).toBeNull();
  });

  it('affiche l’état vide quand aucun massif n’est rattaché', () => {
    render(
      <VitrineSlot
        lens="stats"
        viewer="owner"
        payload={{ stats: STATS, stamps: [], visibility: { profile: 'prive' } }}
      />
    );

    expect(screen.getByText('Aucun massif rattaché à vos sorties')).toBeTruthy();
    const group = screen.getByRole('group', { name: 'Visibilité de l’empreinte' });
    expect(within(group).getByRole('button', { name: 'Privé' }).getAttribute('aria-pressed')).toBe(
      'true'
    );
  });
});
