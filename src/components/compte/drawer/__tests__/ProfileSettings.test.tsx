// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProfileDrawerHost } from '../ProfileDrawerHost';
import { ProfileSettingsSheet } from '../ProfileSettingsSheet';
import { SlotShell } from '../SlotShell';

type RuntimeState = {
  vis: number;
  orient: Record<string, string>;
  traveller: Record<string, string>;
  sh: { k: string; det: string } | null;
  step: number;
};

type RuntimeWindow = Window & {
  __lkdvCompteAct?: (action: string, value?: unknown) => void;
  __lkdvGetState?: () => { S: RuntimeState };
  __lkdvOpenSlot?: (slotId: string) => void;
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
    sh: { k: 'step', det: 'large' },
    step: 0,
  };
}

function renderShell(viewer: 'owner' | 'visitor', onOpenSettings?: () => void) {
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

async function openSheet(
  ui: React.ReactElement = <ProfileSettingsSheet viewer="owner" visibility="public" />
) {
  const view = render(ui);
  fireEvent(window, new Event('lkdv:open-settings'));
  const dialog = await screen.findByRole('dialog', { name: 'Réglages du profil' });
  return { view, dialog };
}

beforeEach(() => {
  runtimeWindow().__lkdvOpenSlot = undefined;
});

afterEach(() => {
  cleanup();
  const win = runtimeWindow();
  delete win.__lkdvCompteAct;
  delete win.__lkdvGetState;
  delete win.__lkdvOpenSlot;
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
      'Visibilité de l’empreinte',
      'Confidentialité du compte',
      'Préférences de marche',
      'Identité voyageur',
      'Qui voit quoi ?',
      'Export RGPD',
      'Déconnexion',
    ]) {
      expect(within(dialog).getByRole('heading', { name: heading })).toBeTruthy();
    }

    expect(within(dialog).getByRole('table', { name: 'Qui voit quoi ?' })).toBeTruthy();

    const states = within(dialog).getByRole('list', {
      name: 'États de visibilité de l’empreinte',
    });
    for (const label of ['Privé', 'Communauté', 'Public']) {
      expect(within(states).getByText(label)).toBeTruthy();
    }
    expect(within(states).getByText('toi seul·e')).toBeTruthy();
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

  it('ouvre les réglages depuis ProfileDrawerHost', async () => {
    render(<ProfileDrawerHost viewer="owner" visibility="public" />);
    fireEvent.click(screen.getByRole('button', { name: 'Réglages du profil' }));
    expect(await screen.findByRole('dialog', { name: 'Réglages du profil' })).toBeTruthy();
  });

  it('lit l’état de l’empreinte dans S.vis, pas dans profile_visibility', async () => {
    const state = makeState(1);
    const act = installRuntime(state);
    const openSlot = vi.fn();
    runtimeWindow().__lkdvOpenSlot = openSlot;

    const { dialog } = await openSheet();
    const stateLine = within(dialog).getByTestId('settings-signature-state');
    expect(stateLine.textContent).toContain('Communauté');
    expect(stateLine.textContent).not.toContain('État runtime : Public');
    expect(act).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Gérer dans la Vitrine' }));
    expect(openSlot).toHaveBeenCalledWith('vitrine');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('désactive la confidentialité du compte avec une raison explicite', async () => {
    const state = makeState(2);
    const act = installRuntime(state);
    const { dialog } = await openSheet(
      <ProfileSettingsSheet viewer="owner" visibility="prive" />
    );

    const group = within(dialog).getByRole('group', { name: 'Confidentialité du compte' });
    const publicButton = within(group).getByRole('button', { name: 'Public' });
    const privateButton = within(group).getByRole('button', { name: 'Privé' });

    expect(publicButton.hasAttribute('disabled')).toBe(true);
    expect(privateButton.hasAttribute('disabled')).toBe(true);
    expect(privateButton.getAttribute('aria-pressed')).toBe('true');
    expect(within(dialog).getByText(/Profil actuel : Privé/)).toBeTruthy();
    expect(
      within(dialog).getByTestId('account-privacy-unavailable').textContent
    ).toMatch(/pas encore câblée/);
    expect(act).not.toHaveBeenCalled();
  });

  it('dérive la matrice de S.vis et garde la ligne compte séparée', async () => {
    const state = makeState(0);
    installRuntime(state);
    const { dialog } = await openSheet(
      <ProfileSettingsSheet viewer="owner" visibility="public" />
    );

    const table = within(dialog).getByRole('table', { name: 'Qui voit quoi ?' });
    const empreinteRow = within(table)
      .getByText('Empreinte (massifs ≥ 3)')
      .closest('tr');
    expect(empreinteRow).toBeTruthy();
    expect(
      within(empreinteRow as HTMLElement)
        .getAllByRole('img')
        .map((cell) => cell.getAttribute('aria-label'))
    ).toEqual(['Visible', 'Non visible', 'Non visible']);

    const accountRow = within(table).getByText('Accès au profil (compte)').closest('tr');
    expect(accountRow).toBeTruthy();
    expect(
      within(accountRow as HTMLElement)
        .getAllByRole('img')
        .map((cell) => cell.getAttribute('aria-label'))
    ).toEqual(['Visible', 'Visible', 'Visible']);
  });

  it('croise la confidentialité du compte et la visibilité de l’empreinte', async () => {
    const state = makeState(2);
    installRuntime(state);
    const { dialog } = await openSheet(
      <ProfileSettingsSheet viewer="owner" visibility="prive" />
    );

    const table = within(dialog).getByRole('table', { name: 'Qui voit quoi ?' });
    for (const label of ['Accès au profil (compte)', 'Empreinte (massifs ≥ 3)']) {
      const row = within(table).getByText(label).closest('tr') as HTMLElement;
      expect(
        within(row)
          .getAllByRole('img')
          .map((cell) => cell.getAttribute('aria-label'))
      ).toEqual(['Visible', 'Visible', 'Non visible']);
    }
  });

  it('branche chaque action sur le runtime réel', async () => {
    const state = makeState(2);
    const act = installRuntime(state);

    const { dialog } = await openSheet();

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

  it('rouvre la feuille et restaure la section et le statut après un remontage runtime', async () => {
    const state = makeState(2);
    const act = installRuntime(state);

    const first = render(<ProfileSettingsSheet viewer="owner" visibility="public" />);
    fireEvent(window, new Event('lkdv:open-settings'));
    let dialog = await screen.findByRole('dialog', { name: 'Réglages du profil' });

    fireEvent.focus(within(dialog).getByLabelText('Nationalité'));
    fireEvent.change(within(dialog).getByLabelText('Nationalité'), {
      target: { value: 'Italie' },
    });
    expect(act).toHaveBeenCalledWith('nat', 'Italie');
    expect(dialog.getAttribute('data-active-section')).toBe('identity');

    // `refresh(true)` du runtime remplace `#lkdv-slot-root` : React remonte le portail.
    first.unmount();
    render(<ProfileSettingsSheet viewer="owner" visibility="public" />);

    dialog = await screen.findByRole('dialog', { name: 'Réglages du profil' });
    expect(dialog.getAttribute('data-active-section')).toBe('identity');
    expect(within(dialog).getByRole('status').textContent).toContain(
      'Identité voyageur transmise'
    );
  });

  it('ferme la feuille avec Échap depuis le document', async () => {
    const state = makeState(2);
    installRuntime(state);
    await openSheet();

    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('désactive les actions indisponibles avec une raison honnête', async () => {
    const { dialog } = await openSheet();

    expect(within(dialog).getByText(/Runtime du compte indisponible/)).toBeTruthy();
    expect(within(dialog).getByTestId('settings-signature-state').textContent).toContain(
      'indisponible'
    );
    for (const name of [
      'Gérer dans la Vitrine',
      'Exporter mes données (JSON)',
      'Se déconnecter',
    ]) {
      expect(within(dialog).getByRole('button', { name }).hasAttribute('disabled')).toBe(true);
    }
    const terrain = within(dialog).getByLabelText('Terrain principal') as HTMLSelectElement;
    expect(terrain.disabled).toBe(true);
  });
});
