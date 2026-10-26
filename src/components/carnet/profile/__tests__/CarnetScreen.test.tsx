// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CarnetScreen } from '../CarnetScreen';
import { detail } from './fixtures';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: null }),
}));

vi.mock('@/contexts/ToastContext', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    from: () => ({
      insert: async () => ({ error: null }),
      upsert: async () => ({ error: null }),
      delete: async () => ({ error: null }),
      select: async () => ({ data: [], error: null }),
    }),
  }),
}));

vi.mock('@/features/carnet/detail/useCarnetEngagement', () => ({
  useCarnetEngagement: () => ({
    liked: false,
    likes: 0,
    favorited: false,
    toggleLike: vi.fn(),
    toggleFavorite: vi.fn(),
    registerView: vi.fn(),
  }),
}));

vi.mock('@/features/carnet/detail/useCarnetComments', () => ({
  useCarnetComments: () => ({
    comments: [],
    loading: false,
    send: vi.fn(),
    remove: vi.fn(),
  }),
}));

vi.mock('@/components/account/AccountBottomBar', () => ({
  AccountBottomBar: () => <div data-testid="bottom-bar" />,
}));

vi.mock('@/features/community/feed/useAccountUnreadCount', () => ({
  useAccountUnreadCount: () => 0,
}));

/* MapLibre n'a pas sa place dans jsdom : la carte du bas est remplacée. */
vi.mock('../CarnetMapCard', () => ({
  CarnetMapCard: () => <div data-testid="map-card" />,
}));

afterEach(() => cleanup());

const DAYS = [
  {
    id: 'd1',
    dayNumber: 1,
    label: 'JOUR 1 · 26 sept.',
    from: 'Les Houches',
    to: 'Refuge de Bellachat',
    note: null,
    distanceKm: 12.4,
    elevationM: 1050,
    durationText: '5 h',
    weather: null,
    overnight: 'Refuge de Bellachat',
  },
];

const OWNER = detail({ isOwner: true, days: DAYS });

describe('CarnetScreen — statistiques et pages', () => {
  it('ouvre un seul drawer avec les cinq volets autorisés', () => {
    render(<CarnetScreen detail={OWNER} />);
    fireEvent.click(screen.getByRole('button', { name: 'JOURS 7' }));
    const labels = screen.getAllByRole('tab').map((tab) => tab.getAttribute('aria-label'));
    expect(labels).toEqual(['Statistiques', 'Commentaires', 'J’aime', 'Partage', 'Gérer']);
    expect(screen.getByRole('tab', { name: 'Statistiques' }).getAttribute('aria-selected')).toBe('true');
  });

  it('ouvre le sous-onglet Jours depuis la statistique JOURS', () => {
    render(<CarnetScreen detail={OWNER} />);
    fireEvent.click(screen.getByRole('button', { name: 'JOURS 7' }));
    expect(screen.getByRole('button', { name: 'Jours' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('tabpanel', { name: 'Jours' })).toBeTruthy();
    expect(screen.getByText('Nuit · Refuge de Bellachat')).toBeTruthy();
  });

  it('ouvre le sous-onglet Distance depuis la statistique DISTANCE', () => {
    render(<CarnetScreen detail={OWNER} />);
    fireEvent.click(screen.getByRole('button', { name: 'DISTANCE 106,4 km' }));
    expect(screen.getByRole('button', { name: 'Distance' }).getAttribute('aria-pressed')).toBe('true');
    const panel = screen.getByRole('tabpanel', { name: 'Distance' });
    expect(panel.querySelector('.ckp-stat-hero b')?.textContent).toBe('106,4 km');
  });

  it('ouvre le sous-onglet Dénivelé depuis la statistique DÉNIVELÉ', () => {
    render(<CarnetScreen detail={OWNER} />);
    fireEvent.click(screen.getByRole('button', { name: 'DÉNIVELÉ + 2 002 m' }));
    expect(screen.getByRole('button', { name: 'Dénivelé' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('tabpanel', { name: 'Dénivelé' })).toBeTruthy();
  });

  it('change de page sans passer par le drawer : la page active est gardée', () => {
    render(<CarnetScreen detail={OWNER} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Étapes' }));
    expect(screen.getByRole('tab', { name: 'Étapes' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByText('Les Houches → Refuge de Bellachat')).toBeTruthy();
    fireEvent.click(screen.getByRole('tab', { name: 'Matériel' }));
    expect(screen.getByText('Matériel non renseigné.')).toBeTruthy();
    fireEvent.click(screen.getByRole('tab', { name: 'Posts' }));
    expect(screen.getByRole('tab', { name: 'Posts' }).getAttribute('aria-selected')).toBe('true');
  });

  it('garde les quatre volets d’un visiteur, sans Gérer', () => {
    render(<CarnetScreen detail={detail({ days: DAYS })} />);
    fireEvent.click(screen.getByRole('button', { name: 'JOURS 7' }));
    expect(screen.getAllByRole('tab')).toHaveLength(4);
    expect(screen.queryByRole('tab', { name: 'Gérer' })).toBeNull();
  });
});

describe('CarnetScreen — fond identique à la page Compte', () => {
  it('ne peint aucune photo de fond : la toile du Compte reste seule', () => {
    render(<CarnetScreen detail={detail()} />);
    expect(document.querySelector('.ckp-screen-bg')).toBeNull();
    expect(document.querySelector('.ckp-screen')).toBeTruthy();
  });
});
