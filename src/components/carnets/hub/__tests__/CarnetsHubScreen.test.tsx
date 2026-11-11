// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CarnetHubItem, CarnetsHubData } from '@/features/carnet/hub/types';
import { CarnetsHubScreen } from '../CarnetsHubScreen';

const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: router.push, refresh: router.refresh }),
}));

vi.mock('@/hooks/useHapticFeedback', () => ({
  useHapticFeedback: () => ({ haptic: vi.fn() }),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function item(overrides: Partial<CarnetHubItem> = {}): CarnetHubItem {
  return {
    id: 'c1',
    title: 'Tour des Écrins',
    destination: 'Écrins',
    coverImage: null,
    coverPhotos: [],
    routeTrace: null,
    countryIso: 'FR',
    startDate: '2026-07-13',
    endDate: '2026-07-16',
    phase: 'en_route',
    daysTotal: 4,
    dayCurrent: 2,
    distanceKm: 61.2,
    elevationGainM: 4120,
    nights: 3,
    travelers: [
      { id: 'u2', name: 'Camille Roux', initials: 'CR', avatarUrl: null },
      { id: 'u5', name: 'Sam Diallo', initials: 'SD', avatarUrl: null },
    ],
    travelersTotal: 3,
    author: { id: 'u2', name: 'Camille Roux', initials: 'CR', avatarUrl: null },
    likesCount: 5,
    commentsCount: 2,
    likedByMe: false,
    verifiedGps: true,
    liveSharing: true,
    isMine: false,
    isFollowed: true,
    ...overrides,
  };
}

function hubData(overrides: Partial<CarnetsHubData> = {}): CarnetsHubData {
  return {
    viewerId: 'u1',
    items: [item()],
    mineCount: 0,
    followedCount: 1,
    error: false,
    ...overrides,
  };
}

const rented = () =>
  item({
    id: 'c-done',
    title: 'Sentier des douaniers',
    phase: 'rentre',
    dayCurrent: null,
    startDate: '2026-06-01',
    endDate: '2026-06-06',
    isFollowed: false,
    liveSharing: false,
    countryIso: null,
  });

describe('CarnetsHubScreen (hub /carnets)', () => {
  it('ouvre sur « En route » quand un carnet est en cours, et « Monde » sinon', () => {
    render(<CarnetsHubScreen data={hubData({ items: [item(), rented()] })} />);
    expect(screen.getByRole('button', { name: 'En route' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getAllByTestId('lkdh-carnet')).toHaveLength(1);
    cleanup();

    render(<CarnetsHubScreen data={hubData({ items: [rented()] })} />);
    expect(screen.getByRole('button', { name: 'Monde' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getAllByTestId('lkdh-carnet')).toHaveLength(1);
  });

  it('filtre « Les miens » sans requête : seuls mes carnets restent', () => {
    const mine = item({ id: 'c-mine', title: 'Mon carnet', phase: 'rentre', dayCurrent: null, isMine: true });
    render(<CarnetsHubScreen data={hubData({ items: [rented(), mine] })} />);
    expect(screen.getAllByTestId('lkdh-carnet')).toHaveLength(2);

    fireEvent.click(screen.getByTestId('lkdh-filter-mine'));
    const cards = screen.getAllByTestId('lkdh-carnet');
    expect(cards).toHaveLength(1);
    expect(cards[0].getAttribute('data-id')).toBe('c-mine');
    expect(screen.getByTestId('lkdh-filter-mine').getAttribute('aria-pressed')).toBe('true');
  });

  it('affiche un état vide propre au filtre, avec le CTA de création', () => {
    render(<CarnetsHubScreen data={hubData({ items: [rented()] })} />);
    fireEvent.click(screen.getByTestId('lkdh-filter-mine'));

    const empty = screen.getByTestId('lkdh-empty');
    expect(empty.getAttribute('data-filter')).toBe('mine');
    expect(within(empty).getByRole('heading', { name: 'Votre premier carnet vous attend' })).toBeTruthy();
    expect(
      within(empty).getByRole('link', { name: 'Créer un carnet' }).getAttribute('href'),
    ).toBe('/communaute?creer=carnet');
    expect(screen.queryAllByTestId('lkdh-carnet')).toHaveLength(0);
  });

  it('appelle le j’aime avec l’état inversé et reflète l’état pressé', async () => {
    const onToggleLike = vi.fn().mockResolvedValue(undefined);
    render(<CarnetsHubScreen data={hubData()} onToggleLike={onToggleLike} />);

    const like = screen.getByRole('button', { name: 'J’aime : 5' });
    expect(like.closest('a')).toBeNull();
    fireEvent.click(like);

    expect(onToggleLike).toHaveBeenCalledTimes(1);
    expect(onToggleLike).toHaveBeenCalledWith('c1', true);
    const pressed = await screen.findByRole('button', { name: 'Retirer mon j’aime : 6' });
    expect(pressed.getAttribute('aria-pressed')).toBe('true');
  });

  it('retire le j’aime d’un carnet déjà aimé', async () => {
    const onToggleLike = vi.fn().mockResolvedValue(undefined);
    render(
      <CarnetsHubScreen
        data={hubData({ items: [item({ likedByMe: true, likesCount: 6 })] })}
        onToggleLike={onToggleLike}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Retirer mon j’aime : 6' }));
    expect(onToggleLike).toHaveBeenCalledWith('c1', false);
    expect(await screen.findByRole('button', { name: 'J’aime : 5' })).toBeTruthy();
  });

  it('la carte est un lien vers /carnets/{id} avec un libellé complet', () => {
    render(<CarnetsHubScreen data={hubData()} />);
    const link = screen.getByTestId('lkdh-carnet-link');
    expect(link.getAttribute('href')).toBe('/carnets/c1');
    const label = link.getAttribute('aria-label') ?? '';
    expect(label).toContain('Tour des Écrins');
    expect(label).toContain('Écrins');
    expect(label).toContain('en route, jour 2');
    expect(label).toContain('par Camille Roux');
    expect(label).toContain('trace GPS vérifiée');
    expect(screen.getByRole('link', { name: 'Commentaires : 2' }).getAttribute('href')).toBe(
      '/carnets/c1?commentaires=1',
    );
  });

  it('la bande « En route maintenant » n’apparaît qu’avec des carnets en route', () => {
    const { rerender } = render(<CarnetsHubScreen data={hubData({ items: [rented()] })} />);
    expect(screen.queryByTestId('lkdh-live-band')).toBeNull();

    rerender(<CarnetsHubScreen data={hubData()} />);
    const band = screen.getByTestId('lkdh-live-band');
    expect(band.getAttribute('aria-label')).toBe('En route maintenant');
    expect(within(band).getAllByTestId('lkdh-live-mini')).toHaveLength(1);
    expect(within(band).getByRole('link').getAttribute('href')).toBe('/carnets/c1');
    expect(within(band).getByText('En route · J2 sur 4')).toBeTruthy();
  });

  it('sans session, le j’aime mène à la connexion et n’écrit rien', () => {
    const onToggleLike = vi.fn().mockResolvedValue(undefined);
    render(<CarnetsHubScreen data={hubData({ viewerId: null })} onToggleLike={onToggleLike} />);

    fireEvent.click(screen.getByRole('button', { name: 'J’aime : 5' }));
    expect(onToggleLike).not.toHaveBeenCalled();
    expect(router.push).toHaveBeenCalledWith('/connexion?next=/carnets');
  });

  it('en erreur, propose « Réessayer » (router.refresh)', () => {
    render(<CarnetsHubScreen data={hubData({ items: [], error: true })} />);
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Les carnets n’ont pas pu être chargés' })).toBeTruthy();
    expect(screen.queryAllByTestId('lkdh-carnet')).toHaveLength(0);

    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }));
    expect(router.refresh).toHaveBeenCalledTimes(1);
  });
});
