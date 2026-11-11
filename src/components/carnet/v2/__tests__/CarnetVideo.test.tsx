// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { CarnetVideoFeed, CarnetVideoThumb } from '../CarnetVideo';
import { MomentCard } from '../CarnetLenses';
import type { CarnetMomentItem } from '@/features/carnet/detail/types';

/* jsdom n'implémente pas la lecture média : sans ce double, chaque montage
   imprime « Not implemented: HTMLMediaElement.prototype.play ». */
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

const videoMoment: CarnetMomentItem = {
  id: 'm-video',
  dayNumber: 2,
  time: '13:50',
  caption: 'Torrent de l’Eychauda',
  authorName: 'Camille',
  place: 'Torrent de l’Eychauda',
  imageUrl: 'https://fixture.supabase.co/storage/v1/object/public/carnet-moments-media/u/m.mp4',
  type: 'video',
  meta: null,
};

describe('CarnetVideo — lecture vidéo de la fiche (proposition n° 31)', () => {
  it('le fil rend une vraie vidéo muette en boucle, pas une image', () => {
    const { container } = render(<CarnetVideoFeed src={videoMoment.imageUrl!} place="Torrent" />);
    const video = container.querySelector('video');
    expect(video).toBeTruthy();
    expect(video?.getAttribute('src')).toBe(videoMoment.imageUrl);
    expect(video?.muted).toBe(true);
    expect(video?.loop).toBe(true);
    expect(container.querySelector('img')).toBeNull();
  });

  it('expose des contrôles accessibles : lecture/pause et son', () => {
    render(<CarnetVideoFeed src={videoMoment.imageUrl!} place="Torrent" />);
    expect(screen.getByRole('button', { name: /Lire la vidéo/i })).toBeTruthy();
    const sound = screen.getByRole('button', { name: /Activer le son/i });
    expect(sound.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(sound);
    const muted = screen.getByRole('button', { name: /Couper le son/i });
    expect(muted.getAttribute('aria-pressed')).toBe('true');
  });

  it('un clic sur « Lire » ne casse pas si le navigateur refuse la lecture', () => {
    render(<CarnetVideoFeed src={videoMoment.imageUrl!} place="Torrent" />);
    expect(() => fireEvent.click(screen.getByRole('button', { name: /Lire la vidéo/i }))).not.toThrow();
  });

  it('un bouton 44 px ouvre le moment quand onOpen est fourni', () => {
    let opened = 0;
    render(
      <CarnetVideoFeed
        src={videoMoment.imageUrl!}
        place="Torrent"
        onOpen={() => {
          opened += 1;
        }}
      />
    );
    const open = screen.getByRole('button', { name: /Ouvrir : Torrent/i });
    expect(open.className).toContain('lkdv-video-btn');
    fireEvent.click(open);
    expect(opened).toBe(1);
  });

  it('la vignette des tuiles est un <video> inerte, sans contrôles', () => {
    const { container } = render(<CarnetVideoThumb src={videoMoment.imageUrl!} />);
    const video = container.querySelector('video');
    expect(video).toBeTruthy();
    expect(video?.getAttribute('preload')).toBe('metadata');
    expect(video?.hasAttribute('controls')).toBe(false);
    expect(container.querySelector('button')).toBeNull();
  });

  it('MomentCard rend une vidéo pour un moment vidéo et une image pour une photo', () => {
    const noop = () => undefined;
    const { container: videoCard } = render(
      <MomentCard
        moment={videoMoment}
        showDay={false}
        kitItems={[]}
        playing={false}
        canEdit={false}
        index={0}
        onOpen={noop}
        onPlay={noop}
        onEdit={noop}
        onOpenItem={noop}
      />
    );
    expect(videoCard.querySelector('video')).toBeTruthy();
    expect(videoCard.querySelector('img')).toBeNull();

    const photoCard = render(
      <MomentCard
        moment={{ ...videoMoment, id: 'm-photo', type: 'photo', imageUrl: 'https://example.test/p.jpg' }}
        showDay={false}
        kitItems={[]}
        playing={false}
        canEdit={false}
        index={0}
        onOpen={noop}
        onPlay={noop}
        onEdit={noop}
        onOpenItem={noop}
      />
    );
    expect(photoCard.container.querySelector('img')).toBeTruthy();
    expect(photoCard.container.querySelector('video')).toBeNull();
  });
});
