// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CarnetPostDrawer } from '../CarnetPostDrawer';
import { detail } from './fixtures';

afterEach(() => cleanup());

const noop = () => {};

const DETAIL = detail({
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

describe('CarnetPostDrawer — post du moment', () => {
  it('affiche le moment, le compteur et navigue', () => {
    const onIndexChange = vi.fn();
    render(<CarnetPostDrawer detail={DETAIL} index={0} onIndexChange={onIndexChange} onClose={noop} comments={comments} canWrite currentUserId="u1" onRequireAuth={noop} onOpenViewer={noop} onLike={noop} onShare={noop} />);
    expect(screen.getByText('1/2')).toBeTruthy();
    expect(screen.getByText('Bivouac au col')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Moment suivant' }));
    expect(onIndexChange).toHaveBeenCalledWith(1);
  });

  it('affiche les commentaires du carnet', () => {
    render(<CarnetPostDrawer detail={DETAIL} index={0} onIndexChange={noop} onClose={noop} comments={comments} canWrite currentUserId="u1" onRequireAuth={noop} onOpenViewer={noop} onLike={noop} onShare={noop} />);
    expect(screen.getByText('Commentaires du carnet')).toBeTruthy();
    expect(screen.getByText('Superbe')).toBeTruthy();
  });

  it('ouvre le viewer au clic sur la photo', () => {
    const onOpenViewer = vi.fn();
    render(<CarnetPostDrawer detail={DETAIL} index={0} onIndexChange={noop} onClose={noop} comments={comments} canWrite currentUserId="u1" onRequireAuth={noop} onOpenViewer={onOpenViewer} onLike={noop} onShare={noop} />);
    fireEvent.click(screen.getByRole('button', { name: 'Agrandir la photo' }));
    expect(onOpenViewer).toHaveBeenCalledWith(0);
  });
});
