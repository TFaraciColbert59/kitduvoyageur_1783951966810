// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { CarnetScreenV2 } from '../CarnetScreenV2';
import { CarnetIsland } from '../CarnetIsland';
import { CarnetTopBarV2 } from '../CarnetTopBarV2';
import type { CarnetDetail } from '@/features/carnet/detail/types';

afterEach(() => {
  cleanup();
});

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    back: vi.fn(),
  }),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'user-123', email: 'test@lkdv.fr' },
  }),
}));

vi.mock('@/contexts/ToastContext', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

const mockQuery = () => {
  const chain: any = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    order: vi.fn(() => chain),
    insert: vi.fn(() => Promise.resolve({ error: null })),
    delete: vi.fn(() => chain),
    then: (resolve: any) => resolve({ data: [], error: null }),
  };
  return chain;
};

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    from: vi.fn(() => mockQuery()),
    channel: () => ({
      on: () => ({ subscribe: () => ({}) }),
      subscribe: () => ({}),
      unsubscribe: () => ({}),
    }),
    removeChannel: () => ({}),
  }),
}));

vi.mock('@/components/compte/map/CompteMap', () => ({
  CompteMap: () => <div data-testid="compte-map-mock">Map</div>,
}));

vi.mock('@/components/carnet/profile/CarnetPostSheet', () => ({
  CarnetPostSheet: () => <div data-testid="post-sheet-mock">PostSheet</div>,
}));

vi.mock('@/components/communaute/StoriesViewer', () => ({
  default: () => <div data-testid="stories-viewer-mock">StoriesViewer</div>,
}));

const mockDetail: CarnetDetail = {
  id: 'carnet-ecrins',
  title: 'Tour des Écrins',
  destination: 'Hautes-Alpes',
  description: 'Un trek sauvage et glaciaire autour de la Meije.',
  coverImage: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b',
  coverImageAlt: 'Massif des Écrins',
  startDate: '2026-07-10',
  endDate: '2026-07-14',
  dateRange: '10 — 14 juil. 2026',
  visibility: 'public',
  isPublic: true,
  verified: true,
  isOwner: true,
  author: {
    id: 'user-123',
    name: 'Tony F.',
    handle: 'tony_alps',
    avatarUrl: null,
    trustScore: 98,
  },
  participants: [
    {
      userId: 'user-123',
      name: 'Tony F.',
      handle: 'tony_alps',
      avatarUrl: null,
      role: 'author',
    },
    {
      userId: 'user-456',
      name: 'Camille R.',
      handle: 'camille_trail',
      avatarUrl: null,
      role: 'participant',
    },
  ],
  stats: [
    { key: 'distance', label: 'DISTANCE', value: '84 km' },
    { key: 'elevation', label: 'DÉNIVELÉ +', value: '5400 m' },
    { key: 'days', label: 'JOURS', value: '4' },
  ],
  engagement: {
    likes: 42,
    comments: 12,
    views: 310,
    liked: false,
    favorited: false,
  },
  likers: [],
  moments: [
    {
      id: 'm-1',
      dayNumber: 1,
      time: '14:20',
      caption: 'Col de la Muzelle franchi !',
      authorName: 'Tony F.',
      place: 'Col de la Muzelle',
      imageUrl: 'https://example.com/muzelle.jpg',
    },
  ],
  photoMoments: [
    {
      id: 'm-1',
      dayNumber: 1,
      time: '14:20',
      caption: 'Col de la Muzelle franchi !',
      authorName: 'Tony F.',
      place: 'Col de la Muzelle',
      imageUrl: 'https://example.com/muzelle.jpg',
    },
  ],
  days: [
    {
      index: 1,
      date: '2026-07-10',
      distanceKm: 18.5,
      elevationM: 1450,
      durationS: 21600,
      moments: [],
      points: [],
    },
  ],
  etapes: [
    {
      id: 'step-1',
      dayNumber: 1,
      label: 'JOUR 1 · Bourg d’Oisans → La Muzelle',
      from: 'Bourg d’Oisans',
      to: 'Refuge de la Muzelle',
      note: 'Montée rude mais magnifique sous les cascades.',
      distanceKm: 18.5,
      elevationM: 1450,
      durationText: '6h',
      weather: 'Ensoleillé · 22 °C',
      overnight: 'Refuge de la Muzelle',
    },
  ],
  summary: {
    distanceKm: 84,
    elevationM: 5400,
    days: 4,
    moments: 1,
  },
  kit: {
    totalWeightG: 7800,
    items: [
      {
        id: 'k-1',
        name: 'Tente Hubba Hubba',
        detail: 'Abri 2 places',
        weightG: 1400,
        color: null,
        verdict: 'top',
        verdictNote: 'Excellente tenue au vent au bivouac',
        joursUtilises: [1, 2, 3],
      },
    ],
  },
  trace: null,
  place: {
    country: 'France',
    region: 'Auvergne-Rhône-Alpes',
    locality: 'Massif des Écrins',
    lat: 44.95,
    lng: 6.25,
  },
  distanceKm: 84,
  elevationM: 5400,
  viewerRole: 'participant',
  nights: [
    {
      id: 'night-1',
      dayNumber: 1,
      name: 'Refuge de la Muzelle',
      type: 'refuge',
      altitudeM: 2130,
      infos: 'Accueil très chaleureux',
      lat: 44.95,
      lng: 6.25,
      mapRefugeId: null,
    },
  ],
  dayReactions: {
    1: { dayNumber: 1, likesCount: 15, commentsCount: 3, userLiked: false },
  },
  momentEngagement: {},
  kitVerdicts: {},
  livePosition: null,
  publicZone: null,
  budget: {
    total: 320,
    totalCents: 32000,
    currency: 'EUR',
    perPersonCents: 16000,
    items: [
      { id: 'b-1', label: 'Refuge Muzelle', amount: 120, currency: 'EUR' },
    ],
  },
  liveSharing: true,
};

describe('CarnetScreenV2 Component', () => {
  it('affiche le titre du carnet, le cadre de présentation et la carte', () => {
    render(<CarnetScreenV2 detail={mockDetail} />);

    expect(screen.getByTestId('carnet-v2-root')).toBeTruthy();
    expect(screen.getAllByText('Tour des Écrins').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByTestId('compte-map-mock')).toBeTruthy();
  });

  it('affiche les 3 boutons de statistiques (jours, km, D+)', () => {
    render(<CarnetScreenV2 detail={mockDetail} />);

    expect(screen.getByText(/^jours?$/)).toBeTruthy();
    expect(screen.getByText('km')).toBeTruthy();
    expect(screen.getByText('D+ m')).toBeTruthy();
  });

  it('affiche la pilule de titre et permet d’ouvrir le menu déroulant', () => {
    render(<CarnetScreenV2 detail={mockDetail} />);

    const titlePill = screen.getByRole('button', { name: /Menu du carnet Tour des Écrins/i });
    expect(titlePill).toBeTruthy();

    fireEvent.click(titlePill);
    expect(screen.getByRole('menu', { name: /Options du carnet/i })).toBeTruthy();
    expect(screen.getByText('Modifier le carnet')).toBeTruthy();
    expect(screen.getByText('Partager')).toBeTruthy();
  });

  it('bascule en mode plein soleil depuis le popover Affichage', () => {
    render(<CarnetScreenV2 detail={mockDetail} />);

    fireEvent.click(screen.getByRole('button', { name: 'Affichage' }));
    fireEvent.click(screen.getByRole('switch', { name: 'Plein soleil' }));

    const root = screen.getByTestId('carnet-v2-root');
    expect(root.classList.contains('outdoor')).toBe(true);
  });

  it('ne monte que trois boutons ronds dans la barre haute (loi 7)', () => {
    render(<CarnetScreenV2 detail={mockDetail} />);

    expect(document.querySelectorAll('.lkdv-carnet-topbar .lkdv-gbtn')).toHaveLength(3);
  });

  it('agrandit la carte lorsqu’on actionne la poignée de tirage mgrab', () => {
    render(<CarnetScreenV2 detail={mockDetail} />);

    const mgrab = screen.getByLabelText(/Agrandir la carte/i);
    fireEvent.click(mgrab);

    const root = screen.getByTestId('carnet-v2-root');
    expect(root.classList.contains('mapbig')).toBe(true);
  });
});

describe('CarnetIsland Component', () => {
  it('affiche un message éphémère et déclenche le callback d’annulation', () => {
    const onUndo = vi.fn();
    const onDismiss = vi.fn();

    render(
      <CarnetIsland
        toast={{ id: '1', message: 'Commentaire supprimé', undo: onUndo }}
        onDismiss={onDismiss}
      />
    );

    expect(screen.getByTestId('carnet-island')).toBeTruthy();
    expect(screen.getByText('Commentaire supprimé')).toBeTruthy();

    const undoButton = screen.getByRole('button', { name: /Annuler/i });
    fireEvent.click(undoButton);
    expect(onUndo).toHaveBeenCalledTimes(1);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});

describe('CarnetTopBarV2 Component', () => {
  it('propose les options visiteur adaptées pour un non-participant', () => {
    const onReport = vi.fn();
    const onShare = vi.fn();

    render(
      <CarnetTopBarV2
        title="GR20 Corse"
        viewerRole="visitor"
        onOpenSettings={vi.fn()}
        onToggleOutdoor={vi.fn()}
        isOutdoor={false}
        onShare={onShare}
        onExport={vi.fn()}
        onReport={onReport}
        onCopyLink={vi.fn()}
      />
    );

    const pill = screen.getByRole('button', { name: /Menu du carnet GR20 Corse/i });
    fireEvent.click(pill);

    expect(screen.getByText('Signaler ce carnet')).toBeTruthy();
    expect(screen.queryByText('Modifier le carnet')).toBeNull();
  });
});
