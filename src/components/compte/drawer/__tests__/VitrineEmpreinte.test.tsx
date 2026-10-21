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

import { VitrineSlot } from '../slots/VitrineSlot';

type RuntimeState = { vis: number };
type RuntimeWindow = Window & {
  __lkdvCompteAct?: (action: string, value?: unknown) => void;
  __lkdvGetState?: () => { S: RuntimeState };
};

const runtimeWindow = () => window as unknown as RuntimeWindow;

function installRuntime(vis: number, act = vi.fn()) {
  const state: RuntimeState = { vis };
  runtimeWindow().__lkdvCompteAct = act;
  runtimeWindow().__lkdvGetState = () => ({ S: state });
  return { act, state };
}

afterEach(() => {
  cleanup();
  const win = runtimeWindow();
  delete win.__lkdvCompteAct;
  delete win.__lkdvGetState;
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

    // Cible exacte : jamais le cycle à trois états.
    await waitFor(() => expect(act).toHaveBeenCalledWith('setvis', 'prive'));
    expect(act).not.toHaveBeenCalledWith('cyclevis');
    await waitFor(() =>
      expect(privateButton.getAttribute('aria-pressed')).toBe('true')
    );
    expect(publicButton.getAttribute('aria-pressed')).toBe('false');
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

    await waitFor(() => expect(act).toHaveBeenCalledWith('setvis', 'prive'));
    // Le payload reste le seul état connu : pas de « appliqué » inventé.
    expect(
      within(group).getByRole('button', { name: 'Public' }).getAttribute('aria-pressed')
    ).toBe('true');
    expect(
      within(group).getByRole('button', { name: 'Privé' }).getAttribute('aria-pressed')
    ).toBe('false');
  });

  it('conserve la cible appliquée après un remontage du slot', async () => {
    const { state } = installRuntime(
      2,
      vi.fn((action: string, value?: unknown) => {
        if (action === 'setvis' && value === 'prive') state.vis = 0;
      })
    );
    // Le runtime reconstruit le portail à chaque mutation : le payload, lui,
    // reste stable. La cible appliquée doit survivre à ce remontage.
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
