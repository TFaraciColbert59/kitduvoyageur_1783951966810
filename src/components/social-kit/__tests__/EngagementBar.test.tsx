// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { EngagementBar, formatEngagementCount } from '../EngagementBar';

afterEach(cleanup);

describe('EngagementBar', () => {
  const base = { likesCount: 12, commentsCount: 1500, sharesCount: 0, liked: false };

  it('affiche les trois actions avec compteurs et aria uniques', () => {
    render(<EngagementBar {...base} onLike={() => {}} onComment={() => {}} onShare={() => {}} />);
    expect(screen.getByRole('group', { name: 'Actions de la publication' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Aimer (12)' }).getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByRole('button', { name: 'Commenter (1500)' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Partager (0)' })).toBeTruthy();
    expect(formatEngagementCount(1500)).toBe('1.5 k');
  });

  it('appelle chaque rappel sans propager le clic', () => {
    const onLike = vi.fn(); const onComment = vi.fn(); const onShare = vi.fn(); const parent = vi.fn();
    render(<div onClick={parent}><EngagementBar {...base} liked onLike={onLike} onComment={onComment} onShare={onShare} /></div>);
    fireEvent.click(screen.getByRole('button', { name: 'Aimer (12)' }));
    fireEvent.click(screen.getByRole('button', { name: 'Commenter (1500)' }));
    fireEvent.click(screen.getByRole('button', { name: 'Partager (0)' }));
    expect([onLike.mock.calls.length, onComment.mock.calls.length, onShare.mock.calls.length, parent.mock.calls.length]).toEqual([1, 1, 1, 0]);
  });

  it('ton « ink » pour les posts texte', () => {
    const { container } = render(<EngagementBar {...base} tone="ink" onLike={() => {}} onComment={() => {}} onShare={() => {}} />);
    expect(container.querySelector('.lkdv-post-media-glass.is-ink')).toBeTruthy();
  });

  it('le post du fil porte la capsule sur photo ET sur texte (une seule brique)', () => {
    const feed = readFileSync(join(process.cwd(), 'src/features/community/feed/CommunityFeedPost.tsx'), 'utf8');
    const media = readFileSync(join(process.cwd(), 'src/features/community/feed/CommunityPostMedia.tsx'), 'utf8');
    expect(feed).toContain('<EngagementBar');
    expect(feed).toContain('tone="ink"');
    expect(media).toContain('<EngagementBar');
    expect(media).not.toContain('lkdv-post-media-glass');
  });
});
