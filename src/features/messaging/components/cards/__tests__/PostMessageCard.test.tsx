// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('next/image', () => ({
  default: ({ src, alt, className }: { src: string; alt: string; className?: string }) => (
    // eslint-disable-next-line @next/next/no-img-element -- mock de test
    <img src={src} alt={alt} className={className} />
  ),
}));

import { PostMessageCard } from '../PostMessageCard';
import type { PostMessageMeta } from '../../../types/messaging.types';

const META: PostMessageMeta = {
  post_id: 'post-1',
  post_url: 'https://lkdv.app/communaute?post=post-1',
  title: 'Bivouac au lac Blanc',
  image_url: 'https://cdn.example/lac.jpg',
  author_name: 'Alice',
  author_avatar: 'https://cdn.example/alice.jpg',
};

afterEach(cleanup);

describe('PostMessageCard', () => {
  it('affiche la vignette 160 × 100, le titre, l’auteur et le lien de la publication', () => {
    render(<PostMessageCard meta={META} isMine={false} />);

    expect(screen.getByText('Bivouac au lac Blanc')).toBeTruthy();
    expect(screen.getByText('Alice')).toBeTruthy();
    expect(screen.getByText('Voir la publication')).toBeTruthy();

    const link = screen.getByRole('link', { name: /Bivouac au lac Blanc/ });
    expect(link.getAttribute('href')).toBe(META.post_url);

    const media = screen.getByTestId('post-message-card-media');
    expect(media.className).toContain('h-[100px]');
    expect(media.className).toContain('w-40');
    expect(screen.getByAltText('Bivouac au lac Blanc').getAttribute('src')).toBe(META.image_url);
    expect(screen.getByTestId('post-message-card-avatar')).toBeTruthy();
  });

  it('retombe sur /communaute?post=<id> sans post_url', () => {
    render(<PostMessageCard meta={{ post_id: 'post-2', title: 'Sans lien absolu' }} isMine />);

    expect(screen.getByRole('link').getAttribute('href')).toBe('/communaute?post=post-2');
  });

  it('affiche un fallback sans image et garde le même gabarit', () => {
    render(
      <PostMessageCard meta={{ ...META, image_url: null, author_avatar: null }} isMine={false} />
    );

    expect(screen.queryByAltText('Bivouac au lac Blanc')).toBeNull();
    expect(screen.getByTestId('post-message-card-image-fallback')).toBeTruthy();
    expect(screen.getByTestId('post-message-card-avatar-fallback').textContent).toBe('A');

    const media = screen.getByTestId('post-message-card-media');
    expect(media.className).toContain('h-[100px]');
    expect(media.className).toContain('w-40');
  });

  it('affiche le titre de repli quand la publication n’a pas de titre', () => {
    render(<PostMessageCard meta={{ post_id: 'post-3' }} isMine={false} />);

    expect(screen.getByText('Publication partagée')).toBeTruthy();
    expect(screen.getByText('Voyageur LKDV')).toBeTruthy();
  });
});
