// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { CommunityPostMedia } from '../CommunityPostMedia';

beforeAll(() => {
  Object.defineProperty(HTMLMediaElement.prototype, 'play', {
    configurable: true,
    value: () => Promise.resolve(),
  });
  Object.defineProperty(HTMLMediaElement.prototype, 'pause', {
    configurable: true,
    value: () => undefined,
  });
});

afterEach(() => cleanup());

const base = {
  media: 'https://fixture.supabase.co/storage/v1/object/public/carnet-moments-media/u/m.mp4',
  isVideo: true,
  likesCount: 2,
  commentsCount: 0,
  sharesCount: 0,
  liked: false,
  onLike: () => undefined,
  onComment: () => undefined,
  onShare: () => undefined,
};

describe('CommunityPostMedia — vidéo interactive de la visionneuse (proposition n° 31)', () => {
  it('en mode visionneuse : vidéo avec lecture/pause et son au toucher', () => {
    const { container } = render(<CommunityPostMedia {...base} interactiveVideo />);
    const video = container.querySelector('video');
    expect(video).toBeTruthy();
    expect(video?.getAttribute('src')).toBe(base.media);
    expect(screen.getByRole('button', { name: /Lire la vidéo/i })).toBeTruthy();

    const sound = screen.getByRole('button', { name: /Activer le son de la vidéo/i });
    expect(sound.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(sound);
    expect(screen.getByRole('button', { name: /Couper le son de la vidéo/i }).getAttribute('aria-pressed')).toBe(
      'true'
    );
  });

  it('dans le fil (sans mode visionneuse) : vignette muette, aucun contrôle', () => {
    const { container } = render(<CommunityPostMedia {...base} />);
    expect(container.querySelector('video')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Lire la vidéo/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /le son de la vidéo/i })).toBeNull();
  });
});
