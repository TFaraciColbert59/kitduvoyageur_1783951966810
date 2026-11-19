// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { CarnetPeek } from '../CarnetPeek';
import type { CarnetMomentItem } from '@/features/carnet/detail/types';

/* L'engagement par moment est écrit en base : on le remplace par un état local
   pour ne vérifier ici que le contrat du Peek (5 actions, libellés, cibles). */
vi.mock('@/features/carnet/detail/useMomentEngagement', async () => {
  const ReactLocal = await import('react');
  return {
    useMomentEngagement: (args: {
      initialLiked?: boolean;
      initialLikes?: number;
      initialSaved?: boolean;
      initialSaves?: number;
    }) => {
      const [liked, setLiked] = ReactLocal.useState(Boolean(args.initialLiked));
      const [likesCount, setLikesCount] = ReactLocal.useState(args.initialLikes ?? 0);
      const [saved, setSaved] = ReactLocal.useState(Boolean(args.initialSaved));
      const [savesCount, setSavesCount] = ReactLocal.useState(args.initialSaves ?? 0);
      return {
        liked,
        likesCount,
        saved,
        savesCount,
        comments: [],
        loadingComments: false,
        commentsLoaded: false,
        toggleLike: async () => {
          setLiked((prev) => !prev);
          setLikesCount((prev) => Math.max(0, prev + (liked ? -1 : 1)));
        },
        toggleSave: async () => {
          setSaved((prev) => !prev);
          setSavesCount((prev) => Math.max(0, prev + (saved ? -1 : 1)));
        },
        loadComments: async () => {},
        addComment: async () => true,
        deleteComment: async () => {},
      };
    },
  };
});

/* Le dialogue réel pose le verrou de scroll et le focus : hors sujet ici. */
vi.mock('../useCarnetDialog', () => ({
  useCarnetDialog: () => ({ current: null }),
}));

vi.mock('@/hooks/useHapticFeedback', () => ({
  useHapticFeedback: () => ({ haptic: () => {}, triggerHaptic: () => {} }),
}));

afterEach(() => cleanup());

const noop = () => {};

const moment: CarnetMomentItem = {
  id: 'm-1',
  dayNumber: 2,
  time: '18:30',
  caption: 'Bivouac au col',
  authorName: 'Léonie',
  place: 'Col de la Seigne',
  title: 'Bivouac au col de la Seigne',
  imageUrl: 'https://cdn.test/1.jpg',
};

function base(overrides: Partial<React.ComponentProps<typeof CarnetPeek>> = {}) {
  return {
    carnetId: 'carnet-1',
    moment,
    initialEngagement: {
      momentId: 'm-1',
      likesCount: 3,
      commentsCount: 0,
      userLiked: false,
      userSaved: false,
    },
    userId: 'u1',
    onRequireAuth: noop,
    onIsland: noop,
    onEngagementChange: noop,
    onClose: noop,
    onOpenPost: noop,
    onShare: noop,
    onReport: noop,
    ...overrides,
  };
}

describe('CarnetPeek — les actions réelles du moment', () => {
  it('affiche Lire, les cinq actions réelles dans l’ordre du socle, puis Fermer', () => {
    render(<CarnetPeek {...base()} />);

    const dialog = screen.getByRole('dialog', { name: /Moment/ });
    expect(dialog.getAttribute('aria-modal')).toBe('true');

    const labels = Array.from(dialog.querySelectorAll('.lkdv-peek-menu button')).map((button) =>
      (button.textContent ?? '').trim()
    );
    expect(labels).toEqual([
      'Lire',
      'J’aime · 3',
      'Commenter',
      'Enregistrer',
      'Partager',
      'Signaler',
      'Fermer',
    ]);
  });

  it('porte l’état du moment : compteur réel et aria-pressed sur le j’aime', async () => {
    render(<CarnetPeek {...base()} />);
    const like = screen.getByRole('button', { name: /J’aime/ });

    expect(like.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(like);

    expect(like.getAttribute('aria-pressed')).toBe('true');
    expect(like.textContent).toContain('Retirer mon j’aime · 4');
  });

  it('bascule Enregistrer en Enregistré, puis revient', () => {
    render(<CarnetPeek {...base()} />);

    const save = screen.getByRole('button', { name: 'Enregistrer' });
    expect(save.getAttribute('aria-pressed')).toBe('false');

    fireEvent.click(save);
    const saved = screen.getByRole('button', { name: 'Enregistré' });
    expect(saved.getAttribute('aria-pressed')).toBe('true');

    fireEvent.click(saved);
    expect(screen.getByRole('button', { name: 'Enregistrer' }).getAttribute('aria-pressed')).toBe(
      'false'
    );
  });

  it('Signaler ouvre la feuille de signalement de l’écran', () => {
    const onReport = vi.fn();
    render(<CarnetPeek {...base({ onReport })} />);

    fireEvent.click(screen.getByRole('button', { name: 'Signaler' }));
    expect(onReport).toHaveBeenCalledTimes(1);
  });

  it('Commenter ouvre le post du moment sur le panneau commentaires', () => {
    const onOpenPost = vi.fn();
    render(<CarnetPeek {...base({ onOpenPost })} />);

    fireEvent.click(screen.getByRole('button', { name: 'Commenter' }));
    expect(onOpenPost).toHaveBeenCalledWith('comments');
  });

  it('Partager garde le comportement de l’écran', () => {
    const onShare = vi.fn();
    render(<CarnetPeek {...base({ onShare })} />);

    fireEvent.click(screen.getByRole('button', { name: 'Partager' }));
    expect(onShare).toHaveBeenCalledTimes(1);
  });

  it('un moment sans image n’expose pas Commenter (pas de post à ouvrir)', () => {
    render(<CarnetPeek {...base({ moment: { ...moment, imageUrl: null } })} />);

    expect(screen.getAllByRole('button')).toHaveLength(6);
    expect(screen.queryByRole('button', { name: 'Commenter' })).toBeNull();
  });
});

describe('CarnetPeek — aperçu de la maquette (Lire, Voir sur la carte, Épingler, Fermer)', () => {
  it('ajoute Voir sur la carte et Épingler quand la fiche les branche', () => {
    const onShowOnMap = vi.fn();
    const onTogglePin = vi.fn();
    render(<CarnetPeek {...base({ onShowOnMap, onTogglePin, pinned: false })} />);

    fireEvent.click(screen.getByRole('button', { name: 'Voir sur la carte' }));
    expect(onShowOnMap).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Épingler' }));
    expect(onTogglePin).toHaveBeenCalledTimes(1);
  });

  it('propose Désépingler sur un moment déjà épinglé', () => {
    render(<CarnetPeek {...base({ onTogglePin: vi.fn(), pinned: true })} />);
    expect(screen.getByRole('button', { name: 'Désépingler' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('Lire ouvre le post du moment', () => {
    const onOpenPost = vi.fn();
    render(<CarnetPeek {...base({ onOpenPost })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Lire' }));
    expect(onOpenPost).toHaveBeenCalledWith('open');
  });
});
