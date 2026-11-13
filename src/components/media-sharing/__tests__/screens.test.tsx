// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MediaSharingHub } from '../MediaSharingHub';
import { GalleryScreen } from '../GalleryScreen';
import { ExternalShareScreen } from '../ExternalShareScreen';
import { ProtectedPreviewScreen } from '../ProtectedPreviewScreen';
import { ProtectedPreviewView } from '../ProtectedPreviewView';
import { createPreviewLink, resolvePreviewLink } from '../server/contract';
import { RAW_POINTS, makeGallery, makeScreenData, makeTrack } from './fixtures';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('C04 — écrans média', () => {
  it('affiche le hub, filtre la galerie et expose les onglets accessibles', () => {
    const data = makeScreenData();
    render(<MediaSharingHub {...data} />);

    expect(screen.getByRole('heading', { level: 1, name: 'Boucle du Mont-Blanc' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Galerie' }).getAttribute('aria-selected')).toBe(
      'true',
    );
    expect(screen.getAllByText('Au sommet').length).toBeGreaterThan(0);
    expect(screen.getAllByText('La descente').length).toBeGreaterThan(0);
    expect(screen.queryByText('Sans légende')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Vidéos' }));
    expect(screen.queryByText('Au sommet')).toBeNull();
    expect(screen.getAllByText('La descente').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: 'Photos' }));
    expect(screen.getAllByText('Au sommet').length).toBeGreaterThan(0);
    expect(screen.queryByText('La descente')).toBeNull();
  });

  it('rejoue la galerie bloquée avec un état explicite, sans média', () => {
    render(
      <GalleryScreen
        result={makeGallery({ blocked: true })}
        trackTitle="Boucle du Mont-Blanc"
        sport="hiking"
        trackPoints={RAW_POINTS}
        distanceM={7000}
        elevationGainM={345}
      />,
    );
    expect(screen.getByText('Accès bloqué')).toBeTruthy();
    expect(screen.queryByRole('list', { name: 'Médias de la sortie' })).toBeNull();
  });

  it('navigue entre Flyover, Replay, Flyby et Partage', async () => {
    const data = makeScreenData();
    render(<MediaSharingHub {...data} />);

    fireEvent.click(screen.getByRole('tab', { name: 'Flyover 3D' }));
    expect(screen.getByText('Survol caméra continu, média attachés et lecture sans coupure.')).toBeTruthy();
    const play = screen.getByRole('button', { name: /Lire le flyover/ });
    fireEvent.click(play);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Mettre en pause le flyover/ })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('tab', { name: 'Replay' }));
    expect(screen.getByText('Sommet 1380 m')).toBeTruthy();
    expect(screen.getByRole('list', { name: 'Temps forts du replay' })).toBeTruthy();

    fireEvent.click(screen.getByRole('tab', { name: 'Flyby' }));
    expect(screen.getByText('Bob')).toBeTruthy();
    expect(screen.getByText('@bob')).toBeTruthy();

    fireEvent.click(screen.getByRole('tab', { name: 'Partage externe' }));
    expect(screen.getByRole('tab', { name: 'Embed web' }).getAttribute('aria-selected')).toBe(
      'true',
    );
    expect(screen.getByText(/<iframe/)).toBeTruthy();
  });

  it('refuse le partage externe d une trace privée', () => {
    const data = makeScreenData();
    const privateTrack = makeTrack({ audience: 'private' });
    render(
      <ExternalShareScreen
        embed={{ ...data.externalShare.embed, authorized: false, reason: 'audience_not_public' }}
        card={{ ...data.externalShare.card, authorized: false, reason: 'audience_not_shareable' }}
        sticker={{
          ...data.externalShare.sticker,
          authorized: false,
          reason: 'audience_not_shareable',
        }}
        title={privateTrack.title}
      />,
    );
    expect(screen.getByText('Partage impossible')).toBeTruthy();
    expect(screen.queryByText(/<iframe/)).toBeNull();
  });

  it('affiche un aperçu protégé en lecture seule et refuse un lien révoqué', () => {
    const track = makeTrack({ trackId: 'act-view', audience: 'private' });
    const { rawToken } = createPreviewLink({
      track,
      ownerId: 'owner-c04',
      expiresInSec: 3600,
    });
    const resolution = resolvePreviewLink(rawToken, track.maskVersion);
    render(<ProtectedPreviewView resolution={resolution} />);
    expect(screen.getByRole('heading', { name: 'Boucle du Mont-Blanc' })).toBeTruthy();
    expect(screen.getByText('lecture seule')).toBeTruthy();
    expect(screen.getByText('Non téléchargeable')).toBeTruthy();
    expect(screen.getByText('Non navigable')).toBeTruthy();

    cleanup();
    render(
      <ProtectedPreviewView resolution={{ ok: false, reason: 'revoked', preview: null }} />,
    );
    expect(screen.getByRole('heading', { name: 'Lien révoqué' })).toBeTruthy();
    expect(screen.getByText(/Aucune coordonnée/)).toBeTruthy();
  });

  it('crée puis révoque un lien depuis l écran propriétaire', async () => {
    const track = makeTrack({ trackId: 'act-create', audience: 'private' });
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'POST') {
        const body = JSON.parse(String(init.body)) as { linkId?: string };
        if (body.linkId) {
          return new Response(JSON.stringify({ ok: true, linkId: body.linkId }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          });
        }
        return new Response(
          JSON.stringify({
            token: 'raw-token-test',
            url: 'http://localhost:3000/apercu/raw-token-test',
            record: {
              linkId: 'ppv_test_1',
              trackId: track.trackId,
              ownerId: track.ownerId,
              maskVersion: track.maskVersion,
              createdAtMs: 1_000,
              expiresAtMs: 3_600_000,
              revokedAtMs: null,
              title: track.title,
              sport: track.sport,
              totalDistanceM: track.totalDistanceM,
              elevationGainM: track.elevationGainM,
            },
          }),
          { status: 201, headers: { 'content-type': 'application/json' } },
        );
      }
      return new Response('{}', { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<ProtectedPreviewScreen track={track} ownerId="owner-c04" />);
    fireEvent.click(screen.getByRole('button', { name: /Créer un lien révocable/ }));

    await waitFor(() => {
      expect(screen.getByText('Aperçu protégé')).toBeTruthy();
    });
    expect(screen.getByText(/raw-token-test/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Révoquer' }));
    await waitFor(() => {
      expect(screen.getByText('Lien révoqué')).toBeTruthy();
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
