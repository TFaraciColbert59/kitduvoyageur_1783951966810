// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CarnetPostSheet, momentDate } from '../CarnetPostSheet';
import { detail } from './fixtures';

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

describe('CarnetPostSheet — post du moment dans la forme du post du Compte', () => {
  it('reprend la feuille du Compte : verre, poignée, en-tête auteur, trois panneaux', () => {
    const { container } = render(<CarnetPostSheet {...base()} />);
    const sheet = container.ownerDocument.querySelector('.lkdv-overlay-sheet');
    expect(sheet?.className).toContain('lkdv-post-drawer');
    expect(sheet?.className).toContain('lkdv-post-glass-sheet');
    expect(container.ownerDocument.querySelector('.lkdv-post-grab')).toBeTruthy();
    expect(container.ownerDocument.querySelector('.lkdv-post-author-line b')?.textContent).toBe('Camille Rochat');
    /* Le pager des trois panneaux, comme le post du Compte. */
    const pager = container.ownerDocument.querySelector('.lkdv-lens-pager');
    expect(pager?.getAttribute('data-lens-index')).toBe('1');
    expect(container.ownerDocument.querySelectorAll('.lkdv-lens-pane.lkdv-post-pane')).toHaveLength(3);
  });

  it('peint le média du moment et la barre d’actions du Compte', () => {
    const { container } = render(<CarnetPostSheet {...base()} />);
    const doc = container.ownerDocument;
    expect(doc.querySelector('.lkdv-post-media img')?.getAttribute('src')).toBe('https://cdn.test/1.jpg');
    const glass = doc.querySelector('.lkdv-post-media-glass');
    expect(glass?.querySelectorAll('button')).toHaveLength(3);
    expect(screen.getByRole('button', { name: 'Aimer (22)' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Commenter (3)' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Partager' })).toBeTruthy();
  });

  it('affiche le contenu réel du moment : jour, heure, lieu, date et légende', () => {
    const { container } = render(<CarnetPostSheet {...base()} />);
    const doc = container.ownerDocument;
    expect(doc.querySelector('.lkdv-post-likes')?.textContent).toBe('Jour 3 · 18:30 · Col de la Seigne · 27 avril 2026');
    expect(doc.querySelector('.lkdv-post-caption')?.textContent).toBe('Bivouac au col');
  });

  it('navigue d’un moment à l’autre par les flèches du média', () => {
    const onIndexChange = vi.fn();
    const { container } = render(<CarnetPostSheet {...base({ onIndexChange })} />);
    expect(container.ownerDocument.querySelector('.lkdv-post-media-count')?.textContent).toBe('1/2');
    fireEvent.click(screen.getByRole('button', { name: 'Moment suivant' }));
    expect(onIndexChange).toHaveBeenCalledWith(1);
    fireEvent.click(screen.getByRole('button', { name: 'Moment précédent' }));
    expect(onIndexChange).toHaveBeenLastCalledWith(1);
  });

  it('aime le carnet depuis la barre d’actions, sans inventer d’état', () => {
    const onLike = vi.fn();
    render(<CarnetPostSheet {...base({ onLike })} />);
    const heart = screen.getByRole('button', { name: 'Aimer (22)' });
    expect(heart.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(heart);
    expect(onLike).toHaveBeenCalledOnce();
  });

  it('ouvre le panneau de partage avec le lien réel du carnet', () => {
    const { container } = render(<CarnetPostSheet {...base()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Partager' }));
    const doc = container.ownerDocument;
    expect(doc.querySelector('.lkdv-community-panel-slot')?.getAttribute('data-side')).toBe('share');
    expect(screen.getByRole('button', { name: /Copier le lien/ })).toBeTruthy();
    expect(doc.querySelector('.lkdv-lens-pager')?.getAttribute('data-lens-index')).toBe('0');
  });

  it('ouvre le panneau des commentaires du carnet', () => {
    const { container } = render(<CarnetPostSheet {...base()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Commenter (3)' }));
    const doc = container.ownerDocument;
    expect(doc.querySelector('.lkdv-community-panel-slot')?.getAttribute('data-side')).toBe('comments');
    expect(screen.getByText('Superbe')).toBeTruthy();
    expect(screen.getByRole('textbox', { name: 'Ajouter un commentaire' })).toBeTruthy();
    expect(doc.querySelector('.lkdv-lens-pager')?.getAttribute('data-lens-index')).toBe('2');
    /* Retour à la photo depuis le panneau. */
    fireEvent.click(screen.getByRole('button', { name: 'Retour à la photo' }));
    expect(doc.querySelector('.lkdv-lens-pager')?.getAttribute('data-lens-index')).toBe('1');
  });

  it('ouvre la photo au clavier, sans voler le double-tap qui aime', () => {
    const onOpenViewer = vi.fn();
    render(<CarnetPostSheet {...base({ onOpenViewer })} />);
    const media = screen.getByRole('button', { name: 'Agrandir la photo' });
    fireEvent.keyDown(media, { key: 'Enter' });
    expect(onOpenViewer).toHaveBeenCalledWith(0);
  });

  it('garde l’en-tête du Compte : ··· ouvre les actions réelles du carnet', () => {
    const onSave = vi.fn();
    const onReport = vi.fn();
    const { container } = render(<CarnetPostSheet {...base({ onSave, onReport })} />);
    const doc = container.ownerDocument;
    fireEvent.click(screen.getByRole('button', { name: 'Options' }));
    expect(doc.querySelector('.lkdv-post-options-menu')?.getAttribute('role')).toBe('menu');
    expect(doc.querySelectorAll('.lkdv-post-options-menu button')).toHaveLength(4);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Enregistrer' }));
    expect(onSave).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: 'Options' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Signaler' }));
    expect(onReport).toHaveBeenCalledOnce();
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
