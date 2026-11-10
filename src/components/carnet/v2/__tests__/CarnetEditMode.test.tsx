// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { CarnetScreenV2 } from '../CarnetScreenV2';
import { buildEcrinsDetail } from '@/features/carnet/detail/fixtures/ecrinsDetail';

const actions = vi.hoisted(() => ({
  saveStepAction: vi.fn(),
  deleteStepAction: vi.fn(),
  saveNightAction: vi.fn(),
  deleteNightAction: vi.fn(),
  saveVerdictAction: vi.fn(),
  addTravelerAction: vi.fn(),
  updateTravelerAction: vi.fn(),
  removeTravelerAction: vi.fn(),
  updateMomentAction: vi.fn(),
  deleteMomentAction: vi.fn(),
  updateCarnetSettingsAction: vi.fn(),
  deleteCarnetAction: vi.fn(),
}));
vi.mock('@/features/carnet/detail/editActions', () => actions);

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), back: vi.fn() }) }));
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u-camille', email: 'camille@lkdv.fr', user_metadata: { full_name: 'Camille' } } }),
}));
vi.mock('@/contexts/ToastContext', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@/hooks/useOnlineStatus', () => ({ useOnlineStatus: () => ({ isOnline: true }) }));
vi.mock('@/lib/supabase/client', () => {
  const chain = (): unknown => {
    const proxy: unknown = new Proxy(
      {},
      {
        get(_t, prop: string) {
          if (prop === 'then') return (resolve: (v: unknown) => unknown) => resolve({ data: [], error: null });
          if (prop === 'single' || prop === 'maybeSingle') {
            return () => Promise.resolve({ data: { id: 'x' }, error: null });
          }
          return () => proxy;
        },
      }
    );
    return proxy;
  };
  return {
    createClient: () => ({
      from: () => chain(),
      channel: () => ({ on: () => ({ subscribe: () => ({}) }), subscribe: () => ({}) }),
      removeChannel: () => ({}),
      storage: { from: () => ({ upload: async () => ({ error: null }), getPublicUrl: () => ({ data: { publicUrl: 'x' } }) }) },
    }),
  };
});
vi.mock('@/components/compte/map/CompteMap', () => ({ CompteMap: () => <div data-testid="compte-map-mock" /> }));
vi.mock('@/components/carnet/profile/CarnetPostSheet', () => ({ CarnetPostSheet: () => <div /> }));
vi.mock('@/components/communaute/StoriesViewer', () => ({
  default: (props: {
    users: Array<{ id: string; name: string; slides: Array<{ storyId?: string }> }>;
    onAuthor?: (user: { id: string; name: string }) => void;
    onReport?: (user: unknown, slide: { storyId?: string }) => void;
    onToggleLike?: (slide: { storyId?: string }, wasLiked: boolean) => void;
    likedStoryIds?: ReadonlySet<string>;
  }) => (
    <div
      data-testid="stories-mock"
      data-groups={props.users.length}
      data-liked={String(Boolean(props.likedStoryIds?.has(props.users[0].slides[0].storyId ?? '')))}
    >
      <button type="button" onClick={() => props.onToggleLike?.(props.users[0].slides[0], false)}>
        aimer
      </button>
      <button type="button" onClick={() => props.onAuthor?.(props.users[0])}>
        pilule auteur
      </button>
      <button type="button" onClick={() => props.onReport?.(props.users[0], props.users[0].slides[0])}>
        signaler
      </button>
    </div>
  ),
}));

const ETAPE_ID = '0b1c9c0e-3c1d-4f6a-9a2e-0d4c1b7e8f01';

beforeEach(() => {
  Object.values(actions).forEach((fn) => fn.mockReset());
  window.localStorage.clear();
  window.history.pushState({}, '', '/');
});
afterEach(() => cleanup());

/** Mode modification et tiroir ouverts par l'URL (`?modifier=1&tiroir=…`), comme un lien profond. */
function renderEditing(slot: 'fil' | 'route' | 'sac' | 'equipage', extra = '', detail = buildEcrinsDetail()) {
  window.history.pushState({}, '', `/?modifier=1&tiroir=${slot}${extra}`);
  render(<CarnetScreenV2 detail={detail} />);
  return screen.getByRole('dialog', { name: /Tiroir de détails/ });
}

function openDrawerSlot(slot: string) {
  fireEvent.click(screen.getByRole('button', { name: 'Ouvrir le carnet' }));
  const drawer = screen.getByRole('dialog', { name: /Tiroir de détails/ });
  if (slot !== 'Fil de bord') fireEvent.click(within(drawer).getByRole('tab', { name: slot }));
  return drawer;
}

describe('mode modification : pilules et « + Ajouter » en place', () => {
  it('hors mode modification, aucune pilule « Modifier » ni « + Ajouter une étape »', () => {
    render(<CarnetScreenV2 detail={buildEcrinsDetail()} />);
    const drawer = openDrawerSlot('Route');
    expect(within(drawer).queryByRole('button', { name: 'Ajouter une étape' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Modifier le moment' })).toBeNull();
  });

  it('visiteur : jamais de mode modification', () => {
    render(<CarnetScreenV2 detail={buildEcrinsDetail({ role: 'visitor' })} />);
    expect(screen.queryByRole('menuitemcheckbox', { name: /Modifier le carnet/ })).toBeNull();
    const drawer = openDrawerSlot('Route');
    expect(within(drawer).queryByRole('button', { name: 'Ajouter une étape' })).toBeNull();
  });

  it('chaque carte du Fil porte sa pilule « Modifier le moment »', () => {
    const drawer = renderEditing('fil', '&jour=1');
    const cards = drawer.querySelectorAll('.lkdv-tl .lkdv-mo');
    expect(cards.length).toBeGreaterThan(0);
    expect(within(drawer).getAllByRole('button', { name: 'Modifier le moment' })).toHaveLength(cards.length);
  });
});

describe('ajout et édition d’une étape (Server Action zod)', () => {
  it('« + Ajouter une étape » écrit par saveStepAction et affiche l’étape', async () => {
    actions.saveStepAction.mockResolvedValue({
      ok: true,
      etape: {
        id: ETAPE_ID,
        dayNumber: 5,
        label: 'JOUR 5',
        from: 'La Bérarde',
        to: 'Col du Says',
        note: null,
        distanceKm: 9.5,
        elevationM: 600,
        durationText: '4 h',
        weather: null,
        overnight: null,
      },
    });
    const drawer = renderEditing('route');
    fireEvent.click(within(drawer).getByRole('button', { name: 'Ajouter une étape' }));

    const sheet = await screen.findByRole('dialog', { name: /Ajouter une étape/ });
    fireEvent.change(within(sheet).getByLabelText('Départ'), { target: { value: 'La Bérarde' } });
    fireEvent.change(within(sheet).getByLabelText('Arrivée'), { target: { value: 'Col du Says' } });
    fireEvent.change(within(sheet).getByLabelText('Distance (km)'), { target: { value: '9,5' } });
    await act(async () => {
      fireEvent.click(within(sheet).getByTestId('edit-save'));
    });

    expect(actions.saveStepAction).toHaveBeenCalledTimes(1);
    expect(actions.saveStepAction.mock.calls[0][0]).toMatchObject({
      carnetId: 'carnet-ecrins-fixture',
      from: 'La Bérarde',
      to: 'Col du Says',
      distanceKm: '9,5',
    });
    await waitFor(() => expect(screen.getByTestId('carnet-island').textContent).toContain('Étape ajoutée'));
    expect(screen.queryByRole('dialog', { name: /Ajouter une étape/ })).toBeNull();
  });

  it('affiche le refus de la base sans fermer la feuille', async () => {
    actions.saveStepAction.mockResolvedValue({ ok: false, error: 'Tu n’as pas le droit de modifier ce carnet.' });
    const drawer = renderEditing('route');
    fireEvent.click(within(drawer).getByRole('button', { name: 'Ajouter une étape' }));
    const sheet = await screen.findByRole('dialog', { name: /Ajouter une étape/ });
    fireEvent.change(within(sheet).getByLabelText('Départ'), { target: { value: 'A' } });
    fireEvent.change(within(sheet).getByLabelText('Arrivée'), { target: { value: 'B' } });
    await act(async () => {
      fireEvent.click(within(sheet).getByTestId('edit-save'));
    });
    expect(within(sheet).getByRole('alert').textContent).toContain('pas le droit');
    expect(screen.getByRole('dialog', { name: /Ajouter une étape/ })).toBeTruthy();
  });

  it('fiche étape : pilule Modifier, suppression confirmée en place', async () => {
    actions.deleteStepAction.mockResolvedValue({ ok: true });
    const detail = buildEcrinsDetail();
    const drawer = renderEditing('route', '', detail);
    const first = detail.etapes[0];
    fireEvent.click(within(drawer).getAllByRole('button', { name: new RegExp(first.to ?? first.label) })[0]);
    const fiche = screen.getByRole('dialog', { name: 'Détail du carnet' });
    fireEvent.click(within(fiche).getByRole('button', { name: 'Modifier l’étape' }));
    const sheet = await screen.findByRole('dialog', { name: 'Modifier l’étape' });
    fireEvent.click(within(sheet).getByTestId('edit-delete'));
    expect(within(sheet).getByText(/^Supprimer \?/)).toBeTruthy();
    expect(actions.deleteStepAction).not.toHaveBeenCalled();
    await act(async () => {
      fireEvent.click(within(sheet).getByTestId('edit-delete-confirm'));
    });
    expect(actions.deleteStepAction).toHaveBeenCalledWith({ carnetId: 'carnet-ecrins-fixture', id: first.id });
  });
});

describe('nuit, verdict, voyageur', () => {
  it('nuit : « + Ajouter une nuit » envoie le type choisi', async () => {
    actions.saveNightAction.mockResolvedValue({
      ok: true,
      night: { id: 'n9', dayNumber: 4, name: 'Chalet', type: 'gite', altitudeM: null, infos: null, lat: null, lng: null, mapRefugeId: null },
    });
    const drawer = renderEditing('route');
    fireEvent.click(within(drawer).getByRole('tab', { name: 'Nuit' }));
    fireEvent.click(within(drawer).getByRole('button', { name: 'Ajouter une nuit' }));
    const sheet = await screen.findByRole('dialog', { name: 'Ajouter une nuit' });
    fireEvent.change(within(sheet).getByLabelText('Nom'), { target: { value: 'Chalet' } });
    fireEvent.change(within(sheet).getByLabelText('Type'), { target: { value: 'gite' } });
    await act(async () => {
      fireEvent.click(within(sheet).getByTestId('edit-save'));
    });
    expect(actions.saveNightAction.mock.calls[0][0]).toMatchObject({ name: 'Chalet', type: 'gite' });
  });

  it('verdict : choisit l’objet, le verdict et enregistre', async () => {
    actions.saveVerdictAction.mockResolvedValue({
      ok: true,
      verdict: { itemId: 'x', verdict: 'utile', verdictNote: null, joursUtilises: [] },
    });
    const drawer = renderEditing('sac');
    fireEvent.click(within(drawer).getByRole('tab', { name: 'Verdicts' }));
    fireEvent.click(within(drawer).getByRole('button', { name: 'Ajouter un verdict' }));
    const sheet = await screen.findByRole('dialog', { name: 'Ajouter un verdict' });
    fireEvent.click(within(sheet).getByRole('button', { name: 'Utile' }));
    await act(async () => {
      fireEvent.click(within(sheet).getByTestId('edit-save'));
    });
    expect(actions.saveVerdictAction.mock.calls[0][0]).toMatchObject({ verdict: 'utile' });
  });

  it('voyageur : « Inviter un voyageur » envoie le pseudo et le rôle', async () => {
    actions.addTravelerAction.mockResolvedValue({
      ok: true,
      participant: { userId: 'u-new', name: 'Marie', handle: 'marie', avatarUrl: null, role: 'collaborator' },
    });
    const drawer = renderEditing('equipage');
    fireEvent.click(within(drawer).getByRole('button', { name: 'Inviter un voyageur' }));
    const sheet = await screen.findByRole('dialog', { name: 'Inviter un voyageur' });
    fireEvent.change(within(sheet).getByLabelText('Pseudo'), { target: { value: '@marie' } });
    await act(async () => {
      fireEvent.click(within(sheet).getByTestId('edit-save'));
    });
    expect(actions.addTravelerAction).toHaveBeenCalledWith({ handle: '@marie', role: 'contributor', carnetId: 'carnet-ecrins-fixture' });
    await waitFor(() => expect(screen.getByTestId('carnet-island').textContent).toContain('Voyageur ajouté'));
  });
});

describe('tiroir « Carnet » (curseurs)', () => {
  const openAccount = () => {
    fireEvent.click(screen.getByRole('button', { name: /Carnet : notifications, partage, paramètres/ }));
    return screen.getByRole('dialog', { name: 'Paramètres du carnet' });
  };

  it('quatre onglets pour l’auteur, flèches ← → entre les onglets', () => {
    render(<CarnetScreenV2 detail={buildEcrinsDetail()} />);
    const dialog = openAccount();
    const tabs = within(dialog).getAllByRole('tab');
    expect(tabs.map((t) => t.textContent)).toEqual(['Notifications', 'Partage', 'Paramètres', 'Gérer']);
    expect(tabs[0].getAttribute('tabindex')).toBe('0');
    expect(tabs[1].getAttribute('tabindex')).toBe('-1');
    fireEvent.keyDown(tabs[0], { key: 'ArrowRight' });
    expect(within(dialog).getByRole('tab', { name: 'Partage' }).getAttribute('aria-selected')).toBe('true');
  });

  it('Partage : QR du lien du carnet, copier, vues et visibilité réelles', () => {
    render(<CarnetScreenV2 detail={buildEcrinsDetail()} />);
    const dialog = openAccount();
    fireEvent.click(within(dialog).getByRole('tab', { name: 'Partage' }));
    const qr = within(dialog).getByRole('img', { name: /QR code du lien/ });
    expect(qr.querySelector('svg path')?.getAttribute('d')?.startsWith('M')).toBe(true);
    expect(within(dialog).getByRole('button', { name: /Copier/ })).toBeTruthy();
    expect(within(dialog).getByText('Visibilité')).toBeTruthy();
  });

  it('Paramètres : l’interrupteur écrit par Server Action et reporte le réglage', async () => {
    actions.updateCarnetSettingsAction.mockResolvedValue({ ok: true, changes: { visibility: 'private' } });
    render(<CarnetScreenV2 detail={buildEcrinsDetail()} />);
    const dialog = openAccount();
    fireEvent.click(within(dialog).getByRole('tab', { name: 'Paramètres' }));
    const toggle = within(dialog).getByRole('switch', { name: 'Passer le carnet en privé' });
    await act(async () => {
      fireEvent.click(toggle);
    });
    expect(actions.updateCarnetSettingsAction).toHaveBeenCalledWith({ carnetId: 'carnet-ecrins-fixture', visibility: 'private' });
    await waitFor(() =>
      expect(within(dialog).getByRole('switch', { name: 'Passer le carnet en public' }).getAttribute('aria-checked')).toBe('false')
    );
  });

  it('Gérer : description limitée à 160, suppression en deux temps', async () => {
    actions.deleteCarnetAction.mockResolvedValue({ ok: true });
    render(<CarnetScreenV2 detail={buildEcrinsDetail()} />);
    const dialog = openAccount();
    fireEvent.click(within(dialog).getByRole('tab', { name: 'Gérer' }));
    const description = within(dialog).getByLabelText('Description') as HTMLTextAreaElement;
    expect(description.maxLength).toBe(160);
    fireEvent.click(within(dialog).getByRole('button', { name: /Supprimer le carnet/ }));
    expect(actions.deleteCarnetAction).not.toHaveBeenCalled();
    await act(async () => {
      fireEvent.click(within(dialog).getByTestId('delete-carnet-confirm'));
    });
    expect(actions.deleteCarnetAction).toHaveBeenCalledWith({ carnetId: 'carnet-ecrins-fixture' });
  });

  it('visiteur : ni Gérer, ni interrupteurs de confidentialité', () => {
    render(<CarnetScreenV2 detail={buildEcrinsDetail({ role: 'visitor' })} />);
    const dialog = openAccount();
    expect(within(dialog).queryByRole('tab', { name: 'Gérer' })).toBeNull();
    fireEvent.click(within(dialog).getByRole('tab', { name: 'Paramètres' }));
    expect(within(dialog).queryByRole('switch')).toBeNull();
  });
});

describe('stories des voyageurs (toucher la couverture)', () => {
  it('un groupe par voyageur ; la pilule auteur ouvre sa fiche dans l’Équipage', () => {
    const detail = buildEcrinsDetail();
    render(<CarnetScreenV2 detail={detail} />);
    fireEvent.click(screen.getByRole('button', { name: /Ouvrir les stories du carnet/ }));
    const stories = screen.getByTestId('stories-mock');
    expect(Number(stories.getAttribute('data-groups'))).toBeGreaterThan(0);
    fireEvent.click(within(stories).getByRole('button', { name: 'pilule auteur' }));
    expect(screen.queryByTestId('stories-mock')).toBeNull();
    const drawer = screen.getByRole('dialog', { name: 'Détail du carnet' });
    expect(within(drawer).getByRole('button', { name: 'Retour' })).toBeTruthy();
  });

  it('le j’aime d’une story est posé tout de suite (j’aime du moment)', async () => {
    render(<CarnetScreenV2 detail={buildEcrinsDetail()} />);
    fireEvent.click(screen.getByRole('button', { name: /Ouvrir les stories du carnet/ }));
    expect(screen.getByTestId('stories-mock').getAttribute('data-liked')).toBe('false');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'aimer' }));
    });
    expect(screen.getByTestId('stories-mock').getAttribute('data-liked')).toBe('true');
  });

  it('« Signaler » ferme les stories et ouvre le signalement du moment', () => {
    render(<CarnetScreenV2 detail={buildEcrinsDetail()} />);
    fireEvent.click(screen.getByRole('button', { name: /Ouvrir les stories du carnet/ }));
    fireEvent.click(screen.getByRole('button', { name: 'signaler' }));
    expect(screen.queryByTestId('stories-mock')).toBeNull();
  });
});
