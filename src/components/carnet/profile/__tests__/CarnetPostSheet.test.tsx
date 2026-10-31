// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CarnetPostSheet, momentDate } from '../CarnetPostSheet';
import { detail } from './fixtures';

vi.mock('@/contexts/ToastContext', () => ({ useToast: () => ({ toast: () => {} }) }));
vi.mock('@/features/community/reels/FreedomCommentsDrawer', () => ({ FreedomCommentsDrawer: () => null }));
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({}) }));
vi.mock('@/lib/native/ui', () => ({ shareNativeURL: async () => false }));

afterEach(() => cleanup());

const noop = () => {};

const DETAIL = detail({
  startDate: '2026-04-25',
  endDate: '2026-05-06',
  photoMoments: [
    { id: 'm1', dayNumber: 3, time: '18:30', caption: 'Bivouac au col', authorName: null, place: 'Col de la Seigne', imageUrl: 'https://cdn.test/1.jpg' },
    { id: 'm2', dayNumber: 4, time: null, caption: null, authorName: null, place: null, imageUrl: 'https://cdn.test/2.jpg' },
  ],
});

const comments = {
  comments: [{ id: 'c1', authorId: 'u1', authorName: 'Léonie', authorAvatar: null, content: 'Superbe', createdAt: '2026-05-06T10:00:00Z' }],
  loading: false,
  send: async () => true,
  remove: async () => true,
};

function base(overrides: Partial<React.ComponentProps<typeof CarnetPostSheet>> = {}) {
  return {
    detail: DETAIL,
    index: 0,
    onIndexChange: noop,
    onClose: noop,
    comments,
    canWrite: true,
    currentUserId: 'u1',
    onRequireAuth: noop,
    onOpenViewer: noop,
    onLike: noop,
    shareUrl: 'https://lkdv.test/carnets/c1',
    onCopied: noop,
    saved: false,
    onSave: noop,
    onReport: noop,
    ...overrides,
  };
}

describe('CarnetPostSheet — le bloc post de la Communauté, alimenté par le carnet', () => {
  it('rend le bloc du fil dans la feuille du Compte avec le média du moment', () => {
    render(<CarnetPostSheet {...base()} />);
    const container = document.body;
    expect(container.querySelector('.lkdv-post-glass-sheet')).toBeTruthy();
    expect(container.querySelector('.lkdv-feed-post')).toBeTruthy();
    expect(container.querySelector('.lkdv-post-media img')?.getAttribute('src')).toBe('https://cdn.test/1.jpg');
    expect(screen.getByRole('group', { name: 'Actions de la publication' })).toBeTruthy();
    expect(container.querySelector('.lkdv-post-author')?.textContent).toContain('Camille Rochat');
  });

  it('affiche le contenu réel du moment sous la carte : jour, heure, lieu, date et légende', () => {
    render(<CarnetPostSheet {...base()} />);
    const container = document.body;
    const footer = container.querySelector('.lkdv-feed-post-footer')?.textContent ?? '';
    expect(footer).toContain('Jour 3 · 18:30 · Col de la Seigne');
    expect(footer).toContain('27 avril 2026');
    expect(footer).toContain('Bivouac au col');
  });

  it('navigue d’un moment à l’autre par les flèches du média', () => {
    const onIndexChange = vi.fn();
    render(<CarnetPostSheet {...base({ onIndexChange })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Moment suivant' }));
    expect(onIndexChange).toHaveBeenCalledWith(1);
    fireEvent.click(screen.getByRole('button', { name: 'Moment précédent' }));
    expect(onIndexChange).toHaveBeenLastCalledWith(1);
    expect(screen.getByText('1/2')).toBeTruthy();
  });

  it('aime le carnet depuis la capsule, sans inventer d’état', () => {
    const onLike = vi.fn();
    render(<CarnetPostSheet {...base({ onLike })} />);
    const like = screen.getByRole('button', { name: /^Aimer \(/ });
    expect(like.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(like);
    expect(onLike).toHaveBeenCalledTimes(1);
  });

  it('ouvre le panneau des commentaires du carnet', () => {
    render(<CarnetPostSheet {...base()} />);
    fireEvent.click(screen.getByRole('button', { name: /^Commenter \(/ }));
    expect(screen.getByRole('dialog', { name: 'Commentaires' })).toBeTruthy();
    expect(screen.getByText('Superbe')).toBeTruthy();
  });

  it('ouvre le panneau de partage avec le lien réel du carnet', () => {
    render(<CarnetPostSheet {...base()} />);
    const container = document.body;
    fireEvent.click(screen.getByRole('button', { name: /^Partager \(/ }));
    expect(screen.getByRole('dialog', { name: 'Partager' })).toBeTruthy();
    expect(container.textContent).toContain('lkdv.test/carnets/c1');
  });

  it('··· ouvre les actions réelles du carnet (enregistrer, copier, signaler) et pas « Republier »', async () => {
    vi.useFakeTimers();
    const onSave = vi.fn(); const onReport = vi.fn();
    render(<CarnetPostSheet {...base({ onSave, onReport })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Options de la publication' }));
    expect(screen.getByRole('menuitem', { name: 'Enregistrer' })).toBeTruthy();
    expect(screen.getByRole('menuitem', { name: 'Copier le lien' })).toBeTruthy();
    expect(screen.queryByRole('menuitem', { name: 'Republier' })).toBeNull();
    expect(screen.queryByRole('menuitem', { name: 'Supprimer' })).toBeNull();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Signaler' }));
    await act(async () => { vi.advanceTimersByTime(400); });
    expect(onReport).toHaveBeenCalledTimes(1);
    expect(onSave).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('ferme par la poignée de la feuille', () => {
    const onClose = vi.fn();
    render(<CarnetPostSheet {...base({ onClose })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Fermer la publication' }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});

describe('CarnetPostSheet — date réelle du moment', () => {
  it('dérive la date du moment de la date de départ et du numéro de jour', () => {
    expect(momentDate('2026-04-25', 1)).toBe('2026-04-25T12:00:00.000Z');
    expect(momentDate('2026-04-25', 3)).toBe('2026-04-27T12:00:00.000Z');
  });

  it('n’invente aucune date sans date de départ', () => {
    expect(momentDate(null, 3)).toBeNull();
    expect(momentDate('pas une date', 3)).toBeNull();
  });
});
