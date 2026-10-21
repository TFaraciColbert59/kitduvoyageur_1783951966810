// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Le runtime est un module JS volumineux : on ne teste ici que le contrat de
 * détection (`resolveSetVis('public') === 2`, `('prive') === 0`). Le mock
 * conserve la même signature que le runtime réel, y compris l'absence de
 * support exact pour le test du repli `cyclevis`.
 */
const runtimeCapability = vi.hoisted(() => ({ exact: true }));

vi.mock('../../compte-liquid-glass-v8-runtime', () => ({
  initCompteLiquidGlassRuntime: () => () => {},
  resolveSetVis: (value: unknown) => {
    if (!runtimeCapability.exact) return null;
    if (value === 'public') return 2;
    if (value === 'prive') return 0;
    if (value === 0 || value === 1 || value === 2) return value;
    return null;
  },
}));

import { ProfileSettingsSheet } from '../ProfileSettingsSheet';
import { SlotShell } from '../SlotShell';

type RuntimeState = {
  vis: number;
  orient: Record<string, string>;
  traveller: Record<string, string>;
};

type RuntimeWindow = Window & {
  __lkdvCompteAct?: (action: string, value?: unknown) => void;
  __lkdvGetState?: () => { S: RuntimeState };
  __lkdvSetVisibility?: (visibility: 'public' | 'prive') => void;
  __lkdvSupportsSetVis?: boolean;
};

const runtimeWindow = () => window as unknown as RuntimeWindow;

function installRuntime(state: RuntimeState, act = vi.fn()) {
  runtimeWindow().__lkdvCompteAct = act;
  runtimeWindow().__lkdvGetState = () => ({ S: state });
  return act;
}

function makeState(vis = 2): RuntimeState {
  return {
    vis,
    orient: {
      terrain: 'montagne',
      autonomy: 'bivouac_1_2',
      priority: 'legerete',
      experience: 'regulier',
    },
    traveller: {
      nationality: 'France',
      home: 'Lyon',
      currency: 'EUR (€)',
    },
  };
}

function renderShell(
  viewer: 'owner' | 'visitor',
  onOpenSettings?: () => void
) {
  return render(
    <SlotShell
      slot="vitrine"
      viewer={viewer}
      visibility="public"
      title="Vitrine"
      subtitle="Ta trace publique"
      icon={<span aria-hidden="true">◆</span>}
      lenses={[{ id: 'stats', label: 'Stats' }]}
      activeLensIndex={0}
      onLensChange={() => {}}
      onOpenSettings={onOpenSettings}
    >
      contenu
    </SlotShell>
  );
}

async function openSheet(ui: React.ReactElement = <ProfileSettingsSheet viewer="owner" visibility="public" />) {
  render(ui);
  fireEvent(window, new Event('lkdv:open-settings'));
  return screen.findByRole('dialog', { name: 'Réglages du profil' });
}

beforeEach(() => {
  runtimeCapability.exact = true;
});

afterEach(() => {
  cleanup();
  const win = runtimeWindow();
  delete win.__lkdvCompteAct;
  delete win.__lkdvGetState;
  delete win.__lkdvSetVisibility;
  delete win.__lkdvSupportsSetVis;
  runtimeCapability.exact = true;
  vi.restoreAllMocks();
});

describe('Réglages du profil propriétaire', () => {
  it('affiche le bouton Réglages au propriétaire et ouvre toutes les sections', async () => {
    renderShell('owner');

    const button = screen.getByRole('button', { name: 'Réglages du profil' });
    expect(button.getAttribute('aria-label')).toBe('Réglages du profil');

    fireEvent.click(button);
    const dialog = await screen.findByRole('dialog', { name: 'Réglages du profil' });

    for (const heading of [
      'Visibilité du compte',
      'Préférences de marche',
      'Identité voyageur',
      'Qui voit quoi ?',
      'Export RGPD',
      'Déconnexion',
    ]) {
      expect(within(dialog).getByRole('heading', { name: heading })).toBeTruthy();
    }

    expect(within(dialog).getByRole('table', { name: 'Qui voit quoi ?' })).toBeTruthy();
  });

  it('masque le bouton au visiteur', () => {
    renderShell('visitor');
    expect(screen.queryByRole('button', { name: 'Réglages du profil' })).toBeNull();
  });

  it('n’ouvre jamais la feuille pour un visiteur, même sur l’événement public', async () => {
    render(<ProfileSettingsSheet viewer="visitor" visibility="public" />);
    fireEvent(window, new Event('lkdv:open-settings'));
    await Promise.resolve();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('délègue à onOpenSettings quand l’hôte en fournit un', () => {
    const onOpenSettings = vi.fn();
    renderShell('owner', onOpenSettings);

    fireEvent.click(screen.getByRole('button', { name: 'Réglages du profil' }));

    expect(onOpenSettings).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('applique la visibilité exacte avec setvis quand le runtime la supporte', async () => {
    const state = makeState(2);
    const act = installRuntime(
      state,
      vi.fn((action: string, value?: unknown) => {
        if (action === 'setvis' && value === 'prive') state.vis = 0;
        if (action === 'setvis' && value === 'public') state.vis = 2;
      })
    );

    const dialog = await openSheet();
    const group = within(dialog).getByRole('group', { name: 'Visibilité du compte' });
    expect(within(group).getByRole('button', { name: 'Public' }).getAttribute('aria-pressed')).toBe(
      'true'
    );

    fireEvent.click(within(group).getByRole('button', { name: 'Privé' }));

    await waitFor(() => expect(act).toHaveBeenCalledWith('setvis', 'prive'));
    expect(act).not.toHaveBeenCalledWith('cyclevis');
  });

  it('replie honnêtement sur cyclevis quand setvis est absent et affiche l’état réel', async () => {
    runtimeCapability.exact = false;
    const state = makeState(2);
    const act = installRuntime(
      state,
      vi.fn((action: string) => {
        if (action === 'cyclevis') state.vis = (state.vis + 1) % 3;
      })
    );

    const dialog = await openSheet();
    const group = within(dialog).getByRole('group', { name: 'Visibilité du compte' });
    fireEvent.click(within(group).getByRole('button', { name: 'Privé' }));

    await waitFor(() => expect(act).toHaveBeenCalledWith('cyclevis'));
    expect(act).not.toHaveBeenCalledWith('setvis', expect.anything());
    await waitFor(() =>
      expect(within(dialog).getByTestId('settings-visibility-state').textContent).toContain('Privé')
    );
  });

  it('affiche l’état intermédiaire Communauté du cycle sans le masquer', async () => {
    runtimeCapability.exact = false;
    const state = makeState(0);
    installRuntime(
      state,
      vi.fn((action: string) => {
        if (action === 'cyclevis') state.vis = (state.vis + 1) % 3;
      })
    );

    const dialog = await openSheet(
      <ProfileSettingsSheet viewer="owner" visibility="prive" />
    );
    const group = within(dialog).getByRole('group', { name: 'Visibilité du compte' });
    fireEvent.click(within(group).getByRole('button', { name: 'Public' }));

    await waitFor(() =>
      expect(within(dialog).getByTestId('settings-visibility-state').textContent).toContain(
        'Communauté'
      )
    );
    expect(within(dialog).getAllByText(/cycle hérité/).length).toBeGreaterThan(0);
  });

  it('désactive les actions indisponibles avec une raison honnête', async () => {
    const dialog = await openSheet();

    expect(within(dialog).getByText(/Runtime du compte indisponible/)).toBeTruthy();
    for (const name of [
      'Public',
      'Privé',
      'Exporter mes données (JSON)',
      'Se déconnecter',
    ]) {
      expect(within(dialog).getByRole('button', { name }).hasAttribute('disabled')).toBe(true);
    }
    const terrain = within(dialog).getByLabelText('Terrain principal') as HTMLSelectElement;
    expect(terrain.disabled).toBe(true);
  });

  it('branche chaque action sur le runtime réel', async () => {
    const state = makeState(2);
    const act = installRuntime(state);

    const dialog = await openSheet();

    fireEvent.change(within(dialog).getByLabelText('Terrain principal'), {
      target: { value: 'sentier' },
    });
    expect(act).toHaveBeenCalledWith('orient', 'terrain:sentier');

    fireEvent.change(within(dialog).getByLabelText('Nationalité'), {
      target: { value: 'Italie' },
    });
    expect(act).toHaveBeenCalledWith('nat', 'Italie');

    fireEvent.change(within(dialog).getByLabelText('Devise d’affichage'), {
      target: { value: 'CHF (CHF)' },
    });
    expect(act).toHaveBeenCalledWith('curr', 'CHF (CHF)');

    const city = within(dialog).getByLabelText('Ville de départ habituelle');
    fireEvent.change(city, { target: { value: 'Annecy' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Enregistrer la ville' }));
    expect(act).toHaveBeenCalledWith('home', 'Annecy');

    fireEvent.click(within(dialog).getByRole('button', { name: 'Exporter mes données (JSON)' }));
    expect(act).toHaveBeenCalledWith('export', 'full');

    fireEvent.click(within(dialog).getByRole('button', { name: 'Se déconnecter' }));
    expect(act).toHaveBeenCalledWith('signout');
  });
});
