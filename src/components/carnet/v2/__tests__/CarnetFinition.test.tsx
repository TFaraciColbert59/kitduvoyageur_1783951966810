// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { CarnetScreenV2 } from '../CarnetScreenV2';
import { CarnetPostGrid, TILE_LONG_PRESS_MS } from '../CarnetPostGrid';
import { buildEcrinsDetail } from '@/features/carnet/detail/fixtures/ecrinsDetail';

const mapProps: Array<Record<string, unknown>> = [];
let online = true;
const inserted: Array<Record<string, unknown>> = [];

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), back: vi.fn() }) }));
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u-camille', email: 'camille@lkdv.fr', user_metadata: { full_name: 'Camille' } } }),
}));
vi.mock('@/contexts/ToastContext', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@/hooks/useOnlineStatus', () => ({ useOnlineStatus: () => ({ isOnline: online }) }));
vi.mock('@/features/carnet/detail/editActions', () => ({
  deleteMomentAction: async () => ({ ok: true }),
}));
vi.mock('@/lib/supabase/client', () => {
  const chain = (): unknown => {
    const target: Record<string, unknown> = {};
    const proxy: unknown = new Proxy(target, {
      get(_t, prop: string) {
        if (prop === 'then') return (resolve: (v: unknown) => unknown) => resolve({ data: [], error: null });
        if (prop === 'single' || prop === 'maybeSingle') {
          return () => Promise.resolve({ data: { id: 'new-moment' }, error: null });
        }
        if (prop === 'insert') {
          return (row: Record<string, unknown>) => {
            inserted.push(row);
            return proxy;
          };
        }
        return () => proxy;
      },
    });
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
vi.mock('@/components/compte/map/CompteMap', () => ({
  CompteMap: (props: Record<string, unknown>) => {
    mapProps.push(props);
    return <div data-testid="compte-map-mock" />;
  },
}));
vi.mock('@/components/carnet/profile/CarnetPostSheet', () => ({
  CarnetPostSheet: ({ index, detail }: { index: number; detail: { photoMoments: Array<{ id: string }> } }) => (
    <div data-testid="post-sheet-mock" data-moment={detail.photoMoments[index]?.id} />
  ),
}));
vi.mock('@/components/communaute/StoriesViewer', () => ({ default: () => <div /> }));

if (typeof window !== 'undefined' && !('PointerEvent' in window)) {
  class PointerEventPolyfill extends MouseEvent {
    pointerId: number;
    pointerType: string;
    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init);
      this.pointerId = init.pointerId ?? 1;
      this.pointerType = init.pointerType ?? 'mouse';
    }
  }
  (window as unknown as { PointerEvent: typeof PointerEventPolyfill }).PointerEvent = PointerEventPolyfill;
}

const momentRows = () => inserted.filter((row) => 'moment_type' in row);
const lastMap = () => mapProps[mapProps.length - 1];

beforeEach(() => {
  mapProps.length = 0;
  inserted.length = 0;
  online = true;
  window.localStorage.clear();
});
afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

describe('tuiles : pastilles de type complètes', () => {
  it('chaque type porte sa pastille, son heure et son aplat', () => {
    const detail = buildEcrinsDetail();
    const types = new Set<string>();
    const { container } = render(<CarnetPostGrid moments={detail.moments} onSelect={vi.fn()} />);
    container.querySelectorAll('.lkdv-ig-tile[data-type]').forEach((tile) => {
      types.add(tile.getAttribute('data-type') as string);
      expect(tile.querySelector('.lkdv-ig-tile-type')).not.toBeNull();
      expect(tile.querySelector('.lkdv-ig-tile-h')?.textContent).toMatch(/^\d{2}:\d{2}$/);
    });
    expect([...types].sort()).toEqual(
      ['inc', 'kit', 'meet', 'photo', 'spend', 'species', 'text', 'video', 'voice'].sort()
    );
    expect(container.querySelector('.c-spend big')?.textContent).toContain('€');
    expect(container.querySelector('.c-voice .wv i')).not.toBeNull();
  });

  it('épingle : coche et libellé « épinglé »', () => {
    const detail = buildEcrinsDetail();
    render(<CarnetPostGrid moments={detail.moments.slice(0, 2)} onSelect={vi.fn()} pinnedIds={new Set(['m01'])} />);
    expect(screen.getByRole('button', { name: /épinglé/ })).toBeTruthy();
  });

  it('appui long 460 ms : aperçu, sans ouvrir le post au relâchement', () => {
    vi.useFakeTimers();
    const onPeek = vi.fn();
    const onSelect = vi.fn();
    const detail = buildEcrinsDetail();
    render(<CarnetPostGrid moments={detail.moments.slice(0, 1)} onSelect={onSelect} onPeek={onPeek} />);
    const tile = screen.getAllByRole('button')[0];
    fireEvent.pointerDown(tile, { clientX: 10, clientY: 10 });
    act(() => {
      vi.advanceTimersByTime(TILE_LONG_PRESS_MS - 20);
    });
    expect(onPeek).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(40);
    });
    expect(onPeek).toHaveBeenCalledTimes(1);
    fireEvent.pointerUp(tile);
    fireEvent.click(tile);
    expect(onSelect).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('un déplacement de plus de 8 px annule l’appui long (défilement)', () => {
    vi.useFakeTimers();
    const onPeek = vi.fn();
    const detail = buildEcrinsDetail();
    render(<CarnetPostGrid moments={detail.moments.slice(0, 1)} onSelect={vi.fn()} onPeek={onPeek} />);
    const tile = screen.getAllByRole('button')[0];
    fireEvent.pointerDown(tile, { clientX: 10, clientY: 10 });
    fireEvent.pointerMove(tile, { clientX: 10, clientY: 40 });
    act(() => {
      vi.advanceTimersByTime(600);
    });
    expect(onPeek).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('mode modification : tuile « + » en fin de grille', () => {
    const onAdd = vi.fn();
    render(<CarnetPostGrid moments={[]} onSelect={vi.fn()} isEditing onAddMoment={onAdd} />);
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter un moment' }));
    expect(onAdd).toHaveBeenCalledTimes(1);
  });
});

describe('un seul état de jour (fiche, tiroir, carte)', () => {
  it('la capsule change la fiche, la carte et le tiroir en même temps', async () => {
    render(<CarnetScreenV2 detail={buildEcrinsDetail()} />);
    expect(screen.getByTestId('carnet-v2-root').getAttribute('data-day')).toBe('0');

    fireEvent.click(screen.getByRole('tab', { name: 'Jour 2' }));
    await act(async () => {
      await new Promise((r) => setTimeout(r, 400));
    });

    expect(screen.getByTestId('carnet-v2-root').getAttribute('data-day')).toBe('2');
    expect(screen.getByRole('tab', { name: 'Jour 2' }).getAttribute('aria-selected')).toBe('true');
    expect(lastMap().activeDay).toBe(2);
    expect(Array.isArray(lastMap().dayTraces)).toBe(true);
    expect((lastMap().dayTraces as unknown[]).length).toBe(4);

    fireEvent.click(screen.getByRole('button', { name: 'Ouvrir le carnet' }));
    expect(lastMap().contextMode).toBe(true);
    const drawer = screen.getByRole('dialog', { name: /Tiroir de détails/ });
    expect(within(drawer).queryByText('La Bérarde · 1 738 m')).toBeNull();
    expect(within(drawer).getAllByText('Col de l’Eychauda').length).toBeGreaterThan(0);
  });

  it('toucher la trace d’un jour sur la carte change de jour', async () => {
    render(<CarnetScreenV2 detail={buildEcrinsDetail()} />);
    const onDayPick = lastMap().onDayPick as (day: number) => void;
    act(() => onDayPick(3));
    expect(screen.getByTestId('carnet-v2-root').getAttribute('data-day')).toBe('3');
    expect(lastMap().activeDay).toBe(3);
  });

  it('les flèches ← → changent de jour quand rien d’autre n’a la main', () => {
    render(<CarnetScreenV2 detail={buildEcrinsDetail()} />);
    fireEvent.keyDown(document.body, { key: 'ArrowRight' });
    fireEvent.keyDown(document.body, { key: 'ArrowRight' });
    expect(screen.getByTestId('carnet-v2-root').getAttribute('data-day')).toBe('2');
    fireEvent.keyDown(document.body, { key: 'ArrowLeft' });
    expect(screen.getByTestId('carnet-v2-root').getAttribute('data-day')).toBe('1');
  });
});

describe('mode contexte du tiroir : couches par slot', () => {
  it('Route › Nuit ne montre que les nuits ; la carte passe en mode contexte', () => {
    render(<CarnetScreenV2 detail={buildEcrinsDetail()} />);
    expect(lastMap().contextMode).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Ouvrir le carnet' }));
    const drawer = screen.getByRole('dialog', { name: /Tiroir de détails/ });
    fireEvent.click(within(drawer).getByRole('tab', { name: 'Route' }));
    fireEvent.click(within(drawer).getByRole('tab', { name: 'Nuit' }));
    const types = new Set((lastMap().markers as Array<{ type: string }>).map((m) => m.type));
    expect([...types]).toEqual(['night']);
    expect(lastMap().contextMode).toBe(true);
  });
});

describe('mode modification (participant)', () => {
  it('menu → Modifier le carnet → Terminer, tuile + et feuille Créer (9 types)', () => {
    render(<CarnetScreenV2 detail={buildEcrinsDetail()} />);
    fireEvent.click(screen.getByRole('button', { name: /Menu du carnet/ }));
    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: /Modifier le carnet/ }));

    expect(screen.getByTestId('end-edit').textContent).toContain('Terminer');
    fireEvent.click(screen.getByRole('tab', { name: 'Jour 1' }));

    fireEvent.click(screen.getByRole('button', { name: 'Ajouter un moment', hidden: false }));
    const catalog = screen.getByRole('group', { name: 'Type de moment' });
    expect(within(catalog).getAllByRole('button')).toHaveLength(9);
  });

  it('écrit un moment texte réel, l’affiche, et Ctrl+Z l’annule', async () => {
    render(<CarnetScreenV2 detail={buildEcrinsDetail()} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Jour 3' }));
    await act(async () => {
      await new Promise((r) => setTimeout(r, 400));
    });
    fireEvent.click(screen.getByRole('button', { name: /Ajouter un moment/ }));
    fireEvent.click(within(screen.getByRole('group', { name: 'Type de moment' })).getByRole('button', { name: 'Texte' }));
    fireEvent.change(screen.getByLabelText('Lieu'), { target: { value: 'Pont de la Pierre' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'Texte' }), { target: { value: 'Brume sur le pont.' } });
    await act(async () => {
      fireEvent.click(screen.getByTestId('create-submit'));
    });

    expect(momentRows()).toHaveLength(1);
    expect(momentRows()[0]).toMatchObject({
      carnet_id: 'carnet-ecrins-fixture',
      jour_numero: 3,
      citation: 'Brume sur le pont.',
      lieu: 'Pont de la Pierre',
      moment_type: 'text',
      auteur_id: 'u-camille',
      source: 'manuel',
    });
    expect(screen.getByTestId('carnet-island').textContent).toContain('Moment ajouté');
    expect(screen.getByTestId('carnet-island').textContent).toContain('Pont de la Pierre · J3');
    expect(screen.getByTestId('carnet-grid').textContent).toContain('Brume sur le pont.');

    await act(async () => {
      fireEvent.keyDown(document.body, { key: 'z', ctrlKey: true });
    });
    expect(screen.getByTestId('carnet-grid').textContent).not.toContain('Brume sur le pont.');
    expect(screen.getByTestId('carnet-island').textContent).toContain('Annulé');
  });

  it('refuse un lieu vide avec le message de la maquette, sans écrire', async () => {
    render(<CarnetScreenV2 detail={buildEcrinsDetail()} />);
    fireEvent.click(screen.getByRole('button', { name: /Ajouter un moment/ }));
    fireEvent.click(within(screen.getByRole('group', { name: 'Type de moment' })).getByRole('button', { name: 'Texte' }));
    fireEvent.change(screen.getByLabelText('Lieu'), { target: { value: '' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'Texte' }), { target: { value: 'x' } });
    await act(async () => {
      fireEvent.click(screen.getByTestId('create-submit'));
    });
    expect(screen.getByRole('alert', { name: '' }).textContent).toContain('Indique un lieu.');
    expect(momentRows()).toHaveLength(0);
  });

  it('hors ligne : écriture refusée, bandeau visible', async () => {
    online = false;
    render(<CarnetScreenV2 detail={buildEcrinsDetail()} />);
    expect(screen.getByTestId('carnet-offline')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Ajouter un moment/ }));
    fireEvent.click(within(screen.getByRole('group', { name: 'Type de moment' })).getByRole('button', { name: 'Texte' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Texte' }), { target: { value: 'x' } });
    fireEvent.change(screen.getByLabelText('Lieu'), { target: { value: 'Col' } });
    await act(async () => {
      fireEvent.click(screen.getByTestId('create-submit'));
    });
    expect(momentRows()).toHaveLength(0);
    expect(screen.getByText(/hors ligne/i, { selector: '.lkdv-carnet-create-msg' })).toBeTruthy();
  });
});

describe('visiteur', () => {
  const visitor = () => buildEcrinsDetail({ role: 'visitor' });

  it('pas de « + », pas de mode modification, menu visiteur complet', () => {
    render(<CarnetScreenV2 detail={visitor()} />);
    expect(screen.queryByRole('button', { name: 'Ajouter un moment' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Menu du carnet/ }));
    const menu = screen.getByRole('menu', { name: 'Options du carnet' });
    expect(within(menu).getAllByRole('menuitem').map((i) => i.textContent)).toEqual([
      'Suivre le carnet',
      'Partager…',
      'Copier le lien',
      'Signaler',
    ]);
    expect(within(menu).queryByRole('menuitemcheckbox')).toBeNull();
  });

  it('17 lentilles : le budget est absent ; participant : 18', () => {
    const count = (detail: ReturnType<typeof buildEcrinsDetail>) => {
      const { unmount } = render(<CarnetScreenV2 detail={detail} />);
      fireEvent.click(screen.getByRole('button', { name: 'Ouvrir le carnet' }));
      let total = 0;
      let budget = false;
      for (const slot of ['Fil de bord', 'Route', 'Sac', 'Chiffres', 'Équipage']) {
        const drawer = screen.getByRole('dialog', { name: /Tiroir de détails/ });
        fireEvent.click(within(drawer).getByRole('tab', { name: slot }));
        const lens = screen.getAllByRole('tab').filter((t) => t.closest('.lkdv-lens-tabs'));
        total += lens.length;
        budget ||= lens.some((t) => t.getAttribute('aria-label') === 'Budget');
      }
      unmount();
      return { total, budget };
    };
    expect(count(visitor())).toEqual({ total: 17, budget: false });
    expect(count(buildEcrinsDetail())).toEqual({ total: 18, budget: true });
  });

  it('la position affichée est la zone floue, jamais la position exacte', () => {
    const detail = {
      ...visitor(),
      livePosition: { lat: 44.9, lng: 6.3, recordedAt: '2026-07-16T10:00:00Z', userId: 'u-camille' },
    };
    render(<CarnetScreenV2 detail={detail} />);
    // Le hook ne rend jamais la position exacte à un visiteur : `livePosition` reste nul.
    expect(lastMap().livePosition).toBeNull();
  });
});

describe('sac : verdicts et pilule Reprendre', () => {
  const openSac = (detail = buildEcrinsDetail()) => {
    render(<CarnetScreenV2 detail={detail} />);
    fireEvent.click(screen.getByRole('button', { name: 'Ouvrir le carnet' }));
    const drawer = screen.getByRole('dialog', { name: /Tiroir de détails/ });
    fireEvent.click(within(drawer).getByRole('tab', { name: 'Sac' }));
    return drawer;
  };

  it('« Reprendre » n’existe que dans le Sac (toutes lentilles), jamais ailleurs', () => {
    const drawer = openSac();
    expect(screen.getByRole('button', { name: /Reprendre ce kit/ })).toBeTruthy();
    fireEvent.click(within(drawer).getByRole('tab', { name: 'Verdicts' }));
    expect(screen.getByRole('button', { name: /Reprendre ce kit/ })).toBeTruthy();
    fireEvent.click(within(drawer).getByRole('tab', { name: 'Route' }));
    expect(screen.queryByRole('button', { name: /Reprendre/ })).toBeNull();
  });

  it('filtres Essentiel / Utile / Jamais servi / Défaillant / Manquait avec compteurs', () => {
    const drawer = openSac();
    fireEvent.click(within(drawer).getByRole('tab', { name: 'Verdicts' }));
    const filter = (f: string) => drawer.querySelector(`[data-verdict-filter="${f}"]`) as HTMLElement;
    expect(filter('essentiel').textContent).toContain('4');
    fireEvent.click(filter('defaillant'));
    const pane = filter('essentiel').parentElement!.parentElement as HTMLElement;
    expect(within(pane).getAllByText('Tente 2 places').length).toBeGreaterThan(0);
    expect(within(pane).queryAllByText('Sac 45 L')).toHaveLength(0);
    fireEvent.click(filter('manquait'));
    expect(within(pane).getAllByText('Guêtres').length).toBeGreaterThan(0);
  });

  it('un verdict inconnu ne fait pas planter le tiroir', () => {
    const detail = buildEcrinsDetail();
    detail.kit.items[0] = { ...detail.kit.items[0], verdict: 'inconnu' as never };
    const drawer = openSac(detail);
    expect(() => fireEvent.click(within(drawer).getByRole('tab', { name: 'Verdicts' }))).not.toThrow();
    expect(within(drawer).getByText('inconnu')).toBeTruthy();
  });
});

describe('états d’erreur', () => {
  it('une lentille en échec propose « Réessayer » sans emporter les autres', () => {
    render(<CarnetScreenV2 detail={buildEcrinsDetail()} simulate={{ lens: 'fil:moments' }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Ouvrir le carnet' }));
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain('Ce volet n’a pas pu s’afficher.');
    fireEvent.click(within(alert).getByRole('button', { name: 'Réessayer' }));
    expect(screen.queryByText('Ce volet n’a pas pu s’afficher.')).toBeNull();
  });

  it('un slot en erreur affiche « Impossible de charger ce carnet. » et Réessayer', () => {
    render(<CarnetScreenV2 detail={buildEcrinsDetail()} simulate={{ slot: true }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Ouvrir le carnet' }));
    expect(screen.getByRole('alert').textContent).toContain('Impossible de charger ce carnet.');
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }));
    expect(screen.queryByText('Impossible de charger ce carnet.')).toBeNull();
  });
});

describe('À la une et pastille titre', () => {
  it('appui long (participant) ouvre l’édition ; un visiteur ne l’a pas', () => {
    vi.useFakeTimers();
    const { unmount } = render(<CarnetScreenV2 detail={buildEcrinsDetail()} />);
    const hl = document.querySelector('[data-highlight]') as HTMLElement;
    fireEvent.pointerDown(hl);
    act(() => {
      vi.advanceTimersByTime(520);
    });
    expect(screen.getByText('Modifier la sélection')).toBeTruthy();
    unmount();
    cleanup();

    render(<CarnetScreenV2 detail={buildEcrinsDetail({ role: 'visitor' })} />);
    const hl2 = document.querySelector('[data-highlight]') as HTMLElement;
    fireEvent.pointerDown(hl2);
    act(() => {
      vi.advanceTimersByTime(520);
    });
    expect(screen.queryByText('Modifier la sélection')).toBeNull();
    vi.useRealTimers();
  });
});
